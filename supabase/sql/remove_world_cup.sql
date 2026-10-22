-- =============================================================
-- Remove World Cup from the live database (founder: "no more world cup")
-- =============================================================
-- Run via the Management API SQL endpoint with a fresh Personal Access Token
-- (see memory reference_supabase_deploy):
--
--   curl -s -X POST \
--     "https://api.supabase.com/v1/projects/rntcujcpsozvuxvmlejv/database/query" \
--     -H "Authorization: Bearer sbp_…" -H "Content-Type: application/json" \
--     -d "$(python3 -c "import json;print(json.dumps({'query':open('supabase/sql/remove_world_cup.sql').read()}))")"
--
-- APPLIED 2026-10-22 against the live project (rntcujcpsozvuxvmlejv). Kept for
-- the record + re-bootstrap. Idempotent. The `events`, `ticket_types` and
-- `event_entries` TABLES are kept — only World Cup DATA + the category value go.
--
-- NOTE on event_entries: it turned out NOT to be World-Cup-only — it holds 2
-- ancient UNPAID pool-tournament test rows ("Cutie"/"x", Jun 2026) and 0 World
-- Cup rows. Those 2 are NOT World Cup, so they were deliberately LEFT in place
-- (deleting them is out of scope for "remove World Cup"). This script therefore
-- does NOT touch event_entries.
-- =============================================================

-- 1. Review first (does not change anything).
select 'world_cup events' as what, count(*) from public.events where category = 'world_cup'
union all
select 'worldcup.* CMS rows', count(*) from public.page_content where key like 'worldcup.%';

-- 2. Delete any World Cup events (cascades to ticket_types + event_entries via
--    the events FK). 0 today, so a no-op.
delete from public.events where category = 'world_cup';

-- 3. Delete the dormant World Cup CMS copy (hero, eyebrow, title, schedule…).
delete from public.page_content where key like 'worldcup.%';

-- 5. Drop 'world_cup' from the events category CHECK constraint so it can't be
--    re-added. Rebuild the constraint without it.
alter table public.events drop constraint if exists events_category_check;
alter table public.events add constraint events_category_check
  check (category in (
    'pool_tournament_doubles','pool_tournament_singles','pool_special','ping_pong',
    'dj_night','food_event','drink_special','special_event','bingo','arcade','golf','other'
  ));

-- 6. Confirm it's gone.
select 'remaining world_cup events' as what, count(*) from public.events where category = 'world_cup'
union all
select 'remaining worldcup CMS', count(*) from public.page_content where key like 'worldcup.%';
