import { describe, expect, it } from "vitest";
import {
  cleanSnippet,
  computeContentHash,
  normalizeFeedItem,
  normalizeTitle,
  normalizeUrl,
  parsePublishedDate,
} from "./normalize";

describe("normalizeUrl", () => {
  it("lowercases hostname, strips utm_* and tracking params, and removes fragments", () => {
    const raw =
      "HTTPS://WWW.BBC.CO.UK/news/world-12345/?utm_source=rss&utm_medium=feed&fbclid=abc123&page=2&a=1#section-comments";
    expect(normalizeUrl(raw)).toBe(
      "https://www.bbc.co.uk/news/world-12345?a=1&page=2"
    );
  });

  it("rejects empty, malformed, or non-http(s) URLs", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("   ")).toBeNull();
    expect(normalizeUrl("not-a-url")).toBeNull();
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl(null)).toBeNull();
  });
});

describe("parsePublishedDate", () => {
  const fixedNow = new Date("2026-10-17T08:00:00.000Z");

  it("parses valid past and present dates into ISO strings", () => {
    expect(
      parsePublishedDate("Sat, 17 Oct 2026 06:30:00 GMT", fixedNow)
    ).toBe("2026-10-17T06:30:00.000Z");
  });

  it("rejects future-dated items and malformed dates", () => {
    expect(
      parsePublishedDate("2026-10-17T09:00:00.000Z", fixedNow)
    ).toBeNull();
    expect(parsePublishedDate("invalid-date", fixedNow)).toBeNull();
    expect(parsePublishedDate("", fixedNow)).toBeNull();
    expect(parsePublishedDate(undefined, fixedNow)).toBeNull();
  });
});

describe("computeContentHash", () => {
  it("produces a deterministic 64-char sha256 hex digest", () => {
    const hash1 = computeContentHash(
      "Global Summit Opens in Geneva",
      "https://www.bbc.co.uk/news/world-123"
    );
    const hash2 = computeContentHash(
      "  global summit opens in geneva ",
      "https://www.bbc.co.uk/news/world-123"
    );
    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
  });
});

describe("normalizeFeedItem", () => {
  const fixedNow = new Date("2026-10-17T08:00:00.000Z");

  it("normalizes a valid RSS item and assigns default topics and snippet status", () => {
    const result = normalizeFeedItem(
      {
        title: "  New Climate Accord Reached  ",
        link: "https://feeds.bbci.co.uk/news/science-101?utm_campaign=rss#top",
        isoDate: "2026-10-17T05:00:00.000Z",
        contentSnippet: "<p>Delegates agreed on new emissions targets.</p>",
      },
      ["world", "climate"],
      fixedNow
    );

    expect(result).not.toBeNull();
    expect(result?.title).toBe("New Climate Accord Reached");
    expect(result?.canonical_url).toBe(
      "https://feeds.bbci.co.uk/news/science-101"
    );
    expect(result?.excerpt).toBe("Delegates agreed on new emissions targets.");
    expect(result?.extraction_status).toBe("snippet");
    expect(result?.topics).toEqual(["world", "climate"]);
  });

  it("rejects items with empty titles, missing links, or future dates", () => {
    expect(
      normalizeFeedItem(
        {
          title: "   ",
          link: "https://example.com/a",
          isoDate: "2026-10-17T05:00:00.000Z",
        },
        [],
        fixedNow
      )
    ).toBeNull();

    expect(
      normalizeFeedItem(
        {
          title: "Valid Title",
          link: "",
          isoDate: "2026-10-17T05:00:00.000Z",
        },
        [],
        fixedNow
      )
    ).toBeNull();

    expect(
      normalizeFeedItem(
        {
          title: "Future Story",
          link: "https://example.com/future",
          isoDate: "2026-10-18T05:00:00.000Z",
        },
        [],
        fixedNow
      )
    ).toBeNull();
  });

  it("cleans HTML tags in snippets and handles empty titles", () => {
    expect(normalizeTitle("   ")).toBeNull();
    expect(cleanSnippet("<b>Hello</b> <i>world</i>")).toBe("Hello world");
  });
});
