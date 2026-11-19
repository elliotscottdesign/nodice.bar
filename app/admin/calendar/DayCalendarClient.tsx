"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import Notice from "@/components/Notice";
import { supabase } from "@/lib/supabase";
import { loadBookings, type DbBookingRow } from "@/lib/db/bookings";
import AddReservationForm from "@/components/admin/AddReservationForm";
import AddTournamentEntryForm from "@/components/admin/AddTournamentEntryForm";
import AddGolfBookingForm from "@/components/admin/AddGolfBookingForm";
import BookingLockedTag from "@/components/admin/BookingLockedTag";
import { loadAllTournaments, type DbTournament } from "@/lib/db/tournaments";
import {
  loadCalendarEventsInRange,
  type DbCalendarEvent,
} from "@/lib/db/calendarEvents";
import { loadDjNightsInRange, isDjEvent } from "@/lib/db/djNights";
import { loadOpenDecksNightsInRange } from "@/lib/db/openDecksNights";

// Founder-set hard capacities. Heatmap colour = max(bar%, golf%) so
// whichever side is filling up first drives the cell's warmth.
const BAR_CAPACITY = 70;
const GOLF_CAPACITY = 54;

// ─── "What's on" event chips ───────────────────────────────────
// So the team can see everything programmed on a day/month — DJ nights,
// specials, food, pool, drinks deals — not just the bar/golf bookings
// (founder 4 Nov 2026). Same five groups + mapping as the PUBLIC /events
// calendar (kept in step by hand — the public page inlines the identical
// map). A tag is a group over categories: everything pool-shaped is POOL,
// bingo sits under SPECIALS, drink deals are DEAL, DJ-feed nights are DJ.
const CATEGORY_TO_CHIP: Record<string, string> = {
  dj_night: "DJ",
  pool_tournament_doubles: "POOL",
  pool_tournament_singles: "POOL",
  pool_special: "POOL",
  ping_pong: "POOL",
  food_event: "FOOD",
  drink_special: "DEAL",
  special_event: "SPECIALS",
  bingo: "SPECIALS",
  // arcade / golf / other → no chip (shown only when no filter is narrowing)
};
const EVENT_CHIPS = ["POOL", "FOOD", "SPECIALS", "DJ", "DEAL"] as const;
type EventChip = (typeof EVENT_CHIPS)[number];
function chipForEvent(ev: DbCalendarEvent): string | null {
  if (isDjEvent(ev)) return "DJ";
  return CATEGORY_TO_CHIP[ev.category ?? ""] ?? null;
}
const CHIP_STYLE: Record<
  EventChip,
  { pill: string; dot: string; emoji: string }
> = {
  POOL: { pill: "bg-purple-500/15 text-purple-300", dot: "bg-purple-400", emoji: "🎱" },
  FOOD: { pill: "bg-orange-500/15 text-orange-300", dot: "bg-orange-400", emoji: "🍔" },
  SPECIALS: { pill: "bg-plonkPink/15 text-plonkPink", dot: "bg-plonkPink", emoji: "✨" },
  DJ: { pill: "bg-sky-500/15 text-sky-300", dot: "bg-sky-400", emoji: "🎧" },
  DEAL: { pill: "bg-plonkYellow/15 text-plonkYellow", dot: "bg-plonkYellow", emoji: "💸" },
};

// ─── Types ─────────────────────────────────────────────────────
type Source = "pool" | "table" | "golf" | "private_hire";

type CalendarBooking = {
  id: string;
  source: Source;
  time: string | null;       // "HH:MM"
  duration_minutes: number | null;
  party_size: number;
  name: string;
  match_or_event: string | null; // optional label shown next to a booking
  status: string;
};

type DayBucket = {
  bar_people: number;   // pool + table holds
  golf_people: number;
  bookings: CalendarBooking[];
};

// ─── Date helpers ──────────────────────────────────────────────
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}
function todayParts() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}
// Mon-Sun grid with leading/trailing nulls so every row is 7 cells.
function buildMonthGrid(year: number, month: number): (number | null)[] {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = Mon
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// Heatmap colour classes for a given utilisation (0 to >1). Uses
// Tailwind arbitrary values so the whole card carries a consistent
// dark-tinted background from cool blue → warm red.
function heatClass(util: number): string {
  if (util >= 1) return "bg-red-500/25 border-red-400/40";
  if (util >= 0.75) return "bg-orange-500/20 border-orange-400/40";
  if (util >= 0.5) return "bg-plonkYellow/20 border-plonkYellow/40";
  if (util >= 0.25) return "bg-plonkTeal/15 border-plonkTeal/30";
  if (util > 0) return "bg-cream/5 border-cream/15";
  return "bg-ink/40 border-cream/10";
}
function sourceLabel(s: Source): string {
  if (s === "pool") return "Pool";
  if (s === "table") return "Table";
  if (s === "private_hire") return "Private";
  return "Golf";
}
function sourcePill(s: Source): string {
  const base =
    "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest";
  if (s === "pool") return `${base} bg-purple-500/15 text-purple-300`;
  if (s === "table") return `${base} bg-plonkYellow/15 text-plonkYellow`;
  if (s === "private_hire") return `${base} bg-plonkTeal/15 text-plonkTeal`;
  return `${base} bg-orange-500/15 text-orange-300`;
}

// ─── Component ─────────────────────────────────────────────────
export default function DayCalendarClient() {
  const today = useMemo(todayParts, []);
  const [active, setActive] = useState<{ year: number; month: number }>({
    year: today.year,
    month: today.month,
  });
  const [selected, setSelected] = useState<string | null>(ymd(new Date()));
  const [buckets, setBuckets] = useState<Record<string, DayBucket>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  // Bumped after an inline add so the grid + day panel refresh.
  const [refreshKey, setRefreshKey] = useState(0);
  // Which add form is open in the selected-day panel (null = none).
  const [addMode, setAddMode] = useState<
    "table" | "pool" | "golf" | "tournament" | null
  >(null);
  // Tournaments for the inline tournament-entry form.
  const [tournaments, setTournaments] = useState<DbTournament[]>([]);
  // "What's on" events (DJ / specials / food / pool / deals) for the
  // visible month + which group chips are switched on (all on by default).
  const [events, setEvents] = useState<DbCalendarEvent[]>([]);
  const [selectedChips, setSelectedChips] = useState<Set<string>>(
    () => new Set(EVENT_CHIPS),
  );
  const allChipsOn = selectedChips.size === EVENT_CHIPS.length;
  function toggleChip(chip: string) {
    setSelectedChips((prev) => {
      const next = new Set(prev);
      if (next.has(chip)) next.delete(chip);
      else next.add(chip);
      return next;
    });
  }
  useEffect(() => {
    loadAllTournaments()
      .then(setTournaments)
      .catch(() => setTournaments([]));
  }, [refreshKey]);
  function afterAdd() {
    setAddMode(null);
    setRefreshKey((k) => k + 1);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const sb = supabase();
        const [barRes, golfRes] = await Promise.all([
          sb
            .from("bar_reservations")
            .select(
              "id,kind,reservation_date,start_time,duration_minutes,party_size,name,status",
            )
            .neq("status", "cancelled"),
          loadBookings().catch(() => [] as DbBookingRow[]),
        ]);
        if (cancelled) return;
        if (barRes.error) throw barRes.error;
        const map: Record<string, DayBucket> = {};
        function ensure(date: string): DayBucket {
          if (!map[date])
            map[date] = { bar_people: 0, golf_people: 0, bookings: [] };
          return map[date];
        }
        // Bar reservations
        for (const r of barRes.data as Array<{
          id: string;
          kind: "pool" | "table" | "golf" | "private_hire";
          reservation_date: string;
          start_time: string;
          duration_minutes: number;
          party_size: number;
          name: string;
          status: string;
        }>) {
          const b = ensure(r.reservation_date);
          b.bar_people += r.party_size;
          b.bookings.push({
            id: r.id,
            source: r.kind,
            time: r.start_time.slice(0, 5),
            duration_minutes: r.duration_minutes,
            party_size: r.party_size,
            name: r.name,
            match_or_event: null,
            status: r.status,
          });
        }
        // Golf bookings — legacy Plonk Golf table.
        for (const g of golfRes as DbBookingRow[]) {
          if (g.status === "cancelled" || g.status === "refunded") continue;
          const slot = g.slots?.[0];
          if (!slot) continue;
          const b = ensure(slot.slot_date);
          b.golf_people += g.party_size;
          b.bookings.push({
            id: g.id,
            source: "golf",
            time: slot.slot_time.slice(0, 5),
            duration_minutes: null,
            party_size: g.party_size,
            name: g.customer_name,
            match_or_event: null,
            status: g.status,
          });
        }
        // Sort each day's bookings by start time.
        for (const key of Object.keys(map)) {
          map[key].bookings.sort((a, b) =>
            (a.time ?? "").localeCompare(b.time ?? ""),
          );
        }
        setBuckets(map);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to load calendar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Load the month's "what's on" events — same three sources the public
  // /events calendar uses (manually-added events incl. deals + specials +
  // food + pool, confirmed DJ nights, open-decks nights). allSettled so one
  // feed failing never blanks the others.
  useEffect(() => {
    let cancelled = false;
    const from = ymd(new Date(active.year, active.month, 1));
    const lastDay = new Date(active.year, active.month + 1, 0).getDate();
    const to = ymd(new Date(active.year, active.month, lastDay));
    Promise.allSettled([
      loadCalendarEventsInRange(from, to),
      loadDjNightsInRange(from, to),
      loadOpenDecksNightsInRange(from, to),
    ]).then((res) => {
      if (cancelled) return;
      const vals = res.flatMap((r) =>
        r.status === "fulfilled" ? r.value : [],
      ) as DbCalendarEvent[];
      setEvents(vals);
    });
    return () => {
      cancelled = true;
    };
  }, [active.year, active.month, refreshKey]);

  // Events for the visible month, filtered by the chip toggles and indexed
  // by date. When every chip is on we show all events (including any with no
  // chip, e.g. arcade/golf); narrowing shows only matching groups — exactly
  // like the public calendar.
  const eventsByDate = useMemo(() => {
    const map: Record<string, (DbCalendarEvent & { chip: string | null })[]> = {};
    for (const ev of events) {
      if (ev.active === false) continue;
      const chip = chipForEvent(ev);
      if (!allChipsOn && !(chip && selectedChips.has(chip))) continue;
      (map[ev.event_date] ??= []).push({ ...ev, chip });
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
    }
    return map;
  }, [events, selectedChips, allChipsOn]);

  const grid = useMemo(
    () => buildMonthGrid(active.year, active.month),
    [active.year, active.month],
  );
  const selectedBucket = selected ? buckets[selected] : null;

  function shiftMonth(delta: number) {
    const d = new Date(active.year, active.month + delta, 1);
    setActive({ year: d.getFullYear(), month: d.getMonth() });
  }

  return (
    <div className="space-y-6">
      {err && (
        <Notice variant="error">{err}</Notice>
      )}

      {/* Legend + month navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="rounded-full border border-cream/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cream/75 hover:bg-cream/5"
          >
            ← Prev
          </button>
          <h2 className="font-display text-2xl text-cream">
            {monthLabel(active.year, active.month)}
          </h2>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="rounded-full border border-cream/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cream/75 hover:bg-cream/5"
          >
            Next →
          </button>
          <button
            type="button"
            onClick={() => {
              setActive({ year: today.year, month: today.month });
              setSelected(ymd(new Date()));
            }}
            className="rounded-full bg-plonkPink px-3 py-1 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90"
          >
            Today
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest text-cream/55">
          <span>Heatmap:</span>
          <span className={`${heatClass(0.1)} rounded-full border px-2 py-0.5`}>
            Quiet
          </span>
          <span className={`${heatClass(0.3)} rounded-full border px-2 py-0.5`}>
            25%+
          </span>
          <span className={`${heatClass(0.6)} rounded-full border px-2 py-0.5`}>
            50%+
          </span>
          <span className={`${heatClass(0.8)} rounded-full border px-2 py-0.5`}>
            75%+
          </span>
          <span className={`${heatClass(1)} rounded-full border px-2 py-0.5`}>
            Full
          </span>
        </div>
      </div>

      {/* "What's on" filters — same five groups as the public calendar, so
          the team can narrow the month to DJ nights / specials / food /
          pool / deals (founder 4 Nov 2026). All on by default. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-cream/45">
          What&apos;s on
        </span>
        <button
          type="button"
          onClick={() => setSelectedChips(new Set(EVENT_CHIPS))}
          className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition ${
            allChipsOn
              ? "border-cream/40 bg-cream/10 text-cream"
              : "border-cream/15 text-cream/60 hover:border-cream/40"
          }`}
        >
          All
        </button>
        {EVENT_CHIPS.map((chip) => {
          const on = selectedChips.has(chip);
          const s = CHIP_STYLE[chip];
          return (
            <button
              key={chip}
              type="button"
              onClick={() => toggleChip(chip)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition ${
                on
                  ? `border-transparent ${s.pill}`
                  : "border-cream/15 text-cream/40 hover:border-cream/40"
              }`}
            >
              <span aria-hidden>{s.emoji}</span>
              {chip}
            </button>
          );
        })}
      </div>

      {/* Weekday header (desktop only). */}
      <div className="hidden grid-cols-7 gap-2 sm:grid">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-center text-[10px] font-bold uppercase tracking-widest text-cream/55"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
        {grid.map((day, i) => {
          if (day === null)
            return (
              <div
                key={`pad-${i}`}
                className="hidden min-h-[100px] sm:block"
              />
            );
          const dateIso = ymd(new Date(active.year, active.month, day));
          const bucket = buckets[dateIso];
          const dayEvents = eventsByDate[dateIso] ?? [];
          const barUtil = bucket ? bucket.bar_people / BAR_CAPACITY : 0;
          const golfUtil = bucket ? bucket.golf_people / GOLF_CAPACITY : 0;
          const util = Math.max(barUtil, golfUtil);
          const isToday =
            day === today.day &&
            active.year === today.year &&
            active.month === today.month;
          const isSelected = selected === dateIso;

          const counts = bucket
            ? {
                pool: bucket.bookings.filter((b) => b.source === "pool").length,
                table: bucket.bookings.filter((b) => b.source === "table")
                  .length,
                golf: bucket.bookings.filter((b) => b.source === "golf").length,
                pending: bucket.bookings.filter((b) => b.status === "pending")
                  .length,
              }
            : null;

          return (
            <button
              key={dateIso}
              type="button"
              onClick={() => setSelected(dateIso)}
              className={`relative flex min-h-[100px] flex-col rounded-md border p-2 text-left transition ${heatClass(
                util,
              )} ${isSelected ? "ring-2 ring-plonkPink" : ""} ${
                isToday ? "outline outline-1 outline-cream/40" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <span
                  className={`text-sm font-bold ${
                    isToday ? "text-cream" : "text-cream/85"
                  }`}
                >
                  {day}
                </span>
                {bucket && util > 0 && (
                  <span className="text-[9px] font-bold text-cream/70">
                    {Math.round(util * 100)}%
                  </span>
                )}
              </div>
              {bucket && (
                <div className="mt-1 space-y-0.5 text-[10px] leading-tight text-cream/70">
                  {counts!.table > 0 && <div>🍽 {counts!.table} table</div>}
                  {counts!.pool > 0 && <div>🎱 {counts!.pool} pool</div>}
                  {counts!.golf > 0 && <div>⛳ {counts!.golf} golf</div>}
                  {counts!.pending > 0 && (
                    <div className="font-bold text-amber-300">
                      ⏳ {counts!.pending} pending
                    </div>
                  )}
                </div>
              )}
              {dayEvents.length > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {dayEvents.slice(0, 5).map((ev, i) => (
                    <span
                      key={`${ev.id}-${i}`}
                      title={`${ev.chip ?? "Event"}: ${ev.title}`}
                      className={`inline-block h-2 w-2 rounded-full ${
                        ev.chip
                          ? CHIP_STYLE[ev.chip as EventChip].dot
                          : "bg-cream/40"
                      }`}
                    />
                  ))}
                  {dayEvents.length > 5 && (
                    <span className="text-[9px] font-bold text-cream/60">
                      +{dayEvents.length - 5}
                    </span>
                  )}
                </div>
              )}
              {bucket && (bucket.bar_people > 0 || bucket.golf_people > 0) && (
                <div className="mt-auto pt-1 text-[9px] uppercase tracking-widest text-cream/50">
                  {bucket.bar_people > 0 && (
                    <div>
                      Bar {bucket.bar_people}/{BAR_CAPACITY}
                    </div>
                  )}
                  {bucket.golf_people > 0 && (
                    <div>
                      Golf {bucket.golf_people}/{GOLF_CAPACITY}
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {loading && (
        <p className="text-center text-sm text-cream/55">Loading bookings…</p>
      )}

      {/* Selected day detail */}
      {selected && (
        <div className="space-y-4">
          {/* Add a booking straight from the calendar for the selected
              day (founder 28 Sep 2026). Table / pool / golf prefill this
              date; tournament entries pick their event in the form. */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[11px] font-bold uppercase tracking-widest text-cream/45">
              Add for this day
            </span>
            {([
              { id: "table", label: "+ Table" },
              { id: "pool", label: "+ Pool" },
              { id: "golf", label: "+ Golf" },
              { id: "tournament", label: "+ Tournament" },
            ] as const).map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setAddMode(addMode === b.id ? null : b.id)}
                className={`rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                  addMode === b.id
                    ? "border-plonkPink bg-plonkPink text-white"
                    : "border-cream/15 text-cream/75 hover:border-cream/40"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          {addMode === "table" && (
            <AddReservationForm
              key={`table-${selected}`}
              kind="table"
              initialDate={selected}
              startOpen
              onCreated={afterAdd}
            />
          )}
          {addMode === "pool" && (
            <AddReservationForm
              key={`pool-${selected}`}
              kind="pool"
              initialDate={selected}
              startOpen
              onCreated={afterAdd}
            />
          )}
          {addMode === "golf" && (
            <AddGolfBookingForm
              key={`golf-${selected}`}
              initialDate={selected}
              startOpen
              onCreated={afterAdd}
            />
          )}
          {addMode === "tournament" && (
            <AddTournamentEntryForm
              tournaments={tournaments}
              startOpen
              onCreated={afterAdd}
            />
          )}

        {(eventsByDate[selected] ?? []).length > 0 && (
          <AdminCard title="What's on this day">
            <ul className="divide-y divide-cream/10">
              {(eventsByDate[selected] ?? []).map((ev) => {
                const s = ev.chip ? CHIP_STYLE[ev.chip as EventChip] : null;
                const row = (
                  <>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                        s ? s.pill : "bg-cream/10 text-cream/60"
                      }`}
                    >
                      {s ? `${s.emoji} ${ev.chip}` : "Event"}
                    </span>
                    <span className="min-w-[3.5rem] text-cream/85">
                      {ev.start_time ? ev.start_time.slice(0, 5) : "All day"}
                    </span>
                    <span className="text-cream">{ev.title}</span>
                    {ev.link_url && (
                      <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-plonkPink">
                        Open ↗
                      </span>
                    )}
                  </>
                );
                return (
                  <li key={ev.id}>
                    {ev.link_url ? (
                      <a
                        href={ev.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm transition hover:bg-cream/5"
                      >
                        {row}
                      </a>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                        {row}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </AdminCard>
        )}

        <AdminCard
          title={new Date(selected + "T12:00:00").toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          action={
            selectedBucket && (
              <span className="text-xs text-cream/55">
                Bar {selectedBucket.bar_people}/{BAR_CAPACITY} · Golf{" "}
                {selectedBucket.golf_people}/{GOLF_CAPACITY}
              </span>
            )
          }
        >
          {!selectedBucket ? (
            <p className="px-5 py-6 text-sm text-cream/55">
              No bookings on this day yet.
            </p>
          ) : (
            <ul className="divide-y divide-cream/10">
              {selectedBucket.bookings.map((b) => (
                <li
                  key={`${b.source}-${b.id}`}
                  className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"
                >
                  <span className={sourcePill(b.source)}>
                    {sourceLabel(b.source)}
                  </span>
                  <span className="min-w-[3.5rem] text-cream/85">
                    {b.time ?? "TBC"}
                  </span>
                  {b.status === "confirmed" || b.status === "paid" ? (
                    <BookingLockedTag name={b.name} />
                  ) : (
                    <span className="text-cream">{b.name}</span>
                  )}
                  {b.status === "pending" && (
                    <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
                      pending
                    </span>
                  )}
                  {b.match_or_event && (
                    <span className="text-cream/70">· {b.match_or_event}</span>
                  )}
                  <span className="ml-auto text-cream/55">
                    {b.party_size} guest{b.party_size === 1 ? "" : "s"}
                    {b.duration_minutes ? ` · ${b.duration_minutes} min` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
        </div>
      )}
    </div>
  );
}
