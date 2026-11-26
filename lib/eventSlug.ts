// =============================================================
// Event short links — nodice.bar/<nameofevent> (founder, 26 Nov 2026)
// =============================================================
// "This URL is unshareable — all pop up windows or pages should generate
// /nameofevent, so /paperchristmas." Every event's short link is just its
// name, lower-case, letters and numbers only:
//   "PAPER CHRISTMAS"  → /paperchristmas
//   "Martini & Fries"  → /martiniandfries
// A repeating event (CUE, Pingers, Happy Hour…) shares one name, so its short
// link always opens the NEXT date it's on.
//
// How it works on a static site (no server to look the name up):
//   • at build, scripts/event-short-links.mjs writes a real page per upcoming
//     event (out/paperchristmas/index.html) with that event's title + poster in
//     the link-preview tags, so WhatsApp / iMessage previews look right;
//   • an event added since the last build still works: GitHub Pages serves the
//     site's 404 page for any unknown path, and app/not-found.tsx looks the
//     name up and shows the event there instead;
//   • the old /event?o=<id> links keep working and quietly swap the address
//     bar to the short link once the event has loaded.
// A real page with the same name always wins (an event called "Bingo" can't
// take /bingo), so those events keep their /event?o= link.
// =============================================================

export function eventSlug(name: string | null | undefined): string {
  return String(name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

// Top-level paths the site already uses. Keep in step with app/ and public/
// (the build script also checks the real out/ folder, so this list only drives
// the "share link" shown in the admin and the client-side lookup).
export const RESERVED_PATHS = new Set<string>([
  "about", "bar", "bingo", "book", "comedybingo", "contact", "deals", "event",
  "events", "faqs", "kevinandtara", "league", "macmillan", "minigolf",
  "myevent", "opendecks", "parties", "partyenquiry", "pingpong", "plonk",
  "pool", "privacy", "privatehire", "promoter", "snackbar", "terms", "venue",
  "voucher", "vouchers", "xmas", "admin", "bingolive", "kiosk", "onaroll",
  "ready", "docs", "fonts", "images", "next", "404", "index", "sitemap",
  "robots",
]);

/** The short path for an event name, or null when the name is empty or
 *  clashes with a real page. */
export function shortPathFor(name: string | null | undefined): string | null {
  const s = eventSlug(name);
  if (!s || RESERVED_PATHS.has(s)) return null;
  return `/${s}/`;
}
