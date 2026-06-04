import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book — No Dice",
  description:
    "Book a table, a pool table, a private hire or a Plonk Golf tee time.",
};

// /book — the bookings landing. Four cards per founder brief: tables,
// pool, party inquiries, golf. Each routes into the appropriate
// existing flow:
//   • Tables / Pool   → /book/hackney (the existing booking flow)
//   • Party inquiries → /private-hire (existing page with form)
//   • Golf            → plonkgolf.co.uk (external, the sister brand)
//
// Server component (no "use client") — content is static so it ships
// in the static export with no client JS for the landing itself.

const CATEGORIES: {
  id: string;
  name: string;
  tagline: string;
  image: string;
  blurb: string;
  href: string;
  external?: boolean;
}[] = [
  {
    id: "tables",
    name: "Tables",
    tagline: "Dinner · Drinks · Groups",
    image: "/images/PLONK-COCKTAILS_215335_SQ.jpg",
    blurb:
      "Reserve a table for dinner, drinks or a group of friends. Hackney only.",
    href: "/book/hackney",
  },
  {
    id: "pool",
    name: "Pool Tables",
    tagline: "American 7ft · Hourly",
    image: "/images/PAH-V2-1-1.jpg",
    blurb: "Book a pool table for an hour or for the whole evening.",
    href: "/book/hackney",
  },
  {
    id: "parties",
    name: "Party Inquiries",
    tagline: "Private hire · Groups of 10+",
    image: "/images/MPL_294A9392_Web.jpg",
    blurb:
      "Birthdays, leaving dos, brand activations — whole-venue or arch-end hires.",
    href: "/private-hire",
  },
  {
    id: "golf",
    name: "Golf",
    tagline: "Plonk Golf · Sister brand",
    image: "/images/PLNK-HTDG-044_Large.jpg",
    blurb:
      "Crazy golf at our sister venue, Plonk Golf — Hackney and Borough.",
    href: "https://www.plonkgolf.co.uk/",
    external: true,
  },
];

export default function BookPage() {
  return (
    <main>
      <section className="px-6 pt-16 pb-8 text-center">
        <div className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
          Bookings
        </div>
        <h1 className="font-display text-5xl uppercase tracking-wider sm:text-6xl">
          Book Now
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-cream/75">
          Pick your booking — table, pool, party or golf.
        </p>
      </section>

      <section className="px-6 pb-24">
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2">
          {CATEGORIES.map((c) => {
            const inner = (
              <>
                <div className="relative aspect-[3/2] w-full overflow-hidden">
                  <Image
                    src={c.image}
                    alt={c.name}
                    fill
                    sizes="(min-width: 640px) 50vw, 100vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
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
            return c.external ? (
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
