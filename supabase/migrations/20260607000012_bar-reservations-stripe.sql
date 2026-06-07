-- =============================================================
-- Bar reservations — Stripe payment fields
-- =============================================================
-- Pool table bookings now charge a holding fee at the time of
-- reservation. £6 per 30-minute slot (so 30 min = £6, 60 min = £12)
-- — the Edge Function computes this server-side from
-- `duration_minutes` so the customer can't tamper with the amount.
--
-- New columns mirror the tournament_entries shape so the eventual
-- "all paid reservations" admin view can union both cleanly.
-- =============================================================

alter table public.bar_reservations
  add column if not exists amount_pence int;

alter table public.bar_reservations
  add column if not exists stripe_payment_intent_id text;

alter table public.bar_reservations
  add column if not exists paid_at timestamptz;

-- Extend the status enum so the webhook can flip 'pending' → 'paid'
-- when a Stripe payment_intent succeeds. Older rows stay as
-- 'pending' or 'confirmed' (founder's manual confirmation flow).
alter table public.bar_reservations
  drop constraint if exists bar_reservations_status_check;
alter table public.bar_reservations
  add constraint bar_reservations_status_check
  check (status in ('pending', 'paid', 'confirmed', 'cancelled', 'refunded'));

create index if not exists bar_reservations_pi_idx
  on public.bar_reservations(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
