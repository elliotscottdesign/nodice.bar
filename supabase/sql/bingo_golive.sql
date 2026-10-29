-- =============================================================
-- Bingo Night — GO LIVE (founder-gated flip)
-- =============================================================
-- Run ONLY when the founder says "launch". This makes the Comedy & Bingo night
-- (Wed 25 Nov 2026) PUBLIC and opens live £10 Stripe ticket sales. Pair it with the
-- code flip `BINGO_HIDDEN = false` in app/(public)/comedybingo/page.tsx (ship +
-- push to main) so the /events card can click through to the booking page.
--
-- Run via the Management API SQL endpoint with a fresh Supabase PAT:
--   curl -s -X POST \
--     "https://api.supabase.com/v1/projects/rntcujcpsozvuxvmlejv/database/query" \
--     -H "Authorization: Bearer sbp_…" -H "Content-Type: application/json" \
--     -d "$(python3 -c "import json;print(json.dumps({'query':open('supabase/sql/bingo_golive.sql').read()}))")"
--
-- Flips every `bingo`-category row (currently just the 25 Nov night):
--   registration_open=true   → loadBingoNights lists it + anon RLS read passes
--   show_on_events_calendar=true → it lands on the public /events calendar and
--                                  the team-hub events flyer (category 'bingo' +
--                                  subcategory 'Special Event' already classify
--                                  as a special there)
--   show_on_bar_page=true     → belt-and-braces anon read flag (no public listing)
--   bookable=true             → bingo-checkout accepts the £10 ticket
-- The ticket + tournaments FK-mirror rows already exist (see
-- bingo_monthly_series.sql), so bookings save straight away.
--
-- Idempotent: a plain flag overwrite. Re-running is a safe no-op.
-- To PULL BINGO BACK offline, swap each `true` below for `false`.
-- =============================================================

update public.events
set registration_open       = true,
    show_on_events_calendar = true,
    show_on_bar_page        = true,
    bookable                = true,
    updated_at              = now()
where category = 'bingo';

-- Keep the FK-mirror tournaments rows open too (so a booking never 409s on a
-- stale mirror flag). These are never shown publicly.
update public.tournaments t
set registration_open = true, bookable = true
where exists (
  select 1 from public.events e
  where e.id = t.id and e.category = 'bingo'
);

-- Confirm the live state.
select e.event_date, e.registration_open, e.show_on_events_calendar,
       e.show_on_bar_page, e.bookable, e.external_link, (e.poster_url is not null) as has_poster
from public.events e
where e.category = 'bingo'
order by e.event_date;
