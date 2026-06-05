-- =============================================================
-- bar_reservations — pool table + restaurant table reservations
-- =============================================================
-- Single table for both kinds of in-venue reservation. Stripe is
-- NOT wired up yet — every row lands as status='pending' and the
-- admin confirms manually. When Stripe is added later, we extend
-- the row with stripe_session_id / payment_intent.
--
-- Time-slot configuration lives in the public booking pages, not
-- the DB:
--   • pool   : 30-minute slots starting on the hour and half-hour
--   • table  : 15-minute granularity
-- =============================================================

create table if not exists public.bar_reservations (
  id                uuid primary key default gen_random_uuid(),
  -- 'pool' = a pool table booking, 'table' = a restaurant table.
  kind              text not null check (kind in ('pool', 'table')),
  reservation_date  date not null,
  start_time        time not null,
  duration_minutes  int  not null default 60,
  party_size        int  not null check (party_size > 0),
  -- For pool: number of tables wanted. For 'table': stays at 1
  -- (party_size is the only thing that matters).
  resource_count    int  not null default 1,
  name              text not null,
  email             text not null,
  phone             text,
  notes             text,
  status            text not null default 'pending'
                     check (status in ('pending', 'confirmed', 'cancelled')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists bar_reservations_date     on public.bar_reservations (reservation_date, start_time);
create index if not exists bar_reservations_status   on public.bar_reservations (status, reservation_date);

-- Updated-at trigger (uses the set_updated_at function defined in
-- the bootstrap schema).
drop trigger if exists bar_reservations_updated_at on public.bar_reservations;
create trigger bar_reservations_updated_at
  before update on public.bar_reservations
  for each row execute function public.set_updated_at();

-- ---------- Row-Level Security ----------
alter table public.bar_reservations enable row level security;

-- Anyone can INSERT — that's the public booking form. RLS prevents
-- them from reading anyone else's bookings even after submission.
drop policy if exists "anon insert bar reservations" on public.bar_reservations;
create policy "anon insert bar reservations"
  on public.bar_reservations
  for insert
  to anon, authenticated
  with check (true);

-- Authenticated users (admin) get full read/write so the admin list
-- view can load + update status. Public reads are denied.
drop policy if exists "auth full access bar reservations" on public.bar_reservations;
create policy "auth full access bar reservations"
  on public.bar_reservations
  for all
  to authenticated
  using (true)
  with check (true);

-- Grants (mirrors the pattern from 20260101000001_grant-access.sql).
grant insert on public.bar_reservations to anon;
grant insert on public.bar_reservations to authenticated;
grant select, update, delete on public.bar_reservations to authenticated;
