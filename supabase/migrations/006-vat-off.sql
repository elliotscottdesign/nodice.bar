-- =============================================================
-- Migration 006 — VAT off (pre-threshold trading)
-- =============================================================
-- Plonk Golf is currently below the UK VAT registration threshold,
-- so no VAT is charged on tickets, add-ons or bookings. This
-- migration:
--   1. Sets every existing ticket + add-on row's vat_rate_pct to 0,
--      so admin lists don't display a stale 20% next to each row.
--   2. Flips the column default to 0 so future-created rows start
--      VAT-free unless the admin explicitly raises it later.
--
-- When you cross the threshold and need to start charging VAT,
-- just update the rows back to 20 from the admin Tickets / Add-ons
-- pages (the VAT % field stays editable in both modals).
--
-- Safe to re-run.
-- =============================================================

update public.tickets set vat_rate_pct = 0 where vat_rate_pct <> 0;
update public.addons  set vat_rate_pct = 0 where vat_rate_pct <> 0;

alter table public.tickets alter column vat_rate_pct set default 0;
alter table public.addons  alter column vat_rate_pct set default 0;
