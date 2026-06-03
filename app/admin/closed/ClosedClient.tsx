"use client";

import { useEffect, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { loadVenues, type DbVenue } from "@/lib/db/tickets";
import {
  loadClosedDates,
  createClosedDate,
  deleteClosedDate,
  type DbClosedDate,
} from "@/lib/db/closed";

function describe(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
}

export default function ClosedClient() {
  const [venues, setVenues] = useState<DbVenue[]>([]);
  const [rows, setRows] = useState<DbClosedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      const [v, c] = await Promise.all([loadVenues(), loadClosedDates()]);
      setVenues(v);
      setRows(c);
    } catch (e) {
      setErr(describe(e, "Failed to load closed dates"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  async function handleDelete(c: DbClosedDate) {
    if (!confirm(`Unblock ${c.date}?`)) return;
    setBusy(true);
    try {
      await deleteClosedDate(c.id);
      await reload();
    } catch (e) {
      setErr(describe(e, "Unblock failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Closed Dates"
        description="Days a venue is closed entirely (private hire, holidays, maintenance). These disappear from the public booking page."
        action={
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-full bg-plonkPink px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90"
          >
            + Block a date
          </button>
        }
      />

      {err && (
        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-cream/60">Loading…</p>
      ) : (
        <AdminCard>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream/10 text-left text-xs uppercase tracking-widest text-cream/50">
                  <th className="px-5 py-3 font-bold">Date</th>
                  <th className="px-5 py-3 font-bold">Venue</th>
                  <th className="px-5 py-3 font-bold">Reason</th>
                  <th className="px-5 py-3 text-right font-bold"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-sm text-cream/55">
                      No closures scheduled.
                    </td>
                  </tr>
                )}
                {rows.map((c) => {
                  const where =
                    c.venue_id == null
                      ? "Both venues"
                      : venues.find((v) => v.id === c.venue_id)?.name ?? "—";
                  const d = new Date(c.date + "T12:00:00");
                  return (
                    <tr key={c.id} className="border-b border-cream/5 last:border-b-0">
                      <td className="px-5 py-3 font-medium">
                        {d.toLocaleDateString("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-3 text-cream/65">{where}</td>
                      <td className="px-5 py-3 text-cream/80">{c.reason ?? "—"}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleDelete(c)}
                          disabled={busy}
                          className="text-xs font-semibold uppercase tracking-wider text-red-400/80 hover:underline"
                        >
                          Remove block
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}

      {showAdd && (
        <BlockDateModal
          venues={venues}
          onCancel={() => setShowAdd(false)}
          onSaved={async () => {
            setShowAdd(false);
            await reload();
          }}
          onError={(m) => setErr(m)}
        />
      )}
    </>
  );
}

function BlockDateModal({
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
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [venueId, setVenueId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState("");

  async function save() {
    setLocalErr("");
    if (!date) {
      setLocalErr("Pick a date.");
      return;
    }
    setBusy(true);
    try {
      await createClosedDate({ venue_id: venueId, date, reason: reason || null });
      onSaved();
    } catch (e) {
      const m = describe(e, "Block failed");
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
        <h3 className="font-display text-2xl">Block a date</h3>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">Venue</span>
            <select
              value={venueId ?? ""}
              onChange={(e) => setVenueId(e.target.value || null)}
              className="mt-1.5 w-full appearance-none rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
            >
              <option value="">Both venues</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
              Reason (optional)
            </span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Private hire / Bank holiday"
              className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:border-plonkPink focus:outline-none"
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
            {busy ? "Saving…" : "Block"}
          </button>
        </div>
      </div>
    </div>
  );
}
