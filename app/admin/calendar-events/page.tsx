import AdminPageHeader from "@/components/admin/AdminPageHeader";
import CalendarEventsAdminClient from "./CalendarEventsAdminClient";

export const metadata = { title: "Calendar events — No Dice Admin" };

export default function CalendarEventsAdminPage() {
  return (
    <>
      <AdminPageHeader
        title="Calendar events"
        description="Every event on the /events calendar — including DJ nights fed automatically from the DJ booking system (marked with a 'DJ Feed' badge). Add or edit an event with a date, artwork, title, body, link and a Type/category. Every event has an editable category; DJ nights default to 'DJ Night' but you can change it here (their other details are managed in DJ Bookings). Note: if a DJ night is rescheduled in DJ Bookings, its category resets to 'DJ Night'."
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
      <CalendarEventsAdminClient />
    </>
  );
}
