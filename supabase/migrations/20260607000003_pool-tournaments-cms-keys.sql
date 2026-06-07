-- =============================================================
-- Seed CMS keys for the new editable Tournament section copy
-- =============================================================
-- The TournamentSchedule component on /pool now wraps the header,
-- intro and per-type taglines in <Editable> so the founder can
-- change them from /admin/content/info/pool. ContentEditor loads
-- rows by page (info.pool) — insert one row per editable field with
-- the right field_kind and label so they show up in the admin form.
-- =============================================================

insert into public.page_content (key, value, page, field_kind, label, helper, sort_order)
values
  ('pool.tournaments.eyebrow',
   'Tournaments',
   'info.pool', 'text',
   'Tournaments — Eyebrow (small uppercase tag above the title)',
   'Shown above "Sign Your Team Up". Stays short.',
   200),

  ('pool.tournaments.title',
   'Sign Your Team Up',
   'info.pool', 'text',
   'Tournaments — Section title',
   'The big headline of the tournament section.',
   210),

  ('pool.tournaments.intro',
   'Pool tournaments run every Wednesday at No Dice — doubles and singles alternate weekly. Pick a format and a date, pay in advance to hold your spot.',
   'info.pool', 'textarea',
   'Tournaments — Intro paragraph',
   'The block of copy under the title that explains the format.',
   220),

  ('pool.tournaments.tagline_doubles',
   'Teams of two. Every other Wednesday.',
   'info.pool', 'text',
   'Tournaments — Doubles tagline',
   'Shown under the format buttons when "Doubles" is selected.',
   230),

  ('pool.tournaments.tagline_singles',
   'Solo entry. Every other Wednesday.',
   'info.pool', 'text',
   'Tournaments — Singles tagline',
   'Shown under the format buttons when "Singles" is selected.',
   240),

  ('pool.tournaments.tagline_special',
   'One-off tournaments and seasonal showdowns.',
   'info.pool', 'text',
   'Tournaments — Special events tagline',
   'Shown when a Special events tab is visible.',
   250)
on conflict (key) do nothing;
