-- Pool booking hardening (founder 20 Oct 2026)
-- ============================================================================
-- Context: website pool checkouts (pool-checkout Edge Fn) insert a
-- bar_reservations row as 'pending' + a Stripe PaymentIntent id BEFORE the
-- customer pays; the stripe-webhook flips it to 'paid' on success. When a
-- customer abandons the Stripe page the row was staying 'pending' forever —
-- it blocked the slot (pool-checkout counts pending rows toward capacity) and
-- cluttered the office views as a phantom "booking". (Noah, 20 Oct: 4 such
-- abandoned 'pending' holds, zero payment, blocking that night's tables.)
--
-- Founder rule: 'pending' is ONLY for sales-team slot holds. Those are created
-- by the office (AddReservationForm, Booking type = Pending) with NO
-- stripe_payment_intent_id. So we can safely tell the two apart:
--   website abandoned hold = status 'pending' AND stripe_payment_intent_id IS NOT NULL AND paid_at IS NULL
--   office/sales hold       = status 'pending' AND stripe_payment_intent_id IS NULL   (left alone)
--
-- This pg_cron job cancels abandoned WEBSITE holds older than 30 min every
-- 10 min. Paid rows (webhook already flipped them to 'paid' = confirmed in the
-- admin views) and office 'pending' holds are untouched.
--
-- Applied live via the Supabase Management API query endpoint (project
-- rntcujcpsozvuxvmlejv); kept here for repo history / reproducibility.
-- ============================================================================

select cron.unschedule('pool-abandoned-hold-sweep')
where exists (select 1 from cron.job where jobname = 'pool-abandoned-hold-sweep');

select cron.schedule(
  'pool-abandoned-hold-sweep',
  '*/10 * * * *',
  $$update public.bar_reservations
      set status = 'cancelled', updated_at = now()
    where kind = 'pool'
      and status = 'pending'
      and stripe_payment_intent_id is not null   -- website checkout (office holds have none)
      and paid_at is null                          -- never paid
      and created_at < now() - interval '30 minutes'$$
);
