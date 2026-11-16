// ─────────────────────────────────────────────────────────────────────────
// PUBLIC-FACING LABELS — single source of truth for customer-visible wording.
//
// TEMPORARY council-compliance rename (Nov 2026).
// Hackney Council's premises licence (109311) covers alcohol + BACKGROUND
// music only — not regulated entertainment — so NOTHING a customer or a
// licensing officer can see may advertise "DJ" / "DJs" / "DJ night".
// Publicly we call them "Listening Sessions". INTERNALLY everything stays
// "DJ": the /dj routes, the dj_night DB category, the /ops DJ portal, rota
// labels, edge-function names, variables — none of that changes. Only the
// customer-visible STRINGS below do.
//
// ░░ TO REVERT TO "DJ" (one day, one edit) ░░
//   1. CODE: restore the `DJ` column values in DJ_PUBLIC below. Every public
//      code surface reads from here, so that one edit flips them all back.
//   2. CMS: the 6 most prominent strings (hero, nav, /events title + intro,
//      venue intro, venues blurb) live in the `page_content` Supabase table,
//      not in code. Run the REVERT block in scripts/dj-public-rename.sql to
//      put "DJ" back there. (They are also editable in the inline CMS editor.)
// ─────────────────────────────────────────────────────────────────────────

// The public term, in every grammatical / sizing form a surface needs.
// The commented "was" value on each line is the original "DJ" wording — the
// revert target.
export const DJ_PUBLIC = {
  // Event sense — the night / the act.
  singular: "Listening Session", //            was: "DJ"
  plural: "Listening Sessions", //             was: "DJs"

  // Short ALL-CAPS label for tiny category chips / card pills, where a long
  // label would overflow a small card (keeps parity with POOL / FOOD / DEAL).
  chipShort: "LISTENING", //                   was: "DJ"

  // Full card / rail-group label (has room for two words, like "Special Event").
  cardLabel: "Listening Session", //           was: "DJ Night"

  // Bespoke public phrasings where a literal "Listening Session" swap would
  // read wrong (person / equipment / recruitment sense). Centralised here so a
  // revert is still this one file.
  recruitEyebrow: "New to the decks", //       was: "DJs in training"
  recruitProfile: "Set up an artist profile", // was: "Set up a DJ profile"
  recruitCta: "Join the No Dice line-up", //   was: "Become a No Dice DJ"
  boothLabel: "Full music booth", //           was: "Full DJ booth"
  boothBring: "bring someone to play or plug in a playlist", // was: "bring your own DJ or plug in a playlist"
  performerName: "Artist name", //             was: "DJ name"
  weddingMusic: "Music across the evening", // was: "Two DJs across the evening"
} as const;

// Map an internal chip/category KEY to its public short display label.
// Keys stay "DJ" everywhere in logic; only the rendered text changes.
export function chipDisplay(chip: string | null | undefined): string {
  if (!chip) return "";
  return chip === "DJ" ? DJ_PUBLIC.chipShort : chip;
}
