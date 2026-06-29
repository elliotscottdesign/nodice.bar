"use client";

import { useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import { supabase } from "@/lib/supabase";

// =============================================================
// AddReservationForm — manual admin booking creation
// =============================================================
// Inline "+ Add booking" form at the top of /admin/table-reservations
// and /admin/pool-reservations. Founder takes a phone reservation /
// walk-in / staff hold and types it straight in; row goes to the
// database with status='confirmed' (no payment, no customer email
// goes out — it's already locked in).
//
// Why direct supabase().from(...).insert() and not an Edge Function:
// bar_reservations has RLS disabled by design (see migration
// 20260608000002), so the authenticated admin client can insert
// directly. Service-role on the front-end would be a leak.
// =============================================================

type Kind = "table" | "pool";

// Default email when the founder doesn't have one — covers walk-ins
// and phone bookings. Routed to the real info@ mailbox (only info@
// and elliot@ exist on nodice.bar — see CLAUDE.md). Reservation still
// tracks who via `name`/`phone` + the bar staff seeing it in the
// admin list.
const WALK_IN_EMAIL = "info@nodice.bar";

const inputCls =
  "w-full rounded-lg border border-cream/15 bg-ink/30 px-3 py-2 text-sm text-cream " +
  "placeholder:text-cream/40 focus:border-plonkPink focus:outline-none";

export default function AddReservationForm({
  kind,
  onCreated,
}: {
  kind: Kind;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // Default date = today. Default time depends on kind: 19:00 (7pm)
  // is the most-booked slot for tables, 18:00 for pool.
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(kind === "pool" ? "18:00" : "19:00");
  const [duration, setDuration] = useState<number>(kind === "pool" ? 60 : 90);
  const [partySize, setPartySize] = useState<number>(2);
  const [resourceCount, setResourceCount] = useState<number>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setName("");
    setEmail("");
    setPhone("");
    setNotes("");
    setPartySize(2);
    setResourceCount(1);
    setDuration(kind === "pool" ? 60 : 90);
    setTime(kind === "pool" ? "18:00" : "19:00");
    setDate(new Date().toISOString().slice(0, 10));
    setErr("");
    setOk("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setOk("");
    if (!name.trim()) {
      setErr("Customer name is required.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase()
        .from("bar_reservations")
        .insert({
          kind,
          reservation_date: date,
          start_time: time + ":00",
          duration_minutes: duration,
          party_size: partySize,
          resource_count: kind === "pool" ? resourceCount : 1,
          name: name.trim(),
          email: email.trim() || WALK_IN_EMAIL,
          phone: phone.trim() || null,
          notes: notes.trim() || null,
          heard_from: "Manual admin entry",
          marketing_opt_in: false,
          status: "confirmed", // founder-created = already locked in
        });
      if (error) throw error;
      setOk(`Booking added for ${name.trim()}.`);
      reset();
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add booking.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-plonkPink px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90"
        >
          + Add booking manually
        </button>
      </div>
    );
  }

  return (
    <AdminCard title={`Add ${kind === "pool" ? "pool" : "table"} booking`}>
      <form onSubmit={submit} className="space-y-4 px-5 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
              Date
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls + " mt-1"}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
              Start time
            </label>
            <input
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={inputCls + " mt-1"}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
              Duration (min)
            </label>
            <input
              type="number"
              required
              min={30}
              max={300}
              step={30}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value, 10) || 60)}
              className={inputCls + " mt-1"}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
              Party size
            </label>
            <input
              type="number"
              required
              min={1}
              max={50}
              value={partySize}
              onChange={(e) => setPartySize(parseInt(e.target.value, 10) || 2)}
              className={inputCls + " mt-1"}
            />
          </div>
          {kind === "pool" && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
                Tables
              </label>
              <input
                type="number"
                required
                min={1}
                max={6}
                value={resourceCount}
                onChange={(e) =>
                  setResourceCount(parseInt(e.target.value, 10) || 1)
                }
                className={inputCls + " mt-1"}
              />
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
              Customer name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Their name"
              className={inputCls + " mt-1"}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
              Email (optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Leave blank for walk-in"
              className={inputCls + " mt-1"}
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
            Phone (optional)
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Useful if anything changes"
            className={inputCls + " mt-1"}
          />
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
            Notes (optional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Dietary, allergies, special occasion, anything staff should know"
            className={inputCls + " mt-1"}
          />
        </div>

        {err && (
          <div className="rounded-lg border border-plonkPink/40 bg-plonkPink/10 px-3 py-2 text-sm text-plonkPink">
            {err}
          </div>
        )}
        {ok && (
          <div className="rounded-lg border border-plonkTeal/40 bg-plonkTeal/10 px-3 py-2 text-sm text-plonkTeal">
            {ok}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            disabled={busy}
            className="rounded-full border border-cream/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cream/75 transition hover:bg-cream/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-plonkPink px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add booking"}
          </button>
        </div>
      </form>
    </AdminCard>
  );
}
