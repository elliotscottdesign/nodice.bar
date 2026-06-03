// =============================================================
// Plonk Golf — image spec registry
// =============================================================
// Single source of truth for the recommended dimensions, file size
// and aspect ratio of every image that gets uploaded through the
// admin. Drives the "Recommended: …" captions shown next to every
// image upload field plus the gallery editor, and mirrored in
// docs/IMAGE_GUIDE.md for humans.
//
// MASTER RULE — read this before adding a new image location.
// 1. Define the slot somewhere on the public site (page_content row
//    with field_kind='image' OR a new gallery_key in gallery_images).
// 2. ADD A SPEC HERE for that exact key, in the EXPLICIT_SPECS map.
// 3. If you forget step 2, getImageSpec() falls through to a
//    pattern-based default (e.g. anything ending in `.hero_image`
//    gets the hero spec, anything ending in `.gallery` gets the
//    square gallery spec). The admin UI marks these as
//    "auto-inferred" and prints a hint asking the dev to register
//    an explicit spec — so nobody uploads a misshapen file and
//    nobody flies blind, but YES you should still register them
//    properly so users get accurate guidance.
// =============================================================

export type ImageOrientation = "landscape" | "portrait" | "square";

export type ImageSpec = {
  /** Short human label used in admin UI ("Hero image", "Gallery photo", etc.). */
  label: string;
  orientation: ImageOrientation;
  /** Display-friendly ratio, e.g. "3:2" or "4:5". */
  aspectLabel: string;
  /** Tailwind class for previewing this aspect inside the admin. */
  aspectClass: string;
  /** Recommended pixel width to upload. */
  width: number;
  /** Recommended pixel height to upload. */
  height: number;
  /** Soft cap for file size in kilobytes. */
  maxKb: number;
  /** Optional extra guidance shown to the admin (e.g. "needs alpha channel"). */
  notes?: string;
  /** True when this spec was inferred from a pattern, not explicitly registered. */
  inferred?: boolean;
};

// ---------- Reusable shapes ----------
// Defined once so the registry below stays terse and consistent. If
// the design changes (say every hero becomes 16:9), update HERO_SPEC
// once and every hero slot inherits the new size automatically.
const HERO_SPEC: ImageSpec = {
  label: "Hero image",
  orientation: "landscape",
  aspectLabel: "3:2",
  aspectClass: "aspect-[3/2]",
  width: 2400,
  height: 1600,
  maxKb: 300,
};

const PORTRAIT_45_SPEC: ImageSpec = {
  label: "Portrait feature image",
  orientation: "portrait",
  aspectLabel: "4:5",
  aspectClass: "aspect-[4/5]",
  width: 1200,
  height: 1500,
  maxKb: 250,
};

const LANDSCAPE_53_SPEC: ImageSpec = {
  label: "Feature card image",
  orientation: "landscape",
  aspectLabel: "5:3",
  aspectClass: "aspect-[5/3]",
  width: 1000,
  height: 600,
  maxKb: 150,
};

const LANDSCAPE_43_SPEC: ImageSpec = {
  label: "Card image",
  orientation: "landscape",
  aspectLabel: "4:3",
  aspectClass: "aspect-[4/3]",
  width: 1200,
  height: 900,
  maxKb: 200,
};

const SQUARE_SPEC: ImageSpec = {
  label: "Gallery photo",
  orientation: "square",
  aspectLabel: "1:1",
  aspectClass: "aspect-square",
  width: 1200,
  height: 1200,
  maxKb: 200,
};

const POSTER_SPEC: ImageSpec = {
  label: "Event poster",
  orientation: "portrait",
  aspectLabel: "5:7",
  aspectClass: "aspect-[5/7]",
  width: 1000,
  height: 1400,
  maxKb: 200,
};

const FULL_BLEED_SPEC: ImageSpec = {
  label: "Full-bleed background",
  orientation: "landscape",
  aspectLabel: "wide",
  aspectClass: "aspect-[3/2]",
  width: 2400,
  height: 1400,
  maxKb: 300,
};

// ---------- Explicit registry ----------
// Every image location on the site that the admin can edit should
// appear in this map. Keys match page_content.key for single images,
// or gallery_images.gallery_key for galleries.
const EXPLICIT_SPECS: Record<string, ImageSpec> = {
  // ----- Single-image fields (page_content rows where field_kind = 'image') -----
  "home.hero.image": HERO_SPEC,
  "venue.hackney.hero_image": HERO_SPEC,
  "venue.borough.hero_image": HERO_SPEC,
  "privatehire.hackney.image": LANDSCAPE_43_SPEC,
  "privatehire.borough.image": LANDSCAPE_43_SPEC,
  "events.hero_image": HERO_SPEC,
  "deals.hero_image": HERO_SPEC,
  "vouchers.hero_image": HERO_SPEC,
  "privatehire.hero_image": HERO_SPEC,
  "privatehire.hackney.hero_image": HERO_SPEC,
  "privatehire.borough.hero_image": HERO_SPEC,
  "venue.borough.feature1.image": LANDSCAPE_53_SPEC,
  "venue.borough.feature2.image": LANDSCAPE_53_SPEC,
  "venue.borough.feature3.image": LANDSCAPE_53_SPEC,
  "venue.borough.feature4.image": LANDSCAPE_53_SPEC,
  "venue.borough.feature5.image": LANDSCAPE_53_SPEC,
  "venue.borough.feature6.image": LANDSCAPE_53_SPEC,
  "about.hero_image": HERO_SPEC,
  "about.body_image1": LANDSCAPE_43_SPEC,
  "about.body_image2": LANDSCAPE_43_SPEC,
  "header.logo_image": {
    label: "Logo",
    orientation: "landscape",
    aspectLabel: "≈2.5:1",
    aspectClass: "aspect-[5/2]",
    width: 560,
    height: 224,
    maxKb: 60,
    notes: "Transparent PNG works best (the header sits on black).",
  },
  // Hero slider galleries — every entry must be hero-sized landscape.
  "hero.home": HERO_SPEC,
  "hero.venue.hackney": HERO_SPEC,
  "hero.venue.borough": HERO_SPEC,
  "hero.about": HERO_SPEC,
  "hero.contact": HERO_SPEC,
  "hero.events": HERO_SPEC,
  "hero.deals": HERO_SPEC,
  "hero.vouchers": HERO_SPEC,
  "hero.faqs": HERO_SPEC,
  "hero.terms": HERO_SPEC,
  "hero.privacy": HERO_SPEC,
  "hero.privatehire": HERO_SPEC,
  "hero.privatehire.hackney": HERO_SPEC,
  "hero.privatehire.borough": HERO_SPEC,
  "home.press": {
    label: "Press logo",
    orientation: "landscape",
    aspectLabel: "≈2:1",
    aspectClass: "aspect-[2/1]",
    width: 600,
    height: 300,
    maxKb: 40,
    notes:
      "Logos render at 112×40px and are auto-greyscaled. PNG with transparency is ideal; otherwise white-on-transparent or grey-on-transparent gives the best result.",
  },

  // ----- Galleries (gallery_images.gallery_key) -----
  "home.features": LANDSCAPE_53_SPEC,
  "about.gallery": SQUARE_SPEC,
  "venue.hackney.gallery": SQUARE_SPEC,
  "venue.borough.gallery": SQUARE_SPEC,
  "hackney.events": POSTER_SPEC,
};

// ---------- Pattern-based fallback ----------
// Master rule: when a key isn't explicitly registered above, try to
// infer a sensible spec from its name suffix so the admin never shows
// a "no guidance" empty caption. The returned spec is flagged with
// `inferred: true` so the UI can nudge the dev to register it.
function inferFromKey(key: string): ImageSpec | null {
  if (/\.hero_image$|\.hero$|hero\.image$/.test(key)) return HERO_SPEC;
  if (/\.poster$|\.posters$|events?$/.test(key)) return POSTER_SPEC;
  if (/\.features$|\.features\./.test(key)) return LANDSCAPE_53_SPEC;
  if (/\.gallery$|\.gallery\./.test(key)) return SQUARE_SPEC;
  if (/\.background$|\.bg$|.bgimage$/.test(key)) return FULL_BLEED_SPEC;
  if (/\.portrait$|\.portrait\./.test(key)) return PORTRAIT_45_SPEC;
  if (/\.card$|\.cards$|\.thumb$|\.thumbnail$/.test(key)) return LANDSCAPE_43_SPEC;
  return null;
}

// ---------- Public API ----------
/**
 * Look up the recommended upload spec for a given image key.
 * - Returns the explicit spec when one is registered.
 * - Otherwise infers from the key's suffix and marks `inferred: true`.
 * - As a last resort returns a generic hero-sized landscape with a
 *   visible "no spec" note so the user still gets *some* guidance.
 */
export function getImageSpec(key: string): ImageSpec {
  if (EXPLICIT_SPECS[key]) return EXPLICIT_SPECS[key];
  const inferred = inferFromKey(key);
  if (inferred) {
    return {
      ...inferred,
      inferred: true,
      notes:
        (inferred.notes ? inferred.notes + " " : "") +
        `(Auto-inferred from key "${key}". Register an explicit spec in lib/imageSpecs.ts.)`,
    };
  }
  return {
    ...HERO_SPEC,
    label: "Image",
    inferred: true,
    notes: `No spec registered for "${key}" yet. Using a generic landscape default — ask the developer to add an explicit spec in lib/imageSpecs.ts so this caption is accurate.`,
  };
}

/**
 * One-line caption shown next to each image upload field in the admin.
 * Looks like: "Recommended: 2400×1600px landscape (3:2), JPEG under 300KB."
 */
export function specCaption(spec: ImageSpec): string {
  return `Recommended: ${spec.width.toLocaleString()}×${spec.height.toLocaleString()}px ${spec.orientation} (${spec.aspectLabel}), JPEG under ${spec.maxKb}KB.`;
}

/**
 * Convenience: caption directly from a key.
 */
export function captionForKey(key: string): string {
  return specCaption(getImageSpec(key));
}

/**
 * For docs/dev tooling: the full list of explicitly-registered image keys.
 * If a page_content row has field_kind='image' and its key isn't in here,
 * the admin will fall back to inferFromKey() — works but worth fixing.
 */
export function listRegisteredKeys(): string[] {
  return Object.keys(EXPLICIT_SPECS).sort();
}
