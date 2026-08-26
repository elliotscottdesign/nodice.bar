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
import type { DbTournament } from "@/lib/db/tournaments";
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

  // Singles nights have no teams — the form asks only for the player's own
  // details (founder rule 3 Aug 2026). No "Team name" field; behind the scenes
  // the player's name doubles as team_name so the checkout function, admin
  // pages, confirmation emails and the /ops roster all keep working unchanged.
  // The cardholder ("name on card") is collected by Stripe's own payment box.
  const isSingles = tournament.tournament_type === "singles";
  // Doubles collect BOTH players (founder rule 6 Aug 2026): the prize tab
  // splits half-and-half, and each player's half is emailed to their own
  // address — so player 2's name + email are required at booking.
  const isDoubles =
    tournament.tournament_type === "doubles" ||
    tournament.tournament_type === "teams";   // ping pong teams = pairs too

  const [teamName, setTeamName] = useState("");
  const [captainName, setCaptainName] = useState("");
  const [captainEmail, setCaptainEmail] = useState("");
  const [captainPhone, setCaptainPhone] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [partnerPhone, setPartnerPhone] = useState("");
  const [heardFrom, setHeardFrom] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
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
      // UK mobiles only (founder rule) — but accept every real spelling of one:
      // 07…, +44 7…, 44 7…, 0044 7…, with spaces/dashes. Normalised to 07 form
      // before sending. Rejecting +44 autofill blocked real customers on
      // 20 Aug (Gordon, Thomas) — never again.
      const normUkMobile = (v: string): string | null => {
        let n = String(v || "").replace(/[^0-9+]/g, "");
        if (n.startsWith("+")) n = n.slice(1);
        if (n.startsWith("00")) n = n.slice(2);
        if (n.startsWith("44")) n = "0" + n.slice(2);
        return /^07\d{9}$/.test(n) ? n : null;
      };
      const capMob = normUkMobile(captainPhone);
      if (!capMob) {
        setError("Please enter a UK mobile number (starting 07 or +44 7) — we text you when you're up to play.");
        return;
      }
      const partMob = isDoubles ? normUkMobile(partnerPhone) : null;
      if (isDoubles && !partMob) {
        setError("Please enter your partner's UK mobile too (starting 07 or +44 7).");
        return;
      }
      setSubmitting(true);
      try {
        // Single round-trip: tournament-checkout validates, looks
        // up the event + entry fee, creates the Stripe PaymentIntent
        // AND inserts the tournament_entries row in one call. The
        // function uses the service_role key so it can insert even
        // with RLS locked down on the table.
        const res = await fetch(CHECKOUT_FN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            tournament_id: tournament.id,
            // Singles: the player's name stands in for the team name.
            team_name: (isSingles ? captainName : teamName).trim(),
            captain_name: captainName.trim(),
            captain_email: captainEmail.trim(),
            captain_phone: capMob,
            // Doubles: player 2's details — their half of any prize goes
            // straight to their own inbox.
            partner_name: isDoubles ? partnerName.trim() : null,
            partner_email: isDoubles ? partnerEmail.trim() : null,
            partner_phone: isDoubles ? partMob : null,
            player_count: null,
            notes: null,
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
      tournament.id,
      teamName,
      captainName,
      captainEmail,
      captainPhone,
      isSingles,
      isDoubles,
      partnerName,
      partnerEmail,
      heardFrom,
      marketingOptIn,
    ],
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
          {/* Team name only exists on team/doubles nights — a singles entrant
              just gives their own name. */}
          {!isSingles && (
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
              <p className="mt-1.5 text-[11px] text-cream/50">
                Can be changed later.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
                {isSingles ? "Your name" : "Captain name"}
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
                {isSingles ? "Email" : "Captain email"}
              </label>
              <input
                type="email"
                required
                value={captainEmail}
                onChange={(e) => setCaptainEmail(e.target.value)}
                className="w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none"
              />
              {/* League identity follows this email (founder rule 6 Aug 2026) —
                  changing it between nights would split the season record. */}
              <p className="mt-1.5 text-[11px] text-cream/50">
                {isSingles
                  ? "Use the same email every time you enter — your league points follow it."
                  : "Use the same captain email every night — that's how your team's league points add up."}
              </p>
            </div>
          </div>

          {/* Doubles: player 2's details — prizes split half-and-half and each
              player's half is emailed to their own address. */}
          {isDoubles && (
            <div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
                    Player 2 name
                  </label>
                  <input
                    type="text"
                    required
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    className="w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
                    Player 2 email
                  </label>
                  <input
                    type="email"
                    required
                    value={partnerEmail}
                    onChange={(e) => setPartnerEmail(e.target.value)}
                    className="w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none"
                  />
                  <input
                    type="tel"
                    required
                    value={partnerPhone}
                    onChange={(e) => setPartnerPhone(e.target.value.replace(/[^0-9+ ]/g, ""))}
                    inputMode="tel"
                    className="mt-2 w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none"
                    placeholder="Partner's UK mobile (07… or +44 7…)"
                  />
                </div>
              </div>
              <p className="mt-1.5 text-[11px] text-cream/50">
                Win and the bar-tab prize splits between you — each player gets
                their half by email.
              </p>
            </div>
          )}

          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
              {isSingles ? "Phone" : "Captain phone"}
            </label>
            <input
              type="tel"
              required
              value={captainPhone}
              onChange={(e) => setCaptainPhone(e.target.value.replace(/[^0-9+ ]/g, ""))}
              inputMode="tel"
              className="w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none"
              placeholder="UK mobile (07… or +44 7…) — we text you when you're up"
            />
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
              Where did you hear about us?
            </label>
            <BrandSelect
              value={heardFrom}
              onChange={setHeardFrom}
              options={HEARD_FROM_OPTIONS}
              placeholder="Pick one (optional)"
            />
          </div>

          {/* GDPR-compliant marketing opt-in. Unchecked by default,
              clear language about what they're signing up for. The
              flag goes straight onto the entry row. */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-cream/10 bg-ink/20 px-4 py-3 text-sm text-cream/85 transition hover:border-cream/25">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-plonkPink"
            />
            <span>
              Keep me in the loop — send me No Dice news, future
              tournament dates and the odd offer. Unsubscribe anytime.
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
              {isSingles ? (
                <>
                  Player: <strong>{captainName}</strong>
                </>
              ) : (
                <>
                  Team: <strong>{teamName}</strong> · Captain:{" "}
                  <strong>{captainName}</strong>
                </>
              )}
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
        return_url: `${window.location.origin}/pool/#tournaments`,
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
