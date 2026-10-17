import { SiteHeader } from "@/components/SiteHeader";

export function EditionSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading edition"
      className="flex min-h-screen flex-col bg-[#F5F1E8] text-[#191919]"
    >
      <SiteHeader showSignOut={false} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 sm:py-12">
        {/* Masthead Skeleton */}
        <header className="border-b-2 border-[#191919] pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D6CFC1] pb-2 text-xs uppercase tracking-[0.15em] text-[#4A4742]">
            <span>Morning Broadsheet</span>
            <span className="inline-block h-3 w-40 bg-[#D6CFC1] motion-safe:animate-pulse" />
            <span>Est. 10 min read</span>
          </div>

          <div className="mt-4 text-center">
            <p className="font-display text-5xl font-bold tracking-tight text-[#191919] sm:text-6xl">
              DAYBREAK
            </p>
            <p className="font-display mt-1 text-sm italic text-[#4A4742]">
              Your morning, edited for you.
            </p>
          </div>
        </header>

        {/* Lead Story Skeleton */}
        <div className="border-b-2 border-[#191919] pb-8 pt-6 motion-safe:animate-pulse">
          <div className="h-3 w-48 bg-[#D6CFC1]" />
          <div className="mt-4 h-9 w-4/5 bg-[#D6CFC1]" />
          <div className="mt-2 h-9 w-3/5 bg-[#D6CFC1]" />
          <div className="mt-5 space-y-2.5 max-w-3xl">
            <div className="h-4 w-full bg-[#EFEADD]" />
            <div className="h-4 w-11/12 bg-[#EFEADD]" />
            <div className="h-4 w-4/5 bg-[#EFEADD]" />
          </div>
        </div>

        {/* Multi-column Secondary Stories Skeleton */}
        <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2 lg:grid-cols-3 motion-safe:animate-pulse">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="border-b border-[#D6CFC1] pb-6 pt-4 space-y-3"
            >
              <div className="h-2.5 w-32 bg-[#D6CFC1]" />
              <div className="h-6 w-11/12 bg-[#D6CFC1]" />
              <div className="h-6 w-3/4 bg-[#D6CFC1]" />
              <div className="space-y-2 pt-2">
                <div className="h-3.5 w-full bg-[#EFEADD]" />
                <div className="h-3.5 w-10/12 bg-[#EFEADD]" />
                <div className="h-3.5 w-4/5 bg-[#EFEADD]" />
              </div>
            </div>
          ))}
        </div>

        <span className="sr-only">Loading your morning edition…</span>
      </main>
    </div>
  );
}
