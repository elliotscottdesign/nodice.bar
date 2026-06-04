"use client";

import Image from "next/image";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import HeroSlider from "@/components/HeroSlider";
import { useContent, useGallery } from "@/lib/content";

// /bar — single purpose: lead to the menu, then show portrait drink
// photos in a slider below.
//
// CMS surface (everything below is editable from /admin):
//   • text       — useContent("bar.eyebrow"|"bar.title"|"bar.intro"
//                   |"bar.menu_heading"|"bar.menu_body"
//                   |"bar.menu_cta_label"|"bar.menu_cta_href")
//   • hero img   — gallery key "hero.bar"  (upload 2+ for a slider)
//   • drinks     — gallery key "bar.drinks_slider"  (portrait shots)
//
// Fallback images point at existing public/images/* shots so the page
// is never empty before the founder has uploaded anything.

const FALLBACK_HERO = [
  "/images/PLONK-COCKTAILS_215298_L_web.jpg",
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
  const menuHeading = useContent("bar.menu_heading", "See what's pouring");
  const menuBody = useContent(
    "bar.menu_body",
    "Our menu shifts seasonally. Tap below for the current list.",
  );
  const menuCtaLabel = useContent("bar.menu_cta_label", "View the menu");
  const menuCtaHref = useContent("bar.menu_cta_href", "#");

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

      {/* MENU LEAD — the sole purpose of this page. Single CTA, no clutter. */}
      <section className="px-6 py-20 text-center">
        <h2 className="font-display text-4xl uppercase tracking-wider sm:text-5xl">
          {menuHeading}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-cream/75">
          {menuBody}
        </p>
        <Link
          href={menuCtaHref}
          className="mt-8 inline-block rounded-full bg-plonkPink px-10 py-4 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-plonkPink/90"
        >
          {menuCtaLabel}
        </Link>
      </section>

      {/* DRINKS SLIDER — portrait. Sits BELOW the menu lead per brief.
          aspect-[3/4] is gentle-portrait (magazine ratio); swap to
          aspect-[9/16] if a tighter "Instagram story" crop is wanted. */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-sm">
          <div className="relative aspect-[3/4] overflow-hidden rounded-2xl">
            <HeroSlider images={sliderImages.map((i) => ({ src: i.src }))} />
          </div>
        </div>
      </section>
    </main>
  );
}
