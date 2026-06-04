-- =============================================================
-- Migration 002 — dedupe seed data + add unique constraints
-- =============================================================
-- The seed.sql got run multiple times during setup. Each insert
-- generates a fresh UUID, so `on conflict do nothing` didn't kick
-- in and we ended up with triplicate rows in tickets/addons/closed_dates.
--
-- This migration:
--   1. Deletes duplicate rows (keeps the earliest of each set)
--   2. Adds unique constraints so future re-runs of seed.sql are safe
-- =============================================================

-- ----- 1. Dedupe tickets (keep earliest per venue+name) -----
with ranked as (
  select id,
         row_number() over (partition by venue_id, name order by created_at) as rn
  from public.tickets
)
delete from public.tickets
where id in (select id from ranked where rn > 1);

-- ----- 2. Dedupe addons (keep earliest per name+venue) -----
with ranked as (
  select id,
         row_number() over (
           partition by coalesce(venue_id::text, ''), name
           order by created_at
         ) as rn
  from public.addons
)
delete from public.addons
where id in (select id from ranked where rn > 1);

-- ----- 3. Dedupe closed_dates (keep earliest per venue+date) -----
with ranked as (
  select id,
         row_number() over (
           partition by coalesce(venue_id::text, ''), date
           order by created_at
         ) as rn
  from public.closed_dates
)
delete from public.closed_dates
where id in (select id from ranked where rn > 1);

-- ----- 4. Add unique constraints so re-running seed.sql is safe -----
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tickets_venue_id_name_key'
  ) then
    alter table public.tickets
      add constraint tickets_venue_id_name_key unique (venue_id, name);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'addons_venue_id_name_key'
  ) then
    alter table public.addons
      add constraint addons_venue_id_name_key unique (venue_id, name);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'closed_dates_venue_id_date_key'
  ) then
    alter table public.closed_dates
      add constraint closed_dates_venue_id_date_key unique (venue_id, date);
  end if;
end$$;
