-- =============================================================
-- Migration 007 — make /events, /deals and /vouchers fully editable
-- =============================================================
-- /events and /deals get their own structured tables (similar to
-- faqs / menu_sections — admin CRUD with order + active flag).
-- /vouchers only has hero text + three "perks" cards, so it fits
-- into page_content rows without a new table.
--
-- Also seeds the current hardcoded copy as the initial data, so
-- the live page looks identical after deploy — but every word is
-- now editable from /admin/content/*.
--
-- Safe to re-run. Re-running won't reseed if rows already exist.
-- =============================================================


-- ---------- site_events ----------
create table if not exists public.site_events (
  id            uuid primary key default gen_random_uuid(),
  venue         text not null,                   -- "Plonk Hackney at No Dice Bar"
  day           text not null,                   -- "Every Saturday"
  title         text not null,
  body          text not null,
  featured      boolean not null default false,
  venue_order   int not null default 0,          -- column order on the page
  event_order   int not null default 0,
  active        boolean not null default true,
  updated_at    timestamptz not null default now()
);

create index if not exists site_events_venue on public.site_events (venue_order, event_order);

drop trigger if exists site_events_updated_at on public.site_events;
create trigger site_events_updated_at
  before update on public.site_events
  for each row execute function public.set_updated_at();

alter table public.site_events enable row level security;

drop policy if exists "public read site events" on public.site_events;
create policy "public read site events" on public.site_events
  for select to anon, authenticated using (active = true);

drop policy if exists "auth write site events" on public.site_events;
create policy "auth write site events" on public.site_events
  for all to authenticated using (true) with check (true);

grant select on public.site_events to anon;
grant select, insert, update, delete on public.site_events to authenticated;


-- ---------- site_deals ----------
create table if not exists public.site_deals (
  id            uuid primary key default gen_random_uuid(),
  day           text not null,                   -- "Mondays — All day"
  title         text not null,
  venue         text,                            -- optional badge: "Hackney"
  body          text not null,
  sort_order    int not null default 0,
  active        boolean not null default true,
  updated_at    timestamptz not null default now()
);

create index if not exists site_deals_sort on public.site_deals (sort_order);

drop trigger if exists site_deals_updated_at on public.site_deals;
create trigger site_deals_updated_at
  before update on public.site_deals
  for each row execute function public.set_updated_at();

alter table public.site_deals enable row level security;

drop policy if exists "public read site deals" on public.site_deals;
create policy "public read site deals" on public.site_deals
  for select to anon, authenticated using (active = true);

drop policy if exists "auth write site deals" on public.site_deals;
create policy "auth write site deals" on public.site_deals
  for all to authenticated using (true) with check (true);

grant select on public.site_deals to anon;
grant select, insert, update, delete on public.site_deals to authenticated;


-- ---------- page_content rows for hero/body fields ----------
-- One row per editable text/image slot. Public page falls back to
-- the hardcoded default when value is empty, so leaving these blank
-- is harmless.
insert into public.page_content (key, page, field_kind, label, helper, sort_order, value)
values
  -- ----- /events -----
  ('events.hero_image',    'info.events', 'image',    'Hero image',    'Top-of-page photo on /events.',              1, ''),
  ('events.eyebrow',       'info.events', 'text',     'Eyebrow',       'Small uppercase line above title.',          2, ''),
  ('events.title',         'info.events', 'text',     'Title',         '',                                            3, ''),
  ('events.intro',         'info.events', 'textarea', 'Intro',         'Paragraph under the title.',                  4, ''),
  ('events.footer_note',   'info.events', 'textarea', 'Footer note',   'Text shown beneath the events grid.',         5, ''),

  -- ----- /deals -----
  ('deals.hero_image',     'info.deals',  'image',    'Hero image',    'Top-of-page photo on /deals.',                1, ''),
  ('deals.eyebrow',        'info.deals',  'text',     'Eyebrow',       '',                                            2, ''),
  ('deals.title',          'info.deals',  'text',     'Title',         '',                                            3, ''),
  ('deals.intro',          'info.deals',  'textarea', 'Intro',         '',                                            4, ''),
  ('deals.cta_heading',    'info.deals',  'text',     'CTA heading',   'Heading on the "looking for events?" panel.', 5, ''),
  ('deals.cta_link_label', 'info.deals',  'text',     'CTA link',      'Label of the link in that panel.',            6, ''),
  ('deals.cta_link_href',  'info.deals',  'url',      'CTA link href', 'Destination of that link.',                   7, ''),

  -- ----- /vouchers -----
  ('vouchers.hero_image',  'info.vouchers', 'image',    'Hero image', '',                                              1, ''),
  ('vouchers.eyebrow',     'info.vouchers', 'text',     'Eyebrow',    '',                                              2, ''),
  ('vouchers.title',       'info.vouchers', 'text',     'Title',      '',                                              3, ''),
  ('vouchers.intro',       'info.vouchers', 'textarea', 'Intro',      'Paragraph under the title.',                    4, ''),
  ('vouchers.body',        'info.vouchers', 'textarea', 'Body',       'Main paragraph beneath the hero.',              5, ''),
  ('vouchers.cta_label',   'info.vouchers', 'text',     'Buy button label', 'Text on the big pink button.',            6, ''),
  ('vouchers.cta_note',    'info.vouchers', 'textarea', 'Small print under button', 'Caption beneath the button.',     7, ''),

  ('vouchers.perk1.title', 'info.vouchers', 'text',     'Perk 1 — title', '',                                          10, ''),
  ('vouchers.perk1.body',  'info.vouchers', 'textarea', 'Perk 1 — body',  '',                                          11, ''),
  ('vouchers.perk2.title', 'info.vouchers', 'text',     'Perk 2 — title', '',                                          12, ''),
  ('vouchers.perk2.body',  'info.vouchers', 'textarea', 'Perk 2 — body',  '',                                          13, ''),
  ('vouchers.perk3.title', 'info.vouchers', 'text',     'Perk 3 — title', '',                                          14, ''),
  ('vouchers.perk3.body',  'info.vouchers', 'textarea', 'Perk 3 — body',  '',                                          15, '')
on conflict (key) do update
  set page = excluded.page,
      field_kind = excluded.field_kind,
      label = excluded.label,
      helper = excluded.helper,
      sort_order = excluded.sort_order;


-- ---------- Seed events + deals so the page renders ----------
do $$
begin
  if not exists (select 1 from public.site_events) then
    insert into public.site_events (venue, day, title, body, featured, venue_order, event_order) values
      ('Plonk Hackney at No Dice Bar', 'Every Saturday', 'Boozy Ballzy Brunch', 'Join us for the ultimate bottomless brunch experience. Epic games, unlimited drinks, delicious food, and endless fun.', true, 1, 1),
      ('Plonk Hackney at No Dice Bar', '1st Tuesday of the month', 'Queer Pool Social', 'Ladies and Queer Pool Social — pool games, prizes, more pool, more prizes. Free entry, just come along.', false, 1, 2),
      ('Plonk Hackney at No Dice Bar', '1st & 3rd Wednesdays', 'Singles Pool Tournament', '16 players go head-to-head across rounds then a knockout. £5 per player. Always sells out.', false, 1, 3),
      ('Plonk Hackney at No Dice Bar', '2nd & 4th Wednesdays', 'Doubles Pool Tournament', '8 teams battle across rounds of pool then a knockout. £10 team entry. Over £200 in bar tabs, medals, beer cases and Tees up for grabs.', false, 1, 4),
      ('Plonk Hackney at No Dice Bar', 'First Sunday of the month', 'Chess & Jazz', 'From 7pm — chess and jazz. Bring your own board or use ours. DJ spinning records, social tournament with prizes depending on numbers.', false, 1, 5),
      ('Plonk Hackney at No Dice Bar', 'Last Sunday of the month', 'Ping Pong Tournament', 'Heart-racing, ball-chasing evening of ping pong. Teams of two, one player up at a time, first to 11. Rounds then nail-biting knockouts. Bar tab prizes.', false, 1, 6),
      ('Plonk Borough', '3rd Wednesday of the month', 'Shoreditch Doubles Pool Tournament', 'Riotous doubles night under London Bridge. Over £200 in prizes — only 8 slots, always sells out.', false, 2, 1);
  end if;
end$$;

do $$
begin
  if not exists (select 1 from public.site_deals) then
    insert into public.site_deals (day, title, venue, body, sort_order) values
      ('Mondays — All day', '2-for-1 on Games', 'Hackney', '2-for-1 on arcade tokens, games, pool and golf. For online sales, buy one round of golf or tokens for two players.', 1),
      ('Tuesdays — All day', 'Game & Drink — £10', 'Hackney', 'A round of golf, three arcade tokens and a house drink — all for £10.', 2),
      ('Always on', '10% Off — Students & Hospitality Workers', null, 'Use across different items at different venues. Cannot be used in conjunction with other offers or with food from Taco Mates at Hackney.', 3);
  end if;
end$$;
