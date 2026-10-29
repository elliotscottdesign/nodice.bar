// How a poster was built — everything the poster maker needs to reopen an
// event's poster for editing, and everything the download panel needs to
// re-make it at another size so the post, the story and the A3 all match.
//
// Stored as one jsonb cell on the event (events.poster_recipe) rather than a
// column per control, so adding a new dial later needs no migration. It also
// carries EVERY photo in a grid, which the single poster_image_url column
// can't — that only ever round-tripped the first one.

import type { PosterTreatment } from "@/lib/poster/engine";

export type RecipePhoto = {
  /** Storage URL of the source photo (never an upload's temporary blob URL). */
  sourceUrl: string;
  exposure?: number;
  /** Crop position inside the frame, 0–1 each, and zoom (1 = fill). */
  ox?: number;
  oy?: number;
  zoom?: number;
  /** Words printed under this photo (act / DJ / dish name). */
  caption?: string;
};

export type PosterRecipe = {
  /** Ink colour, e.g. "#FF006A". */
  colour?: string;
  treatment?: PosterTreatment;
  /** Headline size dial; the engine clamps it, 1 = standard. */
  titleSize?: number;
  /** The short line under the headline. */
  detail?: string;
  /** Price wording as typed. */
  price?: string;
  photos?: RecipePhoto[];
  /** Deal-only extras. */
  textBox?: boolean;
  footer?: string;
  dayLabel?: string;
  qr?: string;
};

const num = (v: unknown, lo: number, hi: number): number | undefined => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : undefined;
};
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v : undefined;

/**
 * Read a stored recipe back, dropping anything malformed. The value comes out
 * of the database, so it's treated as untrusted input rather than assumed to
 * match whatever shape the app last wrote.
 */
export function parseRecipe(
  raw: Record<string, unknown> | null | undefined,
): PosterRecipe {
  if (!raw || typeof raw !== "object") return {};
  const t = raw.treatment;
  const photos = Array.isArray(raw.photos)
    ? raw.photos
        .map((p): RecipePhoto | null => {
          if (!p || typeof p !== "object") return null;
          const o = p as Record<string, unknown>;
          const sourceUrl = str(o.sourceUrl);
          if (!sourceUrl) return null; // nothing to draw from — drop it
          return {
            sourceUrl,
            exposure: num(o.exposure, 0.1, 3),
            ox: num(o.ox, 0, 1),
            oy: num(o.oy, 0, 1),
            zoom: num(o.zoom, 1, 5),
            caption: str(o.caption),
          };
        })
        .filter((p): p is RecipePhoto => p !== null)
    : undefined;
  return {
    colour: str(raw.colour),
    treatment:
      t === "scatter" || t === "natural" || t === "whites" ? t : undefined,
    titleSize: num(raw.titleSize, 0.5, 2),
    detail: str(raw.detail),
    price: str(raw.price),
    photos: photos && photos.length ? photos : undefined,
    textBox: typeof raw.textBox === "boolean" ? raw.textBox : undefined,
    footer: str(raw.footer),
    dayLabel: str(raw.dayLabel),
    qr: str(raw.qr),
  };
}
