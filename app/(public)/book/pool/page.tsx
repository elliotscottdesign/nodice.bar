"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBarReservation } from "@/lib/db/barReservations";

// /book/pool — pool table reservation flow. Slots are 30 minutes
// starting on the hour (so :00 and :30). Single-venue (Hackney).
// MVP: no Stripe, no capacity check — every submit lands as
// status='pending' in bar_reservations. Founder confirms manually
// from the admin panel.

const OPEN_HOUR = 16;   // 4pm — first bookable slot
const CLOSE_HOUR = 23;  // 11pm — last bookable slot start (30-min)
const SLOT_MINUTES = 30;

// Generate ["16:00", "16:30", "17:00", ...] up to but not past the
// close hour so the last slot is 23:30 (closing at midnight).
function generatePoolSlots(): string[] {
  const out: string[] = [];
  for (let h = OPEN_HOUR; h <= CLOSE_HOUR; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Next.js 14 static export refuses to build any page that calls
// useSearchParams() outside a <Suspense> boundary. The actual page
// content moves into PoolBookingPageInner; the default export wraps
// it so the build passes.
export default function PoolBookingPage() {
  return (
    <Suspense fallback={null}>
      <PoolBookingPageInner />
    </Suspense>
  );
}

function PoolBookingPageInner() {
  const params = useSearchParams();
  const slots = useMemo(generatePoolSlots, []);

  const [date, setDate] = useState(params.get("date") || todayIso());
  const [partySize, setPartySize] = useState<number>(
    Math.max(1, Math.min(8, parseInt(params.get("size") || "2", 10) || 2)),
  );
  const [time, setTime] = useState<string>("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [heardFrom, setHeardFrom] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!time) {
      setError("Pick a time first.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await createBarReservation({
        kind: "pool",
        reservation_date: date,
        start_time: time,
        duration_minutes: SLOT_MINUTES,
        party_size: partySize,
        // Always 1 — the "Tables wanted" picker was removed; staff
        // allocate tables based on party size at the venue.
        resource_count: 1,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        notes: notes.trim() || null,
        heard_from: heardFrom || null,
        marketing_opt_in: marketingOptIn,
      });
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't send the reservation — try again or email info@nodice.bar",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <main className="px-6 py-24">
        <div className="mx-auto max-w-xl rounded-2xl border border-cream/10 p-10 text-center">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
            Request received
          </div>
          <h1 className="mt-3 font-display text-4xl uppercase tracking-wider">
            Got it
          </h1>
          <p className="mt-4 text-base text-cream/75">
            We'll email you within 24 hours to confirm your pool table — or sooner if it's last-minute.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 text-center text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
          Pool · 30-min slots
        </div>
        <h1 className="text-center font-display text-5xl uppercase tracking-wider sm:text-6xl">
          Reserve a Pool Table
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-center text-base text-cream/75">
          American 7ft tables. Six available — book one, or grab the lot for a tournament.
        </p>

        <form onSubmit={submit} className="mt-12 space-y-8">
          <FormSection label="Date">
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={todayIso()}
              className="w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none"
            />
          </FormSection>

          <FormSection label="Time">
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {slots.map((s) => {
                const active = time === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setTime(s)}
                    className={`rounded-lg border px-2 py-3 text-sm transition ${
                      active
                        ? "border-plonkPink bg-plonkPink text-white"
                        : "border-cream/15 bg-ink/40 text-cream hover:border-cream/40"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </FormSection>

          <FormSection label="Party size">
            <NumberPicker value={partySize} min={1} max={8} onChange={setPartySize} />
          </FormSection>

          <div className="grid gap-6 sm:grid-cols-2">
            <FormSection label="Name">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none"
              />
            </FormSection>
            <FormSection label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none"
              />
            </FormSection>
          </div>

          <FormSection label="Phone">
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="We'll text you about any updates"
              className="w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none"
            />
          </FormSection>

          <FormSection label="Where did you hear about us?">
            <select
              value={heardFrom}
              onChange={(e) => setHeardFrom(e.target.value)}
              className="w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none"
            >
              <option value="">Pick one (optional)</option>
              <option value="Instagram">Instagram</option>
              <option value="Friend / word of mouth">
                Friend / word of mouth
              </option>
              <option value="Walked past">Walked past the venue</option>
              <option value="Google search">Google search</option>
              <option value="A DJ / event night">A DJ / event night</option>
              <option value="Press / blog">Press / blog</option>
              <option value="Other">Other</option>
            </select>
          </FormSection>

          <FormSection label="Anything else? (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none"
            />
          </FormSection>

          {/* GDPR-compliant marketing opt-in. Unchecked by default. */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-cream/10 bg-ink/20 px-4 py-3 text-sm text-cream/85 transition hover:border-cream/25">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-plonkPink"
            />
            <span>
              Keep me in the loop — send me No Dice news, upcoming events
              and the odd offer. Unsubscribe anytime.
            </span>
          </label>

          {error && (
            <div className="rounded-lg border border-plonkPink/40 bg-plonkPink/10 px-4 py-3 text-sm text-plonkPink">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-plonkPink py-4 text-sm font-bold uppercase tracking-widest text-white shadow-lg shadow-plonkPink/20 transition hover:bg-plonkPink/90 disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Reserve the pool table"}
          </button>

          <p className="text-center text-xs text-cream/55">
            Free to reserve — pay at the bar. We'll email to confirm within 24 hours.
          </p>
        </form>
      </div>
    </main>
  );
}

function FormSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
        {label}
      </label>
      {children}
    </div>
  );
}

function NumberPicker({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="h-12 w-12 rounded-full border border-cream/15 bg-ink/40 text-xl text-cream hover:border-cream/40"
      >
        −
      </button>
      <span className="w-12 text-center font-display text-2xl">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="h-12 w-12 rounded-full border border-cream/15 bg-ink/40 text-xl text-cream hover:border-cream/40"
      >
        +
      </button>
    </div>
  );
}
