-- =============================================================
-- Bingo Night — create the first event + its £10 ticket
-- =============================================================
-- Run this AFTER tonight's live ping-pong event (founder freeze), with a
-- fresh Supabase Personal Access Token, via the Management API SQL endpoint
-- (see memory reference_supabase_deploy):
--
--   curl -s -X POST \
--     "https://api.supabase.com/v1/projects/rntcujcpsozvuxvmlejv/database/query" \
--     -H "Authorization: Bearer sbp_…" -H "Content-Type: application/json" \
--     -d "$(python3 -c "import json;print(json.dumps({'query':open('supabase/sql/bingo_event_insert.sql').read()}))")"
--
-- WHY THIS SHAPE (see lib/db/bingo.ts for the full rationale):
--   • category='pool_tournament_singles'  → makes the EXISTING tournament-
--     checkout function + InlineTournamentBooking work with NO code change,
--     and renders the right form (one person: name + email + phone +
--     marketing opt-in — a single £10 ticket).
--   • show_on_pool_schedule=false         → keeps it OFF /pool; this flag is
--     also how the /bingo page tells a bingo night from a pool-singles one.
--   • show_on_events_calendar=true + subcategory='Special Event'
--                                         → also lists it under Special
--                                           Events on the /events calendar.
--   • one active ticket_type at £10 (price_pence=1000).
--   • a MATCHING public.tournaments row with the SAME id. This is REQUIRED:
--     tournament_entries.tournament_id has a FOREIGN KEY to tournaments(id),
--     so without this row every paid booking 500s at the final insert
--     ("violates foreign key constraint tournament_entries_tournament_id_fkey")
--     — the Stripe step appears broken. The tournaments row is never read for
--     display (/pool reads EVENTS where show_on_pool_schedule=true); it exists
--     purely to satisfy that FK, mirroring how real pool tournaments carry both
--     an events row and a tournaments row. (Discovered 18 Oct 2026 when the
--     first bingo night's tickets wouldn't take payment.)
--
-- Idempotent: guarded by NOT EXISTS on (name, event_date), so a re-run is a
-- no-op. The ticket + tournaments rows are inserted only when the event was
-- freshly created (both guarded further by ON CONFLICT (id) DO NOTHING).
-- =============================================================

with new_event as (
  insert into public.events (
    name, description,
    category, subcategory,
    event_date, start_time, end_time,
    recurrence_type,
    show_on_pool_schedule, show_on_events_calendar, show_on_bar_page,
    requires_ticket, bookable, max_attendees, registration_open
  )
  select
    'Bingo Night',
    'Comedy & Bingo at No Dice, London Fields. A £10 ticket gets you in and gets you a drink; the bingo is free to play with bar-sponsored prizes. Two comics, a round of bingo, a break — twice — then the headline set.',
    'pool_tournament_singles', 'Special Event',
    date '2026-11-25', time '19:00:00', time '22:30:00',
    'none',
    false, true, false,
    true, true, 60, true
  where not exists (
    select 1 from public.events
    where name = 'Bingo Night' and event_date = date '2026-11-25'
  )
  returning id
),
-- REQUIRED FK mirror — see header. Same id as the event so the booking's
-- tournament_entries insert (tournament_id = event id) passes the FK.
new_tournament as (
  insert into public.tournaments (
    id, name, description, event_date, start_time,
    max_teams, entry_fee_pence, registration_open, bookable, tournament_type
  )
  select
    id, 'Bingo Night',
    'FK mirror for the Bingo Night events row — exists only so ticket bookings (tournament_entries.tournament_id FK) can save. Not shown on /pool.',
    date '2026-11-25', time '19:00:00',
    60, 1000, true, true, 'singles'
  from new_event
  on conflict (id) do nothing
  returning id
)
insert into public.ticket_types (
  event_id, name, description, price_pence, sort_order, active
)
select id, 'Ticket (entry + a drink)',
       'Comedy & bingo night entry plus a drink on arrival. Bingo is free to play.',
       1000, 0, true
from new_event;

-- Show the result (event + ticket) for confirmation.
select e.id, e.name, e.event_date, e.start_time, e.category,
       e.show_on_pool_schedule, e.show_on_events_calendar, e.subcategory,
       e.max_attendees, e.registration_open, e.bookable,
       t.name as ticket, t.price_pence
from public.events e
left join public.ticket_types t on t.event_id = e.id
where e.name = 'Bingo Night' and e.event_date = date '2026-11-25';
