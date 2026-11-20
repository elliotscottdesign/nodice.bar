-- Comedy & Bingo daily ticket-sales digest (founder 20 Nov 2026)
-- ============================================================================
-- Emails elliot@nodice.bar + billyj13@proton.me once a day with the day's
-- bingo ticket sales (count + £) and the running total, per bingo night.
-- Served by the `bingo-sales-digest` Edge Function (reads paid
-- tournament_entries for every events-row with category='bingo').
--
-- The function is gated by a shared secret in env BINGO_SALES_DIGEST_SECRET
-- (set via `supabase secrets set` — NOT stored here). Fill it into the body
-- below when (re)applying. Applied live via the Management API query endpoint
-- on project rntcujcpsozvuxvmlejv; kept here for repo history / reproducibility.
--
-- Schedule: 59 23 * * * = 23:59 UTC daily (end of day; ≈ 23:59 London in winter).
-- ============================================================================

select cron.unschedule('bingo-sales-digest-daily')
where exists (select 1 from cron.job where jobname = 'bingo-sales-digest-daily');

select cron.schedule(
  'bingo-sales-digest-daily',
  '59 23 * * *',
  $job$select net.http_post(
    url:='https://rntcujcpsozvuxvmlejv.supabase.co/functions/v1/bingo-sales-digest',
    headers:='{"Content-Type":"application/json"}'::jsonb,
    body:=jsonb_build_object('secret', '<BINGO_SALES_DIGEST_SECRET>'),
    timeout_milliseconds:=5000
  )$job$
);
