import RedirectToBook from "@/components/RedirectToBook";

// 2026-07-23: World Cup page archived per founder direction.
// The full match-listing + booking flow (previous 64-line implementation
// with MatchSchedule + hero + CTA) is preserved in git history — see
// commits before this change for the last live version.
//
// To bring the page back:
//   1. `git log --oneline app/(public)/worldcup/page.tsx` — find the last
//      non-redirect commit
//   2. `git show <sha>:app/(public)/worldcup/page.tsx` — copy it out
//   3. Restore the file, un-archive the "World Cup | /worldcup" line in
//      components/Header.tsx FALLBACK_NAV, add "worldcup" back to the
//      HeroBookingWidget picker (components/HeroBookingWidget.tsx),
//      restore the sitemap entry, and update the header.nav CMS row.
//
// Any /worldcup URL (stale bookmark or Google index result) now bounces
// to /book so nobody hits a dead end.
export const metadata = {
  title: "Bookings — No Dice",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ArchivedWorldCupPage() {
  return <RedirectToBook />;
}
