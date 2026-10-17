import "server-only";
import Parser from "rss-parser";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeFeedItem, type RawFeedItem } from "./normalize";

const RSS_FETCH_TIMEOUT_MS = 10_000;

interface SourceRow {
  id: string;
  name: string;
  kind: "rss" | "guardian" | "newsdata";
  feed_url: string;
  default_topics: string[] | null;
  status: "active" | "paused" | "failing";
}

export interface SourceIngestResult {
  sourceId: string;
  sourceName: string;
  fetchedCount: number;
  upsertedCount: number;
  rejectedCount: number;
  error: string | null;
}

export interface IngestRunSummary {
  sourcesProcessed: number;
  totalUpserted: number;
  results: SourceIngestResult[];
}

async function fetchRssXmlWithTimeout(url: string): Promise<string> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "DaybreakMorningPaper/0.1 (+https://github.com/emaan-arshad/DAY_BREAK)",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(RSS_FETCH_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  return response.text();
}

export async function ingestActiveRssSources(): Promise<IngestRunSummary> {
  const supabase = createAdminClient();
  const parser = new Parser();

  const { data: sources, error: sourcesError } = await supabase
    .from("sources")
    .select("id, name, kind, feed_url, default_topics, status")
    .eq("kind", "rss")
    .eq("status", "active");

  if (sourcesError) {
    throw new Error(`Failed to load active RSS sources: ${sourcesError.message}`);
  }

  const activeSources = (sources ?? []) as SourceRow[];
  const results: SourceIngestResult[] = [];
  let totalUpserted = 0;

  for (const source of activeSources) {
    const now = new Date();
    try {
      const xml = await fetchRssXmlWithTimeout(source.feed_url);
      const feed = await parser.parseString(xml);
      const items = (feed.items ?? []) as RawFeedItem[];

      const dedupedByUrl = new Map<
        string,
        {
          source_id: string;
          canonical_url: string;
          title: string;
          author: string | null;
          published_at: string;
          fetched_at: string;
          excerpt: string | null;
          content_hash: string;
          topics: string[];
          extraction_status: "snippet";
        }
      >();

      let rejectedCount = 0;
      const defaultTopics = source.default_topics ?? [];

      for (const rawItem of items) {
        const normalized = normalizeFeedItem(rawItem, defaultTopics, now);
        if (!normalized) {
          rejectedCount += 1;
          continue;
        }

        if (!dedupedByUrl.has(normalized.canonical_url)) {
          dedupedByUrl.set(normalized.canonical_url, {
            source_id: source.id,
            canonical_url: normalized.canonical_url,
            title: normalized.title,
            author: normalized.author,
            published_at: normalized.published_at,
            fetched_at: now.toISOString(),
            excerpt: normalized.excerpt,
            content_hash: normalized.content_hash,
            topics: normalized.topics,
            extraction_status: "snippet",
          });
        }
      }

      const rowsToUpsert = Array.from(dedupedByUrl.values());

      if (rowsToUpsert.length > 0) {
        const { error: upsertError } = await supabase
          .from("articles")
          .upsert(rowsToUpsert, {
            onConflict: "canonical_url",
          });

        if (upsertError) {
          throw new Error(`Upsert failed: ${upsertError.message}`);
        }
      }

      await supabase
        .from("sources")
        .update({
          last_success_at: now.toISOString(),
          last_error: null,
        })
        .eq("id", source.id);

      totalUpserted += rowsToUpsert.length;
      results.push({
        sourceId: source.id,
        sourceName: source.name,
        fetchedCount: items.length,
        upsertedCount: rowsToUpsert.length,
        rejectedCount,
        error: null,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown RSS ingestion error";

      await supabase
        .from("sources")
        .update({
          last_error: errorMessage.slice(0, 500),
        })
        .eq("id", source.id);

      results.push({
        sourceId: source.id,
        sourceName: source.name,
        fetchedCount: 0,
        upsertedCount: 0,
        rejectedCount: 0,
        error: errorMessage,
      });
    }
  }

  return {
    sourcesProcessed: activeSources.length,
    totalUpserted,
    results,
  };
}
