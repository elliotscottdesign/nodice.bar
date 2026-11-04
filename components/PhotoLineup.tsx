"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useGallery, useContent } from "@/lib/content";
import { Editable } from "./Editable";
import ManageGalleryLink from "./ManageGalleryLink";

// =============================================================
// PhotoLineup — reusable photo line-up / carousel
// =============================================================
// One responsive component, two layouts:
//   • DESKTOP (lg+): every photo in ONE row across the full page width
//     (equal cells, no scroll) — a clean line-up.
//   • PHONE / TABLET: a horizontal snap carousel, each photo CENTRED in
//     the frame (padding = half the empty space, so the first/last image
//     also sits dead-centre).
// Optional NAME above each photo (gallery caption, falling back to alt),
// rendered at ONE STANDARDISED font size: the largest that still lets the
// LONGEST name fit its cell on a single line. Every name is therefore the
// same size, and — because the name row is the same height for all — every
// image lines up at the exact same top edge and is the same size.
//
// Backed by the CMS gallery system (`galleryKey`), so uploads + the
// "Add / manage photos" pill work in Edit mode, same as MediaStrip.
//
//   <PhotoLineup galleryKey="bingo.gallery" heading="The line-up"
//     headingKey="bingo.gallery_title" nameColor="#D65139" />
// =============================================================

function BlankTile({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 border border-dashed border-cream/20 text-cream/35">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
      <span className="text-[11px] font-semibold uppercase tracking-widest">{label}</span>
    </div>
  );
}

export default function PhotoLineup({
  galleryKey,
  heading,
  intro,
  headingKey,
  introKey,
  blankCount = 5,
  blankLabel = "Photo",
  nameColor,
  nameFontFamily = '"Bebas Neue", Impact, sans-serif',
  aspect = "4 / 5",
  maxNamePx = 46,
}: {
  galleryKey: string;
  heading?: string;
  intro?: string;
  headingKey?: string;
  introKey?: string;
  blankCount?: number;
  blankLabel?: string;
  /** Colour for the names (default: cream). */
  nameColor?: string;
  /** Font family for the names (default: the site display font). */
  nameFontFamily?: string;
  /** Aspect-ratio of each photo (default portrait 4/5). */
  aspect?: string;
  /** Upper bound for the standardised name size, in px. */
  maxNamePx?: number;
}) {
  const images = useGallery(galleryKey, []);
  const hasImages = images.length > 0;

  const headingCms = useContent(headingKey || "__none__", heading ?? "");
  const introCms = useContent(introKey || "__none__", intro ?? "");
  const headingText = headingKey ? headingCms : heading;
  const introText = introKey ? introCms : intro;

  const tiles = hasImages ? images : Array.from({ length: blankCount });
  const names = tiles.map((t) => {
    const img = hasImages ? (t as (typeof images)[number]) : null;
    return (img?.caption?.trim() || img?.alt?.trim() || "") as string;
  });
  const namesKey = names.join("|");

  // ---- Standardised name sizing --------------------------------------
  // Measure the widest name (via canvas, at a reference size) and the cell
  // width, then pick the one font size that makes the longest name just fit.
  const cellRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [namePx, setNamePx] = useState(22);

  const recompute = useCallback(() => {
    const cell = cellRef.current;
    if (!cell) return;
    const avail = cell.clientWidth - 10; // small horizontal breathing room
    if (avail <= 0) return;
    const nonEmpty = names.filter(Boolean);
    if (nonEmpty.length === 0) return;
    const canvas =
      canvasRef.current ?? (canvasRef.current = document.createElement("canvas"));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const REF = 100;
    ctx.font = `${REF}px ${nameFontFamily}`;
    let maxW = 0;
    for (const n of nonEmpty) {
      const w = ctx.measureText(n.toUpperCase()).width;
      if (w > maxW) maxW = w;
    }
    if (maxW <= 0) return;
    const fit = (avail / maxW) * REF;
    const px = Math.max(10, Math.min(maxNamePx, fit));
    setNamePx((prev) => (Math.abs(prev - px) > 0.5 ? Math.round(px * 10) / 10 : prev));
  }, [namesKey, nameFontFamily, maxNamePx]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    recompute();
    const cell = cellRef.current;
    if (!cell) return;
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => recompute());
      ro.observe(cell);
    }
    // Re-measure once the custom font has actually loaded.
    const f = (document as unknown as { fonts?: FontFaceSet }).fonts;
    if (f?.ready) f.ready.then(() => recompute()).catch(() => {});
    window.addEventListener("resize", recompute);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [recompute]);

  return (
    <section className="w-full">
      <div className="py-6 sm:py-8">
        {(headingText || headingKey) && (
          <div className="mx-auto mb-6 max-w-6xl px-6 text-center">
            <h2 className="font-display text-4xl uppercase tracking-wider text-cream sm:text-5xl md:text-6xl">
              {headingKey ? (
                <Editable k={headingKey}>{headingText}</Editable>
              ) : (
                headingText
              )}
            </h2>
            {(introText || introKey) && (
              <p className="mt-2 text-sm text-cream/65">
                {introKey ? (
                  <Editable k={introKey}>{introText}</Editable>
                ) : (
                  introText
                )}
              </p>
            )}
          </div>
        )}

        <div className="relative">
          {/* Phone/tablet: centred snap carousel (padding = half the empty
              space so the first/last image centres). Desktop (lg+): a
              full-width flex row, every cell an equal share, no scroll. */}
          <div className="hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-[calc(50%-41vw)] sm:gap-4 sm:px-[calc(50%-24vw)] lg:snap-none lg:overflow-x-visible lg:px-6">
            {tiles.map((tile, i) => {
              const img = hasImages
                ? (tile as (typeof images)[number])
                : null;
              const name = names[i];
              return (
                <div
                  key={img?.src || `blank-${i}`}
                  ref={i === 0 ? cellRef : undefined}
                  className="w-[82vw] shrink-0 snap-center sm:w-[48vw] lg:w-auto lg:min-w-0 lg:shrink lg:grow lg:basis-0"
                >
                  {/* Name — one standardised size for every tile, in a
                      fixed-height row (always present) so images align. */}
                  <div
                    className="mb-3 flex items-end justify-center overflow-hidden px-1"
                    style={{ height: Math.round(namePx * 1.18) }}
                  >
                    <span
                      className="whitespace-nowrap uppercase leading-none"
                      style={{
                        fontSize: `${namePx}px`,
                        color: nameColor,
                        fontFamily: nameFontFamily,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {name}
                    </span>
                  </div>
                  <div
                    className="relative overflow-hidden rounded-2xl border border-cream/10 bg-white/[0.03]"
                    style={{ aspectRatio: aspect }}
                  >
                    {img?.src ? (
                      <Image
                        src={img.src}
                        alt={img.alt || ""}
                        fill
                        sizes="(min-width:1024px) 18vw, (min-width:640px) 48vw, 82vw"
                        style={{
                          objectFit:
                            img.position_fit === "contain" ? "contain" : "cover",
                          objectPosition: `${img.position_x ?? 50}% ${img.position_y ?? 50}%`,
                        }}
                        className="transition duration-500 hover:scale-105"
                      />
                    ) : (
                      <BlankTile label={blankLabel} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <ManageGalleryLink galleryKey={galleryKey} label="Add / manage photos" />
        </div>
      </div>
    </section>
  );
}
