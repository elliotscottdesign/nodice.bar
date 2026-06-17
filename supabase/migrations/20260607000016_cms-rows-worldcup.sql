-- =============================================================
-- CMS rows for /worldcup
-- =============================================================
-- Without rows in page_content, the admin ContentEditor renders
-- an empty form for the page — even though the public page reads
-- these keys via useContent() with hardcoded fallbacks. Seeding
-- gives the founder a populated form at /admin/content/info/worldcup
-- so they can edit copy without us pushing code.
--
-- value is left empty on every row — the public page falls back
-- to the hardcoded default until something is saved.
-- =============================================================

insert into public.page_content (key, page, field_kind, label, helper, sort_order, value)
values
  ('worldcup.hero_image',  'info.worldcup', 'image',    'Hero image',         'Top-of-page photo. For the slider, upload to Galleries → "HERO slider — World Cup".', 1, ''),
  ('worldcup.eyebrow',     'info.worldcup', 'text',     'Eyebrow',            'Small uppercase line above the title.',                                              2, ''),
  ('worldcup.title',       'info.worldcup', 'text',     'Title',              'Big page heading.',                                                                  3, ''),
  ('worldcup.intro',       'info.worldcup', 'textarea', 'Intro',              'Short paragraph under the title.',                                                   4, ''),
  ('worldcup.cta_label',   'info.worldcup', 'text',     'CTA — label',        'Button text, e.g. "Reserve a table".',                                               5, ''),
  ('worldcup.cta_href',    'info.worldcup', 'url',      'CTA — link',         'Where the button goes — usually /book/table.',                                       6, ''),

  ('worldcup.schedule.eyebrow', 'info.worldcup', 'text',     'Schedule eyebrow', 'Small line above the match list, e.g. "Match schedule".',                          7, ''),
  ('worldcup.schedule.title',   'info.worldcup', 'text',     'Schedule title',   'Heading above the match list.',                                                   8, ''),
  ('worldcup.schedule.intro',   'info.worldcup', 'textarea', 'Schedule intro',   'Short paragraph above the match list.',                                           9, '')
on conflict (key) do nothing;
