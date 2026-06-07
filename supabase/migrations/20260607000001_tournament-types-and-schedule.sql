-- =============================================================
-- Tournament types + the 6-month Wednesday schedule
-- =============================================================
-- Adds a `tournament_type` column ('singles' | 'doubles' | 'special')
-- so the public /pool page can let customers filter by format, and
-- pre-generates Wednesdays from 17 Jun 2026 through 9 Dec 2026 — six
-- months of alternating doubles / singles, kick-off 19:15, entry fee
-- £30 each. Update via SQL or admin to tweak prices, descriptions,
-- max teams.
-- =============================================================

-- 1) Add the type column with a CHECK constraint covering the three
--    valid values. Default to 'doubles' for any existing rows (the
--    test row from earlier) so we can flip it not-null after.
alter table public.tournaments
  add column if not exists tournament_type text
    check (tournament_type in ('singles', 'doubles', 'special'));

update public.tournaments
  set tournament_type = 'doubles'
  where tournament_type is null;

alter table public.tournaments
  alter column tournament_type set not null;

create index if not exists tournaments_type_idx
  on public.tournaments(tournament_type)
  where registration_open = true;

-- 2) Seed the recurring Wednesday schedule.
--
--    Every Wednesday from 17 Jun 2026 (the second Wednesday from
--    today, Sun 7 Jun 2026) through 9 Dec 2026 — 26 events total.
--    Doubles + singles alternate, doubles first.
--
--    `where not exists` makes this safe to re-run: any tournament
--    already on that date is left alone, so the founder can edit
--    prices or names later without this seed clobbering changes.
insert into public.tournaments (
  name, event_date, start_time, max_teams,
  entry_fee_pence, registration_open, tournament_type
)
select
  case when ((row_number() over (order by d) - 1) % 2) = 0
    then 'Doubles Pool Tournament'
    else 'Singles Pool Tournament'
  end as name,
  d::date as event_date,
  '19:15'::time as start_time,
  16 as max_teams,
  3000 as entry_fee_pence,
  true as registration_open,
  case when ((row_number() over (order by d) - 1) % 2) = 0
    then 'doubles'
    else 'singles'
  end as tournament_type
from generate_series(
  '2026-06-17'::date,
  '2026-12-09'::date,
  '7 days'::interval
) as d
where not exists (
  select 1 from public.tournaments t
  where t.event_date = d::date
);
