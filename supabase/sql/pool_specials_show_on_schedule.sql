-- Show the special pool events (Ball Breakers, Pocket Society, etc.) on the
-- public /pool EVENTS scroller (founder, 20 Oct 2026).
--
-- These events had show_on_pool_schedule = false, so loadOpenTournaments()
-- filtered them out. This flips every UPCOMING, still-open special on so it
-- joins the one unified EVENTS rail alongside the Wednesday doubles nights.
-- Past events are left alone (the schedule only shows event_date >= today).

update public.events
set show_on_pool_schedule = true
where category = 'pool_special'
  and registration_open = true
  and event_date >= current_date
  and show_on_pool_schedule = false;

-- Check what is now visible on the pool schedule:
select name, event_date, show_on_pool_schedule
from public.events
where category = 'pool_special'
  and event_date >= current_date
order by event_date;
