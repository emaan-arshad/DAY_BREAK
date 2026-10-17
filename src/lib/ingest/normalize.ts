import { createHash } from "node:crypto";

const TRACKING_PARAM_NAMES = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "twclid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "si",
  "spm",
  "ref",
  "ref_src",
  "ref_url",
  "at_medium",
  "at_campaign",
  "at_custom1",
  "at_custom2",
  "at_custom3",
  "at_custom4",
  "_ga",
  "_gl",
]);

function isTrackingParam(paramName: string): boolean {
  const lower = paramName.toLowerCase();
  return (
    lower.startsWith("utm_") ||
    lower.startsWith("at_") ||
    TRACKING_PARAM_NAMES.has(lower)
  );
}

/**
 * Normalizes a raw URL into a canonical URL:
 * - Requires http: or https:
 * - Lowercases protocol and hostname
 * - Removes default ports (:80 for http, :443 for https)
 * - Strips #fragments
 * - Strips utm_* and common tracking query parameters
 * - Sorts remaining query parameters alphabetically
 */
export function normalizeUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== "string") {
    return null;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = "";

  if (
    (parsed.protocol === "http:" && parsed.port === "80") ||
    (parsed.protocol === "https:" && parsed.port === "443")
  ) {
    parsed.port = "";
  }

  const retainedEntries: Array<[string, string]> = [];
  for (const [key, value] of parsed.searchParams.entries()) {
    if (!isTrackingParam(key)) {
      retainedEntries.push([key, value]);
    }
  }

  retainedEntries.sort(([aKey, aVal], [bKey, bVal]) =>
    aKey === bKey ? aVal.localeCompare(bVal) : aKey.localeCompare(bKey)
  );

  parsed.search = "";
  for (const [key, value] of retainedEntries) {
    parsed.searchParams.append(key, value);
  }

  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }

  return parsed.toString();
}

/**
 * Trims and normalizes whitespace in a title; rejects empty titles.
 */
export function normalizeTitle(rawTitle: unknown): string | null {
  if (typeof rawTitle !== "string") {
    return null;
  }
  const normalized = rawTitle.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Cleans a feed snippet (strips HTML tags, normalizes whitespace, caps length).
 */
export function cleanSnippet(rawSnippet: unknown): string | null {
  if (typeof rawSnippet !== "string") {
    return null;
  }
  const withoutTags = rawSnippet.replace(/<[^>]*>/g, " ");
  const normalized = withoutTags.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }
  return normalized.length > 1200 ? `${normalized.slice(0, 1197)}...` : normalized;
}

/**
 * Parses and validates an item publication date.
 * Rejects missing, invalid, or future-dated timestamps (relative to `now`).
 */
export function parsePublishedDate(
  rawDate: unknown,
  now: Date = new Date()
): string | null {
  if (typeof rawDate !== "string" && !(rawDate instanceof Date)) {
    return null;
  }

  const dateObj =
    rawDate instanceof Date ? rawDate : new Date(rawDate.trim());
  const timestamp = dateObj.getTime();

  if (Number.isNaN(timestamp)) {
    return null;
  }

  // Reject future-dated items
  if (timestamp > now.getTime()) {
    return null;
  }

  return dateObj.toISOString();
}

/**
 * Computes a deterministic SHA-256 hex hash from the normalized title and canonical URL.
 */
export function computeContentHash(
  normalizedTitle: string,
  canonicalUrl: string
): string {
  const input = `${normalizedTitle.trim().toLowerCase()}\n${canonicalUrl.trim()}`;
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export interface RawFeedItem {
  title?: unknown;
  link?: unknown;
  isoDate?: unknown;
  pubDate?: unknown;
  contentSnippet?: unknown;
  content?: unknown;
  summary?: unknown;
  creator?: unknown;
  author?: unknown;
}

export interface NormalizedArticleRecord {
  canonical_url: string;
  title: string;
  author: string | null;
  published_at: string;
  excerpt: string | null;
  content_hash: string;
  topics: string[];
  extraction_status: "snippet";
}

export function normalizeFeedItem(
  item: RawFeedItem,
  defaultTopics: string[] = [],
  now: Date = new Date()
): NormalizedArticleRecord | null {
  const title = normalizeTitle(item.title);
  if (!title) {
    return null;
  }

  const canonicalUrl = normalizeUrl(item.link);
  if (!canonicalUrl) {
    return null;
  }

  const publishedAt = parsePublishedDate(item.isoDate ?? item.pubDate, now);
  if (!publishedAt) {
    return null;
  }

  const excerpt = cleanSnippet(
    item.contentSnippet ?? item.summary ?? item.content ?? null
  );

  const rawAuthor =
    typeof item.creator === "string"
      ? item.creator
      : typeof item.author === "string"
        ? item.author
        : null;
  const author = rawAuthor ? rawAuthor.replace(/\s+/g, " ").trim() || null : null;

  const contentHash = computeContentHash(title, canonicalUrl);

  return {
    canonical_url: canonicalUrl,
    title,
    author,
    published_at: publishedAt,
    excerpt,
    content_hash: contentHash,
    topics: Array.from(new Set(defaultTopics.map((t) => t.trim()).filter(Boolean))),
    extraction_status: "snippet",
  };
}
