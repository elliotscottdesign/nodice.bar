"use client";

import { useEffect, useState } from "react";
import PageHero from "@/components/PageHero";
import { useContent, useImage } from "@/lib/content";
import { Editable } from "@/components/Editable";
import {
  loadEvents,
  groupEvents,
  type DbSiteEvent,
} from "@/lib/db/events";

// Fallback events used when site_events table is empty (e.g. before
// the admin has added anything). Once the admin uploads, those win.
const FALLBACK_EVENTS: DbSiteEvent[] = [
  {
    id: "fb-h-1",
    venue: "Plonk Hackney at No Dice Bar",
    day: "Every Saturday",
    title: "Boozy Ballzy Brunch",
    body: "Join us for the ultimate bottomless brunch experience. Epic games, unlimited drinks, delicious food, and endless fun.",
    featured: true,
    venue_order: 1,
    event_order: 1,
    active: true,
  },
  {
    id: "fb-h-2",
    venue: "Plonk Hackney at No Dice Bar",
    day: "1st Tuesday of the month",
    title: "Queer Pool Social",
    body: "Ladies and Queer Pool Social — pool games, prizes, more pool, more prizes. Free entry, just come along.",
    featured: false,
    venue_order: 1,
    event_order: 2,
    active: true,
  },
  {
    id: "fb-b-1",
    venue: "Plonk Borough",
    day: "3rd Wednesday of the month",
    title: "Shoreditch Doubles Pool Tournament",
    body: "Riotous doubles night under London Bridge. Over £200 in prizes — only 8 slots, always sells out.",
    featured: false,
    venue_order: 2,
    event_order: 1,
    active: true,
  },
];

export default function EventsPage() {
  const eyebrow = useContent("events.eyebrow", "What's on");
  const title = useContent("events.title", "Plonk Events");
  const intro = useContent(
    "events.intro",
    "Events run by our partner venues — Plonk Hackney at No Dice Bar, and Plonk Borough.",
  );
  const heroImage = useImage("events.hero_image", "/hackney/games/Games_4.jpg");
  const footerNote = useContent(
    "events.footer_note",
    "Bookable events will appear in the new booking system as it rolls out. Meanwhile, email info@plonkgolf.co.uk to reserve a slot.",
  );

  const [rows, setRows] = useState<DbSiteEvent[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadEvents()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const events = rows && rows.length > 0 ? rows : FALLBACK_EVENTS;
  const grouped = groupEvents(events);

  return (
    <main>
      <PageHero
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        image={heroImage}
        eyebrowKey="events.eyebrow"
        titleKey="events.title"
        introKey="events.intro"
        imageKey="events.hero_image"
        sliderKey="hero.events"
      />

      <section>
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-10 md:grid-cols-2">
            {grouped.map((g) => (
              <VenueColumn key={g.venue} name={g.venue} events={g.items} />
            ))}
          </div>

          {footerNote && (
            <p className="mt-16 whitespace-pre-line text-center text-sm text-cream/60">
              <Editable k="events.footer_note" multiline>{footerNote}</Editable>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function VenueColumn({
  name,
  events,
}: {
  name: string;
  events: DbSiteEvent[];
}) {
  return (
    <div>
      <div className="border-b border-plumLine/60 pb-3">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-plonkYellow">
          Venue
        </p>
        <h2 className="mt-1 font-display text-2xl sm:text-3xl">{name}</h2>
      </div>

      <div className="mt-6 space-y-4">
        {events.map((e) => (
          <article
            key={e.id}
            className={`rounded-2xl p-6 ${
              e.featured
                ? "border border-plonkPink/40 bg-gradient-to-br from-plonkPink/15 to-forestDeep"
                : "border border-plumLine/60"
            }`}
          >
            {e.featured && (
              <p className="text-xs font-bold uppercase tracking-widest text-plonkPink">
                Headline event
              </p>
            )}
            <h3 className={`${e.featured ? "mt-1" : ""} font-display text-xl`}>
              {e.title}
            </h3>
            <p className="mt-1 text-sm uppercase tracking-wider text-cream/60">
              {e.day}
            </p>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-cream/80">
              {e.body}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
