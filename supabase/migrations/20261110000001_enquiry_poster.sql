-- =============================================================
-- enquiry poster maker — store the poster on the booking enquiry
-- =============================================================
-- The CRM gets the same poster maker that special events / bingo use
-- (EventPosterStudio). A party / wedding / leaving-drinks booking enquiry can
-- now have a branded No Dice poster built straight from its details and KEPT on
-- the enquiry, so reopening the drawer shows the last poster instead of a blank
-- maker.
--
--   • poster_url     — the rendered artwork (CDN-served PNG in storage).
--   • poster_recipe  — how it was built (photo crops, colour, treatment, title
--                      size, the wording, plus the poster title/date/time the
--                      office typed) so the maker rebuilds the exact same poster
--                      on reopen.
--
-- Both nullable + additive — nothing else changes, and an enquiry without a
-- poster simply has nulls here.
-- =============================================================

alter table public.enquiries
  add column if not exists poster_url text,
  add column if not exists poster_recipe jsonb;

-- Let PostgREST see the new columns straight away.
notify pgrst, 'reload schema';
