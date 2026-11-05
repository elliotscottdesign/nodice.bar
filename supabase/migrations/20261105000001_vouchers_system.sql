-- =============================================================
-- Voucher system — enrich the vouchers table + redemption log
-- =============================================================
-- Vouchers are No Dice gift/comp/raffle vouchers, issued from the CRM with a
-- generated artwork (the deals poster engine, colour-through) carrying a locked
-- random code. Redeemable in person on the tills against a bill.
--
-- Redemption rule (founder): valid for 1 year from issue; the FIRST day it is
-- used the whole value becomes spendable and change accrues across that day's
-- transactions, but any balance left at the end of that first-use day is void —
-- no change carried to another day. Enforced server-side in voucher-redeem.
-- =============================================================

alter table public.vouchers
  add column if not exists poster_url         text,
  add column if not exists image_url          text,
  add column if not exists image_locked       boolean not null default false,
  add column if not exists issued_to_phone    text,
  add column if not exists kind               text not null default 'gift',
  add column if not exists note               text,
  add column if not exists first_redeemed_on  date,
  add column if not exists redeemed_at        timestamptz,
  add column if not exists sent_at            timestamptz,
  add column if not exists created_by         text,
  add column if not exists created_at         timestamptz not null default now();

-- Codes must be unique — the artwork's number is the key the till redeems on.
create unique index if not exists vouchers_code_key on public.vouchers (code);

-- Per-redemption ledger: one row each time value is taken off a voucher on a
-- till, so the till/staff system (and Finance) can see exactly what was spent.
create table if not exists public.voucher_redemptions (
  id                  uuid primary key default gen_random_uuid(),
  voucher_id          uuid not null references public.vouchers(id) on delete cascade,
  redeemed_at         timestamptz not null default now(),
  amount_pence        integer not null,
  balance_after_pence integer not null,
  staff               text,
  note                text
);
create index if not exists voucher_redemptions_voucher_idx
  on public.voucher_redemptions (voucher_id, redeemed_at desc);

-- RLS. The vouchers table already carries an "auth full access" (ALL, true)
-- policy that the existing /admin uses via the anon key — leave it untouched.
-- The new ledger just needs a matching read policy for the CRM; the redemption
-- edge functions use the service role, which bypasses RLS entirely.
alter table public.voucher_redemptions enable row level security;

drop policy if exists voucher_redemptions_read on public.voucher_redemptions;
create policy voucher_redemptions_read on public.voucher_redemptions
  for select using (true);
