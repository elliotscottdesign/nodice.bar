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
import {
  createTournamentEntry,
  type DbTournament,
} from "@/lib/db/tournaments";

// =============================================================
// InlineTournamentBooking — Stripe Payment Element edition
// =============================================================
// Drops the full sign-up + payment flow inside an accordion-style
// row on /pool. State machine:
//
//   'form'    — captain fills team details, hits "Continue to payment"
//   'paying'  — Payment Element mounted inline below; uses the
//               app's own dark theme (black background, cream text,
//               red accent) instead of Stripe's default light UI.
//               We render our own "Pay £X" button.
//   'paid'    — green "You're in" confirmation, no further action
//   'error'   — error banner with retry option
//
// Talks to the `tournament-checkout` Edge Function which now returns
// a PaymentIntent client_secret (no longer a Checkout Session).
// =============================================================

const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://rntcujcpsozvuxvmlejv.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const CHECKOUT_FN_URL = `${SUPABASE_URL}/functions/v1/tournament-checkout`;

// loadStripe should be called once per Stripe docs (not on every
// render). Memoised at module scope.
let _stripePromise: Promise<StripeJs | null> | null = null;
function getStripePromise(): Promise<StripeJs | null> {
  if (!_stripePromise) _stripePromise = loadStripe(PUBLISHABLE_KEY);
  return _stripePromise;
}

function formatPounds(pence: number): string {
  if (pence % 100 === 0) return `£${pence / 100}`;
  return `£${(pence / 100).toFixed(2)}`;
}

type Phase = "form" | "paying" | "paid" | "error";

// =============================================================
// No Dice Stripe appearance theme
// =============================================================
// Dark base ('night') + variables that line up with the rest of the
// site: black background, cream text, plonkPink (#DA1B33) for the
// active border / accent. The rules block adds the polish that the
// variables don't cover — input border radius, focus rings, etc.
// =============================================================
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

export default function InlineTournamentBooking({
  tournament,
  onClose,
}: {
  tournament: DbTournament;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const [teamName, setTeamName] = useState("");
  const [captainName, setCaptainName] = useState("");
  const [captainEmail, setCaptainEmail] = useState("");
  const [captainPhone, setCaptainPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const elementsOptions = useMemo<StripeElementsOptions | null>(
    () =>
      clientSecret
        ? {
            clientSecret,
            appearance: buildAppearance(),
            loader: "auto",
          }
        : null,
    [clientSecret],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setSubmitting(true);
      try {
        const entry = await createTournamentEntry({
          tournament_id: tournament.id,
          team_name: teamName.trim(),
          captain_name: captainName.trim(),
          captain_email: captainEmail.trim(),
          captain_phone: captainPhone.trim(),
          player_count: null,
          notes: null,
        });

        const res = await fetch(CHECKOUT_FN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            entry_id: entry.id,
            tournament_id: tournament.id,
          }),
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
    [tournament.id, teamName, captainName, captainEmail, captainPhone],
  );

  if (phase === "paid") {
    return (
      <div className="mt-3 rounded-xl border border-plonkTeal/40 bg-plonkTeal/10 px-6 py-8 text-center">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-plonkTeal">
          Payment received
        </div>
        <h3 className="mt-3 font-display text-2xl uppercase tracking-wider text-cream">
          You're in
        </h3>
        <p className="mt-3 text-sm text-cream/75">
          Confirmation email is on its way to <strong>{captainEmail}</strong>.
          See you on the night — bring your best stick.
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
      {phase === "form" && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
              Team name
            </label>
            <input
              type="text"
              required
              maxLength={80}
              placeholder="e.g. The Cue Tips"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
                Captain name
              </label>
              <input
                type="text"
                required
                value={captainName}
                onChange={(e) => setCaptainName(e.target.value)}
                className="w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
                Captain email
              </label>
              <input
                type="email"
                required
                value={captainEmail}
                onChange={(e) => setCaptainEmail(e.target.value)}
                className="w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
              Captain phone
            </label>
            <input
              type="tel"
              required
              value={captainPhone}
              onChange={(e) => setCaptainPhone(e.target.value)}
              className="w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none"
              placeholder="We'll text you about any updates"
            />
          </div>

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
              className="rounded-full bg-plonkPink px-7 py-3 text-sm font-bold uppercase tracking-widest text-white shadow-lg shadow-plonkPink/20 transition hover:bg-plonkPink/90 disabled:opacity-50"
            >
              {submitting
                ? "One sec…"
                : `Continue to payment · ${formatPounds(tournament.entry_fee_pence)}`}
            </button>
          </div>
        </form>
      )}

      {phase === "paying" && elementsOptions && (
        <div>
          <div className="mb-5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-plonkPink">
              Payment
            </div>
            <h3 className="mt-2 font-display text-2xl uppercase tracking-wider text-cream">
              Pay {formatPounds(tournament.entry_fee_pence)} to confirm
            </h3>
            <p className="mt-1 text-xs text-cream/55">
              Team: <strong>{teamName}</strong> · Captain:{" "}
              <strong>{captainName}</strong>
            </p>
          </div>
          {/* Stripe Payment Element mounted inside our themed wrapper.
              On success the form fires onSuccess() which flips us into
              the 'paid' phase. */}
          <Elements stripe={getStripePromise()} options={elementsOptions}>
            <PaymentForm
              feeLabel={formatPounds(tournament.entry_fee_pence)}
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

// =============================================================
// PaymentForm — the Stripe-driven card form + our Pay button
// =============================================================
// Lives inside <Elements> so useStripe / useElements work. Stripe's
// PaymentElement handles card / wallet collection; we wire up our
// own button so the styling, copy and disabled state match the rest
// of the schedule.
//
// `redirect: 'if_required'` keeps the customer on /pool for the
// vast majority of payments. Only triggers a browser-level redirect
// for 3D Secure flows that can't complete in an iframe, and even
// then they bounce back to `return_url`.
// =============================================================
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

    // Ensure the customer's input is valid before sending to Stripe.
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
        // Used only when 3D Secure forces a redirect; for the
        // majority of card payments the customer never leaves.
        return_url: `${window.location.origin}/nodice.bar/pool/#tournaments`,
      },
    });

    if (error) {
      // Inline errors (card declined etc.) — surface them right next
      // to the card field. Only escalate to the full error phase for
      // truly unexpected failures.
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

    // No error + no redirect = payment went through inline.
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
