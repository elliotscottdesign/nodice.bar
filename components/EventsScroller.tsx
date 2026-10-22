"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import RollerDeck from "./RollerDeck";
import {
  loadCalendarEventsInRange,
  defaultPosterFor,
  type DbCalendarEvent,
} from "@/lib/db/calendarEvents";

// =============================================================
// EventsScroller — "what else is on", straight off the calendar
// =============================================================
// Founder, 21 Oct 2026: a page that tells customers what else is happening
// shouldn't be a hand-typed bullet list that goes stale — it should be a
// side-scroller of pictures and information pulled from the events calendar,
// the same feed /events reads. Add a food night, a DJ, a games night in
// /admin/events and it shows up here on its own.
//
// Two kinds of card sit in the same rail:
//   • HIGHLIGHTS — whatever the page itself wants to say (the fundraiser's own
//     programme: betting, carrom, side quests). Passed in, CMS-editable by the
//     page, and shown first because they're what THAT day is.
//   • CALENDAR EVENTS — every upcoming event flagged for the public calendar,
//     with its poster. Falls back to the category artwork so a card is never
//     blank, exactly like /events does.
//
// Checked at phone (375px) and desktop (1280px): cards are vw-sized, the rail
// bleeds past the page gutter on mobile so the next card peeks in, and nothing
// scrolls the page sideways.
// =============================================================

export type ScrollerHighlight = {
  key: string;
  /** Usually an <Editable> so the founder can edit it on-page. */
  node: React.ReactNode;
};

const CARD =
  "w-[72vw] shrink-0 snap-start sm:w-[44vw] md:w-[30vw] lg:w-[24%]";

function fmtDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function fmtTime(hhmmss: string | null): string {
  if (!hhmmss) return "";
  const [hStr, mStr] = hhmmss.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr || "0", 10);
  const suffix = h >= 12 && h < 24 ? "pm" : "am";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${suffix}` : `${h12}${suffix}`;
}

/** First tag off the comma-separated subcategory ("DJ Night, Deals" → "DJ Night"). */
function firstTag(subcategory: string | null): string {
  return (subcategory ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)[0] ?? "";
}

export default function EventsScroller({
  eyebrow,
  heading = "What else is on",
  intro,
  highlights = [],
  excludeIds = [],
  days = 56,
  max = 12,
  className = "",
}: {
  eyebrow?: React.ReactNode;
  heading?: React.ReactNode;
  intro?: React.ReactNode;
  /** The page's own cards, shown before the calendar ones. */
  highlights?: ScrollerHighlight[];
  /** Event ids to leave out — e.g. the page's own event and its ticket tiers. */
  excludeIds?: string[];
  /** How far ahead to look. */
  days?: number;
  /** Cap on calendar cards so the rail stays swipeable. */
  max?: number;
  className?: string;
}) {
  const [events, setEvents] = useState<DbCalendarEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const to = new Date(today.getTime() + days * 864e5);
    loadCalendarEventsInRange(iso(today), iso(to))
      .then((rows) => {
        if (!cancelled) setEvents(rows.filter((r) => r.active !== false));
      })
      // A calendar that won't load must never take the section down with it —
      // the highlights still render.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [days]);

  const cards = useMemo(() => {
    const skip = new Set(excludeIds);
    const seen = new Set<string>();
    return events
      .filter((e) => !skip.has(e.id))
      // ONE card per title, soonest first. Happy Hour runs most days, so
      // without this the rail is four identical cards and the food night,
      // the ping pong social and the pool night never get seen.
      .filter((e) => {
        const k = e.title.trim().toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, max);
    // excludeIds is a fresh array each render; compare by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, excludeIds.join(","), max]);

  if (highlights.length === 0 && cards.length === 0) return null;

  return (
    <section className={`px-6 py-16 ${className}`}>
      <div className="mx-auto max-w-6xl">
        {eyebrow && (
          <div className="mb-3 text-center text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
            {eyebrow}
          </div>
        )}
        <h2 className="text-center font-display text-4xl uppercase tracking-wider text-cream sm:text-5xl">
          {heading}
        </h2>
        {intro && (
          <p className="mx-auto mt-4 max-w-xl text-center text-sm text-cream/75">
            {intro}
          </p>
        )}

        <div className="mt-10">
          <RollerDeck ariaLabel="What else is on" center>
            {highlights.map((h) => (
              <article
                key={h.key}
                className={`${CARD} flex min-h-[15rem] flex-col rounded-2xl border border-plonkPink/25 bg-gradient-to-b from-plonkPink/10 via-plonkPink/[0.03] to-transparent p-6 text-center`}
              >
                <span className="text-2xl text-plonkPink">◆</span>
                <p className="flex flex-1 items-center justify-center py-4 text-base leading-relaxed text-cream/90">
                  {h.node}
                </p>
                <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-cream/40">
                  On the day
                </span>
              </article>
            ))}

            {cards.map((e) => {
              const poster = e.image_url || defaultPosterFor(firstTag(e.subcategory));
              const tag = firstTag(e.subcategory);
              const when = [fmtDay(e.event_date), fmtTime(e.start_time)]
                .filter(Boolean)
                .join(" · ");
              const body = (
                <article
                  className="group h-full overflow-hidden rounded-2xl border border-cream/10 bg-ink/40"
                >
                  <div className="relative aspect-[4/5] w-full overflow-hidden bg-black/30">
                    {poster ? (
                      <Image
                        src={poster}
                        alt={e.title}
                        fill
                        sizes="(min-width: 1024px) 24vw, (min-width: 768px) 30vw, (min-width: 640px) 44vw, 72vw"
                        className="object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : null}
                  </div>
                  <div className="p-5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
                      {when}
                    </div>
                    <div className="mt-2 font-display text-2xl uppercase leading-tight tracking-wider text-cream">
                      {e.title}
                    </div>
                    {tag && (
                      <div className="mt-2 inline-block rounded-full border border-cream/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cream/55">
                        {tag}
                      </div>
                    )}
                    {e.body && (
                      <p className="mt-3 line-clamp-3 text-sm text-cream/70">
                        {e.body}
                      </p>
                    )}
                  </div>
                </article>
              );
              // The sizing lives on the RAIL CHILD, not the card inside it —
              // a wrapper without it collapses to a sliver in the flex rail.
              return e.link_url ? (
                <a
                  key={e.id}
                  href={e.link_url}
                  className={`${CARD} block focus:outline-none focus-visible:ring-2 focus-visible:ring-plonkPink/60`}
                >
                  {body}
                </a>
              ) : (
                <div key={e.id} className={CARD}>
                  {body}
                </div>
              );
            })}
          </RollerDeck>
        </div>

        <div className="mt-8 text-center">
          <a
            href="/events"
            className="inline-block rounded-full border border-plonkPink/50 px-8 py-3 text-sm font-bold uppercase tracking-widest text-plonkPink transition hover:bg-plonkPink/10"
          >
            See the full calendar →
          </a>
        </div>
      </div>
    </section>
  );
}
