import { Suspense } from "react";
import CatalogueLoader from "./CatalogueLoader";

// Single-venue site — borough removed from static params so /book/borough
// no longer renders as a static page. Restore the second entry to bring
// Borough back.
export function generateStaticParams() {
  return [{ venue: "hackney" }];
}

const VENUE_NAMES: Record<string, string> = {
  hackney: "No Dice",
};

export function generateMetadata({ params }: { params: { venue: string } }) {
  const name = VENUE_NAMES[params.venue];
  return {
    title: name ? `Book ${name}` : "Book No Dice",
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
