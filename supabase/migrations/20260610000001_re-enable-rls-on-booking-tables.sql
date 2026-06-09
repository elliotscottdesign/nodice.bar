-- =============================================================
-- Re-enable RLS on the three booking tables (security fix)
-- =============================================================
-- Background: the previous migration
-- (20260608000002_disable-rls-on-checkout-tables.sql) DISABLED RLS
-- on bar_reservations / event_entries / tournament_entries because
-- the customer site was inserting rows directly with the anon key
-- and policies were blocking the inserts. That made the tables
-- publicly read/write/delete-able to anyone with the project URL,
-- which Supabase's security advisor flagged.
--
-- The correct fix is to move the inserts to Edge Functions
-- (pool-checkout, match-checkout, tournament-checkout,
-- create-table-reservation) which use the SUPABASE_SERVICE_ROLE_KEY
-- and bypass RLS. With RLS back on, the anon role has no access at
-- all — read/write/delete are all blocked.
--
-- The Edge Functions are the only path the customer site has to
-- write to these tables. The admin pages use authenticated sessions
-- (via supabase.auth.signInWithPassword) so the `authenticated`
-- role has full access.
-- =============================================================

-- ---- bar_reservations ---------------------------------------
alter table public.bar_reservations enable row level security;

-- Drop any leftover policies from earlier attempts. force=true is
-- not available; we use the standard "if exists" guard. If a policy
-- name clashes after a re-run, this migration is safe to re-run
-- because the create policy below uses identical wording.
drop policy if exists "anon_all" on public.bar_reservations;
drop policy if exists "anon_insert" on public.bar_reservations;
drop policy if exists "anon_select" on public.bar_reservations;
drop policy if exists "authenticated_all" on public.bar_reservations;

-- Authenticated users (admin via signInWithPassword) — full access.
-- Anon — no policy = no access. service_role bypasses RLS entirely
-- and is used by every Edge Function that touches this table, so
-- the customer booking flows keep working without granting anon
-- any direct table access.
create policy "authenticated_all"
  on public.bar_reservations
  for all
  to authenticated
  using (true)
  with check (true);

-- ---- event_entries ------------------------------------------
alter table public.event_entries enable row level security;

drop policy if exists "anon_all" on public.event_entries;
drop policy if exists "anon_insert" on public.event_entries;
drop policy if exists "anon_select" on public.event_entries;
drop policy if exists "authenticated_all" on public.event_entries;

create policy "authenticated_all"
  on public.event_entries
  for all
  to authenticated
  using (true)
  with check (true);

-- ---- tournament_entries -------------------------------------
alter table public.tournament_entries enable row level security;

drop policy if exists "anon_all" on public.tournament_entries;
drop policy if exists "anon_insert" on public.tournament_entries;
drop policy if exists "anon_select" on public.tournament_entries;
drop policy if exists "authenticated_all" on public.tournament_entries;

create policy "authenticated_all"
  on public.tournament_entries
  for all
  to authenticated
  using (true)
  with check (true);

-- =============================================================
-- Verification (run after this migration):
--
--   select schemaname, tablename, rowsecurity
--   from pg_tables
--   where tablename in ('bar_reservations','event_entries','tournament_entries');
--
-- Expect: rowsecurity = true for all three rows.
-- =============================================================
