-- =============================================================
-- Migration 008 — fully wire /venue/borough-market + private-hire trio
-- =============================================================
-- Adds page_content rows for every editable text + image slot on:
--   - /venue/borough-market (the 6 feature cards + find-us)
--   - /private-hire        (every section)
--   - /private-hire/hackney (popular-for, fact panels: capacity,
--                            features, catering, licences, welcomes,
--                            house rules)
--   - /private-hire/borough-market (same shape)
-- Fact panel contents are stored as multi-line textarea values — one
-- bullet per line — which the public page splits on \n to render.
-- Safe to re-run.
-- =============================================================

insert into public.page_content (key, page, field_kind, label, helper, sort_order, value)
values
  -- ===== /venue/borough-market =====
  -- "What's under the arches" section heading
  ('venue.borough.features.eyebrow', 'venue.borough', 'text',     'Features eyebrow', 'Small line above the feature grid.',    20, ''),
  ('venue.borough.features.heading', 'venue.borough', 'text',     'Features heading', 'Heading above the 6 feature cards.',    21, ''),
  -- 6 feature cards
  ('venue.borough.feature1.image', 'venue.borough', 'image',    'Feature 1 — image', '', 22, ''),
  ('venue.borough.feature1.title', 'venue.borough', 'text',     'Feature 1 — title', '', 23, ''),
  ('venue.borough.feature1.body',  'venue.borough', 'textarea', 'Feature 1 — body',  '', 24, ''),
  ('venue.borough.feature2.image', 'venue.borough', 'image',    'Feature 2 — image', '', 25, ''),
  ('venue.borough.feature2.title', 'venue.borough', 'text',     'Feature 2 — title', '', 26, ''),
  ('venue.borough.feature2.body',  'venue.borough', 'textarea', 'Feature 2 — body',  '', 27, ''),
  ('venue.borough.feature3.image', 'venue.borough', 'image',    'Feature 3 — image', '', 28, ''),
  ('venue.borough.feature3.title', 'venue.borough', 'text',     'Feature 3 — title', '', 29, ''),
  ('venue.borough.feature3.body',  'venue.borough', 'textarea', 'Feature 3 — body',  '', 30, ''),
  ('venue.borough.feature4.image', 'venue.borough', 'image',    'Feature 4 — image', '', 31, ''),
  ('venue.borough.feature4.title', 'venue.borough', 'text',     'Feature 4 — title', '', 32, ''),
  ('venue.borough.feature4.body',  'venue.borough', 'textarea', 'Feature 4 — body',  '', 33, ''),
  ('venue.borough.feature5.image', 'venue.borough', 'image',    'Feature 5 — image', '', 34, ''),
  ('venue.borough.feature5.title', 'venue.borough', 'text',     'Feature 5 — title', '', 35, ''),
  ('venue.borough.feature5.body',  'venue.borough', 'textarea', 'Feature 5 — body',  '', 36, ''),
  ('venue.borough.feature6.image', 'venue.borough', 'image',    'Feature 6 — image', '', 37, ''),
  ('venue.borough.feature6.title', 'venue.borough', 'text',     'Feature 6 — title', '', 38, ''),
  ('venue.borough.feature6.body',  'venue.borough', 'textarea', 'Feature 6 — body',  '', 39, ''),
  -- Find us section
  ('venue.borough.findus.heading',    'venue.borough', 'text',     'Find us heading',   '',                                    50, ''),
  ('venue.borough.findus.callout',    'venue.borough', 'textarea', 'Postcode callout',  'Yellow box above the address.',       51, ''),
  ('venue.borough.findus.address',    'venue.borough', 'textarea', 'Address',           'One line per row.',                   52, ''),
  ('venue.borough.findus.entrance',   'venue.borough', 'textarea', 'Entrance hint',     '',                                    53, ''),
  ('venue.borough.findus.access_heading', 'venue.borough', 'text',     'Accessibility heading', '',                              54, ''),
  ('venue.borough.findus.access_body',    'venue.borough', 'textarea', 'Accessibility body',    '',                              55, ''),

  -- ===== /private-hire (overview) =====
  ('privatehire.hero_image',  'privatehire', 'image',    'Hero image',       '',                                              1, ''),
  ('privatehire.eyebrow',     'privatehire', 'text',     'Hero eyebrow',     '',                                              2, ''),
  ('privatehire.reasons.heading', 'privatehire', 'text',     'Reasons — heading',  'Heading on the "why hire" grid.',         10, ''),
  ('privatehire.reasons.intro',   'privatehire', 'textarea', 'Reasons — intro',    '',                                        11, ''),
  ('privatehire.cta.heading', 'privatehire', 'text',     'Bottom CTA heading', '',                                            20, ''),
  ('privatehire.cta.body',    'privatehire', 'textarea', 'Bottom CTA body',    '',                                            21, ''),

  -- ===== /private-hire/hackney =====
  ('privatehire.hackney.hero_image', 'privatehire.hackney', 'image',    'Hero image',          '',                              1, ''),
  ('privatehire.hackney.eyebrow',    'privatehire.hackney', 'text',     'Hero eyebrow',        '',                              2, ''),
  ('privatehire.hackney.intro',      'privatehire.hackney', 'textarea', 'Hero intro',          '',                              3, ''),
  ('privatehire.hackney.popular_heading', 'privatehire.hackney', 'text',     'Popular for — heading', '',                       10, ''),
  ('privatehire.hackney.popular_list',    'privatehire.hackney', 'textarea', 'Popular for — list',    'One use case per line.',  11, ''),
  ('privatehire.hackney.about_heading',   'privatehire.hackney', 'text',     'About — heading',  '',                            12, ''),
  ('privatehire.hackney.about_body',      'privatehire.hackney', 'textarea', 'About — body',     '',                            13, ''),
  ('privatehire.hackney.capacity',        'privatehire.hackney', 'textarea', 'Fact: Capacity',   'One bullet per line.',        20, ''),
  ('privatehire.hackney.features',        'privatehire.hackney', 'textarea', 'Fact: Room features', 'One per line.',            21, ''),
  ('privatehire.hackney.catering',        'privatehire.hackney', 'textarea', 'Fact: Catering',   '',                            22, ''),
  ('privatehire.hackney.licences',        'privatehire.hackney', 'textarea', 'Fact: Licences',   '',                            23, ''),
  ('privatehire.hackney.welcomes',        'privatehire.hackney', 'textarea', 'Fact: Venue welcomes', '',                        24, ''),
  ('privatehire.hackney.house_rules',     'privatehire.hackney', 'textarea', 'Fact: House rules', '',                           25, ''),
  ('privatehire.hackney.email_heading',   'privatehire.hackney', 'text',     'Email CTA heading', '',                           30, ''),
  ('privatehire.hackney.email_body',      'privatehire.hackney', 'textarea', 'Email CTA body',    '',                           31, ''),

  -- ===== /private-hire/borough-market =====
  ('privatehire.borough.hero_image', 'privatehire.borough', 'image',    'Hero image',          '',                              1, ''),
  ('privatehire.borough.eyebrow',    'privatehire.borough', 'text',     'Hero eyebrow',        '',                              2, ''),
  ('privatehire.borough.intro',      'privatehire.borough', 'textarea', 'Hero intro',          '',                              3, ''),
  ('privatehire.borough.popular_heading', 'privatehire.borough', 'text',     'Popular for — heading', '',                       10, ''),
  ('privatehire.borough.popular_list',    'privatehire.borough', 'textarea', 'Popular for — list',    'One per line.',           11, ''),
  ('privatehire.borough.about_heading',   'privatehire.borough', 'text',     'About — heading',  '',                            12, ''),
  ('privatehire.borough.about_body',      'privatehire.borough', 'textarea', 'About — body',     '',                            13, ''),
  ('privatehire.borough.capacity',        'privatehire.borough', 'textarea', 'Fact: Capacity',   'One bullet per line.',        20, ''),
  ('privatehire.borough.features',        'privatehire.borough', 'textarea', 'Fact: Room features', '',                          21, ''),
  ('privatehire.borough.catering',        'privatehire.borough', 'textarea', 'Fact: Catering',   '',                            22, ''),
  ('privatehire.borough.licences',        'privatehire.borough', 'textarea', 'Fact: Licences',   '',                            23, ''),
  ('privatehire.borough.welcomes',        'privatehire.borough', 'textarea', 'Fact: Venue welcomes', '',                        24, ''),
  ('privatehire.borough.house_rules',     'privatehire.borough', 'textarea', 'Fact: House rules', '',                           25, ''),
  ('privatehire.borough.email_heading',   'privatehire.borough', 'text',     'Email CTA heading', '',                           30, ''),
  ('privatehire.borough.email_body',      'privatehire.borough', 'textarea', 'Email CTA body',    '',                           31, ''),
  ('privatehire.borough.testimonial',     'privatehire.borough', 'textarea', 'Testimonial quote', 'Quote on its own line; attribution after a newline beginning with —', 32, ''),

  -- ===== /venue/borough-market body section (additions) =====
  ('venue.borough.body_eyebrow',    'venue.borough', 'text',     'Body eyebrow',    'Above the "London, in one course" heading.', 12, ''),
  ('venue.borough.gallery_heading', 'venue.borough', 'text',     'Gallery heading', '',                                          60, ''),
  ('venue.borough.gallery_intro',   'venue.borough', 'textarea', 'Gallery intro',   '',                                          61, ''),

  -- ===== /private-hire (overview) reasons + venue picker =====
  ('privatehire.reasons.eyebrow', 'privatehire', 'text',     'Reasons — eyebrow', '', 9,  ''),
  ('privatehire.reason1.title',   'privatehire', 'text',     'Reason 1 — title',  '', 30, ''),
  ('privatehire.reason1.body',    'privatehire', 'textarea', 'Reason 1 — body',   '', 31, ''),
  ('privatehire.reason2.title',   'privatehire', 'text',     'Reason 2 — title',  '', 32, ''),
  ('privatehire.reason2.body',    'privatehire', 'textarea', 'Reason 2 — body',   '', 33, ''),
  ('privatehire.reason3.title',   'privatehire', 'text',     'Reason 3 — title',  '', 34, ''),
  ('privatehire.reason3.body',    'privatehire', 'textarea', 'Reason 3 — body',   '', 35, ''),
  ('privatehire.venues.eyebrow',  'privatehire', 'text',     'Venues — eyebrow',  '', 40, ''),
  ('privatehire.venues.heading',  'privatehire', 'text',     'Venues — heading',  '', 41, ''),
  ('privatehire.venues.intro',    'privatehire', 'textarea', 'Venues — intro',    '', 42, '')
on conflict (key) do update
  set page = excluded.page,
      field_kind = excluded.field_kind,
      label = excluded.label,
      helper = excluded.helper,
      sort_order = excluded.sort_order;
