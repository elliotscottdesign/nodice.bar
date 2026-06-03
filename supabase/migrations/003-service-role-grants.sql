-- =============================================================
-- Migration 003 — Grant table access to service_role
-- =============================================================
-- Supabase's service_role bypasses Row-Level-Security policies, but
-- it still needs underlying TABLE PRIVILEGES (Postgres GRANTs) to
-- read/write data. The original schema only granted to anon and
-- authenticated, so the Stripe Edge Functions (which use
-- SUPABASE_SERVICE_ROLE_KEY) hit "permission denied" on every query.
--
-- Fix: give service_role full DML on every public-schema table and
-- usage on every sequence. service_role only runs inside our own
-- server code, so unrestricted access is correct here.
--
-- Safe to re-run.
-- =============================================================

grant usage on schema public to service_role;

grant select, insert, update, delete on
  public.venues,
  public.tickets,
  public.addons,
  public.opening_hours,
  public.closed_dates,
  public.slot_overrides,
  public.promo_codes,
  public.vouchers,
  public.bookings,
  public.booking_slots,
  public.booking_tickets,
  public.booking_addons,
  public.email_templates
to service_role;

grant usage, select on all sequences in schema public to service_role;

-- Default-privileges so any future tables/sequences inherit the same
-- service_role access without needing another migration. (Belt + braces.)
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to service_role;
