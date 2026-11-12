"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import RollerDeck from "./RollerDeck";
import {
  loadCalendarEventsInRange,
  defaultPosterFor,
  type DbCalendarEvent,
} from "@/lib/db/calendarEvents";
import { loadDjNightsInRange, isDjEvent } from "@/lib/db/djNights";
import { loadOpenDecksNightsInRange } from "@/lib/db/openDecksNights";
import {
  loadLeadOrder,
  leadRankFromOrder,
  DEFAULT_LEAD_ORDER,
  type LeadBucket,
} from "@/lib/db/leadPriority";

// =============================================================
// UpcomingEvents — top-of-homepage "what's coming up" rails
// =============================================================
// Founder, 9 Nov 2026: the homepage leads with WHAT'S ON, and it's split
// into TWO swipeable rails, top of page:
//   • kind="events" — the special events, pool, food and drink nights in
//     the next 30 days (everything EXCEPT the DJs), in date order.
//   • kind="djs"    — a rail just for the DJs, in order of playing, and
//     INCLUDING the free Open Decks sign-up sessions.
//
// Both read the SAME three feeds /events reads (this site's events table,
// the team-hub DJ-nights feed, the open-decks feed), so adding a night
// where you already do makes it appear here on its own.
//
// Links follow the site's rule (founder 2026-10-15, same as /events'
// eventDestination): a card goes to the event's OWN link when it has one —
// a DJ night → that DJ's Instagram, open decks → the sign-up page, a
// special → its organiser/ticket page. With no own-link it falls back to
// the full /events calendar (a real, pre-rendered route — never an invented
// per-event URL, which would 404 on this static export).
//
// Phone = the bingo image-scroller feel: one poster centred (snap-centre,
// ~84vw) with the next peeking. Desktop = a horizontal row + arrow pills via
// the shared RollerDeck. Checked at 375px and 1280px; the rail scrolls
// internally so the page never scrolls sideways.
//
// Posters go through next/image, whose custom loader routes every remote URL
// through the wsrv.nl edge CDN (the canonical mediaUrl() path) — cached,
// resized WebP — so this never re-opens the Nov-2026 egress hole.
// =============================================================

const CARD =
  "w-[84vw] shrink-0 snap-center sm:w-[44vw] md:w-[30vw] lg:w-[22rem]";

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
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || "0", 10);
  const suffix = h >= 12 && h < 24 ? "pm" : "am";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${suffix}` : `${h12}${suffix}`;
}

type Group = "SPECIALS" | "POOL" | "FOOD" | "DEAL" | "DJ";

// Which of the five public tags an event belongs to (or null if it carries
// no recognisable tag — arcade / golf / other, which stay off these rails).
// Mirrors /events' chipForEvent / CATEGORY_TO_CHIP exactly: DJ-feed +
// open-decks nights and dj_night → DJ; all pool-shaped things → POOL;
// food_event → FOOD; drink_special → DEAL; special_event + bingo → SPECIALS.
// A free-text subcategory is the last-ditch fallback for a hand-added
// calendar event that was tagged but not categorised.
function groupOf(e: DbCalendarEvent): Group | null {
  if (isDjEvent(e) || e.id.startsWith("od-")) return "DJ";
  const cat = e.category ?? "";
  if (cat === "dj_night") return "DJ";
  if (cat === "special_event" || cat === "bingo") return "SPECIALS";
  if (
    cat === "pool_tournament_doubles" ||
    cat === "pool_tournament_singles" ||
    cat === "pool_special" ||
    cat === "ping_pong"
  )
    return "POOL";
  if (cat === "food_event") return "FOOD";
  if (cat === "drink_special") return "DEAL";
  const sub = (e.subcategory ?? "").toLowerCase();
  if (sub.includes("dj")) return "DJ";
  if (sub.includes("special")) return "SPECIALS";
  if (sub.includes("pool") || sub.includes("ping")) return "POOL";
  if (sub.includes("food")) return "FOOD";
  if (sub.includes("deal") || sub.includes("drink")) return "DEAL";
  return null;
}

const GROUP_LABEL: Record<Group, string> = {
  SPECIALS: "Special Event",
  POOL: "Pool",
  FOOD: "Food",
  DEAL: "Deal",
  DJ: "DJ Night",
};

// An event can belong to MORE THAN ONE rail (founder 10 Nov): a DJ night that
// is also a special — a ticketed one especially — should show on BOTH the
// Music sessions rail AND the Special events rail. groupOf() only ever returns
// one bucket, so rail membership is decided separately below, drawing on the
// event's tags[] (the multi-group taxonomy) and its ticketed flag as well as
// its single category group.
function tagsOf(e: DbCalendarEvent): string[] {
  return Array.isArray(e.tags)
    ? e.tags.map((t) => String(t).trim().toUpperCase()).filter(Boolean)
    : [];
}
function taggedDj(e: DbCalendarEvent): boolean {
  return tagsOf(e).some((t) => t === "DJ" || t.startsWith("DJ"));
}
function taggedSpecial(e: DbCalendarEvent): boolean {
  return tagsOf(e).some((t) => t.startsWith("SPECIAL"));
}
// Is this a "special event" for the Special events rail? A genuine event
// category (specials / pool / food), OR a ticketed night (tickets = a special,
// incl. a ticketed DJ night like Batuke), OR one tagged SPECIALS. NOT a plain
// drink deal, unless it's been explicitly ticketed/tagged.
function inSpecialRail(e: DbCalendarEvent): boolean {
  const g = groupOf(e);
  if (g === "SPECIALS" || g === "POOL" || g === "FOOD") return true;
  return e.requires_ticket === true || taggedSpecial(e);
}
function inDjRail(e: DbCalendarEvent): boolean {
  return groupOf(e) === "DJ" || taggedDj(e);
}
// The group used for a card's pill + fallback poster on a given rail. On the
// Special events rail a DJ-category event that got in via ticket/tag reads as
// a Special Event, not a DJ Night; POOL/FOOD keep their own label.
function cardGroup(e: DbCalendarEvent, kind: "events" | "djs"): Group {
  if (kind === "djs") return "DJ";
  const g = groupOf(e);
  return g === "POOL" || g === "FOOD" || g === "SPECIALS" ? g : "SPECIALS";
}


export default function UpcomingEvents({
  kind,
  eyebrow,
  heading,
  days = 30,
  max = 14,
}: {
  /** "events" = everything except DJs; "djs" = DJ nights + open decks. */
  kind: "events" | "djs";
  eyebrow: string;
  heading: string;
  /** How far ahead to look, in days. Founder scope: 30. */
  days?: number;
  /** Cap on cards so the rail stays swipeable. */
  max?: number;
}) {
  const [events, setEvents] = useState<DbCalendarEvent[]>([]);
  // The founder-editable lead order (/admin/event-priority) — same ranking
  // /events uses to headline a busy day: specials first, Happy Hour dead
  // last. Only the Special Events rail sorts by it. Falls back to the
  // default order on any failure, so the rail is never blanked by it.
  const [leadOrder, setLeadOrder] = useState<LeadBucket[]>(DEFAULT_LEAD_ORDER);

  useEffect(() => {
    if (kind !== "events") return;
    let cancelled = false;
    loadLeadOrder().then((order) => {
      if (!cancelled) setLeadOrder(order);
    });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  useEffect(() => {
    let cancelled = false;
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const today = new Date();
    const from = iso(today);
    const to = iso(new Date(today.getTime() + days * 864e5));
    // Same three feeds /events reads. allSettled so one source failing
    // never blanks the rail.
    Promise.allSettled([
      loadCalendarEventsInRange(from, to),
      loadDjNightsInRange(from, to),
      loadOpenDecksNightsInRange(from, to),
    ]).then((res) => {
      if (cancelled) return;
      const rows = res.flatMap((r) =>
        r.status === "fulfilled" ? r.value : [],
      );
      setEvents(rows.filter((r) => r.active !== false));
    });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const cards = useMemo(() => {
    // Which rail each event belongs to — an event can be in BOTH (a ticketed
    // DJ night shows on Music sessions AND Special events). The events rail
    // keeps out plain drink deals (they're not ticketed/tagged special); CUE
    // stays (group POOL). See inSpecialRail / inDjRail.
    let list = events.filter((e) => (kind === "djs" ? inDjRail(e) : inSpecialRail(e)));

    if (kind === "djs") {
      // A DJ night can arrive from BOTH the events table and the team-hub DJ
      // feed (a booking the founder also made a ticketed event). Collapse by
      // date + start time to one card, preferring the events-table row — it's
      // richer (ticketing, poster, tags) and sources merge calendar-first.
      // Two-session Saturdays survive (different start times).
      const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");
      const slot = new Map<string, DbCalendarEvent>();
      for (const e of list) {
        const t = hhmm(e.start_time);
        const key = `${e.event_date}|${t || e.title.trim().toLowerCase()}`;
        if (!slot.has(key)) slot.set(key, e);
      }
      list = [...slot.values()];
    }

    const seenTitle = new Set<string>();
    return list
      // DJ rail: pure order of play (date, then start time). Events rail:
      // by the founder's lead-priority buckets first (specials → one-offs →
      // regulars → deals, Happy Hour dead last — same as /events), then date.
      .sort((a, b) => {
        if (kind === "events") {
          const ra = leadRankFromOrder(a, leadOrder);
          const rb = leadRankFromOrder(b, leadOrder);
          if (ra !== rb) return ra - rb;
        }
        const d = a.event_date.localeCompare(b.event_date);
        if (d !== 0) return d;
        return (a.start_time ?? "").localeCompare(b.start_time ?? "");
      })
      // Events rail: collapse a recurring title (e.g. weekly CUE) to its
      // soonest card. DJ rail: keep every night so the line-up reads in full.
      .filter((e) => {
        if (kind === "djs") return true;
        const k = e.title.trim().toLowerCase();
        if (seenTitle.has(k)) return false;
        seenTitle.add(k);
        return true;
      })
      .map((e) => ({ e, group: cardGroup(e, kind) }))
      .slice(0, max);
  }, [events, kind, max, leadOrder]);

  // Nothing in the window → render nothing rather than an empty band.
  if (cards.length === 0) return null;

  return (
    <section className="bg-ink px-6 py-14">
      <div className="mx-auto max-w-6xl">
        <div className="mb-2 text-center text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
          {eyebrow}
        </div>
        <h2 className="text-center font-display text-4xl uppercase tracking-wider text-cream sm:text-5xl">
          {heading}
        </h2>
        {/* CTA sits directly under the title (founder 11 Nov) — no blurb. */}
        <div className="mt-5 text-center">
          <a
            href="/events/"
            className="inline-block rounded-full border border-plonkPink/50 px-8 py-3 text-sm font-bold uppercase tracking-widest text-plonkPink transition hover:bg-plonkPink/10"
          >
            See the full calendar →
          </a>
        </div>

        <div className="mt-8">
          <RollerDeck
            ariaLabel={typeof heading === "string" ? heading : "Upcoming"}
            center
            arrowAccent
            // Sit the arrows on the poster, not the whole card. The Music rail
            // cards are shorter (no pill/blurb) so their poster centre is a
            // little lower in the card than the taller Special Events cards.
            arrowTop={kind === "djs" ? "40%" : "36%"}
          >
            {cards.map(({ e, group }) => {
              const poster = e.image_url || defaultPosterFor(group);
              const when = [fmtDay(e.event_date), fmtTime(e.start_time)]
                .filter(Boolean)
                .join(" · ");
              // The event's own link first (DJ → Instagram, special → organiser).
              // Otherwise the event's own shareable page (/event?o=<id>, a
              // static-export-safe query param that renders every category —
              // ticketed or not, deals included). DJ-feed / open-decks cards
              // carry synthetic ids ("dj-…" / "od-…") that aren't real event
              // rows, so those fall back to the full calendar rather than a
              // dead /event link.
              const syntheticId = /^(dj|od)-/.test(e.id);
              const href =
                e.link_url || (syntheticId ? "/events/" : `/event?o=${e.id}`);
              return (
                <a
                  key={e.id}
                  href={href}
                  className={`${CARD} block focus:outline-none focus-visible:ring-2 focus-visible:ring-plonkPink/60`}
                >
                  <article className="group h-full overflow-hidden rounded-2xl border border-cream/10 bg-ink/40">
                    <div className="relative aspect-[4/5] w-full overflow-hidden bg-black/30">
                      {poster ? (
                        <Image
                          src={poster}
                          alt={e.title}
                          fill
                          sizes="(min-width: 1024px) 22rem, (min-width: 768px) 30vw, (min-width: 640px) 44vw, 84vw"
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
                      {/* Music Sessions cards stop at date·time → name (founder,
                          12 Nov 2026): no genre tag, no blurb under a DJ card.
                          The Special Events rail keeps its pill + blurb. */}
                      {kind !== "djs" && (
                        <>
                          <div className="mt-2 inline-block rounded-full border border-cream/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cream/55">
                            {GROUP_LABEL[group]}
                          </div>
                          {e.body && (
                            <p className="mt-3 line-clamp-2 text-sm text-cream/70">
                              {e.body}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </article>
                </a>
              );
            })}
          </RollerDeck>
        </div>
      </div>
    </section>
  );
}
