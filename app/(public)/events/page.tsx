"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadCalendarEventsInRange,
  defaultPosterFor,
  EVENT_TYPES,
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
const WEEKDAYS_FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// One colour per event subcategory so the calendar reads at a glance
// (founder rule 2026-07-02). Returns Tailwind classes for:
//   - `stripe`  — a 3px accent bar down the left of the artwork
//   - `pill`    — the top-right badge that already showed subcategory
//   - `dot`     — a small round marker for lists/day-detail
// Blank / unknown subcategory → neutral cream fallback so the grid
// stays consistent for untagged events.
const CATEGORY_COLOURS: Record<
  string,
  { stripe: string; pill: string; dot: string }
> = {
  "DJ Night": {
    stripe: "bg-plonkPink",
    pill: "bg-plonkPink/90 text-white",
    dot: "bg-plonkPink",
  },
  "Match Day": {
    stripe: "bg-plonkTeal",
    pill: "bg-plonkTeal/90 text-ink",
    dot: "bg-plonkTeal",
  },
  "Pool Night": {
    stripe: "bg-purple-400",
    pill: "bg-purple-500/90 text-white",
    dot: "bg-purple-400",
  },
  "Food Night": {
    stripe: "bg-orange-400",
    pill: "bg-orange-500/90 text-white",
    dot: "bg-orange-400",
  },
  Deals: {
    stripe: "bg-plonkYellow",
    pill: "bg-plonkYellow/90 text-ink",
    dot: "bg-plonkYellow",
  },
  "Special Event": {
    stripe: "bg-sky-400",
    pill: "bg-sky-500/90 text-white",
    dot: "bg-sky-400",
  },
};
const CATEGORY_FALLBACK = {
  stripe: "bg-cream/40",
  pill: "bg-ink/80 text-cream/85",
  dot: "bg-cream/50",
};
function categoryColours(subcategory: string | null | undefined) {
  if (!subcategory) return CATEGORY_FALLBACK;
  return CATEGORY_COLOURS[subcategory] ?? CATEGORY_FALLBACK;
}

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

  // Category filter — tick which kinds of event to show. All on by default.
  const [selectedCats, setSelectedCats] = useState<Set<string>>(
    () => new Set(EVENT_TYPES),
  );
  const allCatsOn = selectedCats.size === EVENT_TYPES.length;
  const toggleCat = (c: string) =>
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

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
  // Apply the category filter. When everything is selected we show all events
  // (including any category not in the filter list); narrowing filters by
  // subcategory.
  const visibleEvents = useMemo(
    () =>
      allCatsOn
        ? events
        : events.filter((e) => selectedCats.has(e.subcategory ?? "")),
    [events, selectedCats, allCatsOn],
  );

  const byDay = useMemo(() => {
    const m: Record<number, DbCalendarEvent[]> = {};
    for (const e of visibleEvents) {
      const d = parseInt(e.event_date.slice(-2), 10);
      (m[d] ??= []).push(e);
    }
    return m;
  }, [visibleEvents]);

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

      {/* Open call — top of the calendar so any DJ can put themselves forward to
          play. The DJ portal lives on the team hub, so this links out to
          team.nodice.bar/dj/join (a code-gated profile form, not a booking). */}
      <section className="px-6 pt-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 rounded-2xl border border-plonkPink/30 bg-plonkPink/10 px-5 py-4 sm:px-6 sm:py-5">
          <div className="min-w-[200px] flex-1">
            <p className="font-display text-lg uppercase tracking-wide text-cream sm:text-xl">
              Want to play at No Dice?
            </p>
            <p className="mt-1 text-sm leading-snug text-cream/70">
              Set up a DJ profile and our booking team will be in touch — no need to
              know anyone.
            </p>
          </div>
          <a
            href="https://team.nodice.bar/dj/join"
            className="shrink-0 rounded-full border border-plonkPink bg-plonkPink px-6 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white transition hover:opacity-90"
          >
            Become a No Dice DJ
          </a>
        </div>
      </section>

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

      {/* CATEGORY FILTER — SHOW ALL is a master toggle at the front. When
          it's on, every category pill lights up; unticking any category
          drops SHOW ALL out of its active state automatically (since not
          everything is selected any more). Tapping SHOW ALL again re-selects
          the full set. Founder direction 2026-07-31. */}
      <section className="px-6 pb-2">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cream/45">
            Show
          </span>
          <button
            type="button"
            // True toggle: on → clears every category (empty calendar); off →
            // re-selects everything. Founder direction 2026-07-31.
            onClick={() =>
              setSelectedCats(allCatsOn ? new Set() : new Set(EVENT_TYPES))
            }
            aria-pressed={allCatsOn}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] transition ${
              allCatsOn
                ? "border-cream bg-cream text-ink"
                : "border-cream/25 text-cream/70 hover:border-cream/60 hover:text-cream"
            }`}
          >
            {allCatsOn ? "✓ " : ""}
            Show all
          </button>
          {EVENT_TYPES.map((c) => {
            const on = selectedCats.has(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleCat(c)}
                aria-pressed={on}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] transition ${
                  on
                    ? "border-plonkPink bg-plonkPink text-white"
                    : "border-cream/15 text-cream/50 hover:border-cream/40 hover:text-cream/80"
                }`}
              >
                {on ? "✓ " : ""}
                {c}
              </button>
            );
          })}
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

              // Mobile FOMO rule (founder 2026-07-02): dead dates
              // create a massive black void on phones. Skip empty
              // days entirely on mobile so the calendar scrolls
              // straight to the next real event. Desktop keeps
              // empty cells so the 7-col grid alignment stays.
              // Edit mode always shows every day so admin can add.
              const skipOnMobile = dayEvents.length === 0 && !editing;
              return (
                <article
                  key={`d-${day}`}
                  className={`group relative flex-col overflow-hidden rounded-md border bg-ink/40 sm:flex sm:rounded-xl ${
                    skipOnMobile ? "hidden" : "flex"
                  } ${
                    /* Today = a clear WHITE ring (founder 7 Aug 2026) — the
                       old thin pink border vanished against a page full of
                       pink event chrome. */
                    isToday
                      ? "border-cream ring-2 ring-cream"
                      : "border-cream/10"
                  } ${editing && !isToday ? "ring-1 ring-cream/10" : ""}`}
                >
                  {/* Day-number badge — DESKTOP only. On mobile the
                      dedicated header strip below carries the date;
                      keeping this absolute badge visible there caused
                      the day number to sit on top of the weekday label
                      (founder bug 2026-07-02). */}
                  <div
                    className={`absolute left-2 top-2 z-10 hidden rounded-full px-1.5 py-0.5 text-xs font-bold sm:block ${
                      isToday ? "bg-cream text-ink" : "bg-ink/80 text-cream/85"
                    }`}
                  >
                    {day}
                  </div>

                  {/* Mobile date header — dedicated strip so the day
                      number, full weekday name and month all get
                      breathing room. Bigger + clearer per founder
                      request; today's date highlights in plonkPink. */}
                  {(() => {
                    const dow =
                      new Date(dayIso + "T00:00:00").getDay() === 0
                        ? 6
                        : new Date(dayIso + "T00:00:00").getDay() - 1;
                    return (
                      <div
                        className={`flex items-baseline gap-3 border-b px-4 py-3 sm:hidden ${
                          isToday
                            ? "border-cream/50 bg-cream/10"
                            : "border-cream/10 bg-ink/60"
                        }`}
                      >
                        <span
                          className={`font-display text-3xl leading-none ${
                            isToday ? "text-cream" : "text-cream"
                          }`}
                        >
                          {day}
                        </span>
                        <span className="text-sm font-bold uppercase tracking-[0.22em] text-cream/80">
                          {WEEKDAYS_FULL[dow]}
                        </span>
                        <span className="ml-auto text-xs font-bold uppercase tracking-widest text-cream/50">
                          {MONTHS_SHORT[active.month]}
                        </span>
                      </div>
                    );
                  })()}

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

          {visibleEvents.length === 0 && !loading && (
            <p className="mt-12 text-center text-sm text-cream/55">
              {events.length > 0 && !allCatsOn ? (
                <>
                  No matching events for {monthLabel(active.year, active.month)} —
                  try showing more types above.
                </>
              ) : (
                <Editable k="events.empty_state">
                  Nothing yet for {monthLabel(active.year, active.month)} — check
                  back soon.
                </Editable>
              )}
            </p>
          )}
        </div>
      </section>

      {/* Record stores we love — founder-curated list of local digging
          spots for the DJ-night crowd (6 Aug 2026). Collapsed by default
          so it doesn't push the Instagram feed down for people who just
          came for the calendar. */}
      <RecordStores />

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
  // No artwork of its own → fall back to the category default so a customer
  // never sees a blank tile.
  const raw = ev.image_url || defaultPosterFor(ev.subcategory);
  const src = raw && raw.startsWith("/") ? `${base}${raw}` : raw;
  // DJ nights are auto-fed from the team hub — shown everywhere but never
  // editable from this site's admin (the DJ system owns them).
  const dj = isDjEvent(ev);

  const cc = categoryColours(ev.subcategory);

  const inner = (
    <div className="relative flex h-full flex-col">
      {/* Left-edge accent stripe — instant visual signal of which
          subcategory this event belongs to. Fully hidden for untagged
          events (fallback stripe is cream/40 — subtle enough to feel
          intentional). */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-1 ${cc.stripe}`}
      />
      {/* 4:5 artwork slot. object-contain (founder rule 2026-07-02)
          so uploaded posters are shown WHOLE — portrait DJ flyers,
          square Deals cards, landscape food shots all fit without
          mid-image cropping. Any letterbox space fills against bg-ink
          so the card still reads clean. */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-ink">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={ev.title}
            loading="lazy"
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-widest text-cream/40">
            no artwork
          </div>
        )}
        {/* Category badge — top-RIGHT so it never overlaps the day-number badge
            (which sits top-left of the cell). Shows the event's type; DJ-fed
            nights keep the pink accent, a re-categorised DJ night shows its new
            category here so admin changes are visible publicly. */}
        {ev.subcategory && (
          <span
            className={`absolute right-1 top-1 z-10 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${cc.pill}`}
          >
            {ev.subcategory}
          </span>
        )}
        {editing && !dj && (
          <span className="absolute bottom-1 right-1 z-10 rounded-full bg-cream/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink">
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
  const headlineRaw = first.image_url || defaultPosterFor(first.subcategory);
  const headlineSrc =
    headlineRaw && headlineRaw.startsWith("/")
      ? `${base}${headlineRaw}`
      : headlineRaw;
  // Founder 2026-07-02: on mobile, show every event's thumbnail side-
  // by-side so DJs / food residencies / promos get visible artwork
  // instead of being buried under a single headline. Cap at 4 so a
  // busy day doesn't shrink each poster to nothing; overflow becomes
  // "+N more".
  const MOBILE_THUMB_CAP = 4;
  const mobileThumbs = events.slice(0, MOBILE_THUMB_CAP);
  const mobileOverflow = Math.max(0, events.length - MOBILE_THUMB_CAP);
  function thumbSrc(ev: DbCalendarEvent): string {
    const raw = ev.image_url || defaultPosterFor(ev.subcategory);
    if (!raw) return "";
    return raw.startsWith("/") ? `${base}${raw}` : raw;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${events.length} events on this day`}
      className="group flex flex-1 cursor-pointer flex-col overflow-hidden text-left transition hover:opacity-90"
    >
      {/* MOBILE — every poster shown side-by-side. object-contain so
          portrait posters aren't cropped weirdly. Founder rule: no
          hidden DJ artwork behind a "tap to expand". */}
      <div className="relative flex w-full gap-0.5 overflow-hidden bg-ink sm:hidden">
        {mobileThumbs.map((ev) => {
          const src = thumbSrc(ev);
          const c = categoryColours(ev.subcategory);
          return (
            <div
              key={ev.id}
              className="relative aspect-square flex-1 overflow-hidden bg-ink"
            >
              {/* Colour stripe across the top of each mini thumbnail
                  so multi-event days read at a glance which subcategory
                  is which without having to expand. */}
              <span
                aria-hidden="true"
                className={`absolute inset-x-0 top-0 z-10 h-0.5 ${c.stripe}`}
              />
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={ev.title}
                  loading="lazy"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-widest text-cream/40">
                  {ev.title.slice(0, 3)}
                </div>
              )}
            </div>
          );
        })}
        {mobileOverflow > 0 && (
          <div className="flex aspect-square w-10 shrink-0 items-center justify-center bg-ink/70 text-[11px] font-bold uppercase tracking-widest text-plonkPink">
            +{mobileOverflow}
          </div>
        )}
        <span className="absolute right-1 top-1 rounded-full bg-plonkPink px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-md">
          {events.length} events
        </span>
      </div>

      {/* DESKTOP — original single headline poster + count pill. The
          founder specifically said desktop is fine as-is. Kept
          hidden on mobile via `hidden sm:block`. */}
      <div className="relative hidden aspect-square w-full overflow-hidden bg-ink sm:block">
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
        <span className="absolute right-1 top-1 rounded-full bg-plonkPink px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-md">
          {events.length} events
        </span>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-b from-transparent to-ink/80" />
      </div>

      {/* Chip stack — one chip per event. Limited to the first 4 so
          the cell can't grow further; "+N more" if there are extras.
          A small subcategory-coloured dot leads each row so the
          founder / customer can eyeball the day's mix at a glance. */}
      <div className="flex flex-col gap-0.5 px-1.5 py-1.5 sm:px-2 sm:py-2">
        {events.slice(0, 4).map((ev) => {
          const c = categoryColours(ev.subcategory);
          return (
            <div
              key={ev.id}
              className="flex items-center justify-between gap-1.5 truncate"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`}
                />
                <span className="line-clamp-1 text-[10px] font-bold uppercase tracking-wider text-cream sm:text-[11px]">
                  {ev.title}
                </span>
              </span>
              {ev.start_time && (
                <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.18em] text-plonkPink sm:text-[10px]">
                  {formatTime(ev.start_time)}
                </span>
              )}
            </div>
          );
        })}
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

// =============================================================
// Record Stores We Love — founder-curated digging list
// =============================================================
// Collapsible section between the calendar and the Instagram feed.
// 12 shops with Instagram handles; Hackney/East London first, then
// two flagged worth-the-trip entries. Collapsed by default so the
// page length stays calendar-first. (Founder list, 6 Aug 2026.)
const RECORD_STORES: {
  name: string;
  handle: string;
  area: string;
  note: string;
  flag?: string;
}[] = [
  { name: "Rook Records", handle: "rookrecords", area: "Hackney Wick, E3", note: "Jazz, soul, disco into house. Reggae and hip hop. Heavy on US and Japanese second-hand imports." },
  { name: "Stranger Than Paradise", handle: "strangerthanparadiserecords", area: "Mare Street Market, E8", note: "New releases and leftfield. The tastemaker shop." },
  { name: "Kingsland Records", handle: "kingsland_records", area: "492 Kingsland Rd, E8", note: "Reggae, jazz, African, Latin, highlife, soukous, funk, soul, jungle, hip hop. Custom soundsystem in store." },
  { name: "Eldica Records", handle: "eldica_records", area: "Bradbury St, Dalston", note: "Funk, soul, hip hop, jazz, calypso, African grooves. Second-hand, running since 2001." },
  { name: "Kristina Records", handle: "kristinarecords", area: "Stoke Newington Rd", note: "New and used across most genres, plus coffee, wine and in-store events." },
  { name: "Hidden Sounds", handle: "hiddensounds_london", area: "89 Ridley Rd, first floor, E8", note: "House, techno, ambient, experimental, disco, synth and proper obscurities." },
  { name: "The BBE Store", handle: "the_bbe_store", area: "Helmsley Place, London Fields", note: "Practically neighbours. BBE releases plus second-hand soul, disco, jazz, rap, breaks, reggae." },
  { name: "Tome Records", handle: "tomerecords", area: "234 Graham Rd, Hackney Central", note: "All genres, new and used, vinyl and cassettes. Open seven days." },
  { name: "Atlantis Records", handle: "atlantis_records_hackney", area: "8 Clarence Rd, Lower Clapton", note: "Collectible second-hand. They buy collections too." },
  { name: "Yoyo Records", handle: "yoyorecordslondon", area: "501 Cambridge Heath Rd, E2", note: "Soul, funk, jazz and hip hop — US original pressings a speciality. Split off Cosmos Records in 2020." },
  { name: "Caravan Records", handle: "caravan_worldwide", area: "260 Globe Rd, Bethnal Green", note: "Japanese vintage record and book shop — every record hand-cleaned, plus art mags and zines." },
  { name: "Rough Trade East", handle: "roughtradeeast", area: "Brick Lane", note: "The flagship. Big new-release racks, venue and bar attached." },
  { name: "Next Door Records", handle: "nextdoorrecords_", area: "W12 and N16", flag: "N16 site is the close one", note: "Contemporary, jazz, broken beat, dub, reggae, house, techno, garage. Shop, bar and venue." },
  { name: "Cigarette Records", handle: "cigarette_records", area: "Old Street Records, 350 Old St", flag: "Residency — check IG before you go", note: "Currently set up inside Old Street Records. Strong on afro, reggae and soul rarities." },
];

// The record-shop cycle crawl — an efficient one-way ride through the
// fixed-address shops. Starts at BBE (one minute from the No Dice door),
// sweeps London Fields → Hackney Central → Clapton → Dalston → Stokey,
// rolls back south through Cambridge Heath (Yoyo) and Bethnal Green
// (Caravan) and ends at Rook in Hackney Wick, a 10-minute ride back to
// the bar. Next Door (multiple sites) and Cigarette (residency) are on
// the list but off the route; Rough Trade East is off the mapped route
// too — Google's URL API caps at 9 waypoints and Brick Lane is an
// out-and-back spur, so it gets a note instead (it's the one shop
// everyone can find anyway).
// Hidden per founder direction 7 Aug 2026 — flip to true to restore the
// Plan-a-trip cycle-route block inside the Record Stores dropdown.
const SHOW_CRAWL = false;

const CRAWL_URL = (() => {
  const wp = [
    "Stranger Than Paradise Records, Mare Street Market, London",
    "Tome Records, 234 Graham Road, London",
    "Atlantis Records, 8 Clarence Road, London",
    "Eldica Records, Bradbury Street, London",
    "Kingsland Records, 492 Kingsland Road, London",
    "Hidden Sounds, 89 Ridley Road, London",
    "Kristina Records, Stoke Newington Road, London",
    "Yoyo Records, 501 Cambridge Heath Road, London",
    "Caravan Records, 260 Globe Road, London",
  ];
  const p = new URLSearchParams({
    api: "1",
    origin: "The BBE Store, Helmsley Place, London",
    destination: "Rook Records, Hackney Wick, London",
    travelmode: "bicycling",
    waypoints: wp.join("|"),
  });
  return `https://www.google.com/maps/dir/?${p.toString()}`;
})();

// Approximate ride times between consecutive stops, in minutes. Shown as
// a leg-by-leg strip under the Plan-a-trip button. ~57 min riding total.
const CRAWL_LEGS: { stop: string; mins?: number }[] = [
  { stop: "BBE", mins: 3 },
  { stop: "Stranger Than Paradise", mins: 4 },
  { stop: "Tome", mins: 5 },
  { stop: "Atlantis", mins: 8 },
  { stop: "Eldica", mins: 2 },
  { stop: "Kingsland", mins: 2 },
  { stop: "Hidden Sounds", mins: 4 },
  { stop: "Kristina", mins: 12 },
  { stop: "Yoyo", mins: 4 },
  { stop: "Caravan", mins: 13 },
  { stop: "Rook" },
];

function RecordStores() {
  const [open, setOpen] = useState(false);
  return (
    <section className="px-6 pb-4">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-3 rounded-2xl border border-cream/10 bg-ink/40 px-5 py-4 text-left transition hover:border-cream/25"
        >
          <span
            className={`inline-block text-xs text-plonkPink transition-transform ${open ? "rotate-90" : ""}`}
            aria-hidden
          >
            ▶
          </span>
          <span className="flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-[0.28em] text-plonkPink">
              For the diggers
            </span>
            <span className="mt-1 block font-display text-2xl uppercase tracking-wider text-cream">
              Record Stores We Love
            </span>
          </span>
          <span className="text-xs text-cream/40">{RECORD_STORES.length} shops</span>
        </button>

        {/* Plan-a-trip cycle crawl — HIDDEN per founder direction 7 Aug 2026.
            The route URL + leg times (CRAWL_URL / CRAWL_LEGS above) are kept
            intact; flip SHOW_CRAWL to true to bring the block back. */}
        {SHOW_CRAWL && open && (
          <div className="mt-3 rounded-2xl border border-plonkPink/30 bg-plonkPink/5 px-5 py-4">
            <a
              href={CRAWL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-full bg-plonkPink px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-plonkPink/90"
            >
              🚲 Plan a trip — cycle route in Google Maps
            </a>
            <p className="mt-3 font-mono text-[11px] leading-relaxed text-cream/60">
              {CRAWL_LEGS.map((l, i) => (
                <span key={l.stop}>
                  <span className="text-cream/85">{l.stop}</span>
                  {l.mins != null && (
                    <span className="text-plonkPink"> →{l.mins}m→ </span>
                  )}
                </span>
              ))}
            </p>
            <p className="mt-2 text-[11px] text-cream/45">
              ~1 hr riding, one way. Starts 1 min from our door, ends in
              Hackney Wick — a 10-minute roll back to the bar for a pint.
              Fancy Rough Trade East too? It&apos;s a 7-minute spur from
              Caravan down to Brick Lane. Times are estimates; check shop
              opening hours before setting off.
            </p>
          </div>
        )}

        {open && (
          <div className="mt-3 overflow-hidden rounded-2xl border border-cream/10">
            {RECORD_STORES.map((s) => (
              <a
                key={s.handle}
                href={`https://www.instagram.com/${s.handle}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="group block border-b border-cream/10 bg-ink/30 px-5 py-4 transition last:border-b-0 hover:bg-ink/60"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[15px] font-bold text-cream">{s.name}</span>
                  <span className="font-mono text-[13px] text-plonkPink group-hover:underline">
                    @{s.handle}
                  </span>
                  {s.flag && (
                    <span className="rounded border border-plonkPink/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-plonkPink">
                      {s.flag}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[13px] text-cream/60">
                  <span className="text-cream/80">{s.area}</span> — {s.note}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
