-- =============================================================
-- calendar_events — monthly calendar entries for /events
-- =============================================================
-- Replaces the recurring-pattern model on site_events with one
-- row per concrete date. Each row is an artwork poster + a short
-- header / body / optional link, slotted into the day-cell of the
-- public calendar at /events.
--
-- The existing site_events table is left alone (still drives the
-- legacy admin if anyone needs it) but the public /events page
-- now reads from this new table exclusively.
-- =============================================================

create table if not exists public.calendar_events (
  id           uuid primary key default gen_random_uuid(),
  event_date   date not null,
  title        text not null,
  body         text,
  -- Image_url stores the public URL of the artwork the founder
  -- uploads via MediaPicker. Empty string until artwork exists.
  image_url    text not null default '',
  link_url     text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists calendar_events_date
  on public.calendar_events (event_date);

drop trigger if exists calendar_events_updated_at on public.calendar_events;
create trigger calendar_events_updated_at
  before update on public.calendar_events
  for each row execute function public.set_updated_at();

-- ---------- Row-Level Security ----------
alter table public.calendar_events enable row level security;

drop policy if exists "public read calendar events" on public.calendar_events;
create policy "public read calendar events"
  on public.calendar_events
  for select
  to anon, authenticated
  using (active = true);

drop policy if exists "auth full access calendar events" on public.calendar_events;
create policy "auth full access calendar events"
  on public.calendar_events
  for all
  to authenticated
  using (true)
  with check (true);

grant select on public.calendar_events to anon;
grant select, insert, update, delete on public.calendar_events to authenticated;
