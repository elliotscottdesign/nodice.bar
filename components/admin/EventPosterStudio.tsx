"use client";

// =============================================================
// EventPosterStudio — the poster maker, inside the events builder
// =============================================================
// Same artwork engine as the DJ night posters (see lib/poster/engine.ts for the
// port note). Fill the event in, pick a picture, pick a colour — out come the
// Instagram post, the Instagram story and the A3 print, and the poster can be
// saved straight onto the event so it shows on nodice.bar/events.
//
// The picture comes from either route: Upload (straight off the phone) or
// Library (anything already in /admin/media). Both get the halftone and the
// exposure dial.
//
// Deliberate safety rule: "Save onto this event" only ever touches the event's
// artwork AFTER the poster has rendered AND uploaded successfully, so a failed
// render can never blank a poster that's already live. The founder is shown the
// artwork he's about to replace, and asked, before anything is written.
// =============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import MediaPicker from "@/components/admin/MediaPicker";
import Notice from "@/components/Notice";
import { uploadImage } from "@/lib/db/media";
import { confirmDialog } from "@/lib/dialog";
import { RAL, ralLabel, ralSearch } from "@/lib/poster/ralColours";
import { eventQrUrl } from "@/lib/poster/qr";
import {
  PALETTE,
  DEAL_PALETTE,
  EVENT_PALETTE,
  canvasToBlob,
  coverRect,
  downloadCanvas,
  ensureFont,
  fontReady,
  frameCellAspect,
  loadImage,
  posterName,
  renderEventPoster,
  type PosterSize,
  type PosterTreatment,
} from "@/lib/poster/engine";

function describe(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

// Pull a number out of a price field ("£10" → 10, "£10.50" → 10.5, "Free" →
// null) so a deal's price is stored in its own numeric cell (ticket_price),
// not baked into a text line.
function parsePrice(s: string | null | undefined): number | null {
  const m = String(s ?? "").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

// First sentence of the description, if it's short enough to earn a line on a
// poster. Anything longer is left blank — a poster with a paragraph on it is a
// flyer nobody reads, and he can always type his own line.
function suggestDetail(desc: string | null | undefined): string {
  const firstLine = String(desc || "").split(/\r?\n/)[0].trim();
  if (!firstLine) return "";
  const m = firstLine.match(/^(.{0,70}?[.!?])(\s|$)/);
  const s = (m ? m[1] : firstLine).replace(/\.$/, "").trim();
  if (s.length > 70) return "";
  // Most descriptions open with "… at No Dice, London Fields", and the poster
  // already signs off NO DICE in big type at the bottom. Suggesting it twice
  // makes the first poster he builds look sloppy, so don't.
  if (/no\s*dice/i.test(s)) return "";
  return s;
}

const PILL =
  "rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition";

// A poster can hold one photo (unchanged) or several — a tidy auto-reflowing
// grid (a comedian line-up, a DJ b2b, a food spread). Each photo keeps its own
// exposure + reposition; colour / treatment / title size are shared. One photo
// renders byte-identical to the old single-image poster. Capped at six — more
// than that and each headshot is too small to read.
const MAX_PHOTOS = 6;

type StudioPhoto = {
  id: string;
  /** What the canvas draws from — an upload's object URL, or a storage URL. */
  url: string;
  name: string;
  /** Persisted storage URL ("" while an upload is still in flight). */
  sourceUrl: string;
  img: HTMLImageElement | null;
  exposure: number;
  ox: number;
  oy: number;
  zoom: number;
};

let _photoId = 0;
const makePhoto = (
  url: string,
  name: string,
  sourceUrl: string,
): StudioPhoto => ({
  id: `p${++_photoId}`,
  url,
  name,
  sourceUrl,
  img: null,
  exposure: 1,
  ox: 0.5,
  oy: 0.5,
  zoom: 1,
});

// CSS aspect-ratio for each preview shape, so the canvas box matches the file.
// 'zine' is the A-series page ratio (1:√2) — the deal / zine-cover shape.
const PREVIEW_AR: Record<PosterSize, string> = {
  ig: "4 / 5",
  story: "9 / 16",
  zine: "1 / 1.41421",
  a3: "1 / 1.41421",
};

// What "Save onto this event" hands back. For an ordinary event it's just the
// poster_url. For a deal (isDeal) it also carries the print-ready flyer render
// and the structured fields, so the event can be regenerated and the team-hub
// Events flyer can drop in `flyer_poster_url`.
export type PosterSaveResult = {
  poster_url: string;
  flyer_poster_url?: string | null;
  poster_subcopy?: string | null;
  poster_footer?: string | null;
  poster_image_url?: string | null;
  poster_qr_url?: string | null;
  poster_day_label?: string | null;
  /** The price as a number, parsed from the price field — the deal's own cell. */
  ticket_price?: number | null;
};

export default function EventPosterStudio({
  name,
  date,
  start,
  end,
  description,
  defaultPrice,
  currentPosterUrl,
  isDeal,
  exportFlyer,
  defaultFooter,
  defaultSubcopy,
  defaultQrUrl,
  defaultImageUrl,
  defaultDayLabel,
  hideCopyInputs,
  onSave,
  saveLabel = "Save onto this event",
  saveHint,
}: {
  name: string;
  date: string;
  start?: string | null;
  end?: string | null;
  description?: string | null;
  /** Prefill for the price line, e.g. from the cheapest ticket type. */
  defaultPrice?: string | null;
  /** The artwork this event has now — what "save" would replace. */
  currentPosterUrl?: string | null;
  /**
   * True for a drinks DEAL (category drink_special, or a "Deals" calendar chip).
   * A deal's poster is shaped to the A-series page ratio ("zine" size) so it
   * fills the team-hub drinks zine's front cover, which pulls the deal event's
   * poster_url and inverts it to print black-on-pink. When set, the page shape
   * is the default preview and the one "Save" writes onto the event, the ink
   * defaults to Cream so it inverts to near-black on the stock, and Save also
   * writes a print-ready flyer render + the structured fields below.
   */
  isDeal?: boolean;
  /**
   * When true, Save also renders the print-ready flyer (black-on-transparent)
   * and returns the structured deal fields. Only the events-platform table has
   * the columns to store them, so the calendar-events CMS leaves this off and
   * gets just poster_url.
   */
  exportFlyer?: boolean;
  /** Deal fields stored on the event, used to prefill the maker. */
  defaultFooter?: string | null;
  defaultSubcopy?: string | null;
  defaultQrUrl?: string | null;
  defaultImageUrl?: string | null;
  defaultDayLabel?: string | null;
  /**
   * Hide the "Words on the poster" inputs (line / price / bottom line / day).
   * Used when a parent form owns those fields and feeds them via the default*
   * props — the maker is then just photo + colour + generate.
   */
  hideCopyInputs?: boolean;
  /**
   * Called once the poster(s) are safely in storage. Ordinary events get just
   * `poster_url`; a deal also gets the flyer render + the structured fields.
   * Omit to hide the save button (e.g. nothing to save onto yet).
   */
  onSave?: (result: PosterSaveResult) => void | Promise<void>;
  saveLabel?: string;
  saveHint?: string;
}) {
  // A deal's saved poster is page-shaped ("zine"); everything else saves the
  // 4:5 Instagram post exactly as before.
  const saveSize: PosterSize = isDeal ? "zine" : "ig";
  // ---- Pictures ----
  // One photo (unchanged) or several (a grid). Seed from the event's stored
  // source photo (poster_image_url) so a deal opens with its artwork already in
  // the frame, ready to regenerate.
  const [photos, setPhotos] = useState<StudioPhoto[]>(() =>
    defaultImageUrl
      ? [
          makePhoto(
            defaultImageUrl,
            defaultImageUrl.split("/").pop() || "",
            defaultImageUrl,
          ),
        ]
      : [],
  );
  // Which photo the crop well + exposure/zoom sliders edit, and which is being
  // dragged in the reorder strip.
  const [selId, setSelId] = useState("");
  const [dragId, setDragId] = useState("");
  const [showLibrary, setShowLibrary] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  // Which photos we've already kicked a load for, so the load effect fires once
  // per photo instead of looping as it fills `img` back into state.
  const loadingRef = useRef<Set<string>>(new Set());
  // DOM nodes of the strip thumbnails, for hit-testing during a reorder drag.
  const thumbRefs = useRef<Record<string, HTMLElement | null>>({});

  // Patch one photo by id (used by the exposure / zoom / reposition controls).
  const patchPhoto = useCallback(
    (id: string, patch: Partial<StudioPhoto>) =>
      setPhotos((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    [],
  );

  // ---- Look (shared across photos) ----
  // Deals pick their ink from the dusky DEAL_PALETTE (online brand colours that
  // stand apart from the DJ brights); everything else keeps the house Pink.
  const dealSwatches = isDeal ? DEAL_PALETTE : PALETTE;
  const [colour, setColour] = useState(
    isDeal
      ? (DEAL_PALETTE.find((p) => p.name === "Magenta") || DEAL_PALETTE[0]).hex
      : (PALETTE.find((p) => p.name === "Pink") || PALETTE[0]).hex,
  );
  const [showRal, setShowRal] = useState(false);
  const [ralQ, setRalQ] = useState("");
  const [treatment, setTreatment] = useState<PosterTreatment>("scatter");
  // Deal "text box" mode — swap the photo for a block of info text. Image stays
  // the default; this is the opt-in alternative.
  const [textBox, setTextBox] = useState(false);
  // Headline size dial (1 = the standard DJ-poster size). The founder can make
  // the event name bigger (photo shrinks) or smaller (photo grows).
  const [titleScale, setTitleScale] = useState(1);

  // ---- Copy that goes on the poster ----
  // Both lines are SUGGESTED from the event above and keep following it as the
  // founder types — until he edits the line himself, after which his wording
  // wins and nothing overwrites it.
  // Sub-copy (detail): a deal seeds from its stored poster_subcopy, otherwise
  // from the description's first line. Follows the source until the founder edits.
  const [detail, setDetail] = useState(
    () => defaultSubcopy ?? suggestDetail(description),
  );
  const [detailTouched, setDetailTouched] = useState(false);
  // On/off switch for the line under the title. When off it's hidden even if
  // there's text in the field, so the founder can keep the wording but drop the
  // line without deleting it.
  const [showDetail, setShowDetail] = useState(true);
  const [price, setPrice] = useState(defaultPrice || "");
  const [priceTouched, setPriceTouched] = useState(false);
  useEffect(() => {
    if (!detailTouched) setDetail(defaultSubcopy ?? suggestDetail(description));
  }, [description, defaultSubcopy, detailTouched]);
  useEffect(() => {
    if (!priceTouched) setPrice(defaultPrice || "");
  }, [defaultPrice, priceTouched]);

  // ---- Deal-only fields: the free-text bottom line and the QR target ----
  const [footer, setFooter] = useState(defaultFooter || "");
  const [footerTouched, setFooterTouched] = useState(false);
  useEffect(() => {
    if (!footerTouched) setFooter(defaultFooter || "");
  }, [defaultFooter, footerTouched]);
  // QR is kept for non-deal use + round-tripping the stored value; deals no
  // longer show a QR, so there's no input for it.
  const [qr, setQr] = useState(defaultQrUrl || "");
  useEffect(() => {
    setQr(defaultQrUrl || "");
  }, [defaultQrUrl]);
  const [dayLabel, setDayLabel] = useState(defaultDayLabel || "");
  const [dayTouched, setDayTouched] = useState(false);
  useEffect(() => {
    if (!dayTouched) setDayLabel(defaultDayLabel || "");
  }, [defaultDayLabel, dayTouched]);

  // ---- Chrome ----
  // Deals open on the page shape (what the zine cover uses); others on the post.
  const [previewSize, setPreviewSize] = useState<PosterSize>(saveSize);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const [fontOk, setFontOk] = useState<boolean | null>(null);
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const wellRef = useRef<HTMLCanvasElement | null>(null);
  const genRef = useRef(0);

  // The headline font has to be loaded before anything is measured, or every
  // line lays out against a fallback face and the whole poster is wrong. If it
  // never loads, exporting is blocked rather than silently producing junk.
  useEffect(() => {
    let alive = true;
    ensureFont().then((ok) => {
      if (!alive) return;
      // Loaded AND actually usable for measuring — a face that loaded but isn't
      // registered yet would still lay the poster out at the wrong sizes.
      setFontOk(ok && fontReady());
      bump();
    });
    return () => {
      alive = false;
    };
  }, []);

  // Load each picture (upload or library) once. Image data lives in state, so a
  // load completing re-renders the preview and the strip naturally.
  useEffect(() => {
    photos.forEach((p) => {
      if (p.img || loadingRef.current.has(p.id)) return;
      loadingRef.current.add(p.id);
      loadImage(p.url)
        .then((im) =>
          setPhotos((ps) =>
            ps.map((x) => (x.id === p.id ? { ...x, img: im } : x)),
          ),
        )
        .catch((e) => {
          // Drop the picture that wouldn't load so it can't wedge the grid, and
          // say why — same message the single-image flow used to show.
          setErr(describe(e, "Couldn't load that picture."));
          setPhotos((ps) => ps.filter((x) => x.id !== p.id));
          loadingRef.current.delete(p.id);
        });
    });
  }, [photos]);

  // Keep a valid photo selected as the list changes (add / remove / reorder).
  useEffect(() => {
    if (!photos.some((p) => p.id === selId) && photos[0]) setSelId(photos[0].id);
  }, [photos, selId]);

  const sel = photos.find((p) => p.id === selId) || photos[0] || null;
  const loaded = photos.filter((p) => p.img);
  const hasPic = loaded.length > 0;
  // In deal text-box mode there's no photo, so a poster can render/save without
  // a picture. Otherwise a picture is required, as before.
  const canRender = hasPic || (isDeal && textBox);

  const render = useCallback(
    (size: PosterSize, mode: "colour" | "negative") =>
      renderEventPoster({
        name,
        date,
        start,
        end,
        detail: showDetail ? detail : "",
        price,
        // Deals use the deal layout (price in a circle, no QR, full-width info)
        // and can replace the bottom line; other events keep the defaults.
        dealLayout: isDeal,
        textBox: isDeal && textBox,
        dayLabel: isDeal && dayLabel.trim() ? dayLabel.trim() : undefined,
        footer: isDeal ? footer : undefined,
        qrUrl: isDeal && qr.trim() ? qr.trim() : undefined,
        colour,
        size,
        mode,
        treatment,
        titleScale,
        // One loaded photo → a single full-frame image (byte-identical to
        // before); several → the grid, in list order, each with its own
        // exposure + reposition.
        imgs: photos
          .filter((p) => p.img)
          .map((p) => ({
            img: p.img as HTMLImageElement,
            exposure: p.exposure,
            ox: p.ox,
            oy: p.oy,
            z: p.zoom,
          })),
      }),
    [
      name,
      date,
      start,
      end,
      detail,
      showDetail,
      price,
      isDeal,
      textBox,
      footer,
      qr,
      dayLabel,
      colour,
      treatment,
      titleScale,
      photos,
    ],
  );

  // Live preview. Renders at full poster resolution into the canvas and lets CSS
  // scale it down, so the preview stays sharp on a retina phone.
  useEffect(() => {
    if (!canRender) return;
    let cancelled = false;
    const my = ++genRef.current;
    (async () => {
      try {
        const cv = await render(previewSize, "colour");
        if (cancelled || my !== genRef.current) return;
        const dst = previewRef.current;
        if (!dst) return;
        dst.width = cv.width;
        dst.height = cv.height;
        dst.getContext("2d")!.drawImage(cv, 0, 0);
      } catch (e) {
        if (!cancelled) setErr(describe(e, "Couldn't draw the poster."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [render, previewSize, hasPic, tick]);

  // The little crop well — exact crop, no halftone, so dragging feels direct. It
  // shows the SELECTED photo at the shape of the cell it will land in, so a 6-up
  // headshot is cropped to a near-square, not the tall single-photo frame.
  const wellAspect = frameCellAspect(
    previewSize,
    showDetail && !!detail.trim(),
    !!price.trim(),
    titleScale,
    Math.max(1, photos.length),
  );
  const WELL_W = 116;
  const WELL_H = Math.round(WELL_W / wellAspect);
  useEffect(() => {
    const c = wellRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    const img = sel?.img;
    if (!img) return;
    const r = coverRect(
      img.width,
      img.height,
      c.width,
      c.height,
      sel.ox,
      sel.oy,
      sel.zoom,
    );
    ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, c.width, c.height);
  }, [sel, tick, WELL_H]);

  // Drag the picture inside the well to choose what's in frame (the selected
  // photo).
  function startReposition(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!sel) return;
    e.preventDefault();
    const id = sel.id;
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX,
      sy = e.clientY;
    const base = { ox: sel.ox, oy: sel.oy };
    const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / rect.width,
        dy = (ev.clientY - sy) / rect.height;
      // drag the picture → reveal the opposite side
      patchPhoto(id, { ox: cl(base.ox - dx), oy: cl(base.oy - dy) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // Take a photo off this poster (stays in the media library).
  function removePhoto(id: string) {
    loadingRef.current.delete(id);
    setPhotos((ps) => ps.filter((p) => p.id !== id));
  }

  // Reorder by dragging a strip thumbnail over its neighbours. Pointer-based so
  // it works on a phone as well as a mouse; a tap with no drag just selects.
  function startReorder(e: React.PointerEvent<HTMLElement>, id: string) {
    setSelId(id);
    const sx = e.clientX,
      sy = e.clientY;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 6)
        return;
      moved = true;
      setDragId(id);
      let overId = "";
      for (const [tid, el] of Object.entries(thumbRefs.current)) {
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (
          ev.clientX >= r.left &&
          ev.clientX <= r.right &&
          ev.clientY >= r.top &&
          ev.clientY <= r.bottom
        ) {
          overId = tid;
          break;
        }
      }
      if (overId && overId !== id) {
        setPhotos((ps) => {
          const from = ps.findIndex((p) => p.id === id);
          const to = ps.findIndex((p) => p.id === overId);
          if (from < 0 || to < 0 || from === to) return ps;
          const next = ps.slice();
          const [m] = next.splice(from, 1);
          next.splice(to, 0, m);
          return next;
        });
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDragId("");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // Upload straight off the phone (one or several). Each poster renders from a
  // local copy right away (no waiting for the network), and the files are filed
  // into the media library in the background so they can be reused later.
  async function onUpload(files: FileList | null) {
    const chosen = files ? Array.from(files) : [];
    if (!chosen.length) return;
    setErr("");
    setDone("");
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setErr(`You can put up to ${MAX_PHOTOS} pictures on a poster.`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const take = chosen.slice(0, room);
    const added = take.map((f) => makePhoto(URL.createObjectURL(f), f.name, ""));
    setPhotos((ps) => [...ps, ...added]);
    setSelId(added[0].id);
    setBusy("upload");
    let anyFailed = false;
    try {
      // Keep each storage URL so a single-photo deal can persist its source
      // photo (poster_image_url) and be regenerated later.
      await Promise.all(
        take.map(async (f, i) => {
          try {
            const { public_url } = await uploadImage(f, "event-posters");
            patchPhoto(added[i].id, { sourceUrl: public_url });
          } catch {
            anyFailed = true;
          }
        }),
      );
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
    if (anyFailed) {
      // Non-fatal: the posters still work off the local copies.
      setErr(
        "Some pictures couldn't be saved to the media library — the poster still works, they just won't be there to reuse later.",
      );
    } else if (chosen.length > room) {
      setErr(`Only the first ${room} fit — a poster holds up to ${MAX_PHOTOS} pictures.`);
    }
  }

  // A3 is black-on-paper for the halftone; a real photo can't print as black
  // ink, so Natural makes the A3 a full-colour poster instead. "Whites to
  // colour" stays on the negative — knocking the whites out is exactly how the
  // coloured paper is meant to show through.
  const a3Mode = treatment === "natural" ? "colour" : "negative";

  async function exportFile(
    size: PosterSize,
    mode: "colour" | "negative",
    tag: string,
  ) {
    if (!canRender) return;
    setBusy(tag);
    setErr("");
    setDone("");
    try {
      await downloadCanvas(await render(size, mode), posterName(name, date, tag));
      setDone(`Downloaded — it's in your Downloads folder.`);
    } catch (e) {
      setErr(describe(e, "Export failed."));
    } finally {
      setBusy("");
    }
  }

  // Write the poster onto the event. Order matters: render, then upload, and
  // only then hand the URL over. If either step fails, nothing is written and
  // whatever artwork the event already had is untouched.
  async function saveToEvent() {
    if (!canRender || !onSave) return;
    if (
      currentPosterUrl &&
      !(await confirmDialog(
        `This event already has artwork on it. Saving this poster will replace it — the old picture stays in the media library, but the event will show this poster instead.\n\nGo ahead?`,
        { title: "Replace artwork?", confirmLabel: "Replace", danger: false },
      ))
    )
      return;
    setBusy("save");
    setErr("");
    setDone("");
    try {
      // 1) The colour poster — online artwork + the zine cover (inverted by CSS).
      const cv = await render(saveSize, "colour");
      const blob = await canvasToBlob(cv);
      const file = new File([blob], posterName(name, date, "poster"), {
        type: "image/png",
      });
      const { public_url } = await uploadImage(file, "event-posters");

      const result: PosterSaveResult = { poster_url: public_url };

      // 2) When this surface stores them, also render the print-ready flyer
      //    version (black on transparent, same A-page shape) and return the
      //    structured fields, so the team-hub Events flyer can drop in
      //    flyer_poster_url and the deal can be regenerated later.
      if (exportFlyer) {
        const negCv = await render(saveSize, "negative");
        const negBlob = await canvasToBlob(negCv);
        const negFile = new File([negBlob], posterName(name, date, "flyer"), {
          type: "image/png",
        });
        const { public_url: flyerUrl } = await uploadImage(
          negFile,
          "event-posters",
        );
        result.flyer_poster_url = flyerUrl;
        result.poster_subcopy = detail.trim() || null;
        result.poster_footer = footer.trim() || null;
        result.poster_qr_url = qr.trim() || null;
        // Only one source photo round-trips (poster_image_url is a single
        // column) — the primary (first) picture. A multi-photo grid is an events
        // use; deals that store this are single-photo, so this is unchanged for
        // them. The saved poster PNG always carries the full artwork regardless.
        result.poster_image_url = photos[0]?.sourceUrl || null;
        result.poster_day_label = dayLabel.trim() || null;
        // The price lives in its own numeric cell, not in the sub-copy line.
        result.ticket_price = parsePrice(price);
      }

      await onSave(result);
      setDone(
        exportFlyer
          ? "Saved — the deal's poster is live on nodice.bar/events, the zine cover and the printed flyer."
          : "Saved — this poster is now the event's artwork on nodice.bar/events.",
      );
    } catch (e) {
      setErr(
        `${describe(e, "Couldn't save the poster.")} The event's existing artwork hasn't been changed.`,
      );
    } finally {
      setBusy("");
    }
  }

  const disabled = !canRender || !!busy || fontOk === false;

  // True when the active colour is one of the quick-pick swatches. When it isn't,
  // it came from the RAL chart (or the custom picker), so the RAL pill shows that
  // colour and reads as "active" — the quick-pick row has nothing to highlight.
  const colourIsPalette = [
    ...dealSwatches,
    ...(isDeal ? [] : EVENT_PALETTE),
  ].some((p) => p.hex.toLowerCase() === colour.toLowerCase());

  return (
    <div className="space-y-4 rounded-xl border border-plonkTeal/25 bg-ink/30 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-display text-base">Poster maker</h4>
        <p className="text-[11px] text-cream/45">
          Same look as the DJ night posters
        </p>
      </div>

      {fontOk === false && (
        <Notice variant="warning">
          The poster typeface didn&apos;t load, so the poster would come out in
          the wrong font. Reload this page and try again.
        </Notice>
      )}
      {err && <Notice variant="error">{err}</Notice>}
      {done && <Notice variant="success">{done}</Notice>}

      <div className="flex flex-col gap-5 lg:flex-row">
        {/* ───── Preview ───── */}
        <div className="shrink-0 lg:w-[236px]">
          <div className="mb-2 inline-flex rounded-full border border-cream/15 p-0.5">
            {(
              isDeal
                ? ([
                    ["zine", "Deal page"],
                    ["ig", "Post"],
                    ["story", "Story"],
                  ] as [PosterSize, string][])
                : ([
                    ["ig", "Post"],
                    ["story", "Story"],
                  ] as [PosterSize, string][])
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setPreviewSize(k)}
                className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                  previewSize === k
                    ? "bg-plonkPink text-white"
                    : "text-cream/60 hover:text-cream"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {canRender ? (
            <div className="relative w-full max-w-[236px]">
              <canvas
                ref={previewRef}
                className="block w-full rounded-md border border-cream/15 bg-black"
                style={{ aspectRatio: PREVIEW_AR[previewSize] }}
              />
              {previewSize === "story" && (
                // Instagram's own UI sits over these bands. Guides only — they
                // are not drawn into the exported file.
                <>
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-center border-b border-dashed border-amber-400/70 bg-ink/40"
                    style={{ height: `${(250 / 1920) * 100}%` }}
                  >
                    <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-300">
                      Instagram covers this
                    </span>
                  </div>
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center border-t border-dashed border-amber-400/70 bg-ink/40"
                    style={{ height: `${(250 / 1920) * 100}%` }}
                  >
                    <span className="mb-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-300">
                      Instagram covers this
                    </span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div
              className="flex w-full max-w-[236px] items-center justify-center rounded-md border border-dashed border-cream/20 px-4 text-center text-xs leading-relaxed text-cream/55"
              style={{ aspectRatio: PREVIEW_AR[previewSize] }}
            >
              Pick a picture below and the poster appears here.
            </div>
          )}
          {/* The QR now lives ONLY on the A3 print (founder 19 Oct 2026) — the
              thing that gets put on a wall and scanned. The Instagram post and
              story don't carry it. */}
          <p className="mt-2 max-w-[236px] text-[10px] leading-relaxed text-cream/40">
            The A3 print has a QR code (top right) that opens{" "}
            <span className="break-all text-cream/60">
              {eventQrUrl(date).replace(/^https:\/\//, "")}
            </span>{" "}
            when scanned. The post and story don&apos;t carry it.
          </p>
        </div>

        {/* ───── Controls ───── */}
        <div className="min-w-0 flex-1 space-y-5">
          {/* Pictures */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-cream/55">
              {photos.length > 1 ? "Pictures" : "Picture"}
            </p>
            <div className="flex gap-3">
              <div className="shrink-0">
                {sel?.img ? (
                  <div className="relative" style={{ width: WELL_W }}>
                    <canvas
                      ref={wellRef}
                      width={WELL_W * 2}
                      height={WELL_H * 2}
                      onPointerDown={startReposition}
                      title="Drag to move the picture inside the frame"
                      style={{ width: WELL_W, height: WELL_H }}
                      className="block cursor-grab touch-none select-none rounded border border-cream/15 bg-black"
                    />
                    <span className="pointer-events-none absolute inset-x-0 bottom-0.5 text-center text-[8px] font-bold text-white drop-shadow">
                      ⤢ drag
                    </span>
                  </div>
                ) : (
                  <div
                    className="rounded border border-dashed border-cream/25"
                    style={{ width: WELL_W, height: WELL_H }}
                  />
                )}
                {sel?.img && (
                  <label className="mt-1.5 block">
                    <span className="flex justify-between text-[9px] text-cream/45">
                      <span>Zoom</span>
                      <span>{sel.zoom.toFixed(1)}×</span>
                    </span>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="0.05"
                      value={sel.zoom}
                      onChange={(e) =>
                        patchPhoto(sel.id, { zoom: Number(e.target.value) })
                      }
                      className="w-full touch-none accent-plonkPink"
                      style={{ width: WELL_W }}
                    />
                  </label>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                {isDeal && (
                  <div className="inline-flex rounded-full border border-cream/15 p-0.5">
                    {(
                      [
                        ["image", "Image"],
                        ["text", "Text"],
                      ] as [string, string][]
                    ).map(([k, label]) => {
                      const active = (k === "text") === textBox;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setTextBox(k === "text")}
                          className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                            active
                              ? "bg-plonkPink text-white"
                              : "text-cream/60 hover:text-cream"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
                {textBox ? (
                  <p className="text-[10px] leading-relaxed text-cream/45">
                    Text poster — the info fills the space, no photo. Edit the
                    info in the fields above.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <label
                        className={`${PILL} cursor-pointer border-cream/20 text-cream/85 hover:bg-cream/5 ${
                          busy === "upload" ? "opacity-60" : ""
                        } ${photos.length >= MAX_PHOTOS ? "pointer-events-none opacity-40" : ""}`}
                      >
                        {busy === "upload"
                          ? "Uploading…"
                          : hasPic
                            ? "↻ Add more"
                            : "⬆ Upload"}
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/*"
                          multiple
                          hidden
                          onChange={(e) => onUpload(e.target.files)}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={photos.length >= MAX_PHOTOS}
                        onClick={() => setShowLibrary(true)}
                        className={`${PILL} border-cream/20 text-cream/85 hover:bg-cream/5 disabled:opacity-40`}
                      >
                        🗂 Library
                      </button>
                    </div>
                    <p className="text-[10px] leading-relaxed text-cream/40">
                      Add one picture, or several for a grid (up to {MAX_PHOTOS})
                      — a line-up, a b2b, a spread. One picture fills the frame as
                      before.
                    </p>
                  </>
                )}
                <label className="block">
                  <span className="flex justify-between text-[10px] text-cream/45">
                    <span>
                      Exposure
                      {photos.length > 1 ? " · this picture" : ""}
                    </span>
                    <span>
                      {(sel?.exposure ?? 1) < 0.92
                        ? "darker"
                        : (sel?.exposure ?? 1) > 1.08
                          ? "lighter"
                          : "auto"}
                    </span>
                  </span>
                  <input
                    type="range"
                    min="0.6"
                    max="1.5"
                    step="0.05"
                    value={sel?.exposure ?? 1}
                    disabled={!sel?.img}
                    onChange={(e) =>
                      sel && patchPhoto(sel.id, { exposure: Number(e.target.value) })
                    }
                    className="w-full touch-none py-1 accent-plonkPink disabled:opacity-40"
                  />
                </label>

                {/* Reorder strip — all the photos on the poster, in render
                    order. Drag a thumbnail over its neighbours to reorder
                    (works on a phone too); tap one to fine-tune it in the well
                    above; ✕ takes it off this poster (it stays in the library). */}
                {!textBox && photos.length > 0 && (
                  <div className="pt-1">
                    <div className="mb-1.5 text-[10px] text-cream/45">
                      {photos.length === 1
                        ? "1 picture"
                        : `${photos.length} pictures · drag to reorder, tap to fine-tune`}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {photos.map((p, i) => (
                        <div
                          key={p.id}
                          ref={(el) => {
                            thumbRefs.current[p.id] = el;
                          }}
                          onPointerDown={(e) => startReorder(e, p.id)}
                          title="Drag to reorder · tap to fine-tune"
                          className={`group relative h-16 w-16 shrink-0 cursor-grab touch-none select-none overflow-hidden rounded border bg-black ${
                            p.id === selId
                              ? "border-plonkPink ring-1 ring-plonkPink"
                              : "border-cream/20"
                          } ${dragId === p.id ? "opacity-50" : ""}`}
                        >
                          {p.img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.url}
                              alt=""
                              draggable={false}
                              className="pointer-events-none h-full w-full object-cover"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[9px] text-cream/40">
                              …
                            </span>
                          )}
                          <span className="pointer-events-none absolute left-0.5 top-0.5 rounded bg-black/60 px-1 text-[8px] font-bold text-white">
                            {i + 1}
                          </span>
                          <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => removePhoto(p.id)}
                            title="Remove this picture"
                            className="absolute right-0.5 top-0.5 rounded-full bg-black/70 px-1 text-[9px] font-bold text-red-300 hover:bg-red-500/40"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {photos.length < MAX_PHOTOS && (
                        <label
                          title="Add another picture"
                          className="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center rounded border border-dashed border-cream/30 text-cream/50 hover:bg-cream/5"
                        >
                          <span className="text-lg leading-none">＋</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            hidden
                            onChange={(e) => onUpload(e.target.files)}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["scatter", "Scatter", "The house grainy halftone look"],
                      ["natural", "Natural", "The real photo, not rasterised"],
                      [
                        "whites",
                        "Colour through",
                        "Greyscale photo — anything white in it turns the poster colour",
                      ],
                    ] as [PosterTreatment, string, string][]
                  ).map(([k, label, hint]) => (
                    <button
                      key={k}
                      type="button"
                      title={hint}
                      onClick={() => setTreatment(k)}
                      className={`${PILL} ${
                        treatment === k
                          ? "border-plonkPink bg-plonkPink/15 text-plonkPink"
                          : "border-cream/15 text-cream/85 hover:bg-cream/5"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] leading-relaxed text-cream/40">
                  {treatment === "natural"
                    ? "The full photo — the A3 prints in colour, not black on coloured paper."
                    : treatment === "whites"
                      ? "Greyscale photo — anything white turns the poster colour. The Exposure dial sets how much colour comes through. The A3 prints onto coloured paper."
                      : "Scatter halftone — the standard No Dice look. The A3 prints black on coloured paper."}
                </p>
              </div>
            </div>
          </div>

          {/* Colour */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-cream/55">
              Colour{" "}
              <span className="font-normal normal-case tracking-normal text-cream/40">
                · {ralLabel(colour)}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {dealSwatches.map((p) => (
                <button
                  key={p.hex}
                  type="button"
                  title={p.name}
                  onClick={() => setColour(p.hex)}
                  style={{ background: p.hex }}
                  className={`h-7 w-7 rounded-full ${
                    colour.toLowerCase() === p.hex.toLowerCase()
                      ? "ring-2 ring-cream ring-offset-2 ring-offset-ink"
                      : "border border-cream/25"
                  }`}
                />
              ))}
              <label
                title="Any colour"
                className="relative inline-block h-7 w-7 overflow-hidden rounded-full border border-dashed border-cream/40"
              >
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-cream/70">
                  +
                </span>
                <input
                  type="color"
                  value={colour}
                  onChange={(e) => setColour(e.target.value)}
                  className="h-full w-full cursor-pointer opacity-0"
                />
              </label>
              {/* Event brand colours — the house blues (founder 19 Oct 2026),
                  offered alongside the bright picks. Deals keep their own set. */}
              {!isDeal && (
                <span className="mx-1 inline-block h-5 w-px shrink-0 bg-cream/15" />
              )}
              {!isDeal &&
                EVENT_PALETTE.map((p) => (
                  <button
                    key={p.hex}
                    type="button"
                    title={`${p.name} — No Dice event colour`}
                    onClick={() => setColour(p.hex)}
                    style={{ background: p.hex }}
                    className={`h-7 w-7 rounded-full ${
                      colour.toLowerCase() === p.hex.toLowerCase()
                        ? "ring-2 ring-cream ring-offset-2 ring-offset-ink"
                        : "border border-cream/25"
                    }`}
                  />
                ))}
              <button
                type="button"
                onClick={() => setShowRal((o) => !o)}
                className={`${PILL} inline-flex items-center gap-1.5 ${
                  showRal
                    ? "border-plonkPink bg-plonkPink/15 text-plonkPink"
                    : !colourIsPalette
                      ? "border-cream/60 text-cream"
                      : "border-cream/20 text-cream/85 hover:bg-cream/5"
                }`}
              >
                {/* Reflects the active colour, so a RAL pick shows on the pill. */}
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full border border-cream/30"
                  style={{ background: colour }}
                />
                {showRal
                  ? "Hide RAL"
                  : !colourIsPalette
                    ? ralLabel(colour)
                    : `RAL chart (${RAL.length})`}
              </button>
            </div>
            {showRal && (
              <div className="mt-2 rounded-lg border border-cream/12 p-2">
                <input
                  value={ralQ}
                  onChange={(e) => setRalQ(e.target.value)}
                  placeholder="Search a RAL code or name…"
                  className="mb-2 w-full rounded-md border border-cream/20 bg-ink px-2.5 py-1.5 text-xs text-cream placeholder:text-cream/35"
                />
                <div
                  className="grid max-h-48 gap-1 overflow-y-auto"
                  style={{
                    gridTemplateColumns: "repeat(auto-fill, minmax(26px, 1fr))",
                  }}
                >
                  {ralSearch(ralQ).map((r) => (
                    <button
                      key={r.c}
                      type="button"
                      title={`RAL ${r.c} · ${r.n}`}
                      // Picking a colour saves it and closes the chart. (The
                      // chart deliberately does NOT close on an outside click, so
                      // selecting is the way out.)
                      onClick={() => {
                        setColour(r.hex);
                        setShowRal(false);
                      }}
                      style={{ background: r.hex }}
                      className={`h-6 rounded ${
                        colour.toLowerCase() === r.hex.toLowerCase()
                          ? "ring-2 ring-cream"
                          : "border border-cream/20"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Title size */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-cream/55">
              Title size
            </p>
            <label className="block">
              <span className="flex justify-between text-[10px] text-cream/45">
                <span>The event name on the poster</span>
                <span>{Math.round(titleScale * 100)}%</span>
              </span>
              <input
                type="range"
                min="0.7"
                max="1.4"
                step="0.05"
                value={titleScale}
                onChange={(e) => setTitleScale(Number(e.target.value))}
                className="w-full touch-none py-1 accent-plonkPink"
              />
            </label>
            <p className="text-[10px] leading-relaxed text-cream/40">
              Bigger title, smaller picture — and the other way round.
            </p>
          </div>

          {/* Words on the poster */}
          <div className={hideCopyInputs ? "hidden" : ""}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-cream/55">
              Words on the poster
            </p>
            <p className="mb-2 text-[10px] leading-relaxed text-cream/40">
              The name, date and time come from the event above. These two are
              optional — leave them blank and the poster is just the name, the
              picture and the date.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 flex items-center justify-between gap-2 text-[10px] text-cream/45">
                  <span>One short line (optional)</span>
                  <button
                    type="button"
                    onClick={() => setShowDetail((v) => !v)}
                    title="Show or hide the line under the title"
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider transition ${
                      showDetail
                        ? "border-plonkTeal/60 bg-plonkTeal/15 text-plonkTeal"
                        : "border-cream/20 text-cream/50 hover:bg-cream/5"
                    }`}
                  >
                    {showDetail ? "● On" : "Off"}
                  </button>
                </span>
                <input
                  value={detail}
                  disabled={!showDetail}
                  onChange={(e) => {
                    setDetailTouched(true);
                    setDetail(e.target.value);
                  }}
                  maxLength={70}
                  placeholder="e.g. Prizes all night"
                  className={`w-full rounded-md border border-cream/20 bg-ink px-2.5 py-1.5 text-xs text-cream placeholder:text-cream/35 ${
                    showDetail ? "" : "opacity-40"
                  }`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] text-cream/45">
                  Price (optional)
                </span>
                <input
                  value={price}
                  onChange={(e) => {
                    setPriceTouched(true);
                    setPrice(e.target.value);
                  }}
                  maxLength={60}
                  placeholder="e.g. £6 per team · £5 on the door · Free entry"
                  className="w-full rounded-md border border-cream/20 bg-ink px-2.5 py-1.5 text-xs text-cream placeholder:text-cream/35"
                />
              </label>
            </div>
            {isDeal && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] text-cream/45">
                    Bottom line (optional)
                  </span>
                  <input
                    value={footer}
                    onChange={(e) => {
                      setFooterTouched(true);
                      setFooter(e.target.value);
                    }}
                    maxLength={40}
                    placeholder="e.g. £10 / FREE ENTRY / DEAL OF THE DAY"
                    className="w-full rounded-md border border-cream/20 bg-ink px-2.5 py-1.5 text-xs text-cream placeholder:text-cream/35"
                  />
                  <span className="mt-1 block text-[9px] leading-relaxed text-cream/35">
                    Replaces the “NO DICE · date” line at the foot — on the
                    poster, the zine cover and the printed flyer. Leave blank to
                    keep the usual line.
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] text-cream/45">
                    Day shown (optional)
                  </span>
                  <input
                    value={dayLabel}
                    onChange={(e) => {
                      setDayTouched(true);
                      setDayLabel(e.target.value);
                    }}
                    maxLength={40}
                    placeholder="e.g. TUESDAYS / MON-THURS"
                    className="w-full rounded-md border border-cream/20 bg-ink px-2.5 py-1.5 text-xs text-cream placeholder:text-cream/35"
                  />
                  <span className="mt-1 block text-[9px] leading-relaxed text-cream/35">
                    The day on the bottom line (a deal repeats, so a single date
                    would be wrong). Blank shows the event date.
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Export + save */}
          <div className="space-y-2 border-t border-cream/10 pt-4">
            {isDeal && (
              <p className="mb-1 rounded-lg border border-plonkYellow/25 bg-plonkYellow/5 p-2 text-[10px] leading-relaxed text-cream/60">
                This is a <strong className="text-plonkYellow">deal</strong>, so
                its poster is built page-shaped. Saving it puts it on
                nodice.bar/events and makes it the front cover of the printed
                drinks zine — where it&apos;s flipped to black ink on the
                coloured paper, so a light colour here reads cleanest.
              </p>
            )}
            {onSave && (
              <>
                {currentPosterUrl && (
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-cream/12 bg-ink/50 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentPosterUrl}
                      alt=""
                      className="h-12 w-10 shrink-0 rounded border border-cream/15 object-cover"
                    />
                    <p className="text-[10px] leading-relaxed text-cream/55">
                      This event already has this artwork. Saving the poster
                      replaces it (you&apos;ll be asked first).
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={saveToEvent}
                  className="w-full rounded-full bg-plonkTeal px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-ink transition hover:brightness-110 disabled:opacity-40"
                >
                  {busy === "save" ? "Saving…" : `✓ ${saveLabel}`}
                </button>
                {saveHint && (
                  <p className="text-[10px] leading-relaxed text-cream/45">
                    {saveHint}
                  </p>
                )}
              </>
            )}
            {isDeal && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => exportFile("zine", "colour", "Deal-page")}
                className="w-full rounded-full border border-plonkYellow/40 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-plonkYellow transition hover:bg-plonkYellow/10 disabled:opacity-40"
              >
                {busy === "Deal-page"
                  ? "Building…"
                  : "⬇ Deal poster · page shape"}
              </button>
            )}
            <button
              type="button"
              disabled={disabled}
              onClick={() => exportFile("ig", "colour", "IG-post")}
              className="w-full rounded-full bg-plonkPink px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:brightness-110 disabled:opacity-40"
            >
              {busy === "IG-post" ? "Building…" : "⬇ Instagram post · 1080×1350"}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => exportFile("story", "colour", "IG-story")}
              className="w-full rounded-full border border-cream/25 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-cream/90 transition hover:bg-cream/5 disabled:opacity-40"
            >
              {busy === "IG-story"
                ? "Building…"
                : "⬇ Instagram story · 1080×1920"}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => exportFile("a3", a3Mode, "A3-print")}
              className="w-full rounded-full border border-cream/25 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-cream/90 transition hover:bg-cream/5 disabled:opacity-40"
            >
              {busy === "A3-print"
                ? "Building…"
                : treatment === "natural"
                  ? "⬇ A3 print · full colour"
                  : "⬇ A3 print · black on coloured paper"}
            </button>
          </div>
        </div>
      </div>

      {/* Library picker — handles its own full-screen portal. */}
      {showLibrary && (
        <MediaPicker
          onClose={() => setShowLibrary(false)}
          onPick={(value) => {
            setShowLibrary(false);
            setDone("");
            if (photos.length >= MAX_PHOTOS) {
              setErr(`You can put up to ${MAX_PHOTOS} pictures on a poster.`);
              return;
            }
            const url = typeof value === "string" ? value : value.src;
            // A library image already has a storage URL — it doubles as the
            // persisted source photo.
            const p = makePhoto(url, url.split("/").pop() || "", url);
            setPhotos((ps) => [...ps, p]);
            setSelId(p.id);
            setErr("");
          }}
        />
      )}
    </div>
  );
}
