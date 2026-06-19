"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DbEvent, DbTicketType } from "@/lib/db/eventsPlatform";
import { flagForTeam, hasFlagAlready } from "@/lib/teamFlags";

// =============================================================
// MatchCalendar — month-grid view of World Cup matches
// =============================================================
// Mirrors the design + rules of the /events calendar:
//   • Month scroller — current month + next 3
//   • Mon-Sun 7-col grid on tablet+, single column on mobile
//   • Sticky weekday header
//   • Today's cell ringed in plonkPink
//
// Difference from /events:
//   • Data source is the `events` table (category='world_cup'),
//     not calendar_events.
//   • Each cell shows the match block(s) for that day, NOT artwork.
//   • Free matches link to /book/table?date=…  (same as the roller)
//   • Paid matches call onSelectPaid(eventId) — the parent
//     <MatchSchedule> owns the inline ticket form so it can sit
//     under either the roller OR the calendar.
//
// State that's shared with the parent roller view:
//   • matches: the already-loaded list (no duplicate fetch)
//   • expandedId / setExpandedId: which paid match is currently
//     "selected" — toggling here keeps the inline form in sync
//     with the roller below.
// =============================================================

export type MatchWithTicket = {
  event: DbEvent;
  paidTicket: DbTicketType | null;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Months derived FROM the matches list — only months that actually
// contain upcoming matches get a button. Stops the scroller offering
// empty months (e.g. August after the World Cup Final on 19 July).
// Founder rule: don't waste the customer's time on dead months.
function buildMonthRangeFromMatches(
  matches: MatchWithTicket[],
): { year: number; month: number }[] {
  const seen = new Set<string>();
  const out: { year: number; month: number }[] = [];
  for (const m of matches) {
    const d = new Date(`${m.event.event_date}T00:00:00`);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ year: d.getFullYear(), month: d.getMonth() });
  }
  return out;
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isoFor(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

// Mon-Sun grid with leading/trailing null padding so the cells
// always line up to 7 cols. Identical to /events helper.
function buildMonthGrid(year: number, month: number): (number | null)[] {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = Mon
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function todayParts() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

function formatTime(hhmmss: string | null): string {
  if (!hhmmss) return "TBC";
  return hhmmss.slice(0, 5);
}

// "England vs Croatia" → { home: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 England", away: "Croatia 🇭🇷" }.
// Returns null when the event name isn't a vs-style fixture (e.g.
// "World Cup · Group Stage · Friday 12 June").
//
// Auto-attaches flags via lib/teamFlags so the admin can type
// "England vs Italy" and customers still see "🏴󠁧󠁢󠁥󠁮󠁧󠁿 England vs Italy 🇮🇹".
// If a flag is already present in the source string we leave it
// alone — no double-prefixing.
function splitMatchTitle(name: string): { home: string; away: string } | null {
  const sep = name.match(/\s+(?:vs?|v\.?|-|–)\s+/i);
  if (!sep) return null;
  const idx = name.indexOf(sep[0]);
  let home = name.slice(0, idx).trim();
  let away = name.slice(idx + sep[0].length).trim();
  if (!home || !away) return null;
  // Auto-attach flags. Home flag prepends, away flag appends — both
  // visually pointing inward toward the "vs".
  if (!hasFlagAlready(home)) {
    const f = flagForTeam(home);
    if (f) home = `${f} ${home}`;
  }
  if (!hasFlagAlready(away)) {
    const f = flagForTeam(away);
    if (f) away = `${away} ${f}`;
  }
  return { home, away };
}

function formatPounds(p: number): string {
  if (p === 0) return "Free";
  if (p % 100 === 0) return `£${p / 100}`;
  return `£${(p / 100).toFixed(2)}`;
}

// Strip the "World Cup · " prefix for cleaner cell display — the
// page context already makes it obvious these are World Cup.
function trimWorldCupPrefix(name: string): string {
  return name.replace(/^World Cup\s*[·:\-–]\s*/i, "").trim();
}

export default function MatchCalendar({
  matches,
  loading,
  expandedId,
  setExpandedId,
}: {
  matches: MatchWithTicket[];
  loading: boolean;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
}) {
  const months = useMemo(() => buildMonthRangeFromMatches(matches), [matches]);
  const today = useMemo(todayParts, []);

  // First UPCOMING match's month. `matches` is already filtered to
  // event_date >= today server-side (loadUpcomingEventsByCategory),
  // so matches[0] IS the next upcoming match. Landing the customer
  // here means they never see a calendar full of past or empty days.
  const firstMonthWithMatches = useMemo(() => {
    if (matches.length === 0) return null;
    const firstDate = new Date(`${matches[0].event.event_date}T00:00:00`);
    return { year: firstDate.getFullYear(), month: firstDate.getMonth() };
  }, [matches]);

  // Start the calendar on the next-upcoming month, not today's month.
  // If matches haven't loaded yet, today is a safe placeholder; the
  // useEffect below repoints to the first match's month once we have it.
  const [active, setActive] = useState<{ year: number; month: number }>({
    year: today.year,
    month: today.month,
  });

  // Once matches load, jump to the first month with matches if the
  // current month is empty (or doesn't appear in `months` at all —
  // happens whenever today's month has no fixtures, e.g. mid-August
  // after the Final). Runs once per match-list change.
  useMemo(() => {
    if (!firstMonthWithMatches) return;
    const currentMonthHasMatches = matches.some((m) => {
      const d = new Date(`${m.event.event_date}T00:00:00`);
      return d.getFullYear() === active.year && d.getMonth() === active.month;
    });
    if (!currentMonthHasMatches) setActive(firstMonthWithMatches);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstMonthWithMatches]);

  const grid = useMemo(
    () => buildMonthGrid(active.year, active.month),
    [active.year, active.month],
  );

  // Index matches by day-of-month for the currently-active month.
  // Multiple matches per day stack vertically in the cell.
  const byDay = useMemo(() => {
    const map: Record<number, MatchWithTicket[]> = {};
    for (const m of matches) {
      const d = new Date(`${m.event.event_date}T00:00:00`);
      if (d.getFullYear() !== active.year || d.getMonth() !== active.month) continue;
      const day = d.getDate();
      (map[day] ??= []).push(m);
    }
    // Sort each day's matches by kickoff time so afternoon shows
    // above evening in the cell.
    for (const k of Object.keys(map)) {
      const dayK = Number(k);
      map[dayK].sort((a, b) =>
        (a.event.start_time ?? "").localeCompare(b.event.start_time ?? ""),
      );
    }
    return map;
  }, [matches, active.year, active.month]);

  return (
    <div className="mt-10">
      {/* MONTH SCROLLER */}
      <div className="mx-auto max-w-6xl overflow-x-auto no-scrollbar">
        <div className="flex gap-2 pb-1">
          {months.map((m) => {
            const isActive = m.year === active.year && m.month === active.month;
            return (
              <button
                key={`${m.year}-${m.month}`}
                type="button"
                onClick={() => setActive(m)}
                className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition ${
                  isActive
                    ? "border-plonkPink bg-plonkPink text-white"
                    : "border-cream/15 text-cream/75 hover:border-cream/40 hover:text-cream"
                }`}
              >
                {monthLabel(m.year, m.month)}
              </button>
            );
          })}
        </div>
      </div>

      {/* CALENDAR GRID */}
      <div className="mt-6">
        {/* Sticky weekday header — desktop only. Mobile uses the
            single-column layout where each cell carries its own
            weekday label. */}
        <div className="sticky top-0 z-20 hidden -mx-1 bg-ink/95 px-1 py-3 backdrop-blur sm:block">
          <div className="grid grid-cols-7 gap-2">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="text-center text-xs font-bold uppercase tracking-[0.22em] text-cream/55"
              >
                {w}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-7 sm:gap-2">
          {grid.map((day, i) => {
            if (day === null) {
              // Padding cell — desktop grid alignment only.
              return (
                <div
                  key={`pad-${i}`}
                  className="hidden min-h-[140px] sm:block"
                />
              );
            }
            const isToday =
              day === today.day &&
              active.year === today.year &&
              active.month === today.month;
            const dayMatches = byDay[day] ?? [];
            const dayIso = isoFor(active.year, active.month, day);

            return (
              <article
                key={`d-${day}`}
                className={`relative flex min-h-[140px] flex-col overflow-hidden rounded-md border bg-ink/40 sm:rounded-xl ${
                  isToday ? "border-plonkPink" : "border-cream/10"
                }`}
              >
                {/* Day number badge */}
                <div
                  className={`absolute left-1 top-1 z-10 rounded-full px-1.5 py-0.5 text-[10px] font-bold sm:left-2 sm:top-2 sm:text-xs ${
                    isToday ? "bg-plonkPink text-white" : "bg-ink/80 text-cream/85"
                  }`}
                >
                  {day}
                </div>

                {/* Weekday label INSIDE the cell — mobile only. */}
                <div className="border-b border-cream/5 bg-ink/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-cream/60 sm:hidden">
                  {
                    WEEKDAYS[
                      new Date(dayIso + "T00:00:00").getDay() === 0
                        ? 6
                        : new Date(dayIso + "T00:00:00").getDay() - 1
                    ]
                  }
                </div>

                {/* Match blocks for this day */}
                <div className="flex flex-1 flex-col gap-1.5 p-1.5 pt-7 sm:p-2 sm:pt-8">
                  {dayMatches.length === 0 ? (
                    // Empty day — keep some height so the grid keeps
                    // its rhythm. No "Reserve" affordance since there's
                    // nothing on.
                    <div className="flex-1" />
                  ) : (
                    dayMatches.map((m) => (
                      <CalendarMatchCard
                        key={m.event.id}
                        match={m}
                        isExpanded={expandedId === m.event.id}
                        onSelectPaid={() =>
                          setExpandedId(
                            expandedId === m.event.id ? null : m.event.id,
                          )
                        }
                      />
                    ))
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {loading && (
          <p className="mt-6 text-center text-xs text-cream/45">Loading…</p>
        )}
        {!loading && matches.length === 0 && (
          <p className="mt-12 text-center text-sm text-cream/55">
            No matches scheduled yet.
          </p>
        )}
      </div>
    </div>
  );
}

// =============================================================
// Single match cell — sits inside a day cell on the grid.
// =============================================================
// Layout is compact (we're in a 7-col grid) — kickoff time, team
// names (or trimmed match label), price badge, and a "Book →" CTA.
// Free matches link straight to /book/table?date=…. Paid matches
// toggle the parent inline ticket form via onSelectPaid.
function CalendarMatchCard({
  match,
  isExpanded,
  onSelectPaid,
}: {
  match: MatchWithTicket;
  isExpanded: boolean;
  onSelectPaid: () => void;
}) {
  const m = match.event;
  const isPaid = !!match.paidTicket;
  const teams = splitMatchTitle(m.name);
  const kickoff = formatTime(m.start_time);
  const isFull =
    m.max_attendees !== null && m.paid_entries_count >= m.max_attendees;

  const inner = (
    <div className="flex h-full flex-col text-left">
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-plonkPink">
        {kickoff}
      </p>
      {teams ? (
        <div className="mt-1 leading-tight">
          <div className="text-[10px] font-bold uppercase tracking-wider text-cream">
            {teams.home}
          </div>
          <div className="text-[8px] uppercase tracking-widest text-cream/45">
            vs
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-cream">
            {teams.away}
          </div>
        </div>
      ) : (
        <p className="mt-1 line-clamp-3 text-[10px] font-bold uppercase leading-tight tracking-wider text-cream">
          {trimWorldCupPrefix(m.name)}
        </p>
      )}
      {isPaid && match.paidTicket && (
        <span className="mt-1 inline-block w-fit rounded-full bg-plonkTeal/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-plonkTeal">
          {formatPounds(match.paidTicket.price_pence)}
        </span>
      )}
      <span
        className={`mt-auto pt-1.5 text-[9px] font-bold uppercase tracking-wider ${
          isFull
            ? "text-cream/45"
            : isExpanded
              ? "text-cream"
              : "text-plonkPink"
        }`}
      >
        {isFull ? "Sold out" : isExpanded ? "Selected" : "Book →"}
      </span>
    </div>
  );

  const baseCls =
    "block rounded-md border bg-ink/40 p-2 transition flex-1 min-h-[110px]";

  if (isPaid) {
    return (
      <button
        type="button"
        disabled={isFull}
        onClick={onSelectPaid}
        className={`${baseCls} ${
          isFull
            ? "cursor-not-allowed border-cream/10 opacity-60"
            : isExpanded
              ? "border-plonkPink bg-plonkPink/10"
              : "border-cream/10 hover:border-plonkPink/60 hover:bg-plonkPink/10"
        }`}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      href={`/book/table?date=${m.event_date}`}
      className={`${baseCls} ${
        isFull
          ? "cursor-not-allowed border-cream/10 opacity-60"
          : "border-cream/10 hover:border-plonkPink/60 hover:bg-plonkPink/10"
      }`}
      onClick={(e) => {
        if (isFull) e.preventDefault();
      }}
    >
      {inner}
    </Link>
  );
}
