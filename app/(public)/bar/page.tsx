"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import PageHero from "@/components/PageHero";
import HeroSlider from "@/components/HeroSlider";
import ManageGalleryLink from "@/components/ManageGalleryLink";
import { useContent, useGallery } from "@/lib/content";

// /bar — single purpose: show the menu as a swipeable page slider,
// then show portrait drink photos below.
//
// CMS surface (everything below is editable from /admin):
//   • text       — useContent("bar.eyebrow"|"bar.title"|"bar.intro")
//   • hero img   — gallery key "hero.bar"           (upload 2+ for a slider)
//   • menu pages — gallery key "bar.menu_pages"     (the menu itself,
//                                                    one image per page)
//   • drinks     — gallery key "bar.drinks_slider"  (portrait shots)
//
// Fallback images point at existing public/images/* shots so the page
// is never empty before the founder has uploaded anything.

const FALLBACK_HERO = [
  "/images/PLONK-COCKTAILS_215298_L_web.jpg",
];

// Three placeholder pages so the slider has something to render before
// the founder uploads the real menu artwork. Swap by uploading to the
// bar.menu_pages gallery — that wins automatically.
const FALLBACK_MENU_PAGES: { src: string; alt: string | null }[] = [
  { src: "/images/PLONK-COCKTAILS_215298_L_web.jpg", alt: "Menu — page 1" },
  { src: "/images/PLONK-COCKTAILS_215335_SQ.jpg",    alt: "Menu — page 2" },
  { src: "/images/Margarita.jpg",                     alt: "Menu — page 3" },
];

const FALLBACK_DRINKS: { src: string; alt: string | null }[] = [
  { src: "/images/Margarita.jpg", alt: null },
  { src: "/images/PLONK-COCKTAILS_215298_L_web.jpg", alt: null },
  { src: "/images/PLONK-COCKTAILS_215335_SQ.jpg", alt: null },
];

export default function BarPage() {
  const eyebrow = useContent("bar.eyebrow", "Drinks · Cocktails · Pints");
  const title = useContent("bar.title", "The Bar");
  const intro = useContent(
    "bar.intro",
    "Cask + craft on rotation, classic cocktails poured properly, low-intervention wines and soft drinks done right.",
  );

  const menuPages = useGallery("bar.menu_pages", FALLBACK_MENU_PAGES);
  const sliderImages = useGallery("bar.drinks_slider", FALLBACK_DRINKS);

  return (
    <main>
      <PageHero
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        image={FALLBACK_HERO}
        eyebrowKey="bar.eyebrow"
        titleKey="bar.title"
        introKey="bar.intro"
        sliderKey="hero.bar"
      />

      {/* MENU SLIDER — the page IS the menu. Horizontal scroll-snap with
          prev/next + dots. Founder uploads each menu page as an image to
          the bar.menu_pages gallery (one upload = one page). */}
      <section className="px-6 pt-16 pb-12">
        <MenuSlider pages={menuPages} />
        <ManageGalleryLink
          galleryKey="bar.menu_pages"
          label="Upload / reorder MENU PAGES"
        />
      </section>

      {/* DRINKS SLIDER — portrait. Sits BELOW the menu per brief.
          Cross-fading hero slider component, max-w-sm so it reads as
          a focal "look at this drink" beat rather than a banner. */}
      <section className="px-6 pb-12">
        <div className="mx-auto max-w-sm">
          <div className="relative aspect-[3/4] overflow-hidden rounded-2xl">
            <HeroSlider images={sliderImages.map((i) => ({ src: i.src }))} />
          </div>
        </div>
        <ManageGalleryLink
          galleryKey="bar.drinks_slider"
          label="Manage drinks slider images / order"
        />
      </section>

      {/* Hero slider images live on a separate gallery — surface a jump
          button here too so admins can manage both from this page. */}
      <section className="px-6 pb-24">
        <ManageGalleryLink
          galleryKey="hero.bar"
          label="Manage hero images / order"
        />
      </section>
    </main>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MenuSlider — horizontal scroll-snap carousel for the bar menu pages.
// One image per page, full-width, portrait aspect. Prev/next arrows
// scroll by one page; dots reflect the current page and can be clicked
// to jump. Native scroll-snap means swipe works on mobile for free.
// ──────────────────────────────────────────────────────────────────────
function MenuSlider({
  pages,
}: {
  pages: { src: string; alt: string | null }[];
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // Inline scroll handler — React wires this up as a normal listener,
  // no useEffect / addEventListener / cleanup needed. Recalc the active
  // page on every scroll event (cheap: one rounding op).
  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    setActiveIdx(Math.round(el.scrollLeft / el.clientWidth));
  }

  function jumpTo(idx: number) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
  }

  if (pages.length === 0) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="relative">
        {/* Scrollable strip — one page per snap point. */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
        >
          {pages.map((p, i) => (
            <div
              key={`${p.src}-${i}`}
              className="flex w-full shrink-0 snap-center justify-center"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-ink">
                <Image
                  src={p.src}
                  alt={p.alt ?? `Menu page ${i + 1}`}
                  fill
                  sizes="(min-width: 768px) 720px, 100vw"
                  className="object-contain"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Prev arrow — disabled on the first page. */}
        <button
          type="button"
          aria-label="Previous page"
          onClick={() => jumpTo(Math.max(0, activeIdx - 1))}
          disabled={activeIdx === 0}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-ink/70 p-2 text-cream backdrop-blur transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Next arrow — disabled on the last page. */}
        <button
          type="button"
          aria-label="Next page"
          onClick={() => jumpTo(Math.min(pages.length - 1, activeIdx + 1))}
          disabled={activeIdx === pages.length - 1}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-ink/70 p-2 text-cream backdrop-blur transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Dot indicators — also clickable. Hidden if only one page. */}
      {pages.length > 1 && (
        <div className="mt-5 flex justify-center gap-2">
          {pages.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to page ${i + 1}`}
              onClick={() => jumpTo(i)}
              className={`h-2 rounded-full transition-all ${
                i === activeIdx ? "w-8 bg-plonkPink" : "w-2 bg-cream/30 hover:bg-cream/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
