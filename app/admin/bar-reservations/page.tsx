import AdminPageHeader from "@/components/admin/AdminPageHeader";
import BarReservationsClient from "./BarReservationsClient";

export const metadata = { title: "Reservations — No Dice Admin" };

export default function BarReservationsPage() {
  return (
    <>
      <AdminPageHeader
        title="Pool + Table reservations"
        description="Pending reservations from /book/pool and /book/table. Confirm to send the customer a confirmation email; cancel to free the slot."
        action={
          <a
            href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/book`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            View bookings page ↗
          </a>
        }
      />
      <BarReservationsClient />
    </>
  );
}
