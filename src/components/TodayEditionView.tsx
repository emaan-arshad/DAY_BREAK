"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import {
  EditionSnapshotSchema,
  type EditionSnapshot,
  type EditionStory,
} from "@/lib/edition/schema";

interface TodayEditionViewProps {
  initialSnapshot: EditionSnapshot | null;
  localDate: string;
  readerTimezone: string;
  readingMinutesDefault: number;
  userEmail: string | null;
  initialError?: string | null;
}

function formatMastheadDate(localDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) return localDate;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const utcDate = new Date(Date.UTC(year, month, day, 12, 0, 0));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(utcDate);
}

function formatPublishedTime(isoString: string, timeZone: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timeZone || "UTC",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(date);
  }
}

function StoryLimitationNote({ limitations }: { limitations: string[] }) {
  if (!limitations || limitations.length === 0) {
    return null;
  }
  return (
    <p className="mt-3 text-xs italic text-[#4A4742]">
      Note: {limitations.join(" · ")}
    </p>
  );
}

function LeadStoryBlock({
  story,
  timeZone,
}: {
  story: EditionStory;
  timeZone: string;
}) {
  return (
    <article
      aria-labelledby={`story-heading-${story.story_id}`}
      className="border-b-2 border-[#191919] pb-8 pt-6"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#A84432]">
        <span>{story.section}</span>
        <span aria-hidden="true" className="text-[#4A4742]">
          ·
        </span>
        <span className="text-[#4A4742]">{story.source.name}</span>
        <span aria-hidden="true" className="text-[#4A4742]">
          ·
        </span>
        <time
          dateTime={story.source.published_at}
          className="font-normal normal-case tracking-normal text-[#4A4742]"
        >
          {formatPublishedTime(story.source.published_at, timeZone)}
        </time>
      </div>

      <h2
        id={`story-heading-${story.story_id}`}
        className="font-display mt-3 text-3xl font-bold leading-tight tracking-tight text-[#191919] sm:text-4xl"
      >
        {story.headline}
      </h2>

      <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#191919] sm:text-lg">
        {story.summary}
      </p>

      {story.key_facts.length > 0 && (
        <ul
          aria-label="Key facts"
          className="mt-4 max-w-3xl list-disc space-y-1.5 pl-5 text-sm text-[#191919]"
        >
          {story.key_facts.map((fact, idx) => (
            <li key={idx}>{fact.text}</li>
          ))}
        </ul>
      )}

      <StoryLimitationNote limitations={story.limitations} />

      <div className="mt-4">
        <a
          href={story.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A84432] underline decoration-[#A84432]/60 underline-offset-4 hover:text-[#191919] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A84432]"
        >
          Read original at {story.source.name}
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  );
}

function ColumnStoryBlock({
  story,
  timeZone,
}: {
  story: EditionStory;
  timeZone: string;
}) {
  return (
    <article
      aria-labelledby={`story-heading-${story.story_id}`}
      className="flex flex-col justify-between border-b border-[#D6CFC1] pb-6 pt-4"
    >
      <div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#A84432]">
          <span>{story.section}</span>
          <span aria-hidden="true" className="text-[#4A4742]">
            ·
          </span>
          <span className="text-[#4A4742]">{story.source.name}</span>
        </div>

        <h3
          id={`story-heading-${story.story_id}`}
          className="font-display mt-2 text-xl font-bold leading-snug text-[#191919]"
        >
          {story.headline}
        </h3>

        <time
          dateTime={story.source.published_at}
          className="mt-1 block text-xs text-[#4A4742]"
        >
          {formatPublishedTime(story.source.published_at, timeZone)}
        </time>

        <p className="mt-3 text-sm leading-relaxed text-[#191919]">
          {story.summary}
        </p>

        {story.key_facts.length > 0 && (
          <ul
            aria-label="Key facts"
            className="mt-3 list-disc space-y-1 pl-4 text-xs text-[#191919]"
          >
            {story.key_facts.map((fact, idx) => (
              <li key={idx}>{fact.text}</li>
            ))}
          </ul>
        )}

        <StoryLimitationNote limitations={story.limitations} />
      </div>

      <div className="mt-4 pt-2">
        <a
          href={story.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#A84432] underline decoration-[#A84432]/60 underline-offset-4 hover:text-[#191919] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A84432]"
        >
          Read original
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  );
}

export function TodayEditionView({
  initialSnapshot,
  localDate,
  readerTimezone,
  readingMinutesDefault,
  userEmail,
  initialError = null,
}: TodayEditionViewProps) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<EditionSnapshot | null>(
    initialSnapshot
  );
  const [generating, setGenerating] = useState(false);
  const [progressStage, setProgressStage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(initialError);
  const [emptyCoverageMsg, setEmptyCoverageMsg] = useState<string | null>(null);

  async function handleGenerateEdition() {
    setGenerating(true);
    setErrorMsg(null);
    setEmptyCoverageMsg(null);
    setProgressStage(
      "Ingesting permitted RSS feeds, deduplicating stories, and composing your daily edition…"
    );

    try {
      const response = await fetch("/api/editions/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const payload = (await response.json()) as {
        status?: string;
        snapshot?: unknown;
        message?: string | null;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error || `Request failed with status ${response.status}`
        );
      }

      if (payload.status === "empty") {
        setEmptyCoverageMsg(
          payload.message ||
            "No fresh verified stories were published in the last 36 hours from active sources."
        );
        setGenerating(false);
        setProgressStage(null);
        return;
      }

      const parsed = EditionSnapshotSchema.safeParse(payload.snapshot);
      if (!parsed.success) {
        throw new Error(
          "Received an invalid edition snapshot payload from the server."
        );
      }

      setSnapshot(parsed.data);
      setGenerating(false);
      setProgressStage(null);
      router.refresh();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Unable to generate today's edition. Please try again."
      );
      setGenerating(false);
      setProgressStage(null);
    }
  }

  const activeTimezone = snapshot?.reader_timezone || readerTimezone || "UTC";
  const activeLocalDate = snapshot?.local_date || localDate;
  const activeReadingMinutes =
    snapshot?.reading_minutes || readingMinutesDefault || 10;

  const leadStory = snapshot?.stories[0] ?? null;
  const secondaryStories = snapshot?.stories.slice(1) ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F1E8] text-[#191919]">
      <SiteHeader userEmail={userEmail} showSignOut={true} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 sm:py-12">
        {/* Newspaper Masthead */}
        <header className="border-b-2 border-[#191919] pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D6CFC1] pb-2 text-xs uppercase tracking-[0.15em] text-[#4A4742]">
            <span>
              { snapshot
                ? `Edition No. ${snapshot.edition_number} · v${snapshot.version}`
                : "Morning Broadsheet"}
            </span>
            <span>
              {formatMastheadDate(activeLocalDate)} ({activeTimezone})
            </span>
            <span>Est. {activeReadingMinutes} min read</span>
          </div>

          <div className="mt-4 text-center">
            <h1 className="font-display text-5xl font-bold tracking-tight text-[#191919] sm:text-6xl">
              DAYBREAK
            </h1>
            <p className="font-display mt-1 text-sm italic text-[#4A4742]">
              Your morning, edited for you.
            </p>
          </div>
        </header>

        {/* Error Banner */}
        {errorMsg && (
          <section
            role="alert"
            aria-live="assertive"
            className="mt-6 border-l-4 border-[#A84432] bg-[#EFEADD] p-4 text-sm text-[#191919]"
          >
            <p className="font-semibold text-[#A84432]">
              Edition Error
            </p>
            <p className="mt-1">{errorMsg}</p>
          </section>
        )}

        {/* Loading / Generation Progress State */}
        {generating && (
          <section
            role="status"
            aria-live="polite"
            className="mt-8 border border-[#D6CFC1] bg-[#EFEADD] p-8 text-center"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A84432]">
              Press Running
            </p>
            <h2 className="font-display mt-2 text-2xl font-bold text-[#191919]">
              Preparing Today&apos;s Edition…
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-[#4A4742]">
              {progressStage}
            </p>
          </section>
        )}

        {/* Honest Empty Coverage State */}
        {!snapshot && !generating && emptyCoverageMsg && (
          <section
            role="status"
            aria-live="polite"
            className="mt-8 border border-[#D6CFC1] bg-[#EFEADD] p-8 text-center"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A84432]">
              No Fresh Dispatches
            </p>
            <h2 className="font-display mt-2 text-2xl font-bold text-[#191919]">
              No Fresh Stories Available Right Now
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-[#4A4742]">
              {emptyCoverageMsg}
            </p>
            <button
              type="button"
              onClick={handleGenerateEdition}
              className="mt-6 border border-[#191919] bg-[#191919] px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#F5F1E8] transition-colors hover:border-[#A84432] hover:bg-[#A84432] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A84432]"
            >
              Check Sources Again
            </button>
          </section>
        )}

        {/* Initial State: No Edition Generated Yet Today */}
        {!snapshot && !generating && !emptyCoverageMsg && (
          <section className="mt-10 border border-[#D6CFC1] bg-[#EFEADD] px-6 py-12 text-center sm:px-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A84432]">
              Morning Press Ready
            </p>
            <h2 className="font-display mt-2 text-3xl font-bold text-[#191919]">
              Today&apos;s Edition Has Not Been Printed Yet
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#4A4742]">
              Click below to fetch the latest stories from permitted feeds,
              generate grounded editorial briefs, and publish your immutable
              edition snapshot for {formatMastheadDate(activeLocalDate)}.
            </p>
            <div className="mt-8">
              <button
                type="button"
                onClick={handleGenerateEdition}
                disabled={generating}
                className="border border-[#191919] bg-[#191919] px-8 py-3.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#F5F1E8] transition-colors hover:border-[#A84432] hover:bg-[#A84432] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A84432] disabled:opacity-50"
              >
                Print today&apos;s edition
              </button>
            </div>
          </section>
        )}

        {/* Published Edition Snapshot Content */}
        {snapshot && (
          <div>
            {leadStory ? (
              <LeadStoryBlock story={leadStory} timeZone={activeTimezone} />
            ) : (
              <section className="py-12 text-center text-sm text-[#4A4742]">
                This edition snapshot contains no stories.
              </section>
            )}

            {secondaryStories.length > 0 && (
              <section
                aria-label="Edition stories"
                className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2 lg:grid-cols-3"
              >
                {secondaryStories.map((story) => (
                  <ColumnStoryBlock
                    key={story.story_id}
                    story={story}
                    timeZone={activeTimezone}
                  />
                ))}
              </section>
            )}

            {/* Finite Completion Footer & Disclosure */}
            <footer className="mt-12 border-t-2 border-[#191919] pt-8 text-center">
              <p className="font-display text-2xl font-bold text-[#191919]">
                You are caught up for this edition.
              </p>
              <p className="mx-auto mt-3 max-w-2xl text-xs leading-relaxed text-[#4A4742]">
                {snapshot.disclosure}
              </p>
              <p className="mt-2 text-[11px] uppercase tracking-widest text-[#4A4742]">
                Published{" "}
                {formatPublishedTime(snapshot.generated_at, activeTimezone)} ·
                Snapshot ID {snapshot.edition_id.slice(0, 8)}
              </p>
            </footer>
          </div>
        )}
      </main>
    </div>
  );
}
