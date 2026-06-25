import AdminPageHeader from "@/components/admin/AdminPageHeader";
import BarReservationsClient from "../bar-reservations/BarReservationsClient";

// Pool table reservations only — split out from the legacy combined
// pool+table page on 2026-06-22 so staff can glance at pool bookings
// without seated-table noise. Seated table bookings live at
// /admin/table-reservations.
export const metadata = { title: "Pool reservations — No Dice Admin" };

export default function PoolReservationsPage() {
  return (
    <>
      <AdminPageHeader
        title="Pool table reservations"
        description="Pool table bookings from /book/pool. Confirm to send the customer their confirmation email; cancel to free the slot. Seated table reservations are on their own page."
        action={
          <a
            href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/book/pool`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            View bookings page ↗
          </a>
        }
      />
      <BarReservationsClient kindFilter="pool" />
    </>
  );
}
