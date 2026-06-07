"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  loadStripe,
  type Stripe as StripeJs,
  type StripeElementsOptions,
} from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { createBarReservation } from "@/lib/db/barReservations";
import {
  loadBookingSetting,
  type DbBookingSetting,
} from "@/lib/db/bookingSettings";
import DatePickerInput from "@/components/admin/DatePickerInput";
import BrandSelect from "@/components/BrandSelect";

const HEARD_FROM_OPTIONS = [
  { value: "Instagram", label: "Instagram" },
  { value: "Friend / word of mouth", label: "Friend / word of mouth" },
  { value: "Walked past", label: "Walked past the venue" },
  { value: "Google search", label: "Google search" },
  { value: "A DJ / event night", label: "A DJ / event night" },
  { value: "Press / blog", label: "Press / blog" },
  { value: "Other", label: "Other" },
];

// =============================================================
// /book/pool — pool table reservation with inline Stripe Payment
// =============================================================
// 3-phase flow, mirroring InlineTournamentBooking on /pool:
//   form     — date / time / duration / party + contact + GDPR
//   paying   — Stripe Payment Element inline below the summary
//   paid     — green "You're in" inline confirmation
//
// Pricing: £6 per 30 minutes. Customer picks 30 or 60 min slot;
// total surfaces in the form ("Pay £6") and on the Stripe widget.
// The actual amount is recomputed server-side from
// `duration_minutes` so the browser can't tamper with the price.
// =============================================================

const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://rntcujcpsozvuxvmlejv.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const CHECKOUT_FN_URL = `${SUPABASE_URL}/functions/v1/pool-checkout`;

let _stripePromise: Promise<StripeJs | null> | null = null;
function getStripePromise(): Promise<StripeJs | null> {
  if (!_stripePromise) _stripePromise = loadStripe(PUBLISHABLE_KEY);
  return _stripePromise;
}

const OPEN_HOUR = 16;
const CLOSE_HOUR = 23;

function generatePoolSlots(): string[] {
  const out: string[] = [];
  for (let h = OPEN_HOUR; h <= CLOSE_HOUR; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
}

// =============================================================
// Pool booking rules (kept in code; admin toggle for on/off comes
// next). Hours/prices are recomputed server-side in pool-checkout
// from `reservation_date` so the browser can't tamper with them.
// =============================================================

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

// 6 = Saturday — closed all day.
const CLOSED_DAYS = [6];

// On these days, all pool bookings must END by 18:30 (tournament
// warm-up starts then). Wed=3, Fri=5.
const TOURNAMENT_DAYS = [3, 5];
const TOURNAMENT_DAY_LATEST_END_MIN = 18 * 60 + 30; // 18:30

// Monday discount — half-price slots.
const DISCOUNT_DAYS = [1];

function dayOfWeek(iso: string): number {
  return new Date(`${iso}T00:00:00`).getDay();
}

function minutesFromSlot(slot: string): number {
  const [h, m] = slot.split(":").map(Number);
  return h * 60 + m;
}

function isClosed(iso: string): boolean {
  return CLOSED_DAYS.includes(dayOfWeek(iso));
}

// Slots that fit the day's rules for a given duration. On tournament
// days the booking must end by 18:30, so 60-min picks lose 18:00 and
// 30-min picks lose anything after 18:00.
function availableSlots(iso: string, duration: number): string[] {
  if (isClosed(iso)) return [];
  const day = dayOfWeek(iso);
  const all = generatePoolSlots();
  const latestEnd = TOURNAMENT_DAYS.includes(day)
    ? TOURNAMENT_DAY_LATEST_END_MIN
    : 24 * 60;
  return all.filter((s) => minutesFromSlot(s) + duration <= latestEnd);
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatPounds(pence: number): string {
  if (pence % 100 === 0) return `£${pence / 100}`;
  return `£${(pence / 100).toFixed(2)}`;
}

// Day-of-week + duration → price (pence). Monday is half price.
// Mirrors the server-side computation in pool-checkout so totals
// always match.
function priceForBooking(iso: string, duration: number): number {
  const day = dayOfWeek(iso);
  const basePer30 = DISCOUNT_DAYS.includes(day) ? 300 : 600;
  return Math.ceil(duration / 30) * basePer30;
}

// Stripe appearance — same dark theme as the tournament flow.
function buildAppearance(): StripeElementsOptions["appearance"] {
  return {
    theme: "night",
    variables: {
      colorPrimary: "#DA1B33",
      colorBackground: "#0c0c0c",
      colorText: "#F5EFE3",
      colorTextSecondary: "rgba(245,239,227,0.55)",
      colorTextPlaceholder: "rgba(245,239,227,0.4)",
      colorDanger: "#DA1B33",
      colorSuccess: "#46B4A5",
      fontFamily: '"DM Sans", system-ui, -apple-system, sans-serif',
      fontSizeBase: "15px",
      spacingUnit: "4px",
      borderRadius: "10px",
    },
    rules: {
      ".Input": {
        backgroundColor: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(245,239,227,0.15)",
        padding: "12px 14px",
      },
      ".Input:focus": {
        border: "1px solid #DA1B33",
        boxShadow: "0 0 0 1px #DA1B33",
      },
      ".Label": {
        color: "rgba(245,239,227,0.55)",
        fontSize: "10px",
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: "0.28em",
      },
    },
  };
}

type Phase = "form" | "paying" | "paid" | "error";

export default function PoolBookingPage() {
  return (
    <Suspense fallback={null}>
      <PoolBookingPageInner />
    </Suspense>
  );
}

function PoolBookingPageInner() {
  const params = useSearchParams();

  // ----- Form state -----
  const [date, setDate] = useState(params.get("date") || todayIso());
  const [time, setTime] = useState<string>("");
  const [duration, setDuration] = useState<30 | 60>(30);
  const [partySize, setPartySize] = useState<number>(
    Math.max(1, Math.min(8, parseInt(params.get("size") || "2", 10) || 2)),
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [heardFrom, setHeardFrom] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  // ----- Flow state -----
  const [phase, setPhase] = useState<Phase>("form");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // ----- Admin kill-switch -----
  // Loads /admin/booking-settings's `pool` row on mount. While
  // loading we hold the form back so the customer doesn't briefly
  // see it before we discover bookings are paused.
  const [setting, setSetting] = useState<DbBookingSetting | null>(null);
  const [settingLoaded, setSettingLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadBookingSetting("pool")
      .then((s) => {
        if (!cancelled) {
          setSetting(s);
          setSettingLoaded(true);
        }
      })
      .catch(() => {
        // If we can't read settings, fail open — better to let the
        // customer book than to block the whole page on a transient
        // Supabase blip.
        if (!cancelled) setSettingLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Recomputed every render based on the date + duration. If the
  // customer changes date and their selected time is no longer valid
  // (e.g. they picked 18:00 then switched to a Wednesday and the
  // tournament cutoff kicks in), clear `time` and ask them to repick.
  const slots = useMemo(
    () => availableSlots(date, duration),
    [date, duration],
  );
  const totalPence = priceForBooking(date, duration);
  const closed = isClosed(date);
  const closedNote = closed ? `${DAY_NAMES[dayOfWeek(date)]} — no pool bookings.` : "";

  const elementsOptions = useMemo<StripeElementsOptions | null>(
    () =>
      clientSecret
        ? { clientSecret, appearance: buildAppearance(), loader: "auto" }
        : null,
    [clientSecret],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!time) {
        setError("Pick a time first.");
        return;
      }
      setError("");
      setSubmitting(true);
      try {
        // 1) Insert the pending reservation row.
        const r = await createBarReservation({
          kind: "pool",
          reservation_date: date,
          start_time: time,
          duration_minutes: duration,
          party_size: partySize,
          resource_count: 1,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          notes: notes.trim() || null,
          heard_from: heardFrom || null,
          marketing_opt_in: marketingOptIn,
        });

        // 2) Ask the pool-checkout Edge Function for a PaymentIntent.
        const res = await fetch(CHECKOUT_FN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ reservation_id: r.id }),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(
            `Couldn't start payment (${res.status}): ${txt || "no detail"}`,
          );
        }
        const body = (await res.json()) as { client_secret?: string };
        if (!body.client_secret) {
          throw new Error("Server returned no client_secret");
        }

        setClientSecret(body.client_secret);
        setPhase("paying");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't start payment — try again or email info@nodice.bar",
        );
        setPhase("error");
      } finally {
        setSubmitting(false);
      }
    },
    [
      date,
      time,
      duration,
      partySize,
      name,
      email,
      phone,
      notes,
      heardFrom,
      marketingOptIn,
    ],
  );

  // ----- 'paid' inline confirmation -----
  if (phase === "paid") {
    return (
      <main className="px-6 py-24">
        <div className="mx-auto max-w-xl rounded-2xl border border-plonkTeal/40 bg-plonkTeal/10 p-10 text-center">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-plonkTeal">
            Payment received
          </div>
          <h1 className="mt-3 font-display text-4xl uppercase tracking-wider">
            Table booked
          </h1>
          <p className="mt-4 text-base text-cream/75">
            Confirmation email is on its way to <strong>{email}</strong>. See
            you at {time} on {date}.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 text-center text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
          Pool · 30-min slots · £6 per slot
        </div>
        <h1 className="text-center font-display text-5xl uppercase tracking-wider sm:text-6xl">
          Reserve a Pool Table
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-center text-base text-cream/75">
          American 7ft tables. Pick 30 or 60 minutes, pay to confirm.
        </p>

        {settingLoaded && setting && setting.enabled === false && (
          <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-plonkPink/40 bg-plonkPink/10 p-8 text-center">
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-plonkPink">
              Bookings paused
            </div>
            <p className="mt-4 text-base text-cream/85">
              {setting.closed_message ||
                "Pool table bookings are temporarily paused — check back soon or DM us on Instagram."}
            </p>
            <a
              href="https://instagram.com/nodice.bar"
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-block rounded-full bg-plonkPink px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-plonkPink/90"
            >
              DM us on Instagram
            </a>
          </div>
        )}

        {phase === "form" && settingLoaded && setting?.enabled !== false && (
          <form onSubmit={handleSubmit} className="mt-12 space-y-8">
            <FormSection label="Date">
              <DatePickerInput
                value={date}
                onChange={(iso) => {
                  setDate(iso);
                  // Clear time if it no longer fits the new day's slot
                  // window (e.g. switching to a Wed/Fri after picking
                  // 18:30 on a Mon).
                  if (time && !availableSlots(iso, duration).includes(time)) {
                    setTime("");
                  }
                }}
                minIso={todayIso()}
                disabledDaysOfWeek={CLOSED_DAYS}
              />
              {closedNote && (
                <p className="mt-2 text-xs text-plonkPink">{closedNote}</p>
              )}
            </FormSection>

            {!closed && (
              <FormSection label="Time">
                {slots.length === 0 ? (
                  <p className="text-sm text-cream/55">
                    No slots fit a {duration}-minute booking on{" "}
                    {DAY_NAMES[dayOfWeek(date)]}. Try a shorter duration.
                  </p>
                ) : (
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
                )}
                {TOURNAMENT_DAYS.includes(dayOfWeek(date)) && (
                  <p className="mt-2 text-xs text-cream/55">
                    Tournament night — bookings must end by 18:30 so the
                    tables are clear for warm-up.
                  </p>
                )}
              </FormSection>
            )}

            {!closed && (
              <FormSection label="How long?">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[30, 60].map((d) => {
                    const active = duration === d;
                    const price = priceForBooking(date, d);
                    const fits = availableSlots(date, d).length > 0;
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={!fits}
                        onClick={() => {
                          setDuration(d as 30 | 60);
                          if (
                            time &&
                            !availableSlots(date, d).includes(time)
                          ) {
                            setTime("");
                          }
                        }}
                        className={`rounded-xl border px-5 py-4 text-left transition ${
                          !fits
                            ? "cursor-not-allowed border-cream/10 bg-ink/20 opacity-50"
                            : active
                              ? "border-plonkPink bg-plonkPink/10"
                              : "border-cream/15 bg-ink/40 hover:border-cream/40"
                        }`}
                      >
                        <div className="text-base font-bold text-cream">
                          {d} minutes
                        </div>
                        <div className="mt-0.5 text-xs uppercase tracking-widest text-cream/55">
                          {formatPounds(price)}
                          {DISCOUNT_DAYS.includes(dayOfWeek(date)) && (
                            <span className="ml-2 rounded-full bg-plonkTeal/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-plonkTeal">
                              Monday ½ price
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </FormSection>
            )}

            <FormSection label="Party size">
              <NumberPicker
                value={partySize}
                min={1}
                max={8}
                onChange={setPartySize}
              />
            </FormSection>

            <div className="grid gap-6 sm:grid-cols-2">
              <FormSection label="Name">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                />
              </FormSection>
              <FormSection label="Email">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
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
                className={inputCls}
              />
            </FormSection>

            <FormSection label="Where did you hear about us?">
              <BrandSelect
                value={heardFrom}
                onChange={setHeardFrom}
                options={HEARD_FROM_OPTIONS}
                placeholder="Pick one (optional)"
              />
            </FormSection>

            <FormSection label="Anything else? (optional)">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className={inputCls}
              />
            </FormSection>

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
              {submitting
                ? "One sec…"
                : `Continue to payment · ${formatPounds(totalPence)}`}
            </button>

            <p className="text-center text-xs text-cream/55">
              Secure payment via Stripe. Your table's held the moment payment
              clears.
            </p>
          </form>
        )}

        {phase === "paying" && elementsOptions && (
          <div className="mt-12 rounded-xl border border-plonkPink/30 bg-plonkPink/5 p-6">
            <div className="mb-5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-plonkPink">
                Payment
              </div>
              <h3 className="mt-2 font-display text-2xl uppercase tracking-wider text-cream">
                Pay {formatPounds(totalPence)} to confirm
              </h3>
              <p className="mt-1 text-xs text-cream/55">
                {duration} min · {date} · {time}
              </p>
            </div>
            <Elements stripe={getStripePromise()} options={elementsOptions}>
              <PaymentForm
                feeLabel={formatPounds(totalPence)}
                onSuccess={() => setPhase("paid")}
                onError={(msg) => {
                  setError(msg);
                  setPhase("error");
                }}
                onCancel={() => setPhase("form")}
              />
            </Elements>
          </div>
        )}

        {phase === "error" && (
          <div className="mt-12 space-y-4 text-center">
            <div className="rounded-lg border border-plonkPink/40 bg-plonkPink/10 px-4 py-3 text-sm text-plonkPink">
              {error || "Something went wrong."}
            </div>
            <button
              type="button"
              onClick={() => {
                setError("");
                setPhase("form");
              }}
              className="rounded-full bg-plonkPink px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-plonkPink/90"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

// ----------------------------------------------------------------
// PaymentForm — Stripe Elements wrapper, identical pattern to the
// tournament booking. confirmPayment with redirect: 'if_required'
// keeps everyone on /book/pool unless 3D Secure forces a redirect.
// ----------------------------------------------------------------
function PaymentForm({
  feeLabel,
  onSuccess,
  onError,
  onCancel,
}: {
  feeLabel: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [inlineErr, setInlineErr] = useState("");

  const handlePay = useCallback(async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setInlineErr("");

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setInlineErr(
        submitError.message ?? "Please check your card details and try again.",
      );
      setSubmitting(false);
      return;
    }

    const { error } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: `${window.location.origin}/nodice.bar/book/pool/`,
      },
    });

    if (error) {
      if (
        error.type === "card_error" ||
        error.type === "validation_error"
      ) {
        setInlineErr(error.message ?? "Card declined — try a different card.");
      } else {
        onError(error.message ?? "Payment failed — please try again.");
      }
      setSubmitting(false);
      return;
    }

    onSuccess();
  }, [stripe, elements, onSuccess, onError]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-cream/10 bg-ink/40 p-4">
        <PaymentElement
          options={{
            layout: "tabs",
            wallets: { applePay: "auto", googlePay: "auto" },
          }}
        />
      </div>

      {inlineErr && (
        <div className="rounded-lg border border-plonkPink/40 bg-plonkPink/10 px-4 py-3 text-sm text-plonkPink">
          {inlineErr}
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs uppercase tracking-wider text-cream/55 hover:text-cream"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handlePay}
          disabled={submitting || !stripe || !elements}
          className="rounded-full bg-plonkPink px-7 py-3 text-sm font-bold uppercase tracking-widest text-white shadow-lg shadow-plonkPink/20 transition hover:bg-plonkPink/90 disabled:opacity-50"
        >
          {submitting ? "Processing…" : `Pay ${feeLabel}`}
        </button>
      </div>

      <p className="text-center text-[10px] uppercase tracking-widest text-cream/40">
        Secured by Stripe · your card never touches our servers
      </p>
    </div>
  );
}

// ----------------------------------------------------------------
// Layout helpers
// ----------------------------------------------------------------
const inputCls =
  "w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none";

function FormSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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
