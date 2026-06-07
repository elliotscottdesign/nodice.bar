"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import MediaPicker from "@/components/admin/MediaPicker";
import DatePickerInput from "@/components/admin/DatePickerInput";
import {
  loadAllEvents,
  loadAllTicketTypes,
  createEvent,
  createTicketType,
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

  // ----- Form state -----
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [externalLink, setExternalLink] = useState("");
  const [posterUrl, setPosterUrl] = useState<string>("");
  const [showPicker, setShowPicker] = useState(false);
  const [category, setCategory] = useState<EventCategory>("dj_night");
  const [eventDate, setEventDate] = useState<string>(todayIso());
  const [startTime, setStartTime] = useState<string>("19:00");
  const [endTime, setEndTime] = useState<string>("");
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("none");
  const [occurrences, setOccurrences] = useState<number>(8);
  const [showOnPool, setShowOnPool] = useState(false);
  const [showOnCalendar, setShowOnCalendar] = useState(true);
  const [showOnBar, setShowOnBar] = useState(false);
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
    setEventDate(todayIso());
    setStartTime("19:00");
    setEndTime("");
    setRecurrenceType("none");
    setOccurrences(8);
    setShowOnPool(false);
    setShowOnCalendar(true);
    setShowOnBar(false);
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
              </div>
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
            <ul className="space-y-2">
              {events.map((e) => {
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
    </div>
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
