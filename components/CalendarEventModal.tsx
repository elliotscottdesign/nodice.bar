"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import MediaPicker from "@/components/admin/MediaPicker";
import DatePickerInput from "@/components/admin/DatePickerInput";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  type DbCalendarEvent,
  type NewCalendarEvent,
} from "@/lib/db/calendarEvents";
import type { ImageDisplay } from "@/lib/content";

// CalendarEventModal — full-screen create/edit form for one event,
// mountable on any page (used by the public /events calendar so
// the founder can edit straight from view mode without going to
// /admin/calendar-events).
//
// Two modes:
//   • event = null  → "Add event" form, prefilled with defaultDate
//   • event = row   → "Edit event" form, with Delete button
//
// onSaved fires after a successful save OR delete so the parent
// can refresh its data and close the modal.

export type CalendarEventModalProps = {
  event: DbCalendarEvent | null;
  defaultDate?: string;     // YYYY-MM-DD — used when event is null
  onClose: () => void;
  onSaved: () => void;
};

type Draft = {
  event_date: string;
  start_time: string;     // "" = no time set
  title: string;
  body: string;
  image_url: string;
  link_url: string;
  active: boolean;
};

function draftFromEvent(
  ev: DbCalendarEvent | null,
  defaultDate?: string,
): Draft {
  if (!ev) {
    return {
      event_date: defaultDate ?? "",
      start_time: "",
      title: "",
      body: "",
      image_url: "",
      link_url: "",
      active: true,
    };
  }
  // DB returns time as "HH:MM:SS"; <input type="time"> expects "HH:MM".
  // Trim seconds so the field round-trips cleanly.
  return {
    event_date: ev.event_date,
    start_time: ev.start_time ? ev.start_time.slice(0, 5) : "",
    title: ev.title,
    body: ev.body ?? "",
    image_url: ev.image_url,
    link_url: ev.link_url ?? "",
    active: ev.active,
  };
}

function describe(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  return fallback;
}

export default function CalendarEventModal({
  event,
  defaultDate,
  onClose,
  onSaved,
}: CalendarEventModalProps) {
  const [draft, setDraft] = useState<Draft>(() =>
    draftFromEvent(event, defaultDate),
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Lock body scroll while the modal is open. Cleaning up on
  // unmount restores the previous overflow value.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

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
      // Empty time field = null in DB ("no time set"). Anything else
      // round-trips as HH:MM, which Postgres' time type accepts.
      start_time: draft.start_time ? draft.start_time : null,
      title: draft.title.trim(),
      body: draft.body.trim() || null,
      image_url: draft.image_url,
      link_url: draft.link_url.trim() || null,
      active: draft.active,
    };
    try {
      if (event) {
        await updateCalendarEvent(event.id, payload);
      } else {
        await createCalendarEvent(payload);
      }
      onSaved();
    } catch (e) {
      setErr(describe(e, "Failed to save event"));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!event) return;
    if (!confirm("Delete this event? This can't be undone.")) return;
    setDeleting(true);
    setErr("");
    try {
      await deleteCalendarEvent(event.id);
      onSaved();
    } catch (e) {
      setErr(describe(e, "Failed to delete event"));
      setDeleting(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      // Backdrop-click closes the modal, but ONLY when the click
      // target is the backdrop itself. Without this guard, clicks
      // on descendants (including the MediaPicker's thumbnails — it
      // portals to body but its React events still bubble up to this
      // node) tore the modal down mid-pick, so the chosen image never
      // landed in the form. Same guard the MediaPicker uses on its own
      // backdrop.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-cream/15 bg-ink shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-cream/10 bg-ink px-5 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
              {event ? "Edit event" : "Add event"}
            </p>
            <p className="mt-0.5 text-xs text-cream/55">
              Saves to the calendar at /events.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-cream/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            Close
          </button>
        </header>

        <form onSubmit={save} className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Date">
            <DatePickerInput
              value={draft.event_date}
              onChange={(iso) => setDraft({ ...draft, event_date: iso })}
              placeholder="Pick a date"
            />
          </Field>

          <Field label="Start time (optional)">
            <input
              type="time"
              value={draft.start_time}
              onChange={(e) =>
                setDraft({ ...draft, start_time: e.target.value })
              }
              className={inputClass}
            />
          </Field>

          <Field label="Active" className="sm:col-span-2">
            <label className="flex items-center gap-2 py-2 text-sm text-cream/85">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) =>
                  setDraft({ ...draft, active: e.target.checked })
                }
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

          {err && (
            <div className="rounded-lg border border-plonkPink/40 bg-plonkPink/10 px-4 py-3 text-sm text-plonkPink sm:col-span-2">
              {err}
            </div>
          )}

          <div className="flex flex-wrap justify-between gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={saving || deleting}
              className="rounded-full bg-plonkPink px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : event ? "Save changes" : "Add event"}
            </button>
            {event && (
              <button
                type="button"
                onClick={remove}
                disabled={saving || deleting}
                className="rounded-full border border-plonkPink/40 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-plonkPink hover:bg-plonkPink/10 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete event"}
              </button>
            )}
          </div>
        </form>
      </div>

      {pickerOpen && (
        <MediaPicker
          aspect="4/5"
          onPick={(picked: string | ImageDisplay) => {
            const url = typeof picked === "string" ? picked : picked.src;
            setDraft((d) => ({ ...d, image_url: url }));
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>,
    document.body,
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
