"use client";

// =============================================================
// Headless poster REBUILD — keep a saved poster in step with its event.
// =============================================================
// A poster is a baked PNG stored at events.poster_url: the headline (the event
// name), the sub-copy, the price and the date/time are drawn INTO the picture
// when it's made. So renaming an event, or moving its date, updates the row but
// NOT the picture — the poster goes stale (e.g. a comp renamed to "12hr POOL
// MARATHON" still showed "12HR SINGLES COMP" on the artwork).
//
// Every poster the maker builds now records its recipe in events.poster_recipe
// (the photos with their crops, the colour, the treatment, the title size and
// the wording). That's everything needed to draw the poster again — EXCEPT the
// event's own name / date / time, which we take live from the event. So after
// an edit we can re-render the exact same poster with the new wording baked in.
//
// This reuses the SAME engine the maker uses (lib/poster/engine.ts
// renderEventPoster) and the SAME upload path (lib/db/media.ts uploadImage, so
// the picture is compressed WebP and served through the wsrv CDN — the Nov-3
// egress fix is not regressed). It is deliberately NOT part of EventPosterStudio
// so the maker's UI is untouched; the admin save handlers call this directly.
//
// Safety: if anything fails (a photo won't load, the canvas won't draw) it
// throws, and the caller is expected to save the event anyway and surface the
// message — a failed rebuild must never block a save or blank a live poster.
// Posters with no recipe (plain uploaded artwork, or made before the recipe
// existed) can't be rebuilt — rebuildPosterFromRecipe returns null and the
// editor shows a "may be out of date" nudge instead.
// =============================================================

import {
  canvasToBlob,
  DEAL_PALETTE,
  loadImage,
  PALETTE,
  posterName,
  renderEventPoster,
  type PosterSize,
} from "@/lib/poster/engine";
import { parseRecipe } from "@/components/admin/posterRecipe";
import { uploadImage } from "@/lib/db/media";

/** The event's own fields — taken LIVE so a rename / date move flows onto the
 *  picture. The copy fields (detail/price/footer/dayLabel) are optional
 *  overrides: pass the event's current value to let a DB correction flow
 *  through, or leave undefined to fall back to the wording stored in the recipe. */
export type PosterRebuildFields = {
  name: string;
  /** YYYY-MM-DD. */
  date: string;
  start?: string | null;
  end?: string | null;
  /** A drinks deal — page-shaped poster, deal layout. */
  isDeal?: boolean;
  /** Also render + upload the print-ready negative flyer (deals / specials that
   *  store flyer_poster_url). */
  exportFlyer?: boolean;
  /** The line under the headline (events store this as poster_subcopy). Pass ""
   *  to force no line; undefined falls back to the recipe's detail. */
  detail?: string | null;
  /** Price wording, e.g. "£10". undefined falls back to the recipe's price. */
  price?: string | null;
  /** Deal bottom line. undefined falls back to the recipe. */
  footer?: string | null;
  /** Deal day label, e.g. "TUESDAYS". undefined falls back to the recipe. */
  dayLabel?: string | null;
};

export type PosterRebuildResult = {
  poster_url: string;
  /** Only when exportFlyer was set and a flyer was rendered. */
  flyer_poster_url?: string | null;
};

/** Can this recipe be redrawn? True when it carries at least one photo, or it's
 *  a deal text-box poster (no photo, the info fills the frame). A null / empty
 *  recipe (older posters, plain uploaded artwork) can't — the caller nudges. */
export function recipeIsRebuildable(
  rawRecipe: Record<string, unknown> | null | undefined,
  isDeal = false,
): boolean {
  const r = parseRecipe(rawRecipe);
  return !!r.photos?.length || (isDeal && r.textBox === true);
}

// First value that isn't undefined (null is a deliberate "use empty"), else "".
function prefer(override: string | null | undefined, stored: string | undefined): string {
  if (override !== undefined) return override ?? "";
  return stored ?? "";
}

/**
 * Draw an event's poster(s) from its stored recipe + the event's CURRENT fields,
 * WITHOUT uploading anything. Returns the rendered canvases (the colour online
 * poster, plus the negative print flyer when exportFlyer is set), or null when
 * there's no rebuildable recipe. This is the shared mapping both the live
 * rebuild (below) and the verification harness use, so they can't drift apart.
 * Throws if a photo won't load or the poster won't draw.
 */
export async function drawPosterFromRecipe(
  fields: PosterRebuildFields,
  rawRecipe: Record<string, unknown> | null | undefined,
): Promise<{ colour: HTMLCanvasElement; flyer?: HTMLCanvasElement } | null> {
  const recipe = parseRecipe(rawRecipe);
  const isDeal = fields.isDeal === true;
  const hasPhotos = !!recipe.photos?.length;
  const textBox = isDeal && recipe.textBox === true;
  if (!hasPhotos && !textBox) return null; // nothing to redraw from

  // Load every photo from its stored source URL. crossOrigin is set inside
  // loadImage, so the canvas isn't tainted and toBlob works — the same path the
  // maker uses when it reopens a poster for editing.
  const imgs = hasPhotos
    ? await Promise.all(
        recipe.photos!.map(async (p) => ({
          img: await loadImage(p.sourceUrl),
          exposure: p.exposure ?? 1,
          ox: p.ox ?? 0.5,
          oy: p.oy ?? 0.5,
          z: p.zoom ?? 1,
          caption: p.caption ?? "",
        })),
      )
    : [];

  const colour =
    recipe.colour ||
    (isDeal
      ? (DEAL_PALETTE.find((p) => p.name === "Magenta") || DEAL_PALETTE[0]).hex
      : (PALETTE.find((p) => p.name === "Pink") || PALETTE[0]).hex);

  const detail = prefer(fields.detail, recipe.detail);
  const price = prefer(fields.price, recipe.price);
  const footer = isDeal ? prefer(fields.footer, recipe.footer) : undefined;
  const dayLabelRaw = isDeal ? prefer(fields.dayLabel, recipe.dayLabel) : "";
  const dayLabel = dayLabelRaw.trim() ? dayLabelRaw.trim() : undefined;

  // Everything shared between the online poster and the print flyer. Mirrors the
  // maker's render() call exactly.
  const common = {
    name: fields.name,
    date: fields.date,
    start: fields.start,
    end: fields.end,
    detail,
    price,
    dealLayout: isDeal,
    textBox,
    dayLabel,
    footer,
    qrUrl: isDeal && recipe.qr ? recipe.qr : undefined,
    colour,
    treatment: recipe.treatment ?? "scatter",
    titleScale: recipe.titleSize ?? 1,
    imgs: imgs.length ? imgs : null,
  };

  // The online poster: a deal is page-shaped ("zine"); everything else is the
  // 4:5 Instagram post, exactly as the maker saves it.
  const size: PosterSize = isDeal ? "zine" : "ig";
  const out: { colour: HTMLCanvasElement; flyer?: HTMLCanvasElement } = {
    colour: await renderEventPoster({ ...common, size, mode: "colour" }),
  };
  // The print-ready flyer (black on transparent, always A-page shape).
  if (fields.exportFlyer) {
    out.flyer = await renderEventPoster({ ...common, size: "zine", mode: "negative" });
  }
  return out;
}

/**
 * Re-render an event's poster from its stored recipe, with the event's current
 * name / date / time, and upload the result. Returns the new poster_url (and
 * flyer_poster_url when exportFlyer is set), or null when there's no rebuildable
 * recipe. Throws if a photo won't load or the poster won't draw.
 */
export async function rebuildPosterFromRecipe(
  fields: PosterRebuildFields,
  rawRecipe: Record<string, unknown> | null | undefined,
): Promise<PosterRebuildResult | null> {
  const drawn = await drawPosterFromRecipe(fields, rawRecipe);
  if (!drawn) return null;

  const blob = await canvasToBlob(drawn.colour);
  const file = new File([blob], posterName(fields.name, fields.date, "poster"), {
    type: "image/png",
  });
  const { public_url } = await uploadImage(file, "event-posters");
  const result: PosterRebuildResult = { poster_url: public_url };

  if (drawn.flyer) {
    const negBlob = await canvasToBlob(drawn.flyer);
    const negFile = new File([negBlob], posterName(fields.name, fields.date, "flyer"), {
      type: "image/png",
    });
    const { public_url: flyerUrl } = await uploadImage(negFile, "event-posters");
    result.flyer_poster_url = flyerUrl;
  }

  return result;
}
