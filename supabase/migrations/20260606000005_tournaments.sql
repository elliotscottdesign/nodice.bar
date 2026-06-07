-- =============================================================
-- Tournament events + team entry sign-ups
-- =============================================================
-- Two tables:
--   `tournaments` — the events themselves, created by the founder
--                   in /admin/tournaments. One per night/competition.
--   `tournament_entries` — team sign-ups. The public form at
--                   /book/tournament writes one row per team here
--                   (status='pending_payment'); the Stripe webhook
--                   Edge Function then flips it to 'paid' on
--                   checkout.session.completed.
--
-- Payment fee is stored in PENCE (integer) — matches Stripe's
-- amount_total / unit_amount, and avoids floating-point drift.
-- A £30 entry is 3000 here.
-- =============================================================

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  event_date date not null,
  start_time time,
  max_teams int not null default 16,
  entry_fee_pence int not null check (entry_fee_pence >= 0),
  registration_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tournaments_event_date_idx on public.tournaments(event_date);
create index if not exists tournaments_registration_open_idx on public.tournaments(registration_open) where registration_open = true;

create table if not exists public.tournament_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_name text not null,
  captain_name text not null,
  captain_email text not null,
  captain_phone text not null,
  player_count int,
  notes text,
  -- status: pending_payment (form submitted, no Stripe success yet)
  --       | paid           (Stripe webhook confirmed)
  --       | refunded       (admin issued refund via Stripe)
  --       | cancelled      (founder cancelled, no payment / no refund needed)
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'refunded', 'cancelled')),
  -- Stripe session id from checkout.sessions.create() — populated
  -- before the redirect so the webhook can find the row.
  stripe_session_id text unique,
  -- Stripe payment intent id from the webhook payload — used later
  -- to issue refunds. Null until paid.
  stripe_payment_intent_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tournament_entries_tournament_idx on public.tournament_entries(tournament_id);
create index if not exists tournament_entries_status_idx on public.tournament_entries(status);
create index if not exists tournament_entries_stripe_session_idx on public.tournament_entries(stripe_session_id);

-- Touch updated_at on every update.
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tournaments_touch_updated_at on public.tournaments;
create trigger tournaments_touch_updated_at
  before update on public.tournaments
  for each row execute function public.touch_updated_at();

drop trigger if exists tournament_entries_touch_updated_at on public.tournament_entries;
create trigger tournament_entries_touch_updated_at
  before update on public.tournament_entries
  for each row execute function public.touch_updated_at();

-- =============================================================
-- Row Level Security
-- =============================================================
-- Tournaments:
--   • Public can SELECT registration_open=true rows so the public
--     /book/tournament form can show "which tournament are you
--     signing up to?" if there's more than one open.
--   • Authenticated (admin) can do everything.
-- Entries:
--   • Public can INSERT only — so the form works without a login.
--     They CANNOT read other people's entries (no SELECT for anon).
--   • Authenticated (admin) can SELECT / UPDATE / DELETE everything.
--   • The Edge Function uses the service-role key so it bypasses
--     RLS when it updates status='paid' after Stripe webhook.
-- =============================================================

alter table public.tournaments enable row level security;
alter table public.tournament_entries enable row level security;

-- Tournaments — public read for active registrations, full access for auth.
drop policy if exists "tournaments select open" on public.tournaments;
create policy "tournaments select open" on public.tournaments
  for select to anon
  using (registration_open = true);

drop policy if exists "tournaments full access for auth" on public.tournaments;
create policy "tournaments full access for auth" on public.tournaments
  for all to authenticated
  using (true) with check (true);

-- Entries — public insert only, full access for auth.
drop policy if exists "tournament_entries insert public" on public.tournament_entries;
create policy "tournament_entries insert public" on public.tournament_entries
  for insert to anon
  with check (true);

drop policy if exists "tournament_entries full access for auth" on public.tournament_entries;
create policy "tournament_entries full access for auth" on public.tournament_entries
  for all to authenticated
  using (true) with check (true);
