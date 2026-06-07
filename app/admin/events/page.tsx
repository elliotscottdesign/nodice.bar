import AdminPageHeader from "@/components/admin/AdminPageHeader";
import EventsAdminClient from "./EventsAdminClient";

export const metadata = { title: "Events — No Dice Admin" };

export default function EventsAdminPage() {
  return (
    <>
      <AdminPageHeader
        title="Events"
        description="Create any event with one form — pool tournaments, DJ nights, food specials. Pick a category and which pages it should appear on; tickets auto-wire to the public booking flow."
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
      <EventsAdminClient />
    </>
  );
}
