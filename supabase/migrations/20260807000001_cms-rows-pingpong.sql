-- =============================================================
-- CMS rows for /pingpong (founder brief 7 Aug 2026)
-- =============================================================
-- Same pattern as 20260605000002 (bar/pool/plonk/book): without rows
-- in page_content the admin ContentEditor renders an empty form, even
-- though /pingpong reads these keys via useContent() with hardcoded
-- fallbacks. value stays '' so the live page keeps its fallback copy
-- until the founder edits a field.
-- ON CONFLICT (key) DO NOTHING — safe to re-run.
-- =============================================================

insert into public.page_content (key, page, field_kind, label, helper, sort_order, value)
values
  ('pingpong.eyebrow',         'info.pingpong', 'text',     'Eyebrow',            'Small uppercase line above the title, e.g. "Free to play · London Fields".',            1, ''),
  ('pingpong.title',           'info.pingpong', 'text',     'Title',              'Big page heading.',                                                                      2, ''),
  ('pingpong.intro',           'info.pingpong', 'textarea', 'Intro',              'Paragraph under the title — the free-to-play table copy.',                               3, ''),
  ('pingpong.tournament_line', 'info.pingpong', 'textarea', 'Tournament line',    'Sentence under the hero about the Sunday tournament.',                                   4, ''),
  ('pingpong.cta_label',       'info.pingpong', 'text',     'CTA button',         'Button text, e.g. "Book your team in · £12".',                                           5, ''),
  ('pingpong.sundays_title',   'info.pingpong', 'text',     'Sundays — heading',  'Heading above the date cards, e.g. "Pick your Sunday".',                                 6, ''),
  ('pingpong.sundays_intro',   'info.pingpong', 'textarea', 'Sundays — intro',    'Sentence above the date cards (price + both players'' emails note).',                    7, '')
on conflict (key) do nothing;
