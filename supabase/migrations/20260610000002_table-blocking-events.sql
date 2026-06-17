-- =============================================================
-- Add `blocks_table_bookings` flag to events
-- =============================================================
-- Background: when a World Cup match or a food residency
-- (Banjak's Burgers etc) is on, the dining tables are committed
-- to that event — paid match tickets for the WC, and the kitchen
-- pop-up's diners on food nights. Customers must NOT be able to
-- create a free /book/table reservation on those days, or we
-- double-book the room.
--
-- This migration adds a per-event flag so the booking calendar
-- can grey out the corresponding dates. Backfill defaults the
-- flag to TRUE for existing world_cup and food_event rows; new
-- events get FALSE by default and the admin form pre-ticks the
-- box for those categories.
-- =============================================================

alter table public.events
  add column if not exists blocks_table_bookings boolean not null default false;

comment on column public.events.blocks_table_bookings is
  'True = this event closes /book/table reservations for its event_date. The /book/table calendar greys out the day and shows a message linking to the right booking flow (/worldcup, /events). Defaults to false; admin form pre-ticks for world_cup + food_event categories. Toggle per event in /admin/events.';

-- Backfill: every existing world_cup + food_event row gets the
-- block flag flipped on, so the booking calendar starts working
-- correctly the moment this migration lands. Idempotent.
update public.events
   set blocks_table_bookings = true
 where category in ('world_cup', 'food_event')
   and blocks_table_bookings = false;

-- Partial index on the common query: "blocked dates in a date
-- range". Small (only blocked rows) but speeds up the calendar's
-- load.
create index if not exists events_blocks_table_bookings_date_idx
  on public.events (event_date)
  where blocks_table_bookings = true;
