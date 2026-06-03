-- =============================================================
-- Plonk Golf — Hackney venue page: every section editable
-- =============================================================
-- Registers the rest of the Hackney public page in page_content
-- (intro side photo, "More than golf" cards, events strip,
-- Find us address + getting-here). Seeded with the current live
-- values. Idempotent — re-runnable without losing edits.
-- =============================================================

insert into public.page_content (key, page, field_kind, label, helper, sort_order, value)
values
  -- Polynesian intro section
  ('venue.hackney.body_eyebrow', 'venue.hackney', 'text', 'Body — eyebrow',
   'Small yellow uppercase line above the body heading.', 8, 'We''ve glown up'),
  ('venue.hackney.body_image',   'venue.hackney', 'image', 'Body — side image',
   'Photo shown alongside the body heading / intro on desktop.', 9,
   '/hackney/course/Course_3.jpg'),

  -- More than golf section header
  ('venue.hackney.morethan.eyebrow', 'venue.hackney', 'text', 'More than golf — eyebrow',
   'Small yellow uppercase line above the heading.', 10, 'No Dice Games Bar'),
  ('venue.hackney.morethan.heading', 'venue.hackney', 'text', 'More than golf — heading',
   'Large section heading.', 11, 'More than just golf'),

  -- Six feature cards
  ('venue.hackney.feature1.image', 'venue.hackney', 'image',    'Feature 1 — image', 'Pool tables card image.', 12, '/hackney/pool/Pool_2.jpg'),
  ('venue.hackney.feature1.title', 'venue.hackney', 'text',     'Feature 1 — title', '', 13, 'Pool tables'),
  ('venue.hackney.feature1.body',  'venue.hackney', 'textarea', 'Feature 1 — body',  '', 14,
   'Two 7ft American pool tables, £5 for 30 minutes. Perfect rematch if you don''t fare so well on the course. Over-16s only.'),

  ('venue.hackney.feature2.image', 'venue.hackney', 'image',    'Feature 2 — image', 'Retro arcade card image.', 15, '/hackney/games/Games_2.jpg'),
  ('venue.hackney.feature2.title', 'venue.hackney', 'text',     'Feature 2 — title', '', 16, 'Retro arcade'),
  ('venue.hackney.feature2.body',  'venue.hackney', 'textarea', 'Feature 2 — body',  '', 17,
   'Pinball, retro multi-game cabinets, shoot-''em-ups, skee-ball and foosball. Hit 270 on the skee-ball and the cocktail''s on us.'),

  ('venue.hackney.feature3.image', 'venue.hackney', 'image',    'Feature 3 — image', 'No Dice Bar card image.', 18, '/hackney/drinks/Drinks_3.jpg'),
  ('venue.hackney.feature3.title', 'venue.hackney', 'text',     'Feature 3 — title', '', 19, 'No Dice Bar'),
  ('venue.hackney.feature3.body',  'venue.hackney', 'textarea', 'Feature 3 — body',  '', 20,
   'Fully loaded bar stocked with draught beers, craft cans, speciality ciders, house and classic cocktails, natural wines and a wide range of soft drinks.'),

  ('venue.hackney.feature4.image', 'venue.hackney', 'image',    'Feature 4 — image', 'Beer garden card image.', 21, '/hackney/garden/Garden_2.jpg'),
  ('venue.hackney.feature4.title', 'venue.hackney', 'text',     'Feature 4 — title', '', 22, 'Beer garden'),
  ('venue.hackney.feature4.body',  'venue.hackney', 'textarea', 'Feature 4 — body',  '', 23,
   'When the sun''s out — kick back with top-of-the-line ping pong tables to keep the competition going outside.'),

  ('venue.hackney.feature5.image', 'venue.hackney', 'image',    'Feature 5 — image', 'Snack Bar card image.', 24, '/hackney/snack_bar/Snack_bar_1.jpg'),
  ('venue.hackney.feature5.title', 'venue.hackney', 'text',     'Feature 5 — title', '', 25, 'Snack Bar'),
  ('venue.hackney.feature5.body',  'venue.hackney', 'textarea', 'Feature 5 — body',  '', 26,
   'Smash burgers, BBQ chicken, loaded chips. BBQ meat supplied by Smokoloko of Spitalfields.'),

  ('venue.hackney.feature6.image', 'venue.hackney', 'image',    'Feature 6 — image', 'Doubles pool tournament card image.', 27, '/hackney/games/Games_6.jpg'),
  ('venue.hackney.feature6.title', 'venue.hackney', 'text',     'Feature 6 — title', '', 28, 'Doubles pool tournament'),
  ('venue.hackney.feature6.body',  'venue.hackney', 'textarea', 'Feature 6 — body',  '', 29,
   '2nd and 4th Wednesday of the month. £200+ in bar tabs, medals, beer and Tees. Eight slots — always sells out.'),

  -- Events strip
  ('venue.hackney.events.heading', 'venue.hackney', 'text',     'Events — heading',
   'Title for the Events strip.', 30, 'Events at No Dice'),
  ('venue.hackney.events.intro',   'venue.hackney', 'textarea', 'Events — intro',
   'Sub-line beneath the events heading.', 31,
   'DJs, pool tournaments, parties, pop-ups — what''s on at the games bar.'),

  -- Find us
  ('venue.hackney.findus.heading',         'venue.hackney', 'text',     'Find us — heading',           '', 32, 'Find us'),
  ('venue.hackney.findus.address_label',   'venue.hackney', 'text',     'Find us — address label',     '', 33, 'Address'),
  ('venue.hackney.findus.address',         'venue.hackney', 'textarea', 'Find us — address',
   'Address text — separate lines with a return.', 34,
   E'Arch 407, Mentmore Terrace\nLondon E8 3PP\nMain entrance on Parkside'),
  ('venue.hackney.findus.transport_label', 'venue.hackney', 'text',     'Find us — transport label',   '', 35, 'Getting here'),
  ('venue.hackney.findus.transport',       'venue.hackney', 'textarea', 'Find us — transport list',
   'One bullet per line.', 36,
   E'2 mins from London Fields Overground\n5 mins from Broadway Market\n10 mins from Hackney Central Overground')

on conflict (key) do update
  set page       = excluded.page,
      field_kind = excluded.field_kind,
      label      = excluded.label,
      helper     = excluded.helper,
      sort_order = excluded.sort_order;
-- value is NOT overwritten on conflict, so any admin edits survive
-- a re-run.
