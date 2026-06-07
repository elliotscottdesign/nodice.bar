-- =============================================================
-- Tournament entries — "Where did you hear about us" + newsletter
-- opt-in
-- =============================================================
-- Captured at sign-up so the founder can see what marketing channels
-- are pulling teams in, and so newsletter contacts have a clean
-- audit trail (GDPR — explicit unchecked-by-default opt-in).
-- =============================================================

alter table public.tournament_entries
  add column if not exists heard_from text;

alter table public.tournament_entries
  add column if not exists marketing_opt_in boolean not null default false;

-- Lightweight index for admin slicing by source.
create index if not exists tournament_entries_heard_from_idx
  on public.tournament_entries(heard_from)
  where heard_from is not null;
