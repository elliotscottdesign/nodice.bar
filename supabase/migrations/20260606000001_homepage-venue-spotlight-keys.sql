-- =============================================================
-- Editable rows for the homepage VenueSpotlight
-- =============================================================
-- The VenueSpotlight on app/(public)/page.tsx now reads every text
-- surface (eyebrow / name / features / button labels) via useContent.
-- Seed the matching page_content rows under page='home' so they show
-- up in the existing Home admin form at /admin/content/home and can
-- be edited from the live page via the click-to-edit overlay.
--
-- Idempotent: ON CONFLICT (key) DO NOTHING preserves any value the
-- founder has already set.
-- =============================================================

insert into public.page_content (key, page, field_kind, label, helper, sort_order, value)
values
  ('home.venues.hackney_eyebrow', 'home', 'text', 'Hackney — eyebrow',
   'Small uppercase line above the venue title. Currently "London Fields · 407 Mentmore Terrace".', 40, ''),

  ('home.venues.hackney_name', 'home', 'text', 'Hackney — title',
   'Big display title of the venue card. Currently "Hackney".', 41, ''),

  ('home.venues.hackney_features', 'home', 'textarea', 'Hackney — features list',
   'One bullet per line. Currently four items: Pool & arcade, Beer garden, Kitchen residencies, Big screens for sport.', 42, ''),

  ('home.venues.hackney_book_label', 'home', 'text', 'Hackney — book button label',
   'Text on the pink CTA button. Currently "Book Hackney".', 43, ''),

  ('home.venues.hackney_detail_label', 'home', 'text', 'Hackney — venue-details link label',
   'Text on the secondary link next to the button. Currently "Venue details →".', 44, '')

on conflict (key) do nothing;
