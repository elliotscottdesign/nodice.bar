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

// =============================================================
// EventTicketBooking — on-site ticket purchase for any special event
// =============================================================
// A self-contained sign-up + card-payment flow for the shareable event
// page (/event?o=<id>). Mirrors the proven InlineTournamentBooking Stripe
// Payment Element flow (dark themed, inline, no redirect for most cards),
// but talks to the category-agnostic `event-checkout` Edge Function so it
// works for ANY ticketed event (a DJ night, a party, a one-off) — not just
// pool tournaments. event-checkout charges the event's own price and
// returns a PaymentIntent client_secret (or { free: true } for £0 RSVPs).
//
// State machine: 'form' → 'paying' → 'paid' | 'error'.
// =============================================================

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://rntcujcpsozvuxvmlejv.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const CHECKOUT_FN_URL = `${SUPABASE_URL}/functions/v1/event-checkout`;

let _stripePromise: Promise<StripeJs | null> | null = null;
function getStripePromise(): Promise<StripeJs | null> {
  if (!_stripePromise) _stripePromise = loadStripe(PUBLISHABLE_KEY);
  return _stripePromise;
}

function formatPounds(pence: number): string {
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}

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
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      fontSizeBase: "16px",
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
      ".Tab": {
        backgroundColor: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(245,239,227,0.15)",
      },
      ".Tab--selected": {
        border: "1px solid #DA1B33",
        backgroundColor: "rgba(218,27,51,0.08)",
      },
    },
  };
}

type Phase = "form" | "paying" | "paid" | "error";

// Inputs at 16px min so iOS doesn't zoom on focus.
const INPUT =
  "w-full rounded-xl border border-cream/15 bg-white/[0.04] px-4 py-3 text-base text-cream placeholder:text-cream/35 focus:border-plonkPink focus:outline-none focus:ring-1 focus:ring-plonkPink";
const LABEL =
  "mb-1.5 block text-[10px] font-bold uppercase tracking-[0.28em] text-cream/55";

export default function EventTicketBooking({
  eventId,
  eventName,
  pricePence,
}: {
  eventId: string;
  eventName: string;
  pricePence: number;
}) {
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isFree = pricePence === 0;
  const feeLabel = formatPounds(pricePence);

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

      // UK mobiles only (founder rule) — accept 07…, +44 7…, 44 7…, 0044 7…
      // with spaces/dashes, normalised to 07 form.
      const normUkMobile = (v: string): string | null => {
        let n = String(v || "").replace(/[^0-9+]/g, "");
        if (n.startsWith("+")) n = n.slice(1);
        if (n.startsWith("0044")) n = n.slice(4);
        else if (n.startsWith("44")) n = n.slice(2);
        if (n.startsWith("7")) n = "0" + n;
        return /^07\d{9}$/.test(n) ? n : null;
      };

      const cleanName = name.trim();
      if (cleanName.length < 2) {
        setError("Please enter your name.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError("Please enter a valid email so we can send your ticket.");
        return;
      }
      const mob = normUkMobile(phone);
      if (!mob) {
        setError(
          "Please enter a UK mobile (starting 07 or +44 7) — we text you the details before the night.",
        );
        return;
      }

      setSubmitting(true);
      try {
        const res = await fetch(CHECKOUT_FN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            event_id: eventId,
            name: cleanName,
            email: email.trim(),
            phone: mob,
            marketing_opt_in: marketingOptIn,
          }),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          let msg = txt;
          try {
            const j = JSON.parse(txt) as { error?: string };
            if (j.error) msg = j.error;
          } catch {
            /* keep raw text */
          }
          throw new Error(msg || `Couldn't complete that (${res.status}).`);
        }
        const body = (await res.json()) as {
          client_secret?: string;
          free?: boolean;
        };
        if (body.free) {
          setPhase("paid");
          return;
        }
        if (!body.client_secret) throw new Error("Server returned no client_secret");
        setClientSecret(body.client_secret);
        setPhase("paying");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong — try again or email info@nodice.bar",
        );
        setPhase("error");
      } finally {
        setSubmitting(false);
      }
    },
    [eventId, name, email, phone, marketingOptIn],
  );

  if (phase === "paid") {
    return (
      <div className="rounded-2xl border border-plonkTeal/40 bg-plonkTeal/10 px-6 py-10 text-center">
        <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-plonkTeal">
          {isFree ? "You're on the list" : "Payment received"}
        </div>
        <h3 className="mt-3 font-display text-3xl uppercase tracking-wider text-cream">
          You&apos;re in
        </h3>
        <p className="mx-auto mt-3 max-w-sm text-sm text-cream/70">
          We&apos;ve got your {isFree ? "spot" : "ticket"} for {eventName}. Check
          your email for confirmation — see you on the night.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-cream/15 bg-ink/40 p-6 sm:p-8">
      <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-plonkPink">
        {isFree ? "Free entry · sign up" : `Get tickets · ${feeLabel}`}
      </div>

      {phase === "form" || phase === "error" ? (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className={LABEL} htmlFor="et-name">
              Your name
            </label>
            <input
              id="et-name"
              className={INPUT}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="First and last name"
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="et-email">
              Email
            </label>
            <input
              id="et-email"
              type="email"
              inputMode="email"
              className={INPUT}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@email.com"
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="et-phone">
              Mobile
            </label>
            <input
              id="et-phone"
              type="tel"
              inputMode="tel"
              className={INPUT}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              placeholder="07…"
            />
          </div>
          <label className="flex items-start gap-3 text-sm text-cream/70">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#DA1B33]"
            />
            <span>Keep me posted on nights at No Dice (optional).</span>
          </label>

          {error && (
            <div className="rounded-lg border border-plonkPink/40 bg-plonkPink/10 px-4 py-3 text-sm text-plonkPink">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-full bg-plonkPink px-8 py-4 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-plonkPink/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? "One sec…"
              : isFree
                ? "Sign up"
                : `Continue to payment · ${feeLabel}`}
          </button>
        </form>
      ) : null}

      {phase === "paying" && elementsOptions && (
        <div className="mt-5">
          <Elements stripe={getStripePromise()} options={elementsOptions}>
            <PaymentForm
              feeLabel={feeLabel}
              onSuccess={() => setPhase("paid")}
              onError={(msg) => {
                setError(msg);
                setPhase("error");
              }}
            />
          </Elements>
        </div>
      )}
    </div>
  );
}

// =============================================================
// PaymentForm — Stripe Payment Element + our own Pay button
// =============================================================
function PaymentForm({
  feeLabel,
  onSuccess,
  onError,
}: {
  feeLabel: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
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
        // Only used if 3D Secure forces a redirect; most cards never leave.
        return_url: `${window.location.origin}/event`,
      },
    });

    if (error) {
      if (error.type === "card_error" || error.type === "validation_error") {
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

      <button
        type="button"
        onClick={handlePay}
        disabled={!stripe || submitting}
        className="inline-flex w-full items-center justify-center rounded-full bg-plonkPink px-8 py-4 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-plonkPink/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Processing…" : `Pay ${feeLabel}`}
      </button>
    </div>
  );
}
