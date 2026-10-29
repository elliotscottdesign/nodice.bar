-- =============================================================
-- Macmillan 12-Hour Singles Comp — create the three skill-tier sessions
-- =============================================================
-- Run via the Management API SQL endpoint (see memory reference_supabase_deploy)
-- with a fresh Supabase Personal Access Token:
--
--   curl -s -X POST \
--     "https://api.supabase.com/v1/projects/rntcujcpsozvuxvmlejv/database/query" \
--     -H "Authorization: Bearer sbp_…" -H "Content-Type: application/json" \
--     -d "$(python3 -c "import json;print(json.dumps({'query':open('supabase/sql/macmillan_tiers_insert.sql').read()}))")"
--
-- WHAT THIS DOES (see lib/db/macmillan.ts for the full rationale):
--   The public "display" event already exists — the pool_special marathon card
--   customers see on /pool and /events (id resolved by name below). This script
--   adds the THREE bookable skill-tier sessions and repoints the display card to
--   the new /macmillan page.
--
--   Each tier is its OWN events row:
--     • category 'pool_special'            → the shared tournament-checkout Edge
--                                             Function already accepts it (no new
--                                             function, no webhook change).
--     • recurrence_parent_id = display id  → marks it a child of the marathon.
--     • show_on_pool_schedule=false,
--       show_on_events_calendar=false      → never shows as a card of its own
--                                             on /pool or the /events calendar;
--                                             only reachable via the /macmillan
--                                             tier selector (loadEventTiers).
--     • show_on_bar_page=true              → the anon RLS read policy on events
--                                             requires at least one show_* flag;
--                                             show_on_bar_page is the one with NO
--                                             public listing today, so it makes the
--                                             tiers readable by the public page
--                                             WITHOUT surfacing them anywhere.
--     • max_attendees = 20                 → the 20-slot-per-session cap,
--                                             enforced server-side by the checkout.
--     • one active ticket_type at £10 (price_pence=1000).
--     • a MATCHING public.tournaments row (SAME id, tournament_type 'special').
--       REQUIRED: tournament_entries.tournament_id is a FK to tournaments(id), so
--       without it every paid booking 500s on the final insert. The mirror also
--       makes the bookings show in the /admin special-events tracker (grouped
--       under Special events, deduped against the event by matching name+date)
--       with their live paid count.
--
--   Finally it repoints the display event's external_link to '/macmillan' so the
--   existing /pool + /events cards click through to the ticketing page instead of
--   out to the Macmillan fundraising site.
--
-- Idempotent: each tier is guarded by NOT EXISTS on (recurrence_parent_id, name),
-- the ticket + tournaments inserts run only for freshly-created tiers, and the
-- external_link update is a plain overwrite. Re-running is a safe no-op.
-- =============================================================

with parent as (
  select id, event_date
  from public.events
  where category = 'pool_special'
    and recurrence_parent_id is null
    and name ilike '%macmill%'
    and event_date = date '2026-11-15'
  limit 1
),
tier_defs(label, starts, ends) as (
  values
    ('Macmillan 12HR — Beginner',     time '12:00:00', time '16:00:00'),
    ('Macmillan 12HR — Intermediate', time '16:00:00', time '20:00:00'),
    ('Macmillan 12HR — Advanced',     time '20:00:00', time '00:00:00')
),
ins_events as (
  insert into public.events (
    name, description,
    category, subcategory,
    event_date, start_time, end_time,
    recurrence_type, recurrence_parent_id,
    show_on_pool_schedule, show_on_events_calendar, show_on_bar_page,
    requires_ticket, bookable, max_attendees, registration_open
  )
  select
    d.label,
    'Macmillan 12-hour singles pool comp — the ' ||
      split_part(d.label, '— ', 2) ||
      ' session. £10 entry, 20 players, all proceeds to the Macmillan fundraiser.',
    'pool_special', 'Special Event',
    p.event_date, d.starts, d.ends,
    'none', p.id,
    false, false, true,
    true, true, 20, true
  from parent p
  cross join tier_defs d
  where not exists (
    select 1 from public.events e
    where e.recurrence_parent_id = p.id and e.name = d.label
  )
  returning id, name, start_time, event_date
),
ins_tickets as (
  insert into public.ticket_types (
    event_id, name, description, price_pence, sort_order, active
  )
  select
    id, 'Entry — £10 to Macmillan',
    '12-hour singles comp entry. 100% of your £10 goes to the Macmillan fundraiser.',
    1000, 0, true
  from ins_events
  returning event_id
),
ins_tournaments as (
  insert into public.tournaments (
    id, name, description, event_date, start_time,
    max_teams, entry_fee_pence, registration_open, bookable, tournament_type
  )
  select
    id, name,
    'FK mirror for the Macmillan tier events row — exists only so ticket bookings (tournament_entries.tournament_id FK) save and show in the admin tracker. Not shown on /pool.',
    event_date, start_time,
    20, 1000, true, true, 'special'
  from ins_events
  on conflict (id) do nothing
  returning id
)
update public.events
set external_link = '/macmillan', updated_at = now()
where category = 'pool_special'
  and recurrence_parent_id is null
  and name ilike '%macmill%'
  and event_date = date '2026-11-15';

-- Show the result (display event + its three tier sessions + ticket) for a
-- quick confirmation after running.
select
  e.id, e.name, e.event_date, e.start_time, e.end_time,
  e.category, e.recurrence_parent_id,
  e.show_on_pool_schedule, e.show_on_events_calendar,
  e.max_attendees, e.registration_open, e.bookable,
  e.external_link,
  t.price_pence
from public.events e
left join public.ticket_types t on t.event_id = e.id and t.active = true
where (e.name ilike '%macmill%')
  and e.event_date = date '2026-11-15'
order by e.recurrence_parent_id nulls first, e.start_time;
