"use client";

import Image from "next/image";
import PageHero from "@/components/PageHero";
import ManageGalleryLink from "@/components/ManageGalleryLink";
import { useContent, useGallery } from "@/lib/content";

// /deals — image-led page per founder brief. A 4×2 (cols × rows) grid
// on tablet+, collapses to 2×4 on mobile portrait. Each tile is
// portrait aspect (3:4) so phones read the page as a vertical stack
// of paired posters.
//
// CMS surface:
//   • text       — useContent("deals.eyebrow"|"deals.title"|"deals.intro")
//   • hero img   — gallery key "hero.deals"  (slider above the grid)
//   • grid imgs  — gallery key "deals.grid"  (upload 7–10 portrait
//                   poster images; first 10 render in order)
//
// The page renders WHATEVER images are uploaded to deals.grid — no
// captions, no text overlays, just the images as a clean grid. If
// the founder wants text on each tile, render the words into the
// poster image itself (Canva / Photoshop / Figma).

const FALLBACK_HERO = [""];

const FALLBACK_GRID: { src: string; alt: string | null }[] = [
  { src: "", alt: null },
  { src: "", alt: null },
  { src: "", alt: null },
  { src: "", alt: null },
  { src: "", alt: null },
  { src: "", alt: null },
  { src: "", alt: null },
  { src: "", alt: null },
];

export default function DealsPage() {
  const eyebrow = useContent("deals.eyebrow", "What's on this month");
  const title = useContent("deals.title", "Deals");
  const intro = useContent(
    "deals.intro",
    "Off-peak deals on drinks, food and games. New posters added every month — tap an image for the small print.",
  );

  const images = useGallery("deals.grid", FALLBACK_GRID);

  return (
    <main>
      <PageHero
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        image={FALLBACK_HERO}
        eyebrowKey="deals.eyebrow"
        titleKey="deals.title"
        introKey="deals.intro"
        sliderKey="hero.deals"
      />

      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          {/* Admin-only jump button ABOVE the grid so it's discoverable.
              Hidden when not in edit mode. The PageHero above this
              section already renders a separate button for the HERO
              slider, so this one is labelled explicitly for the GRID
              to avoid confusion. */}
          <ManageGalleryLink
            galleryKey="deals.grid"
            label="Upload / edit / reorder DEALS GRID images"
          />

          {/* 4 cols × 2 rows on tablet+ (sm); 2 cols × 4 rows on mobile.
              Up to 10 tiles render — extra uploads are silently dropped
              so the layout stays clean. */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {images.slice(0, 10).map((img, i) => (
              <div
                key={`${img.src}-${i}`}
                className="relative aspect-[9/16] overflow-hidden rounded-xl"
              >
                <Image
                  src={img.src}
                  alt={img.alt ?? ""}
                  fill
                  sizes="(min-width: 640px) 25vw, 50vw"
                  className="object-cover transition duration-500 hover:scale-105"
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
