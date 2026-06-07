"use client";

import Link from "next/link";
import PageHero from "@/components/PageHero";
import MatchSchedule from "@/components/MatchSchedule";
import { useContent } from "@/lib/content";

// /world-cup — mirrors /pool's structure (named with a hyphen
// because /worldcup is taken by the investor-deck strategy planner
// on the same nodice.bar domain):
//   • Hero  — slider-led, content editable via the CMS
//   • CTA   — "Reserve a table" → /book/table
//   • Below — MatchSchedule (roller-deck of upcoming fixtures)
//
// CMS surface:
//   • text       — useContent("worldcup.eyebrow"|"worldcup.title"
//                  |"worldcup.intro"|"worldcup.cta_label"|"worldcup.cta_href")
//   • hero img   — gallery key "hero.worldcup" (founder uploads
//                   crowd / big-screen shots to the gallery for an
//                   auto-cycling slider)

const FALLBACK_HERO = [""];

export default function WorldCupPage() {
  const eyebrow = useContent(
    "worldcup.eyebrow",
    "Match nights · Hackney",
  );
  const title = useContent("worldcup.title", "World Cup at No Dice");
  const intro = useContent(
    "worldcup.intro",
    "Big screens, full sound, proper crowd. Every match shown live — reserve a table for the headline games before they fill up.",
  );
  const ctaLabel = useContent("worldcup.cta_label", "Reserve a table");
  const ctaHref = useContent("worldcup.cta_href", "/book/table");

  return (
    <main>
      <PageHero
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        image={FALLBACK_HERO}
        eyebrowKey="worldcup.eyebrow"
        titleKey="worldcup.title"
        introKey="worldcup.intro"
        sliderKey="hero.worldcup"
      />

      <section className="px-6 pb-20 pt-4 text-center">
        <Link
          href={ctaHref}
          className="inline-block rounded-full bg-plonkPink px-10 py-4 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-plonkPink/90"
        >
          {ctaLabel}
        </Link>
      </section>

      {/* Roller-deck of upcoming matches. Each card pre-fills the
          /book/table flow with the match date. */}
      <MatchSchedule />
    </main>
  );
}
