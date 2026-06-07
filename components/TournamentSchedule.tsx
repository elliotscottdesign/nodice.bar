"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  loadOpenTournaments,
  type DbTournament,
  type TournamentType,
} from "@/lib/db/tournaments";

// =============================================================
// TournamentSchedule
// =============================================================
// Public-facing picker that lives at the bottom of /pool. Customers
// flip between Doubles and Singles (and the rare Special), then
// pick an upcoming date — clicking sends them to the team sign-up
// form at /book/tournament with the right tournament pre-selected.
//
// Data: reads every `registration_open=true` tournament from the
// DB (the public RLS policy on `tournaments` filters out closed
// ones). We filter by type + future-date client-side so the page
// is fully cacheable.
// =============================================================

const TYPE_LABELS: Record<TournamentType, string> = {
  doubles: "Doubles",
  singles: "Singles",
  special: "Special events",
};

const TYPE_TAGLINES: Record<TournamentType, string> = {
  doubles: "Teams of two. Every other Wednesday.",
  singles: "Solo entry. Every other Wednesday.",
  special: "One-off tournaments and seasonal showdowns.",
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
  // entirely if there are none in the schedule — keeps the dropdown
  // honest instead of advertising an empty section.
  const availableTypes = useMemo<TournamentType[]>(() => {
    const set = new Set<TournamentType>();
    const today = new Date().toISOString().slice(0, 10);
    for (const t of all) {
      if (t.event_date >= today) set.add(t.tournament_type);
    }
    // Keep a stable visual order even when the set is partial.
    return (["doubles", "singles", "special"] as TournamentType[]).filter((t) =>
      set.has(t),
    );
  }, [all]);

  // If our default ("doubles") isn't in the available list, fall
  // back to the first one that is. Runs once when availableTypes
  // arrives — otherwise the picker would point at an empty list.
  useEffect(() => {
    if (availableTypes.length > 0 && !availableTypes.includes(type)) {
      setType(availableTypes[0]);
    }
  }, [availableTypes, type]);

  // Upcoming events of the selected type, sorted earliest first.
  const events = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return all
      .filter((t) => t.tournament_type === type && t.event_date >= today)
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
  }, [all, type]);

  return (
    <section className="bg-ink/40 px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <div className="mb-3 text-center text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
          Tournaments
        </div>
        <h2 className="text-center font-display text-4xl uppercase tracking-wider sm:text-5xl">
          Sign Your Team Up
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-base text-cream/75">
          Pool tournaments run every Wednesday at No Dice — doubles and
          singles alternate weekly. Pick a format and a date, pay in advance to
          hold your spot.
        </p>

        {/* Type picker */}
        {availableTypes.length > 1 && (
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {availableTypes.map((t) => {
              const active = t === type;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
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
          {TYPE_TAGLINES[type]}
        </p>

        {/* List of dates */}
        <div className="mx-auto mt-10 max-w-2xl">
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

          <ul className="space-y-3">
            {events.map((t) => {
              // GRAND FINAL and any future "invitation only" specials
              // show in the schedule but aren't clickable — render as
              // a div instead of a Link so there's no false affordance.
              const meta =
                formatTime(t.start_time) +
                (t.bookable
                  ? ` · ${formatFee(t.entry_fee_pence)} entry · up to ${t.max_teams} teams`
                  : t.description
                    ? ` · ${t.description}`
                    : "");
              return (
                <li key={t.id}>
                  {t.bookable ? (
                    <Link
                      href={`/book/tournament?tournament=${t.id}`}
                      className="group flex items-center justify-between gap-4 rounded-xl border border-cream/10 bg-ink/40 px-5 py-4 transition hover:border-plonkPink/60 hover:bg-plonkPink/10"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-bold text-cream">
                          {formatDate(t.event_date)}
                        </div>
                        <div className="mt-0.5 text-xs uppercase tracking-widest text-cream/55">
                          {meta}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-plonkPink px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-white opacity-90 transition group-hover:opacity-100">
                        Sign up →
                      </span>
                    </Link>
                  ) : (
                    // Non-bookable rows (e.g. the two Grand Finals)
                    // — the event name carries the meaning, so we
                    // show it as the title and push date / time /
                    // description into the subtitle.
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-plonkYellow/30 bg-plonkYellow/5 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-bold text-cream">
                          {t.name}
                        </div>
                        <div className="mt-0.5 text-xs uppercase tracking-widest text-cream/55">
                          {formatDate(t.event_date)} · {formatTime(t.start_time)}
                          {t.description ? ` · ${t.description}` : ""}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full border border-plonkYellow/50 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-plonkYellow">
                        Invitation only
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
