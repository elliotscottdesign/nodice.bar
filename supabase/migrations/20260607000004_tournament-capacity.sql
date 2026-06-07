-- =============================================================
-- Tournament capacity — hard cap at 12 teams per event
-- =============================================================
-- Founder's spec (7 Jun 2026): no more than 12 teams can sign up to
-- any one tournament. Once 12 paid (or are mid-checkout) the public
-- schedule shows SOLD OUT and the Edge Function rejects new entries.
--
-- We track availability via a `paid_entries_count` denormalized
-- column on `tournaments`, kept in sync by a trigger on
-- `tournament_entries`. The denormalization lets anon clients see
-- counts without exposing the individual entries (RLS on entries
-- still hides them). The Edge Function ALSO counts pending entries
-- live in its capacity check so two customers can't grab the last
-- spot in the same 30 seconds.
-- =============================================================

-- 1) Tighten the cap to 12 on every existing tournament.
update public.tournaments
  set max_teams = 12
  where max_teams > 12;

-- 2) Add the denormalized count column.
alter table public.tournaments
  add column if not exists paid_entries_count int not null default 0;

-- 3) Backfill from existing entries.
update public.tournaments t
  set paid_entries_count = coalesce(c.n, 0)
  from (
    select tournament_id, count(*)::int as n
    from public.tournament_entries
    where status = 'paid'
    group by tournament_id
  ) c
  where c.tournament_id = t.id;

-- Also reset to 0 for any tournament with no paid entries.
update public.tournaments t
  set paid_entries_count = 0
  where not exists (
    select 1 from public.tournament_entries e
    where e.tournament_id = t.id and e.status = 'paid'
  );

-- 4) Trigger to keep the count in sync going forward.
--    Fires on UPDATE of status, and on DELETE. INSERTs always land
--    as 'pending_payment' which doesn't change the paid count, so
--    no INSERT branch is needed.
create or replace function public.sync_tournament_paid_count()
returns trigger as $$
begin
  if tg_op = 'UPDATE' then
    if old.status <> 'paid' and new.status = 'paid' then
      update public.tournaments
        set paid_entries_count = paid_entries_count + 1
        where id = new.tournament_id;
    elsif old.status = 'paid' and new.status <> 'paid' then
      update public.tournaments
        set paid_entries_count = greatest(0, paid_entries_count - 1)
        where id = new.tournament_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.status = 'paid' then
      update public.tournaments
        set paid_entries_count = greatest(0, paid_entries_count - 1)
        where id = old.tournament_id;
    end if;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists tournament_entries_sync_paid_count
  on public.tournament_entries;
create trigger tournament_entries_sync_paid_count
  after update or delete on public.tournament_entries
  for each row execute function public.sync_tournament_paid_count();
