"use client";

// BookingEditModal — edit a bar reservation (table / pool / private hire) from
// anywhere, in a popup. The admin calendar opens it when a booking row is
// clicked; it fetches the full row by id, shows the same fields as the
// reservations-page inline editor, and saves through the shared
// updateBarReservation write path. Because table/pool reservations + the
// calendar all re-read bar_reservations, the save shows up everywhere once the
// opener reloads (founder 25 Nov 2026).
import { useEffect, useState } from "react";
import DatePickerInput from "@/components/admin/DatePickerInput";
import TimeField from "@/components/admin/TimeField";
import {
  loadBarReservationById,
  updateBarReservation,
} from "@/lib/db/barReservations";

const editInputCls =
  "w-full rounded-lg border border-cream/15 bg-ink/30 px-3 py-2 text-sm text-cream " +
  "placeholder:text-cream/40 focus:border-plonkPink focus:outline-none";

function describe(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

type Form = {
  reservation_date: string;
  start_time: string;
  duration_minutes: string;
  party_size: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
};

export default function BookingEditModal({
  reservationId,
  onClose,
  onSaved,
}: {
  reservationId: string;
  /** Close without saving. */
  onClose: () => void;
  /** Called after a successful save — the opener should reload its data. */
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<Form | null>(null);
  const [kind, setKind] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr("");
    loadBarReservationById(reservationId)
      .then((r) => {
        if (cancelled) return;
        if (!r) {
          setErr("Couldn't find this booking — it may have been removed.");
          return;
        }
        setKind(r.kind);
        setForm({
          reservation_date: r.reservation_date,
          start_time: (r.start_time ?? "").slice(0, 5),
          duration_minutes: String(r.duration_minutes),
          party_size: String(r.party_size),
          name: r.name ?? "",
          email: r.email ?? "",
          phone: r.phone ?? "",
          notes: r.notes ?? "",
        });
      })
      .catch((e) => {
        if (!cancelled) setErr(describe(e, "Couldn't load this booking."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reservationId]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    if (!form) return;
    setSaving(true);
    setErr("");
    try {
      await updateBarReservation(reservationId, {
        reservation_date: form.reservation_date,
        start_time: form.start_time,
        duration_minutes: parseInt(form.duration_minutes, 10) || 60,
        party_size: parseInt(form.party_size, 10) || 2,
        name: form.name,
        email: form.email,
        phone: form.phone,
        notes: form.notes,
      });
      await onSaved();
      onClose();
    } catch (e) {
      setErr(describe(e, "Couldn't save the changes."));
    } finally {
      setSaving(false);
    }
  }

  const kindLabel =
    kind === "pool" ? "pool" : kind === "private_hire" ? "private hire" : "table";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-cream/10 bg-ink p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cream/55">
            Edit {kindLabel} booking
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-cream/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cream/70 transition hover:bg-cream/5"
          >
            ✕ Close
          </button>
        </div>

        {err && (
          <div className="mb-3 rounded-lg border border-plonkPink/40 bg-plonkPink/10 px-3 py-2 text-xs text-plonkPink">
            {err}
          </div>
        )}

        {loading || !form ? (
          !err && <p className="py-6 text-sm text-cream/55">Loading…</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">Date</label>
                <DatePickerInput
                  value={form.reservation_date}
                  onChange={(v) => setForm({ ...form, reservation_date: v })}
                  className={editInputCls + " mt-1"}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">Start time</label>
                <TimeField
                  value={form.start_time}
                  onChange={(v) => setForm({ ...form, start_time: v })}
                  className={editInputCls + " mt-1"}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">Duration (min)</label>
                <input
                  type="number"
                  min={30}
                  max={300}
                  step={30}
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                  className={editInputCls + " mt-1"}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">Party size</label>
                <input
                  type="number"
                  min={1}
                  max={80}
                  value={form.party_size}
                  onChange={(e) => setForm({ ...form, party_size: e.target.value })}
                  className={editInputCls + " mt-1"}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">Customer name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={editInputCls + " mt-1"}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={editInputCls + " mt-1"}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={editInputCls + " mt-1"}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">Notes</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={editInputCls + " mt-1"}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-full border border-cream/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cream/75 hover:bg-cream/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-full bg-plonkPink px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
