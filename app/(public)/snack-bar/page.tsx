"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useContent } from "@/lib/content";
import { loadMenu, type DbMenuSection, type DbMenuItem } from "@/lib/db/menu";

// Fallback menu data — used when the admin hasn't seeded the
// menu_sections / menu_items tables yet. Keeps the page intact even
// if Supabase is unreachable.
const FALLBACK: { title: string; items: { title: string; price: string; body?: string }[] }[] = [
  {
    title: "Burgers & loaded chips",
    items: [
      {
        title: "Smash burger w/ chips",
        price: "12",
        body:
          "8oz homemade patty from olive-fed British wagyu, cheese, crunchy salad, burger sauce, brioche bun.",
      },
      {
        title: "BBQ chicken burger w/ chips",
        price: "12",
        body:
          "6oz chicken thigh marinated for 24 hours and smoked on cherry wood. Cheese, crunchy salad, burger sauce, brioche bun.",
      },
      {
        title: "Loaded chips",
        price: "10",
        body:
          "Choose topping (6oz): BBQ chicken · 12-hour smoked BBQ brisket · garlic shrooms (v). Crossed with mayo & chives.",
      },
    ],
  },
  {
    title: "Sides",
    items: [
      {
        title: "Green peppers (v)",
        price: "6",
        body: "Like a Padrón pepper — salted in Maldon and fried.",
      },
      {
        title: "Chips (v)",
        price: "5",
        body: "Choose one sauce: mayo · chipotle mayo · burger sauce · ketchup.",
      },
    ],
  },
  {
    title: "Extras",
    items: [
      { title: "Extra meat / shrooms / cheese", price: "4" },
      { title: "Extra sauce", price: "1" },
    ],
  },
];

type Row = { title: string; items: { title: string; price: string; body?: string }[] };

export default function SnackBarMenuPage() {
  const title = useContent("snackbar.title", "Snack Bar");
  const eyebrow = useContent("snackbar.eyebrow", "Plonk Hackney · Eat");
  const tagline = useContent(
    "snackbar.tagline",
    "BBQ meat & burgers, supplied by Smokoloko of Spitalfields.",
  );

  const [dbSections, setDbSections] = useState<DbMenuSection[] | null>(null);
  const [dbItems, setDbItems] = useState<DbMenuItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadMenu()
      .then(({ sections, items }) => {
        if (cancelled) return;
        setDbSections(sections);
        setDbItems(items);
      })
      .catch(() => {
        if (cancelled) return;
        setDbSections([]);
        setDbItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve which dataset to render. If the DB has any sections, that
  // wins; otherwise the hardcoded FALLBACK keeps the page intact.
  const rows: Row[] =
    dbSections && dbSections.length > 0 && dbItems
      ? dbSections.map((s) => ({
          title: s.title,
          items: dbItems
            .filter((i) => i.section_id === s.id)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((i) => ({
              title: i.title,
              price: i.price ?? "",
              body: i.body ?? undefined,
            })),
        }))
      : FALLBACK;

  return (
    <main className="bed-hackney">
      {/* HEADER */}
      <header className="relative isolate flex min-h-[40vh] flex-col items-center justify-center px-6 pt-24 pb-16 text-center">
        <div className="absolute inset-0 -z-10">
          <Image
            src="/hackney/snack_bar/Snack_bar_1.jpg"
            alt=""
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="hero-overlay absolute inset-0" />
        </div>
        <p className="text-shadow-hero text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
          {eyebrow}
        </p>
        <h1 className="text-shadow-hero mt-3 font-display text-5xl leading-tight sm:text-6xl">
          {title}
        </h1>
        <p className="text-shadow-hero mx-auto mt-5 max-w-xl text-base text-cream sm:text-lg">
          {tagline}
        </p>
      </header>

      {/* MENU */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-3xl">
          {rows.map((row) => (
            <MenuSection key={row.title} title={row.title}>
              {/* Extras-style flat rows for sections whose items have no
                  body copy; full cards otherwise. */}
              {row.items.every((i) => !i.body) ? (
                <ul className="divide-y divide-plumLine/40 rounded-2xl border border-plumLine/60">
                  {row.items.map((e) => (
                    <li
                      key={e.title}
                      className="flex items-center justify-between gap-4 px-5 py-3 text-sm"
                    >
                      <span className="text-cream/90">{e.title}</span>
                      <span className="font-display text-base text-plonkYellow">
                        {e.price ? `£${e.price}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                row.items.map((item) => (
                  <MenuRow
                    key={item.title}
                    title={item.title}
                    price={item.price}
                    body={item.body ?? ""}
                  />
                ))
              )}
            </MenuSection>
          ))}

          {/* Allergies note */}
          <div className="mt-12 rounded-2xl border border-plonkYellow/40 bg-plonkYellow/10 p-5 text-sm leading-relaxed text-plonkYellow">
            <strong className="font-bold">Allergies?</strong> Please let our
            team know when ordering — we'll guide you to safe options.
          </div>

          {/* Back to Hackney */}
          <div className="mt-10 text-center">
            <Link
              href="/venue/hackney"
              className="inline-flex items-center text-sm font-semibold uppercase tracking-wider text-cream/80 transition hover:text-cream"
            >
              ← Back to Plonk Hackney
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function MenuSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-12 first:mt-0">
      <h2 className="font-display text-2xl text-plonkYellow sm:text-3xl">
        {title}
      </h2>
      <div className="mt-6 space-y-4">{children}</div>
    </div>
  );
}

function MenuRow({
  title,
  price,
  body,
}: {
  title: string;
  price: string;
  body: string;
}) {
  return (
    <article className="rounded-2xl border border-plumLine/60 p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-display text-xl sm:text-2xl">{title}</h3>
        <span className="font-display text-xl text-plonkYellow sm:text-2xl">
          {price ? `£${price}` : ""}
        </span>
      </div>
      {body && <p className="mt-2 text-sm leading-relaxed text-cream/75">{body}</p>}
    </article>
  );
}
