-- =============================================================
-- Bar reservations — heard_from + GDPR opt-in fields
-- =============================================================
-- Same shape as tournament_entries (migration 20260607000005) so
-- admin reporting + CSV exports can union both sources cleanly
-- when we get to Phase 5 of the events platform.
-- =============================================================

alter table public.bar_reservations
  add column if not exists heard_from text;

alter table public.bar_reservations
  add column if not exists marketing_opt_in boolean not null default false;

create index if not exists bar_reservations_heard_from_idx
  on public.bar_reservations(heard_from)
  where heard_from is not null;
