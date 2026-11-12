# Coordination — shared-resource claims (nodice.bar)

Announce a claim before editing a shared file or running global DDL on the
Supabase project (rntcujcpsozvuxvmlejv). Clear your claim when done.

## Active claims

- **`app/(public)/events/page.tsx` + `app/(public)/deals/page.tsx`** (card link
  routing only) — _event-share-page session_, 12 Nov 2026. Back-fill: point
  every event/deal card at its `/event?o=<id>` page (additive link fallback;
  link_url still wins). No other logic touched. Clear when shipped.

## Done (claim cleared)

- **events.page_style column (DDL)** + `EventsAdminClient.tsx` (ticketing
  fields) + `app/(public)/event/page.tsx`, `lib/db/shareEvent.ts`,
  `components/EventTicketBooking.tsx` — PAGE / POP UP per-event selector.
  SHIPPED 12 Nov (origin/main 7cb56c1).
