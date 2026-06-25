import AdminPageHeader from "@/components/admin/AdminPageHeader";
import BarReservationsClient from "../bar-reservations/BarReservationsClient";

// Table reservations only — split out from the legacy combined
// pool+table page on 2026-06-22 so staff can glance at the seated
// tables for a shift without pool noise. Pool table bookings live at
// /admin/pool-reservations.
export const metadata = { title: "Table reservations — No Dice Admin" };

export default function TableReservationsPage() {
  return (
    <>
      <AdminPageHeader
        title="Table reservations"
        description="Seated table bookings from /book/table. Confirm to send the customer their confirmation email; cancel to free the slot. Pool bookings are on their own page."
        action={
          <a
            href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/book/table`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            View bookings page ↗
          </a>
        }
      />
      <BarReservationsClient kindFilter="table" />
    </>
  );
}
