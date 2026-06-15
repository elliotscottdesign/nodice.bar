"use client";

import { useEffect, useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import MediaPicker from "@/components/admin/MediaPicker";
import {
  loadAllCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  EVENT_TYPES,
  type DbCalendarEvent,
  type NewCalendarEvent,
} from "@/lib/db/calendarEvents";
import { loadDjNightsInRange, setDjNightCategory, isDjEvent } from "@/lib/db/djNights";
import type { ImageDisplay } from "@/lib/content";

// Admin CRUD for calendar_events. List-style for shipping speed —
// calendar-grid admin can layer on top later. Each event has a date,
// title, optional body, artwork (4:5 picked from MediaPicker), and
// an optional link.

type DraftState = {
  id: string | null;          // null = creating
  event_date: string;
  start_time: string;          // "" = no time set
  title: string;
  body: string;
  image_url: string;
  link_url: string;
  active: boolean;
  subcategory: string;         // event type
};

const EMPTY_DRAFT: DraftState = {
  id: null,
  event_date: "",
  start_time: "",
  title: "",
  body: "",
  image_url: "",
  link_url: "",
  active: true,
  subcategory: "Special Event",
};

function describe(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  return fallback;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function monthLabel(iso: string): string {
  // "2026-06-15" -> "Jun 2026"
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function CalendarEventsAdminClient() {
  const [rows, setRows] = useState<DbCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState<DraftState>({
    ...EMPTY_DRAFT,
    event_date: todayIso(),
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      // Manually-authored events + the auto-fed confirmed DJ nights, merged by date.
      const [cal, dj] = await Promise.all([
        loadAllCalendarEvents(),
        loadDjNightsInRange("1970-01-01", "2999-12-31"),
      ]);
      setRows(
        [...cal, ...dj].sort((a, b) => a.event_date.localeCompare(b.event_date)),
      );
    } catch (e) {
      setErr(describe(e, "Failed to load events"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  function resetDraft() {
    setDraft({ ...EMPTY_DRAFT, event_date: todayIso() });
  }

  function startEdit(ev: DbCalendarEvent) {
    setDraft({
      id: ev.id,
      event_date: ev.event_date,
      // DB time is HH:MM:SS; <input type="time"> wants HH:MM.
      start_time: ev.start_time ? ev.start_time.slice(0, 5) : "",
      title: ev.title,
      body: ev.body ?? "",
      image_url: ev.image_url,
      link_url: ev.link_url ?? "",
      active: ev.active,
      subcategory: ev.subcategory ?? "Special Event",
    });
    // Scroll to top so the form is visible.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim()) {
      setErr("Title is required");
      return;
    }
    if (!draft.event_date) {
      setErr("Date is required");
      return;
    }
    setSaving(true);
    setErr("");

    const payload: NewCalendarEvent = {
      event_date: draft.event_date,
      start_time: draft.start_time || null,
      title: draft.title.trim(),
      body: draft.body.trim() || null,
      image_url: draft.image_url,
      link_url: draft.link_url.trim() || null,
      active: draft.active,
      subcategory: draft.subcategory,
    };

    try {
      if (draft.id) {
        await updateCalendarEvent(draft.id, payload);
      } else {
        await createCalendarEvent(payload);
      }
      resetDraft();
      await reload();
    } catch (e) {
      setErr(describe(e, "Failed to save event"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this event? This can't be undone.")) return;
    try {
      await deleteCalendarEvent(id);
      await reload();
    } catch (e) {
      setErr(describe(e, "Failed to delete event"));
    }
  }

  // DJ nights are owned by the DJ system — only their public CATEGORY is
  // editable here (saved as an override). Optimistic, with rollback on error.
  async function setDjCategory(ev: DbCalendarEvent, value: string) {
    const prev = ev.subcategory;
    setRows((rs) => rs.map((r) => (r.id === ev.id ? { ...r, subcategory: value } : r)));
    try {
      await setDjNightCategory(ev.id, value);
    } catch (e) {
      setErr(describe(e, "Failed to set category"));
      setRows((rs) => rs.map((r) => (r.id === ev.id ? { ...r, subcategory: prev } : r)));
    }
  }

  // Group rows by month for a cleaner list.
  const groups: { label: string; events: DbCalendarEvent[] }[] = [];
  for (const ev of rows) {
    const label = monthLabel(ev.event_date);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.events.push(ev);
    else groups.push({ label, events: [ev] });
  }

  return (
    <div className="space-y-8">
      {err && (
        <div className="rounded-lg border border-plonkPink/40 bg-plonkPink/10 px-4 py-3 text-sm text-plonkPink">
          {err}
        </div>
      )}

      {/* ───── Add / edit form ───── */}
      <AdminCard title={draft.id ? "Edit event" : "Add new event"}>
        <form onSubmit={save} className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Type" className="sm:col-span-2">
            <select
              value={draft.subcategory}
              onChange={(e) => setDraft({ ...draft, subcategory: e.target.value })}
              className={inputClass}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Date">
            <input
              type="date"
              required
              value={draft.event_date}
              onChange={(e) => setDraft({ ...draft, event_date: e.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Start time (optional)">
            <input
              type="time"
              value={draft.start_time}
              onChange={(e) => setDraft({ ...draft, start_time: e.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Active" className="sm:col-span-2">
            <label className="flex items-center gap-2 py-2 text-sm text-cream/85">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
              />
              Show on the public calendar
            </label>
          </Field>

          <Field label="Title" className="sm:col-span-2">
            <input
              type="text"
              required
              placeholder="e.g. Rolling Bones — Pool Tournament"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Body (optional)" className="sm:col-span-2">
            <textarea
              rows={3}
              placeholder="A short description shown under the title."
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Link (optional)" className="sm:col-span-2">
            <input
              type="url"
              placeholder="https://… (RSVP, tickets, more info)"
              value={draft.link_url}
              onChange={(e) => setDraft({ ...draft, link_url: e.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Artwork (4:5)" className="sm:col-span-2">
            <div className="flex items-center gap-4">
              <div className="relative h-32 w-[6.4rem] overflow-hidden rounded-md border border-cream/15 bg-ink/40">
                {draft.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={draft.image_url}
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
                  onClick={() => setPickerOpen(true)}
                  className="rounded-full bg-plonkPink px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90"
                >
                  {draft.image_url ? "Change artwork" : "Pick / upload artwork"}
                </button>
                {draft.image_url && (
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, image_url: "" })}
                    className="rounded-full border border-cream/15 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-cream/75 hover:bg-cream/5"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </Field>

          <div className="flex gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-plonkPink px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : draft.id ? "Save changes" : "Add event"}
            </button>
            {draft.id && (
              <button
                type="button"
                onClick={resetDraft}
                className="rounded-full border border-cream/15 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-cream/75 hover:bg-cream/5"
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </AdminCard>

      {/* ───── Existing events, grouped by month ───── */}
      {loading ? (
        <AdminCard>
          <p className="px-5 py-6 text-sm text-cream/55">Loading…</p>
        </AdminCard>
      ) : rows.length === 0 ? (
        <AdminCard>
          <p className="px-5 py-6 text-sm text-cream/55">
            No events yet. Add one above.
          </p>
        </AdminCard>
      ) : (
        groups.map((g) => (
          <section key={g.label}>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-plonkYellow">
              {g.label}
            </h2>
            <div className="space-y-2">
              {g.events.map((ev) => (
                <article
                  key={ev.id}
                  className="flex items-start gap-4 rounded-xl border border-cream/10 bg-ink/40 p-4"
                >
                  <div className="relative h-24 w-[4.8rem] shrink-0 overflow-hidden rounded-md bg-ink">
                    {ev.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ev.image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-widest text-cream/40">
                        no art
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cream/55">
                      {formatDate(ev.event_date)}
                      {ev.subcategory && (
                        <span className="ml-2 rounded-full bg-cream/10 px-2 py-0.5 text-[9px] normal-case tracking-normal text-cream/70">
                          {ev.subcategory}
                        </span>
                      )}
                      {!ev.active && (
                        <span className="ml-2 rounded-full bg-cream/10 px-2 py-0.5 text-[9px] text-cream/55">
                          Hidden
                        </span>
                      )}
                    </p>
                    <p className="mt-1 truncate text-sm font-bold text-cream">
                      {ev.title}
                    </p>
                    {ev.body && (
                      <p className="mt-1 line-clamp-2 text-xs text-cream/65">
                        {ev.body}
                      </p>
                    )}
                    {ev.link_url && (
                      <a
                        href={ev.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block truncate text-[11px] text-plonkPink underline-offset-2 hover:underline"
                      >
                        {ev.link_url}
                      </a>
                    )}
                  </div>
                  {isDjEvent(ev) ? (
                    <div className="flex w-36 shrink-0 flex-col gap-1.5">
                      <span className="rounded-full bg-plonkPink/90 px-2 py-0.5 text-center text-[9px] font-bold uppercase tracking-wider text-white">
                        DJ Feed
                      </span>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-cream/45">
                        Category
                      </label>
                      <select
                        value={ev.subcategory ?? "DJ Night"}
                        onChange={(e) => setDjCategory(ev, e.target.value)}
                        className="rounded-lg border border-cream/15 bg-ink/40 px-2 py-1.5 text-xs text-cream focus:border-plonkPink focus:outline-none"
                      >
                        {EVENT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <span className="text-center text-[9px] text-cream/40">
                        managed in DJ Bookings
                      </span>
                    </div>
                  ) : (
                    <div className="flex shrink-0 flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(ev)}
                        className="rounded-full border border-cream/15 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(ev.id)}
                        className="rounded-full border border-cream/15 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-cream/55 hover:bg-cream/5"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))
      )}

      {/* ───── MediaPicker modal ───── */}
      {pickerOpen && (
        <MediaPicker
          aspect="4/5"
          onPick={(picked: string | ImageDisplay) => {
            // MediaPicker returns a plain URL string for simple picks
            // or an ImageDisplay object when crop/zoom is involved.
            // Calendar artwork doesn't need crop metadata — just take
            // the src out either way.
            const url = typeof picked === "string" ? picked : picked.src;
            setDraft({ ...draft, image_url: url });
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-2.5 text-sm text-cream focus:border-plonkPink focus:outline-none";

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.22em] text-cream/55">
        {label}
      </label>
      {children}
    </div>
  );
}
