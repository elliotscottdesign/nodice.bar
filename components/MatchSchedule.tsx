"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadUpcomingEventsByCategory,
  loadTicketTypesForEvent,
  type DbEvent,
  type DbTicketType,
} from "@/lib/db/eventsPlatform";
import { useContent } from "@/lib/content";
import { Editable } from "./Editable";
import InlineMatchBooking, {
  type MatchBookingTarget,
} from "./InlineMatchBooking";

// =============================================================
// MatchSchedule — World Cup fixtures roller-deck
// =============================================================
// Each card is one match (one events row tagged category='world_cup').
//
// Two booking modes per match, decided by the data:
//   • FREE   — no active ticket_type with price > 0
//                → CTA "Reserve a table →" links to
//                  /book/table?date=<match_date>
//   • PAID   — an active ticket_type with price_pence > 0
//                → CTA expands InlineMatchBooking inline below the
//                  rail (Stripe Payment Element, same UX as the
//                  pool tournament sign-up)
//
// Both modes are admin-driven: free vs paid is just "does this
// event have a paid ticket type in /admin/events?". No new admin
// surface is needed for the World Cup specifically.
// =============================================================

function formatTime(hhmmss: string | null): string {
  if (!hhmmss) return "TBC";
  return hhmmss.slice(0, 5);
}

function splitMatchTitle(name: string): { home: string; away: string } | null {
  const sep = name.match(/\s+(?:vs?|v\.?|-|–)\s+/i);
  if (!sep) return null;
  const idx = name.indexOf(sep[0]);
  const home = name.slice(0, idx).trim();
  const away = name.slice(idx + sep[0].length).trim();
  if (!home || !away) return null;
  return { home, away };
}

function formatPounds(p: number): string {
  if (p === 0) return "Free";
  if (p % 100 === 0) return `£${p / 100}`;
  return `£${(p / 100).toFixed(2)}`;
}

// One enriched match — events row + first active priced ticket type
// (or null if free).
type MatchWithTicket = {
  event: DbEvent;
  paidTicket: DbTicketType | null;
};

export default function MatchSchedule() {
  const [matches, setMatches] = useState<MatchWithTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const eyebrow = useContent("worldcup.schedule.eyebrow", "Match schedule");
  const title = useContent(
    "worldcup.schedule.title",
    "Pick a Match",
  );
  const intro = useContent(
    "worldcup.schedule.intro",
    "Big screens, full sound, proper crowd. Free table reservations on most matches — paid entry on the headliners. Get in early.",
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const events = await loadUpcomingEventsByCategory("world_cup");
        // Load ticket types in parallel. Most matches will be free
        // (zero priced tickets), so we pick the FIRST priced one as
        // the "headline" ticket for the inline form.
        const ticketRows = await Promise.all(
          events.map((e) => loadTicketTypesForEvent(e.id)),
        );
        const enriched: MatchWithTicket[] = events.map((event, i) => {
          const tickets = ticketRows[i];
          const paid = tickets.find((t) => t.active && t.price_pence > 0) ?? null;
          return { event, paidTicket: paid };
        });
        if (!cancelled) setMatches(enriched);
      } catch (e) {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : "Failed to load matches");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const expandedMatch = matches.find((m) => m.event.id === expandedId);

  return (
    <section id="matches" className="scroll-mt-24 bg-ink/40 px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <div className="mb-3 text-center text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
          <Editable k="worldcup.schedule.eyebrow">{eyebrow}</Editable>
        </div>
        <h2 className="text-center font-display text-4xl uppercase tracking-wider sm:text-5xl">
          <Editable k="worldcup.schedule.title">{title}</Editable>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-base text-cream/75">
          <Editable k="worldcup.schedule.intro" multiline>
            {intro}
          </Editable>
        </p>

        <div className="mt-10">
          {loading && (
            <p className="text-center text-sm text-cream/55">Loading…</p>
          )}
          {err && (
            <p className="text-center text-sm text-plonkPink">{err}</p>
          )}
          {!loading && !err && matches.length === 0 && (
            <p className="text-center text-sm text-cream/55">
              No matches on the schedule yet. Add them in
              <span className="text-plonkTeal"> /admin/events</span> with
              category "World Cup — Match" — they'll show up here.
            </p>
          )}

          {matches.length > 0 && (
            <div className="relative -mx-6 sm:mx-0">
              <div
                aria-hidden
                className="pointer-events-none absolute left-0 top-0 z-10 h-full w-8 bg-gradient-to-r from-ink to-transparent sm:w-12"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute right-0 top-0 z-10 h-full w-8 bg-gradient-to-l from-ink to-transparent sm:w-12"
              />

              <div
                className="hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2 pt-1"
                style={{
                  scrollPaddingLeft: "24px",
                  scrollPaddingRight: "24px",
                }}
              >
                {matches.map(({ event: m, paidTicket }) => {
                  const teams = splitMatchTitle(m.name);
                  const d = new Date(`${m.event_date}T00:00:00`);
                  const weekday = d.toLocaleDateString("en-GB", {
                    weekday: "long",
                  });
                  const dayMonth = d.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                  });
                  const kickoff = formatTime(m.start_time);
                  const isFull =
                    m.max_attendees !== null &&
                    m.paid_entries_count >= m.max_attendees;
                  const isExpanded = expandedId === m.id;
                  const isPaid = !!paidTicket;

                  const baseCardCls =
                    "snap-start shrink-0 w-[260px] sm:w-[240px] rounded-2xl border p-5 text-left transition";

                  const cardInner = (
                    <>
                      <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
                        {weekday} · {dayMonth}
                      </div>

                      {teams ? (
                        <div className="mt-3 space-y-1">
                          <div className="font-display text-2xl uppercase leading-tight tracking-wider text-cream">
                            {teams.home}
                          </div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-cream/45">
                            vs
                          </div>
                          <div className="font-display text-2xl uppercase leading-tight tracking-wider text-cream">
                            {teams.away}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 font-display text-2xl uppercase leading-tight tracking-wider text-cream">
                          {m.name}
                        </div>
                      )}

                      <div className="mt-4 text-xs uppercase tracking-widest text-cream/55">
                        Kickoff · {kickoff}
                      </div>

                      {/* Ticket badge — only on paid matches */}
                      {isPaid && (
                        <div className="mt-2 inline-block rounded-full bg-plonkTeal/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-plonkTeal">
                          {formatPounds(paidTicket.price_pence)} entry
                        </div>
                      )}

                      {m.description && (
                        <p className="mt-2 text-xs text-cream/65">
                          {m.description}
                        </p>
                      )}

                      <div
                        className={`mt-5 inline-block rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-widest ${
                          isFull
                            ? "border border-cream/15 text-cream/50"
                            : isExpanded
                              ? "bg-cream/10 text-cream"
                              : "bg-plonkPink text-white"
                        }`}
                      >
                        {isFull
                          ? "Sold out"
                          : isExpanded
                            ? "Selected"
                            : isPaid
                              ? "Buy tickets →"
                              : "Reserve a table →"}
                      </div>
                    </>
                  );

                  // Paid match → button that toggles inline expand
                  if (isPaid) {
                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={isFull}
                        onClick={() =>
                          !isFull && setExpandedId(isExpanded ? null : m.id)
                        }
                        className={`${baseCardCls} ${
                          isFull
                            ? "cursor-not-allowed border-cream/10 bg-ink/20 opacity-60"
                            : isExpanded
                              ? "border-plonkPink bg-plonkPink/10"
                              : "border-cream/10 bg-ink/40 hover:border-plonkPink/60 hover:bg-plonkPink/10"
                        }`}
                      >
                        {cardInner}
                      </button>
                    );
                  }

                  // Free match → link to /book/table prefilled
                  return (
                    <Link
                      key={m.id}
                      href={`/book/table?date=${m.event_date}`}
                      className={`${baseCardCls} ${
                        isFull
                          ? "cursor-not-allowed border-cream/10 bg-ink/20 opacity-60"
                          : "border-cream/10 bg-ink/40 hover:border-plonkPink/60 hover:bg-plonkPink/10"
                      }`}
                      onClick={(e) => {
                        if (isFull) e.preventDefault();
                      }}
                    >
                      {cardInner}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Inline ticket form for the currently-selected paid match */}
          {expandedMatch && expandedMatch.paidTicket && (
            <div className="mx-auto mt-8 max-w-2xl">
              <InlineMatchBooking
                target={buildTarget(expandedMatch)}
                onClose={() => setExpandedId(null)}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function buildTarget(m: MatchWithTicket): MatchBookingTarget {
  const t = m.paidTicket!;
  const capRemaining =
    m.event.max_attendees !== null
      ? Math.max(0, m.event.max_attendees - m.event.paid_entries_count)
      : null;
  return {
    event_id: m.event.id,
    ticket_type_id: t.id,
    match_name: m.event.name,
    match_date: m.event.event_date,
    match_time: m.event.start_time,
    ticket_label: t.name,
    price_per_ticket_pence: t.price_pence,
    capacity_remaining: capRemaining,
  };
}
