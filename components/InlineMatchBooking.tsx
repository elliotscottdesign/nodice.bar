"use client";

import { useCallback, useMemo, useState } from "react";
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
import BrandSelect from "@/components/BrandSelect";

// =============================================================
// InlineMatchBooking — Stripe Payment Element for World Cup
// =============================================================
// Used by MatchSchedule on /worldcup for any match that has a
// paid ticket type (cover-charge games). Mirrors
// InlineTournamentBooking's state-machine + dark-theme Stripe
// appearance, but writes to `event_entries` (the new ticketed
// events table) instead of `tournament_entries`.
//
// Talks to the `match-checkout` Edge Function for the
// PaymentIntent. Webhook routes by metadata.kind='event_entry'.
// =============================================================

const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://rntcujcpsozvuxvmlejv.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const CHECKOUT_FN_URL = `${SUPABASE_URL}/functions/v1/match-checkout`;

const HEARD_FROM_OPTIONS = [
  { value: "Instagram", label: "Instagram" },
  { value: "Friend / word of mouth", label: "Friend / word of mouth" },
  { value: "Walked past", label: "Walked past the venue" },
  { value: "Google search", label: "Google search" },
  { value: "A DJ / event night", label: "A DJ / event night" },
  { value: "Press / blog", label: "Press / blog" },
  { value: "Other", label: "Other" },
];

let _stripePromise: Promise<StripeJs | null> | null = null;
function getStripePromise(): Promise<StripeJs | null> {
  if (!_stripePromise) _stripePromise = loadStripe(PUBLISHABLE_KEY);
  return _stripePromise;
}

function formatPounds(pence: number): string {
  if (pence === 0) return "Free";
  if (pence % 100 === 0) return `£${pence / 100}`;
  return `£${(pence / 100).toFixed(2)}`;
}

type Phase = "form" | "paying" | "paid" | "error";

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

export type MatchBookingTarget = {
  event_id: string;
  ticket_type_id: string;
  match_name: string;
  match_date: string;
  match_time: string | null;
  ticket_label: string;
  price_per_ticket_pence: number;
  capacity_remaining: number | null;
};

export default function InlineMatchBooking({
  target,
  onClose,
}: {
  target: MatchBookingTarget;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [quantity, setQuantity] = useState(2);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [heardFrom, setHeardFrom] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  const totalPence = target.price_per_ticket_pence * quantity;
  const maxQty = target.capacity_remaining ?? 10;

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
      setError("");
      setSubmitting(true);
      try {
        // Single round-trip: match-checkout validates, looks up the
        // event + ticket type, creates the Stripe PaymentIntent AND
        // inserts the event_entries row in one call. The function
        // uses the service_role key so it can insert even with RLS
        // locked down on the table.
        const res = await fetch(CHECKOUT_FN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            event_id: target.event_id,
            ticket_type_id: target.ticket_type_id,
            attendee_name: name.trim(),
            attendee_email: email.trim(),
            attendee_phone: phone.trim(),
            quantity,
            notes: notes.trim() || null,
            heard_from: heardFrom || null,
            marketing_opt_in: marketingOptIn,
          }),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(
            `Couldn't start payment (${res.status}): ${txt || "no detail"}`,
          );
        }
        const body = (await res.json()) as {
          client_secret?: string;
          entry_id?: string;
        };
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
      target.event_id,
      target.ticket_type_id,
      name,
      email,
      phone,
      notes,
      heardFrom,
      marketingOptIn,
      quantity,
    ],
  );

  // ----- 'paid' inline confirmation -----
  if (phase === "paid") {
    return (
      <div className="rounded-2xl border border-plonkTeal/40 bg-plonkTeal/10 p-8 text-center">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-plonkTeal">
          Payment received
        </div>
        <h3 className="mt-3 font-display text-3xl uppercase tracking-wider text-cream">
          You're in
        </h3>
        <p className="mt-3 text-sm text-cream/75">
          Confirmation email is on its way to <strong>{email}</strong>. Show it
          at the door — see you for kickoff.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 rounded-full border border-cream/15 px-5 py-2 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-plonkPink/30 bg-plonkPink/5 p-6">
      <div className="text-center">
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-plonkPink">
          {target.match_name} · {target.match_time?.slice(0, 5) || "TBC"}
        </div>
        <h3 className="mt-2 font-display text-2xl uppercase tracking-wider text-cream">
          Reserve your table
        </h3>
        <p className="mt-1 text-xs text-cream/55">
          {target.ticket_label} · {formatPounds(target.price_per_ticket_pence)}{" "}
          bar tab spend per table
        </p>
      </div>

      {phase === "form" && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <FormSection label="How many tables?">
            <NumberPicker
              value={quantity}
              min={1}
              max={maxQty}
              onChange={setQuantity}
            />
            <p className="mt-2 text-xs text-cream/55">
              Total · {formatPounds(totalPence)}
            </p>
          </FormSection>

          <div className="grid gap-4 sm:grid-cols-2">
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
              placeholder="We'll text you if anything changes"
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
              rows={2}
              className={inputCls}
              placeholder="Dietary, accessibility, big group splitting tables…"
            />
          </FormSection>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-cream/10 bg-ink/20 px-4 py-3 text-sm text-cream/85">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-plonkPink"
            />
            <span>
              Keep me in the loop — match nights, deals, etc. Unsubscribe
              anytime.
            </span>
          </label>

          {error && (
            <div className="rounded-lg border border-plonkPink/40 bg-plonkPink/10 px-4 py-3 text-sm text-plonkPink">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={onClose}
              className="text-xs uppercase tracking-wider text-cream/55 hover:text-cream"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-plonkPink px-7 py-3 text-sm font-bold uppercase tracking-widest text-white shadow-lg shadow-plonkPink/20 transition hover:bg-plonkPink/90 disabled:opacity-50"
            >
              {submitting
                ? "One sec…"
                : `Continue to payment · ${formatPounds(totalPence)}`}
            </button>
          </div>
        </form>
      )}

      {phase === "paying" && elementsOptions && (
        <div className="mt-6">
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
        <div className="mt-6 space-y-4 text-center">
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
  );
}

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
        return_url: `${window.location.origin}/worldcup/`,
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
