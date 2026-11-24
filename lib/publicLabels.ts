// ─────────────────────────────────────────────────────────────────────────
// PUBLIC-FACING LABELS — single source of truth for customer-visible wording.
//
// Currently set to "DJ" (reverted Nov 2026 at the founder's request).
//
// Background: a Nov 2026 Hackney Council compliance note flagged that the
// premises licence (109311) covers alcohol + BACKGROUND music only — not
// regulated entertainment — so a cautious rename hid "DJ" from all public
// copy, calling them "Listening Sessions" instead. That has now been flipped
// back to "DJ" by founder decision. The machinery is kept so it's still a
// one-file switch either way. INTERNALLY everything always stayed "DJ" (the
// /dj routes, the dj_night DB category, the /ops DJ portal, rota labels,
// edge-function names, variables) — only the customer-visible STRINGS flip.
//
// ░░ TO HIDE "DJ" AGAIN (one day, one edit) ░░
//   1. CODE: swap each value below to the commented "Listening" alternate.
//      Every public code surface reads from here, so that one edit flips them
//      all. (Also restore the hardcoded nav fallback in components/Header.tsx.)
//   2. CMS: the 6 most prominent strings (hero, nav, /events title + intro,
//      venue intro, venues blurb) live in the `page_content` Supabase table,
//      not in code. Run the FORWARD block in scripts/dj-public-rename.sql to
//      swap them. (They are also editable in the inline CMS editor.)
// ─────────────────────────────────────────────────────────────────────────

// The public term, in every grammatical / sizing form a surface needs.
// The commented "Listening" value on each line is the hide-DJ alternate.
export const DJ_PUBLIC = {
  // Event sense — the night / the act.
  singular: "DJ", //                           hide-DJ: "Listening Session"
  plural: "DJs", //                            hide-DJ: "Listening Sessions"

  // Short ALL-CAPS label for tiny category chips / card pills, where a long
  // label would overflow a small card (keeps parity with POOL / FOOD / DEAL).
  chipShort: "DJ", //                          hide-DJ: "LISTENING"

  // Full card / rail-group label (has room for two words, like "Special Event").
  cardLabel: "DJ Night", //                    hide-DJ: "Listening Session"

  // Bespoke public phrasings where a literal swap would read wrong (person /
  // equipment / recruitment sense). Centralised here so a flip is still this
  // one file.
  recruitEyebrow: "DJs in training", //        hide-DJ: "New to the decks"
  recruitProfile: "Set up a DJ profile", //    hide-DJ: "Set up an artist profile"
  recruitCta: "Become a No Dice DJ", //        hide-DJ: "Join the No Dice line-up"
  boothLabel: "Full DJ booth", //              hide-DJ: "Full music booth"
  boothBring: "bring your own DJ or plug in a playlist", // hide-DJ: "bring someone to play or plug in a playlist"
  performerName: "DJ name", //                 hide-DJ: "Artist name"
  weddingMusic: "Two DJs across the evening", // hide-DJ: "Music across the evening"
} as const;

// Map an internal chip/category KEY to its public short display label.
// Keys stay "DJ" everywhere in logic; only the rendered text changes.
export function chipDisplay(chip: string | null | undefined): string {
  if (!chip) return "";
  return chip === "DJ" ? DJ_PUBLIC.chipShort : chip;
}
