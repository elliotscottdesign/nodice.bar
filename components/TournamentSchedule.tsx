"use client";

import { useEffect, useMemo, useState } from "react";
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
};

// Fallback taglines — overridden by CMS via `pool.tournaments.tagline_*`.
const TYPE_TAGLINES_FALLBACK: Record<TournamentType, string> = {
  doubles: "Teams of two. Every other Wednesday.",
  singles: "Solo entry. Every other Wednesday.",
  special: "One-off tournaments and seasonal showdowns.",
};

const TYPE_TAGLINE_KEYS: Record<TournamentType, string> = {
  doubles: "pool.tournaments.tagline_doubles",
  singles: "pool.tournaments.tagline_singles",
  special: "pool.tournaments.tagline_special",
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

export default function TournamentSchedule() {
  const [all, setAll] = useState<DbTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [type, setType] = useState<TournamentType>("doubles");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
        <div className="mb-3 text-center text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
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
                  className={`rounded-full border px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition ${
                    active
                      ? "border-plonkPink bg-plonkPink text-white shadow-lg shadow-plonkPink/20"
                      : "border-cream/15 bg-ink/40 text-cream/85 hover:border-cream/40"
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
                        !isSoldOut &&
                        setExpandedId(isExpanded ? null : t.id)
                      }
                      disabled={isSoldOut}
                      className={`${baseCardCls} ${
                        isSoldOut
                          ? "cursor-not-allowed border-cream/10 bg-ink/20 opacity-60"
                          : isExpanded
                            ? "border-plonkPink bg-plonkPink/10"
                            : "border-cream/10 bg-ink/40 hover:border-plonkPink/60 hover:bg-plonkPink/10"
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
                              isSoldOut
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
                            : spotsLeft === 1
                              ? "Last spot"
                              : `${spotsLeft} of ${t.max_teams} left`}
                        </div>
                      </div>

                      {/* CTA pill */}
                      <div
                        className={`mt-5 inline-block rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-widest ${
                          isSoldOut
                            ? "border border-cream/15 text-cream/50"
                            : isExpanded
                              ? "bg-cream/10 text-cream"
                              : "bg-plonkPink text-white"
                        }`}
                      >
                        {isSoldOut
                          ? "Sold out"
                          : isExpanded
                            ? "Selected"
                            : "Sign up →"}
                      </div>
                    </button>
                  );
                })}
            </RollerDeck>
          )}

          {/* Booking form for the currently-selected card. Rendered
              below the rail so the rail stays clean and the form can
              breathe. */}
          {expandedId && (
            <div className="mx-auto mt-8 max-w-2xl">
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
