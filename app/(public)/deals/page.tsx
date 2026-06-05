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

const FALLBACK_HERO = ["/images/PLONK-COCKTAILS_215298_L_web.jpg"];

const FALLBACK_GRID: { src: string; alt: string | null }[] = [
  { src: "/images/PLONK-COCKTAILS_215298_L_web.jpg", alt: null },
  { src: "/images/Margarita.jpg", alt: null },
  { src: "/images/PLONK-COCKTAILS_215335_SQ.jpg", alt: null },
  { src: "/images/PLONK-HACKNEY-NOV-220190_web.jpg", alt: null },
  { src: "/images/PLONK-HACKNEY-NOV-220217_Web.jpg", alt: null },
  { src: "/images/PLONK_AT_HOME_1.jpg", alt: null },
  { src: "/images/PLONK_LF_AW_OCt_20_web.jpg", alt: null },
  { src: "/images/Plonk_Hackeny_1976_web.jpg", alt: null },
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
          {/* 4 cols × 2 rows on tablet+ (sm); 2 cols × 4 rows on mobile.
              Up to 10 tiles render — extra uploads are silently dropped
              so the layout stays clean. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {images.slice(0, 10).map((img, i) => (
              <div
                key={`${img.src}-${i}`}
                className="relative aspect-[3/4] overflow-hidden rounded-xl"
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
          {/* Admin-only jump buttons — hidden when not in edit mode. */}
          <ManageGalleryLink
            galleryKey="deals.grid"
            label="Manage deals grid / order"
          />
          <ManageGalleryLink
            galleryKey="hero.deals"
            label="Manage hero images / order"
          />
        </div>
      </section>
    </main>
  );
}
