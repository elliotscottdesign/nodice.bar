import RedirectToPool from "@/components/RedirectToPool";

// Legacy cancellation page from the redirect-to-Stripe era. Embedded
// Stripe Checkout handles cancellation inline (the customer closes
// the iframe or starts fresh), so no fresh booking lands here.
export const metadata = {
  title: "Tournament sign-up — No Dice",
};

export default function TournamentCancelledPage() {
  return <RedirectToPool />;
}
