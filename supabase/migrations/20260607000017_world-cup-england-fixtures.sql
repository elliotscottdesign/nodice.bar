-- =============================================================
-- England's World Cup 2026 fixtures — seed from the strategy plan
-- =============================================================
-- Pulls the date/time list from our earlier World Cup planning
-- (Plonk-Borough-2.0/src/worldcup/data.js) and creates one event
-- per England match, each with a £15-for-2-people ticket type.
--
-- Group L draw: England · Croatia · Ghana · Panama.
-- Knockout dates are PROJECTED — they assume England top the
-- group; the founder will edit/remove them in /admin/events as
-- the bracket fills in.
--
-- Poster: copied from whichever existing world_cup event already
-- has one (e.g. Germany v Brazil) so the rail looks consistent.
-- If nothing's set yet, poster_url stays NULL — set via admin.
--
-- Capacity: 10 (matches the strategy — 10 tables of 2 = 10
-- ticket-of-two purchases).
--
-- Editable: yes. These are normal events rows — same /admin/events
-- form edits them as if the founder added them by hand.
-- =============================================================

-- Use a CTE to insert all events first, then insert ticket_types
-- in a single follow-on statement keyed by the events we just made.
with inserted as (
  insert into public.events (
    name, category, event_date, start_time, end_time,
    bookable, registration_open, requires_ticket, max_attendees,
    show_on_pool_schedule, show_on_events_calendar, show_on_bar_page,
    recurrence_type, description, poster_url
  )
  select * from (values
    -- ----- Group stage (confirmed dates from the FIFA schedule) -----
    ('England vs Croatia'::text,
     'world_cup'::text,
     '2026-06-17'::date, '21:00'::time, '23:30'::time,
     true, true, true, 10,
     false, true, false,
     'none'::text,
     'Group L · England''s tournament opener. AT&T Stadium, Arlington (Dallas). 21:00 BST kickoff. 2018 semi-final rematch.'::text,
     (select poster_url from public.events
        where category = 'world_cup' and poster_url is not null
        order by created_at desc limit 1)),

    ('England vs Ghana',
     'world_cup',
     '2026-06-23', '21:00', '23:30',
     true, true, true, 10,
     false, true, false,
     'none',
     'Group L · second group game. Gillette Stadium, Boston. 21:00 BST kickoff — qualification within reach.',
     (select poster_url from public.events
        where category = 'world_cup' and poster_url is not null
        order by created_at desc limit 1)),

    ('England vs Panama',
     'world_cup',
     '2026-06-27', '22:00', '00:30',
     true, true, true, 10,
     false, true, false,
     'none',
     'Group L · final group game. MetLife Stadium, New Jersey. 22:00 BST kickoff — Saturday-night sell-out.',
     (select poster_url from public.events
        where category = 'world_cup' and poster_url is not null
        order by created_at desc limit 1)),

    -- ----- Knockouts (projected — adjust as bracket fills in) -----
    ('England — Round of 32',
     'world_cup',
     '2026-07-01', '17:00', '19:30',
     true, true, true, 10,
     false, true, false,
     'none',
     'If England top Group L: R32 at Mercedes-Benz Stadium, Atlanta. 17:00 BST. Opponent = 3rd-placed qualifier from Group E/H/I/J/K.',
     (select poster_url from public.events
        where category = 'world_cup' and poster_url is not null
        order by created_at desc limit 1)),

    ('England — Round of 16',
     'world_cup',
     '2026-07-05', '01:00', '03:30',
     true, true, true, 10,
     false, true, false,
     'none',
     'If England progress: R16 at Estadio Azteca, Mexico City. 01:00 BST kickoff — overnight Sat 4 → Sun 5 July. Graveyard slot, late one.',
     (select poster_url from public.events
        where category = 'world_cup' and poster_url is not null
        order by created_at desc limit 1)),

    ('England — Quarter-Final (possibly v Brazil)',
     'world_cup',
     '2026-07-11', '22:00', '00:30',
     true, true, true, 10,
     false, true, false,
     'none',
     'Match 99 at Hard Rock Stadium, Miami. 22:00 BST. If England win Group L and Brazil win Group C, the blockbuster of the tournament.',
     (select poster_url from public.events
        where category = 'world_cup' and poster_url is not null
        order by created_at desc limit 1)),

    ('England — Semi-Final',
     'world_cup',
     '2026-07-15', '22:00', '00:30',
     true, true, true, 10,
     false, true, false,
     'none',
     'If England win their quarter-final: SF2 at Mercedes-Benz Stadium, Atlanta. The night of the tournament — late BST kickoff.',
     (select poster_url from public.events
        where category = 'world_cup' and poster_url is not null
        order by created_at desc limit 1)),

    ('England — World Cup Final',
     'world_cup',
     '2026-07-19', '21:00', '23:30',
     true, true, true, 10,
     false, true, false,
     'none',
     'If England make it: the Final at MetLife Stadium, New Jersey. The biggest night of the year.',
     (select poster_url from public.events
        where category = 'world_cup' and poster_url is not null
        order by created_at desc limit 1))
  ) as v(name, category, event_date, start_time, end_time,
         bookable, registration_open, requires_ticket, max_attendees,
         show_on_pool_schedule, show_on_events_calendar, show_on_bar_page,
         recurrence_type, description, poster_url)
  -- Guard against re-running: skip rows whose name+date already exist.
  where not exists (
    select 1 from public.events e
    where e.name = v.name and e.event_date = v.event_date
  )
  returning id, name
)
insert into public.ticket_types
  (event_id, name, description, price_pence, capacity, sort_order, active)
select
  id,
  'Table for 2',
  'Reserves a table for two for the match — pay £15 to secure your spot.',
  1500,
  10,
  0,
  true
from inserted;
