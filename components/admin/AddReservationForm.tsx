"use client";

import { useEffect, useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import TimeField from "@/components/admin/TimeField";
import { supabase } from "@/lib/supabase";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://rntcujcpsozvuxvmlejv.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SEND_CONFIRMATION_URL =
  `${SUPABASE_URL}/functions/v1/send-pool-confirmation`;
const NOTIFY_BIG_BOOKING_URL =
  `${SUPABASE_URL}/functions/v1/notify-big-booking`;
// 12+ covers pings the founder inbox so kitchen + management can plan for
// the extra load. Matches BIG_THRESHOLD in the edge function.
const BIG_BOOKING_THRESHOLD = 12;

// Office pool add-on (table bookings only) — same edge fn + pricing the
// 🎱 Add pool time button on each booking card uses.
const POOL_ADDON_URL = `${SUPABASE_URL}/functions/v1/pool-addon`;
type PriceWindow = {
  days_of_week: number[];
  start_time: string;
  end_time: string;
  price_per_30min_pence: number;
  is_default: boolean;
  priority: number;
};
function estimatePoolPence(
  windows: PriceWindow[],
  dateIso: string,
  timeHHMM: string,
  durationMin: number,
): number {
  if (!dateIso || !timeHHMM || !durationMin || durationMin <= 0) return 0;
  const t2m = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const sorted = [...windows].sort((a, b) => b.priority - a.priority);
  const dow = new Date(`${dateIso}T00:00:00Z`).getUTCDay();
  const per30 = (slotMin: number) => {
    for (const w of sorted) {
      if (!w.days_of_week.includes(dow)) continue;
      const ws = t2m(w.start_time);
      const we = t2m(w.end_time);
      if (slotMin < ws || slotMin >= we) continue;
      return w.price_per_30min_pence;
    }
    const def = sorted.find((w) => w.is_default);
    return def ? def.price_per_30min_pence : 600;
  };
  const start = t2m(timeHHMM);
  const blocks = Math.ceil(durationMin / 30);
  let total = 0;
  for (let i = 0; i < blocks; i++) total += per30(start + i * 30);
  return total || Math.ceil(durationMin / 30) * 600;
}

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
// walk-in / staff hold and types it straight in. Booking type picks
// the saved status: 'confirmed' (locked in) or 'pending' (pencilled-
// in enquiry — amber everywhere, confirm later from the list).
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
  initialDate,
  startOpen = false,
}: {
  kind: Kind;
  onCreated: () => void;
  // Prefill the date (YYYY-MM-DD) — used when the form is opened from
  // the booking calendar for a specific day. Defaults to today.
  initialDate?: string;
  // Render already expanded (calendar day panel opens straight into it).
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // Default date = the passed-in day, else today. Default time depends
  // on kind: 19:00 (7pm) is the most-booked slot for tables, 18:00 pool.
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(initialDate || today);
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
  // Confirmed vs pending (2026-08-26 founder request): "pending" is a
  // pencilled-in enquiry — someone interested who hasn't locked it in.
  // It still holds the slot against online bookings (checkout counts
  // pending rows) and shows amber everywhere; staff confirm it later
  // from the list, where full details can also be edited.
  const [bookingStatus, setBookingStatus] = useState<"confirmed" | "pending">(
    "confirmed",
  );

  // Optional pool add-on — table bookings only. Mirrors the 🎱 Add pool
  // time button on the booking cards: creates a linked pool row that
  // blocks the slot + a single-use Stripe pay-later link, all in one go
  // with the table booking. The pay link then rides on the booking's
  // confirmation email (if "Send confirmation email" is ticked).
  const [addPool, setAddPool] = useState(false);
  const [poolTime, setPoolTime] = useState("20:00");
  const [poolDuration, setPoolDuration] = useState("60");
  const [poolTables, setPoolTables] = useState("1");
  const [poolAmount, setPoolAmount] = useState(""); // pounds, as typed
  const [poolAmountTouched, setPoolAmountTouched] = useState(false);
  const [priceWindows, setPriceWindows] = useState<PriceWindow[]>([]);

  // Load pool price windows once (table form only) so the fee auto-fills.
  useEffect(() => {
    if (kind !== "table") return;
    supabase()
      .from("bookable_price_windows")
      .select(
        "days_of_week,start_time,end_time,price_per_30min_pence,is_default,priority",
      )
      .eq("product_id", "pool")
      .then(({ data }) => {
        if (data) setPriceWindows(data as PriceWindow[]);
      });
  }, [kind]);

  // Auto-fill the pool fee from the rate until the office hand-edits it.
  useEffect(() => {
    if (!addPool || poolAmountTouched) return;
    const mins = parseInt(poolDuration, 10) || 0;
    const p = estimatePoolPence(priceWindows, date, poolTime, mins);
    setPoolAmount(p > 0 ? (p / 100).toFixed(2) : "");
  }, [addPool, date, poolTime, poolDuration, priceWindows, poolAmountTouched]);

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
    setBookingStatus("confirmed");
    setAddPool(false);
    setPoolTime("20:00");
    setPoolDuration("60");
    setPoolTables("1");
    setPoolAmount("");
    setPoolAmountTouched(false);
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
    const partySizeInt = Math.max(1, Math.min(80, parseInt(partySize, 10) || 2));
    const durationInt = Math.max(30, Math.min(300, parseInt(duration, 10) || 60));
    // Venue has 2 physical pool tables — never let an admin book more
    // (founder 2 Oct 2026). Online bookings are separately capped at 1.
    const resourceCountInt = Math.max(
      1,
      Math.min(2, parseInt(resourceCount, 10) || 1),
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
          status: bookingStatus,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Pool add-on — if the office ticked "Also add pool time", create the
      // linked pool row + single-use Stripe pay link NOW, before the
      // confirmation email so that email carries the pool line + Pay button.
      // The table booking is already saved; a pool failure here doesn't undo
      // it — we keep the form open and tell the office to add pool from the
      // booking card instead.
      let poolOk = !(kind === "table" && addPool);
      let poolMessage = "";
      if (kind === "table" && addPool) {
        const poolMins = Math.max(15, Math.min(600, parseInt(poolDuration, 10) || 60));
        const poolTablesInt = Math.max(1, Math.min(4, parseInt(poolTables, 10) || 1));
        const amtPence = Math.round((parseFloat(poolAmount) || 0) * 100);
        try {
          const pr = await fetch(POOL_ADDON_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              parent_reservation_id: inserted.id,
              reservation_date: date,
              start_time: poolTime,
              duration_minutes: poolMins,
              resource_count: poolTablesInt,
              ...(amtPence > 0 ? { amount_pence: amtPence } : {}),
            }),
          });
          const pj = await pr.json().catch(() => ({}));
          if (pr.ok) {
            poolOk = true;
            poolMessage = " Pool time added — the pay link is on the booking.";
          } else {
            poolMessage = ` (Pool add-on failed: ${pj.error || `HTTP ${pr.status}`}.)`;
          }
        } catch (e2) {
          poolMessage = ` (Pool add-on errored: ${e2 instanceof Error ? e2.message : String(e2)})`;
        }
      }

      // Fire the customer confirmation email if the founder ticked the
      // box AND we have a real email (never send to the walk-in
      // placeholder — that would land in the shared info@ mailbox).
      let emailMessage = "";
      // Never email a pending booking — nothing is confirmed yet. The
      // list screen offers the email at the moment of confirming.
      const wantsEmail =
        bookingStatus === "confirmed" &&
        sendConfirmation &&
        looksLikeRealEmail(finalEmail);
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

      // Big-booking alert to the founder's inbox — fire-and-forget so a
      // Resend hiccup can't block the save. Matches the stripe-webhook
      // path so paid AND manual entries both trigger it consistently.
      // Pending bookings don't alert — nothing is locked in yet.
      let bigMessage = "";
      if (bookingStatus === "confirmed" && partySizeInt >= BIG_BOOKING_THRESHOLD) {
        try {
          const res = await fetch(NOTIFY_BIG_BOOKING_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ reservation_id: inserted.id }),
          });
          bigMessage = res.ok
            ? " Founder alerted (12+ covers)."
            : ` (Big-booking alert failed: HTTP ${res.status}.)`;
        } catch (err) {
          bigMessage = ` (Big-booking alert errored: ${err instanceof Error ? err.message : String(err)})`;
        }
      }

      // Pool add-on failed but the table booking saved — keep the form open
      // with the error so the office notices, and can add pool from the
      // 🎱 button on the booking card instead. Don't reset/close.
      if (!poolOk) {
        setErr(
          `Booking saved for ${name.trim()}, but the pool add-on didn't go through.${poolMessage} You can add it from the 🎱 button on the booking.`,
        );
        onCreated();
        return;
      }
      // Success — reload the list, then CLOSE the form (founder 19 Oct 2026:
      // it should disappear, not sit open ready for the next entry).
      setOk(
        bookingStatus === "pending"
          ? `Pending booking noted for ${name.trim()} — it shows amber in the list and calendar.`
          : `Booking added for ${name.trim()}.${emailMessage}${bigMessage}${poolMessage}`,
      );
      onCreated();
      reset();
      setOpen(false);
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
            <TimeField
              value={time}
              onChange={setTime}
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
              max={80}
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
                max={2}
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

        {/* Optional pool add-on — table bookings only. Creates a linked
            pool hold + single-use Stripe pay-later link in one go. */}
        {kind === "table" && (
          <div className="rounded-lg border border-plonkTeal/25 bg-plonkTeal/5 px-4 py-3">
            <label className="flex items-start gap-3 text-sm text-cream/90">
              <input
                type="checkbox"
                checked={addPool}
                onChange={(e) => setAddPool(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-plonkTeal"
              />
              <span>
                <span className="font-semibold">🎱 Also add pool time</span>
                <span className="mt-0.5 block text-xs text-cream/60">
                  Holds a pool table for this booking and makes a pay-later
                  link. The link rides on this booking (and its confirmation
                  email if you send one) — not a separate pool booking.
                </span>
              </span>
            </label>
            {addPool && (
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
                    Pool start
                  </label>
                  <TimeField
                    value={poolTime}
                    onChange={setPoolTime}
                    className={inputCls + " mt-1"}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
                    Length (min)
                  </label>
                  <input
                    type="number"
                    min={15}
                    step={15}
                    value={poolDuration}
                    onChange={(e) => setPoolDuration(e.target.value)}
                    className={inputCls + " mt-1"}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
                    Tables
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={poolTables}
                    onChange={(e) => setPoolTables(e.target.value)}
                    className={inputCls + " mt-1"}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
                    Pool fee (£)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.50"
                    value={poolAmount}
                    onChange={(e) => {
                      setPoolAmountTouched(true);
                      setPoolAmount(e.target.value);
                    }}
                    className={inputCls + " mt-1"}
                  />
                  <p className="mt-1 text-[10px] text-cream/45">
                    Auto from the pool rate — edit to override.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Confirmed vs pending. A pending booking is a pencilled-in
            enquiry — shows amber, holds the slot, no customer email
            until it's confirmed from the list. */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
            Booking type
          </label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setBookingStatus("confirmed")}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                bookingStatus === "confirmed"
                  ? "border-plonkTeal/60 bg-plonkTeal/10 text-plonkTeal"
                  : "border-cream/15 bg-ink/30 text-cream/60 hover:bg-cream/5"
              }`}
            >
              <span className="block font-semibold">Confirmed</span>
              <span className="mt-0.5 block text-[11px] text-cream/55">
                Locked in — can email the customer now
              </span>
            </button>
            <button
              type="button"
              onClick={() => setBookingStatus("pending")}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                bookingStatus === "pending"
                  ? "border-amber-400/60 bg-amber-400/10 text-amber-300"
                  : "border-cream/15 bg-ink/30 text-cream/60 hover:bg-cream/5"
              }`}
            >
              <span className="block font-semibold">Pending</span>
              <span className="mt-0.5 block text-[11px] text-cream/55">
                Interested, not confirmed — shows amber, confirm later
              </span>
            </button>
          </div>
        </div>

        {/* Confirmation-email toggles. Rendered as a small block so it
            visually groups the two settings that control what the
            customer receives once you hit Save. Hidden meaning when
            the booking is pending: no email goes out until confirm. */}
        {bookingStatus === "pending" ? (
          <div className="rounded-lg border border-amber-400/25 bg-amber-400/5 px-4 py-3 text-xs text-amber-200/85">
            No email is sent for a pending booking. When they confirm,
            hit <strong>Confirm</strong> on the row in the list below —
            you'll be offered the confirmation email then. The slot is
            still held against online bookings in the meantime.
          </div>
        ) : (
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
        )}

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
            className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition disabled:opacity-50 ${
              bookingStatus === "pending"
                ? "bg-amber-400 text-ink hover:bg-amber-300"
                : "bg-plonkPink text-white hover:bg-plonkPink/90"
            }`}
          >
            {busy
              ? "Saving…"
              : bookingStatus === "pending"
              ? "Save pending booking"
              : "Add booking"}
          </button>
        </div>
      </form>
    </AdminCard>
  );
}
