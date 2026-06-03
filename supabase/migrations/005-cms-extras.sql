-- =============================================================
-- Migration 005 — CMS extras: storage policies, FAQs, menu items,
--                 gallery images, and extra page_content slots for
--                 body copy and homepage features.
-- =============================================================
-- Safe to re-run. Adds:
--   1. Storage policies so authenticated admin can upload to /media
--      and the public site can read images back out.
--   2. faqs table  — structured Q&As for /faqs.
--   3. menu_sections + menu_items — Snack Bar menu data.
--   4. gallery_images — per-gallery image lists with reorder/alt.
--   5. page_content seed rows for venue/private-hire body copy and
--      the four homepage "more than mini-golf" feature blurbs.
-- =============================================================


-- =============================================================
-- 1. Storage policies for the public "media" bucket
-- =============================================================
-- The bucket itself was created as Public in the dashboard (so reads
-- are open). Writes still need a policy or anon/authenticated uploads
-- get a 403. We allow any signed-in admin (authenticated role) to
-- INSERT/UPDATE/DELETE objects in this one bucket only.

drop policy if exists "public read media bucket" on storage.objects;
create policy "public read media bucket" on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'media');

drop policy if exists "auth upload media bucket" on storage.objects;
create policy "auth upload media bucket" on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'media');

drop policy if exists "auth update media bucket" on storage.objects;
create policy "auth update media bucket" on storage.objects
  for update
  to authenticated
  using (bucket_id = 'media')
  with check (bucket_id = 'media');

drop policy if exists "auth delete media bucket" on storage.objects;
create policy "auth delete media bucket" on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'media');


-- =============================================================
-- 2. FAQs — structured Q&A entries
-- =============================================================
create table if not exists public.faqs (
  id           uuid primary key default gen_random_uuid(),
  section      text not null,                  -- "Vouchers and promo codes", "Booking", …
  question     text not null,
  answer       text not null,
  section_order int not null default 0,
  faq_order    int not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists faqs_section_order on public.faqs (section_order, faq_order);

drop trigger if exists faqs_updated_at on public.faqs;
create trigger faqs_updated_at
  before update on public.faqs
  for each row execute function public.set_updated_at();

alter table public.faqs enable row level security;

drop policy if exists "public read faqs" on public.faqs;
create policy "public read faqs" on public.faqs
  for select to anon, authenticated using (active = true);

drop policy if exists "auth write faqs" on public.faqs;
create policy "auth write faqs" on public.faqs
  for all to authenticated using (true) with check (true);

grant select on public.faqs to anon;
grant select, insert, update, delete on public.faqs to authenticated;


-- =============================================================
-- 3. Snack Bar — menu sections + items
-- =============================================================
create table if not exists public.menu_sections (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  intro        text,
  sort_order   int not null default 0,
  active       boolean not null default true,
  updated_at   timestamptz not null default now()
);

drop trigger if exists menu_sections_updated_at on public.menu_sections;
create trigger menu_sections_updated_at
  before update on public.menu_sections
  for each row execute function public.set_updated_at();

create table if not exists public.menu_items (
  id           uuid primary key default gen_random_uuid(),
  section_id   uuid not null references public.menu_sections(id) on delete cascade,
  title        text not null,
  body         text,
  price        text,                            -- kept as text so "12" or "From £6" both work
  sort_order   int not null default 0,
  active       boolean not null default true,
  updated_at   timestamptz not null default now()
);

create index if not exists menu_items_section on public.menu_items (section_id, sort_order);

drop trigger if exists menu_items_updated_at on public.menu_items;
create trigger menu_items_updated_at
  before update on public.menu_items
  for each row execute function public.set_updated_at();

alter table public.menu_sections enable row level security;
alter table public.menu_items    enable row level security;

drop policy if exists "public read menu sections" on public.menu_sections;
create policy "public read menu sections" on public.menu_sections
  for select to anon, authenticated using (active = true);
drop policy if exists "auth write menu sections" on public.menu_sections;
create policy "auth write menu sections" on public.menu_sections
  for all to authenticated using (true) with check (true);

drop policy if exists "public read menu items" on public.menu_items;
create policy "public read menu items" on public.menu_items
  for select to anon, authenticated using (active = true);
drop policy if exists "auth write menu items" on public.menu_items;
create policy "auth write menu items" on public.menu_items
  for all to authenticated using (true) with check (true);

grant select on public.menu_sections, public.menu_items to anon;
grant select, insert, update, delete on public.menu_sections, public.menu_items to authenticated;


-- =============================================================
-- 4. Gallery images — flat per-gallery image lists
-- =============================================================
create table if not exists public.gallery_images (
  id           uuid primary key default gen_random_uuid(),
  gallery_key  text not null,                   -- e.g. "home.features", "about.gallery"
  src          text not null,                   -- absolute URL or /public path
  alt          text,
  caption      text,
  sort_order   int not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists gallery_images_key on public.gallery_images (gallery_key, sort_order);

alter table public.gallery_images enable row level security;

drop policy if exists "public read gallery images" on public.gallery_images;
create policy "public read gallery images" on public.gallery_images
  for select to anon, authenticated using (active = true);

drop policy if exists "auth write gallery images" on public.gallery_images;
create policy "auth write gallery images" on public.gallery_images
  for all to authenticated using (true) with check (true);

grant select on public.gallery_images to anon;
grant select, insert, update, delete on public.gallery_images to authenticated;


-- =============================================================
-- 5. Extra page_content slots — body copy + homepage features
-- =============================================================
insert into public.page_content (key, page, field_kind, label, helper, sort_order, value)
values
  -- Homepage venue blurbs (already declared in 004 but kept here so anyone
  -- re-running this migration as a one-stop fix sees them present)
  ('home.venues.hackney',   'home', 'textarea', 'Hackney blurb',           'Description on the Hackney venue card.',                                        6, ''),
  ('home.venues.borough',   'home', 'textarea', 'Borough blurb',           'Description on the Borough Market venue card.',                                 7, ''),

  -- Homepage "more than mini-golf" features (one heading + two-line body each)
  ('home.feature1.title',   'home', 'text',     'Feature 1 — title',       'First feature block heading (Bar).',                                            10, ''),
  ('home.feature1.body',    'home', 'textarea', 'Feature 1 — body',        'Two-line description.',                                                          11, ''),
  ('home.feature2.title',   'home', 'text',     'Feature 2 — title',       'Second feature block heading (Pool).',                                          12, ''),
  ('home.feature2.body',    'home', 'textarea', 'Feature 2 — body',        '',                                                                              13, ''),
  ('home.feature3.title',   'home', 'text',     'Feature 3 — title',       'Third feature block heading (Board games).',                                    14, ''),
  ('home.feature3.body',    'home', 'textarea', 'Feature 3 — body',        '',                                                                              15, ''),
  ('home.feature4.title',   'home', 'text',     'Feature 4 — title',       'Fourth feature block heading (Arcade).',                                        16, ''),
  ('home.feature4.body',    'home', 'textarea', 'Feature 4 — body',        '',                                                                              17, ''),

  -- Venue Hackney body
  ('venue.hackney.body_heading', 'venue.hackney', 'text',     'Body heading', 'Heading directly under the hero.',                                            10, ''),
  ('venue.hackney.body_intro',   'venue.hackney', 'textarea', 'Body intro',   'Lead paragraph of the body copy.',                                            11, ''),

  -- Venue Borough body
  ('venue.borough.body_heading', 'venue.borough', 'text',     'Body heading', 'Heading directly under the hero.',                                            10, ''),
  ('venue.borough.body_intro',   'venue.borough', 'textarea', 'Body intro',   'Lead paragraph of the body copy.',                                            11, '')
on conflict (key) do update
  set page = excluded.page,
      field_kind = excluded.field_kind,
      label = excluded.label,
      helper = excluded.helper,
      sort_order = excluded.sort_order;


-- =============================================================
-- Seed default FAQ + menu data so admin lists aren't empty on first
-- load. Idempotent — only inserts when no rows exist yet.
-- =============================================================
do $$
begin
  if not exists (select 1 from public.faqs) then
    insert into public.faqs (section, question, answer, section_order, faq_order) values
      ('Booking', 'Do I need to book?', 'Yes — we book in 10-minute slots up to a year in advance. Walk-ins are welcome if there''s availability but a booking is the only way to guarantee a tee time.', 1, 1),
      ('Booking', 'Can I cancel or move my booking?', 'Up to 24 hours before your slot, drop us an email at info@plonkgolf.co.uk and we''ll sort a refund or reschedule.', 1, 2),
      ('Vouchers and promo codes', 'How do I redeem a promo code or voucher at checkout?', 'Type or paste the code in the promo box on the basket page before continuing to checkout, then hit Apply. The discount will show on the next screen.', 2, 1);
  end if;
end$$;

do $$
declare
  s_mains uuid;
  s_sides uuid;
begin
  if not exists (select 1 from public.menu_sections) then
    insert into public.menu_sections (title, sort_order) values ('Burgers & loaded chips', 1) returning id into s_mains;
    insert into public.menu_sections (title, sort_order) values ('Sides', 2) returning id into s_sides;

    insert into public.menu_items (section_id, title, body, price, sort_order) values
      (s_mains, 'Smash burger w/ chips', '8oz homemade patty from olive-fed British wagyu, cheese, crunchy salad, burger sauce, brioche bun.', '12', 1),
      (s_mains, 'BBQ chicken burger w/ chips', '6oz chicken thigh marinated for 24 hours and smoked on cherry wood. Cheese, crunchy salad, burger sauce, brioche bun.', '12', 2),
      (s_mains, 'Loaded chips', 'Choose topping (6oz): BBQ chicken · 12-hour smoked BBQ brisket · garlic shrooms (v). Crossed with mayo & chives.', '10', 3),
      (s_sides, 'Green peppers (v)', 'Padron-style charred peppers with sea salt.', '6', 1);
  end if;
end$$;
