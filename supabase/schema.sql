-- =============================================================
-- Plonk Golf — database schema
-- =============================================================
-- Run this file in Supabase SQL Editor once to create every table,
-- index, trigger and Row-Level-Security policy used by the booking
-- system. Idempotent: safe to re-run.
-- =============================================================

-- ---------- helper: auto-update `updated_at` on UPDATE ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================
-- VENUES
-- =============================================================
create table if not exists public.venues (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists venues_updated_at on public.venues;
create trigger venues_updated_at
  before update on public.venues
  for each row execute function public.set_updated_at();

-- =============================================================
-- TICKETS (Adult, Child, Bundle, Pool…)
-- =============================================================
create table if not exists public.tickets (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues(id) on delete cascade,
  name        text not null,
  description text,
  kind        text not null check (kind in ('adult', 'child', 'bundle', 'other')),
  category    text not null check (category in ('golf', 'pool')),
  price_pence int  not null check (price_pence >= 0),
  vat_rate_pct int not null default 20 check (vat_rate_pct between 0 and 100),
  active      boolean not null default true,
  sort_order  int  not null default 0,
  available_days_of_week int[],   -- null = every day; e.g. {2} = Tuesdays only
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists tickets_venue_active_sort on public.tickets (venue_id, active, sort_order);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tickets_venue_id_name_key'
  ) then
    alter table public.tickets
      add constraint tickets_venue_id_name_key unique (venue_id, name);
  end if;
end$$;

drop trigger if exists tickets_updated_at on public.tickets;
create trigger tickets_updated_at
  before update on public.tickets
  for each row execute function public.set_updated_at();

-- =============================================================
-- ADDONS (basket extras — cocktails, beers, tokens, medals…)
-- =============================================================
create table if not exists public.addons (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid references public.venues(id) on delete cascade,  -- null = available at all venues
  name        text not null,
  description text,
  price_pence int  not null check (price_pence >= 0),
  vat_rate_pct int not null default 20,
  active      boolean not null default true,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists addons_updated_at on public.addons;
create trigger addons_updated_at
  before update on public.addons
  for each row execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'addons_venue_id_name_key'
  ) then
    alter table public.addons
      add constraint addons_venue_id_name_key unique (venue_id, name);
  end if;
end$$;

-- =============================================================
-- OPENING HOURS (per venue per day of week)
-- =============================================================
create table if not exists public.opening_hours (
  venue_id    uuid not null references public.venues(id) on delete cascade,
  day_of_week int  not null check (day_of_week between 0 and 6),   -- 0 = Sunday
  open_time   time not null,
  close_time  time not null,
  closed      boolean not null default false,
  primary key (venue_id, day_of_week)
);

-- =============================================================
-- CLOSED DATES (private hire / holidays / one-off closures)
-- =============================================================
create table if not exists public.closed_dates (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid references public.venues(id) on delete cascade,  -- null = both venues
  date        date not null,
  reason      text,
  created_at  timestamptz not null default now()
);

create index if not exists closed_dates_date on public.closed_dates (date);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'closed_dates_venue_id_date_key'
  ) then
    alter table public.closed_dates
      add constraint closed_dates_venue_id_date_key unique (venue_id, date);
  end if;
end$$;

-- =============================================================
-- SLOT CAPACITY OVERRIDES
-- =============================================================
create table if not exists public.slot_overrides (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues(id) on delete cascade,
  date        date not null,
  start_time  time not null,
  end_time    time not null,
  capacity    int  not null check (capacity >= 0),   -- per 10-min slot in this window
  reason      text,
  created_at  timestamptz not null default now()
);

create index if not exists slot_overrides_venue_date on public.slot_overrides (venue_id, date);

-- =============================================================
-- PROMO CODES
-- =============================================================
create table if not exists public.promo_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  kind        text not null check (kind in ('percent', 'fixed')),
  value       int  not null check (value > 0),   -- percent (1-100) or pence
  valid_from  timestamptz not null,
  valid_to    timestamptz not null,
  max_uses    int,                                -- null = unlimited
  uses        int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists promo_codes_code on public.promo_codes (code);

drop trigger if exists promo_codes_updated_at on public.promo_codes;
create trigger promo_codes_updated_at
  before update on public.promo_codes
  for each row execute function public.set_updated_at();

-- =============================================================
-- GIFT VOUCHERS
-- =============================================================
create table if not exists public.vouchers (
  id              uuid primary key default gen_random_uuid(),
  code            text unique not null,
  value_pence     int  not null check (value_pence > 0),
  balance_pence   int  not null check (balance_pence >= 0),
  issued_to_name  text,
  issued_to_email text,
  expires_at      timestamptz not null,
  status          text not null default 'active' check (status in ('active', 'redeemed', 'expired', 'cancelled')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists vouchers_code on public.vouchers (code);

drop trigger if exists vouchers_updated_at on public.vouchers;
create trigger vouchers_updated_at
  before update on public.vouchers
  for each row execute function public.set_updated_at();

-- =============================================================
-- BOOKINGS (master booking row, references slots/tickets/addons)
-- =============================================================
create table if not exists public.bookings (
  id                 uuid primary key default gen_random_uuid(),
  reference          text unique not null,                                  -- e.g. PLNK-A47K
  venue_id           uuid not null references public.venues(id),
  customer_name      text not null,
  customer_email     text not null,
  customer_phone     text,
  heard_from         text,
  marketing_opt_in   boolean not null default false,
  party_size         int  not null check (party_size > 0),
  subtotal_pence     int  not null check (subtotal_pence >= 0),
  discount_pence     int  not null default 0,
  total_pence        int  not null check (total_pence >= 0),
  currency           text not null default 'gbp',
  status             text not null check (status in ('pending', 'confirmed', 'cancelled', 'expired', 'refunded')),
  stripe_session_id          text unique,
  stripe_payment_intent_id   text unique,
  promo_code_id      uuid references public.promo_codes(id) on delete set null,
  voucher_id         uuid references public.vouchers(id) on delete set null,
  expires_at         timestamptz,   -- for 'pending' status — when the soft hold drops
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists bookings_venue on public.bookings (venue_id);
create index if not exists bookings_status on public.bookings (status);
create index if not exists bookings_email on public.bookings (customer_email);
create index if not exists bookings_pending_expires_at on public.bookings (expires_at) where status = 'pending';

drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- =============================================================
-- BOOKING SLOTS (one booking may span 2 consecutive 10-min slots)
-- =============================================================
create table if not exists public.booking_slots (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  slot_date  date not null,
  slot_time  time not null,
  count      int  not null check (count > 0),
  created_at timestamptz not null default now()
);

create index if not exists booking_slots_date_time on public.booking_slots (slot_date, slot_time);

-- =============================================================
-- BOOKING TICKETS (line items for tickets)
-- =============================================================
create table if not exists public.booking_tickets (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null references public.bookings(id) on delete cascade,
  ticket_id       uuid not null references public.tickets(id),
  quantity        int  not null check (quantity > 0),
  unit_price_pence int not null check (unit_price_pence >= 0),
  free_quantity   int  not null default 0   -- BOGOF tracking
);

-- =============================================================
-- BOOKING ADDONS (line items for extras)
-- =============================================================
create table if not exists public.booking_addons (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null references public.bookings(id) on delete cascade,
  addon_id        uuid not null references public.addons(id),
  quantity        int  not null check (quantity > 0),
  unit_price_pence int not null check (unit_price_pence >= 0)
);

-- =============================================================
-- EMAIL TEMPLATES (admin-editable copy for transactional emails)
-- =============================================================
create table if not exists public.email_templates (
  id         uuid primary key default gen_random_uuid(),
  key        text unique not null check (key in ('booking_confirmation', 'voucher_delivery', 'refund_confirmation')),
  label      text not null,
  subject    text not null,
  body       text not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists email_templates_updated_at on public.email_templates;
create trigger email_templates_updated_at
  before update on public.email_templates
  for each row execute function public.set_updated_at();

-- =============================================================
-- ROW-LEVEL SECURITY
-- =============================================================
-- Enable RLS on every table — fail-safe by default.
alter table public.venues          enable row level security;
alter table public.tickets         enable row level security;
alter table public.addons          enable row level security;
alter table public.opening_hours   enable row level security;
alter table public.closed_dates    enable row level security;
alter table public.slot_overrides  enable row level security;
alter table public.promo_codes     enable row level security;
alter table public.vouchers        enable row level security;
alter table public.bookings        enable row level security;
alter table public.booking_slots   enable row level security;
alter table public.booking_tickets enable row level security;
alter table public.booking_addons  enable row level security;
alter table public.email_templates enable row level security;

-- ------ Public READ (anon) -------
drop policy if exists "public read active venues" on public.venues;
create policy "public read active venues" on public.venues
  for select to anon, authenticated using (active = true);

drop policy if exists "public read active tickets" on public.tickets;
create policy "public read active tickets" on public.tickets
  for select to anon, authenticated using (active = true);

drop policy if exists "public read active addons" on public.addons;
create policy "public read active addons" on public.addons
  for select to anon, authenticated using (active = true);

drop policy if exists "public read opening hours" on public.opening_hours;
create policy "public read opening hours" on public.opening_hours
  for select to anon, authenticated using (true);

drop policy if exists "public read closed dates" on public.closed_dates;
create policy "public read closed dates" on public.closed_dates
  for select to anon, authenticated using (true);

drop policy if exists "public read slot overrides" on public.slot_overrides;
create policy "public read slot overrides" on public.slot_overrides
  for select to anon, authenticated using (true);

drop policy if exists "public read promo codes" on public.promo_codes;
create policy "public read promo codes" on public.promo_codes
  for select to anon, authenticated
  using (active = true and valid_from <= now() and valid_to >= now());

-- (Vouchers are validated server-side by code lookup; no public select.)

-- =============================================================
-- TABLE-LEVEL GRANTS
-- =============================================================
-- The project was created with "Automatically expose new tables" OFF
-- (Supabase-recommended safety default). RLS controls WHICH rows
-- each role sees; the underlying table privileges below decide who
-- can even ask. Belt + braces.

grant select on
  public.venues,
  public.tickets,
  public.addons,
  public.opening_hours,
  public.closed_dates,
  public.slot_overrides,
  public.promo_codes
to anon;

grant select, insert, update, delete on
  public.venues,
  public.tickets,
  public.addons,
  public.opening_hours,
  public.closed_dates,
  public.slot_overrides,
  public.promo_codes,
  public.vouchers,
  public.bookings,
  public.booking_slots,
  public.booking_tickets,
  public.booking_addons,
  public.email_templates
to authenticated;

grant insert on
  public.bookings,
  public.booking_slots,
  public.booking_tickets,
  public.booking_addons
to anon;

grant usage on all sequences in schema public to anon, authenticated;

-- ------ Authenticated (admin) FULL ACCESS -------
-- This is permissive for now; once we wire Supabase Auth with admin roles
-- we'll tighten to only the admin role.
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'venues','tickets','addons','opening_hours','closed_dates','slot_overrides',
      'promo_codes','vouchers','bookings','booking_slots','booking_tickets',
      'booking_addons','email_templates'
    ])
  loop
    execute format('drop policy if exists "auth full access" on public.%I;', t);
    execute format(
      'create policy "auth full access" on public.%I for all to authenticated using (true) with check (true);',
      t
    );
  end loop;
end$$;
