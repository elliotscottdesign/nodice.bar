import RedirectToPool from "@/components/RedirectToPool";

// Legacy success page from the previous redirect-to-Stripe flow.
// Inline embedded checkout fires its own onComplete callback now, so
// no customer ever lands here from a fresh booking. Kept as a
// redirect for stale email links.
export const metadata = {
  title: "Tournament sign-up — No Dice",
};

export default function TournamentSuccessPage() {
  return <RedirectToPool />;
}
