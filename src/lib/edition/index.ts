import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { summarizeArticlesBatch } from "@/lib/llm";
import {
  buildEditionIdempotencyKey,
  computeReaderLocalDate,
  DEFAULT_EDITION_DISCLOSURE,
  EditionSnapshotSchema,
  type EditionSnapshot,
  type EditionStory,
} from "./schema";

export type { EditionSnapshot, EditionStory } from "./schema";
export {
  buildEditionIdempotencyKey,
  computeReaderLocalDate,
  EditionSnapshotSchema,
} from "./schema";

const FRESHNESS_WINDOW_HOURS = 36;
const TARGET_STORY_COUNT = 6;

interface ProfileRow {
  user_id: string;
  display_name: string | null;
  timezone: string;
  region: string | null;
  delivery_time: string;
  reading_minutes: number;
  depth: "brief" | "standard" | "deep";
  goals: string[];
  excluded_sources: string[];
  onboarding_complete: boolean;
}

interface CandidateArticleRow {
  id: string;
  source_id: string;
  canonical_url: string;
  title: string;
  published_at: string;
  excerpt: string | null;
  topics: string[] | null;
  summary_json: unknown;
  summarized_at: string | null;
}

interface SourceLookupRow {
  id: string;
  name: string;
}

export interface EditionRow {
  id: string;
  user_id: string;
  local_date: string;
  version: number;
  edition_number: number | null;
  state: "pending" | "generating" | "published" | "failed";
  content_json: EditionSnapshot;
  profile_snapshot: Record<string, unknown> | null;
  source_cutoff: string | null;
  generated_at: string | null;
  trigger: "scheduled" | "manual" | "preview";
  pdf_status: "none" | "pending" | "ready" | "failed";
  pdf_storage_key: string | null;
}

export type BuildEditionResult =
  | {
      status: "existing" | "created";
      idempotencyKey: string;
      localDate: string;
      edition: EditionRow;
      snapshot: EditionSnapshot;
      message?: string;
    }
  | {
      status: "empty";
      idempotencyKey: string;
      localDate: string;
      edition: null;
      snapshot: null;
      message: string;
    };

function formatSectionLabel(topics: string[] | null, position: number): string {
  if (position === 1) {
    return "Lead Story";
  }
  const primary = topics?.[0]?.trim();
  if (!primary) {
    return "World & Dispatch";
  }
  return primary.charAt(0).toUpperCase() + primary.slice(1);
}

async function ensureReaderProfile(userId: string): Promise<ProfileRow> {
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    return existing as ProfileRow;
  }

  const { data: created, error } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        timezone: "UTC",
        reading_minutes: 10,
        depth: "standard",
      },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();

  if (error || !created) {
    return {
      user_id: userId,
      display_name: null,
      timezone: "UTC",
      region: null,
      delivery_time: "06:00",
      reading_minutes: 10,
      depth: "standard",
      goals: [],
      excluded_sources: [],
      onboarding_complete: false,
    };
  }

  return created as ProfileRow;
}

export async function buildDailyEditionForUser(
  userId: string,
  options?: {
    version?: number;
    trigger?: "scheduled" | "manual" | "preview";
    now?: Date;
  }
): Promise<BuildEditionResult> {
  const version = options?.version ?? 1;
  const trigger = options?.trigger ?? "manual";
  const now = options?.now ?? new Date();

  const supabase = createAdminClient();
  const profile = await ensureReaderProfile(userId);
  const localDate = computeReaderLocalDate(now, profile.timezone);
  const idempotencyKey = buildEditionIdempotencyKey(userId, localDate, version);

  // 1. Idempotency check: if a published edition already exists for (user_id, local_date, version), return it.
  const { data: existingRow } = await supabase
    .from("editions")
    .select("*")
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .eq("version", version)
    .maybeSingle();

  if (existingRow && existingRow.state === "published" && existingRow.content_json) {
    const parsedSnapshot = EditionSnapshotSchema.safeParse(
      existingRow.content_json
    );
    if (parsedSnapshot.success) {
      return {
        status: "existing",
        idempotencyKey,
        localDate,
        edition: existingRow as EditionRow,
        snapshot: parsedSnapshot.data,
      };
    }
  }

  // 2. Fetch the newest ~6 fresh articles published in the last 36 hours.
  const cutoffDate = new Date(
    now.getTime() - FRESHNESS_WINDOW_HOURS * 60 * 60 * 1000
  );

  const { data: rawArticles, error: articlesError } = await supabase
    .from("articles")
    .select(
      "id, source_id, canonical_url, title, published_at, excerpt, topics, summary_json, summarized_at"
    )
    .gte("published_at", cutoffDate.toISOString())
    .order("published_at", { ascending: false })
    .limit(TARGET_STORY_COUNT);

  if (articlesError) {
    throw new Error(`Failed to query fresh articles: ${articlesError.message}`);
  }

  const freshArticles = (rawArticles ?? []) as CandidateArticleRow[];

  if (freshArticles.length === 0) {
    return {
      status: "empty",
      idempotencyKey,
      localDate,
      edition: null,
      snapshot: null,
      message:
        "No fresh verified stories were published in the last 36 hours from active sources.",
    };
  }

  // 3. Look up source names for attribution.
  const sourceIds = Array.from(new Set(freshArticles.map((a) => a.source_id)));
  const { data: sourceRows } = await supabase
    .from("sources")
    .select("id, name")
    .in("id", sourceIds);

  const sourceNameById = new Map<string, string>();
  for (const row of (sourceRows ?? []) as SourceLookupRow[]) {
    sourceNameById.set(row.id, row.name);
  }

  // 4. Summarize articles in one batched Gemini call (cached articles are skipped).
  const summariesById = await summarizeArticlesBatch(freshArticles);

  // 5. Compute sequential edition_number for this user.
  const { count: priorCount } = await supabase
    .from("editions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("state", "published");

  const editionNumber = (priorCount ?? 0) + 1;
  const editionId = existingRow?.id ?? randomUUID();
  const generatedAtIso = now.toISOString();

  const stories: EditionStory[] = freshArticles.map((article, idx) => {
    const position = idx + 1;
    const summary = summariesById.get(article.id);
    const sourceName = sourceNameById.get(article.source_id) ?? "News Wire";

    return {
      story_id: `story-${position}-${article.id.slice(0, 8)}`,
      position,
      section: formatSectionLabel(article.topics, position),
      article_ids: [article.id],
      headline: summary?.headline ?? article.title,
      summary:
        summary?.summary ??
        article.excerpt ??
        "Open the original article for full coverage.",
      key_facts: summary?.key_facts ?? [],
      limitations:
        summary?.limitations && summary.limitations.length > 0
          ? summary.limitations
          : ["Based on publisher's feed summary snippet."],
      source: {
        name: sourceName,
        url: article.canonical_url,
        published_at: article.published_at,
      },
    };
  });

  const snapshot = EditionSnapshotSchema.parse({
    edition_id: editionId,
    version,
    local_date: localDate,
    edition_number: editionNumber,
    generated_at: generatedAtIso,
    reader_timezone: profile.timezone || "UTC",
    reading_minutes: profile.reading_minutes || 10,
    disclosure: DEFAULT_EDITION_DISCLOSURE,
    stories,
  });

  const profileSnapshot = {
    timezone: profile.timezone,
    region: profile.region,
    reading_minutes: profile.reading_minutes,
    depth: profile.depth,
    goals: profile.goals,
  };

  const { data: insertedEdition, error: insertError } = await supabase
    .from("editions")
    .upsert(
      {
        id: editionId,
        user_id: userId,
        local_date: localDate,
        version,
        edition_number: editionNumber,
        state: "published",
        content_json: snapshot,
        profile_snapshot: profileSnapshot,
        source_cutoff: generatedAtIso,
        generated_at: generatedAtIso,
        trigger,
      },
      {
        onConflict: "user_id,local_date,version",
        ignoreDuplicates: true,
      }
    )
    .select("*")
    .maybeSingle();

  if (insertError) {
    throw new Error(`Failed to persist edition snapshot: ${insertError.message}`);
  }

  if (!insertedEdition) {
    // Another concurrent request won the race; fetch and return the persisted row.
    const { data: racedRow, error: racedErr } = await supabase
      .from("editions")
      .select("*")
      .eq("user_id", userId)
      .eq("local_date", localDate)
      .eq("version", version)
      .single();

    if (racedErr || !racedRow) {
      throw new Error("Failed to load concurrently created edition.");
    }

    const parsedRaced = EditionSnapshotSchema.parse(racedRow.content_json);
    return {
      status: "existing",
      idempotencyKey,
      localDate,
      edition: racedRow as EditionRow,
      snapshot: parsedRaced,
    };
  }

  return {
    status: "created",
    idempotencyKey,
    localDate,
    edition: insertedEdition as EditionRow,
    snapshot,
  };
}
