-- =============================================================
-- Bingo live caller board (part 4 of the bingo product)
-- =============================================================
-- One shared, ephemeral "current game" row the caller drives and the public
-- display reads. Single row keyed 'live' (the night runs one game at a time;
-- reset wipes it between games). `called` is the set of called balls (1–90);
-- `last_number` is the most recent call for the big highlight.
--
-- The caller page lives in /admin (Supabase-authenticated → the "auth write"
-- policy). The public display (/bingo-live) reads it anon and polls — same
-- slow-poll pattern as the tournament live board (no realtime subscription).
-- =============================================================

create table if not exists public.bingo_live (
  id text primary key,
  called int[] not null default '{}',
  last_number int,
  updated_at timestamptz not null default now()
);

insert into public.bingo_live (id) values ('live') on conflict (id) do nothing;

alter table public.bingo_live enable row level security;

drop policy if exists "bingo_live anon read" on public.bingo_live;
create policy "bingo_live anon read" on public.bingo_live
  for select to anon using (true);

drop policy if exists "bingo_live auth write" on public.bingo_live;
create policy "bingo_live auth write" on public.bingo_live
  for all to authenticated using (true) with check (true);

-- 20 Oct: the caller moved to the team hub (team.nodice.bar /ops), which talks
-- to Supabase over anon PostgREST (the arena pattern) — so allow anon to UPDATE
-- the single shared row. Low-stakes ephemeral game state; matches arena_matches.
drop policy if exists "bingo_live anon write" on public.bingo_live;
create policy "bingo_live anon write" on public.bingo_live
  for update to anon using (true) with check (true);
