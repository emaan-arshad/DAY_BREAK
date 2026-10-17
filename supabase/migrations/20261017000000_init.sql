-- DAYBREAK initial schema
-- Source: docs/daybreak-build-plan.pdf, section 8 (data model) and section 9 (pipeline rules).
-- Run once in Supabase Dashboard -> SQL Editor. Safe to re-run (idempotent where possible).
--
-- Security model:
--   * Shared data (sources, articles): any signed-in reader can READ; only the server (service role) writes.
--   * Private data (profiles, preferences, editions, feedback_events): each reader sees only their own rows.
--   * Editions are immutable snapshots: readers can read them but never insert/update them.
--     Only the server (service role) creates editions.
--   * jobs: service role only (RLS on, no policies).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per reader
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  display_name        text,
  timezone            text not null default 'UTC',
  region              text,
  delivery_time       time not null default '06:00',
  reading_minutes     int  not null default 10 check (reading_minutes in (5, 10, 15)),
  depth               text not null default 'standard' check (depth in ('brief', 'standard', 'deep')),
  goals               text[] not null default '{}',
  excluded_sources    uuid[] not null default '{}',
  onboarding_complete boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- preferences: the editable "My editor" interest profile
-- explicit_weight = what the reader said; learned_weight = what feedback taught us.
-- Both bounded so learning can never run away.
-- ---------------------------------------------------------------------------
create table if not exists public.preferences (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  kind            text not null check (kind in ('topic', 'entity')),
  label           text not null check (char_length(label) between 1 and 80),
  explicit_weight real not null default 0 check (explicit_weight between -1 and 1),
  learned_weight  real not null default 0 check (learned_weight between -1 and 1),
  origin          text not null default 'onboarding' check (origin in ('onboarding', 'feedback', 'manual')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, kind, label)
);

create index if not exists preferences_user_idx on public.preferences (user_id);

drop trigger if exists preferences_updated_at on public.preferences;
create trigger preferences_updated_at
  before update on public.preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- sources: curated, permitted feeds/APIs (shared)
-- ---------------------------------------------------------------------------
create table if not exists public.sources (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  kind                text not null check (kind in ('rss', 'guardian', 'newsdata')),
  feed_url            text not null unique,
  homepage_url        text,
  default_topics      text[] not null default '{}',
  region              text,
  permitted_use_notes text,
  status              text not null default 'active' check (status in ('active', 'paused', 'failing')),
  last_success_at     timestamptz,
  last_error          text,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- articles: normalized, deduplicated stories (shared)
-- summary_json caches the grounded LLM editorial output so each article is summarized once.
-- ---------------------------------------------------------------------------
create table if not exists public.articles (
  id                uuid primary key default gen_random_uuid(),
  source_id         uuid not null references public.sources (id) on delete cascade,
  canonical_url     text not null unique,
  title             text not null check (char_length(title) > 0),
  author            text,
  published_at      timestamptz not null,
  fetched_at        timestamptz not null default now(),
  excerpt           text,
  body              text,
  content_hash      text not null,
  topics            text[] not null default '{}',
  language          text default 'en',
  image_url         text,
  extraction_status text not null default 'snippet' check (extraction_status in ('snippet', 'full', 'failed')),
  summary_json      jsonb,
  summarized_at     timestamptz,
  cluster_id        uuid
);

create index if not exists articles_published_idx on public.articles (published_at desc);
create index if not exists articles_source_idx    on public.articles (source_id);
create index if not exists articles_hash_idx      on public.articles (content_hash);
create index if not exists articles_topics_idx    on public.articles using gin (topics);

-- ---------------------------------------------------------------------------
-- editions: immutable published snapshots (private)
-- Unique (user_id, local_date, version) makes daily generation idempotent.
-- ---------------------------------------------------------------------------
create table if not exists public.editions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  local_date       date not null,
  version          int  not null default 1 check (version >= 1),
  edition_number   int,
  state            text not null default 'pending' check (state in ('pending', 'generating', 'published', 'failed')),
  content_json     jsonb,
  profile_snapshot jsonb,
  source_cutoff    timestamptz,
  generated_at     timestamptz,
  trigger          text not null default 'manual' check (trigger in ('scheduled', 'manual', 'preview')),
  pdf_status       text not null default 'none' check (pdf_status in ('none', 'pending', 'ready', 'failed')),
  pdf_storage_key  text,
  error            text,
  created_at       timestamptz not null default now(),
  unique (user_id, local_date, version)
);

create index if not exists editions_user_date_idx on public.editions (user_id, local_date desc);

-- ---------------------------------------------------------------------------
-- feedback_events: explicit and passive reader signals (private)
-- Feedback never edits an edition; it only influences future ones.
-- ---------------------------------------------------------------------------
create table if not exists public.feedback_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  edition_id  uuid not null references public.editions (id) on delete cascade,
  story_id    text not null,
  article_id  uuid references public.articles (id) on delete set null,
  type        text not null check (type in ('open_original', 'save', 'unsave', 'more', 'less', 'skip', 'expand', 'dwell')),
  reason      text check (reason in ('already_know', 'not_interested', 'not_now')),
  value       real,
  created_at  timestamptz not null default now()
);

create index if not exists feedback_user_idx    on public.feedback_events (user_id, created_at desc);
create index if not exists feedback_edition_idx on public.feedback_events (edition_id);

-- ---------------------------------------------------------------------------
-- jobs: scheduler / generation bookkeeping (service role only)
-- ---------------------------------------------------------------------------
create table if not exists public.jobs (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('ingest', 'edition', 'pdf')),
  idempotency_key text not null unique,
  status          text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  attempts        int  not null default 0,
  payload         jsonb,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists jobs_updated_at on public.jobs;
create trigger jobs_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.preferences     enable row level security;
alter table public.sources         enable row level security;
alter table public.articles        enable row level security;
alter table public.editions        enable row level security;
alter table public.feedback_events enable row level security;
alter table public.jobs            enable row level security;

-- profiles: own row only
drop policy if exists "profiles: read own"   on public.profiles;
drop policy if exists "profiles: insert own" on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: read own"   on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "profiles: insert own" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profiles: update own" on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- preferences: full control of own rows (the editable "My editor")
drop policy if exists "preferences: read own"   on public.preferences;
drop policy if exists "preferences: insert own" on public.preferences;
drop policy if exists "preferences: update own" on public.preferences;
drop policy if exists "preferences: delete own" on public.preferences;
create policy "preferences: read own"   on public.preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy "preferences: insert own" on public.preferences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "preferences: update own" on public.preferences for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "preferences: delete own" on public.preferences for delete to authenticated using ((select auth.uid()) = user_id);

-- sources / articles: shared read for signed-in readers; writes via service role only
drop policy if exists "sources: read"  on public.sources;
drop policy if exists "articles: read" on public.articles;
create policy "sources: read"  on public.sources  for select to authenticated using (true);
create policy "articles: read" on public.articles for select to authenticated using (true);

-- editions: read own only; no insert/update/delete for readers (immutable snapshots)
drop policy if exists "editions: read own" on public.editions;
create policy "editions: read own" on public.editions for select to authenticated using ((select auth.uid()) = user_id);

-- feedback_events: read and insert own, only against own editions
drop policy if exists "feedback: read own"   on public.feedback_events;
drop policy if exists "feedback: insert own" on public.feedback_events;
create policy "feedback: read own" on public.feedback_events for select to authenticated using ((select auth.uid()) = user_id);
create policy "feedback: insert own" on public.feedback_events for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.editions e
      where e.id = edition_id and e.user_id = (select auth.uid())
    )
  );

-- jobs: no policies -> only service role can access

-- ---------------------------------------------------------------------------
-- Explicit grants (do not rely on platform defaults); anon gets nothing.
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.preferences, public.sources, public.articles,
              public.editions, public.feedback_events, public.jobs from anon;

grant select, insert, update         on public.profiles        to authenticated;
grant select, insert, update, delete on public.preferences     to authenticated;
grant select                         on public.sources         to authenticated;
grant select                         on public.articles        to authenticated;
grant select                         on public.editions        to authenticated;
grant select, insert                 on public.feedback_events to authenticated;
revoke all                           on public.jobs            from authenticated;

grant all on public.profiles, public.preferences, public.sources, public.articles,
             public.editions, public.feedback_events, public.jobs to service_role;

-- ---------------------------------------------------------------------------
-- Private storage for edition PDFs: editions/{user_id}/{edition_id}.pdf
-- Readers can only read their own folder; only the server uploads.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('editions', 'editions', false)
on conflict (id) do nothing;

drop policy if exists "edition pdfs: read own" on storage.objects;
create policy "edition pdfs: read own" on storage.objects for select to authenticated
  using (
    bucket_id = 'editions'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- Seed: first permitted source for the Phase 1 vertical slice
-- ---------------------------------------------------------------------------
insert into public.sources (name, kind, feed_url, homepage_url, default_topics, region, permitted_use_notes)
values (
  'BBC News — World',
  'rss',
  'https://feeds.bbci.co.uk/news/world/rss.xml',
  'https://www.bbc.com/news/world',
  array['world'],
  'global',
  'Public RSS feed: headline + summary snippet + link. Store snippet only; always link to original.'
)
on conflict (feed_url) do nothing;
