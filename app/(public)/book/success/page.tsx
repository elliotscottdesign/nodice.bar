import RedirectToBook from "@/components/RedirectToBook";

// Legacy success/confirmation page from the Plonk Golf basket flow.
// The Tables and Pool flows show inline confirmation after a
// successful createBarReservation — they never navigate here. Stale
// /book/success URLs (e.g. an old payment receipt link) now redirect
// to /book. SuccessClient.tsx is left in place for future revival.
export const metadata = {
  title: "Book — No Dice",
};

export default function SuccessPage() {
  return <RedirectToBook />;
}
