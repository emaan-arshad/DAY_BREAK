import { z } from "zod";
import { KeyFactSchema } from "@/lib/llm/schemas";

export const EditionStorySourceSchema = z.object({
  name: z.string().trim().min(1),
  url: z.url(),
  published_at: z.string().trim().min(1),
});

export const EditionStorySchema = z.object({
  story_id: z.string().trim().min(1),
  position: z.number().int().min(1),
  section: z.string().trim().min(1),
  article_ids: z.array(z.string().trim().min(1)).min(1),
  headline: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  key_facts: z.array(KeyFactSchema),
  limitations: z.array(z.string().trim().min(1)),
  source: EditionStorySourceSchema,
});

export const EditionSnapshotSchema = z.object({
  edition_id: z.string().trim().min(1),
  version: z.number().int().min(1),
  local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  edition_number: z.number().int().min(1),
  generated_at: z.string().trim().min(1),
  reader_timezone: z.string().trim().min(1),
  reading_minutes: z.number().int().positive(),
  disclosure: z.string().trim().min(1),
  stories: z.array(EditionStorySchema),
});

export type EditionStorySource = z.infer<typeof EditionStorySourceSchema>;
export type EditionStory = z.infer<typeof EditionStorySchema>;
export type EditionSnapshot = z.infer<typeof EditionSnapshotSchema>;

export const DEFAULT_EDITION_DISCLOSURE =
  "Stories are selected from permitted feeds and summarized by AI strictly from publisher snippets. Every brief links to its original source.";

/**
 * Formats a Date into YYYY-MM-DD in the reader's configured IANA timezone.
 * Falls back to UTC if the timezone identifier is invalid.
 */
export function computeReaderLocalDate(
  now: Date = new Date(),
  timeZone: string = "UTC"
): string {
  const safeZone = timeZone.trim() || "UTC";
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: safeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(now);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fall back to UTC below
  }
  return now.toISOString().slice(0, 10);
}

/**
 * Builds the deterministic idempotency key for a user's daily edition version:
 * (user_id, local_date, version)
 */
export function buildEditionIdempotencyKey(
  userId: string,
  localDate: string,
  version: number = 1
): string {
  const trimmedUser = userId.trim();
  const trimmedDate = localDate.trim();
  if (!trimmedUser) {
    throw new Error("userId is required for edition idempotency key.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
    throw new Error(`Invalid localDate "${trimmedDate}"; expected YYYY-MM-DD.`);
  }
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`Invalid edition version "${version}"; must be an integer >= 1.`);
  }
  return `${trimmedUser}:${trimmedDate}:v${version}`;
}
