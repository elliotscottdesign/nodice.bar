-- No Dice CRM — fulfilment fields (20 Oct 2026).
-- A confirmed enquiry can have a full-payment Stripe Payment Link (the office
-- enters the total and sends the client a link) and a record of when the
-- client was emailed. Additive only. Auto-mark-paid via stripe-webhook is a
-- separate, later change — for now the office marks paid manually, so paid_at
-- is written by staff, not the webhook.

alter table enquiries
  add column if not exists amount_pence integer,        -- full amount to pay
  add column if not exists payment_url  text not null default '',  -- Stripe link
  add column if not exists paid_at      timestamptz,     -- set when marked paid
  add column if not exists last_emailed_at timestamptz;  -- client comms stamp
