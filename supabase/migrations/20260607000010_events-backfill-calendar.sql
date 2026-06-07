-- =============================================================
-- Events platform Phase 3 backfill — calendar_events → events
-- =============================================================
-- The previous backfill (migration 20260607000009) moved every
-- `tournaments` row into the new `events` table. This one does
-- the same for `calendar_events` — the founder-managed posters on
-- /events (DJ nights, social meets, etc.). They land as
-- category='dj_night' for now; the founder can re-categorise from
-- /admin/events later. None of them require tickets, so no
-- ticket_types rows are created.
--
-- Idempotent — reuses the original row id as the new event id.
-- Old `calendar_events` rows are NOT deleted so the existing inline
-- calendar editor keeps working until Phase 3 retires it.
-- =============================================================

insert into public.events (
  id, name, description, poster_url, external_link,
  event_date, start_time,
  category,
  show_on_pool_schedule, show_on_events_calendar,
  requires_ticket, bookable,
  registration_open
)
select
  c.id,
  c.title,
  c.body,
  nullif(c.image_url, ''),
  c.link_url,
  c.event_date,
  c.start_time,
  -- Default category for free-form calendar events. The founder
  -- can re-categorise from /admin/events.
  'dj_night' as category,
  false as show_on_pool_schedule,
  true as show_on_events_calendar,
  false as requires_ticket,
  true as bookable,
  c.active as registration_open
from public.calendar_events c
on conflict (id) do nothing;
