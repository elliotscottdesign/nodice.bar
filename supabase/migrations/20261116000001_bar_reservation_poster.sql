-- =============================================================
-- Invitation maker on the booking card — store the invitation on the booking
-- =============================================================
-- The office makes a party invitation straight from a booking in
-- /admin/table-reservations (a "🎟 Invitation maker" button next to "Add pool
-- time"). The invitation is kept ON the booking, so reopening shows the last
-- one and it can be downloaded / re-sent.
--
--   • poster_url     — the rendered invitation (CDN-served PNG in storage).
--   • poster_recipe  — how it was built (photos, colour, treatment, wording,
--                      plus the headline/date/time), so the maker rebuilds the
--                      exact same invitation on reopen.
--
-- Both nullable + additive.
-- =============================================================

alter table public.bar_reservations
  add column if not exists poster_url text,
  add column if not exists poster_recipe jsonb;

notify pgrst, 'reload schema';
