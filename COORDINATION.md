# Coordination — shared-resource claims (nodice.bar)

Announce a claim before editing a shared file or running global DDL on the
Supabase project (rntcujcpsozvuxvmlejv). Clear your claim when done.

## Active claims

- **Promoter portal** — _promoter session_, 25 Nov 2026. New DDL (tables
  `promoters`, `event_promoters`, `promoter_notes` — additive, RLS-locked, no
  anon access; no change to `events`/`event_entries`) + new edge fn `promoter`
  + new `app/(public)/promoter/page.tsx` + `lib/db/promoter.ts`. Touching
  `app/admin/events/EventsAdminClient.tsx` to add a "Promoter" box to the event
  editor (email/name/pass + notes) — additive section only, no change to
  existing save logic. Clear when shipped.

- **`app/(public)/events/page.tsx` + `app/(public)/deals/page.tsx`** (card link
  routing only) — _event-share-page session_, 12 Nov 2026. Back-fill: point
  every event/deal card at its `/event?o=<id>` page (additive link fallback;
  link_url still wins). No other logic touched. Clear when shipped.

## Done (claim cleared)

- **events.page_style column (DDL)** + `EventsAdminClient.tsx` (ticketing
  fields) + `app/(public)/event/page.tsx`, `lib/db/shareEvent.ts`,
  `components/EventTicketBooking.tsx` — PAGE / POP UP per-event selector.
  SHIPPED 12 Nov (origin/main 7cb56c1).
