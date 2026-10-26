-- Poster maker: remember how a poster was made, so reopening an event brings
-- the poster back instead of a blank maker, and so the Instagram story and A3
-- can be re-made later from the same settings.
--
-- One jsonb cell holds the whole recipe — colour, photo treatment, exposure,
-- crop position/zoom, title size and the poster wording. One column rather
-- than a dozen, so adding a new control later needs no further migration.
--
-- The source photo already has its own column (poster_image_url); it just
-- wasn't being written for most events, which is fixed in the app.
--
-- Safe to run more than once. The app checks whether this column exists and
-- simply doesn't write it if the migration hasn't been run yet, so posters
-- keep saving either way — they just won't be re-editable until it lands.

alter table public.events
  add column if not exists poster_recipe jsonb;

comment on column public.events.poster_recipe is
  'How the poster maker built this event''s poster: colour, treatment, exposure, crop, title size, wording. Used to reopen and re-render it.';
