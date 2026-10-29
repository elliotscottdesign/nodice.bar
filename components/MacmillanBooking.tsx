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
import type { EventTier } from "@/lib/db/tournaments";

// =============================================================
// MacmillanBooking — the £10 Macmillan 12-hour comp ticket flow
// =============================================================
// One player per ticket: name + email + phone + marketing opt-in (exactly the
// singles pool-comp fields). It books the SELECTED skill tier — each tier is its
// own events row, so `tier.id` is the tournament_id we book. Talks to the shared
// `tournament-checkout` Edge Function (which already accepts pool_special
// events), gets a Stripe PaymentIntent client_secret, and the EXISTING
// stripe-webhook flips the entry to 'paid' (kind='tournament_entry') with no
// backend change. Styled in the No Dice red (plonkPink #DA1B33).
// =============================================================

const RED = "#DA1B33"; // plonkPink / No Dice wordmark red
const TEAL = "#1ec8b8";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://rntcujcpsozvuxvmlejv.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const CHECKOUT_FN_URL = `${SUPABASE_URL}/functions/v1/tournament-checkout`;

let _stripePromise: Promise<StripeJs | null> | null = null;
function getStripePromise(): Promise<StripeJs | null> {
  if (!_stripePromise) _stripePromise = loadStripe(PUBLISHABLE_KEY);
  return _stripePromise;
}

function formatPounds(pence: number): string {
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}

type Phase = "form" | "paying" | "paid" | "error";

function buildAppearance(): StripeElementsOptions["appearance"] {
  return {
    theme: "night",
    variables: {
      colorPrimary: RED,
      colorBackground: "#0c0c0c",
      colorText: "#F2EBD9",
      colorTextSecondary: "rgba(242,235,217,0.55)",
      colorTextPlaceholder: "rgba(242,235,217,0.4)",
      colorDanger: "#ff6b6b",
      fontFamily: '"DM Sans", system-ui, -apple-system, sans-serif',
      fontSizeBase: "15px",
      spacingUnit: "4px",
      borderRadius: "10px",
    },
    rules: {
      ".Input": {
        backgroundColor: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(242,235,217,0.15)",
        padding: "12px 14px",
      },
      ".Input:focus": { border: `1px solid ${RED}`, boxShadow: `0 0 0 1px ${RED}` },
      ".Label": {
        color: "rgba(242,235,217,0.55)",
        fontSize: "10px",
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: "0.28em",
      },
      ".Tab": { backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(242,235,217,0.15)" },
      ".Tab--selected": { border: `1px solid ${RED}`, backgroundColor: "rgba(218,27,51,0.08)" },
    },
  };
}

export default function MacmillanBooking({
  tier,
  feePence = 1000,
  onClose,
}: {
  tier: EventTier;
  feePence?: number;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const elementsOptions = useMemo<StripeElementsOptions | null>(
    () => (clientSecret ? { clientSecret, appearance: buildAppearance(), loader: "auto" } : null),
    [clientSecret],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      const normUk = (v: string): string | null => {
        let n = String(v || "").replace(/[^0-9+]/g, "");
        if (n.startsWith("+")) n = n.slice(1);
        if (n.startsWith("00")) n = n.slice(2);
        if (n.startsWith("44")) n = "0" + n.slice(2);
        return /^07\d{9}$/.test(n) ? n : null;
      };
      const mob = normUk(phone);
      if (!mob) {
        setError("Please enter a UK mobile number (starting 07 or +44 7) — we text you the details before the day.");
        return;
      }
      const cleanName = name.trim();
      setSubmitting(true);
      try {
        const res = await fetch(CHECKOUT_FN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          // One player per ticket: their name doubles as team_name + captain_name
          // (keeps the shared tournament_entries shape + admin tracker happy).
          body: JSON.stringify({
            tournament_id: tier.id,
            team_name: cleanName,
            captain_name: cleanName,
            captain_email: email.trim(),
            captain_phone: mob,
            heard_from: "Macmillan 12hr comp page",
            notes: `Skill tier: ${tier.name}`,
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
          throw new Error(msg || `Couldn't start payment (${res.status}).`);
        }
        const body = (await res.json()) as { client_secret?: string };
        if (!body.client_secret) throw new Error("Server returned no client_secret");
        setClientSecret(body.client_secret);
        setPhase("paying");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't start payment — try again or email info@nodice.bar");
        setPhase("error");
      } finally {
        setSubmitting(false);
      }
    },
    [tier.id, tier.name, name, email, phone, marketingOptIn],
  );

  if (phase === "paid") {
    return (
      <div className="mt-3 rounded-xl border border-plonkTeal/40 bg-plonkTeal/10 px-6 py-8 text-center">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-plonkTeal">Payment received</div>
        <h3 className="mt-3 font-display text-2xl uppercase tracking-wider text-cream">You&apos;re in</h3>
        <p className="mt-3 text-sm text-cream/75">
          Your £10 goes straight to the Macmillan fundraiser. Confirmation is on its way to{" "}
          <strong>{email}</strong> — we&apos;ll text you the running order for the <strong>{tier.name}</strong> session.
          See you on the 15th!
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
    <div className="mt-3 rounded-xl border border-plonkPink/30 bg-plonkPink/5 p-6">
      <div className="mb-5 border-b border-cream/10 pb-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
          Your session
        </div>
        <div className="mt-1 font-display text-xl uppercase tracking-wider text-cream">
          {tier.name}
        </div>
        <div className="mt-1 text-xs text-cream/55">
          £10 · 100% to the Macmillan fundraiser · one player per ticket
        </div>
      </div>

      {phase === "form" && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
                Your name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
              Phone
            </label>
            <input
              type="tel"
              required
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9+ ]/g, ""))}
              placeholder="UK mobile (07… or +44 7…) — we text you the details"
              className="w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-cream/10 bg-ink/20 px-4 py-3 text-sm text-cream/85 transition hover:border-cream/25">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{ accentColor: RED }}
            />
            <span>
              Keep me in the loop — send me No Dice news, future comps and the odd offer. Unsubscribe anytime.
            </span>
          </label>

          {error && phase === "form" && (
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
              className="rounded-full bg-plonkPink px-7 py-3 text-sm font-bold uppercase tracking-widest text-white shadow-lg shadow-plonkPink/30 transition hover:bg-plonkPink/90 disabled:opacity-50"
            >
              {submitting ? "One sec…" : `Continue to payment · ${formatPounds(feePence)}`}
            </button>
          </div>
        </form>
      )}

      {phase === "paying" && elementsOptions && (
        <div>
          <div className="mb-5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-plonkPink">Payment</div>
            <h3 className="mt-2 font-display text-2xl uppercase tracking-wider text-cream">
              Pay {formatPounds(feePence)} to confirm
            </h3>
            <p className="mt-1 text-xs text-cream/55">
              Entry for <strong>{name}</strong> · {tier.name}
            </p>
          </div>
          <Elements stripe={getStripePromise()} options={elementsOptions}>
            <PaymentForm
              feeLabel={formatPounds(feePence)}
              onSuccess={() => setPhase("paid")}
              onError={(msg) => {
                setError(msg);
                setPhase("error");
              }}
              onCancel={onClose}
            />
          </Elements>
        </div>
      )}

      {phase === "error" && (
        <div className="space-y-4 text-center">
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
      setInlineErr(submitError.message ?? "Please check your card details and try again.");
      setSubmitting(false);
      return;
    }
    const { error } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: `${window.location.origin}/macmillan` },
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
        <PaymentElement options={{ layout: "tabs", wallets: { applePay: "auto", googlePay: "auto" } }} />
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
          className="rounded-full bg-plonkPink px-7 py-3 text-sm font-bold uppercase tracking-widest text-white shadow-lg shadow-plonkPink/30 transition hover:bg-plonkPink/90 disabled:opacity-50"
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
