"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadCalendarEventsInRange,
  type DbCalendarEvent,
} from "@/lib/db/calendarEvents";
import { loadDjNightsInRange, isDjEvent } from "@/lib/db/djNights";
import { useContent, useImage } from "@/lib/content";
import { Editable } from "@/components/Editable";
import PageHero from "@/components/PageHero";
import { useEditMode } from "@/lib/editMode";
import CalendarEventModal from "@/components/CalendarEventModal";
import InstagramFeed from "@/components/InstagramFeed";

// /events — monthly calendar grid. Mon-Sun, 7 cols. Days with events
// show the artwork (4:5) + title + optional body + optional link.
// Founder uploads artwork + copy via /admin/calendar-events.

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Show only the current month + next 3 — per founder direction,
// the scroller stays focused on "what's coming up" rather than
// inviting customers to browse historical events.
function buildMonthRange(): { year: number; month: number }[] {
  const now = new Date();
  const out: { year: number; month: number }[] = [];
  for (let i = 0; i <= 3; i++) {
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

// "19:30:00" -> "7:30pm". Handles both HH:MM and HH:MM:SS as Postgres
// `time` can come back either way depending on the driver.
function formatTime(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h)) return hhmm;
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m === 0 ? "" : `:${String(m).padStart(2, "0")}`}${ampm}`;
}

export default function EventsPage() {
  const eyebrow = useContent("events.eyebrow", "What's on");
  const title = useContent("events.title", "Events");
  const intro = useContent(
    "events.intro",
    "Every poster on our calendar — gigs, tournaments, residencies, pop-ups, parties.",
  );
  const heroImage = useImage("events.hero_image", "");

  const months = useMemo(buildMonthRange, []);
  const today = useMemo(todayParts, []);

  const [active, setActive] = useState<{ year: number; month: number }>({
    year: today.year,
    month: today.month,
  });
  const [events, setEvents] = useState<DbCalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // Inline-edit state — only relevant when the founder has flipped
  // the admin Edit-mode toggle on the floating AdminBar.
  const editing = useEditMode();
  const [modalEvent, setModalEvent] = useState<DbCalendarEvent | null>(null);
  const [modalDate, setModalDate] = useState<string | null>(null);
  const modalOpen = modalEvent !== null || modalDate !== null;

  // Day-view popup state — opened when the customer clicks a day cell
  // that has multiple events. The popup shows every event for that
  // date at full size so the calendar cell itself stays compact.
  const [openDayIso, setOpenDayIso] = useState<string | null>(null);

  function openAdd(dateIso: string) {
    setModalEvent(null);
    setModalDate(dateIso);
  }
  function openEdit(ev: DbCalendarEvent) {
    setModalDate(null);
    setModalEvent(ev);
  }
  function closeModal() {
    setModalEvent(null);
    setModalDate(null);
  }

  // Load events for whichever month is currently active. Extracted
  // into a callback so the post-save handler can re-fetch without
  // duplicating logic.
  const reload = useCallback(async () => {
    setLoading(true);
    const from = isoFor(active.year, active.month, 1);
    const lastDay = new Date(active.year, active.month + 1, 0).getDate();
    const to = isoFor(active.year, active.month, lastDay);
    // Manually-added events (this site's DB) + confirmed DJ nights (team hub
    // feed). allSettled so one source failing never blanks the other — a DB
    // hiccup still shows DJ nights, and a feed hiccup still shows your events.
    const [calRes, djRes] = await Promise.allSettled([
      loadCalendarEventsInRange(from, to),
      loadDjNightsInRange(from, to),
    ]);
    const cal = calRes.status === "fulfilled" ? calRes.value : [];
    const dj = djRes.status === "fulfilled" ? djRes.value : [];
    setEvents([...cal, ...dj]);
    setLoading(false);
  }, [active.year, active.month]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const from = isoFor(active.year, active.month, 1);
    const lastDay = new Date(active.year, active.month + 1, 0).getDate();
    const to = isoFor(active.year, active.month, lastDay);
    Promise.allSettled([
      loadCalendarEventsInRange(from, to),
      loadDjNightsInRange(from, to),
    ]).then((res) => {
      if (cancelled) return;
      const cal = res[0].status === "fulfilled" ? res[0].value : [];
      const dj = res[1].status === "fulfilled" ? res[1].value : [];
      setEvents([...cal, ...dj]);
      setLoading(false);
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

      {/* CALENDAR GRID — 1 col on mobile (each day full-width, scroll
          vertically), 7 cols Mon-Sun on tablet+. The weekday header row
          and padding cells are hidden on mobile because they only make
          sense in the 7-col grid layout. */}
      <section className="px-3 pb-24 sm:px-6">
        <div className="mx-auto max-w-7xl">
          {/* Sticky weekday header — sits above whichever week you're
              looking at as the month scrolls. Hidden on mobile where
              the grid is one column (the day-of-week label moves into
              each card instead — see below). */}
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
                // Padding cell — only renders on desktop where it
                // matters for grid alignment. Hidden on mobile single-
                // column where it would just create empty gaps.
                return <div key={`pad-${i}`} className="hidden min-h-[110px] sm:block" />;
              }
              const isToday =
                day === today.day &&
                active.year === today.year &&
                active.month === today.month;
              const dayEvents = byDay[day] ?? [];
              const dayIso = isoFor(active.year, active.month, day);

              return (
                <article
                  key={`d-${day}`}
                  className={`group relative flex flex-col overflow-hidden rounded-md border bg-ink/40 sm:rounded-xl ${
                    isToday ? "border-plonkPink" : "border-cream/10"
                  } ${editing ? "ring-1 ring-cream/10" : ""}`}
                >
                  {/* Day number badge — top-left corner, always visible. */}
                  <div
                    className={`absolute left-1 top-1 z-10 rounded-full px-1.5 py-0.5 text-[10px] font-bold sm:left-2 sm:top-2 sm:text-xs ${
                      isToday ? "bg-plonkPink text-white" : "bg-ink/80 text-cream/85"
                    }`}
                  >
                    {day}
                  </div>

                  {/* Weekday label INSIDE the cell — only shown on
                      mobile (single-column layout), where the sticky
                      header above is hidden. On desktop the column
                      header carries this, so we hide this label there. */}
                  <div className="border-b border-cream/5 bg-ink/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-cream/60 sm:hidden">
                    {WEEKDAYS[new Date(dayIso + "T00:00:00").getDay() === 0 ? 6 : new Date(dayIso + "T00:00:00").getDay() - 1]}
                  </div>

                  {/* In-cell "+ Add event" overlay button — visible only
                      in admin Edit mode, sits in the top-right corner so
                      it doesn't fight the day-number badge. */}
                  {editing && (
                    <button
                      type="button"
                      onClick={() => openAdd(dayIso)}
                      title="Add event to this day"
                      className="absolute right-1 top-1 z-20 rounded-full bg-plonkPink px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white opacity-90 transition hover:opacity-100 sm:right-2 sm:top-2"
                    >
                      + Add
                    </button>
                  )}

                  {/* Stack of events for this day.
                      RULES:
                      - 0 events  → empty 4:5 placeholder (keeps grid rhythm)
                      - 1 event   → full DayEventCard (existing layout)
                      - 2+ events → condensed MultiEventStack, capped at
                        roughly 1.5× the height of a single card, with
                        click-to-expand into a full-size popup. Prevents a
                        busy day (e.g. 27 Jun with 4 listings) blowing out
                        the whole grid row. */}
                  <div className="flex flex-1 flex-col gap-1">
                    {dayEvents.length === 0 ? (
                      editing ? (
                        <button
                          type="button"
                          onClick={() => openAdd(dayIso)}
                          className="aspect-[4/5] w-full cursor-pointer bg-transparent transition hover:bg-cream/5"
                          aria-label="Add event to this day"
                        />
                      ) : (
                        <div className="aspect-[4/5] w-full" />
                      )
                    ) : dayEvents.length === 1 ? (
                      <DayEventCard
                        key={dayEvents[0].id}
                        ev={dayEvents[0]}
                        editing={editing}
                        onEdit={() => openEdit(dayEvents[0])}
                      />
                    ) : (
                      <MultiEventStack
                        events={dayEvents}
                        onOpen={() => setOpenDayIso(dayIso)}
                      />
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

      {/* Live @nodice.bar feed under the calendar. Same Behold widget
          as the homepage; copy is independently editable via its own
          CMS keys so the wording can vary between pages. */}
      <InstagramFeed
        eyebrowKey="events.instagram.eyebrow"
        eyebrowFallback="@nodice.bar"
        headingKey="events.instagram.heading"
        headingFallback="What's been going on."
      />

      {/* Inline create/edit modal — only mounted when something is
          open. Save / delete refresh the month's events. */}
      {modalOpen && (
        <CalendarEventModal
          event={modalEvent}
          defaultDate={modalDate ?? undefined}
          onClose={closeModal}
          onSaved={async () => {
            closeModal();
            await reload();
          }}
        />
      )}

      {/* Day-view popup — opens when the customer clicks a calendar
          cell that has multiple events. Shows every event for that
          date at full size so the grid cell can stay compact. */}
      {openDayIso && (
        <DayEventsPopup
          dateIso={openDayIso}
          events={byDay[parseInt(openDayIso.slice(-2), 10)] ?? []}
          editing={editing}
          onEditEvent={(ev) => {
            setOpenDayIso(null);
            openEdit(ev);
          }}
          onClose={() => setOpenDayIso(null)}
        />
      )}
    </main>
  );
}

// Single event card inside a day cell. Image is 4:5 per brief.
// Title + optional body + optional link sit beneath the image.
//
// In admin Edit mode (`editing=true`), the whole card becomes a
// button that calls onEdit instead of opening the public link. A
// small pencil pill in the top-right hints at the click target.
function DayEventCard({
  ev,
  editing,
  onEdit,
}: {
  ev: DbCalendarEvent;
  editing: boolean;
  onEdit: () => void;
}) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const src =
    ev.image_url && ev.image_url.startsWith("/")
      ? `${base}${ev.image_url}`
      : ev.image_url;
  // DJ nights are auto-fed from the team hub — shown everywhere but never
  // editable from this site's admin (the DJ system owns them).
  const dj = isDjEvent(ev);

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
        {/* Category badge — shows the event's type (DJ Night / Match Day / …).
            DJ-fed nights keep the pink accent; a re-categorised DJ night shows
            its new category here, so admin changes are visible publicly. */}
        {ev.subcategory && (
          <span
            className={`absolute left-1 top-1 z-10 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
              dj ? "bg-plonkPink/90 text-white" : "bg-ink/80 text-cream/85"
            }`}
          >
            {ev.subcategory}
          </span>
        )}
        {editing && !dj && (
          <span className="absolute right-1 top-1 z-10 rounded-full bg-cream/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink">
            Edit
          </span>
        )}
      </div>
      {/* Title + time + body */}
      <div className="px-1.5 py-1.5 sm:px-2 sm:py-2">
        <p className="line-clamp-2 text-[10px] font-bold uppercase tracking-wider text-cream sm:text-[11px]">
          {ev.title}
        </p>
        {ev.start_time && (
          <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-plonkPink sm:text-[10px]">
            {formatTime(ev.start_time)}
          </p>
        )}
        {ev.body && (
          <p className="mt-1 line-clamp-2 text-[9px] leading-snug text-cream/65 sm:text-[10px]">
            {ev.body}
          </p>
        )}
      </div>
    </div>
  );

  // Edit mode wins over the public link — clicking always opens the
  // editor instead of navigating away. DJ nights are read-only (managed
  // in the team hub), so they fall through to the normal display.
  if (editing && !dj) {
    return (
      <button
        type="button"
        onClick={onEdit}
        className="flex-1 cursor-pointer overflow-hidden text-left transition hover:opacity-90"
      >
        {inner}
      </button>
    );
  }

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

// =============================================================
// MultiEventStack — condensed multi-event cell
// =============================================================
// Renders inside a day cell when 2+ events fall on the same date.
// Caps the visual footprint at roughly 1.5× a single DayEventCard
// regardless of how many events there are (2 or 20), so a busy day
// can never blow out the row's height.
//
// Layout:
//   • Top half: the first event's artwork (or a "stack" badge if
//     no artwork) at a shorter aspect than a normal card
//   • Bottom: a vertical list of small chips — one per event — with
//     title + start_time
//   • Top-right pill: "N EVENTS"
//
// The whole cell is one button — clicking anywhere opens the
// DayEventsPopup with the full list at original card size.
// =============================================================
function MultiEventStack({
  events,
  onOpen,
}: {
  events: DbCalendarEvent[];
  onOpen: () => void;
}) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const first = events[0];
  const headlineSrc =
    first.image_url && first.image_url.startsWith("/")
      ? `${base}${first.image_url}`
      : first.image_url;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${events.length} events on this day`}
      className="group flex flex-1 cursor-pointer flex-col overflow-hidden text-left transition hover:opacity-90"
    >
      {/* Headline artwork — SQUARE thumbnail so portrait posters
          (most of them — DJ flyers, food residency artwork) fit
          without weird middle-crops. object-contain shows the whole
          poster; the bg-ink fills any letterbox space cleanly.
          Falls back to a stack icon when no artwork is set. */}
      <div className="relative aspect-square w-full overflow-hidden bg-ink">
        {headlineSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={headlineSrc}
            alt={first.title}
            loading="lazy"
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-widest text-cream/40">
            multi-event
          </div>
        )}

        {/* Count pill — top-right corner so it doesn't clash with the
            day-number badge top-left. */}
        <span className="absolute right-1 top-1 rounded-full bg-plonkPink px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-md">
          {events.length} events
        </span>

        {/* Subtle bottom gradient so the chips below read clearly even
            when artwork is busy. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-b from-transparent to-ink/80" />
      </div>

      {/* Chip stack — one chip per event. Limited to the first 4 so
          the cell can't grow further; "+N more" if there are extras. */}
      <div className="flex flex-col gap-0.5 px-1.5 py-1.5 sm:px-2 sm:py-2">
        {events.slice(0, 4).map((ev) => (
          <div
            key={ev.id}
            className="flex items-center justify-between gap-1.5 truncate"
          >
            <span className="line-clamp-1 text-[10px] font-bold uppercase tracking-wider text-cream sm:text-[11px]">
              {ev.title}
            </span>
            {ev.start_time && (
              <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.18em] text-plonkPink sm:text-[10px]">
                {formatTime(ev.start_time)}
              </span>
            )}
          </div>
        ))}
        {events.length > 4 && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-plonkPink sm:text-[10px]">
            + {events.length - 4} more
          </span>
        )}

        <span className="mt-1 text-[9px] font-bold uppercase tracking-widest text-cream/55 group-hover:text-cream/85">
          Tap to expand →
        </span>
      </div>
    </button>
  );
}

// =============================================================
// DayEventsPopup — full-size view of every event on one date
// =============================================================
// Opens from a MultiEventStack click. Centred modal with the date
// heading at the top and the day's events stacked at their full
// DayEventCard size (artwork + title + body + time + link). In
// admin Edit mode, tapping a card opens the inline edit form
// (reuses the existing CalendarEventModal flow upstream).
// =============================================================
function DayEventsPopup({
  dateIso,
  events,
  editing,
  onEditEvent,
  onClose,
}: {
  dateIso: string;
  events: DbCalendarEvent[];
  editing: boolean;
  onEditEvent: (ev: DbCalendarEvent) => void;
  onClose: () => void;
}) {
  // Close on Escape — standard modal behaviour. Mounting listener
  // only while the popup is open avoids leaks.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const heading = new Date(dateIso + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-cream/15 bg-ink p-6 text-cream"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Events on ${heading}`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full border border-cream/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-cream/75 transition hover:border-cream/45"
        >
          ×
        </button>

        <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.28em] text-plonkPink">
          {events.length} events
        </div>
        <h2 className="font-display text-2xl uppercase tracking-wider sm:text-3xl">
          {heading}
        </h2>

        {/* Grid of full-size event cards. 1 column on mobile, 2 on
            tablet+ so the popup stays compact even with 4+ events. */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="overflow-hidden rounded-xl border border-cream/10 bg-ink/40"
            >
              <DayEventCard
                ev={ev}
                editing={editing}
                onEdit={() => onEditEvent(ev)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
