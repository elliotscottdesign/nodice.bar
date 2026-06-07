-- =============================================================
-- Bookable products — pool tables, bar tables, future surfaces
-- =============================================================
-- One row per "thing the customer can book online". Each product
-- carries its own opening hours, price windows, and per-date
-- overrides. The customer-facing /book/<id> page reads from these
-- tables instead of hard-coded constants, so the founder can
-- configure new sessions / change prices / close days without us
-- pushing code.
--
-- Mental model:
--   bookable_products       — master config + on/off switch
--   bookable_hours          — recurring weekly opening hours
--   bookable_date_overrides — one-off changes (closed days, special hours)
--   bookable_price_windows  — time-of-day price rules
--
-- Pricing semantics: for each 30-min block in a booking, pick the
-- highest-priority price_window whose day_of_week and time range
-- contains the block's start. Sum the per-30-min prices.
-- =============================================================

-- ---------- bookable_products ----------
create table if not exists public.bookable_products (
  id                          text primary key,         -- 'pool', 'table', 'golf', …
  name                        text not null,            -- "Pool tables"
  enabled                     boolean not null default true,
  closed_message              text,
  slot_duration_minutes       integer not null default 30,
  min_duration_minutes        integer not null default 30,
  max_duration_minutes        integer not null default 60,
  duration_step_minutes       integer not null default 30,
  min_party_size              integer not null default 1,
  max_party_size              integer not null default 8,
  default_resource_count      integer not null default 1, -- e.g. 1 pool table per booking
  -- The customer-facing booking page header copy. Lets the founder
  -- re-skin /book/<id> without touching code.
  customer_eyebrow            text,
  customer_title              text,
  customer_intro              text,
  updated_at                  timestamptz not null default now()
);

alter table public.bookable_products enable row level security;
drop policy if exists "bookable_products select public" on public.bookable_products;
create policy "bookable_products select public" on public.bookable_products
  for select to anon using (true);
drop policy if exists "bookable_products full auth" on public.bookable_products;
create policy "bookable_products full auth" on public.bookable_products
  for all to authenticated using (true) with check (true);

drop trigger if exists bookable_products_touch_updated_at on public.bookable_products;
create trigger bookable_products_touch_updated_at
  before update on public.bookable_products
  for each row execute function public.touch_updated_at();

-- ---------- bookable_hours ----------
-- One row per (product, day_of_week, time-window). Multiple rows
-- per day are allowed for split shifts (e.g. lunch + evening).
create table if not exists public.bookable_hours (
  id            uuid primary key default gen_random_uuid(),
  product_id    text not null references public.bookable_products(id) on delete cascade,
  day_of_week   integer not null check (day_of_week between 0 and 6), -- 0=Sun
  open_time     time not null,
  close_time    time not null,
  updated_at    timestamptz not null default now(),
  check (open_time < close_time)
);
create index if not exists bookable_hours_product_idx
  on public.bookable_hours (product_id, day_of_week);

alter table public.bookable_hours enable row level security;
drop policy if exists "bookable_hours select public" on public.bookable_hours;
create policy "bookable_hours select public" on public.bookable_hours
  for select to anon using (true);
drop policy if exists "bookable_hours full auth" on public.bookable_hours;
create policy "bookable_hours full auth" on public.bookable_hours
  for all to authenticated using (true) with check (true);

drop trigger if exists bookable_hours_touch_updated_at on public.bookable_hours;
create trigger bookable_hours_touch_updated_at
  before update on public.bookable_hours
  for each row execute function public.touch_updated_at();

-- ---------- bookable_date_overrides ----------
-- A specific date that breaks the recurring weekly pattern:
--   closed = true        → no bookings that day at all
--   closed = false       → use open_time/close_time INSTEAD of the
--                          recurring hours for that day
create table if not exists public.bookable_date_overrides (
  id            uuid primary key default gen_random_uuid(),
  product_id    text not null references public.bookable_products(id) on delete cascade,
  date          date not null,
  closed        boolean not null default true,
  open_time     time,
  close_time    time,
  note          text,                                    -- 'Private hire', 'Bank holiday'…
  updated_at    timestamptz not null default now(),
  unique (product_id, date),
  check (
    closed = true
    or (open_time is not null and close_time is not null and open_time < close_time)
  )
);
create index if not exists bookable_date_overrides_idx
  on public.bookable_date_overrides (product_id, date);

alter table public.bookable_date_overrides enable row level security;
drop policy if exists "bookable_date_overrides select public" on public.bookable_date_overrides;
create policy "bookable_date_overrides select public" on public.bookable_date_overrides
  for select to anon using (true);
drop policy if exists "bookable_date_overrides full auth" on public.bookable_date_overrides;
create policy "bookable_date_overrides full auth" on public.bookable_date_overrides
  for all to authenticated using (true) with check (true);

drop trigger if exists bookable_date_overrides_touch_updated_at on public.bookable_date_overrides;
create trigger bookable_date_overrides_touch_updated_at
  before update on public.bookable_date_overrides
  for each row execute function public.touch_updated_at();

-- ---------- bookable_price_windows ----------
-- A pricing rule: "on these days, between these times, charge X
-- per 30 mins". Higher priority wins when multiple windows match
-- the same slot. There should always be at least one window with
-- is_default=true that covers any unmatched slot — UI enforces it.
create table if not exists public.bookable_price_windows (
  id                       uuid primary key default gen_random_uuid(),
  product_id               text not null references public.bookable_products(id) on delete cascade,
  name                     text not null,                -- "Standard", "Monday all day", "Happy hour"
  days_of_week             integer[] not null default '{0,1,2,3,4,5,6}',
  start_time               time not null default '00:00',
  end_time                 time not null default '23:59',
  price_per_30min_pence    integer not null,
  is_default               boolean not null default false,
  priority                 integer not null default 0,   -- higher wins ties
  updated_at               timestamptz not null default now(),
  check (start_time < end_time),
  check (price_per_30min_pence >= 0)
);
create index if not exists bookable_price_windows_product_idx
  on public.bookable_price_windows (product_id);

alter table public.bookable_price_windows enable row level security;
drop policy if exists "bookable_price_windows select public" on public.bookable_price_windows;
create policy "bookable_price_windows select public" on public.bookable_price_windows
  for select to anon using (true);
drop policy if exists "bookable_price_windows full auth" on public.bookable_price_windows;
create policy "bookable_price_windows full auth" on public.bookable_price_windows
  for all to authenticated using (true) with check (true);

drop trigger if exists bookable_price_windows_touch_updated_at on public.bookable_price_windows;
create trigger bookable_price_windows_touch_updated_at
  before update on public.bookable_price_windows
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------
-- Seed the two products we're rolling out first.
-- Mirrors the hard-coded rules so flipping the switch in code
-- to read from DB is a no-op for the customer.
-- ---------------------------------------------------------------

insert into public.bookable_products
  (id, name, enabled, closed_message, slot_duration_minutes,
   min_duration_minutes, max_duration_minutes, duration_step_minutes,
   min_party_size, max_party_size, default_resource_count,
   customer_eyebrow, customer_title, customer_intro)
values
  ('pool',  'Pool tables',  true,
    'Pool table bookings are temporarily paused — check back soon or DM us on Instagram.',
    30, 30, 60, 30, 1, 8, 1,
    'Pool · 30-min slots',
    'Reserve a Pool Table',
    'American 7ft tables. Pick 30 or 60 minutes, pay to confirm.'),
  ('table', 'Bar tables',   true,
    'Bar table reservations are temporarily paused — please walk in or DM us on Instagram.',
    60, 60, 180, 30, 1, 12, 1,
    'Bar tables · Hackney',
    'Reserve a Table',
    'Pick a time, tell us about your group. We''ll save a table.')
on conflict (id) do update set
  name = excluded.name,
  closed_message = coalesce(public.bookable_products.closed_message, excluded.closed_message);

-- Pool hours: Sun/Mon/Tue/Thu = all day, Wed/Fri end at 18:30
-- (tournament cutoff), Sat closed entirely (no row).
-- Hours below assume venue opens 16:00 (matches OPEN_HOUR in code).
-- 18:30 cutoff means the last bookable slot is 18:00 (30-min).
insert into public.bookable_hours (product_id, day_of_week, open_time, close_time)
values
  ('pool', 0, '16:00', '23:30'),  -- Sun
  ('pool', 1, '16:00', '23:30'),  -- Mon
  ('pool', 2, '16:00', '23:30'),  -- Tue
  ('pool', 3, '16:00', '18:30'),  -- Wed — tournament cutoff
  ('pool', 4, '16:00', '23:30'),  -- Thu
  ('pool', 5, '16:00', '18:30')   -- Fri — tournament cutoff
on conflict do nothing;

-- Table-bookings hours: open every day 16:00–23:30 by default.
insert into public.bookable_hours (product_id, day_of_week, open_time, close_time)
values
  ('table', 0, '16:00', '23:30'),
  ('table', 1, '16:00', '23:30'),
  ('table', 2, '16:00', '23:30'),
  ('table', 3, '16:00', '23:30'),
  ('table', 4, '16:00', '23:30'),
  ('table', 5, '16:00', '23:30'),
  ('table', 6, '16:00', '23:30')
on conflict do nothing;

-- Pool price windows: default £6/30min, Monday half-price £3/30min.
insert into public.bookable_price_windows
  (product_id, name, days_of_week, start_time, end_time,
   price_per_30min_pence, is_default, priority)
values
  ('pool', 'Standard',       '{0,1,2,3,4,5,6}', '00:00', '23:59',  600, true,  0),
  ('pool', 'Monday ½ price', '{1}',             '00:00', '23:59',  300, false, 10)
on conflict do nothing;

-- Table bookings: free by default (no charge), so a single £0 row.
insert into public.bookable_price_windows
  (product_id, name, days_of_week, start_time, end_time,
   price_per_30min_pence, is_default, priority)
values
  ('table', 'Free', '{0,1,2,3,4,5,6}', '00:00', '23:59', 0, true, 0)
on conflict do nothing;
