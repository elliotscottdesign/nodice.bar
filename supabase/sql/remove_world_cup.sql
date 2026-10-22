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
-- SAFE: at the time of writing there are 0 events of category 'world_cup' and
-- 0 PAID event_entries. This script is idempotent. The `events`, `ticket_types`
-- and `event_entries` TABLES are kept (event_entries is framed as the generic
-- ticketed-events table) — only World Cup DATA + the category value go.
-- =============================================================

-- 1. Review first (does not change anything) — what match data still exists.
select 'world_cup events' as what, count(*) from public.events where category = 'world_cup'
union all
select 'event_entries total', count(*) from public.event_entries
union all
select 'event_entries paid', count(*) from public.event_entries where status = 'paid'
union all
select 'worldcup.* CMS rows', count(*) from public.page_content where key like 'worldcup.%';

-- 2. Delete any World Cup events (cascades to their ticket_types + event_entries
--    via the events FK). 0 today, so usually a no-op.
delete from public.events where category = 'world_cup';

-- 3. Delete any remaining event_entries (this table only ever held World Cup
--    match tickets — written solely by the now-deleted match-checkout fn — and
--    none are paid). Comment this out if you'd rather keep the stray rows.
delete from public.event_entries;

-- 4. Delete the dormant World Cup CMS copy (hero, eyebrow, title, schedule…).
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
