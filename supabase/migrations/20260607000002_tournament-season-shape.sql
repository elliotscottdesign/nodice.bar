-- =============================================================
-- Tournament season shape: prices, length, GRAND FINAL
-- =============================================================
-- Founder's spec (7 Jun 2026):
--   • Doubles entry: £12 per team (was £30)
--   • Singles entry:  £6 per player (was £30)
--   • Season is 8 doubles + 8 singles, alternating weekly from
--     Wed 17 Jun → Wed 30 Sep 2026 (16 events).
--   • Followed by ONE GRAND FINAL on Wed 7 Oct 2026 for the top 8
--     teams of the season — visible on the schedule but NOT
--     publicly bookable (invitation only).
-- =============================================================

-- 1) Re-price the existing seed.
--    We only touch rows in the regular season window so any
--    one-off special events the founder might add later (with their
--    own prices) are left alone.
update public.tournaments
  set entry_fee_pence = 1200
  where tournament_type = 'doubles'
    and event_date between '2026-06-17' and '2026-10-06';

update public.tournaments
  set entry_fee_pence = 600
  where tournament_type = 'singles'
    and event_date between '2026-06-17' and '2026-10-06';

-- 2) Add a `bookable` flag separate from `registration_open`.
--    `registration_open` already controls whether the row shows up
--    on the public schedule via RLS. `bookable` controls whether
--    customers can actually pay to enter — lets us show GRAND FINAL
--    on the page with an "Invitation only" tag while blocking
--    sign-ups server-side.
alter table public.tournaments
  add column if not exists bookable boolean default true not null;

-- 3) Trim the seed to season length.
--    The earlier seed went out to 9 Dec; the season actually ends
--    on 30 Sep. Drop any seeded rows after that, but only if no
--    customer has actually entered them — `on delete cascade` would
--    nuke their entries otherwise.
delete from public.tournaments t
  where event_date > '2026-09-30'
    and not exists (
      select 1 from public.tournament_entries e
      where e.tournament_id = t.id
    );

-- 4) GRAND FINAL — Wed 7 Oct 2026.
--    Visible on the public schedule (registration_open=true) so
--    customers can see the season's destination, but bookable=false
--    blocks Stripe sign-up. The Edge Function also re-checks
--    bookable=true server-side before creating a Checkout session.
insert into public.tournaments (
  name, description, event_date, start_time, max_teams,
  entry_fee_pence, registration_open, bookable, tournament_type
) values (
  'GRAND FINAL',
  'Top 8 teams from the season — invitation only.',
  '2026-10-07', '19:15', 8, 0, true, false, 'special'
)
on conflict do nothing;
