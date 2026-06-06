import AdminPageHeader from "@/components/admin/AdminPageHeader";
import CalendarEventsAdminClient from "./CalendarEventsAdminClient";

export const metadata = { title: "Calendar events — No Dice Admin" };

export default function CalendarEventsAdminPage() {
  return (
    <>
      <AdminPageHeader
        title="Calendar events"
        description="Every poster shown on the /events calendar. Add a new event with a date, artwork, title, optional body and optional link. Multiple events per day are stacked in the calendar cell in the order they were added."
        action={
          <a
            href="/events"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            View calendar ↗
          </a>
        }
      />
      <CalendarEventsAdminClient />
    </>
  );
}
