import { z } from "zod";

export const KeyFactSchema = z.object({
  text: z.string().trim().min(1),
});

export const ArticleSummarySchema = z.object({
  headline: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  key_facts: z.array(KeyFactSchema),
  limitations: z.array(z.string().trim().min(1)),
});

export type ArticleSummary = z.infer<typeof ArticleSummarySchema>;

export const BatchedArticleSummaryItemSchema = ArticleSummarySchema.extend({
  id: z.string().trim().min(1),
});

export const BatchedArticleSummaryListSchema = z.array(
  BatchedArticleSummaryItemSchema
);

export type BatchedArticleSummaryItem = z.infer<
  typeof BatchedArticleSummaryItemSchema
>;

export const DEFAULT_FALLBACK_LIMITATION =
  "AI summary unavailable; showing publisher's summary";

export const DEFAULT_SNIPPET_LIMITATION =
  "Based on publisher's feed summary snippet.";

export function buildFallbackArticleSummary(
  article: { title: string; excerpt: string | null },
  limitation: string = DEFAULT_FALLBACK_LIMITATION
): ArticleSummary {
  const headline = article.title.trim() || "Untitled story";
  const excerpt = article.excerpt?.trim();
  const summary =
    excerpt && excerpt.length > 0
      ? excerpt
      : "No publisher summary snippet was provided in the feed; open the original article for full coverage.";

  return {
    headline,
    summary,
    key_facts: [],
    limitations: [limitation],
  };
}

/**
 * Validates raw JSON output from a batched Gemini call and filters out any
 * summary whose `id` was not in `allowedIds`.
 */
export function parseAndFilterBatchSummaries(
  rawJsonText: string,
  allowedIds: ReadonlySet<string>
): Map<string, ArticleSummary> {
  const parsedJson: unknown = JSON.parse(rawJsonText);
  const validated = BatchedArticleSummaryListSchema.parse(parsedJson);

  const map = new Map<string, ArticleSummary>();
  for (const item of validated) {
    if (!allowedIds.has(item.id)) {
      continue;
    }

    const limitations =
      item.limitations.length > 0
        ? item.limitations
        : [DEFAULT_SNIPPET_LIMITATION];

    map.set(item.id, {
      headline: item.headline,
      summary: item.summary,
      key_facts: item.key_facts,
      limitations,
    });
  }

  return map;
}

const DAILY_CALL_LIMIT_PER_MODEL = 400;
const dailyCallCounts = new Map<string, number>();

function getQuotaKey(model: string, now: Date = new Date()): string {
  const utcDay = now.toISOString().slice(0, 10);
  return `${utcDay}:${model}`;
}

export function canCallModelToday(
  model: string,
  now: Date = new Date()
): boolean {
  const count = dailyCallCounts.get(getQuotaKey(model, now)) ?? 0;
  return count < DAILY_CALL_LIMIT_PER_MODEL;
}

export function recordModelCall(
  model: string,
  now: Date = new Date()
): number {
  const key = getQuotaKey(model, now);
  const next = (dailyCallCounts.get(key) ?? 0) + 1;
  dailyCallCounts.set(key, next);
  return next;
}

export function resetDailyCallCountsForTest(): void {
  dailyCallCounts.clear();
}

export function isQuotaOrRateLimitError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === "object" && "status" in err) {
    const status = (err as { status?: unknown }).status;
    if (status === 429) return true;
  }
  const msg =
    err instanceof Error
      ? err.message.toLowerCase()
      : String(err).toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("resource_exhausted") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests")
  );
}
