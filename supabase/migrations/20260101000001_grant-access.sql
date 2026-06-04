-- =============================================================
-- Migration 001 — grant table access to anon + authenticated
-- =============================================================
-- The project was created with "Automatically expose new tables" OFF
-- (a Supabase-recommended safety default). RLS already controls WHICH
-- rows each role can see, but the underlying table privileges need
-- to be granted explicitly. This file does that.
-- =============================================================

-- anon (public site visitors) can read the catalogue tables
grant select on
  public.venues,
  public.tickets,
  public.addons,
  public.opening_hours,
  public.closed_dates,
  public.slot_overrides,
  public.promo_codes
to anon;

-- authenticated (admin) gets full access on everything
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
to authenticated;

-- Bookings table needs anon INSERT (the public booking page creates
-- a 'pending' booking when the customer hits Continue to Checkout).
-- RLS still locks reads down so no anon visitor can see other people's
-- bookings.
grant insert on public.bookings, public.booking_slots,
  public.booking_tickets, public.booking_addons
to anon;

-- Sequences (in case any are used by serial columns down the road)
grant usage on all sequences in schema public to anon, authenticated;
