"use client";

import { useEffect, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { DAY_LABELS } from "@/lib/format";
import { loadVenues, type DbVenue } from "@/lib/db/tickets";
import {
  loadOpeningHours,
  upsertOpeningHour,
  type DbOpeningHour,
} from "@/lib/db/hours";

// Display order: Mon, Tue, …, Sun (more natural for a UK schedule than
// the Postgres 0=Sun convention).
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function describe(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
}

function t(s: string) {
  return s.slice(0, 5); // "HH:MM:SS" -> "HH:MM"
}

export default function HoursClient() {
  const [venues, setVenues] = useState<DbVenue[]>([]);
  const [hours, setHours] = useState<DbOpeningHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<DbVenue | null>(null);

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      const [v, h] = await Promise.all([loadVenues(), loadOpeningHours()]);
      setVenues(v);
      setHours(h);
    } catch (e) {
      setErr(describe(e, "Failed to load hours"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  function venueHours(venueId: string): DbOpeningHour[] {
    return DISPLAY_ORDER.map(
      (day) =>
        hours.find((h) => h.venue_id === venueId && h.day_of_week === day) ?? {
          venue_id: venueId,
          day_of_week: day,
          open_time: "17:00:00",
          close_time: "22:00:00",
          closed: true,
        },
    );
  }

  return (
    <>
      <AdminPageHeader
        title="Opening Hours"
        description="Per venue, per day of week. The booking page only shows slots within these hours."
      />

      {err && (
        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-cream/60">Loading…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {venues.map((venue) => (
            <AdminCard
              key={venue.id}
              title={venue.name}
              action={
                <button
                  onClick={() => setEditing(venue)}
                  className="text-xs font-semibold uppercase tracking-wider text-plonkYellow hover:underline"
                >
                  Edit
                </button>
              }
            >
              <table className="w-full text-sm">
                <tbody>
                  {venueHours(venue.id).map((h) => (
                    <tr
                      key={h.day_of_week}
                      className="border-b border-cream/5 last:border-b-0"
                    >
                      <td className="px-5 py-2.5 text-xs uppercase tracking-widest text-cream/55">
                        {DAY_LABELS[h.day_of_week]}
                      </td>
                      <td className="px-5 py-2.5 font-medium">
                        {h.closed ? (
                          <span className="text-cream/40">Closed</span>
                        ) : (
                          `${t(h.open_time)} – ${t(h.close_time)}`
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminCard>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-cream/50">
        Holidays and one-off closures are handled separately on the{" "}
        <a href="/admin/closed" className="underline">
          Closed Dates
        </a>{" "}
        page.
      </p>

      {editing && (
        <EditHoursModal
          venue={editing}
          rows={venueHours(editing.id)}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}
    </>
  );
}

function EditHoursModal({
  venue,
  rows,
  onCancel,
  onSaved,
}: {
  venue: DbVenue;
  rows: DbOpeningHour[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<DbOpeningHour[]>(rows);
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState("");

  function patch(day: number, p: Partial<DbOpeningHour>) {
    setDraft((d) =>
      d.map((r) => (r.day_of_week === day ? { ...r, ...p } : r)),
    );
  }

  async function save() {
    setBusy(true);
    setLocalErr("");
    try {
      for (const row of draft) {
        // Normalise to HH:MM:SS for Postgres `time` type.
        const open =
          row.open_time.length === 5 ? row.open_time + ":00" : row.open_time;
        const close =
          row.close_time.length === 5 ? row.close_time + ":00" : row.close_time;
        await upsertOpeningHour({ ...row, open_time: open, close_time: close });
      }
      onSaved();
    } catch (e) {
      setLocalErr(describe(e, "Save failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 p-3 sm:items-center sm:p-6"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-cream/15 bg-ink p-6 shadow-2xl"
      >
        <h3 className="font-display text-2xl">{venue.name} — opening hours</h3>
        <div className="mt-4 space-y-2">
          {draft.map((row) => (
            <div
              key={row.day_of_week}
              className="grid grid-cols-12 items-center gap-2 rounded-lg border border-cream/10 bg-ink/30 px-3 py-2 text-sm"
            >
              <span className="col-span-2 text-xs uppercase tracking-widest text-cream/55">
                {DAY_LABELS[row.day_of_week]}
              </span>
              <label className="col-span-3 flex items-center gap-1.5 text-xs text-cream/70">
                <input
                  type="checkbox"
                  checked={row.closed}
                  onChange={(e) => patch(row.day_of_week, { closed: e.target.checked })}
                  className="h-3.5 w-3.5"
                />
                Closed
              </label>
              <input
                type="time"
                value={row.open_time.slice(0, 5)}
                disabled={row.closed}
                onChange={(e) => patch(row.day_of_week, { open_time: e.target.value })}
                className="col-span-3 rounded border border-cream/15 bg-ink/40 px-2 py-1 text-xs text-cream disabled:opacity-30"
              />
              <input
                type="time"
                value={row.close_time.slice(0, 5)}
                disabled={row.closed}
                onChange={(e) => patch(row.day_of_week, { close_time: e.target.value })}
                className="col-span-3 rounded border border-cream/15 bg-ink/40 px-2 py-1 text-xs text-cream disabled:opacity-30"
              />
              <span className="col-span-1" />
            </div>
          ))}
        </div>
        {localErr && (
          <p className="mt-3 rounded-lg border border-red-400/30 bg-red-400/5 px-3 py-2 text-sm text-red-300">
            {localErr}
          </p>
        )}
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
