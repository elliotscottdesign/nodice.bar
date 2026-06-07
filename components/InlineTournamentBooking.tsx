"use client";

import { useCallback, useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import {
  createTournamentEntry,
  type DbTournament,
} from "@/lib/db/tournaments";

// =============================================================
// InlineTournamentBooking
// =============================================================
// Drops the full sign-up + payment flow inside an accordion-style
// row on /pool. State machine:
//
//   'form'    — captain fills team details, hits "Continue to payment"
//   'paying'  — Stripe Embedded Checkout mounted inline below; the
//               same panel keeps showing the tournament details so
//               there's no context loss
//   'paid'    — green "You're in" confirmation, no further action
//   'error'   — error banner with retry option
//
// Talks to the same `tournament-checkout` Edge Function the standalone
// page used, but the function now returns a Checkout Session
// client_secret (embedded mode) rather than a redirect URL.
// =============================================================

const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://rntcujcpsozvuxvmlejv.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const CHECKOUT_FN_URL = `${SUPABASE_URL}/functions/v1/tournament-checkout`;

// loadStripe should be called once at module scope per Stripe docs,
// not on every render. Memoised so React doesn't recreate it.
let _stripePromise: Promise<Stripe | null> | null = null;
function getStripePromise(): Promise<Stripe | null> {
  if (!_stripePromise) _stripePromise = loadStripe(PUBLISHABLE_KEY);
  return _stripePromise;
}

function formatPounds(pence: number): string {
  if (pence % 100 === 0) return `£${pence / 100}`;
  return `£${(pence / 100).toFixed(2)}`;
}

type Phase = "form" | "paying" | "paid" | "error";

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

  // Form fields. Keeping state local to this component means each
  // expanded row owns its own draft — if the customer collapses and
  // re-opens, that's a reset, which matches the mental model.
  const [teamName, setTeamName] = useState("");
  const [captainName, setCaptainName] = useState("");
  const [captainEmail, setCaptainEmail] = useState("");
  const [captainPhone, setCaptainPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Embedded Checkout options. `onComplete` fires when Stripe
  // confirms the payment AND the redirect_on_completion='never'
  // setting on the server tells Stripe to stay in the iframe — we
  // then flip our local phase to 'paid' for the inline confirmation.
  const checkoutOptions = useMemo(
    () =>
      clientSecret
        ? {
            clientSecret,
            onComplete: () => setPhase("paid"),
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
        // 1) Create the pending DB row. The Edge Function will look
        //    this up by id when minting the Stripe session.
        const entry = await createTournamentEntry({
          tournament_id: tournament.id,
          team_name: teamName.trim(),
          captain_name: captainName.trim(),
          captain_email: captainEmail.trim(),
          captain_phone: captainPhone.trim(),
          player_count: null,
          notes: null,
        });

        // 2) Ask the Edge Function for a Checkout Session client_secret.
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
            `Couldn't start checkout (${res.status}): ${txt || "no detail"}`,
          );
        }
        const body = (await res.json()) as { client_secret?: string };
        if (!body.client_secret) {
          throw new Error("Checkout returned no client_secret");
        }

        // 3) Move into 'paying' phase, which mounts the Embedded
        //    Checkout below the team form.
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

  // ---- 'paid' state: replace everything with a clean confirmation
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

      {phase === "paying" && checkoutOptions && (
        <div>
          <div className="mb-4 text-center">
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
          {/* Stripe Embedded Checkout mounts here. The provider needs
              a stable Promise for the Stripe instance and a stable
              clientSecret. The iframe handles all card collection +
              3D Secure inline. */}
          <div className="overflow-hidden rounded-lg bg-cream">
            <EmbeddedCheckoutProvider
              stripe={getStripePromise()}
              options={checkoutOptions}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
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
