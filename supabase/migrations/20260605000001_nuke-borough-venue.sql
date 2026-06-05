-- =============================================================
-- Nuke the Borough venue from the No Dice database
-- =============================================================
-- Single-venue site (Hackney only). This migration deletes the
-- Borough venue row and every venue-scoped child row that references
-- it, plus content/gallery rows that name Borough.
--
-- Runs against the LINKED Supabase project only. The linked project
-- is nodice-bar (ref rntcujcpsozvuxvmlejv); Plonk Golf's separate
-- project (ref bieikfwhzkdekojerdqs) is unaffected by `supabase
-- db push` because that command targets the current link.
--
-- Idempotent: after the borough row is gone every WHERE clause
-- matches nothing, so re-running is a no-op.
-- =============================================================

-- ------------------------------------------------------------
-- 1. Booking sub-rows that point at borough bookings.
--    booking_tickets / booking_addons / booking_slots each link
--    to bookings(id), so cascade-clean those first.
-- ------------------------------------------------------------
delete from public.booking_tickets
  where booking_id in (
    select id from public.bookings
    where venue_id in (select id from public.venues where slug = 'borough')
  );

delete from public.booking_addons
  where booking_id in (
    select id from public.bookings
    where venue_id in (select id from public.venues where slug = 'borough')
  );

delete from public.booking_slots
  where booking_id in (
    select id from public.bookings
    where venue_id in (select id from public.venues where slug = 'borough')
  );

-- ------------------------------------------------------------
-- 2. Bookings themselves.
-- ------------------------------------------------------------
delete from public.bookings
  where venue_id in (select id from public.venues where slug = 'borough');

-- ------------------------------------------------------------
-- 3. Catalogue rows scoped to borough.
--    tickets / opening_hours / closed_dates / slot_overrides
--    all carry venue_id. Addons are venue-agnostic by design so
--    are left alone.
-- ------------------------------------------------------------
delete from public.tickets
  where venue_id in (select id from public.venues where slug = 'borough');

delete from public.opening_hours
  where venue_id in (select id from public.venues where slug = 'borough');

delete from public.closed_dates
  where venue_id in (select id from public.venues where slug = 'borough');

delete from public.slot_overrides
  where venue_id in (select id from public.venues where slug = 'borough');

-- ------------------------------------------------------------
-- 4. CMS rows that name borough.
--    Anything keyed *.borough.* or footer.borough_* gets removed
--    so the admin no longer surfaces stale Borough copy.
-- ------------------------------------------------------------
delete from public.page_content
  where key like '%borough%';

-- Galleries: hero.venue.borough, hero.privatehire.borough,
-- venue.borough.gallery, home.venues.borough_image, etc.
delete from public.gallery_images
  where gallery_key like '%borough%';

-- ------------------------------------------------------------
-- 5. Finally — the venue row itself.
-- ------------------------------------------------------------
delete from public.venues where slug = 'borough';
