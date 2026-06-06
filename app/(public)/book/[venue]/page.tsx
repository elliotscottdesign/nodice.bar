import RedirectToBook from "@/components/RedirectToBook";

// Legacy Plonk-Golf venue catalogue page (used to render BookingFlow
// for a per-venue golf ticket basket: "BOOK PLONK HACKNEY", date /
// time / tickets / basket / checkout). Golf bookings now live
// externally at plonkgolf.co.uk (linked from the Golf card on /book);
// Tables and Pool have their own dedicated dedicated pages
// (/book/table and /book/pool). This URL no longer has a purpose on
// the No Dice site — redirect to /book so any stale bookmark or
// Google result lands somewhere useful instead of a confusing
// half-Plonk-half-No-Dice page.
//
// Kept generateStaticParams so the route is still pre-rendered at
// build time (static export). When the founder is comfortable, the
// whole [venue] folder, CatalogueLoader and BookingFlow can be
// deleted outright.
export function generateStaticParams() {
  return [{ venue: "hackney" }];
}

export const metadata = {
  title: "Book — No Dice",
  description: "Pick a date, time and party size.",
};

export default function VenueBookingPage() {
  return <RedirectToBook />;
}
