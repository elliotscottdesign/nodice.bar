import { Suspense } from "react";
import OnARollClient from "./OnARollClient";

// On A Roll — customer self-order + pay page (nodice.bar/onaroll). Standalone
// (outside the (public) layout, so no No Dice header/footer) — a customer scans
// the QR at the truck and lands straight on the diner-styled order page. Pays via
// Stripe (same setup as reservations), order hits the kitchen screen, they get a
// text when it's ready.
export const metadata = {
  title: "On A Roll — Order",
  description:
    "Order On A Roll at No Dice, London Fields. Pay on your phone, we'll text you the second it's ready. No queue.",
};

export default function Page() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#fdf2e0" }} />}>
      <OnARollClient />
    </Suspense>
  );
}
