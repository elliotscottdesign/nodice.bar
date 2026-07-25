"use client";

import { useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import { supabase } from "@/lib/supabase";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://rntcujcpsozvuxvmlejv.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SEND_CONFIRMATION_URL =
  `${SUPABASE_URL}/functions/v1/send-pool-confirmation`;

// A "real-looking" email — has an @, a dot in the domain, and isn't the
// info@ walk-in placeholder. Used to decide whether to default the
// "Send confirmation email" checkbox to on.
function looksLikeRealEmail(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  if (!s || s === "info@nodice.bar") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// =============================================================
// AddReservationForm — manual admin booking creation
// =============================================================
// Inline "+ Add booking" form at the top of /admin/table-reservations
// and /admin/pool-reservations. Founder takes a phone reservation /
// walk-in / staff hold and types it straight in; row goes to the
// database with status='confirmed'.
//
// 2026-07-23 — added the "Send confirmation email" checkbox (defaults
// on if a real-looking email is present) and the "Include staff notes
// in email" checkbox (defaults off so internal notes stay internal
// unless the founder ticks it). On save, if the first box is on we
// call the send-pool-confirmation Edge Function (which now handles
// both pool AND table kinds — see the function header for detail).
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
  // Number-input state kept as string so the founder can clear the
  // field and type any value — a `useState<number>` snapshot would
  // snap back to the default the moment the input goes empty (see
  // 2026-07-02 bug report). Parsed to int on submit below.
  const [duration, setDuration] = useState<string>(
    kind === "pool" ? "60" : "90",
  );
  const [partySize, setPartySize] = useState<string>("2");
  const [resourceCount, setResourceCount] = useState<string>("1");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  // Send-confirmation defaults to true — the founder will manually
  // untick if it's a walk-in with a placeholder email. Include-notes
  // defaults to false so internal notes (e.g. "kicked out last time")
  // don't accidentally reach the customer.
  const [sendConfirmation, setSendConfirmation] = useState(true);
  const [includeNotesInEmail, setIncludeNotesInEmail] = useState(false);

  function reset() {
    setName("");
    setEmail("");
    setPhone("");
    setNotes("");
    setPartySize("2");
    setResourceCount("1");
    setDuration(kind === "pool" ? "60" : "90");
    setTime(kind === "pool" ? "18:00" : "19:00");
    setSendConfirmation(true);
    setIncludeNotesInEmail(false);
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
    // Coerce string inputs to safe integers. Empty / gibberish
    // defaults to a sensible fallback rather than blocking submit —
    // the founder is often mid-thought when hitting save.
    const partySizeInt = Math.max(1, Math.min(50, parseInt(partySize, 10) || 2));
    const durationInt = Math.max(30, Math.min(300, parseInt(duration, 10) || 60));
    const resourceCountInt = Math.max(
      1,
      Math.min(10, parseInt(resourceCount, 10) || 1),
    );
    setBusy(true);
    try {
      const finalEmail = email.trim() || WALK_IN_EMAIL;
      const { data: inserted, error } = await supabase()
        .from("bar_reservations")
        .insert({
          kind,
          reservation_date: date,
          start_time: time + ":00",
          duration_minutes: durationInt,
          party_size: partySizeInt,
          resource_count: kind === "pool" ? resourceCountInt : 1,
          name: name.trim(),
          email: finalEmail,
          phone: phone.trim() || null,
          notes: notes.trim() || null,
          heard_from: "Manual admin entry",
          marketing_opt_in: false,
          status: "confirmed", // founder-created = already locked in
        })
        .select("id")
        .single();
      if (error) throw error;

      // Fire the customer confirmation email if the founder ticked the
      // box AND we have a real email (never send to the walk-in
      // placeholder — that would land in the shared info@ mailbox).
      let emailMessage = "";
      const wantsEmail = sendConfirmation && looksLikeRealEmail(finalEmail);
      if (wantsEmail) {
        try {
          const res = await fetch(SEND_CONFIRMATION_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              reservation_id: inserted.id,
              include_notes: includeNotesInEmail,
            }),
          });
          if (res.ok) {
            emailMessage = includeNotesInEmail
              ? " Confirmation email sent (with notes)."
              : " Confirmation email sent.";
          } else {
            const detail = await res.text().catch(() => "");
            emailMessage =
              ` Booking saved but confirmation email failed (HTTP ${res.status}). ${detail.slice(0, 140)}`;
          }
        } catch (err) {
          emailMessage = ` Booking saved but confirmation email errored: ${
            err instanceof Error ? err.message : String(err)
          }`;
        }
      } else if (sendConfirmation) {
        // Founder wanted an email but the address wasn't real enough.
        emailMessage = " (No email sent — the address looks like a placeholder.)";
      }

      setOk(`Booking added for ${name.trim()}.${emailMessage}`);
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
              onChange={(e) => setDuration(e.target.value)}
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
              onChange={(e) => setPartySize(e.target.value)}
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
                onChange={(e) => setResourceCount(e.target.value)}
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

        {/* Confirmation-email toggles. Rendered as a small block so it
            visually groups the two settings that control what the
            customer receives once you hit Save. */}
        <div className="space-y-2 rounded-lg border border-cream/10 bg-ink/30 px-4 py-3">
          <label className="flex items-start gap-3 text-sm text-cream/90">
            <input
              type="checkbox"
              checked={sendConfirmation}
              onChange={(e) => setSendConfirmation(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-plonkPink"
            />
            <span>
              <span className="font-semibold">Send confirmation email</span>
              <span className="ml-2 text-[11px] uppercase tracking-widest text-cream/50">
                {looksLikeRealEmail(email)
                  ? "recommended"
                  : "email looks like a placeholder"}
              </span>
              <span className="mt-1 block text-xs text-cream/60">
                Standard No Dice confirmation with the date, time, party
                size and venue address. Skipped automatically if the
                email is blank or set to info@nodice.bar.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm text-cream/90">
            <input
              type="checkbox"
              checked={includeNotesInEmail}
              onChange={(e) => setIncludeNotesInEmail(e.target.checked)}
              disabled={!sendConfirmation || !notes.trim()}
              className="mt-0.5 h-4 w-4 accent-plonkPink disabled:opacity-40"
            />
            <span
              className={
                !sendConfirmation || !notes.trim()
                  ? "opacity-50"
                  : undefined
              }
            >
              <span className="font-semibold">
                Include the notes in the customer email
              </span>
              <span className="mt-1 block text-xs text-cream/60">
                Tick only if the note is something the customer should
                see (e.g. "high chair reserved"). Leave off for
                internal-only notes.
              </span>
            </span>
          </label>
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
