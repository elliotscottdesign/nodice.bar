import AdminPageHeader from "@/components/admin/AdminPageHeader";
import DayCalendarClient from "./DayCalendarClient";

export const metadata = { title: "Booking Calendar — No Dice Admin" };

// Unified booking calendar — one month grid with a heatmap of busyness
// across pool, tables, World Cup match holds, and golf. Click a day to
// see every booking on that date. Capacities are the founder-set
// hard limits (bar 70 people, golf 54 people) used to colour each
// cell relative to how full the venue will get.
export default function CalendarPage() {
  return (
    <>
      <AdminPageHeader
        title="Booking Calendar"
        description="Heatmap of how busy each day looks across pool, tables, World Cup, and golf. Click a day to expand every booking."
      />
      <DayCalendarClient />
    </>
  );
}
