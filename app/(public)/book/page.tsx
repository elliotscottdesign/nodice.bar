import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book Plonk Golf",
  description: "Book a tee time at Plonk Hackney or Plonk Borough Market.",
};

const VENUES = [
  {
    id: "hackney",
    name: "Plonk Hackney",
    tagline: "Outdoor · 9 holes · London Fields",
    image: "/hackney/course/Course_1.jpg",
    blurb:
      "Polynesian-themed course, retro arcade, pool, tacos and craft cocktails.",
    href: "/book/hackney",
  },
  {
    id: "borough",
    name: "Plonk Borough Market",
    tagline: "Indoor · 9 holes · London Bridge",
    image: "/borough/course/Course_1.jpg",
    blurb:
      "London-themed course under the arches with street-art murals and full bar.",
    href: "/book/borough",
  },
];

export default function BookingPickerPage() {
  return (
    <main className="bed-booking px-6 py-16">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-plonkYellow">
          Book Plonk
        </p>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl">
          Which venue would you like?
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-cream/70">
          Pick a venue to see availability. You'll choose your date, time
          slot, party size and any extras on the next page.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-2">
        {VENUES.map((v) => (
          <Link
            key={v.id}
            href={v.href}
            className="group relative overflow-hidden rounded-3xl border border-cream/10 bg-ink/40 transition hover:border-plonkPink/60"
          >
            <div className="relative aspect-[4/3]">
              <Image
                src={v.image}
                alt=""
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
            </div>
            <div className="absolute inset-x-0 bottom-0 p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-plonkYellow">
                {v.tagline}
              </p>
              <h2 className="mt-1 font-display text-3xl">{v.name}</h2>
              <p className="mt-2 text-sm text-cream/80">{v.blurb}</p>
              <span className="mt-4 inline-block rounded-full bg-plonkPink px-6 py-2 text-sm font-bold uppercase tracking-wider text-white">
                Book {v.name.replace("Plonk ", "")}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
