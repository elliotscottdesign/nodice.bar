"use client";

import { useEffect, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { loadVenues, type DbVenue } from "@/lib/db/tickets";
import {
  loadSlotOverrides,
  createSlotOverride,
  deleteSlotOverride,
  type DbSlotOverride,
} from "@/lib/db/slots";

function describe(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
}

export default function SlotsClient() {
  const [venues, setVenues] = useState<DbVenue[]>([]);
  const [rows, setRows] = useState<DbSlotOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      const [v, s] = await Promise.all([loadVenues(), loadSlotOverrides()]);
      setVenues(v);
      setRows(s);
    } catch (e) {
      setErr(describe(e, "Failed to load overrides"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  async function handleDelete(s: DbSlotOverride) {
    if (!confirm(`Remove override on ${s.date}?`)) return;
    setBusy(true);
    try {
      await deleteSlotOverride(s.id);
      await reload();
    } catch (e) {
      setErr(describe(e, "Delete failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Slot Capacity"
        description='Default is 6 tickets every 10 minutes per venue. Override that here for specific dates / hours — busier days, maintenance windows, etc.'
        action={
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-full bg-plonkPink px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90"
          >
            + Add override
          </button>
        }
      />

      {err && (
        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Setting label="Default capacity per slot" value="6 tickets" />
        <Setting label="Slot length" value="10 minutes" />
      </div>

      {loading ? (
        <p className="text-sm text-cream/60">Loading…</p>
      ) : (
        <AdminCard title="Overrides">
          {rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-cream/55">
              No overrides yet — every slot uses the default 6 tickets.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cream/10 text-left text-xs uppercase tracking-widest text-cream/50">
                    <th className="px-5 py-3 font-bold">Date</th>
                    <th className="px-5 py-3 font-bold">Venue</th>
                    <th className="px-5 py-3 font-bold">Window</th>
                    <th className="px-5 py-3 font-bold">Capacity</th>
                    <th className="px-5 py-3 font-bold">Reason</th>
                    <th className="px-5 py-3 text-right font-bold"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const venueName =
                      venues.find((v) => v.id === s.venue_id)?.name ?? "—";
                    const d = new Date(s.date + "T12:00:00");
                    return (
                      <tr
                        key={s.id}
                        className="border-b border-cream/5 last:border-b-0"
                      >
                        <td className="px-5 py-3 font-medium">
                          {d.toLocaleDateString("en-GB", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </td>
                        <td className="px-5 py-3 text-cream/65">{venueName}</td>
                        <td className="px-5 py-3 text-cream/80">
                          {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                        </td>
                        <td className="px-5 py-3 font-medium">{s.capacity} / 10 min</td>
                        <td className="px-5 py-3 text-cream/65">{s.reason ?? "—"}</td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => handleDelete(s)}
                            disabled={busy}
                            className="text-xs font-semibold uppercase tracking-wider text-red-400/80 hover:underline"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>
      )}

      {showAdd && (
        <AddOverrideModal
          venues={venues}
          onCancel={() => setShowAdd(false)}
          onSaved={async () => {
            setShowAdd(false);
            await reload();
          }}
          onError={setErr}
        />
      )}
    </>
  );
}

function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-cream/10 bg-ink/40 px-5 py-4">
      <p className="text-xs font-bold uppercase tracking-widest text-plonkYellow">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
    </div>
  );
}

function AddOverrideModal({
  venues,
  onCancel,
  onSaved,
  onError,
}: {
  venues: DbVenue[];
  onCancel: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [venueId, setVenueId] = useState(venues[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("22:00");
  const [capacityStr, setCapacityStr] = useState("6");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState("");

  async function save() {
    setLocalErr("");
    const cap = parseInt(capacityStr, 10);
    if (!Number.isFinite(cap) || cap < 0) {
      setLocalErr("Capacity must be a positive whole number.");
      return;
    }
    if (!venueId) {
      setLocalErr("Pick a venue.");
      return;
    }
    if (endTime <= startTime) {
      setLocalErr("End time must be after start time.");
      return;
    }
    setBusy(true);
    try {
      await createSlotOverride({
        venue_id: venueId,
        date,
        start_time: startTime + ":00",
        end_time: endTime + ":00",
        capacity: cap,
        reason: reason || null,
      });
      onSaved();
    } catch (e) {
      const m = describe(e, "Save failed");
      setLocalErr(m);
      onError(m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 p-3 sm:items-center sm:p-6"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-cream/15 bg-ink p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-2xl">New slot override</h3>
        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">Venue</span>
            <select
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
              className="mt-1.5 w-full appearance-none rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
            >
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
                Start time
              </span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-cream/55">End time</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
              Capacity per 10-min slot
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={capacityStr}
              onChange={(e) => setCapacityStr(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
              Reason (optional)
            </span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
            />
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
            {busy ? "Saving…" : "Add override"}
          </button>
        </div>
      </div>
    </div>
  );
}
