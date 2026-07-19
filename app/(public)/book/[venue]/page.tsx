import { Suspense } from "react";
import CatalogueLoader from "./CatalogueLoader";

// /book/hackney — mini-golf booking flow.
// Reactivated 2026-07-19: the standalone plonkgolf.co.uk site isn't
// live yet, so in the meantime customers book Plonk Hackney tee times
// on nodice.bar via the existing 955-line BookingFlow that was already
// in-tree (originally forked from the Plonk Golf site). CatalogueLoader
// pulls venue + golf tickets from Supabase (venues/tickets tables) and
// hands them to BookingFlow. Checkout is /book/checkout, which hits
// the create-payment-intent Edge Function → Stripe → get-booking.
//
// When plonkgolf.co.uk goes live, either revert this page to the
// RedirectToBook stub or repoint the /minigolf "Book Now" button and
// the /book Mini Golf card to plonkgolf.co.uk instead.

export function generateStaticParams() {
  return [{ venue: "hackney" }];
}

const VENUE_NAMES: Record<string, string> = {
  hackney: "Plonk Hackney",
};

export function generateMetadata({ params }: { params: { venue: string } }) {
  const name = VENUE_NAMES[params.venue];
  return {
    title: name ? `Book ${name} — No Dice` : "Book — No Dice",
    description: "Pick a date, time and party size.",
  };
}

export default function VenueBookingPage({
  params,
}: {
  params: { venue: string };
}) {
  return (
    <Suspense fallback={null}>
      <CatalogueLoader venueSlug={params.venue} />
    </Suspense>
  );
}
