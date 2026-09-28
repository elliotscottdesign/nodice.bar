import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import DayCalendarClient from "./DayCalendarClient";

export const metadata = { title: "Booking Calendar — No Dice Admin" };

// The booking list pages this calendar aggregates — surfaced as
// header links so there's always a clear way back OUT of the calendar
// into each list view (founder 28 Sep 2026), and so every booking area
// cross-links to the others.
const LIST_LINKS: { href: string; label: string }[] = [
  { href: "/admin/table-reservations", label: "Tables" },
  { href: "/admin/pool-reservations", label: "Pool" },
  { href: "/admin/bookings", label: "Golf" },
  { href: "/admin/tournament-entries", label: "Tournaments" },
];

// Unified booking calendar — one month grid with a heatmap of busyness
// across pool, tables, World Cup match holds, and golf. Click a day to
// see every booking on that date and add new ones inline. Capacities
// are the founder-set hard limits (bar 70 people, golf 54 people).
export default function CalendarPage() {
  return (
    <>
      <AdminPageHeader
        title="Booking Calendar"
        description="Heatmap of how busy each day looks across pool, tables, World Cup, and golf. Click a day to see every booking — and add one."
        action={
          <div className="flex flex-wrap gap-2">
            {LIST_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 transition hover:border-cream/40 hover:bg-cream/5"
              >
                {l.label} list
              </Link>
            ))}
          </div>
        }
      />
      <DayCalendarClient />
    </>
  );
}
