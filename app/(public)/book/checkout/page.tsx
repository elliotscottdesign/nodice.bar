import RedirectToBook from "@/components/RedirectToBook";

// Legacy basket-style checkout from the Plonk Golf fork. The Tables
// and Pool flows persist directly via createBarReservation (no
// basket, no payment step), so this route is orphaned. Redirect to
// /book in case anyone hits a stale link. CheckoutClient.tsx still
// lives next to this file in case we want to revive the flow later.
export const metadata = {
  title: "Book — No Dice",
};

export default function CheckoutPage() {
  return <RedirectToBook />;
}
