"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RollerDeck from "@/components/RollerDeck";
import InlineTournamentBooking from "@/components/InlineTournamentBooking";
import {
  loadPingPongNights,
  type DbTournament,
} from "@/lib/db/tournaments";

// =============================================================
// /pingpong — Team Ping Pong Tournaments (Sundays from 6pm)
// =============================================================
// Public sign-up page for the Sunday team ping pong nights. Mirrors
// the /pool page's journey (date rail → inline form → Stripe pay in
// place) but with its own identity: the founder's green halftone
// header artwork (public/pingpong-header.jpg, accent #2C8E1E =
// `pong` / `pongLight` in tailwind.config).
//
// Data: the Sunday nights live in the legacy `tournaments` table
// (tournament_type='teams') — loadPingPongNights() reads them via
// anon RLS. Booking reuses InlineTournamentBooking (teams behaves
// like doubles: both players' names + emails, prize splits half-
// and-half) and the tournament-checkout fn, which falls back to the
// tournaments table for teams nights.
// League: the `pingpong` edge fn's public getLeague action.
// =============================================================

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://rntcujcpsozvuxvmlejv.supabase.co";

type LeagueRow = {
  rank: number;
  name: string;
  nights: number;
  wins: number;
  seconds: number;
  thirds: number;
  frameDiff: number;
  pts: number;
  qualifies: boolean;
};

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

function formatFee(pence: number): string {
  if (pence % 100 === 0) return `£${pence / 100}`;
  return `£${(pence / 100).toFixed(2)}`;
}

const HOW_IT_WORKS: Array<{ icon: string; title: string; body: string }> = [
  {
    icon: "🏓",
    title: "Teams of two, Sundays 6pm",
    body: "Grab a partner, pick a Sunday, £12 a team. Swiss rounds mean you play all night — nobody's knocked out early.",
  },
  {
    icon: "🎯",
    title: "First to 11, win by 2",
    body: "Proper table tennis scoring. Rounds are first to 11 (deuce past 10–10), the knockout is first to 21, and the final's best of 3.",
  },
  {
    icon: "🍻",
    title: "Prizes for BOTH of you",
    body: "Bar-tab prizes — £30 / £20 / £10 — split half-and-half, one voucher each, straight to each player's inbox.",
  },
  {
    icon: "🏆",
    title: "Season league",
    body: "Every night earns your team league points. The top 8 teams reach the Grand Final at the end of the season.",
  },
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Can we just turn up on the night?",
    a: "Yes — walk-ups are welcome while spots last. Booking ahead guarantees your team's place (Sundays fill up).",
  },
  {
    q: "What if we're running late?",
    a: "You can join mid-tournament — late teams enter the standings and get drawn into the next round.",
  },
  {
    q: "How do league points work?",
    a: "1st place 5 · 2nd 4 · 3rd 3 · turning up 1 · topping the rounds table +1. Use the same captain email every night — that's how your team's points add up.",
  },
];

export default function PingPongPage() {
  const [nights, setNights] = useState<DbTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [league, setLeague] = useState<LeagueRow[] | null>(null);
  const [leagueNights, setLeagueNights] = useState(0);
  const bookingRef = useRef<HTMLDivElement | null>(null);

  // Click-to-reveal → auto-scroll (site-wide UX rule): when a date is
  // picked, the booking form mounts below the rail — scroll it into view.
  useEffect(() => {
    if (!expandedId) return;
    const id = requestAnimationFrame(() => {
      bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(id);
  }, [expandedId]);

  useEffect(() => {
    let cancelled = false;
    loadPingPongNights()
      .then((rows) => {
        if (!cancelled) setNights(rows);
      })
      .catch((e) => {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : "Couldn't load the Sundays.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Team league — public read from the pingpong engine.
    fetch(`${SUPABASE_URL}/functions/v1/pingpong`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getLeague" }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.ok) {
          setLeague((d.table ?? []) as LeagueRow[]);
          setLeagueNights(d.nights ?? 0);
        }
      })
      .catch(() => {
        /* league is decorative — the page works without it */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return nights
      .filter((t) => t.event_date >= today && t.bookable)
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
  }, [nights]);

  const selected = upcoming.find((t) => t.id === expandedId) ?? null;

  return (
    <main className="relative isolate">
      {/* Founder's green halftone artwork as a fixed page background,
          washed dark so content stays readable (same pattern as /pool). */}
      <div className="fixed inset-0 -z-10">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/pingpong-header.jpg)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/62 to-black/92" />
      </div>

      {/* ── Hero — founder copy 6 Aug 2026 ── */}
      <section className="px-6 pb-14 pt-28 text-center sm:pt-36">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-pongLight">
          Free to play · London Fields
        </div>
        <h1 className="mt-4 font-display text-5xl uppercase tracking-wider text-cream sm:text-7xl">
          Ping Pong
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-cream/80">
          Our ping pong table is <strong className="text-cream">free to play
          for all customers</strong> at the bar — a professional-standard
          Cornilleau outdoor table outside, bats and balls provided, and a
          host of local talent ready to beat you if you&apos;re looking for
          some singles action.
        </p>
        <p className="mx-auto mt-4 max-w-xl text-base text-cream/80">
          We also run a <strong className="text-cream">Sunday ping pong
          tournament every week from 6pm</strong> — rounds, then knockouts,
          with bar-tab prizes to be won. Sign up below.
        </p>
        <a
          href="#sundays"
          className="mt-8 inline-block rounded-full bg-pong px-10 py-4 text-sm font-bold uppercase tracking-widest text-white shadow-lg shadow-pong/40 transition hover:bg-pongLight hover:text-black"
        >
          Book your team in · £12
        </a>
      </section>

      {/* ── How it works ── */}
      <section className="px-6 py-14">
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((c) => (
            <div
              key={c.title}
              className="rounded-2xl border border-pong/25 bg-black/45 p-6 backdrop-blur-sm"
            >
              <div className="text-2xl">{c.icon}</div>
              <div className="mt-3 font-display text-lg uppercase tracking-wider text-pongLight">
                {c.title}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-cream/75">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Upcoming Sundays + inline booking ── */}
      <section id="sundays" className="scroll-mt-24 bg-black/50 px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <div className="mb-3 text-center text-xs font-bold uppercase tracking-[0.3em] text-pongLight">
            Upcoming Sundays
          </div>
          <h2 className="text-center font-display text-4xl uppercase tracking-wider text-cream">
            Pick your Sunday
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-base text-cream/75">
            £12 a team, paid by the captain. Both players&apos; names and emails
            at sign-up — any prize you win splits between you.
          </p>

          <div className="mt-10">
            {loading && (
              <p className="text-center text-sm text-cream/55">Loading…</p>
            )}
            {err && <p className="text-center text-sm text-plonkPink">{err}</p>}
            {!loading && !err && upcoming.length === 0 && (
              <p className="text-center text-sm text-cream/55">
                No Sundays on sale right now — check back soon.
              </p>
            )}

            {upcoming.length > 0 && (
              <RollerDeck ariaLabel="Upcoming ping pong Sundays">
                {upcoming.map((t) => {
                  const isExpanded = expandedId === t.id;
                  const spotsLeft = Math.max(
                    0,
                    t.max_teams - t.paid_entries_count,
                  );
                  const isSoldOut = spotsLeft <= 0;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        !isSoldOut && setExpandedId(isExpanded ? null : t.id)
                      }
                      disabled={isSoldOut}
                      className={`snap-start shrink-0 w-[240px] sm:w-[220px] rounded-2xl border p-5 text-left transition ${
                        isSoldOut
                          ? "cursor-not-allowed border-cream/10 bg-ink/20 opacity-60"
                          : isExpanded
                            ? "border-pongLight bg-pong/20 ring-1 ring-pongLight/40"
                            : "border-pong/25 bg-white/5 hover:border-pongLight/70 hover:bg-pong/10"
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-pongLight">
                        Sunday
                      </div>
                      <div className="mt-2 font-display text-2xl uppercase leading-tight tracking-wider text-cream">
                        {formatDate(t.event_date)}
                      </div>
                      <div className="mt-3 text-xs uppercase tracking-widest text-cream/55">
                        6pm · {formatFee(t.entry_fee_pence)} a team
                      </div>
                      <div className="mt-4">
                        <div className="h-1 w-full overflow-hidden rounded-full bg-cream/10">
                          <div
                            className={`h-full transition-all ${
                              isSoldOut
                                ? "bg-cream/20"
                                : spotsLeft <= 2
                                  ? "bg-plonkPink"
                                  : "bg-pong"
                            }`}
                            style={{
                              width: `${((t.max_teams - spotsLeft) / t.max_teams) * 100}%`,
                            }}
                          />
                        </div>
                        <div className="mt-1.5 text-[10px] uppercase tracking-widest text-cream/45">
                          {isSoldOut
                            ? `${t.max_teams} / ${t.max_teams} teams in`
                            : spotsLeft === 1
                              ? "Last team spot"
                              : `${spotsLeft} of ${t.max_teams} team spots left`}
                        </div>
                      </div>
                      <div
                        className={`mt-5 inline-block rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-widest ${
                          isSoldOut
                            ? "border border-cream/15 text-cream/50"
                            : isExpanded
                              ? "bg-cream/10 text-cream"
                              : "bg-pong text-white"
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

            {selected && (
              <div ref={bookingRef} className="mx-auto mt-8 max-w-2xl scroll-mt-24">
                <InlineTournamentBooking
                  tournament={selected}
                  onClose={() => setExpandedId(null)}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Team league ── */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-2xl">
          <div className="mb-3 text-center text-xs font-bold uppercase tracking-[0.3em] text-pongLight">
            Season league
          </div>
          <h2 className="text-center font-display text-4xl uppercase tracking-wider text-cream">
            Team League
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-sm text-cream/70">
            Every Sunday earns points. Top 8 teams (✦) reach the Grand Final.
            {leagueNights > 0 &&
              ` ${leagueNights} night${leagueNights === 1 ? "" : "s"} played so far.`}
          </p>

          <div className="mt-8 overflow-x-auto rounded-2xl border border-pong/25 bg-black/55 p-5 backdrop-blur-sm">
            {!league || league.length === 0 ? (
              <p className="py-6 text-center text-sm text-cream/55">
                The league starts with the first Sunday — your team could be
                top of this table.
              </p>
            ) : (
              <table className="w-full whitespace-nowrap text-left text-sm text-cream">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-cream/45">
                    <th className="pb-3 pr-3">#</th>
                    <th className="pb-3 pr-3">Team</th>
                    <th className="pb-3 pr-3 text-right">Nights</th>
                    <th className="pb-3 pr-3 text-right">🥇</th>
                    <th className="pb-3 pr-3 text-right">+/−</th>
                    <th className="pb-3 text-right">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {league.slice(0, 10).map((r) => (
                    <tr
                      key={r.rank}
                      className={`border-t border-cream/10 ${
                        r.qualifies ? "bg-pong/10" : ""
                      }`}
                    >
                      <td className="py-2.5 pr-3 font-bold text-pongLight">
                        {r.rank}
                        {r.qualifies ? " ✦" : ""}
                      </td>
                      <td className="py-2.5 pr-3 font-semibold">{r.name}</td>
                      <td className="py-2.5 pr-3 text-right text-cream/70">
                        {r.nights}
                      </td>
                      <td className="py-2.5 pr-3 text-right">{r.wins || ""}</td>
                      <td className="py-2.5 pr-3 text-right text-cream/70">
                        {r.frameDiff > 0 ? `+${r.frameDiff}` : r.frameDiff}
                      </td>
                      <td className="py-2.5 text-right text-base font-bold text-pongLight">
                        {r.pts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-black/60 px-6 py-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center font-display text-3xl uppercase tracking-wider text-cream">
            Good to know
          </h2>
          <div className="mt-8 space-y-4">
            {FAQS.map((f) => (
              <div
                key={f.q}
                className="rounded-2xl border border-pong/20 bg-black/45 p-5"
              >
                <div className="font-bold text-pongLight">{f.q}</div>
                <p className="mt-2 text-sm leading-relaxed text-cream/75">{f.a}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-center text-xs uppercase tracking-widest text-cream/45">
            No Dice · 407 Mentmore Terrace, London Fields, E8 3PH
          </p>
        </div>
      </section>
    </main>
  );
}
