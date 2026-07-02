"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import MediaPicker from "@/components/admin/MediaPicker";
import DatePickerInput from "@/components/admin/DatePickerInput";
import { EVENT_TYPES } from "@/lib/db/calendarEvents";
import {
  loadAllEvents,
  loadAllTicketTypes,
  createEvent,
  createTicketType,
  updateEvent,
  updateTicketType,
  deleteTicketType,
  deleteEvent,
  generateRecurrenceDates,
  CATEGORY_LABEL,
  type DbEvent,
  type DbTicketType,
  type EventCategory,
  type RecurrenceType,
} from "@/lib/db/eventsPlatform";

// =============================================================
// EventsAdminClient — the "Create Event" workbench
// =============================================================
// Two halves: the list of upcoming/recent events at the top, and
// an inline create form below. The form materialises recurring
// series as N concrete child events on save so the calendar can
// stay "one row per date" and individual instances can be edited
// or cancelled later without touching the parent.
//
// Poster upload runs through the existing MediaPicker. GIFs land
// in Supabase storage just like JPEG/PNG and animate inline because
// we render them with <img> (not next/image's optimiser).
// =============================================================

function describe(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  return fallback;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPence(p: number): string {
  if (p % 100 === 0) return `£${p / 100}`;
  return `£${(p / 100).toFixed(2)}`;
}

const CATEGORY_OPTIONS: EventCategory[] = [
  "pool_tournament_doubles",
  "pool_tournament_singles",
  "pool_special",
  "dj_night",
  "food_event",
  "drink_special",
  "arcade",
  "golf",
  "world_cup",
  "other",
];

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: "none", label: "One-off (no repeat)" },
  { value: "weekly", label: "Repeats weekly" },
  { value: "fortnightly", label: "Repeats fortnightly" },
  { value: "monthly", label: "Repeats monthly" },
];

// Draft shape for a ticket type in the create form. Mirrors
// NewTicketType but everything is editable strings so the inputs
// behave naturally; coerced to numbers on save.
type TicketDraft = {
  name: string;
  description: string;
  price: string;       // pounds, e.g. "12.50"
  capacity: string;    // optional, blank = unlimited within event max
};

const blankTicket = (): TicketDraft => ({
  name: "",
  description: "",
  price: "",
  capacity: "",
});

export default function EventsAdminClient() {
  const [events, setEvents] = useState<DbEvent[]>([]);
  const [ticketTypes, setTicketTypes] = useState<DbTicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  // ID of the event currently being edited (modal open if non-null).
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // ---- List filters & view mode ----
  // Live search across event name + description.
  const [search, setSearch] = useState("");
  // Sort key — see SORT_OPTIONS below for the dropdown labels.
  type SortKey =
    | "date-asc"
    | "date-desc"
    | "sold-desc"
    | "sold-asc"
    | "revenue-desc"
    | "name-asc"
    | "created-desc";
  const [sortBy, setSortBy] = useState<SortKey>("date-asc");
  // Category filter — multi-select. Empty set = "all categories"
  // (default). Tick one or more to narrow both the list and the
  // calendar grid. Combines naturally with related types — e.g.
  // tick Doubles + Singles + Special to see every pool tournament.
  const [categoryFilter, setCategoryFilter] = useState<Set<EventCategory>>(
    () => new Set(),
  );
  // List ↔ calendar toggle. Calendar shows a month grid with event
  // chips on each date; click a chip to open the same edit modal.
  const [view, setView] = useState<"list" | "calendar">("list");
  // Which month the calendar view is currently showing. Stored as
  // (year, monthIndex 0-11) so the prev/next chevrons can just
  // increment without juggling Date object construction edge cases.
  const [calMonth, setCalMonth] = useState<{ year: number; month: number }>(
    () => {
      const d = new Date();
      return { year: d.getFullYear(), month: d.getMonth() };
    },
  );

  // ----- Form state -----
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [externalLink, setExternalLink] = useState("");
  const [posterUrl, setPosterUrl] = useState<string>("");
  const [showPicker, setShowPicker] = useState(false);
  const [category, setCategory] = useState<EventCategory>("dj_night");
  // Subcategory drives the FILTER CHIPS on the public /events calendar
  // (EVENT_TYPES: DJ Night, Match Day, Pool Night, Food Night, Deals,
  // Special Event). Blank = no subcategory tag, event still shows on
  // the calendar but doesn't count toward any chip.
  const [subcategory, setSubcategory] = useState<string>("");
  // Auto-tick "Closes /book/table reservations" when the admin
  // picks a category that almost always needs the dining tables.
  // They can still untick manually for the rare exception.
  useEffect(() => {
    if (category === "world_cup" || category === "food_event") {
      setBlocksTableBookings(true);
    }
  }, [category]);
  const [eventDate, setEventDate] = useState<string>(todayIso());
  const [startTime, setStartTime] = useState<string>("19:00");
  const [endTime, setEndTime] = useState<string>("");
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("none");
  const [occurrences, setOccurrences] = useState<number>(8);
  const [showOnPool, setShowOnPool] = useState(false);
  const [showOnCalendar, setShowOnCalendar] = useState(true);
  const [showOnBar, setShowOnBar] = useState(false);
  // "Blocks /book/table" — closes free dining-table reservations
  // for the event's date. Auto-defaults to true when the category
  // implies it (World Cup match, food residency); admin can toggle.
  const [blocksTableBookings, setBlocksTableBookings] = useState(false);
  const [requiresTicket, setRequiresTicket] = useState(true);
  const [maxAttendees, setMaxAttendees] = useState<string>("");
  const [tickets, setTickets] = useState<TicketDraft[]>([
    { name: "General entry", description: "", price: "", capacity: "" },
  ]);

  function resetForm() {
    setName("");
    setDescription("");
    setExternalLink("");
    setPosterUrl("");
    setCategory("dj_night");
    setSubcategory("");
    setEventDate(todayIso());
    setStartTime("19:00");
    setEndTime("");
    setRecurrenceType("none");
    setOccurrences(8);
    setShowOnPool(false);
    setShowOnCalendar(true);
    setShowOnBar(false);
    setBlocksTableBookings(false);
    setRequiresTicket(true);
    setMaxAttendees("");
    setTickets([{ name: "General entry", description: "", price: "", capacity: "" }]);
  }

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      const [e, t] = await Promise.all([
        loadAllEvents(),
        loadAllTicketTypes(),
      ]);
      setEvents(e);
      setTicketTypes(t);
    } catch (e) {
      setErr(describe(e, "Failed to load events"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  // Group ticket types by event for the row summary.
  const ticketsByEvent = useMemo(() => {
    const m = new Map<string, DbTicketType[]>();
    for (const tt of ticketTypes) {
      const arr = m.get(tt.event_id) ?? [];
      arr.push(tt);
      m.set(tt.event_id, arr);
    }
    return m;
  }, [ticketTypes]);

  // Search-filtered + sorted list driving both views. Sort is stable
  // (events with no ticket data tie-break by name) so the order
  // doesn't shuffle on every refresh.
  const visibleEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    // 1) Category filter first — usually narrows by the most.
    const byCategory =
      categoryFilter.size === 0
        ? events
        : events.filter((e) => categoryFilter.has(e.category));
    // 2) Then the live search.
    const filtered = q
      ? byCategory.filter((e) => {
          const name = e.name.toLowerCase();
          const desc = (e.description ?? "").toLowerCase();
          return name.includes(q) || desc.includes(q);
        })
      : byCategory;

    function revenueOf(ev: DbEvent): number {
      const tts = ticketsByEvent.get(ev.id) ?? [];
      // Per-ticket: price × paid count. Sum across all tiers.
      return tts.reduce(
        (sum, t) => sum + t.price_pence * (t.paid_count ?? 0),
        0,
      );
    }

    const sorted = [...filtered];
    switch (sortBy) {
      case "date-asc":
        sorted.sort((a, b) => a.event_date.localeCompare(b.event_date));
        break;
      case "date-desc":
        sorted.sort((a, b) => b.event_date.localeCompare(a.event_date));
        break;
      case "sold-desc":
        sorted.sort(
          (a, b) =>
            (b.paid_entries_count ?? 0) - (a.paid_entries_count ?? 0) ||
            a.event_date.localeCompare(b.event_date),
        );
        break;
      case "sold-asc":
        sorted.sort(
          (a, b) =>
            (a.paid_entries_count ?? 0) - (b.paid_entries_count ?? 0) ||
            a.event_date.localeCompare(b.event_date),
        );
        break;
      case "revenue-desc":
        sorted.sort(
          (a, b) =>
            revenueOf(b) - revenueOf(a) ||
            a.event_date.localeCompare(b.event_date),
        );
        break;
      case "name-asc":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "created-desc":
        sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
        break;
    }
    return sorted;
  }, [events, ticketsByEvent, search, sortBy, categoryFilter]);

  // Preview the dates that will be created when the form is saved.
  // Updates live as the founder changes the recurrence settings so
  // there's no guesswork about how many rows will be written.
  const previewDates = useMemo(() => {
    return generateRecurrenceDates(
      eventDate,
      recurrenceType,
      recurrenceType === "none" ? 1 : Math.max(1, occurrences),
    );
  }, [eventDate, recurrenceType, occurrences]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr("Event name is required.");
      return;
    }
    if (requiresTicket && tickets.length === 0) {
      setErr("Add at least one ticket type — or untick 'Requires ticket'.");
      return;
    }
    if (requiresTicket) {
      for (const t of tickets) {
        if (!t.name.trim()) {
          setErr("Every ticket type needs a name.");
          return;
        }
        if (t.price === "" || isNaN(parseFloat(t.price))) {
          setErr(`Ticket "${t.name}" needs a price.`);
          return;
        }
      }
    }

    setBusy(true);
    setErr("");
    try {
      const dates = previewDates;

      // Create the parent first (when recurring), then materialised
      // child rows. For a one-off the "parent" IS the only row.
      let parentId: string | null = null;
      for (let i = 0; i < dates.length; i++) {
        const d = dates[i];
        const created = await createEvent({
          name: name.trim(),
          description: description.trim() || null,
          external_link: externalLink.trim() || null,
          poster_url: posterUrl || null,
          category,
          subcategory: subcategory || null,
          event_date: d,
          start_time: startTime || null,
          end_time: endTime || null,
          recurrence_type: i === 0 ? recurrenceType : "none",
          recurrence_parent_id: i === 0 ? null : parentId,
          show_on_pool_schedule: showOnPool,
          show_on_events_calendar: showOnCalendar,
          show_on_bar_page: showOnBar,
          requires_ticket: requiresTicket,
          bookable: true,
          max_attendees: maxAttendees ? parseInt(maxAttendees, 10) : null,
          registration_open: true,
          blocks_table_bookings: blocksTableBookings,
        });
        if (i === 0) parentId = created.id;

        // Same ticket types on every instance.
        if (requiresTicket) {
          for (let ti = 0; ti < tickets.length; ti++) {
            const t = tickets[ti];
            await createTicketType(created.id, {
              name: t.name.trim(),
              description: t.description.trim() || null,
              price_pence: Math.round(parseFloat(t.price) * 100),
              capacity: t.capacity ? parseInt(t.capacity, 10) : null,
              available_from: null,
              available_until: null,
              sort_order: ti * 10,
              active: true,
            });
          }
        }
      }

      resetForm();
      setCreating(false);
      await reload();
    } catch (e) {
      setErr(describe(e, "Couldn't save the event"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(event: DbEvent) {
    if (
      !confirm(
        `Delete "${event.name}" on ${formatDate(event.event_date)}? This removes its tickets too and can't be undone.`,
      )
    )
      return;
    setBusy(true);
    try {
      await deleteEvent(event.id);
      await reload();
    } catch (e) {
      setErr(describe(e, "Couldn't delete"));
    } finally {
      setBusy(false);
    }
  }

  // ----- Render -----
  return (
    <div className="space-y-6">
      {err && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl uppercase tracking-wider text-cream">
          {creating ? "Create new event" : "All events"}
        </h2>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className={`rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
            creating
              ? "border border-cream/20 text-cream/85 hover:bg-cream/5"
              : "bg-plonkTeal text-ink hover:brightness-110"
          }`}
        >
          {creating ? "Cancel" : "+ Create event"}
        </button>
      </div>

      {creating && (
        <form
          onSubmit={handleSave}
          className="space-y-6 rounded-2xl border border-plonkTeal/30 bg-ink/40 p-6"
        >
          {/* Identity */}
          <Section title="Identity">
            <Field label="Event name">
              <input
                type="text"
                required
                placeholder="e.g. Funk Friday with DJ Tomato"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Description">
              <textarea
                rows={3}
                value={description}
                placeholder="Optional. What's the vibe? Who's playing? Any rules?"
                onChange={(e) => setDescription(e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="External link (optional)">
              <input
                type="url"
                placeholder="https://… Resident Advisor, Eventbrite, anything"
                value={externalLink}
                onChange={(e) => setExternalLink(e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Poster / artwork (image or GIF)">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="h-40 w-32 shrink-0 overflow-hidden rounded-md border border-cream/15 bg-ink/40">
                  {posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={posterUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-widest text-cream/40">
                      no artwork
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPicker(true)}
                    className="rounded-full bg-plonkTeal px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink hover:brightness-110"
                  >
                    {posterUrl ? "Change artwork" : "Pick / upload artwork"}
                  </button>
                  {posterUrl && (
                    <button
                      type="button"
                      onClick={() => setPosterUrl("")}
                      className="rounded-full border border-cream/15 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-cream/75 hover:bg-cream/5"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </Field>
          </Section>

          {/* Category + visibility */}
          <Section title="Category + where to show it">
            <Field label="Category">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as EventCategory)}
                className={inputCls}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </Field>
            {/* Subcategory drives the /events calendar filter chips.
                Blank = untagged; the event still appears on the
                calendar but doesn't match any chip. */}
            <Field label="Subcategory (calendar chip)">
              <select
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className={inputCls}
              >
                <option value="">— None —</option>
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Visibility">
              <div className="space-y-2">
                <Checkbox
                  checked={showOnPool}
                  onChange={setShowOnPool}
                  label="Show on /pool tournament schedule"
                />
                <Checkbox
                  checked={showOnCalendar}
                  onChange={setShowOnCalendar}
                  label="Show on /events calendar"
                />
                <Checkbox
                  checked={showOnBar}
                  onChange={setShowOnBar}
                  label="Show on /bar page"
                />
                <Checkbox
                  checked={blocksTableBookings}
                  onChange={setBlocksTableBookings}
                  label="Closes /book/table reservations for this date"
                />
              </div>
              {blocksTableBookings && (
                <p className="mt-2 text-xs text-cream/55">
                  Customers booking a free table for that day will be
                  shown a message and redirected to the right booking
                  page instead.
                </p>
              )}
            </Field>
          </Section>

          {/* Schedule + recurrence */}
          <Section title="Date + recurrence">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="First date">
                <DatePickerInput
                  value={eventDate}
                  onChange={setEventDate}
                  placeholder="Pick a date"
                />
              </Field>
              <Field label="Start time">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="End time (optional)">
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Recurrence">
              <select
                value={recurrenceType}
                onChange={(e) =>
                  setRecurrenceType(e.target.value as RecurrenceType)
                }
                className={inputCls}
              >
                {RECURRENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>

            {recurrenceType !== "none" && (
              <Field label="How many occurrences?">
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={occurrences}
                  onChange={(e) =>
                    setOccurrences(Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                  className={inputCls}
                />
                <p className="mt-2 text-xs text-cream/55">
                  Creates {previewDates.length} dates — first on{" "}
                  <strong>{formatDate(previewDates[0])}</strong>, last on{" "}
                  <strong>
                    {formatDate(previewDates[previewDates.length - 1])}
                  </strong>
                  .
                </p>
              </Field>
            )}
          </Section>

          {/* Tickets */}
          <Section title="Tickets">
            <Checkbox
              checked={requiresTicket}
              onChange={setRequiresTicket}
              label="This event requires a ticket / paid sign-up"
            />

            {requiresTicket && (
              <>
                <Field label="Max attendees per event (optional)">
                  <input
                    type="number"
                    min={1}
                    placeholder="Leave blank for no cap"
                    value={maxAttendees}
                    onChange={(e) => setMaxAttendees(e.target.value)}
                    className={inputCls}
                  />
                </Field>

                <div className="space-y-3">
                  {tickets.map((t, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-cream/10 bg-ink/40 p-4"
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className={labelCls}>Ticket name</label>
                          <input
                            type="text"
                            placeholder="e.g. Early bird"
                            value={t.name}
                            onChange={(e) => {
                              const next = [...tickets];
                              next[i] = { ...t, name: e.target.value };
                              setTickets(next);
                            }}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Price (£)</label>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            placeholder="0.00"
                            value={t.price}
                            onChange={(e) => {
                              const next = [...tickets];
                              next[i] = { ...t, price: e.target.value };
                              setTickets(next);
                            }}
                            className={inputCls}
                          />
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className={labelCls}>
                            Capacity for this tier (optional)
                          </label>
                          <input
                            type="number"
                            min={1}
                            placeholder="Blank = unlimited within event max"
                            value={t.capacity}
                            onChange={(e) => {
                              const next = [...tickets];
                              next[i] = { ...t, capacity: e.target.value };
                              setTickets(next);
                            }}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>
                            Description (optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. First 20 only"
                            value={t.description}
                            onChange={(e) => {
                              const next = [...tickets];
                              next[i] = { ...t, description: e.target.value };
                              setTickets(next);
                            }}
                            className={inputCls}
                          />
                        </div>
                      </div>
                      {tickets.length > 1 && (
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              setTickets(tickets.filter((_, j) => j !== i))
                            }
                            className="text-[11px] font-bold uppercase tracking-wider text-red-400/80 hover:underline"
                          >
                            Remove tier
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTickets([...tickets, blankTicket()])}
                    className="w-full rounded-xl border border-dashed border-plonkTeal/40 px-4 py-3 text-xs font-bold uppercase tracking-wider text-plonkTeal hover:bg-plonkTeal/10"
                  >
                    + Add another ticket tier
                  </button>
                </div>
              </>
            )}
          </Section>

          <div className="flex flex-wrap justify-between gap-3 border-t border-cream/10 pt-5">
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                resetForm();
              }}
              className="rounded-full border border-cream/15 px-5 py-2 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-plonkTeal px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-ink hover:brightness-110 disabled:opacity-50"
            >
              {busy
                ? "Saving…"
                : recurrenceType === "none"
                  ? "Save event"
                  : `Save event + ${previewDates.length - 1} repeats`}
            </button>
          </div>
        </form>
      )}

      {/* Existing events */}
      {!creating && (
        <div>
          {loading ? (
            <p className="text-sm text-cream/60">Loading…</p>
          ) : events.length === 0 ? (
            <p className="rounded-xl border border-cream/10 bg-ink/40 px-6 py-12 text-center text-sm text-cream/60">
              No events yet. Hit "+ Create event" to get started.
            </p>
          ) : (
            <>
              {/* Toolbar: search · sort · list/calendar toggle */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <input
                    type="search"
                    value={search}
                    onChange={(ev) => setSearch(ev.target.value)}
                    placeholder="Search events by name or description…"
                    className="w-full rounded-full border border-cream/15 bg-ink/40 py-2.5 pl-10 pr-4 text-sm text-cream placeholder:text-cream/35 focus:border-plonkTeal focus:outline-none"
                  />
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-cream/40"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <CategoryDropdown
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                />
                <SortDropdown value={sortBy} onChange={setSortBy} />
                <ViewToggle value={view} onChange={setView} />
              </div>

              {/* List counter — useful when filtered. */}
              {(search || sortBy !== "date-asc" || categoryFilter.size > 0) && (
                <p className="mb-3 text-[11px] uppercase tracking-widest text-cream/45">
                  Showing {visibleEvents.length} of {events.length} events
                </p>
              )}

              {view === "calendar" ? (
                <CalendarView
                  events={visibleEvents}
                  month={calMonth}
                  onMonthChange={setCalMonth}
                  onEventClick={(id) => setEditingEventId(id)}
                />
              ) : visibleEvents.length === 0 ? (
                <p className="rounded-xl border border-cream/10 bg-ink/40 px-6 py-10 text-center text-sm text-cream/55">
                  No events match "{search}". Try a different search.
                </p>
              ) : (
                <ul className="space-y-2">
                  {visibleEvents.map((e) => {
                const ticketsForEv = ticketsByEvent.get(e.id) ?? [];
                return (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cream/10 bg-ink/40 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-cream">
                        {e.name}
                      </div>
                      <div className="text-xs text-cream/55">
                        {formatDate(e.event_date)}
                        {e.start_time ? ` · ${e.start_time.slice(0, 5)}` : ""} ·{" "}
                        {CATEGORY_LABEL[e.category]}
                        {ticketsForEv.length > 0 && (
                          <>
                            {" · "}
                            {ticketsForEv
                              .map(
                                (t) => `${t.name} ${formatPence(t.price_pence)}`,
                              )
                              .join(", ")}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {e.show_on_pool_schedule && (
                        <Badge label="Pool" />
                      )}
                      {e.show_on_events_calendar && (
                        <Badge label="Calendar" />
                      )}
                      {e.show_on_bar_page && <Badge label="Bar" />}
                      <button
                        type="button"
                        onClick={() => setEditingEventId(e.id)}
                        disabled={busy}
                        className="rounded-full border border-plonkTeal/40 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-plonkTeal hover:bg-plonkTeal/10"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(e)}
                        disabled={busy}
                        className="text-[11px] font-bold uppercase tracking-wider text-red-400/80 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
              )}
            </>
          )}
        </div>
      )}

      {/* Poster picker */}
      {showPicker && (
        <MediaPicker
          onClose={() => setShowPicker(false)}
          onPick={(picked) => {
            const url = typeof picked === "string" ? picked : picked.src;
            setPosterUrl(url);
            setShowPicker(false);
          }}
        />
      )}

      {/* Edit existing event + its ticket types */}
      {editingEventId && (
        <EditEventModal
          event={events.find((e) => e.id === editingEventId)!}
          tickets={ticketsByEvent.get(editingEventId) ?? []}
          onClose={() => setEditingEventId(null)}
          onSaved={async () => {
            setEditingEventId(null);
            // Re-pull both lists so the row summary reflects the edit.
            const [evs, tts] = await Promise.all([
              loadAllEvents(),
              loadAllTicketTypes(),
            ]);
            setEvents(evs);
            setTicketTypes(tts);
          }}
        />
      )}
    </div>
  );
}

// =============================================================
// EditEventModal — edit core fields + ticket types on a row
// =============================================================
// Keeps the modal lightweight: name / date / kickoff / description /
// "show on" toggles for the event itself, plus an editable list of
// ticket types (name, price, capacity). Save dispatches one
// updateEvent call + per-ticket updateTicketType/createTicketType/
// deleteTicketType so the founder can fix prices, rename tiers, or
// add/remove a tier without us pushing code.
function EditEventModal({
  event,
  tickets,
  onClose,
  onSaved,
}: {
  event: DbEvent;
  tickets: DbTicketType[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  // ---- Event fields ----
  const [name, setName] = useState(event.name);
  const [description, setDescription] = useState(event.description ?? "");
  const [eventDate, setEventDate] = useState(event.event_date);
  const [startTime, setStartTime] = useState(
    event.start_time ? event.start_time.slice(0, 5) : "",
  );
  const [endTime, setEndTime] = useState(
    event.end_time ? event.end_time.slice(0, 5) : "",
  );
  const [showOnCalendar, setShowOnCalendar] = useState(
    event.show_on_events_calendar,
  );
  const [showOnPool, setShowOnPool] = useState(event.show_on_pool_schedule);
  const [showOnBar, setShowOnBar] = useState(event.show_on_bar_page);
  const [registrationOpen, setRegistrationOpen] = useState(
    event.registration_open,
  );
  const [blocksTableBookings, setBlocksTableBookings] = useState(
    event.blocks_table_bookings ?? false,
  );
  // Poster artwork — same MediaPicker as the create form. Editing an
  // existing event previously had no way to attach or change the
  // poster; founder rule 2026-07-02 requires it.
  const [posterUrl, setPosterUrl] = useState<string>(event.poster_url ?? "");
  const [showEditPicker, setShowEditPicker] = useState(false);
  // Recurrence editing — three modes based on this event's DB shape:
  //   • child of a series (recurrence_parent_id set) → read-only note
  //   • already a parent (recurrence_type != 'none') → allow bumping
  //     the pattern; regenerating future dates is a separate action
  //   • standalone (both null/none) → offer conversion to a series
  const isChildInstance = !!event.recurrence_parent_id;
  const isSeriesParent = event.recurrence_type !== "none";
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(
    event.recurrence_type,
  );
  const [occurrences, setOccurrences] = useState<string>("8");
  // Subcategory (calendar chip) — nullable, blank = untagged.
  const [subcategory, setSubcategory] = useState<string>(
    event.subcategory ?? "",
  );

  // ---- Ticket types ----
  // Mirror state for each existing ticket type, plus a track of which
  // (if any) the founder has marked for deletion + new draft rows.
  type TicketRow = {
    id: string | null; // null = new, not yet saved
    name: string;
    description: string;
    priceStr: string; // pounds as a string so the input feels natural
    capacityStr: string;
    deleted: boolean;
  };
  const [ticketRows, setTicketRows] = useState<TicketRow[]>(() =>
    tickets.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description ?? "",
      priceStr: (t.price_pence / 100).toFixed(2),
      capacityStr: t.capacity != null ? String(t.capacity) : "",
      deleted: false,
    })),
  );

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function patchRow(i: number, patch: Partial<TicketRow>) {
    setTicketRows((rows) =>
      rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    );
  }
  function addRow() {
    setTicketRows((rows) => [
      ...rows,
      {
        id: null,
        name: "",
        description: "",
        priceStr: "15.00",
        capacityStr: "",
        deleted: false,
      },
    ]);
  }

  async function save() {
    setErr("");
    setBusy(true);
    try {
      // 1) Update the event row itself.
      await updateEvent(event.id, {
        name: name.trim(),
        description: description.trim() || null,
        event_date: eventDate,
        start_time: startTime || null,
        end_time: endTime || null,
        show_on_events_calendar: showOnCalendar,
        show_on_pool_schedule: showOnPool,
        show_on_bar_page: showOnBar,
        registration_open: registrationOpen,
        blocks_table_bookings: blocksTableBookings,
        poster_url: posterUrl || null,
        subcategory: subcategory || null,
        // Only touch recurrence_type on the parent/standalone rows —
        // child instances leave it alone (read-only from this UI).
        ...(isChildInstance ? {} : { recurrence_type: recurrenceType }),
      });

      // 1a) Series creation: if this was a standalone and the founder
      //     picked a recurrence, materialise future child instances
      //     from this event's date forward. This event becomes the
      //     parent (child rows point back at it).
      if (
        !isChildInstance &&
        !isSeriesParent &&
        recurrenceType !== "none"
      ) {
        const count = Math.max(2, Math.min(52, parseInt(occurrences, 10) || 8));
        const dates = generateRecurrenceDates(
          eventDate,
          recurrenceType,
          count,
        );
        // dates[0] is this event's own date; skip it. Only create
        // the remaining child rows, each pointing at this event.
        for (let i = 1; i < dates.length; i++) {
          const child = await createEvent({
            name: name.trim(),
            description: description.trim() || null,
            external_link: event.external_link ?? null,
            poster_url: posterUrl || null,
            category: event.category,
            subcategory: subcategory || null,
            event_date: dates[i],
            start_time: startTime || null,
            end_time: endTime || null,
            recurrence_type: "none",
            recurrence_parent_id: event.id,
            show_on_pool_schedule: showOnPool,
            show_on_events_calendar: showOnCalendar,
            show_on_bar_page: showOnBar,
            requires_ticket: event.requires_ticket,
            bookable: true,
            max_attendees: event.max_attendees,
            registration_open: true,
            blocks_table_bookings: blocksTableBookings,
          });
          // Copy the ticket rows onto each child so bookings still
          // flow. Deleted/new rows on the parent are handled by the
          // ticket loop below — child rows just get whatever survives.
          for (const r of ticketRows) {
            if (r.deleted) continue;
            const price_pence = Math.max(
              0,
              Math.round(
                parseFloat(r.priceStr.replace(/[^0-9.]/g, "")) * 100,
              ) || 0,
            );
            const capacity =
              r.capacityStr.trim() === ""
                ? null
                : Math.max(0, parseInt(r.capacityStr, 10) || 0);
            await createTicketType(child.id, {
              name: r.name.trim() || "Ticket",
              description: r.description.trim() || null,
              price_pence,
              capacity,
              available_from: null,
              available_until: null,
              sort_order: 0,
              active: true,
            });
          }
        }
      }

      // 2) Each ticket row → update / create / delete.
      for (const r of ticketRows) {
        if (r.deleted && r.id) {
          await deleteTicketType(r.id);
          continue;
        }
        if (r.deleted) continue; // brand-new row marked deleted before save
        const price_pence = Math.max(
          0,
          Math.round(parseFloat(r.priceStr.replace(/[^0-9.]/g, "")) * 100) || 0,
        );
        const capacity =
          r.capacityStr.trim() === ""
            ? null
            : Math.max(0, parseInt(r.capacityStr, 10) || 0);
        if (r.id) {
          await updateTicketType(r.id, {
            name: r.name.trim() || "Ticket",
            description: r.description.trim() || null,
            price_pence,
            capacity,
          });
        } else {
          await createTicketType(event.id, {
            name: r.name.trim() || "Ticket",
            description: r.description.trim() || null,
            price_pence,
            capacity,
            available_from: null,
            available_until: null,
            sort_order: 0,
            active: true,
          });
        }
      }

      await onSaved();
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : "Save failed — check the fields and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-ink/85 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-plonkTeal/40 bg-ink shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-cream/10 px-6 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-cream/50">
              Edit event
            </p>
            <h3 className="font-display text-xl text-cream">{event.name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-cream/20 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            Cancel
          </button>
        </div>

        {/* ---- Event fields ---- */}
        <div className="space-y-4 border-b border-cream/10 px-6 py-5">
          <ModalField label="Name">
            <input
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              className={modalInputCls}
            />
          </ModalField>

          <div className="grid gap-4 sm:grid-cols-3">
            <ModalField label="Date">
              <DatePickerInput value={eventDate} onChange={setEventDate} />
            </ModalField>
            <ModalField label="Start time">
              <input
                type="time"
                value={startTime}
                onChange={(ev) => setStartTime(ev.target.value)}
                className={modalInputCls}
              />
            </ModalField>
            <ModalField label="End time (optional)">
              <input
                type="time"
                value={endTime}
                onChange={(ev) => setEndTime(ev.target.value)}
                className={modalInputCls}
              />
            </ModalField>
          </div>

          <ModalField label="Description">
            <textarea
              value={description}
              onChange={(ev) => setDescription(ev.target.value)}
              rows={3}
              className={modalInputCls}
            />
          </ModalField>

          {/* Poster artwork — parity with the create form so the
              founder can attach or swap the image without deleting
              and re-creating the event. */}
          <ModalField label="Poster artwork">
            <div className="flex items-start gap-3">
              <div className="h-24 w-20 shrink-0 overflow-hidden rounded-lg border border-cream/10 bg-ink">
                {posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={posterUrl}
                    alt="Poster preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-widest text-cream/40">
                    None
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditPicker(true)}
                  className="rounded-full border border-plonkTeal/40 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-plonkTeal hover:bg-plonkTeal/10"
                >
                  {posterUrl ? "Change artwork" : "Pick / upload artwork"}
                </button>
                {posterUrl && (
                  <button
                    type="button"
                    onClick={() => setPosterUrl("")}
                    className="text-left text-[10px] font-bold uppercase tracking-wider text-cream/55 hover:text-cream"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </ModalField>

          {/* Subcategory — same list as the public /events calendar
              filter chips. Blank keeps the event calendar-visible but
              untagged. */}
          <ModalField label="Subcategory (calendar chip)">
            <select
              value={subcategory}
              onChange={(ev) => setSubcategory(ev.target.value)}
              className={modalInputCls}
            >
              <option value="">— None —</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </ModalField>

          {/* Recurrence — offered on standalone events; noted as
              read-only on children of an existing series. */}
          <ModalField label="Repeats">
            {isChildInstance ? (
              <p className="rounded-lg border border-cream/10 bg-ink/40 px-3 py-2 text-xs text-cream/70">
                Part of a recurring series — this instance's pattern is
                locked. Edit the series parent to change the frequency.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={recurrenceType}
                  onChange={(ev) =>
                    setRecurrenceType(ev.target.value as RecurrenceType)
                  }
                  className={modalInputCls + " sm:max-w-xs"}
                >
                  <option value="none">One-off</option>
                  <option value="weekly">Weekly</option>
                  <option value="fortnightly">Fortnightly</option>
                  <option value="monthly">Monthly</option>
                </select>
                {!isSeriesParent && recurrenceType !== "none" && (
                  <div className="flex items-center gap-2 text-xs text-cream/70">
                    <span>× how many occurrences?</span>
                    <input
                      type="number"
                      min={2}
                      max={52}
                      value={occurrences}
                      onChange={(ev) => setOccurrences(ev.target.value)}
                      className={modalInputCls + " w-20"}
                    />
                  </div>
                )}
                {isSeriesParent && (
                  <p className="text-xs text-cream/60">
                    Existing series — changing the frequency here rewrites
                    this parent only; future occurrences already in the DB
                    aren't touched. To regenerate them, delete the future
                    dates first, then save with the new pattern.
                  </p>
                )}
              </div>
            )}
          </ModalField>

          <div className="flex flex-wrap gap-4 text-xs">
            <ModalCheck
              label="Show on events calendar"
              checked={showOnCalendar}
              onChange={setShowOnCalendar}
            />
            <ModalCheck
              label="Show on pool page"
              checked={showOnPool}
              onChange={setShowOnPool}
            />
            <ModalCheck
              label="Show on bar page"
              checked={showOnBar}
              onChange={setShowOnBar}
            />
            <ModalCheck
              label="Closes /book/table for this date"
              checked={blocksTableBookings}
              onChange={setBlocksTableBookings}
            />
            <ModalCheck
              label="Registration open"
              checked={registrationOpen}
              onChange={setRegistrationOpen}
            />
          </div>
        </div>

        {/* ---- Ticket types ---- */}
        <div className="px-6 py-5">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-cream/50">
              Tickets
            </h4>
            <button
              type="button"
              onClick={addRow}
              className="rounded-full border border-plonkTeal/40 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-plonkTeal hover:bg-plonkTeal/10"
            >
              + Add tier
            </button>
          </div>
          {ticketRows.length === 0 && (
            <p className="rounded-lg border border-cream/10 bg-ink/40 px-3 py-3 text-xs text-cream/60">
              No tickets on this event. Add a tier or leave empty for a free
              walk-in.
            </p>
          )}
          <div className="space-y-3">
            {ticketRows.map((r, i) =>
              r.deleted ? (
                <div
                  key={`del-${i}`}
                  className="flex items-center justify-between rounded-lg border border-red-400/30 bg-red-400/5 px-3 py-2 text-xs text-red-300"
                >
                  <span>
                    Will delete <strong>{r.name || "(unnamed)"}</strong> on
                    save.
                  </span>
                  <button
                    type="button"
                    onClick={() => patchRow(i, { deleted: false })}
                    className="text-[11px] font-bold uppercase tracking-wider underline hover:no-underline"
                  >
                    Undo
                  </button>
                </div>
              ) : (
                <div
                  key={r.id ?? `new-${i}`}
                  className="rounded-lg border border-cream/10 bg-ink/40 p-3"
                >
                  <div className="grid gap-2 sm:grid-cols-[1fr_120px_100px]">
                    <ModalField label="Name">
                      <input
                        value={r.name}
                        onChange={(ev) =>
                          patchRow(i, { name: ev.target.value })
                        }
                        className={modalInputCls}
                      />
                    </ModalField>
                    <ModalField label="Price (£)">
                      <input
                        value={r.priceStr}
                        onChange={(ev) =>
                          patchRow(i, { priceStr: ev.target.value })
                        }
                        className={modalInputCls}
                      />
                    </ModalField>
                    <ModalField label="Capacity">
                      <input
                        value={r.capacityStr}
                        onChange={(ev) =>
                          patchRow(i, { capacityStr: ev.target.value })
                        }
                        placeholder="∞"
                        className={modalInputCls}
                      />
                    </ModalField>
                  </div>
                  <ModalField label="Description (optional)">
                    <input
                      value={r.description}
                      onChange={(ev) =>
                        patchRow(i, { description: ev.target.value })
                      }
                      className={modalInputCls}
                    />
                  </ModalField>
                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={() => patchRow(i, { deleted: true })}
                      className="text-[11px] font-bold uppercase tracking-wider text-red-400/80 hover:underline"
                    >
                      Delete this tier
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>

        {err && (
          <div className="mx-6 mb-4 rounded-lg border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
            {err}
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-cream/10 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full border border-cream/15 px-5 py-2 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-full bg-plonkTeal px-6 py-2 text-xs font-bold uppercase tracking-wider text-ink hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {/* Poster picker overlay — MediaPicker handles its own portal
          so it sits above this modal cleanly. */}
      {showEditPicker && (
        <MediaPicker
          onClose={() => setShowEditPicker(false)}
          onPick={(picked) => {
            const url = typeof picked === "string" ? picked : picked.src;
            setPosterUrl(url);
            setShowEditPicker(false);
          }}
        />
      )}
    </div>,
    document.body,
  );
}

const modalInputCls =
  "w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkTeal focus:outline-none";

function ModalField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-cream/50">
        {label}
      </span>
      {children}
    </label>
  );
}

function ModalCheck({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-cream/85">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-plonkTeal"
      />
      {label}
    </label>
  );
}

// ----------------------------------------------------------------
// Tiny presentational helpers — kept inline so the form file stays
// self-contained.
// ----------------------------------------------------------------
const inputCls =
  "w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-2.5 text-sm text-cream placeholder:text-cream/40 focus:border-plonkTeal focus:outline-none";

const labelCls =
  "mb-1.5 block text-[10px] font-bold uppercase tracking-[0.22em] text-plonkTeal";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-xs font-bold uppercase tracking-[0.28em] text-cream/55">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-cream/85">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-plonkTeal"
      />
      {label}
    </label>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-plonkTeal/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-plonkTeal">
      {label}
    </span>
  );
}

// Avoid Next.js "unused createPortal" warning even though we don't
// portal anywhere directly (MediaPicker handles its own portal).
// Kept as an import so a future change inside this file can lift
// the form into a modal without re-adding the import.
void createPortal;

// =============================================================
// SortDropdown — branded select for the events list ordering
// =============================================================
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "date-asc",     label: "Soonest first" },
  { value: "date-desc",    label: "Furthest first" },
  { value: "sold-desc",    label: "Most sold" },
  { value: "sold-asc",     label: "Least sold" },
  { value: "revenue-desc", label: "Most revenue" },
  { value: "name-asc",     label: "A → Z" },
  { value: "created-desc", label: "Recently added" },
];

type SortKey =
  | "date-asc"
  | "date-desc"
  | "sold-desc"
  | "sold-asc"
  | "revenue-desc"
  | "name-asc"
  | "created-desc";

function SortDropdown({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (v: SortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = SORT_OPTIONS.find((o) => o.value === value)!;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-full border bg-ink/40 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-cream transition ${
          open
            ? "border-plonkTeal"
            : "border-cream/15 hover:border-cream/30"
        }`}
      >
        <span className="text-cream/45">Sort:</span>
        <span>{current.label}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden
          className={`text-plonkTeal transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-plonkTeal/30 bg-ink py-1.5 text-sm shadow-2xl shadow-black/40"
        >
          {SORT_OPTIONS.map((o) => {
            const active = o.value === value;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex cursor-pointer items-center justify-between px-4 py-2.5 transition ${
                  active
                    ? "bg-plonkTeal/15 text-cream"
                    : "text-cream/85 hover:bg-cream/5 hover:text-cream"
                }`}
              >
                <span>{o.label}</span>
                {active && (
                  <span aria-hidden className="text-plonkTeal">
                    ✓
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// =============================================================
// CategoryDropdown — multi-select category filter
// =============================================================
// Empty selection = show all categories (default). Tick one or
// more to narrow both the list and the calendar grid. Closing the
// menu is via outside-click / Esc; "Clear" wipes the selection
// back to default in one tap.
const ALL_CATEGORIES: EventCategory[] = [
  "pool_tournament_doubles",
  "pool_tournament_singles",
  "pool_special",
  "dj_night",
  "food_event",
  "drink_special",
  "arcade",
  "golf",
  "world_cup",
  "other",
];

function CategoryDropdown({
  value,
  onChange,
}: {
  value: Set<EventCategory>;
  onChange: (v: Set<EventCategory>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Header label: "All categories" / "1 selected · Pool tournament — Doubles" /
  // "3 selected" depending on how many are ticked.
  const label =
    value.size === 0
      ? "All categories"
      : value.size === 1
        ? CATEGORY_LABEL[Array.from(value)[0]]
        : `${value.size} selected`;

  function toggle(cat: EventCategory) {
    const next = new Set(value);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    onChange(next);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-full border bg-ink/40 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-cream transition ${
          open
            ? "border-plonkTeal"
            : "border-cream/15 hover:border-cream/30"
        }`}
      >
        <span className="text-cream/45">Category:</span>
        <span>{label}</span>
        {value.size > 0 && (
          <span className="rounded-full bg-plonkTeal/20 px-1.5 py-0.5 text-[10px] text-plonkTeal">
            {value.size}
          </span>
        )}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden
          className={`text-plonkTeal transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-2 w-72 overflow-hidden rounded-lg border border-plonkTeal/30 bg-ink text-sm shadow-2xl shadow-black/40">
          {/* Header row with clear / select-all */}
          <div className="flex items-center justify-between border-b border-cream/10 px-4 py-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
              Filter by category
            </span>
            <div className="flex gap-2 text-[11px] font-bold uppercase tracking-wider">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(new Set());
                }}
                disabled={value.size === 0}
                className="text-plonkTeal hover:underline disabled:cursor-not-allowed disabled:opacity-30"
              >
                Clear
              </button>
              <span className="text-cream/30">·</span>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(new Set(ALL_CATEGORIES));
                }}
                disabled={value.size === ALL_CATEGORIES.length}
                className="text-plonkTeal hover:underline disabled:cursor-not-allowed disabled:opacity-30"
              >
                All
              </button>
            </div>
          </div>

          <ul role="listbox" className="max-h-72 overflow-auto py-1.5">
            {ALL_CATEGORIES.map((cat) => {
              const checked = value.has(cat);
              return (
                <li
                  key={cat}
                  role="option"
                  aria-selected={checked}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggle(cat);
                  }}
                  className={`flex cursor-pointer items-center gap-3 px-4 py-2 transition ${
                    checked
                      ? "bg-plonkTeal/10 text-cream"
                      : "text-cream/85 hover:bg-cream/5 hover:text-cream"
                  }`}
                >
                  {/* Custom checkbox so it can match the brand. */}
                  <span
                    aria-hidden
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked
                        ? "border-plonkTeal bg-plonkTeal text-ink"
                        : "border-cream/30 bg-transparent"
                    }`}
                  >
                    {checked && (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  <span className="flex-1">{CATEGORY_LABEL[cat]}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// =============================================================
// ViewToggle — list ↔ calendar pill
// =============================================================
function ViewToggle({
  value,
  onChange,
}: {
  value: "list" | "calendar";
  onChange: (v: "list" | "calendar") => void;
}) {
  const Pill = ({
    target,
    label,
  }: {
    target: "list" | "calendar";
    label: string;
  }) => {
    const active = value === target;
    return (
      <button
        type="button"
        onClick={() => onChange(target)}
        className={`rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
          active
            ? "bg-plonkTeal text-ink"
            : "text-cream/65 hover:text-cream"
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div className="flex items-center gap-1 rounded-full border border-cream/15 bg-ink/40 p-1">
      <Pill target="list" label="List" />
      <Pill target="calendar" label="Calendar" />
    </div>
  );
}

// =============================================================
// CalendarView — month grid with event chips per day
// =============================================================
function CalendarView({
  events,
  month,
  onMonthChange,
  onEventClick,
}: {
  events: DbEvent[];
  month: { year: number; month: number };
  onMonthChange: (m: { year: number; month: number }) => void;
  onEventClick: (id: string) => void;
}) {
  const { year, month: m } = month;
  const monthStart = new Date(year, m, 1);
  const monthEnd = new Date(year, m + 1, 0);
  const monthLabel = monthStart.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
  // Monday-first grid. JS getDay() returns 0=Sun, so shift.
  const firstWeekday = (monthStart.getDay() + 6) % 7;
  const daysInMonth = monthEnd.getDate();

  // Build day buckets indexed by YYYY-MM-DD.
  const eventsByDate = new Map<string, DbEvent[]>();
  for (const e of events) {
    const arr = eventsByDate.get(e.event_date) ?? [];
    arr.push(e);
    eventsByDate.set(e.event_date, arr);
  }

  const cells: ({ iso: string; day: number } | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ iso, day: d });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const todayIso = new Date().toISOString().slice(0, 10);

  function prev() {
    onMonthChange(m === 0 ? { year: year - 1, month: 11 } : { year, month: m - 1 });
  }
  function next() {
    onMonthChange(m === 11 ? { year: year + 1, month: 0 } : { year, month: m + 1 });
  }
  function jumpToday() {
    const d = new Date();
    onMonthChange({ year: d.getFullYear(), month: d.getMonth() });
  }

  // Per-category accent colours so the chips read at a glance.
  function chipClass(cat: string): string {
    if (cat.startsWith("pool"))      return "bg-plonkPink/20 text-plonkPink border-plonkPink/40";
    if (cat === "world_cup")         return "bg-plonkTeal/20 text-plonkTeal border-plonkTeal/40";
    if (cat === "dj_night")          return "bg-plonkYellow/20 text-plonkYellow border-plonkYellow/40";
    if (cat === "food_event")        return "bg-orange-400/15 text-orange-300 border-orange-400/30";
    if (cat === "drink_special")     return "bg-purple-400/15 text-purple-300 border-purple-400/30";
    return "bg-cream/10 text-cream/80 border-cream/20";
  }

  return (
    <div className="rounded-2xl border border-cream/10 bg-ink/30 p-3 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-display text-2xl text-cream">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prev}
            className="rounded-full border border-cream/15 p-2 text-cream/70 hover:border-cream/40 hover:text-cream"
            aria-label="Previous month"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={jumpToday}
            className="rounded-full border border-cream/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-cream/70 hover:border-cream/40 hover:text-cream"
          >
            Today
          </button>
          <button
            type="button"
            onClick={next}
            className="rounded-full border border-cream/15 p-2 text-cream/70 hover:border-cream/40 hover:text-cream"
            aria-label="Next month"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Weekday header (Monday-first) */}
      <div className="mb-1.5 grid grid-cols-7 gap-1 px-1 text-[10px] font-bold uppercase tracking-widest text-cream/35">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="text-center">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) =>
          c === null ? (
            <div key={`pad-${i}`} className="h-24 rounded-lg bg-ink/20" />
          ) : (
            <div
              key={c.iso}
              className={`h-24 rounded-lg border p-1.5 ${
                c.iso === todayIso
                  ? "border-plonkPink/60 bg-plonkPink/5"
                  : "border-cream/10 bg-ink/40"
              }`}
            >
              <div
                className={`text-[10px] font-bold ${
                  c.iso === todayIso ? "text-plonkPink" : "text-cream/45"
                }`}
              >
                {c.day}
              </div>
              <div className="mt-1 space-y-1 overflow-hidden">
                {(eventsByDate.get(c.iso) ?? []).slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onEventClick(ev.id)}
                    title={`${ev.name}${ev.start_time ? ` · ${ev.start_time.slice(0, 5)}` : ""}`}
                    className={`block w-full truncate rounded border px-1.5 py-0.5 text-left text-[10px] font-bold uppercase tracking-wide ${chipClass(
                      ev.category,
                    )}`}
                  >
                    {ev.start_time ? `${ev.start_time.slice(0, 5)} ` : ""}
                    {ev.name}
                  </button>
                ))}
                {(eventsByDate.get(c.iso) ?? []).length > 3 && (
                  <div className="text-[9px] text-cream/45">
                    +{(eventsByDate.get(c.iso) ?? []).length - 3} more
                  </div>
                )}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
