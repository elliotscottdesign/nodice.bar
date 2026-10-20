-- =============================================================
-- Event lead-poster priority — editable ordering
-- =============================================================
-- When several events fall on the SAME day, the public /events
-- calendar shows ONE "lead" poster for that day. Which event leads
-- used to be decided by a hard-coded ladder in
-- app/(public)/events/page.tsx (leadRank()). This table makes the
-- order the office's to set from /admin/event-priority.
--
-- Each row is one PRIORITY BUCKET (not a raw category — the office
-- thinks in groups: "specials beat DJs beat deals"). The event's
-- bucket is still worked out in code (lib/db/leadPriority.ts) using
-- the same precedence as before; only the ORDER the buckets take is
-- data-driven here. Lower sort_order = leads first.
--
-- Happy Hour is NOT a row here on purpose: it is forced dead last in
-- code (founder rule, raised repeatedly) and must never be draggable
-- above anything else.
--
-- Seeded to reproduce the OLD hard-coded order exactly, so nothing
-- on the public calendar changes until the founder reorders it. If
-- the table is empty or unreachable, the page falls back to that
-- same default order in code.
-- =============================================================

create table if not exists public.event_lead_priority (
  bucket text primary key,          -- 'special','dj','oneoff','recurring','deal'
  sort_order int not null,
  updated_at timestamptz not null default now()
);

-- Seed = the previous hard-coded order (special → dj → one-off →
-- weekly regulars → deals). Happy Hour is handled in code, not here.
insert into public.event_lead_priority (bucket, sort_order)
values
  ('special',   0),
  ('dj',        1),
  ('oneoff',    2),
  ('recurring', 3),
  ('deal',      4)
on conflict (bucket) do nothing;

-- Public can read the order (the customer-facing calendar reads it
-- directly, anon). Only authenticated admins can change it.
alter table public.event_lead_priority enable row level security;

drop policy if exists "event_lead_priority select public" on public.event_lead_priority;
create policy "event_lead_priority select public" on public.event_lead_priority
  for select to anon using (true);

drop policy if exists "event_lead_priority full access for auth" on public.event_lead_priority;
create policy "event_lead_priority full access for auth" on public.event_lead_priority
  for all to authenticated using (true) with check (true);

drop trigger if exists event_lead_priority_touch_updated_at on public.event_lead_priority;
create trigger event_lead_priority_touch_updated_at
  before update on public.event_lead_priority
  for each row execute function public.touch_updated_at();
