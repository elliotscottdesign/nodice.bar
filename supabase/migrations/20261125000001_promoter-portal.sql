-- =============================================================
-- Promoter portal — schema
-- =============================================================
-- Lets whoever is promoting an event (a music DJ selling their own-ticket
-- night, Billy running Comedy & Bingo, a chef pop-up) log in on the website
-- with their email, watch LIVE ticket sales for THEIR events, copy the public
-- ticket link, and leave notes for the venue to action.
--
-- Ticket sales themselves are NOT stored here — they stay in event_entries /
-- tournament_entries (the Stripe checkout flow). These tables only add: who a
-- promoter is, which events are theirs, and the two-way note thread.
--
-- Everything here is RLS-locked with NO anon access (promoter emails and the
-- login material must never be scrapeable from the public anon key). All reads
-- and writes go through the `promoter` edge function (service role). The
-- `authenticated` role (staff signed in behind /admin's AdminGate) gets full
-- access so the events builder can read assignments if it ever needs to.
-- =============================================================

-- A promoter is identified by their email. One promoter → many events.
create table if not exists public.promoters (
  email           text primary key,          -- always stored lower-cased
  name            text,
  -- PBKDF2 hash, formatted "iterations:saltB64:hashB64". Never plaintext.
  -- Nullable: a promoter can be set up magic-link-only (no password typed).
  pass_hash       text,
  -- Random hex. Doubles as (a) the one-click magic-login token in the welcome
  -- email and (b) the persistent portal session token stored in the browser.
  token           text not null unique,
  welcome_sent_at timestamptz,               -- when login details were emailed
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Which events belong to a promoter. Composite so a night can have more than
-- one promoter (e.g. a b2b DJ pair) and a promoter can run many nights.
create table if not exists public.event_promoters (
  event_id       uuid not null references public.events(id) on delete cascade,
  promoter_email text not null references public.promoters(email) on delete cascade,
  assigned_at    timestamptz not null default now(),
  primary key (event_id, promoter_email)
);

create index if not exists event_promoters_email_idx
  on public.event_promoters (promoter_email);

-- Two-way note thread per event: the promoter leaves details/requests for the
-- venue, the venue can reply. Promoters don't edit the live event directly —
-- they ask here and the office actions it in the builder.
create table if not exists public.promoter_notes (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events(id) on delete cascade,
  author       text not null check (author in ('promoter', 'office')),
  author_email text,
  body         text not null,
  created_at   timestamptz not null default now(),
  read_at      timestamptz               -- set when the other side has seen it
);

create index if not exists promoter_notes_event_idx
  on public.promoter_notes (event_id, created_at);

-- ── RLS: no anon access; staff (authenticated) full access; the edge
--        function uses the service role and bypasses RLS entirely. ──────────
alter table public.promoters        enable row level security;
alter table public.event_promoters  enable row level security;
alter table public.promoter_notes   enable row level security;

create policy "promoters full access for auth" on public.promoters
  for all to authenticated using (true) with check (true);
create policy "event_promoters full access for auth" on public.event_promoters
  for all to authenticated using (true) with check (true);
create policy "promoter_notes full access for auth" on public.promoter_notes
  for all to authenticated using (true) with check (true);
-- (no anon policies → anon has no access to any of the three tables)
