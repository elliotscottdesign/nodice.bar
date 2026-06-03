"use client";

import { useEffect, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import ContentEditor from "@/components/admin/ContentEditor";
import {
  loadEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  groupEvents,
  type DbSiteEvent,
} from "@/lib/db/events";

type Draft = Omit<DbSiteEvent, "id">;
type Modal =
  | { mode: "create"; draft: Draft }
  | { mode: "edit"; id: string; draft: Draft }
  | null;

function describe(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
}

export default function EventsAdminClient() {
  const [rows, setRows] = useState<DbSiteEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<Modal>(null);

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      setRows(await loadEvents());
    } catch (e) {
      setErr(describe(e, "Failed to load events"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  async function handleSave(draft: Draft) {
    setBusy(true);
    setErr("");
    try {
      if (modal?.mode === "create") await createEvent(draft);
      else if (modal?.mode === "edit") await updateEvent(modal.id, draft);
      setModal(null);
      await reload();
    } catch (e) {
      setErr(describe(e, "Save failed"));
    } finally {
      setBusy(false);
    }
  }
  async function handleDelete(r: DbSiteEvent) {
    if (!confirm(`Delete event "${r.title}"?`)) return;
    setBusy(true);
    try {
      await deleteEvent(r.id);
      await reload();
    } catch (e) {
      setErr(describe(e, "Delete failed"));
    } finally {
      setBusy(false);
    }
  }
  async function handleToggleActive(r: DbSiteEvent) {
    setBusy(true);
    try {
      await updateEvent(r.id, { active: !r.active });
      await reload();
    } catch (e) {
      setErr(describe(e, "Toggle failed"));
    } finally {
      setBusy(false);
    }
  }

  function openCreate(prefillVenue = "", prefillVenueOrder = 1) {
    setModal({
      mode: "create",
      draft: {
        venue: prefillVenue,
        day: "",
        title: "",
        body: "",
        featured: false,
        venue_order: prefillVenueOrder,
        event_order:
          (rows.filter((r) => r.venue === prefillVenue).length || 0) + 1,
        active: true,
      },
    });
  }
  function openEdit(r: DbSiteEvent) {
    setModal({
      mode: "edit",
      id: r.id,
      draft: {
        venue: r.venue,
        day: r.day,
        title: r.title,
        body: r.body,
        featured: r.featured,
        venue_order: r.venue_order,
        event_order: r.event_order,
        active: r.active,
      },
    });
  }

  const grouped = groupEvents(rows);
  const knownVenues = grouped.map((g) => g.venue);

  return (
    <>
      <AdminPageHeader
        title="Events"
        description="What's on at each venue. Grouped into columns on /events. Toggle 'Featured' to highlight an event as a headline (gets the pink frame)."
        action={
          <div className="flex gap-2">
            <a
              href="/events"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
            >
              View page ↗
            </a>
            <button
              onClick={() => openCreate()}
              className="rounded-full bg-plonkPink px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90"
            >
              + New event
            </button>
          </div>
        }
      />

      {/* Hero / footer note copy editing — uses the generic ContentEditor */}
      <div className="mb-8">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-plonkYellow">
          Page hero + footer copy
        </h2>
        <ContentEditor page="info.events" />
      </div>

      <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-plonkYellow">
        Events list
      </h2>

      {err && (
        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-cream/60">Loading…</p>
      ) : grouped.length === 0 ? (
        <AdminCard>
          <p className="px-5 py-10 text-center text-sm text-cream/55">
            No events yet — click "+ New event".
          </p>
        </AdminCard>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <AdminCard
              key={g.venue}
              title={g.venue}
              action={
                <button
                  onClick={() => openCreate(g.venue, g.venue_order)}
                  className="text-xs font-semibold uppercase tracking-wider text-plonkYellow hover:underline"
                >
                  + Add to this venue
                </button>
              }
            >
              <ul className="divide-y divide-cream/5">
                {g.items.map((r) => (
                  <li
                    key={r.id}
                    className="grid grid-cols-12 items-start gap-3 px-5 py-3 text-sm"
                  >
                    <div className="col-span-7">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="font-medium text-cream">{r.title}</p>
                        {r.featured && (
                          <span className="rounded-full bg-plonkPink/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-plonkPink">
                            Featured
                          </span>
                        )}
                      </div>
                      <p className="text-xs uppercase tracking-wider text-cream/55">
                        {r.day}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-cream/55">
                        {r.body}
                      </p>
                    </div>
                    <div className="col-span-2 text-xs text-cream/50">
                      Order: {r.event_order}
                    </div>
                    <div className="col-span-3 flex items-center justify-end gap-3">
                      <button
                        onClick={() => handleToggleActive(r)}
                        disabled={busy}
                        className="text-xs font-semibold uppercase tracking-wider text-cream/70 hover:text-cream"
                      >
                        {r.active ? "Visible" : "Hidden"}
                      </button>
                      <button
                        onClick={() => openEdit(r)}
                        disabled={busy}
                        className="text-xs font-semibold uppercase tracking-wider text-plonkYellow hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(r)}
                        disabled={busy}
                        className="text-xs font-semibold uppercase tracking-wider text-red-400/80 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </AdminCard>
          ))}
        </div>
      )}

      {modal && (
        <EventModal
          title={modal.mode === "create" ? "New event" : "Edit event"}
          initial={modal.draft}
          knownVenues={knownVenues}
          onCancel={() => setModal(null)}
          onSave={handleSave}
          busy={busy}
        />
      )}
    </>
  );
}

function EventModal({
  title,
  initial,
  knownVenues,
  onCancel,
  onSave,
  busy,
}: {
  title: string;
  initial: Draft;
  knownVenues: string[];
  onCancel: () => void;
  onSave: (d: Draft) => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [vOrderStr, setVOrderStr] = useState(String(initial.venue_order));
  const [eOrderStr, setEOrderStr] = useState(String(initial.event_order));
  const [localErr, setLocalErr] = useState("");

  function save() {
    setLocalErr("");
    if (!draft.venue.trim()) {
      setLocalErr("Venue name is required.");
      return;
    }
    if (!draft.day.trim()) {
      setLocalErr("Day is required.");
      return;
    }
    if (!draft.title.trim()) {
      setLocalErr("Title is required.");
      return;
    }
    if (!draft.body.trim()) {
      setLocalErr("Body is required.");
      return;
    }
    const v = parseInt(vOrderStr, 10);
    const e = parseInt(eOrderStr, 10);
    if (!Number.isFinite(v) || !Number.isFinite(e)) {
      setLocalErr("Order values must be whole numbers.");
      return;
    }
    onSave({
      ...draft,
      venue: draft.venue.trim(),
      day: draft.day.trim(),
      title: draft.title.trim(),
      body: draft.body.trim(),
      venue_order: v,
      event_order: e,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 p-3 sm:items-center sm:p-6">
      <div className="w-full max-w-xl rounded-2xl border border-cream/15 bg-ink p-6 shadow-2xl">
        <h3 className="font-display text-2xl">{title}</h3>
        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
              Venue (column heading)
            </span>
            <input
              type="text"
              list="venue-names"
              value={draft.venue}
              onChange={(e) => setDraft({ ...draft, venue: e.target.value })}
              placeholder="Plonk Hackney at No Dice Bar"
              className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:border-plonkPink focus:outline-none"
            />
            <datalist id="venue-names">
              {knownVenues.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
              Day / frequency
            </span>
            <input
              type="text"
              value={draft.day}
              onChange={(e) => setDraft({ ...draft, day: e.target.value })}
              placeholder="Every Saturday"
              className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:border-plonkPink focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
              Title
            </span>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
              Body / description
            </span>
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              rows={4}
              className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
                Venue order
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={vOrderStr}
                onChange={(e) => setVOrderStr(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
                Order in venue
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={eOrderStr}
                onChange={(e) => setEOrderStr(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-cream/80">
            <input
              type="checkbox"
              checked={draft.featured}
              onChange={(e) => setDraft({ ...draft, featured: e.target.checked })}
            />
            Featured (pink frame, "Headline event" badge)
          </label>
          <label className="flex items-center gap-2 text-sm text-cream/80">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            Visible on the public site
          </label>
          {localErr && (
            <p className="rounded-lg border border-red-400/30 bg-red-400/5 px-3 py-2 text-sm text-red-300">
              {localErr}
            </p>
          )}
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-cream/20 px-5 py-2 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-full bg-plonkPink px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90 disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
