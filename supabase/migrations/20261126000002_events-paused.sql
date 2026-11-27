-- =============================================================
-- Pause / resume a deal — one additive flag on `events`
-- =============================================================
-- A deal is stored as many `events` rows (category 'drink_special' /
-- subcategory 'Deals') sharing a recurrence_parent_id. The founder wants to
-- temporarily switch a whole deal OFF (across all its dates) without deleting
-- it or losing its ~20 dates, then switch it back on exactly as it was.
--
-- Rather than flipping and trying to remember the existing show_on_* visibility
-- flags, we add ONE unambiguous flag:
--
--   • paused = true  → the deal's rows are kept, but every PUBLIC surface skips
--                      them (the /events calendar, /deals, the /bar menu, the
--                      homepage scrollers). The admin deals list STILL shows
--                      them, marked "Paused", so they can be resumed.
--   • paused = false → live as normal (the default for every existing + new row).
--
-- Additive, NOT NULL with a safe default, so every existing row is 'false'
-- (live) immediately and nothing changes until a deal is actually paused.
-- Applies to any event, not just deals, but only the deals admin exposes the
-- control for now.
-- =============================================================

alter table public.events
  add column if not exists paused boolean not null default false;

notify pgrst, 'reload schema';
