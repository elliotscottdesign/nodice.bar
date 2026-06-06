"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadCalendarEventsInRange,
  type DbCalendarEvent,
} from "@/lib/db/calendarEvents";
import { useContent, useImage } from "@/lib/content";
import { Editable } from "@/components/Editable";
import PageHero from "@/components/PageHero";

// /events — monthly calendar grid. Mon-Sun, 7 cols. Days with events
// show the artwork (4:5) + title + optional body + optional link.
// Founder uploads artwork + copy via /admin/calendar-events.

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Build [-6, +12] months around today so the scroller has plenty
// of past + future to navigate.
function buildMonthRange(): { year: number; month: number }[] {
  const now = new Date();
  const out: { year: number; month: number }[] = [];
  for (let i = -6; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
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

// Render a Mon-Sun grid for the given month. Cells before the 1st
// (in the same row) and after the last day are padded with nulls so
// the layout always lines up to a 7-col grid.
function buildMonthGrid(
  year: number,
  month: number,
): (number | null)[] {
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

export default function EventsPage() {
  const eyebrow = useContent("events.eyebrow", "What's on");
  const title = useContent("events.title", "Events");
  const intro = useContent(
    "events.intro",
    "Every poster on our calendar — gigs, tournaments, residencies, pop-ups, parties.",
  );
  const heroImage = useImage("events.hero_image", "/hackney/games/Games_4.jpg");

  const months = useMemo(buildMonthRange, []);
  const today = useMemo(todayParts, []);

  const [active, setActive] = useState<{ year: number; month: number }>({
    year: today.year,
    month: today.month,
  });
  const [events, setEvents] = useState<DbCalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // Load events for whichever month is currently active.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const from = isoFor(active.year, active.month, 1);
    const lastDay = new Date(active.year, active.month + 1, 0).getDate();
    const to = isoFor(active.year, active.month, lastDay);
    loadCalendarEventsInRange(from, to)
      .then((data) => {
        if (!cancelled) setEvents(data);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active.year, active.month]);

  const grid = useMemo(
    () => buildMonthGrid(active.year, active.month),
    [active.year, active.month],
  );

  // Index events by day-of-month for fast cell lookup. Multiple
  // events per day get stacked in the cell in date-add order.
  const byDay = useMemo(() => {
    const m: Record<number, DbCalendarEvent[]> = {};
    for (const e of events) {
      const d = parseInt(e.event_date.slice(-2), 10);
      (m[d] ??= []).push(e);
    }
    return m;
  }, [events]);

  return (
    <main>
      <PageHero
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        image={heroImage}
        eyebrowKey="events.eyebrow"
        titleKey="events.title"
        introKey="events.intro"
        sliderKey="hero.events"
      />

      {/* MONTH SCROLLER — horizontal scroll strip of month buttons.
          Active month highlighted; tap any other to switch. */}
      <section className="px-6 py-6">
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
      </section>

      {/* CALENDAR GRID — 7 cols always, day-of-week header row, then
          cells. Empty cells are muted. Cells with events show the
          artwork (4:5) + title + body + link. */}
      <section className="px-3 pb-24 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="px-1 pb-2 text-center text-[10px] font-bold uppercase tracking-[0.22em] text-cream/55 sm:text-xs"
              >
                {w}
              </div>
            ))}

            {grid.map((day, i) => {
              if (day === null) {
                // Padding cell.
                return <div key={`pad-${i}`} className="min-h-[60px] sm:min-h-[110px]" />;
              }
              const isToday =
                day === today.day &&
                active.year === today.year &&
                active.month === today.month;
              const dayEvents = byDay[day] ?? [];
              return (
                <article
                  key={`d-${day}`}
                  className={`relative flex flex-col overflow-hidden rounded-md border bg-ink/40 sm:rounded-xl ${
                    isToday ? "border-plonkPink" : "border-cream/10"
                  }`}
                >
                  {/* Day number badge — top-left corner, always visible. */}
                  <div
                    className={`absolute left-1 top-1 z-10 rounded-full px-1.5 py-0.5 text-[10px] font-bold sm:left-2 sm:top-2 sm:text-xs ${
                      isToday ? "bg-plonkPink text-white" : "bg-ink/80 text-cream/85"
                    }`}
                  >
                    {day}
                  </div>

                  {/* Stack of events for this day. */}
                  <div className="flex flex-1 flex-col gap-1">
                    {dayEvents.length === 0 ? (
                      // Empty 4:5 placeholder so the grid keeps its rhythm
                      // even when nothing's scheduled.
                      <div className="aspect-[4/5] w-full" />
                    ) : (
                      dayEvents.map((ev) => <DayEventCard key={ev.id} ev={ev} />)
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {loading && (
            <p className="mt-6 text-center text-xs text-cream/45">Loading…</p>
          )}

          {events.length === 0 && !loading && (
            <p className="mt-12 text-center text-sm text-cream/55">
              <Editable k="events.empty_state">
                Nothing yet for {monthLabel(active.year, active.month)} — check back soon.
              </Editable>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

// Single event card inside a day cell. Image is 4:5 per brief.
// Title + optional body + optional link sit beneath the image.
function DayEventCard({ ev }: { ev: DbCalendarEvent }) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const src =
    ev.image_url && ev.image_url.startsWith("/")
      ? `${base}${ev.image_url}`
      : ev.image_url;

  const inner = (
    <div className="flex h-full flex-col">
      {/* 4:5 artwork */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-ink">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={ev.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-widest text-cream/40">
            no artwork
          </div>
        )}
      </div>
      {/* Title + body */}
      <div className="px-1.5 py-1.5 sm:px-2 sm:py-2">
        <p className="line-clamp-2 text-[10px] font-bold uppercase tracking-wider text-cream sm:text-[11px]">
          {ev.title}
        </p>
        {ev.body && (
          <p className="mt-1 line-clamp-2 text-[9px] leading-snug text-cream/65 sm:text-[10px]">
            {ev.body}
          </p>
        )}
      </div>
    </div>
  );

  return ev.link_url ? (
    <a
      href={ev.link_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block flex-1 overflow-hidden"
    >
      {inner}
    </a>
  ) : (
    <div className="flex-1">{inner}</div>
  );
}
