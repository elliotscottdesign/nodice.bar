-- =============================================================
-- Events platform — unified schema (Phase 1)
-- =============================================================
-- Generalises the tournament system into a full events platform:
--
--   • events           — every event (recurring or one-off, ticketed
--                        or display-only). Replaces `tournaments` +
--                        sits alongside (eventually replacing)
--                        `calendar_events`.
--   • ticket_types     — one or more priced tickets per event
--                        (Early bird, General, VIP, etc.).
--   • event_entries    — replaces `tournament_entries` — a purchase
--                        of a specific ticket type by a specific
--                        customer, with the same Stripe lifecycle.
--
-- This migration is ADDITIVE — it creates the new tables and back-
-- fills them from the existing tournaments tables. The old
-- `tournaments` + `tournament_entries` rows are left in place so
-- nothing breaks until Phase 3 swaps the consumers over.
-- =============================================================

-- 1) events table
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  external_link text,
  poster_url text,

  -- Categorisation — drives which surface(s) of the public site
  -- the event renders on. Add new values here as the venue grows.
  category text not null
    check (category in (
      'pool_tournament_doubles',
      'pool_tournament_singles',
      'pool_special',
      'dj_night',
      'food_event',
      'drink_special',
      'arcade',
      'golf',
      'other'
    )),

  -- Schedule
  event_date date not null,
  start_time time,
  end_time time,

  -- Recurrence. `recurrence_type` is captured on the PARENT row
  -- only; the materialised child rows have type='none' and point
  -- back via `recurrence_parent_id`. That keeps queries simple
  -- (every visible row is a concrete date) while still letting the
  -- admin edit a single instance or the whole series.
  recurrence_type text not null default 'none'
    check (recurrence_type in ('none', 'weekly', 'fortnightly', 'monthly')),
  recurrence_parent_id uuid references public.events(id) on delete cascade,

  -- Visibility — checkbox-style flags so one event can appear on
  -- multiple public surfaces (e.g. a DJ night both on /events
  -- calendar AND highlighted on the /bar page).
  show_on_pool_schedule boolean not null default false,
  show_on_events_calendar boolean not null default true,
  show_on_bar_page boolean not null default false,

  -- Booking
  requires_ticket boolean not null default false,
  bookable boolean not null default true,
  max_attendees int,
  registration_open boolean not null default true,

  -- Denormalised paid count — kept in sync by a trigger below.
  paid_entries_count int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_date_idx on public.events(event_date);
create index if not exists events_category_idx on public.events(category);
create index if not exists events_pool_idx on public.events(show_on_pool_schedule) where show_on_pool_schedule = true;
create index if not exists events_calendar_idx on public.events(show_on_events_calendar) where show_on_events_calendar = true;
create index if not exists events_recurrence_parent_idx on public.events(recurrence_parent_id) where recurrence_parent_id is not null;

-- 2) ticket_types table
create table if not exists public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  description text,
  price_pence int not null check (price_pence >= 0),
  -- Per-ticket-type cap (nullable = no cap beyond the event-wide
  -- max_attendees). Lets the admin sell 10 early-bird seats then
  -- close that tier while general remains open.
  capacity int,
  available_from timestamptz,
  available_until timestamptz,
  sort_order int not null default 0,
  active boolean not null default true,
  paid_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ticket_types_event_idx on public.ticket_types(event_id);

-- 3) event_entries table
create table if not exists public.event_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,

  -- Customer details
  attendee_name text not null,
  attendee_email text not null,
  attendee_phone text not null,
  -- Nullable: only present for team-style tickets (pool doubles).
  team_name text,
  -- Customer-supplied notes (dietary, accessibility, etc.).
  notes text,
  -- Marketing
  heard_from text,
  marketing_opt_in boolean not null default false,

  -- Order details. Quantity = how many of this ticket type they
  -- bought in one transaction. `amount_paid_pence` is the actual
  -- total charged (in case prices change between purchase and now).
  quantity int not null default 1 check (quantity > 0),
  amount_paid_pence int,

  -- Payment lifecycle
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'refunded', 'cancelled')),
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  paid_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_entries_event_idx on public.event_entries(event_id);
create index if not exists event_entries_ticket_idx on public.event_entries(ticket_type_id);
create index if not exists event_entries_status_idx on public.event_entries(status);
create index if not exists event_entries_pi_idx on public.event_entries(stripe_payment_intent_id);

-- 4) touch updated_at triggers (reuses the function from earlier
--    migrations).
drop trigger if exists events_touch_updated_at on public.events;
create trigger events_touch_updated_at
  before update on public.events
  for each row execute function public.touch_updated_at();

drop trigger if exists ticket_types_touch_updated_at on public.ticket_types;
create trigger ticket_types_touch_updated_at
  before update on public.ticket_types
  for each row execute function public.touch_updated_at();

drop trigger if exists event_entries_touch_updated_at on public.event_entries;
create trigger event_entries_touch_updated_at
  before update on public.event_entries
  for each row execute function public.touch_updated_at();

-- 5) Paid-count sync. Mirrors the tournaments trigger — keeps
--    events.paid_entries_count AND ticket_types.paid_count in sync
--    with the real entries so public capacity displays stay honest
--    without expensive aggregate queries.
create or replace function public.sync_event_paid_counts()
returns trigger as $$
begin
  if tg_op = 'UPDATE' then
    if old.status <> 'paid' and new.status = 'paid' then
      update public.events set paid_entries_count = paid_entries_count + new.quantity where id = new.event_id;
      update public.ticket_types set paid_count = paid_count + new.quantity where id = new.ticket_type_id;
    elsif old.status = 'paid' and new.status <> 'paid' then
      update public.events set paid_entries_count = greatest(0, paid_entries_count - old.quantity) where id = new.event_id;
      update public.ticket_types set paid_count = greatest(0, paid_count - old.quantity) where id = new.ticket_type_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.status = 'paid' then
      update public.events set paid_entries_count = greatest(0, paid_entries_count - old.quantity) where id = old.event_id;
      update public.ticket_types set paid_count = greatest(0, paid_count - old.quantity) where id = old.ticket_type_id;
    end if;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists event_entries_sync_paid_counts on public.event_entries;
create trigger event_entries_sync_paid_counts
  after update or delete on public.event_entries
  for each row execute function public.sync_event_paid_counts();

-- 6) Row Level Security
alter table public.events enable row level security;
alter table public.ticket_types enable row level security;
alter table public.event_entries enable row level security;

-- events: public reads everything visible somewhere; auth has full access.
drop policy if exists "events select visible" on public.events;
create policy "events select visible" on public.events
  for select to anon
  using (
    registration_open = true
    and (show_on_pool_schedule = true
      or show_on_events_calendar = true
      or show_on_bar_page = true)
  );
drop policy if exists "events full access for auth" on public.events;
create policy "events full access for auth" on public.events
  for all to authenticated using (true) with check (true);

-- ticket_types: public can read active tiers for visible events.
drop policy if exists "ticket_types select active" on public.ticket_types;
create policy "ticket_types select active" on public.ticket_types
  for select to anon
  using (active = true);
drop policy if exists "ticket_types full access for auth" on public.ticket_types;
create policy "ticket_types full access for auth" on public.ticket_types
  for all to authenticated using (true) with check (true);

-- event_entries: insert public (form submit), select admin only.
drop policy if exists "event_entries insert public" on public.event_entries;
create policy "event_entries insert public" on public.event_entries
  for insert to anon with check (true);
drop policy if exists "event_entries full access for auth" on public.event_entries;
create policy "event_entries full access for auth" on public.event_entries
  for all to authenticated using (true) with check (true);

-- =============================================================
-- 7) BACKFILL — copy existing tournaments → events
-- =============================================================
-- For every existing tournament row, create a matching event row
-- with the right category, then create one default ticket_type
-- ("Team entry" or "Player entry" depending on type) at the
-- tournament's current fee. Existing tournament_entries get an
-- equivalent event_entries row pointing at that ticket type.
--
-- Idempotent — keyed off `tournaments.id` (we reuse it as the
-- new event id so a re-run is a no-op).
-- =============================================================

insert into public.events (
  id, name, description, event_date, start_time,
  category,
  show_on_pool_schedule, show_on_events_calendar,
  requires_ticket, bookable, max_attendees,
  registration_open, paid_entries_count
)
select
  t.id,
  t.name,
  t.description,
  t.event_date,
  t.start_time,
  case
    when t.tournament_type = 'doubles' then 'pool_tournament_doubles'
    when t.tournament_type = 'singles' then 'pool_tournament_singles'
    when t.tournament_type = 'special' then 'pool_special'
    else 'pool_special'
  end as category,
  true as show_on_pool_schedule,
  true as show_on_events_calendar,
  true as requires_ticket,
  t.bookable,
  t.max_teams as max_attendees,
  t.registration_open,
  t.paid_entries_count
from public.tournaments t
on conflict (id) do nothing;

-- One default ticket type per migrated tournament. Reuse the
-- tournament id as the namespace so re-runs are idempotent (uuid
-- generated deterministically by combining tournament id with the
-- name 'default').
insert into public.ticket_types (
  id, event_id, name, description, price_pence,
  capacity, sort_order, active, paid_count
)
select
  -- Deterministic UUID per (tournament, 'default'): md5 + uuid cast.
  ('00000000-0000-0000-0000-' || substr(replace(t.id::text, '-', ''), 1, 12))::uuid,
  t.id,
  case
    when t.tournament_type = 'doubles' then 'Team entry'
    when t.tournament_type = 'singles' then 'Player entry'
    else 'Entry'
  end,
  null,
  t.entry_fee_pence,
  t.max_teams,
  0,
  true,
  t.paid_entries_count
from public.tournaments t
on conflict (id) do nothing;

-- Migrate tournament_entries → event_entries with the default
-- ticket type. Keeps the original entry id so any stored Stripe
-- session/intent IDs keep working.
insert into public.event_entries (
  id, event_id, ticket_type_id,
  attendee_name, attendee_email, attendee_phone, team_name,
  notes, heard_from, marketing_opt_in,
  quantity, amount_paid_pence,
  status, stripe_session_id, stripe_payment_intent_id, paid_at,
  created_at, updated_at
)
select
  e.id,
  e.tournament_id,
  ('00000000-0000-0000-0000-' || substr(replace(e.tournament_id::text, '-', ''), 1, 12))::uuid,
  e.captain_name,
  e.captain_email,
  e.captain_phone,
  e.team_name,
  e.notes,
  e.heard_from,
  e.marketing_opt_in,
  1,
  null,
  e.status,
  e.stripe_session_id,
  e.stripe_payment_intent_id,
  e.paid_at,
  e.created_at,
  e.updated_at
from public.tournament_entries e
on conflict (id) do nothing;
