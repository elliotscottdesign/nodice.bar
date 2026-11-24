-- ─────────────────────────────────────────────────────────────────────────
-- PUBLIC "DJ" → "LISTENING SESSION" RENAME — the CMS half.
--
-- Six customer-visible strings live in the `page_content` table (edited via
-- the inline CMS), so a code change alone does NOT touch them. These are the
-- most prominent ones: the homepage hero word-list, the nav, the /events page
-- title + intro, the venue intro, and the homepage venues blurb.
--
-- The code half of this rename lives in lib/publicLabels.ts (one constant).
--
-- Run in the Supabase SQL editor (runs as postgres, bypasses RLS):
--   https://supabase.com/dashboard/project/rntcujcpsozvuxvmlejv/sql/new
-- Paste the FORWARD block, press RUN. To put "DJ" back one day, paste the
-- REVERT block instead.
-- ─────────────────────────────────────────────────────────────────────────


-- ============ FORWARD  (DJ → Listening Session) — run to HIDE "DJ" ============
-- (Currently NOT applied: the site is on "DJ" as of the Nov 2026 revert.)

update page_content set value = 'Listening Sessions & Events'            where key = 'events.title';
update page_content set value = replace(value, 'DJ parties', 'Listening Sessions')  where key = 'events.intro';
update page_content set value = replace(value, 'DJS', 'SESSIONS')         where key = 'home.hero.subcopy';
update page_content set value = replace(value, 'DJs,', 'Listening Sessions,')        where key = 'venue.hackney.events.intro';
update page_content set value = replace(value, 'DJs & Events', 'Sessions & Events')  where key = 'header.nav';
update page_content set value = replace(value, 'DJs, games', 'Listening Sessions, games') where key = 'home.venues.hackney';

-- Check:
-- select key, value from page_content where key in
--  ('events.title','events.intro','home.hero.subcopy','venue.hackney.events.intro','header.nav','home.venues.hackney');


-- ============ REVERT  (Listening Session → DJ) — APPLIED Nov 2026 =========
-- (This is the live state. Re-run if the CMS drifts. Pairs with the "DJ"
--  values in lib/publicLabels.ts. events.title restored as 'DJs & Events'.)

-- update page_content set value = 'DJS & Events'                          where key = 'events.title';
-- update page_content set value = replace(value, 'Listening Sessions', 'DJ parties')  where key = 'events.intro';
-- update page_content set value = replace(value, 'SESSIONS', 'DJS')       where key = 'home.hero.subcopy';
-- update page_content set value = replace(value, 'Listening Sessions,', 'DJs,')       where key = 'venue.hackney.events.intro';
-- update page_content set value = replace(value, 'Sessions & Events', 'DJs & Events') where key = 'header.nav';
-- update page_content set value = replace(value, 'Listening Sessions, games', 'DJs, games') where key = 'home.venues.hackney';
