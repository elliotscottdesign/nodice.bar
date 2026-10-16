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
import { RAL, ralLabel, ralSearch } from "@/lib/poster/ralColours";
import { eventQrUrl } from "@/lib/poster/qr";
import {
  PALETTE,
  canvasToBlob,
  coverRect,
  downloadCanvas,
  ensureFont,
  fontReady,
  frameAspect,
  loadImage,
  posterName,
  renderEventPoster,
  type PosterSize,
  type PosterTreatment,
} from "@/lib/poster/engine";

function describe(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
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

// CSS aspect-ratio for each preview shape, so the canvas box matches the file.
// 'zine' is the A-series page ratio (1:√2) — the deal / zine-cover shape.
const PREVIEW_AR: Record<PosterSize, string> = {
  ig: "4 / 5",
  story: "9 / 16",
  zine: "1 / 1.41421",
  a3: "1 / 1.41421",
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
   * is the default preview and the one "Save" writes onto the event, and the ink
   * defaults to Cream so it inverts to near-black on the stock.
   */
  isDeal?: boolean;
  /**
   * Called with the uploaded poster's public URL once it's safely in storage.
   * Omit to hide the save button (e.g. nothing to save onto yet).
   */
  onSave?: (url: string) => void | Promise<void>;
  saveLabel?: string;
  saveHint?: string;
}) {
  // A deal's saved poster is page-shaped ("zine"); everything else saves the
  // 4:5 Instagram post exactly as before.
  const saveSize: PosterSize = isDeal ? "zine" : "ig";
  // ---- Picture ----
  const [picUrl, setPicUrl] = useState("");
  const [picName, setPicName] = useState("");
  const [showLibrary, setShowLibrary] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // ---- Look ----
  // Deals default to Cream — the lightest ink — because the drinks zine inverts
  // the saved poster to print it, and light ink on the black ground inverts to
  // near-black on the coloured stock. Everything else keeps the house Pink.
  const [colour, setColour] = useState(
    (
      PALETTE.find((p) => p.name === (isDeal ? "Cream" : "Pink")) || PALETTE[0]
    ).hex,
  );
  const [showRal, setShowRal] = useState(false);
  const [ralQ, setRalQ] = useState("");
  const [treatment, setTreatment] = useState<PosterTreatment>("scatter");
  const [exposure, setExposure] = useState(1);
  const [pos, setPos] = useState({ ox: 0.5, oy: 0.5 });
  const [zoom, setZoom] = useState(1);

  // ---- Copy that goes on the poster ----
  // Both lines are SUGGESTED from the event above and keep following it as the
  // founder types — until he edits the line himself, after which his wording
  // wins and nothing overwrites it.
  const [detail, setDetail] = useState(() => suggestDetail(description));
  const [detailTouched, setDetailTouched] = useState(false);
  const [price, setPrice] = useState(defaultPrice || "");
  const [priceTouched, setPriceTouched] = useState(false);
  useEffect(() => {
    if (!detailTouched) setDetail(suggestDetail(description));
  }, [description, detailTouched]);
  useEffect(() => {
    if (!priceTouched) setPrice(defaultPrice || "");
  }, [defaultPrice, priceTouched]);

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

  // Load whichever picture is selected (upload or library).
  useEffect(() => {
    let alive = true;
    setErr("");
    if (!picUrl) {
      imgRef.current = null;
      bump();
      return;
    }
    loadImage(picUrl)
      .then((im) => {
        if (!alive) return;
        imgRef.current = im;
        setPos({ ox: 0.5, oy: 0.5 });
        setZoom(1);
        bump();
      })
      .catch((e) => {
        if (!alive) return;
        imgRef.current = null;
        setErr(describe(e, "Couldn't load that picture."));
        bump();
      });
    return () => {
      alive = false;
    };
  }, [picUrl]);

  const hasPic = !!imgRef.current;

  const render = useCallback(
    (size: PosterSize, mode: "colour" | "negative") =>
      renderEventPoster({
        name,
        date,
        start,
        end,
        detail,
        price,
        colour,
        size,
        mode,
        treatment,
        imgs: imgRef.current
          ? [
              {
                img: imgRef.current,
                exposure,
                ox: pos.ox,
                oy: pos.oy,
                z: zoom,
              },
            ]
          : [],
      }),
    [
      name,
      date,
      start,
      end,
      detail,
      price,
      colour,
      treatment,
      exposure,
      pos,
      zoom,
    ],
  );

  // Live preview. Renders at full poster resolution into the canvas and lets CSS
  // scale it down, so the preview stays sharp on a retina phone.
  useEffect(() => {
    if (!hasPic) return;
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

  // The little crop well — exact crop, no halftone, so dragging feels direct.
  const wellAspect = frameAspect(previewSize, !!detail.trim(), !!price.trim());
  const WELL_W = 116;
  const WELL_H = Math.round(WELL_W / wellAspect);
  useEffect(() => {
    const c = wellRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    const img = imgRef.current;
    if (!img) return;
    const r = coverRect(
      img.width,
      img.height,
      c.width,
      c.height,
      pos.ox,
      pos.oy,
      zoom,
    );
    ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, c.width, c.height);
  }, [pos, zoom, tick, WELL_H]);

  // Drag the picture inside the well to choose what's in frame.
  function startReposition(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX,
      sy = e.clientY;
    const base = pos;
    const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / rect.width,
        dy = (ev.clientY - sy) / rect.height;
      // drag the picture → reveal the opposite side
      setPos({ ox: cl(base.ox - dx), oy: cl(base.oy - dy) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // Upload straight off the phone. The poster renders from a local copy right
  // away (no waiting for the network), and the file is filed into the media
  // library in the background so it can be reused later.
  async function onUpload(file: File | undefined) {
    if (!file) return;
    setErr("");
    setDone("");
    setPicName(file.name);
    setPicUrl(URL.createObjectURL(file));
    setBusy("upload");
    try {
      await uploadImage(file, "event-posters");
    } catch (e) {
      // Non-fatal: the poster still works off the local copy.
      setErr(
        `${describe(e, "Upload failed")} — the poster still works, but this picture wasn't saved to the media library.`,
      );
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
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
    if (!hasPic) return;
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
    if (!hasPic || !onSave) return;
    if (
      currentPosterUrl &&
      !window.confirm(
        `This event already has artwork on it. Saving this poster will replace it — the old picture stays in the media library, but the event will show this poster instead.\n\nGo ahead?`,
      )
    )
      return;
    setBusy("save");
    setErr("");
    setDone("");
    try {
      const cv = await render(saveSize, "colour");
      const blob = await canvasToBlob(cv);
      const file = new File([blob], posterName(name, date, "poster"), {
        type: "image/png",
      });
      const { public_url } = await uploadImage(file, "event-posters");
      await onSave(public_url);
      setDone("Saved — this poster is now the event's artwork on nodice.bar/events.");
    } catch (e) {
      setErr(
        `${describe(e, "Couldn't save the poster.")} The event's existing artwork hasn't been changed.`,
      );
    } finally {
      setBusy("");
    }
  }

  const disabled = !hasPic || !!busy || fontOk === false;

  // True when the active colour is one of the quick-pick swatches. When it isn't,
  // it came from the RAL chart (or the custom picker), so the RAL pill shows that
  // colour and reads as "active" — the quick-pick row has nothing to highlight.
  const colourIsPalette = PALETTE.some(
    (p) => p.hex.toLowerCase() === colour.toLowerCase(),
  );

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
          {hasPic ? (
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
          {/* Every poster carries a QR code in its top right corner — including
              the A3 print, where it comes out in the same black ink. */}
          <p className="mt-2 max-w-[236px] text-[10px] leading-relaxed text-cream/40">
            The QR code top right opens{" "}
            <span className="break-all text-cream/60">
              {eventQrUrl(date).replace(/^https:\/\//, "")}
            </span>{" "}
            when it&apos;s scanned.
          </p>
        </div>

        {/* ───── Controls ───── */}
        <div className="min-w-0 flex-1 space-y-5">
          {/* Picture */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-cream/55">
              Picture
            </p>
            <div className="flex gap-3">
              <div className="shrink-0">
                {hasPic ? (
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
                {hasPic && (
                  <label className="mt-1.5 block">
                    <span className="flex justify-between text-[9px] text-cream/45">
                      <span>Zoom</span>
                      <span>{zoom.toFixed(1)}×</span>
                    </span>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="0.05"
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-full touch-none accent-plonkPink"
                      style={{ width: WELL_W }}
                    />
                  </label>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <label
                    className={`${PILL} cursor-pointer border-cream/20 text-cream/85 hover:bg-cream/5 ${
                      busy === "upload" ? "opacity-60" : ""
                    }`}
                  >
                    {busy === "upload"
                      ? "Uploading…"
                      : hasPic
                        ? "↻ Upload another"
                        : "⬆ Upload"}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => onUpload(e.target.files?.[0])}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowLibrary(true)}
                    className={`${PILL} border-cream/20 text-cream/85 hover:bg-cream/5`}
                  >
                    🗂 Library
                  </button>
                </div>
                {picName && (
                  <p className="truncate text-[10px] text-cream/45" title={picName}>
                    {picName}
                  </p>
                )}
                <label className="block">
                  <span className="flex justify-between text-[10px] text-cream/45">
                    <span>Exposure</span>
                    <span>
                      {exposure < 0.92
                        ? "darker"
                        : exposure > 1.08
                          ? "lighter"
                          : "auto"}
                    </span>
                  </span>
                  <input
                    type="range"
                    min="0.6"
                    max="1.5"
                    step="0.05"
                    value={exposure}
                    onChange={(e) => setExposure(Number(e.target.value))}
                    className="w-full touch-none py-1 accent-plonkPink"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["scatter", "Scatter", "The house grainy halftone look"],
                      ["natural", "Natural", "The real photo, not rasterised"],
                      [
                        "whites",
                        "Whites to colour",
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
                      ? "Grey photo with the white bits turned the poster colour. Use Exposure to let more or less colour through. The A3 prints black on coloured paper."
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
              {PALETTE.map((p) => (
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

          {/* Words on the poster */}
          <div>
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
                <span className="mb-1 block text-[10px] text-cream/45">
                  One short line (optional)
                </span>
                <input
                  value={detail}
                  onChange={(e) => {
                    setDetailTouched(true);
                    setDetail(e.target.value);
                  }}
                  maxLength={70}
                  placeholder="e.g. Prizes all night"
                  className="w-full rounded-md border border-cream/20 bg-ink px-2.5 py-1.5 text-xs text-cream placeholder:text-cream/35"
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
                  maxLength={40}
                  placeholder="e.g. £5 on the door / Free entry"
                  className="w-full rounded-md border border-cream/20 bg-ink px-2.5 py-1.5 text-xs text-cream placeholder:text-cream/35"
                />
              </label>
            </div>
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
            const url = typeof value === "string" ? value : value.src;
            setPicUrl(url);
            setPicName(url.split("/").pop() || "");
            setShowLibrary(false);
            setDone("");
          }}
        />
      )}
    </div>
  );
}
