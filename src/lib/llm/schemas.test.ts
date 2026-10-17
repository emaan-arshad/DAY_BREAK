import { beforeEach, describe, expect, it } from "vitest";
import {
  buildFallbackArticleSummary,
  canCallModelToday,
  DEFAULT_FALLBACK_LIMITATION,
  DEFAULT_SNIPPET_LIMITATION,
  isQuotaOrRateLimitError,
  parseAndFilterBatchSummaries,
  recordModelCall,
  resetDailyCallCountsForTest,
} from "./schemas";

describe("parseAndFilterBatchSummaries", () => {
  it("validates structured JSON and drops summaries whose id was not in the input", () => {
    const raw = JSON.stringify([
      {
        id: "art-1",
        headline: "Central Bank Holds Rates Steady",
        summary:
          "Policymakers voted to keep benchmark interest rates unchanged following April inflation figures.",
        key_facts: [{ text: "Benchmark interest rates remain unchanged." }],
        limitations: [],
      },
      {
        id: "invented-id-999",
        headline: "Hallucinated Story",
        summary: "Should be dropped because its id was not in the input batch.",
        key_facts: [],
        limitations: ["Based on snippet"],
      },
    ]);

    const map = parseAndFilterBatchSummaries(raw, new Set(["art-1", "art-2"]));
    expect(map.size).toBe(1);
    expect(map.has("invented-id-999")).toBe(false);
    expect(map.get("art-1")?.headline).toBe("Central Bank Holds Rates Steady");
    expect(map.get("art-1")?.limitations).toEqual([DEFAULT_SNIPPET_LIMITATION]);
  });

  it("throws on malformed JSON or schema violations", () => {
    expect(() =>
      parseAndFilterBatchSummaries("not-json", new Set(["art-1"]))
    ).toThrow();
    expect(() =>
      parseAndFilterBatchSummaries(
        JSON.stringify([{ id: "art-1", headline: "" }]),
        new Set(["art-1"])
      )
    ).toThrow();
  });
});

describe("buildFallbackArticleSummary", () => {
  it("constructs an attributed fallback from the publisher excerpt with limitation label", () => {
    const fallback = buildFallbackArticleSummary({
      title: "  Rail Network Upgrade Announced ",
      excerpt: "Officials outlined a five-year timetable for signal repairs.",
    });

    expect(fallback.headline).toBe("Rail Network Upgrade Announced");
    expect(fallback.summary).toBe(
      "Officials outlined a five-year timetable for signal repairs."
    );
    expect(fallback.key_facts).toEqual([]);
    expect(fallback.limitations).toEqual([DEFAULT_FALLBACK_LIMITATION]);
  });
});

describe("daily call counter and quota detection", () => {
  beforeEach(() => {
    resetDailyCallCountsForTest();
  });

  it("stops allowing calls after 400 calls/day for a given model while keeping fallback separate", () => {
    const now = new Date("2026-10-17T10:00:00.000Z");
    for (let i = 0; i < 400; i += 1) {
      expect(canCallModelToday("gemini-2.5-flash", now)).toBe(true);
      recordModelCall("gemini-2.5-flash", now);
    }
    expect(canCallModelToday("gemini-2.5-flash", now)).toBe(false);
    expect(canCallModelToday("gemini-2.5-flash-lite", now)).toBe(true);
  });

  it("recognizes HTTP 429 and quota errors", () => {
    expect(isQuotaOrRateLimitError({ status: 429 })).toBe(true);
    expect(
      isQuotaOrRateLimitError(new Error("RESOURCE_EXHAUSTED: Quota exceeded"))
    ).toBe(true);
    expect(isQuotaOrRateLimitError(new Error("Invalid JSON syntax"))).toBe(
      false
    );
  });
});
