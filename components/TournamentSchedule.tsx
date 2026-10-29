"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RollerDeck from "./RollerDeck";
import {
  loadOpenTournaments,
  type DbTournament,
} from "@/lib/db/tournaments";
import { useContent } from "@/lib/content";
import { Editable } from "./Editable";
import InlineTournamentBooking from "./InlineTournamentBooking";
import { POOL_HOUSE_RULES } from "@/lib/poolHouseRules";

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Tab bar: EVENTS (the scroller) ↔ RULES (house-rules panel). LEAGUE and
  // TEAM PROFILE are link tabs that leave the page, so they don't own a view.
  const [view, setView] = useState<"events" | "rules">("events");
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
  // checkout options to book those nights and join in"). Every open night
  // now lives on one unified rail, so there's no type filter to flip.
  useEffect(() => {
    if (typeof window === "undefined" || !all.length) return;
    const want = new URLSearchParams(window.location.search).get("night");
    if (!want) return;
    const hit = all.find((t) => t.id === want);
    if (!hit) return;
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
  const tagline = useContent(
    "pool.tournaments.tagline",
    "Doubles, singles and special events — every open night, in date order.",
  );

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

  // One unified rail: EVERY open night, every type, in date order
  // (founder, 20 Oct 2026 — drop the per-type filter so doubles,
  // singles and special events all sit together on one scroller).
  const events = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return all
      .filter((t) => t.event_date >= today)
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
  }, [all]);

  // Placeholder poster — the founder has set a per-event poster on
  // every night in the DB; this is the belt-and-braces fallback (the
  // next/first event's poster) for any future night left without one.
  const placeholderPoster = useMemo(
    () => events.find((e) => e.poster_url)?.poster_url ?? null,
    [events],
  );

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

        {/* Tab bar (founder, 20 Oct 2026): EVENTS · LEAGUE · RULES · TEAM
            PROFILE. No more per-type filter pills — every pool night (incl.
            Ball Breakers and Pocket Society specials) lives on the one EVENTS
            scroller. EVENTS and RULES switch the panel below; LEAGUE and TEAM
            PROFILE are links that leave the page. Pills stack full-width on
            mobile, sit as a row on sm+. */}
        <div className="mt-10 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
          <button
            type="button"
            onClick={() => setView("events")}
            aria-pressed={view === "events"}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-full border px-6 py-3 text-sm font-bold uppercase tracking-widest transition sm:w-auto ${
              view === "events"
                ? "border-violet-400 bg-violet-500 text-white shadow-lg shadow-violet-500/30 ring-1 ring-violet-300/40"
                : "border-violet-300/25 bg-white/5 text-violet-100/80 hover:border-violet-300/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            🎱 Events
          </button>
          <a
            href="/league"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-violet-300/25 bg-white/5 px-6 py-3 text-sm font-bold uppercase tracking-widest text-violet-100/80 transition hover:border-violet-300/60 hover:bg-white/10 hover:text-white sm:w-auto"
          >
            🏆 League
          </a>
          <button
            type="button"
            onClick={() => setView("rules")}
            aria-pressed={view === "rules"}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-full border px-6 py-3 text-sm font-bold uppercase tracking-widest transition sm:w-auto ${
              view === "rules"
                ? "border-violet-400 bg-violet-500 text-white shadow-lg shadow-violet-500/30 ring-1 ring-violet-300/40"
                : "border-violet-300/25 bg-white/5 text-violet-100/80 hover:border-violet-300/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            📋 Rules
          </button>
          <a
            href="https://team.nodice.bar/pool"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-violet-300/25 bg-white/5 px-6 py-3 text-sm font-bold uppercase tracking-widest text-violet-100/80 transition hover:border-violet-300/60 hover:bg-white/10 hover:text-white sm:w-auto"
          >
            👤 Team profile
          </a>
        </div>

        {view === "events" && (
          <p className="mx-auto mt-4 max-w-md text-center text-xs uppercase tracking-widest text-cream/55">
            <Editable k="pool.tournaments.tagline">{tagline}</Editable>
          </p>
        )}

        {/* House-rules panel. Shown by the RULES tab, mirrored from the team
            hub (team.nodice.bar) via lib/poolHouseRules. */}
        {view === "rules" && (
          <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-violet-300/20 bg-ink/50 p-5 text-left scroll-mt-24 sm:p-6">
            <div className="mb-1 text-xs font-bold uppercase tracking-[0.3em] text-violet-300">
              House Rules
            </div>
            <p className="mb-4 text-xs text-cream/55">
              8-ball, No Dice house rules — Scotch doubles, and the golden
              break is NOT a win. Tap a rule to read it.
            </p>
            <div className="divide-y divide-cream/10">
              {POOL_HOUSE_RULES.map((r) => (
                <details key={r.t} className="group py-2">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-display text-base uppercase tracking-wider text-cream">
                    {r.t}
                    <span className="text-xs text-violet-300 transition group-open:rotate-180">
                      ▾
                    </span>
                  </summary>
                  <p className="pt-2 text-[13px] leading-relaxed text-cream/75">
                    {r.body}
                  </p>
                </details>
              ))}
            </div>
          </div>
        )}

        </div>

        {/* Events scroller breaks out of the max-w-3xl column so it can use
            the full desktop width (founder, 21 Oct 2026 — the centred row
            left too much empty space either side). Still capped on mobile/
            tablet, widening only from lg up, so the phone layout is untouched. */}
        {view === "events" && (
        <div className="mx-auto mt-10 max-w-3xl lg:max-w-6xl">
          {loading && (
            <p className="text-center text-sm text-cream/55">Loading…</p>
          )}
          {err && (
            <p className="text-center text-sm text-plonkPink">{err}</p>
          )}
          {!loading && !err && events.length === 0 && (
            <p className="text-center text-sm text-cream/55">
              No upcoming pool tournaments on the schedule yet. Check back
              soon.
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
            <RollerDeck center ariaLabel="Upcoming pool nights">
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
                  // 3-ish on tablet. On desktop (lg+) the rail widens to
                  // max-w-6xl, so the cards grow too for more presence
                  // (founder, 21 Oct 2026). Mobile/tablet widths untouched.
                  const baseCardCls =
                    "snap-start shrink-0 w-[240px] sm:w-[220px] lg:w-[250px] xl:w-[270px] rounded-2xl border p-5 text-left transition";

                  // ── SPECIAL EVENTS (founder rule, 18 Oct 2026) ──
                  // A special night is presented by its POSTER, and its button
                  // goes to the organiser's own page — these are run or
                  // ticketed elsewhere (Macmillan's fundraising page, Ball
                  // Breakers on clyx, Pocket Society on Ticket Tailor), so the
                  // inline booking form and a places-left count would both be
                  // wrong. Any special event with a link gets this treatment.
                  if (t.tournament_type === "special" && t.external_link) {
                    return (
                      <a
                        id={`tourn-card-${t.id}`}
                        key={t.id}
                        href={t.external_link}
                        target="_blank"
                        rel="noreferrer"
                        className={`${baseCardCls} group block overflow-hidden border-plonkPink/30 bg-white/5 p-0 hover:border-plonkPink/70`}
                      >
                        {t.poster_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={t.poster_url}
                            alt={t.name}
                            className="aspect-[4/5] w-full object-cover transition group-hover:opacity-90"
                          />
                        ) : (
                          <div className="flex aspect-[4/5] w-full items-center justify-center bg-ink/60 text-4xl">
                            🎱
                          </div>
                        )}
                        <div className="p-4">
                          <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
                            {formatDate(t.event_date)}
                          </div>
                          <div className="mt-1.5 font-display text-lg uppercase leading-tight tracking-wider text-cream">
                            {t.name}
                          </div>
                          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-plonkPink px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-white">
                            Find out more →
                          </div>
                        </div>
                      </a>
                    );
                  }

                  if (!t.bookable) {
                    return (
                      <div
                        id={`tourn-card-${t.id}`}
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

                  // ── REGULAR NIGHTS AS POSTERS (founder, 20 Oct 2026) ──
                  // Every bookable night now leads with its poster image
                  // (same treatment as special events), with the date /
                  // price / spots and Sign-up CTA sitting below. The whole
                  // card is still the expand-to-book button. `poster` falls
                  // back to the next night's image if a future night is
                  // left without one.
                  const poster = t.poster_url || placeholderPoster;
                  return (
                    <button
                      id={`tourn-card-${t.id}`}
                      key={t.id}
                      type="button"
                      onClick={() =>
                        !blocked &&
                        setExpandedId(isExpanded ? null : t.id)
                      }
                      disabled={blocked}
                      className={`${baseCardCls} group block overflow-hidden p-0 ${
                        blocked
                          ? "cursor-not-allowed border-cream/10 bg-ink/20 opacity-60"
                          : isExpanded
                            ? "border-violet-400 bg-violet-500/15 ring-1 ring-violet-400/30"
                            : "border-violet-300/15 bg-white/5 hover:border-violet-300/60 hover:bg-violet-500/10"
                      }`}
                    >
                      {/* Poster image with the date overlaid (the placeholder
                          poster is identical across nights, so the date chip
                          is what tells the cards apart). */}
                      <div className="relative">
                        {poster ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={poster}
                            alt={t.name}
                            className={`aspect-[4/5] w-full object-cover transition ${
                              blocked ? "" : "group-hover:opacity-90"
                            }`}
                          />
                        ) : (
                          <div className="flex aspect-[4/5] w-full items-center justify-center bg-ink/60 text-4xl">
                            🎱
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent p-3">
                          <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
                            {new Date(
                              `${t.event_date}T00:00:00`,
                            ).toLocaleDateString("en-GB", { weekday: "long" })}
                          </div>
                          <div className="font-display text-xl uppercase leading-tight tracking-wider text-cream">
                            {new Date(
                              `${t.event_date}T00:00:00`,
                            ).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "long",
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="p-4">
                        {/* Time + fee */}
                        <div className="text-xs uppercase tracking-widest text-cream/55">
                          {formatTime(t.start_time)} ·{" "}
                          {t.entry_fee_pence === 0
                            ? "Free"
                            : formatFee(t.entry_fee_pence)}
                        </div>

                        {/* Spots-left bar */}
                        <div className="mt-3">
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
                          className={`mt-4 inline-block rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-widest ${
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
                      </div>
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
        )}
    </section>
  );
}
