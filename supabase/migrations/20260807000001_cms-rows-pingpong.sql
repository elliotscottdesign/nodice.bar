-- =============================================================
-- CMS rows for /pingpong (founder brief 7 Aug 2026)
-- =============================================================
-- Same pattern as 20260605000002 (bar/pool/plonk/book): without rows
-- in page_content the admin ContentEditor renders an empty form, even
-- though /pingpong reads these keys via useContent() with hardcoded
-- fallbacks. value stays '' so the live page keeps its fallback copy
-- until the founder edits a field.
-- Guarded with WHERE NOT EXISTS (the live table has no unique
-- constraint on `key`, so ON CONFLICT errors with 42P10) — safe to re-run.
-- =============================================================

insert into public.page_content (key, page, field_kind, label, helper, sort_order, value)
select v.key, v.page, v.field_kind, v.label, v.helper, v.sort_order, v.value
from (values
  ('pingpong.eyebrow',         'info.pingpong', 'text',     'Eyebrow',            'Small uppercase line above the title, e.g. "Free to play · London Fields".',            1, ''),
  ('pingpong.title',           'info.pingpong', 'text',     'Title',              'Big page heading.',                                                                      2, ''),
  ('pingpong.intro',           'info.pingpong', 'textarea', 'Intro',              'Paragraph under the title — the free-to-play table copy.',                               3, ''),
  ('pingpong.tournament_line', 'info.pingpong', 'textarea', 'Tournament line',    'Sentence under the hero about the Sunday tournament.',                                   4, ''),
  ('pingpong.cta_label',       'info.pingpong', 'text',     'CTA button',         'Button text, e.g. "Book your team in · £12".',                                           5, ''),
  ('pingpong.sundays_title',   'info.pingpong', 'text',     'Sundays — heading',  'Heading above the date cards, e.g. "Pick your Sunday".',                                 6, ''),
  ('pingpong.sundays_intro',   'info.pingpong', 'textarea', 'Sundays — intro',    'Sentence above the date cards (price + both players'' emails note).',                    7, '')
) as v(key, page, field_kind, label, helper, sort_order, value)
where not exists (
  select 1 from public.page_content pc where pc.key = v.key
);

-- Cards + FAQ + league copy (added 7 Aug 2026 — founder needs every
-- visible sentence editable). Same NOT EXISTS guard.
insert into public.page_content (key, page, field_kind, label, helper, sort_order, value)
select v.key, v.page, v.field_kind, v.label, v.helper, v.sort_order, v.value
from (values
  ('pingpong.card1_title', 'info.pingpong', 'text',     'Card 1 — title', 'First how-it-works card heading.',   8,  ''),
  ('pingpong.card1_body',  'info.pingpong', 'textarea', 'Card 1 — body',  'First card text.',                   9,  ''),
  ('pingpong.card2_title', 'info.pingpong', 'text',     'Card 2 — title', 'Second card heading.',               10, ''),
  ('pingpong.card2_body',  'info.pingpong', 'textarea', 'Card 2 — body',  'Second card text.',                  11, ''),
  ('pingpong.card3_title', 'info.pingpong', 'text',     'Card 3 — title', 'Third card heading.',                12, ''),
  ('pingpong.card3_body',  'info.pingpong', 'textarea', 'Card 3 — body',  'Third card text.',                   13, ''),
  ('pingpong.card4_title', 'info.pingpong', 'text',     'Card 4 — title', 'Fourth card heading.',               14, ''),
  ('pingpong.card4_body',  'info.pingpong', 'textarea', 'Card 4 — body',  'Fourth card text.',                  15, ''),
  ('pingpong.league_intro','info.pingpong', 'textarea', 'League — intro', 'Sentence above the league table.',   16, ''),
  ('pingpong.faq_title',   'info.pingpong', 'text',     'FAQ — heading',  'Heading above the FAQ cards.',       17, ''),
  ('pingpong.faq1_q',      'info.pingpong', 'text',     'FAQ 1 — question','First FAQ question.',               18, ''),
  ('pingpong.faq1_a',      'info.pingpong', 'textarea', 'FAQ 1 — answer', 'First FAQ answer.',                  19, ''),
  ('pingpong.faq2_q',      'info.pingpong', 'text',     'FAQ 2 — question','Second FAQ question.',              20, ''),
  ('pingpong.faq2_a',      'info.pingpong', 'textarea', 'FAQ 2 — answer', 'Second FAQ answer.',                 21, ''),
  ('pingpong.faq3_q',      'info.pingpong', 'text',     'FAQ 3 — question','Third FAQ question.',               22, ''),
  ('pingpong.faq3_a',      'info.pingpong', 'textarea', 'FAQ 3 — answer', 'Third FAQ answer.',                  23, '')
) as v(key, page, field_kind, label, helper, sort_order, value)
where not exists (
  select 1 from public.page_content pc where pc.key = v.key
);
