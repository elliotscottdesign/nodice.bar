"use client";

// =============================================================
// PosterDownloads — download an event's poster, outside the maker
// =============================================================
// Founder rule (26 Oct): "all download option must live outside of poster
// maker - poster maker only has option to save to event". Downloading belongs
// to the event, not to an edit in progress — so these buttons sit in the event
// form and work on the poster that's ALREADY there, with nothing to remake
// first. In the maker they were disabled until a picture was loaded, which is
// why opening an event and grabbing its poster was impossible.
//
// Two routes, and it picks whichever it can:
//   • the event has a saved recipe → re-make any size on demand from the same
//     settings and the same photos, so post, story and A3 all match each other
//     and match what's live.
//   • it doesn't (an older event, or artwork uploaded by hand) → offer the
//     actual files on the event instead, so there's always something to click.
// =============================================================

import { useEffect, useRef, useState } from "react";
import Notice from "@/components/Notice";
import { parseRecipe, type PosterRecipe } from "@/components/admin/posterRecipe";
import {
  downloadCanvas,
  ensureFont,
  loadImage,
  posterName,
  renderEventPoster,
  type PosterSize,
} from "@/lib/poster/engine";

function describe(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

// Save a file the event already has, as-is. No re-rendering, so what lands in
// Downloads is exactly what's live on the site.
async function downloadExisting(url: string, filename: string): Promise<void> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`Couldn't fetch that file (${res.status}).`);
  const blob = await res.blob();
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1500);
}

const BTN =
  "w-full rounded-full px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition disabled:opacity-40";

export default function PosterDownloads({
  name,
  date,
  start,
  end,
  posterUrl,
  flyerPosterUrl,
  recipe,
  isDeal,
}: {
  name: string;
  date: string;
  start?: string | null;
  end?: string | null;
  /** The artwork currently on the event. */
  posterUrl?: string | null;
  /** The black-on-transparent print version, when the event has one. */
  flyerPosterUrl?: string | null;
  /** How the poster was built — carries every photo with its own crop. */
  recipe?: PosterRecipe | Record<string, unknown> | null;
  isDeal?: boolean;
}) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const [ready, setReady] = useState(false);
  const imgsRef = useRef<HTMLImageElement[]>([]);

  const r = parseRecipe(recipe as Record<string, unknown> | null);
  // Re-making a size needs the photos it was built from.
  const canRemake = !!r.photos?.length;
  const photoKey = (r.photos ?? []).map((p) => p.sourceUrl).join("|");

  useEffect(() => {
    let alive = true;
    setReady(false);
    imgsRef.current = [];
    const list = r.photos ?? [];
    if (!list.length) return;
    ensureFont();
    Promise.all(list.map((p) => loadImage(p.sourceUrl)))
      .then((imgs) => {
        if (!alive) return;
        imgsRef.current = imgs;
        setReady(true);
      })
      .catch(() => {
        // Not fatal — the "file on the event" buttons still work.
        if (alive) setReady(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoKey]);

  async function remake(size: PosterSize, tag: string) {
    const imgs = imgsRef.current;
    const list = r.photos ?? [];
    if (!imgs.length) return;
    setBusy(tag);
    setErr("");
    setDone("");
    try {
      const ok = await ensureFont();
      if (!ok)
        throw new Error(
          "The poster typeface didn't load, so the download would come out in the wrong font. Reload the page and try again.",
        );
      // A3 prints black on coloured paper, except for an untouched photo,
      // which can't print as black ink and goes out in full colour instead.
      const mode =
        size === "a3" && r.treatment !== "natural" ? "negative" : "colour";
      const cv = await renderEventPoster({
        name,
        date,
        start,
        end,
        detail: r.detail,
        price: r.price,
        colour: r.colour || "#FF006A",
        size,
        mode,
        treatment: r.treatment ?? "scatter",
        dealLayout: isDeal,
        textBox: isDeal ? r.textBox : undefined,
        titleScale: r.titleSize,
        footer: isDeal ? r.footer : undefined,
        dayLabel: isDeal ? r.dayLabel : undefined,
        qrUrl: isDeal && r.qr ? r.qr : undefined,
        imgs: imgs.map((img, i) => ({
          img,
          exposure: list[i]?.exposure ?? 1,
          ox: list[i]?.ox ?? 0.5,
          oy: list[i]?.oy ?? 0.5,
          z: list[i]?.zoom ?? 1,
          caption: list[i]?.caption,
        })),
      });
      await downloadCanvas(cv, posterName(name, date, tag));
      setDone("Downloaded — it's in your Downloads folder.");
    } catch (e) {
      setErr(describe(e, "Couldn't make that download."));
    } finally {
      setBusy("");
    }
  }

  async function grab(url: string, tag: string, label: string) {
    setBusy(tag);
    setErr("");
    setDone("");
    try {
      await downloadExisting(url, posterName(name, date, label));
      setDone("Downloaded — it's in your Downloads folder.");
    } catch (e) {
      setErr(describe(e, "Couldn't download that file."));
    } finally {
      setBusy("");
    }
  }

  if (!posterUrl && !canRemake) {
    return (
      <p className="text-[11px] leading-relaxed text-cream/45">
        No poster on this event yet — make one in the poster maker above and the
        downloads appear here.
      </p>
    );
  }

  const remakeDisabled = !ready || !!busy;

  return (
    <div className="space-y-2">
      {err && <Notice variant="error">{err}</Notice>}
      {done && <Notice variant="success">{done}</Notice>}

      <div className="flex items-start gap-3">
        {posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterUrl}
            alt=""
            className="h-20 w-16 shrink-0 rounded border border-cream/15 object-cover"
          />
        )}
        <p className="text-[11px] leading-relaxed text-cream/50">
          {canRemake
            ? "These are made from the poster that's on this event — you don't have to build it again."
            : "This event's artwork was made before the maker started remembering how, so only the file itself can be downloaded. Save it once in the poster maker to get the other sizes."}
        </p>
      </div>

      {canRemake ? (
        <>
          {isDeal && (
            <button
              type="button"
              disabled={remakeDisabled}
              onClick={() => remake("zine", "Deal-page")}
              className={`${BTN} border border-plonkYellow/40 text-plonkYellow hover:bg-plonkYellow/10`}
            >
              {busy === "Deal-page" ? "Building…" : "⬇ Deal poster · page shape"}
            </button>
          )}
          <button
            type="button"
            disabled={remakeDisabled}
            onClick={() => remake("ig", "IG-post")}
            className={`${BTN} bg-plonkPink text-white hover:brightness-110`}
          >
            {busy === "IG-post" ? "Building…" : "⬇ Instagram post · 1080×1350"}
          </button>
          <button
            type="button"
            disabled={remakeDisabled}
            onClick={() => remake("story", "IG-story")}
            className={`${BTN} border border-cream/25 text-cream/90 hover:bg-cream/5`}
          >
            {busy === "IG-story" ? "Building…" : "⬇ Instagram story · 1080×1920"}
          </button>
          <button
            type="button"
            disabled={remakeDisabled}
            onClick={() => remake("a3", "A3-print")}
            className={`${BTN} border border-cream/25 text-cream/90 hover:bg-cream/5`}
          >
            {busy === "A3-print"
              ? "Building…"
              : r.treatment === "natural"
                ? "⬇ A3 print · full colour"
                : "⬇ A3 print · black on coloured paper"}
          </button>
          {!ready && (
            <p className="text-[10px] text-cream/40">Loading the picture…</p>
          )}
        </>
      ) : (
        posterUrl && (
          <button
            type="button"
            disabled={!!busy}
            onClick={() => grab(posterUrl, "file", "poster")}
            className={`${BTN} bg-plonkPink text-white hover:brightness-110`}
          >
            {busy === "file" ? "Downloading…" : "⬇ The poster on this event"}
          </button>
        )
      )}

      {flyerPosterUrl && (
        <button
          type="button"
          disabled={!!busy}
          onClick={() => grab(flyerPosterUrl, "flyerfile", "print-flyer")}
          className={`${BTN} border border-cream/25 text-cream/90 hover:bg-cream/5`}
        >
          {busy === "flyerfile"
            ? "Downloading…"
            : "⬇ Print flyer · the file in the zine"}
        </button>
      )}
    </div>
  );
}
