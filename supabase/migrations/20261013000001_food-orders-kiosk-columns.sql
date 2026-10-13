-- =============================================================
-- food_orders — additive columns for the On A Roll self-serve KIOSK
-- =============================================================
-- Stage 1 of the On A Roll iPad kiosk (a portrait, no-staff, self-serve till
-- at the food van). Orders placed at the kiosk are created server-side by the
-- new `onaroll-kiosk` edge function as source='kiosk', payment_provider='sumup',
-- and paid hands-free on a SumUp Solo card reader via the SumUp Cloud API.
--
-- ALL ADDITIVE — no existing column is touched. Every column has a default that
-- matches the CURRENT behaviour, so existing web/Stripe orders keep working with
-- no code change:
--   • payment_provider defaults to 'stripe' (every current order is Stripe)
--   • source           defaults to 'web'    (every current order is the web page)
-- The kitchen display, drink-deals tab, margins and the "food ready" SMS all read
-- the same columns they already read — they neither know nor care about these.
--
-- Announced on COORDINATION.md (Plonk-Borough-2.0) before running.
-- Shared Supabase project ref: rntcujcpsozvuxvmlejv
-- SQL editor: https://supabase.com/dashboard/project/rntcujcpsozvuxvmlejv/sql/new
-- =============================================================

alter table food_orders
  add column if not exists payment_provider text not null default 'stripe',
  add column if not exists source           text not null default 'web',
  add column if not exists sumup_tx_code     text,   -- SumUp's transaction code once the Solo settles
  add column if not exists sumup_client_tx_id text,  -- our client_transaction_id sent to the Solo (idempotency)
  add column if not exists failure_reason    text;   -- reader decline / timeout reason, for staff + diagnostics

-- Fast lookup of a kiosk order by the client_transaction_id we sent to the reader
-- (the SumUp webhook / status poll carries it back to mark the order paid).
create index if not exists idx_food_orders_sumup_client_tx
  on food_orders (sumup_client_tx_id)
  where sumup_client_tx_id is not null;
