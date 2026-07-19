import { Suspense } from "react";
import CheckoutClient from "./CheckoutClient";

// /book/checkout — Stripe Payment Element basket for mini-golf bookings.
// Reactivated 2026-07-19 alongside /book/hackney: customers land here
// from BookingFlow with venue/date/slot/ticket params in the URL, we
// call create-payment-intent, they pay, then get-booking confirms.
//
// Tables (/book/table) and Pool (/book/pool) do NOT use this route —
// they persist via createBarReservation directly. This basket-style
// flow is exclusive to golf tickets while the standalone
// plonkgolf.co.uk site is still being finished.

export const metadata = {
  title: "Checkout — No Dice",
  description: "Confirm your Plonk Hackney booking.",
};

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutClient />
    </Suspense>
  );
}
