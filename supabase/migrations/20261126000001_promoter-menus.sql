-- =============================================================
-- Promoter portal — Phase 2: chef pop-up menus (draft store)
-- =============================================================
-- A food-event promoter (a chef pop-up) builds their menu in the promoter
-- portal. It is a DRAFT here — it does NOT touch the live On A Roll menu
-- (`menu_catalog`). The office reviews a submitted menu and one-click
-- "Publishes to On A Roll", which creates a hidden pop-up section in
-- menu_catalog (that step lives with the kitchen lane). This keeps an external
-- chef from ever writing the live, shared menu document directly.
--
-- `doc` mirrors the menu_catalog item shape so publishing is a clean mapping:
--   { dishes: [ { id, name, desc, sell_pence, cost_pence, qty, allergens:{} } ],
--     note, logo }
-- allergens: { <key>: 'contains'|'trace'|'pending' } — same 15 keys + states as
-- the kitchen 🍔 Menu editor. qty = how many to prep (feeds live stock later).
--
-- RLS-locked, no anon access — all reads/writes go through the `promoter` edge
-- function (service role) and are scoped to events the promoter owns.
-- =============================================================

create table if not exists public.promoter_menus (
  event_id     uuid primary key references public.events(id) on delete cascade,
  doc          jsonb not null default '{"dishes":[]}'::jsonb,
  status       text not null default 'draft' check (status in ('draft', 'submitted', 'published')),
  submitted_at timestamptz,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.promoter_menus enable row level security;

create policy "promoter_menus full access for auth" on public.promoter_menus
  for all to authenticated using (true) with check (true);
-- (no anon policy → anon has no access)
