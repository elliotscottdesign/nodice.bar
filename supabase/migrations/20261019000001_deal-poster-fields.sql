-- Deal / special-event poster fields — store the DATA behind a deal or special
-- poster (not just the flattened image) so it can be cross-generated for the
-- website, the drinks-zine cover AND the team-hub 8-page Events flyer, and so
-- the flyer can drop in a print-ready (black-on-transparent) page render.
--
-- All columns are nullable + additive. The customer site reads events with
-- select("*"), so these appear automatically; nothing selects them explicitly
-- until the app code that writes them ships, so applying this early is safe.
--
-- Consumed by: the deal/special poster maker (app/admin/events), the public
-- /events page, the drinks zine (team hub), and the Events flyer (team hub,
-- which reads `flyer_poster_url`).

alter table public.events
  -- The real ticket/entry value in £ (requires_ticket is only a yes/no). Lets a
  -- poster/flyer show the actual price instead of just "TICKETED".
  add column if not exists ticket_price numeric(8, 2),
  -- Free-text bottom line on the poster/flyer, set per deal/special:
  -- "FREE ENTRY" / "£10" / "DEAL OF THE DAY". Replaces the baked
  -- "NO DICE - date/time" footer when set.
  add column if not exists poster_footer text,
  -- The sub-copy line under the title, e.g.
  -- "1 round of golf / 3 arcade tokens / 1 house drink".
  add column if not exists poster_subcopy text,
  -- The SOURCE artwork/photo for the poster (not the flattened poster_url), so
  -- the poster can be regenerated from data at any time.
  add column if not exists poster_image_url text,
  -- Editable QR target for the poster (defaults to the event's calendar listing
  -- when blank). Lets a special listing point its QR somewhere bespoke.
  add column if not exists poster_qr_url text,
  -- A print-ready page render: black-on-transparent, A-series (1:root2) page
  -- ratio. The team-hub Events flyer drops this straight into its A7 panel (no
  -- CSS invert). Blank → the flyer falls back to inverting poster_url.
  add column if not exists flyer_poster_url text;
