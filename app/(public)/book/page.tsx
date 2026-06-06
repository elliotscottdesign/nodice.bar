"use client";

import Image from "next/image";
import Link from "next/link";
import { useContent, useImage } from "@/lib/content";

// /book — the bookings landing. Four cards (Tables / Pool / Parties /
// Golf) per founder brief. Now CMS-driven: every label, blurb, image
// and link is editable from /admin/content/info/book.
//
// Hardcoded fallbacks below mirror the seeded values so the page
// renders immediately even on a fresh DB. The useContent hook returns
// the DB value when present and the fallback otherwise.

const FALLBACK_CARDS = [
  {
    id: "tables",
    name: "Tables",
    tagline: "Dinner · Drinks · Groups",
    blurb: "Reserve a table for dinner, drinks or a group of friends. Hackney only.",
    image: "",
    // Tables go to the bar-table reservation flow, NOT the legacy
    // /book/hackney golf-only catalogue inherited from the fork.
    href: "/book/table",
  },
  {
    id: "pool",
    name: "Pool Tables",
    tagline: "American 7ft · Hourly",
    blurb: "Book a pool table for an hour or for the whole evening.",
    image: "",
    href: "/book/pool",
  },
  {
    id: "parties",
    name: "Party Inquiries",
    tagline: "Private hire · Groups of 10+",
    blurb: "Birthdays, leaving dos, brand activations — whole-venue or arch-end hires.",
    image: "",
    href: "/private-hire",
  },
  {
    id: "golf",
    name: "Golf",
    tagline: "Plonk Golf · Sister brand",
    blurb: "Crazy golf at our sister venue, Plonk Golf — Hackney and Borough.",
    image: "",
    href: "https://www.plonkgolf.co.uk/",
  },
] as const;

// External links open in a new tab. We classify any href starting with
// http(s) as external so the admin can rewire the Golf card to an
// internal page later without code changes.
function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

export default function BookPage() {
  const heroEyebrow = useContent("book.hero_eyebrow", "Bookings");
  const heroTitle = useContent("book.hero_title", "Book Now");
  const heroIntro = useContent(
    "book.hero_intro",
    "Pick your booking — table, pool, party or golf.",
  );

  // Per-card hooks. Each card's five fields (name/tagline/blurb/image/
  // href) read from page_content. To add a fifth card later, add a new
  // entry to FALLBACK_CARDS, seed the matching rows in page_content,
  // and bump the prefix in the loop below.
  const cards = FALLBACK_CARDS.map((c) => ({
    id: c.id,
    name: useContent(`book.${c.id}.name`, c.name),
    tagline: useContent(`book.${c.id}.tagline`, c.tagline),
    blurb: useContent(`book.${c.id}.blurb`, c.blurb),
    image: useImage(`book.${c.id}.image`, c.image),
    href: useContent(`book.${c.id}.href`, c.href),
  }));

  return (
    <main>
      <section className="px-6 pt-16 pb-8 text-center">
        <div className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
          {heroEyebrow}
        </div>
        <h1 className="font-display text-5xl uppercase tracking-wider sm:text-6xl">
          {heroTitle}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-cream/75">
          {heroIntro}
        </p>
      </section>

      <section className="px-6 pb-24">
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2">
          {cards.map((c) => {
            const inner = (
              <>
                <div className="relative aspect-[3/2] w-full overflow-hidden bg-ink/40">
                  {/* Skip <Image> when src is empty — Next/Image with an
                      empty string renders the broken-icon glyph. Founder
                      can upload card art via admin → Book Now landing. */}
                  {c.image ? (
                    <Image
                      src={c.image}
                      alt={c.name}
                      fill
                      sizes="(min-width: 640px) 50vw, 100vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                      unoptimized={c.image.startsWith("http")}
                    />
                  ) : null}
                </div>
                <div className="p-6">
                  <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
                    {c.tagline}
                  </div>
                  <div className="mt-2 font-display text-3xl uppercase tracking-wider">
                    {c.name}
                  </div>
                  <div className="mt-3 text-sm text-cream/75">{c.blurb}</div>
                </div>
              </>
            );
            const className =
              "group block overflow-hidden rounded-2xl border border-cream/10 transition hover:border-cream/30";
            return isExternal(c.href) ? (
              <a
                key={c.id}
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {inner}
              </a>
            ) : (
              <Link key={c.id} href={c.href} className={className}>
                {inner}
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
