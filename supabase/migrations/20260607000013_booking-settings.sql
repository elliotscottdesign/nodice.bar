-- =============================================================
-- Booking settings — per-product on/off switch (pool, golf, etc.)
-- =============================================================
-- Single-row config per booking "product" so the founder can take
-- pool bookings offline (e.g. while the floor's reconfigured for
-- a private event) without us pushing code.
--
-- Future: prices, day-of-week rules, etc. can move into this table.
-- For now the day/time/price rules stay in code; only the on/off
-- toggle is data-driven.
-- =============================================================

create table if not exists public.booking_settings (
  id text primary key,             -- 'pool', 'golf', 'table', etc.
  enabled boolean not null default true,
  closed_message text,             -- shown to customer when disabled
  updated_at timestamptz not null default now()
);

-- Seed defaults so the admin page has something to edit immediately.
insert into public.booking_settings (id, enabled, closed_message)
values
  ('pool', true,
   'Pool table bookings are temporarily paused — check back soon or DM us on Instagram.'),
  ('table', true,
   'Table reservations are temporarily paused — please walk in or DM us on Instagram.'),
  ('tournament', true,
   'Tournament sign-ups are temporarily paused — check back soon.')
on conflict (id) do nothing;

-- Public can read settings (so the customer-facing form can show
-- the right state). Only authenticated admins can update.
alter table public.booking_settings enable row level security;

drop policy if exists "booking_settings select public" on public.booking_settings;
create policy "booking_settings select public" on public.booking_settings
  for select to anon using (true);

drop policy if exists "booking_settings full access for auth" on public.booking_settings;
create policy "booking_settings full access for auth" on public.booking_settings
  for all to authenticated using (true) with check (true);

drop trigger if exists booking_settings_touch_updated_at on public.booking_settings;
create trigger booking_settings_touch_updated_at
  before update on public.booking_settings
  for each row execute function public.touch_updated_at();
