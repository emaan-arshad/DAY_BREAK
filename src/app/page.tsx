import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F5F1E8] text-[#191919]">
      <SiteHeader showSignOut={false} />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 py-16 sm:px-8">
        <div className="border-t-2 border-b border-[#191919] py-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#4A4742]">
            Daily Personal Broadsheet · Finite &amp; Source-Attributed
          </p>
        </div>

        <section className="py-12 text-center sm:py-16">
          <h1 className="font-display text-5xl font-bold tracking-tight text-[#191919] sm:text-7xl">
            DAYBREAK
          </h1>
          <p className="font-display mt-4 text-2xl italic text-[#A84432] sm:text-3xl">
            Your morning, edited for you.
          </p>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[#4A4742]">
            Instead of an endless feed, Daybreak gathers trusted reporting
            across the web and composes one finite morning newspaper—available
            on the web and as a print-designed PDF.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center justify-center border border-[#191919] bg-[#191919] px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#F5F1E8] transition-colors hover:border-[#A84432] hover:bg-[#A84432] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A84432]"
            >
              Sign in to Read
            </Link>
            <Link
              href="/today"
              className="inline-flex items-center justify-center border border-[#191919] bg-transparent px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#191919] transition-colors hover:bg-[#EFEADD] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A84432]"
            >
              Open Today&apos;s Edition
            </Link>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 border-t border-[#D6CFC1] pt-8 text-left sm:grid-cols-3">
          <div className="border-l border-[#D6CFC1] pl-4">
            <h2 className="font-display text-base font-bold text-[#191919]">
              Finite by Design
            </h2>
            <p className="mt-1 text-sm text-[#4A4742]">
              One calm daily edition sized to your reading budget—finish your
              paper and get on with your morning.
            </p>
          </div>
          <div className="border-l border-[#D6CFC1] pl-4">
            <h2 className="font-display text-base font-bold text-[#191919]">
              Grounded &amp; Attributed
            </h2>
            <p className="mt-1 text-sm text-[#4A4742]">
              Every story links directly to its original publisher with honest
              coverage disclosures.
            </p>
          </div>
          <div className="border-l border-[#D6CFC1] pl-4">
            <h2 className="font-display text-base font-bold text-[#191919]">
              Web &amp; Print Parity
            </h2>
            <p className="mt-1 text-sm text-[#4A4742]">
              Read online or download the same immutable edition formatted as a
              traditional newspaper PDF.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
