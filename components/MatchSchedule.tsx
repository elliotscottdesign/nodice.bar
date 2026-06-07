"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadUpcomingEventsByCategory,
  type DbEvent,
} from "@/lib/db/eventsPlatform";
import { useContent } from "@/lib/content";
import { Editable } from "./Editable";

// =============================================================
// MatchSchedule — World Cup fixtures roller-deck
// =============================================================
// Drops into /world-cup the same way TournamentSchedule drops into
// /pool. Each card is one match (one row in `events` tagged
// category='world_cup'). The card's CTA hops the customer to
// /book/table with the match date prefilled so they reserve a bar
// table for kickoff.
//
// Authoring model: the founder adds matches via /admin/events,
// pickng category = "World Cup — Match". Recommended event name
// format: "Brazil vs Germany" — first half splits into HOME vs
// AWAY for the card's big two-line layout.
//
// Why not its own table: matches are date-bound events with a
// name, time, and optional description — exactly what the events
// table holds. Adding a dedicated table would duplicate the admin
// UI for no extra power.
// =============================================================

function formatTime(hhmmss: string | null): string {
  if (!hhmmss) return "TBC";
  return hhmmss.slice(0, 5);
}

function splitMatchTitle(name: string): { home: string; away: string } | null {
  // Accept "Brazil vs Germany" / "Brazil v Germany" / "Brazil - Germany".
  const sep = name.match(/\s+(?:vs?|v\.?|-|–)\s+/i);
  if (!sep) return null;
  const idx = name.indexOf(sep[0]);
  const home = name.slice(0, idx).trim();
  const away = name.slice(idx + sep[0].length).trim();
  if (!home || !away) return null;
  return { home, away };
}

export default function MatchSchedule() {
  const [matches, setMatches] = useState<DbEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const eyebrow = useContent("worldcup.schedule.eyebrow", "Match schedule");
  const title = useContent(
    "worldcup.schedule.title",
    "Reserve a Table for Kickoff",
  );
  const intro = useContent(
    "worldcup.schedule.intro",
    "Pick a match, reserve a table for the night. Big screens, full sound, proper crowd. Get in early — we fill up fast for the headline games.",
  );

  useEffect(() => {
    setLoading(true);
    loadUpcomingEventsByCategory("world_cup")
      .then((rows) => setMatches(rows))
      .catch((e) =>
        setErr(e instanceof Error ? e.message : "Failed to load matches"),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <section
      id="matches"
      className="scroll-mt-24 bg-ink/40 px-6 py-20"
    >
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
              {/* Edge fades */}
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
                {matches.map((m) => {
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

                  return (
                    <Link
                      key={m.id}
                      href={`/book/table?date=${m.event_date}`}
                      className={`group snap-start shrink-0 w-[260px] sm:w-[240px] rounded-2xl border p-5 text-left transition ${
                        isFull
                          ? "cursor-not-allowed border-cream/10 bg-ink/20 opacity-60"
                          : "border-cream/10 bg-ink/40 hover:border-plonkPink/60 hover:bg-plonkPink/10"
                      }`}
                      onClick={(e) => {
                        if (isFull) e.preventDefault();
                      }}
                    >
                      {/* Date eyebrow */}
                      <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
                        {weekday} · {dayMonth}
                      </div>

                      {/* Match-up — big two-line if we can split, else
                          one big line if the name didn't follow X vs Y. */}
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

                      {/* Kickoff time */}
                      <div className="mt-4 text-xs uppercase tracking-widest text-cream/55">
                        Kickoff · {kickoff}
                      </div>

                      {/* Optional description / stage label */}
                      {m.description && (
                        <p className="mt-2 text-xs text-cream/65">
                          {m.description}
                        </p>
                      )}

                      {/* CTA pill */}
                      <div
                        className={`mt-5 inline-block rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-widest ${
                          isFull
                            ? "border border-cream/15 text-cream/50"
                            : "bg-plonkPink text-white"
                        }`}
                      >
                        {isFull ? "Fully booked" : "Reserve a table →"}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
