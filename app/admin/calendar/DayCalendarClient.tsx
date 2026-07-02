"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import { supabase } from "@/lib/supabase";
import { loadBookings, type DbBookingRow } from "@/lib/db/bookings";

// Founder-set hard capacities. Heatmap colour = max(bar%, golf%) so
// whichever side is filling up first drives the cell's warmth.
const BAR_CAPACITY = 70;
const GOLF_CAPACITY = 54;

// ─── Types ─────────────────────────────────────────────────────
type Source = "pool" | "table" | "worldcup" | "golf" | "event";

type CalendarBooking = {
  id: string;
  source: Source;
  time: string | null;       // "HH:MM"
  duration_minutes: number | null;
  party_size: number;
  name: string;
  match_or_event: string | null; // World Cup fixture name / event title
  status: string;
};

type DayBucket = {
  bar_people: number;   // pool + table + world-cup match holds
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
  if (s === "worldcup") return "World Cup";
  if (s === "golf") return "Golf";
  return "Event";
}
function sourcePill(s: Source): string {
  const base =
    "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest";
  if (s === "pool") return `${base} bg-plonkPink/15 text-plonkPink`;
  if (s === "table") return `${base} bg-plonkYellow/15 text-plonkYellow`;
  if (s === "worldcup") return `${base} bg-plonkTeal/15 text-plonkTeal`;
  if (s === "golf") return `${base} bg-orange-500/15 text-orange-300`;
  return `${base} bg-cream/10 text-cream/70`;
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const sb = supabase();
        const [barRes, eventRes, golfRes] = await Promise.all([
          sb
            .from("bar_reservations")
            .select(
              "id,kind,reservation_date,start_time,duration_minutes,party_size,name,status",
            )
            .neq("status", "cancelled"),
          sb
            .from("event_entries")
            .select(
              "id,attendee_name,status,event:events!inner(id,name,event_date,start_time,category)",
            )
            .neq("status", "cancelled")
            .neq("status", "pending_payment"),
          loadBookings().catch(() => [] as DbBookingRow[]),
        ]);
        if (cancelled) return;
        if (barRes.error) throw barRes.error;
        if (eventRes.error) throw eventRes.error;
        const map: Record<string, DayBucket> = {};
        function ensure(date: string): DayBucket {
          if (!map[date])
            map[date] = { bar_people: 0, golf_people: 0, bookings: [] };
          return map[date];
        }
        // Bar reservations
        for (const r of barRes.data as Array<{
          id: string;
          kind: "pool" | "table";
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
        // Event entries (World Cup + other event types)
        for (const e of eventRes.data as unknown as Array<{
          id: string;
          attendee_name: string;
          status: string;
          event: {
            id: string;
            name: string;
            event_date: string;
            start_time: string | null;
            category: string;
          };
        }>) {
          const b = ensure(e.event.event_date);
          const size = 2; // founder rule: match table = 2 people
          b.bar_people += size;
          b.bookings.push({
            id: e.id,
            source: e.event.category === "world_cup" ? "worldcup" : "event",
            time: e.event.start_time ? e.event.start_time.slice(0, 5) : null,
            duration_minutes: 150,
            party_size: size,
            name: e.attendee_name,
            match_or_event: e.event.name,
            status: e.status,
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
  }, []);

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
        <div className="rounded-lg border border-plonkPink/40 bg-plonkPink/10 px-4 py-3 text-sm text-plonkPink">
          {err}
        </div>
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
                worldcup: bucket.bookings.filter((b) => b.source === "worldcup")
                  .length,
                golf: bucket.bookings.filter((b) => b.source === "golf").length,
                event: bucket.bookings.filter((b) => b.source === "event")
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
                  {counts!.worldcup > 0 && (
                    <div>⚽ {counts!.worldcup} World Cup</div>
                  )}
                  {counts!.golf > 0 && <div>⛳ {counts!.golf} golf</div>}
                  {counts!.event > 0 && <div>🎉 {counts!.event} event</div>}
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
                  <span className="text-cream">{b.name}</span>
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
      )}
    </div>
  );
}
