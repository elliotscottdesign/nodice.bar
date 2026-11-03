"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useGallery, useContent } from "@/lib/content";
import { Editable } from "./Editable";
import ManageGalleryLink from "./ManageGalleryLink";

// =============================================================
// BingoLineup — the /comedybingo "line-up" of comedian photos
// =============================================================
// Two deliberately different layouts, one responsive component:
//   • DESKTOP (lg+): every face + name in ONE row spanning the full
//     page width (flex, each cell an equal share, no scroll).
//   • PHONE / TABLET: a horizontal snap carousel, each image CENTRED
//     in the frame (padding-based centring so the first/last also sit
//     dead-centre, not against an edge).
// Names sit ABOVE each photo, rendered as a fill-to-width SVG headline
// in the site display font (Bebas Neue) so they scale with the cell.
// Backed by the CMS gallery (`galleryKey`), same as MediaStrip.
// =============================================================

// A name rendered as an SVG whose viewBox is the text's bounding box, so
// at width:100% it scales to fill its cell — on desktop AND phone — with
// no per-breakpoint font sizes.
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
        /* not yet rendered */
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
        style={{ fontFamily: fontFamily || "inherit", letterSpacing: "0.01em" }}
      >
        {up}
      </text>
    </svg>
  );
}

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

export default function BingoLineup({
  galleryKey,
  heading,
  intro,
  headingKey,
  introKey,
  blankCount = 5,
  blankLabel = "Host / machine photo",
  nameColor,
  nameFontFamily,
}: {
  galleryKey: string;
  heading?: string;
  intro?: string;
  headingKey?: string;
  introKey?: string;
  blankCount?: number;
  blankLabel?: string;
  nameColor?: string;
  nameFontFamily?: string;
}) {
  const images = useGallery(galleryKey, []);
  const hasImages = images.length > 0;

  const headingCms = useContent(headingKey || "__none__", heading ?? "");
  const introCms = useContent(introKey || "__none__", intro ?? "");
  const headingText = headingKey ? headingCms : heading;
  const introText = introKey ? introCms : intro;

  const tiles = hasImages ? images : Array.from({ length: blankCount });

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
          {/* Phone/tablet: a centred snap carousel (padding on the scroll
              box = (50% − half a tile), so the first/last image centres).
              Desktop (lg+): a full-width flex row, every cell an equal
              share, no scroll. */}
          <div
            className="hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-[calc(50%-41vw)] sm:gap-4 sm:px-[calc(50%-24vw)] lg:snap-none lg:overflow-x-visible lg:px-6"
          >
            {tiles.map((tile, i) => {
              const img = hasImages
                ? (tile as (typeof images)[number])
                : null;
              const name =
                (img?.caption?.trim() || img?.alt?.trim() || "") as string;
              return (
                <div
                  key={img?.src || `blank-${i}`}
                  className="w-[82vw] shrink-0 snap-center sm:w-[48vw] lg:w-auto lg:min-w-0 lg:shrink lg:grow lg:basis-0"
                >
                  {/* Name above the photo */}
                  {name ? (
                    <div className="mb-2 flex justify-center px-1">
                      <div style={{ width: "90%" }}>
                        <FillName
                          text={name}
                          color={nameColor}
                          fontFamily={nameFontFamily}
                        />
                      </div>
                    </div>
                  ) : null}
                  <div
                    className="relative overflow-hidden rounded-2xl border border-cream/10 bg-white/[0.03]"
                    style={{ aspectRatio: "4 / 5" }}
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
