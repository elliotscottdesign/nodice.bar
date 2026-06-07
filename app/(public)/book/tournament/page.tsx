import RedirectToPool from "@/components/RedirectToPool";

// The standalone tournament sign-up page is retired — the entire
// journey (pick date → fill team details → pay) now happens inline
// on /pool. We keep this route file so any stale bookmark redirects
// gracefully instead of 404-ing.
export const metadata = {
  title: "Tournament sign-up — No Dice",
};

export default function TournamentBookingPage() {
  return <RedirectToPool />;
}
