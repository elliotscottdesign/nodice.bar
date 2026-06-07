"use client";

import Link from "next/link";
import PageHero from "@/components/PageHero";
import TournamentSchedule from "@/components/TournamentSchedule";
import { useContent } from "@/lib/content";

// /pool — slider-led page. Hero IS the slider; below it sits a single
// "book a table" CTA so the page reads as a phone-friendly poster
// with one action.
//
// CMS surface:
//   • text       — useContent("pool.eyebrow"|"pool.title"|"pool.intro"
//                   |"pool.cta_label"|"pool.cta_href")
//   • hero img   — gallery key "hero.pool"  (upload 2+ portrait shots
//                   of the pool tables for an auto-cycling slider)

const FALLBACK_HERO = [""];

export default function PoolPage() {
  const eyebrow = useContent("pool.eyebrow", "American 7ft · Hackney");
  const title = useContent("pool.title", "Pool Tables");
  const intro = useContent(
    "pool.intro",
    "American 7ft pool tables. Walk in, book ahead for groups, or claim a table for the evening.",
  );
  const ctaLabel = useContent("pool.cta_label", "Book a pool table");
  const ctaHref = useContent("pool.cta_href", "/book/pool");

  return (
    <main>
      <PageHero
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        image={FALLBACK_HERO}
        eyebrowKey="pool.eyebrow"
        titleKey="pool.title"
        introKey="pool.intro"
        sliderKey="hero.pool"
      />

      <section className="px-6 pb-20 pt-4 text-center">
        <Link
          href={ctaHref}
          className="inline-block rounded-full bg-plonkPink px-10 py-4 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-plonkPink/90"
        >
          {ctaLabel}
        </Link>
        {/* Hero-images shortcut now floats over the hero itself
            (mounted by PageHero) — used to live down here, removed
            so it doesn't duplicate. */}
      </section>

      {/* Tournament sign-up section. Dropdown for Doubles / Singles,
          list of upcoming Wednesdays for the selected type, each one
          links to the paid sign-up form. Lives below the core pool
          info per the founder's brief. */}
      <TournamentSchedule />
    </main>
  );
}
