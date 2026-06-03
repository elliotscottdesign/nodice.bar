-- =============================================================
-- Plonk Golf — fix CMS / page key mismatches
-- =============================================================
-- 004-page-content.sql registered combined `body` HTML fields for
-- venue and snackbar pages, but the public pages actually read
-- separate keys (`body_heading`, `body_intro`, `tagline`, …).
-- Editing the combined fields in the admin had no effect on the
-- live site.
--
-- This migration:
--   1. Registers the keys the public pages actually read.
--   2. Seeds them with the current live default values.
--   3. Deletes the orphan `body` rows that nothing reads, so the
--      CMS stops showing fields that do nothing.
-- Idempotent — safe to re-run.
-- =============================================================

-- ---------- 1. Register missing keys ----------
insert into public.page_content (key, page, field_kind, label, helper, sort_order, value)
values
  -- Venue: Hackney
  ('venue.hackney.body_heading', 'venue.hackney', 'text',     'Body — heading',
   'Headline of the "We''ve glown up" section.', 6, 'A Polynesian putting paradise'),
  ('venue.hackney.body_intro',   'venue.hackney', 'textarea', 'Body — intro paragraph',
   'Paragraph beneath the body heading.', 7,
   'Our Hackney course has been rebuilt — bigger, brighter and bolder than ever. Volcano canyons, a tiki forest, golf gods to appease, a stone circle to navigate and octopuses to dodge under the sea — all now fully covered and out of the rain.'),

  -- Venue: Borough Market
  ('venue.borough.body_heading', 'venue.borough', 'text',     'Body — heading',
   'Headline of the body section.', 6, 'London under the arches'),
  ('venue.borough.body_intro',   'venue.borough', 'textarea', 'Body — intro paragraph',
   'Paragraph beneath the body heading.', 7,
   'Nine holes navigating Big Ben, the Tower of London, the Thames Barrier and a London phone box, painted by the city''s best graffiti artists. Plus a full bar, arcade and snug pool tables.'),

  -- Snack Bar
  ('snackbar.eyebrow', 'info.snackbar', 'text',     'Eyebrow',
   'Small uppercase line above the title.', 3, 'Plonk Hackney · Eat'),
  ('snackbar.tagline', 'info.snackbar', 'textarea', 'Tagline',
   'Subtitle paragraph beneath the page title.', 4,
   'BBQ meat & burgers, supplied by Smokoloko of Spitalfields.'),

  -- Home — feature cards (Bar / Pool / Board games / Arcade)
  ('home.feature1.title', 'home', 'text',     'Feature 1 — title',
   'First feature card title (Bar).', 8, 'Bar'),
  ('home.feature1.body',  'home', 'textarea', 'Feature 1 — body',
   'First feature card paragraph.', 9,
   'Draught beers, craft cans, speciality ciders, house and classic cocktails, natural wines and a wide range of soft drinks.'),

  ('home.feature2.title', 'home', 'text',     'Feature 2 — title',
   'Second feature card title (Pool).', 10, 'Pool'),
  ('home.feature2.body',  'home', 'textarea', 'Feature 2 — body',
   'Second feature card paragraph.', 11,
   'American 7ft pool tables in Hackney, brand-new British 7ft tables in Borough. £5 for 30 minutes. Over-16s only.'),

  ('home.feature3.title', 'home', 'text',     'Feature 3 — title',
   'Third feature card title (Board games).', 12, 'Board games'),
  ('home.feature3.body',  'home', 'textarea', 'Feature 3 — body',
   'Third feature card paragraph.', 13,
   'A wall of board games at Hackney. Borrow whatever you fancy from the bar and settle the score between rounds.'),

  ('home.feature4.title', 'home', 'text',     'Feature 4 — title',
   'Fourth feature card title (Arcade).', 14, 'Arcade'),
  ('home.feature4.body',  'home', 'textarea', 'Feature 4 — body',
   'Fourth feature card paragraph.', 15,
   'Pinball machines, retro multi-game cabinets, shoot-''em-ups, foosball and skee-ball. Buy tokens at the bar.')

on conflict (key) do update
  set page       = excluded.page,
      field_kind = excluded.field_kind,
      label      = excluded.label,
      helper     = excluded.helper,
      sort_order = excluded.sort_order;
-- Note: we don't overwrite `value` on conflict, so any edits saved
-- through the CMS survive a re-run.

-- ---------- 2. Remove orphan rows nothing reads ----------
delete from public.page_content
 where key in (
   'venue.hackney.body',
   'venue.borough.body',
   'snackbar.body'
 );
