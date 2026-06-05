import AdminPageHeader from "@/components/admin/AdminPageHeader";
import BarReservationsClient from "./BarReservationsClient";

export const metadata = { title: "Reservations — No Dice Admin" };

export default function BarReservationsPage() {
  return (
    <>
      <AdminPageHeader
        title="Pool + Table reservations"
        description="Pending reservations from /book/pool and /book/table. Confirm to send the customer a confirmation email; cancel to free the slot."
      />
      <BarReservationsClient />
    </>
  );
}
