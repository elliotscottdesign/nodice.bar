"use client";

import { useEffect, useState } from "react";
import PageHero from "@/components/PageHero";
import { useContent, useImage } from "@/lib/content";
import { Editable } from "@/components/Editable";
import { loadDeals, type DbSiteDeal } from "@/lib/db/deals";

// Fallback used when the site_deals table is empty.
const FALLBACK_DEALS: DbSiteDeal[] = [
  {
    id: "fb-1",
    day: "Mondays — All day",
    title: "2-for-1 on Games",
    venue: "Hackney",
    body: "2-for-1 on arcade tokens, games, pool and golf. For online sales, buy one round of golf or tokens for two players.",
    sort_order: 1,
    active: true,
  },
  {
    id: "fb-2",
    day: "Tuesdays — All day",
    title: "Game & Drink — £10",
    venue: "Hackney",
    body: "A round of golf, three arcade tokens and a house drink — all for £10.",
    sort_order: 2,
    active: true,
  },
  {
    id: "fb-3",
    day: "Always on",
    title: "10% Off — Students & Hospitality Workers",
    venue: null,
    body: "Use across different items at different venues. Cannot be used in conjunction with other offers or with food from Taco Mates at Hackney.",
    sort_order: 3,
    active: true,
  },
];

export default function DealsPage() {
  const eyebrow = useContent("deals.eyebrow", "Save on midweek");
  const title = useContent("deals.title", "Plonk Deals");
  const intro = useContent(
    "deals.intro",
    "Off-peak deals on games, drinks and food across our venues. Some offers vary by site and opening times — you're always in for a treat.",
  );
  const heroImage = useImage("deals.hero_image", "/hackney/drinks/Drinks_3.jpg");
  const ctaHeading = useContent(
    "deals.cta_heading",
    "Looking for tournaments, brunches, chess & jazz, ping pong nights?",
  );
  const ctaLabel = useContent("deals.cta_link_label", "See what's on →");
  const ctaHref = useContent("deals.cta_link_href", "/events");

  const [rows, setRows] = useState<DbSiteDeal[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadDeals()
      .then((d) => {
        if (!cancelled) setRows(d);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const deals = rows && rows.length > 0 ? rows : FALLBACK_DEALS;

  return (
    <main>
      <PageHero
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        image={heroImage}
        eyebrowKey="deals.eyebrow"
        titleKey="deals.title"
        introKey="deals.intro"
        imageKey="deals.hero_image"
        sliderKey="hero.deals"
      />

      <section>
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="grid gap-6 md:grid-cols-2">
            {deals.map((d) => (
              <article
                key={d.id}
                className="rounded-2xl border border-plumLine/60 p-6"
              >
                <p className="text-xs font-bold uppercase tracking-widest text-plonkYellow">
                  {d.day}
                  {d.venue ? ` · ${d.venue}` : ""}
                </p>
                <h3 className="mt-2 font-display text-xl">{d.title}</h3>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-cream/75">
                  {d.body}
                </p>
              </article>
            ))}
          </div>

          {(ctaHeading || ctaLabel) && (
            <div className="mt-16 rounded-2xl border border-plumLine/60 p-8 text-center">
              {ctaHeading && (
                <p className="text-base text-cream/80">
                  <Editable k="deals.cta_heading">{ctaHeading}</Editable>
                </p>
              )}
              {ctaLabel && ctaHref && (
                <a
                  href={ctaHref}
                  className="mt-3 inline-block text-sm font-semibold uppercase tracking-wider text-plonkYellow hover:underline"
                >
                  <Editable k="deals.cta_link_label">{ctaLabel}</Editable>
                </a>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
