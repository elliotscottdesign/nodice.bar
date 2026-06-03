import { Suspense } from "react";
import CatalogueLoader from "./CatalogueLoader";

export function generateStaticParams() {
  return [{ venue: "hackney" }, { venue: "borough" }];
}

const VENUE_NAMES: Record<string, string> = {
  hackney: "Plonk Hackney",
  borough: "Plonk Borough Market",
};

export function generateMetadata({ params }: { params: { venue: string } }) {
  const name = VENUE_NAMES[params.venue];
  return {
    title: name ? `Book ${name}` : "Book Plonk",
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
