-- =============================================================
-- calendar_events — optional start_time column
-- =============================================================
-- Founder direction: per-event time slot. Optional (some events
-- are all-day pop-ups with no fixed start). When set, the public
-- calendar displays it under the title; when null, no time shown.
-- =============================================================

alter table public.calendar_events
  add column if not exists start_time time;
