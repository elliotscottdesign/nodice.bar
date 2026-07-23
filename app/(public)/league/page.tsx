"use client";

import Link from "next/link";
import { useGallery } from "@/lib/content";
import LeagueTable from "@/components/LeagueTable";

// /league — the live No Dice pool league table, hosted for customers. The pool
// hero image ("hero.pool") sits behind everything, washed in deep purple to
// match the pool page. Read-only; the standings come from the public getLeague.

const FALLBACK_HERO =
  "https://rntcujcpsozvuxvmlejv.supabase.co/storage/v1/object/public/media/gallery/hero.pool/1780752253680-pool-bitmap.png";

export default function LeaguePage() {
  const imgs = useGallery("hero.pool", [{ src: FALLBACK_HERO, alt: null }]);
  const bg = imgs?.[0]?.src || FALLBACK_HERO;

  return (
    <main
      className="relative min-h-screen bg-cover bg-fixed bg-center"
      style={{ backgroundImage: `url(${bg})` }}
    >
      {/* Deep-purple wash over the pool header image */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[#4c1d95]/45 mix-blend-multiply" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-[#1a0f2e]/72 to-black/92" />

      <section className="relative z-10 px-6 pb-24 pt-20 sm:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-violet-300">No Dice · Hackney</p>
          <h1 className="mt-3 font-display text-5xl uppercase tracking-wider text-white sm:text-6xl">
            Pool League
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-violet-100/70">
            Every Wednesday counts. Play the nights, climb the table — the top 8 seed the grand final.
          </p>
        </div>

        <div className="mt-12">
          <LeagueTable />
        </div>

        <div className="mt-14 text-center">
          <Link
            href="/pool"
            className="inline-block rounded-full bg-violet-500 px-9 py-4 text-sm font-bold uppercase tracking-widest text-white shadow-lg shadow-violet-500/30 transition hover:bg-violet-400"
          >
            Book a pool night →
          </Link>
        </div>
      </section>
    </main>
  );
}
