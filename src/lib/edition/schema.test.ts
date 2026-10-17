import { describe, expect, it } from "vitest";
import {
  buildEditionIdempotencyKey,
  computeReaderLocalDate,
  DEFAULT_EDITION_DISCLOSURE,
  EditionSnapshotSchema,
} from "./schema";

describe("EditionSnapshotSchema", () => {
  it("validates a complete edition snapshot with stories and source attribution", () => {
    const validSnapshot = {
      edition_id: "3f29a8f0-9b14-4d00-8e8b-111122223333",
      version: 1,
      local_date: "2026-10-17",
      edition_number: 1,
      generated_at: "2026-10-17T06:00:00.000Z",
      reader_timezone: "Asia/Karachi",
      reading_minutes: 10,
      disclosure: DEFAULT_EDITION_DISCLOSURE,
      stories: [
        {
          story_id: "story-1-abc12345",
          position: 1,
          section: "Lead Story",
          article_ids: ["abc12345-0000-4000-8000-000000000001"],
          headline: "Global Trade Talks Resume in Geneva",
          summary:
            "Negotiators reconvened on Saturday to address supply chain tariffs and maritime corridors.",
          key_facts: [
            { text: "Talks resumed in Geneva on Saturday." },
          ],
          limitations: ["Based on publisher's feed summary snippet."],
          source: {
            name: "BBC News — World",
            url: "https://www.bbc.co.uk/news/world-100",
            published_at: "2026-10-17T04:30:00.000Z",
          },
        },
      ],
    };

    const parsed = EditionSnapshotSchema.safeParse(validSnapshot);
    expect(parsed.success).toBe(true);
  });

  it("rejects snapshots with malformed local_date or invalid source URL", () => {
    const invalidSnapshot = {
      edition_id: "3f29a8f0-9b14-4d00-8e8b-111122223333",
      version: 1,
      local_date: "17-10-2026",
      edition_number: 1,
      generated_at: "2026-10-17T06:00:00.000Z",
      reader_timezone: "UTC",
      reading_minutes: 10,
      disclosure: DEFAULT_EDITION_DISCLOSURE,
      stories: [
        {
          story_id: "story-1",
          position: 1,
          section: "World",
          article_ids: ["id-1"],
          headline: "Headline",
          summary: "Summary",
          key_facts: [],
          limitations: ["Snippet only"],
          source: {
            name: "BBC News",
            url: "not-a-valid-url",
            published_at: "2026-10-17T04:30:00.000Z",
          },
        },
      ],
    };

    const parsed = EditionSnapshotSchema.safeParse(invalidSnapshot);
    expect(parsed.success).toBe(false);
  });
});

describe("computeReaderLocalDate and buildEditionIdempotencyKey", () => {
  it("computes reader local_date accurately across timezones at UTC midnight boundaries", () => {
    const instant = new Date("2026-10-17T21:30:00.000Z");
    expect(computeReaderLocalDate(instant, "UTC")).toBe("2026-10-17");
    expect(computeReaderLocalDate(instant, "Asia/Karachi")).toBe("2026-10-18");
    expect(computeReaderLocalDate(instant, "America/New_York")).toBe(
      "2026-10-17"
    );
  });

  it("produces deterministic idempotency keys on (user_id, local_date, version) and rejects invalid inputs", () => {
    const key1 = buildEditionIdempotencyKey("user-123", "2026-10-17", 1);
    const key2 = buildEditionIdempotencyKey(" user-123 ", "2026-10-17", 1);
    const keyV2 = buildEditionIdempotencyKey("user-123", "2026-10-17", 2);

    expect(key1).toBe("user-123:2026-10-17:v1");
    expect(key1).toBe(key2);
    expect(keyV2).toBe("user-123:2026-10-17:v2");

    expect(() => buildEditionIdempotencyKey("", "2026-10-17", 1)).toThrow();
    expect(() =>
      buildEditionIdempotencyKey("user-123", "2026/10/17", 1)
    ).toThrow();
    expect(() =>
      buildEditionIdempotencyKey("user-123", "2026-10-17", 0)
    ).toThrow();
  });
});
