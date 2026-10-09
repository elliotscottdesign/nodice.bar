"use client";

import Image from "next/image";
import RollerDeck from "./RollerDeck";
import ManageGalleryLink from "./ManageGalleryLink";
import { Editable } from "./Editable";
import { useGallery, useContent } from "@/lib/content";

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
            <h2 className="font-display text-2xl uppercase tracking-wider text-cream sm:text-3xl">
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
          <RollerDeck ariaLabel={heading || "Photo gallery"}>
            {(hasImages ? images : Array.from({ length: blankCount })).map(
              (tile, i) => {
                const img = hasImages
                  ? (tile as (typeof images)[number])
                  : null;
                return (
                  <div
                    key={img?.src || `blank-${i}`}
                    className="relative shrink-0 snap-start overflow-hidden rounded-2xl border border-cream/10 bg-white/[0.03] w-[82vw] sm:w-[52vw] lg:w-[34vw]"
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
                );
              },
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
