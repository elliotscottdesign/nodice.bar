-- =============================================================
-- Plonk Golf — page_content + media_library tables
-- =============================================================
-- Adds editable site content (text snippets + image references) so
-- the marketing pages can read from Supabase instead of having
-- their copy hardcoded in React components. The admin Content
-- pages CRUD against these tables; the public site reads them on
-- mount and overlays them on top of the default hardcoded copy.
--
-- Storage:  create a bucket named "media" in Supabase Dashboard →
-- Storage → New bucket → Public access ON. Allowed MIME types
-- left default (images). After that the upload helper in
-- lib/db/media.ts can put files into it directly from the admin.
-- =============================================================

-- ---------- page_content ----------
create table if not exists public.page_content (
  key         text primary key,
  value       text not null default '',
  page        text not null,                    -- "home", "venue.hackney", "info.faqs", …
  field_kind  text not null default 'text'
               check (field_kind in ('text', 'textarea', 'html', 'image', 'url')),
  label       text not null,                    -- shown in admin form
  helper      text,                             -- placeholder/help text in admin
  sort_order  int  not null default 0,
  updated_at  timestamptz not null default now()
);

create index if not exists page_content_page on public.page_content (page, sort_order);

drop trigger if exists page_content_updated_at on public.page_content;
create trigger page_content_updated_at
  before update on public.page_content
  for each row execute function public.set_updated_at();

alter table public.page_content enable row level security;

-- Anyone can read content (the public site needs this).
drop policy if exists "public read page content" on public.page_content;
create policy "public read page content" on public.page_content
  for select to anon, authenticated using (true);

-- Authenticated admin can write.
drop policy if exists "auth write page content" on public.page_content;
create policy "auth write page content" on public.page_content
  for all to authenticated using (true) with check (true);

grant select on public.page_content to anon;
grant select, insert, update, delete on public.page_content to authenticated;


-- ---------- media_library ----------
create table if not exists public.media_library (
  id          uuid primary key default gen_random_uuid(),
  filename    text not null,
  storage_path text not null,                   -- "page/home-hero-1747000000.jpg"
  public_url  text not null,
  alt         text,
  bytes       int,
  uploaded_at timestamptz not null default now()
);

create index if not exists media_library_uploaded on public.media_library (uploaded_at desc);

alter table public.media_library enable row level security;

drop policy if exists "public read media" on public.media_library;
create policy "public read media" on public.media_library
  for select to anon, authenticated using (true);

drop policy if exists "auth write media" on public.media_library;
create policy "auth write media" on public.media_library
  for all to authenticated using (true) with check (true);

grant select on public.media_library to anon;
grant select, insert, update, delete on public.media_library to authenticated;


-- ---------- seed: register every editable slot on the marketing site
-- so the admin Content forms know what fields exist even before
-- anyone has saved anything. The actual `value` for each slot can
-- start blank; the public site falls back to the hardcoded default
-- when the value is empty.
-- =============================================================
insert into public.page_content (key, page, field_kind, label, helper, sort_order, value)
values
  -- ----- Home -----
  ('home.hero.image',         'home', 'image',    'Hero image',           'Full-width photograph at the top of the homepage.',                1, ''),
  ('home.hero.eyebrow',       'home', 'text',     'Hero eyebrow',         'Small uppercase text above the headline.',                          2, ''),
  ('home.hero.headline_1',    'home', 'text',     'Headline (line 1)',    'Large headline, first line.',                                       3, ''),
  ('home.hero.headline_2',    'home', 'text',     'Headline (line 2)',    'Large headline, italic yellow second line.',                        4, ''),
  ('home.hero.subcopy',       'home', 'textarea', 'Hero sub-copy',        'Paragraph beneath the headline.',                                   5, ''),
  ('home.venues.hackney',     'home', 'textarea', 'Hackney blurb',        'Description on the Hackney venue card.',                            6, ''),
  ('home.venues.borough',     'home', 'textarea', 'Borough blurb',        'Description on the Borough Market venue card.',                     7, ''),

  -- ----- Venue: Hackney -----
  ('venue.hackney.hero_image', 'venue.hackney', 'image',    'Hero image',     'Main image at the top of the Hackney page.',                  1, ''),
  ('venue.hackney.eyebrow',    'venue.hackney', 'text',     'Eyebrow',        'Small uppercase line above the title.',                       2, ''),
  ('venue.hackney.title',      'venue.hackney', 'text',     'Page title',     'Large page title.',                                            3, ''),
  ('venue.hackney.intro',      'venue.hackney', 'textarea', 'Intro paragraph', 'Lead paragraph beneath the title.',                            4, ''),
  ('venue.hackney.body',       'venue.hackney', 'html',     'Body copy',       'Main page content (supports basic HTML).',                    5, ''),

  -- ----- Venue: Borough Market -----
  ('venue.borough.hero_image', 'venue.borough', 'image',    'Hero image',      'Main image at the top of the Borough page.',                 1, ''),
  ('venue.borough.eyebrow',    'venue.borough', 'text',     'Eyebrow',         'Small uppercase line above the title.',                      2, ''),
  ('venue.borough.title',      'venue.borough', 'text',     'Page title',      'Large page title.',                                           3, ''),
  ('venue.borough.intro',      'venue.borough', 'textarea', 'Intro paragraph', 'Lead paragraph beneath the title.',                           4, ''),
  ('venue.borough.body',       'venue.borough', 'html',     'Body copy',       'Main page content (supports basic HTML).',                   5, ''),

  -- ----- Private hire (overview) -----
  ('privatehire.title',          'privatehire', 'text',     'Page title',     'Headline for the private hire overview page.',                 1, ''),
  ('privatehire.intro',          'privatehire', 'textarea', 'Intro paragraph','Lead paragraph beneath the title.',                            2, ''),
  ('privatehire.body',           'privatehire', 'html',     'Body copy',      'Main private hire content.',                                   3, ''),

  -- ----- Private hire: Hackney -----
  ('privatehire.hackney.title',  'privatehire.hackney', 'text',     'Title',     '',                                                          1, ''),
  ('privatehire.hackney.body',   'privatehire.hackney', 'html',     'Body',      'Hackney private hire content.',                             2, ''),
  ('privatehire.hackney.image',  'privatehire.hackney', 'image',    'Image',     '',                                                          3, ''),

  -- ----- Private hire: Borough -----
  ('privatehire.borough.title',  'privatehire.borough', 'text',     'Title',     '',                                                          1, ''),
  ('privatehire.borough.body',   'privatehire.borough', 'html',     'Body',      'Borough Market private hire content.',                      2, ''),
  ('privatehire.borough.image',  'privatehire.borough', 'image',    'Image',     '',                                                          3, ''),

  -- ----- Info pages -----
  ('about.title',      'info.about',    'text',     'Title',     '',                                                                          1, ''),
  ('about.body',       'info.about',    'html',     'Body',      'About-us content.',                                                          2, ''),

  ('contact.title',    'info.contact',  'text',     'Title',     '',                                                                          1, ''),
  ('contact.body',     'info.contact',  'html',     'Body',      'Contact-page content.',                                                      2, ''),

  ('faqs.title',       'info.faqs',     'text',     'Title',     '',                                                                          1, ''),
  ('faqs.intro',       'info.faqs',     'textarea', 'Intro',     '',                                                                          2, ''),

  ('snackbar.title',   'info.snackbar', 'text',     'Title',     '',                                                                          1, ''),
  ('snackbar.body',    'info.snackbar', 'html',     'Body',      '',                                                                          2, ''),

  ('terms.title',      'info.terms',    'text',     'Title',     '',                                                                          1, ''),
  ('terms.body',       'info.terms',    'html',     'Body',      '',                                                                          2, ''),

  ('privacy.title',    'info.privacy',  'text',     'Title',     '',                                                                          1, ''),
  ('privacy.body',     'info.privacy',  'html',     'Body',      '',                                                                          2, '')
on conflict (key) do update
  set page = excluded.page,
      field_kind = excluded.field_kind,
      label = excluded.label,
      helper = excluded.helper,
      sort_order = excluded.sort_order;
-- Note: we do NOT overwrite `value` on conflict — re-running this migration
-- safely registers any newly-added slots without clobbering existing edits.
