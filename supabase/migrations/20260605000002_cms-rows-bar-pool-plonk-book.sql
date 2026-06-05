-- =============================================================
-- CMS rows for the new nav pages: /bar /pool /plonk /book
-- =============================================================
-- Without rows in page_content the admin ContentEditor renders an
-- empty form, even though the public pages read these keys via
-- useContent() with hardcoded fallbacks. Seeding the rows here gives
-- the founder a populated form to edit from /admin/content/info/*.
--
-- value is left empty on every row — the public page falls back to
-- its hardcoded default until something is saved. Editing the row in
-- admin sets the value and the public page picks it up.
--
-- ON CONFLICT (key) DO NOTHING so re-running is safe and won't blow
-- away any edits the founder has already made.
-- =============================================================

insert into public.page_content (key, page, field_kind, label, helper, sort_order, value)
values
  -- ============================================================
  -- /bar
  -- ============================================================
  ('bar.hero_image',      'info.bar', 'image',    'Hero image',         'Top-of-page photo. For the slider, use Galleries → "HERO slider — Bar" instead.', 1, ''),
  ('bar.eyebrow',         'info.bar', 'text',     'Eyebrow',            'Small uppercase line above the title.',                                            2, ''),
  ('bar.title',           'info.bar', 'text',     'Title',              'Big page heading.',                                                                3, ''),
  ('bar.intro',           'info.bar', 'textarea', 'Intro',              'Short paragraph under the title.',                                                 4, ''),
  ('bar.menu_heading',    'info.bar', 'text',     'Menu heading',       'Heading above the menu CTA, e.g. "See what''s pouring".',                          5, ''),
  ('bar.menu_body',       'info.bar', 'textarea', 'Menu body',          'One short sentence under the menu heading.',                                       6, ''),
  ('bar.menu_cta_label',  'info.bar', 'text',     'Menu CTA — label',   'Button text, e.g. "View the menu".',                                               7, ''),
  ('bar.menu_cta_href',   'info.bar', 'url',      'Menu CTA — link',    'Where the button goes — a PDF link, an external menu, or a future /menu page.',    8, ''),

  -- ============================================================
  -- /pool
  -- ============================================================
  ('pool.hero_image',     'info.pool', 'image',   'Hero image',         'Top-of-page photo. For the slider, use Galleries → "HERO slider — Pool" instead.', 1, ''),
  ('pool.eyebrow',        'info.pool', 'text',    'Eyebrow',            'Small uppercase line above the title.',                                            2, ''),
  ('pool.title',          'info.pool', 'text',    'Title',              'Big page heading.',                                                                3, ''),
  ('pool.intro',          'info.pool', 'textarea','Intro',              'Short paragraph under the title.',                                                 4, ''),
  ('pool.cta_label',      'info.pool', 'text',    'CTA — label',        'Button text, e.g. "Book a table".',                                                5, ''),
  ('pool.cta_href',       'info.pool', 'url',     'CTA — link',         'Where the button goes — usually /book.',                                           6, ''),

  -- ============================================================
  -- /plonk  (re-purposed as the contact page)
  -- ============================================================
  ('plonk.eyebrow',         'info.plonk', 'text',     'Eyebrow',          'Small uppercase line above the title.',         1, ''),
  ('plonk.title',           'info.plonk', 'text',     'Title',            'Big page heading.',                              2, ''),
  ('plonk.intro',           'info.plonk', 'textarea', 'Intro',            'Short paragraph under the title.',               3, ''),
  ('plonk.email',           'info.plonk', 'text',     'Email',            'Public contact address.',                        4, ''),
  ('plonk.phone',           'info.plonk', 'text',     'Phone',            'Optional — leave blank to hide the phone card.', 5, ''),
  ('plonk.address',         'info.plonk', 'textarea', 'Address',          'Full postal address.',                           6, ''),
  ('plonk.hours',           'info.plonk', 'textarea', 'Opening hours',    'Free-form text, one line.',                      7, ''),
  ('plonk.instagram',       'info.plonk', 'url',      'Instagram URL',    'Full URL to the No Dice Instagram profile.',     8, ''),
  ('plonk.instagram_label', 'info.plonk', 'text',     'Instagram label',  'What to show on the card, e.g. @nodicelondon.',  9, ''),

  -- ============================================================
  -- /book landing — four category cards
  -- ============================================================
  ('book.hero_eyebrow', 'info.book', 'text',     'Hero eyebrow', 'Small uppercase line above the title.',                  1, ''),
  ('book.hero_title',   'info.book', 'text',     'Hero title',   'Big "Book Now" heading.',                                 2, ''),
  ('book.hero_intro',   'info.book', 'textarea', 'Hero intro',   'One sentence under the title.',                           3, ''),

  ('book.tables.name',    'info.book', 'text',     'Tables — name',    'Card title for the dining/table booking lane.',     10, ''),
  ('book.tables.tagline', 'info.book', 'text',     'Tables — tagline', 'Small uppercase line on the card.',                 11, ''),
  ('book.tables.blurb',   'info.book', 'textarea', 'Tables — blurb',   'One sentence on the card.',                         12, ''),
  ('book.tables.image',   'info.book', 'image',    'Tables — image',   'Card cover photo.',                                 13, ''),
  ('book.tables.href',    'info.book', 'url',      'Tables — link',    'Where the card goes (e.g. /book/hackney).',         14, ''),

  ('book.pool.name',    'info.book', 'text',     'Pool — name',    'Card title for the pool table booking lane.',           20, ''),
  ('book.pool.tagline', 'info.book', 'text',     'Pool — tagline', 'Small uppercase line on the card.',                     21, ''),
  ('book.pool.blurb',   'info.book', 'textarea', 'Pool — blurb',   'One sentence on the card.',                             22, ''),
  ('book.pool.image',   'info.book', 'image',    'Pool — image',   'Card cover photo.',                                     23, ''),
  ('book.pool.href',    'info.book', 'url',      'Pool — link',    'Where the card goes.',                                  24, ''),

  ('book.parties.name',    'info.book', 'text',     'Parties — name',    'Card title for the private hire lane.',           30, ''),
  ('book.parties.tagline', 'info.book', 'text',     'Parties — tagline', 'Small uppercase line on the card.',               31, ''),
  ('book.parties.blurb',   'info.book', 'textarea', 'Parties — blurb',   'One sentence on the card.',                       32, ''),
  ('book.parties.image',   'info.book', 'image',    'Parties — image',   'Card cover photo.',                               33, ''),
  ('book.parties.href',    'info.book', 'url',      'Parties — link',    'Where the card goes (default /private-hire).',    34, ''),

  ('book.golf.name',    'info.book', 'text',     'Golf — name',    'Card title for the Plonk Golf cross-link lane.',        40, ''),
  ('book.golf.tagline', 'info.book', 'text',     'Golf — tagline', 'Small uppercase line on the card.',                     41, ''),
  ('book.golf.blurb',   'info.book', 'textarea', 'Golf — blurb',   'One sentence on the card.',                             42, ''),
  ('book.golf.image',   'info.book', 'image',    'Golf — image',   'Card cover photo.',                                     43, ''),
  ('book.golf.href',    'info.book', 'url',      'Golf — link',    'External link to the Plonk Golf site by default.',      44, '')

on conflict (key) do nothing;
