import AdminPageHeader from "@/components/admin/AdminPageHeader";
import EventsAdminHub from "./EventsAdminHub";

export const metadata = { title: "Events — No Dice Admin" };

// Note: server-side `searchParams` can't be used in a static export
// (Next.js bails out of prerender). The hub reads ?tab=posters from
// window.location.search on mount instead — same effect, no bail-out.
export default function EventsAdminPage() {
  return (
    <>
      <AdminPageHeader
        title="Events"
        description="Two tabs: ticketed events (customers book/pay) and calendar posters (artwork on /events). Everything event-shaped in one place."
        action={
          <a
            href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/events`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            View calendar ↗
          </a>
        }
      />
      <EventsAdminHub />
    </>
  );
}
