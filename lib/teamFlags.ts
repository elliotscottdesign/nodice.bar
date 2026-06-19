// =============================================================
// teamFlags — country → flag emoji lookup for match cards.
// =============================================================
// Splits the burden of "did the founder remember to type a flag?"
// off the admin. When an event name is stored as "England vs Italy"
// (no flags), splitMatchTitle calls flagForTeam("England") → 🏴󠁧󠁢󠁥󠁮󠁧󠁿
// and the card renders with flags on both sides of "vs".
//
// Covers all 48 qualified nations for the 2026 FIFA World Cup, plus
// the most common aliases (USA / United States, Czechia / Czech
// Republic, Türkiye / Turkey, Ivory Coast / Côte d'Ivoire, Bosnia /
// Bosnia & Herzegovina, etc.) so common typing variations still match.
//
// Standard country codes use the regional-indicator letter pair
// (🇬🇧). The Home Nations (England / Scotland / Wales) use ISO
// 3166-2:GB tag sequences instead, which is what most platforms now
// render as the actual cross-of-St-George / saltire / dragon flags.
// =============================================================

// Build a regional-indicator flag from a 2-letter country code.
function flag2(code: string): string {
  const A = 0x1f1e6; // REGIONAL INDICATOR SYMBOL LETTER A
  const upper = code.toUpperCase();
  return String.fromCodePoint(A + upper.charCodeAt(0) - 65, A + upper.charCodeAt(1) - 65);
}

// Subdivision flags via ISO 3166-2 tag sequences.
const ENGLAND = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
const SCOTLAND = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";
const WALES = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}";

// Normalise: lowercase, strip accents, strip trailing/leading
// punctuation, collapse spaces. Lets "Côte d'Ivoire" match "cote
// divoire" or "ivory coast".
function normalise(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")     // strip diacritics
    .replace(/[^a-z0-9 ]+/g, " ")        // strip apostrophes, hyphens, etc.
    .replace(/\s+/g, " ")
    .trim();
}

// Map of normalised name → flag. Includes every 2026 World Cup
// qualifier plus aliases for the awkward ones. Add more aliases as
// needed; if a name fails to match here it just renders flagless,
// which is fine.
const FLAGS: Record<string, string> = {
  // Group stage nations (alphabetical, with common aliases)
  argentina: flag2("AR"),
  australia: flag2("AU"),
  belgium: flag2("BE"),
  "bosnia herzegovina": flag2("BA"),
  "bosnia and herzegovina": flag2("BA"),
  bosnia: flag2("BA"),
  brazil: flag2("BR"),
  cameroon: flag2("CM"),
  canada: flag2("CA"),
  "cape verde": flag2("CV"),
  "cabo verde": flag2("CV"),
  chile: flag2("CL"),
  colombia: flag2("CO"),
  "costa rica": flag2("CR"),
  "cote divoire": flag2("CI"),
  "ivory coast": flag2("CI"),
  croatia: flag2("HR"),
  curacao: flag2("CW"),
  czechia: flag2("CZ"),
  "czech republic": flag2("CZ"),
  denmark: flag2("DK"),
  ecuador: flag2("EC"),
  egypt: flag2("EG"),
  england: ENGLAND,
  france: flag2("FR"),
  germany: flag2("DE"),
  ghana: flag2("GH"),
  greece: flag2("GR"),
  haiti: flag2("HT"),
  iran: flag2("IR"),
  iraq: flag2("IQ"),
  italy: flag2("IT"),
  japan: flag2("JP"),
  jordan: flag2("JO"),
  mexico: flag2("MX"),
  morocco: flag2("MA"),
  netherlands: flag2("NL"),
  holland: flag2("NL"),
  "new zealand": flag2("NZ"),
  nigeria: flag2("NG"),
  "north macedonia": flag2("MK"),
  macedonia: flag2("MK"),
  norway: flag2("NO"),
  panama: flag2("PA"),
  paraguay: flag2("PY"),
  peru: flag2("PE"),
  poland: flag2("PL"),
  portugal: flag2("PT"),
  qatar: flag2("QA"),
  "saudi arabia": flag2("SA"),
  scotland: SCOTLAND,
  senegal: flag2("SN"),
  serbia: flag2("RS"),
  slovakia: flag2("SK"),
  "south africa": flag2("ZA"),
  "south korea": flag2("KR"),
  "republic of korea": flag2("KR"),
  korea: flag2("KR"),
  spain: flag2("ES"),
  sweden: flag2("SE"),
  switzerland: flag2("CH"),
  turkiye: flag2("TR"),
  turkey: flag2("TR"),
  tunisia: flag2("TN"),
  ukraine: flag2("UA"),
  "united states": flag2("US"),
  usa: flag2("US"),
  "united states of america": flag2("US"),
  america: flag2("US"),
  uruguay: flag2("UY"),
  wales: WALES,
};

// Lookup a flag for a free-text team name. Returns "" if no match.
// Order of attempts:
//   1. exact normalised match ("South Africa" → flag)
//   2. trailing-noise stripping ("England (projected)" → "england")
//   3. final-word match ("Team Brazil" → "brazil")
export function flagForTeam(rawName: string): string {
  if (!rawName) return "";
  const clean = normalise(rawName);
  if (FLAGS[clean]) return FLAGS[clean];
  // Strip parenthetical / dash suffixes like "England (projected)".
  const stripped = clean
    .replace(/\b(projected|tbc|tbd)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped && FLAGS[stripped]) return FLAGS[stripped];
  // Last token (helps "Team Brazil" or "AC Brazil").
  const lastWord = stripped.split(" ").pop() ?? "";
  if (lastWord && FLAGS[lastWord]) return FLAGS[lastWord];
  return "";
}

// Detect if a string already contains an emoji flag (so we don't
// double-prefix when the founder typed one manually).
const FLAG_RE = /\p{Regional_Indicator}{2}|\u{1F3F4}[\u{E0020}-\u{E007F}]+/u;
export function hasFlagAlready(s: string): boolean {
  return FLAG_RE.test(s);
}
