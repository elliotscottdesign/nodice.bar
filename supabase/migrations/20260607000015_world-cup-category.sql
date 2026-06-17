-- =============================================================
-- Add 'world_cup' to events.category — match-night schedule
-- =============================================================
-- Each World Cup match is one row in the events table tagged
-- category='world_cup'. The public /worldcup page reads from
-- this filter and renders a roller-deck schedule (mirroring the
-- pool tournament schedule). Each card links to /book/table with
-- the match date prefilled so customers reserve a bar table for
-- the kickoff.
--
-- Implementation note: the events.category column is a TEXT with
-- a CHECK constraint — Postgres has no ALTER TYPE for adding a
-- value the way it does for ENUMs, so we drop and recreate the
-- constraint. Existing rows are untouched (none have category=
-- 'world_cup' yet).
-- =============================================================

alter table public.events
  drop constraint if exists events_category_check;

alter table public.events
  add constraint events_category_check
  check (category in (
    'pool_tournament_doubles',
    'pool_tournament_singles',
    'pool_special',
    'dj_night',
    'food_event',
    'drink_special',
    'arcade',
    'golf',
    'world_cup',
    'other'
  ));
