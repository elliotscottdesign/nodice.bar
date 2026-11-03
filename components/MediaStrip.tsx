"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import RollerDeck from "./RollerDeck";
import ManageGalleryLink from "./ManageGalleryLink";
import { Editable } from "./Editable";
import { useGallery, useContent } from "@/lib/content";

// A name rendered as an SVG whose viewBox is the text's own bounding box,
// so at width:100% it scales to FILL the tile's width — reading like a
// poster headline and auto-sizing on phone / tablet with no breakpoints.
// Measures after mount, and again once the custom font loads (its glyph
// widths differ from the fallback, so the first measurement would be off).
function FillName({
  text,
  color,
  fontFamily,
}: {
  text: string;
  color?: string;
  fontFamily?: string;
}) {
  const ref = useRef<SVGTextElement>(null);
  const [box, setBox] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const up = text.toUpperCase();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const measure = () => {
      if (cancelled || !el) return;
      try {
        const b = el.getBBox();
        if (b.width > 0) setBox({ x: b.x, y: b.y, w: b.width, h: b.height });
      } catch {
        /* getBBox throws if not yet rendered — ignore, re-run fires again */
      }
    };
    measure();
    const f = (document as unknown as { fonts?: FontFaceSet }).fonts;
    if (f?.ready) f.ready.then(measure).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [up, fontFamily]);
  return (
    <svg
      width="100%"
      viewBox={box ? `${box.x} ${box.y} ${box.w} ${box.h}` : undefined}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={text}
      style={{ display: "block", overflow: "visible" }}
    >
      <text
        ref={ref}
        x="0"
        y="0"
        fill={color || "currentColor"}
        style={{
          fontFamily: fontFamily || "inherit",
          fontWeight: 700,
          letterSpacing: "0.01em",
        }}
      >
        {up}
      </text>
    </svg>
  );
}

// =============================================================
// MediaStrip — full-width, swipe-able image scroller
// =============================================================
// A full-bleed horizontal rail of landscape photos, backed by the
// CMS gallery system (`gallery_images` keyed by `galleryKey`). Used
// for the venue + festive-menu strips on /xmas and /privatehire.
//
//   <MediaStrip galleryKey="venue.hackney" blankLabel="Venue photo" />
//
// Until the admin uploads photos the gallery is empty, so the strip
// renders `blankCount` styled PLACEHOLDER tiles — the page looks
// complete and the founder sees exactly where photos will land. Flip
// Edit mode on and the floating "Add / manage photos" pill jumps
// straight to the matching gallery editor; uploads replace the blanks
// automatically (ISR/live), no code change needed.
//
// Chrome (snap-scroll, edge fades, arrows, hidden scrollbar) is the
// shared <RollerDeck>, so it behaves like every other rail on the site.
export default function MediaStrip({
  galleryKey,
  heading,
  intro,
  headingKey,
  introKey,
  blankCount = 6,
  blankLabel = "Photo coming soon",
  aspect = "16 / 10",
  tint,
  headingClassName,
  headingSize,
  fade = true,
  showNames = false,
  nameColor,
  nameFontFamily,
  nameScale = 1,
  centerTiles = false,
}: {
  galleryKey: string;
  heading?: string;
  intro?: string;
  /** Optional CMS keys — when set, the heading/intro become editable
   *  in-place (Edit mode) like the rest of the site, with heading/intro
   *  as the fallback text. */
  headingKey?: string;
  introKey?: string;
  /** How many placeholder tiles to show while the gallery is empty. */
  blankCount?: number;
  blankLabel?: string;
  /** CSS aspect-ratio for each tile, e.g. "16 / 10" (landscape). */
  aspect?: string;
  /** Optional background tint class (e.g. "tint-forest"). */
  tint?: string;
  /** Optional override for the heading's font classes (Xmas pages use Shrikhand). */
  headingClassName?: string;
  /** Optional override for the heading's SIZE classes (default
   *  "text-2xl sm:text-3xl"). Bingo passes the big h1-matching sizes. */
  headingSize?: string;
  /** Edge-fade blends cards into a BLACK page; set false on a coloured/
   *  gradient background (e.g. the kids-party page) where it shows as a band. */
  fade?: boolean;
  /** Show a NAME under each photo (for line-ups like the /comedybingo
   *  comedians). Uses the image's caption, falling back to its alt text
   *  (so names typed in either admin field still appear). Off by default,
   *  so photo-only strips (parties / venue) render exactly as before. */
  showNames?: boolean;
  /** Fill colour for the names (e.g. the bingo red). Defaults to cream. */
  nameColor?: string;
  /** Font family for the names (e.g. the poster headline font). */
  nameFontFamily?: string;
  /** Width the name fills, as a fraction of the tile (centred). 1 = full
   *  width; 0.75 = 75%, i.e. reduced 25% from the centre. */
  nameScale?: number;
  /** Centre each tile in the viewport on phone (snap-centre + spacers), so
   *  the active image + its name sit dead-centre, not left-aligned. */
  centerTiles?: boolean;
}) {
  const images = useGallery(galleryKey, []);
  const hasImages = images.length > 0;

  // Heading / intro can be plain props or CMS-backed (editable in place).
  // useContent is called unconditionally with a no-op key when there's no
  // CMS key, so hook order stays stable.
  const headingCms = useContent(headingKey || "__none__", heading ?? "");
  const introCms = useContent(introKey || "__none__", intro ?? "");
  const headingText = headingKey ? headingCms : heading;
  const introText = introKey ? introCms : intro;

  return (
    <section className={`w-full ${tint ?? ""}`}>
      <div className="py-6 sm:py-8">
        {(headingText || headingKey) && (
          <div className="mx-auto mb-6 max-w-6xl px-6 text-center">
            <h2 className={`${headingClassName ?? "font-display uppercase tracking-wider"} ${headingSize ?? "text-2xl sm:text-3xl"} text-cream`}>
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

        {/* Full-width rail. The px-6 wrapper lets RollerDeck's -mx-6
            mobile bleed reach the screen edge; on sm+ it keeps a small
            inset so the scroll arrows sit in the gutter, not over a tile. */}
        <div className="relative px-6">
          <RollerDeck
            ariaLabel={heading || "Photo gallery"}
            fade={fade}
            centerMode={centerTiles}
          >
            {/* Leading spacer (phone only) gives the first tile room to
                snap-centre instead of sitting against the left edge. */}
            {centerTiles && (
              <div
                aria-hidden
                className="shrink-0 w-[calc(9vw-12px)] sm:hidden"
              />
            )}
            {(hasImages ? images : Array.from({ length: blankCount })).map(
              (tile, i) => {
                const img = hasImages
                  ? (tile as (typeof images)[number])
                  : null;
                // The visible name: prefer the caption, fall back to alt
                // (the founder may type the name into either field).
                const nameLabel = showNames
                  ? (img?.caption?.trim() || img?.alt?.trim() || "")
                  : "";
                return (
                  // Outer wrapper owns the tile width + scroll snap; the
                  // image box and the optional name label stack inside it,
                  // so the caption is locked to the image's width.
                  <div
                    key={img?.src || `blank-${i}`}
                    className={`shrink-0 w-[82vw] sm:w-[52vw] lg:w-[34vw] ${
                      centerTiles ? "snap-center sm:snap-start" : "snap-start"
                    }`}
                  >
                    <div
                      className="relative overflow-hidden rounded-2xl border border-cream/10 bg-white/[0.03]"
                      style={{ aspectRatio: aspect }}
                    >
                      {img?.src ? (
                        <Image
                          src={img.src}
                          alt={img.alt || ""}
                          fill
                          sizes="(min-width:1024px) 34vw, (min-width:640px) 52vw, 82vw"
                          style={{
                            objectFit:
                              img.position_fit === "contain"
                                ? "contain"
                                : "cover",
                            objectPosition: `${img.position_x ?? 50}% ${img.position_y ?? 50}%`,
                          }}
                          className="transition duration-500 hover:scale-105"
                        />
                      ) : (
                        <BlankTile label={blankLabel} />
                      )}
                    </div>
                    {/* Optional name under the photo — only when showNames
                        is set AND there's a name, so photo-only strips
                        (parties pages) are unchanged. Rendered as a
                        fill-to-width poster headline. */}
                    {nameLabel ? (
                      <div className="mt-2 flex justify-center px-1">
                        <div style={{ width: `${(nameScale ?? 1) * 100}%` }}>
                          <FillName
                            text={nameLabel}
                            color={nameColor}
                            fontFamily={nameFontFamily}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              },
            )}
            {/* Trailing spacer (phone only) so the last tile can also
                snap-centre rather than sticking to the right edge. */}
            {centerTiles && (
              <div
                aria-hidden
                className="shrink-0 w-[calc(9vw-12px)] sm:hidden"
              />
            )}
          </RollerDeck>
          <ManageGalleryLink galleryKey={galleryKey} label="Add / manage photos" />
        </div>
      </div>
    </section>
  );
}

// A styled empty frame shown until a real photo is uploaded.
function BlankTile({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 border border-dashed border-cream/20 text-cream/35">
      <svg
        width="34"
        height="34"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
      <span className="text-[11px] font-semibold uppercase tracking-widest">
        {label}
      </span>
    </div>
  );
}
