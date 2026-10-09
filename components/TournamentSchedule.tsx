"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RollerDeck from "./RollerDeck";
import {
  loadOpenTournaments,
  type DbTournament,
  type TournamentType,
} from "@/lib/db/tournaments";
import { useContent } from "@/lib/content";
import { Editable } from "./Editable";
import InlineTournamentBooking from "./InlineTournamentBooking";

// =============================================================
// TournamentSchedule
// =============================================================
// Public-facing picker that lives at the bottom of /pool. Customers
// flip between Doubles and Singles (and the rare Special), then
// pick an upcoming date — clicking expands an inline form + Stripe
// Embedded Checkout in that row. NO page navigation. The whole
// journey (pick date → fill team details → pay → confirmation) lives
// inside this section.
//
// State:
//   • `all`         — every open tournament from the DB
//   • `type`        — currently active pill (doubles / singles / special)
//   • `expandedId`  — which row (if any) is currently open. Only one
//                     at a time, so clicking a different row closes
//                     the current.
//
// Non-bookable rows (the two SEASON FINALs) show an "Invitation only"
// badge instead of an expandable Sign Up.
// =============================================================

const TYPE_LABELS: Record<TournamentType, string> = {
  doubles: "Doubles",
  singles: "Singles",
  special: "Special events",
  teams: "Teams",   // ping pong — lives on /pingpong, never listed here
};

// Fallback taglines — overridden by CMS via `pool.tournaments.tagline_*`.
const TYPE_TAGLINES_FALLBACK: Record<TournamentType, string> = {
  doubles: "Teams of two. Every other Wednesday.",
  singles: "Solo entry. Every other Wednesday.",
  special: "One-off tournaments and seasonal showdowns.",
  teams: "Teams of two. Sundays from 6pm.",
};

const TYPE_TAGLINE_KEYS: Record<TournamentType, string> = {
  doubles: "pool.tournaments.tagline_doubles",
  singles: "pool.tournaments.tagline_singles",
  special: "pool.tournaments.tagline_special",
  teams: "pingpong.tournaments.tagline_teams",
};

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime(hhmmss: string | null): string {
  if (!hhmmss) return "TBC";
  return hhmmss.slice(0, 5);
}

function formatFee(pence: number): string {
  if (pence % 100 === 0) return `£${pence / 100}`;
  return `£${(pence / 100).toFixed(2)}`;
}

// Online entry closes 30 min before a tournament starts (founder rule
// 9 Oct 2026) — mirrored server-side in tournament-checkout. After that
// the card shows "Closed for bookings" and offers walk-up at the bar.
const TOURNAMENT_CLOSE_LEAD_MIN = 30;

function londonNowParts(now = new Date()): { iso: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  let hour = parseInt(parts.hour, 10);
  if (hour === 24) hour = 0;
  return {
    iso: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: hour * 60 + parseInt(parts.minute, 10),
  };
}

function entriesClosed(eventDate: string, startTime: string | null): boolean {
  const { iso, minutes } = londonNowParts();
  if (eventDate < iso) return true;
  if (eventDate === iso && startTime) {
    const [h, m] = startTime.split(":").map(Number);
    const startMin = h * 60 + (m || 0);
    return minutes >= startMin - TOURNAMENT_CLOSE_LEAD_MIN;
  }
  return false;
}

export default function TournamentSchedule() {
  const [all, setAll] = useState<DbTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [type, setType] = useState<TournamentType>("doubles");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Ref on the inline booking form wrapper. When the customer picks
  // a tournament we smooth-scroll the form into view so they don't
  // have to hunt for it below the rail of cards.
  const bookingRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll the inline form into view whenever a tournament is
  // selected. We wait a frame so the form is mounted before we
  // measure its position. 'center' positioning keeps the card they
  // tapped partially visible above the form.
  useEffect(() => {
    if (!expandedId) return;
    const id = requestAnimationFrame(() => {
      bookingRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    return () => cancelAnimationFrame(id);
  }, [expandedId]);

  // Deep link from a team's own page: /pool?night=<id> opens that night's
  // booking form straight away (founder, 8 Oct 2026 — "this should load
  // checkout options to book those nights and join in"). Also flips the
  // singles/doubles filter so the night is actually in the visible rail.
  useEffect(() => {
    if (typeof window === "undefined" || !all.length) return;
    const want = new URLSearchParams(window.location.search).get("night");
    if (!want) return;
    const hit = all.find((t) => t.id === want);
    if (!hit) return;
    if (hit.tournament_type === "singles" || hit.tournament_type === "doubles") {
      setType(hit.tournament_type as TournamentType);
    }
    setExpandedId(want);
  }, [all]);

  // Scroll-arrow behaviour, snap rail, edge-fades and hidden
  // scrollbar all come from the shared <RollerDeck> wrapper below.

  // Editable copy. Founder can change all of these from
  // /admin/content/pool — the keys are namespaced under
  // pool.tournaments.* so they sit next to the existing pool page
  // content fields.
  const eyebrow = useContent("pool.tournaments.eyebrow", "Tournaments");
  const title = useContent("pool.tournaments.title", "Sign Your Team Up");
  const intro = useContent(
    "pool.tournaments.intro",
    "Pool tournaments run every Wednesday at No Dice — doubles and singles alternate weekly. Pick a format and a date, pay in advance to hold your spot.",
  );
  const taglineDoubles = useContent(
    TYPE_TAGLINE_KEYS.doubles,
    TYPE_TAGLINES_FALLBACK.doubles,
  );
  const taglineSingles = useContent(
    TYPE_TAGLINE_KEYS.singles,
    TYPE_TAGLINES_FALLBACK.singles,
  );
  const taglineSpecial = useContent(
    TYPE_TAGLINE_KEYS.special,
    TYPE_TAGLINES_FALLBACK.special,
  );
  const currentTagline =
    type === "doubles"
      ? taglineDoubles
      : type === "singles"
        ? taglineSingles
        : taglineSpecial;

  useEffect(() => {
    let cancelled = false;
    loadOpenTournaments()
      .then((rows) => {
        if (!cancelled) setAll(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          setErr(
            e instanceof Error ? e.message : "Couldn't load the tournaments.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Which types actually have open events? Hide the "Special" pill
  // entirely if there are none in the schedule.
  const availableTypes = useMemo<TournamentType[]>(() => {
    const set = new Set<TournamentType>();
    const today = new Date().toISOString().slice(0, 10);
    for (const t of all) {
      if (t.event_date >= today) set.add(t.tournament_type);
    }
    return (["doubles", "singles", "special"] as TournamentType[]).filter((t) =>
      set.has(t),
    );
  }, [all]);

  useEffect(() => {
    if (availableTypes.length > 0 && !availableTypes.includes(type)) {
      setType(availableTypes[0]);
    }
  }, [availableTypes, type]);

  const events = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return all
      .filter((t) => t.tournament_type === type && t.event_date >= today)
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
  }, [all, type]);

  // When the customer flips between Doubles ↔ Singles tabs, collapse
  // any open row — keeping it open across tabs would let them submit
  // a doubles entry while looking at singles, which is confusing.
  function setActiveType(next: TournamentType) {
    setType(next);
    setExpandedId(null);
  }

  return (
    <section id="tournaments" className="bg-ink/40 px-6 py-20 scroll-mt-24">
      <div className="mx-auto max-w-3xl">
        <div className="mb-3 text-center text-xs font-bold uppercase tracking-[0.3em] text-violet-300">
          <Editable k="pool.tournaments.eyebrow">{eyebrow}</Editable>
        </div>
        <h2 className="text-center font-display text-4xl uppercase tracking-wider sm:text-5xl">
          <Editable k="pool.tournaments.title">{title}</Editable>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-base text-cream/75">
          <Editable k="pool.tournaments.intro" multiline>
            {intro}
          </Editable>
        </p>

        {availableTypes.length > 1 && (
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {availableTypes.map((t) => {
              const active = t === type;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveType(t)}
                  className={`rounded-full border px-6 py-3 text-sm font-bold uppercase tracking-widest transition ${
                    active
                      ? "border-violet-400 bg-violet-500 text-white shadow-lg shadow-violet-500/30 ring-1 ring-violet-300/40"
                      : "border-violet-300/25 bg-white/5 text-violet-100/80 hover:border-violet-300/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              );
            })}
          </div>
        )}

        <p className="mx-auto mt-4 max-w-md text-center text-xs uppercase tracking-widest text-cream/55">
          <Editable k={TYPE_TAGLINE_KEYS[type]}>{currentTagline}</Editable>
        </p>

        {/* Already play here? Your team page — bets, pot, league, rules —
            lives on the team hub (founder, 8 Oct 2026). */}
        <div className="mt-5 flex justify-center">
          <a
            href="https://team.nodice.bar/pool"
            className="inline-flex items-center gap-2 rounded-full border border-violet-300/35 bg-white/5 px-5 py-2.5 text-[12px] font-bold uppercase tracking-widest text-violet-100/85 transition hover:border-violet-300/70 hover:bg-white/10 hover:text-white"
          >
            🎱 Team sign in
          </a>
        </div>
        <p className="mx-auto mt-2 max-w-sm text-center text-[11px] leading-relaxed text-cream/40">
          Played before? Sign in to bet on the night, track your pot, prizes and league place.
        </p>

        <div className="mt-6 text-center">
          <a
            href="/league"
            className="inline-flex items-center gap-2 rounded-full border border-violet-300/30 bg-violet-500/10 px-6 py-3 text-xs font-bold uppercase tracking-widest text-violet-100 transition hover:border-violet-300/70 hover:bg-violet-500/20 hover:text-white"
          >
            🏆 Live league table
          </a>
        </div>

        <div className="mt-10">
          {loading && (
            <p className="text-center text-sm text-cream/55">Loading…</p>
          )}
          {err && (
            <p className="text-center text-sm text-plonkPink">{err}</p>
          )}
          {!loading && !err && events.length === 0 && (
            <p className="text-center text-sm text-cream/55">
              No upcoming {TYPE_LABELS[type].toLowerCase()} tournaments on the
              schedule yet. Check back soon.
            </p>
          )}

          {/* =========================================================
              Horizontal "roller deck" of upcoming tournament dates.
              Replaces the vertical list — cards snap-scroll left/right
              on mobile, fan out as a row on desktop. Tapping a card
              selects it and the booking form renders BELOW the rail
              (rather than expanding the card in-place — keeps the rail
              tidy and avoids reflow on touch devices).
              ========================================================= */}
          {events.length > 0 && (
            <RollerDeck ariaLabel={`Upcoming ${TYPE_LABELS[type].toLowerCase()}`}>
              {events.map((t) => {
                  const isExpanded = expandedId === t.id;
                  const spotsLeft = Math.max(
                    0,
                    t.max_teams - t.paid_entries_count,
                  );
                  const isSoldOut = spotsLeft <= 0;
                  // Entries closed: within 30 min of start (or past). Takes
                  // precedence over "spots left" — sold-out still wins.
                  const closed = !isSoldOut && entriesClosed(t.event_date, t.start_time);
                  const blocked = isSoldOut || closed;

                  // Compact card width — fits ~1.3 cards on mobile so
                  // the next one peeks in (signals scrollability),
                  // 3-ish on tablet, 4 on desktop.
                  const baseCardCls =
                    "snap-start shrink-0 w-[240px] sm:w-[220px] rounded-2xl border p-5 text-left transition";

                  if (!t.bookable) {
                    return (
                      <div
                        key={t.id}
                        className={`${baseCardCls} border-plonkYellow/30 bg-plonkYellow/5`}
                      >
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-plonkYellow">
                          Invitation only
                        </div>
                        <div className="mt-3 font-display text-xl uppercase tracking-wider text-cream">
                          {t.name}
                        </div>
                        <div className="mt-2 text-xs text-cream/55">
                          {formatDate(t.event_date)} ·{" "}
                          {formatTime(t.start_time)}
                        </div>
                        {t.description && (
                          <p className="mt-3 text-xs text-cream/65">
                            {t.description}
                          </p>
                        )}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        !blocked &&
                        setExpandedId(isExpanded ? null : t.id)
                      }
                      disabled={blocked}
                      className={`${baseCardCls} ${
                        blocked
                          ? "cursor-not-allowed border-cream/10 bg-ink/20 opacity-60"
                          : isExpanded
                            ? "border-violet-400 bg-violet-500/15 ring-1 ring-violet-400/30"
                            : "border-violet-300/15 bg-white/5 hover:border-violet-300/60 hover:bg-violet-500/10"
                      }`}
                    >
                      {/* Day-of-week eyebrow */}
                      <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
                        {new Date(`${t.event_date}T00:00:00`).toLocaleDateString(
                          "en-GB",
                          { weekday: "long" },
                        )}
                      </div>
                      {/* Big date */}
                      <div className="mt-2 font-display text-2xl uppercase leading-tight tracking-wider text-cream">
                        {new Date(`${t.event_date}T00:00:00`).toLocaleDateString(
                          "en-GB",
                          { day: "numeric", month: "long" },
                        )}
                      </div>
                      {/* Time + fee */}
                      <div className="mt-3 text-xs uppercase tracking-widest text-cream/55">
                        {formatTime(t.start_time)} ·{" "}
                        {formatFee(t.entry_fee_pence)}
                      </div>

                      {/* Spots-left bar */}
                      <div className="mt-4">
                        <div className="h-1 w-full overflow-hidden rounded-full bg-cream/10">
                          <div
                            className={`h-full transition-all ${
                              blocked
                                ? "bg-cream/20"
                                : spotsLeft <= 2
                                  ? "bg-plonkPink"
                                  : "bg-plonkTeal"
                            }`}
                            style={{
                              width: `${
                                ((t.max_teams - spotsLeft) / t.max_teams) * 100
                              }%`,
                            }}
                          />
                        </div>
                        <div className="mt-1.5 text-[10px] uppercase tracking-widest text-cream/45">
                          {isSoldOut
                            ? `${t.max_teams} / ${t.max_teams} taken`
                            : closed
                              ? "Entries closed"
                              : spotsLeft === 1
                                ? "Last spot"
                                : `${spotsLeft} of ${t.max_teams} left`}
                        </div>
                      </div>

                      {/* CTA pill */}
                      <div
                        className={`mt-5 inline-block rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-widest ${
                          blocked
                            ? "border border-cream/15 text-cream/50"
                            : isExpanded
                              ? "bg-cream/10 text-cream"
                              : "bg-plonkPink text-white"
                        }`}
                      >
                        {isSoldOut
                          ? "Sold out"
                          : closed
                            ? "Closed for bookings"
                            : isExpanded
                              ? "Selected"
                              : "Sign up →"}
                      </div>
                      {closed && (
                        <p className="mt-2 text-[10px] leading-snug text-cream/45">
                          Some walk-up slots may be available at the bar.
                        </p>
                      )}
                    </button>
                  );
                })}
            </RollerDeck>
          )}

          {/* Booking form for the currently-selected card. Rendered
              below the rail so the rail stays clean and the form can
              breathe. `bookingRef` is the target for the auto-scroll
              effect at the top of this component. */}
          {expandedId && (
            <div ref={bookingRef} className="mx-auto mt-8 max-w-2xl scroll-mt-24">
              {(() => {
                const sel = events.find((e) => e.id === expandedId);
                if (!sel || !sel.bookable) return null;
                return (
                  <InlineTournamentBooking
                    tournament={sel}
                    onClose={() => setExpandedId(null)}
                  />
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
