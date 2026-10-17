# DAYBREAK

[![DAYBREAK CI](https://github.com/emaan-arshad/DAY_BREAK/actions/workflows/ci.yml/badge.svg)](https://github.com/emaan-arshad/DAY_BREAK/actions/workflows/ci.yml)

**Your morning, edited for you.** DAYBREAK is a finite, personalized daily morning newspaper built for the NaSCon-26 *"Build a personal morning paper"* hackathon. Instead of trapping readers in an infinite social or recommendation feed, DAYBREAK learns what you care about, gathers real stories across trusted news feeds and APIs every day, and publishes one coherent, source-attributed daily edition sized to your reading budget—available both as a calm editorial webpage and as an identical, print-designed downloadable newspaper PDF.

---

## Brief Requirements → Planned Features

| Brief Requirement | Planned DAYBREAK Implementation |
| :--- | :--- |
| **1. Onboarding experience** | Guided 60–90 second onboarding capturing natural-language curiosities, editable topic/entity chips, reading goals, region, timezone, and a 5/10/15-minute reading budget, with a deterministic chips-only fallback and section preview. |
| **2. PDF** | Scheduled daily edition builder and a Playwright/Chromium print worker that renders an A4 multi-page traditional newspaper PDF (masthead, running date, folio numbers, multi-column print layout, clickable source links, and takeaways) stored in private Supabase Storage. |
| **3. Webpage** | Editorial newspaper web experience (`#F5F1E8` warm paper, `#191919` ink, `#A84432` rust accent) driven by the exact same immutable `editions.content_json` snapshot as the PDF, with inline grounded summaries, original source links, skip/save controls, finite completion state, and a full historical archive. |
| **4. Learning** | Explicit per-story feedback (*more/less like this*, *skip* with optional reason, *save*) and an inspectable, editable *"My editor"* profile that updates learned topic/entity weights to improve future editions without mutating past papers. |
| **5. Room to Explore** | **Context Lens** (*"Why this matters to you"* grounded in reader goals and source evidence), plus planned differentiators **Since You Last Read** (delta against the reader's prior edition) and **Recall Three** (end-of-edition synthesis takeaways). |

See [docs/architecture.md](./docs/architecture.md) for the system architecture diagram, component breakdown, and Postgres data model.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4
- **Database, Auth & Storage**: Supabase (Postgres with Row-Level Security, Supabase Auth, private Storage bucket for PDFs)
- **AI / Editorial Engine**: Google Gemini via `@google/genai` behind a single server-side adapter (`src/lib/llm/`), configurable via `GEMINI_MODEL`
- **Validation**: `zod` for all LLM structured outputs and API inputs
- **News Ingestion**: Curated RSS feeds (`rss-parser`) + The Guardian Open Platform API (no arbitrary scraping or paywall bypassing)
- **PDF Rendering**: Playwright (`playwright` Chromium) rendering authenticated print HTML with `@media print` and `@page` CSS rules

---

## Local Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/emaan-arshad/DAY_BREAK.git
   cd DAY_BREAK
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Copy `.env.example` to `.env.local` and fill in your Supabase, Gemini, and Guardian API credentials:
   ```bash
   cp .env.example .env.local
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

---

## Available Scripts

| Script | Command | Description |
| :--- | :--- | :--- |
| `npm run dev` | `next dev` | Start the local Next.js development server |
| `npm run build` | `next build` | Create an optimized production build |
| `npm run start` | `next start` | Start the production Next.js server |
| `npm run lint` | `eslint` | Run ESLint across the repository |
| `npm run typecheck` | `next typegen && tsc --noEmit` | Generate Next.js route types and run TypeScript typechecking |
| `npm run pdf:smoke` | `node scripts/pdf-smoke.mjs` | Render the print-CSS newspaper smoke test to `output/smoke.pdf` via Playwright Chromium |

---

## Project Status

**Status: Phase 0 complete** (Repository foundations, build plan & brief docs, Next.js + TypeScript + Tailwind scaffold, dependencies, `.env.example`, Playwright Chromium PDF smoke test, GitHub Actions CI pipeline, and architecture documentation).
