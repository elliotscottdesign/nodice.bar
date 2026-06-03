"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { fmtMoney } from "@/lib/format";
import { loadCatalogue, type Catalogue } from "@/lib/db/catalogue";
import { lookupActivePromo, type DbPromoCode } from "@/lib/db/promos";
import {
  getStripe,
  CREATE_PAYMENT_INTENT_URL,
  SUPABASE_ANON_KEY,
} from "@/lib/stripe";

const HOLD_MS = 15 * 60 * 1000; // 15 minutes
const HOLD_KEY = "plonk_book_hold_expires_at";

function useHoldTimer(): { msLeft: number; expired: boolean } {
  const [msLeft, setMsLeft] = useState<number>(HOLD_MS);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let expiresAt = Number(sessionStorage.getItem(HOLD_KEY) || 0);
    if (!expiresAt || expiresAt < Date.now()) {
      expiresAt = Date.now() + HOLD_MS;
      sessionStorage.setItem(HOLD_KEY, String(expiresAt));
    }
    const tick = () => setMsLeft(Math.max(0, expiresAt - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return { msLeft, expired: msLeft <= 0 };
}

function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type Intent = {
  clientSecret: string;
  reference: string;
  totalPence: number;
};

function CheckoutInner() {
  const params = useSearchParams();

  const venueId = params.get("venue") || "hackney";
  const date = params.get("date") || "";
  const time = params.get("time") || "";
  const ticketsParam = params.get("tickets") || "{}";
  const addonsParam = params.get("addons") || "{}";
  const promoCode = params.get("promo") || "";
  const slotsParam = params.get("slots") || "[]";
  const slotGroups: { time: string; count: number }[] = (() => {
    try {
      const parsed = JSON.parse(slotsParam);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  // Load the venue's live catalogue from Supabase so we display the same
  // prices/names the create-payment-intent function will charge.
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadCatalogue(venueId)
      .then((c) => {
        if (cancelled) return;
        setCatalogue(c);
      })
      .catch((e) => {
        if (cancelled) return;
        setCatalogueError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [venueId]);

  const venue = catalogue?.venue ?? null;
  const ticketQty: Record<string, number> = (() => {
    try {
      return JSON.parse(ticketsParam);
    } catch {
      return {};
    }
  })();
  const addonQty: Record<string, number> = (() => {
    try {
      return JSON.parse(addonsParam);
    } catch {
      return {};
    }
  })();

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [heardFrom, setHeardFrom] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  const { msLeft, expired } = useHoldTimer();

  const tickets =
    catalogue?.tickets.filter((t) => (ticketQty[t.id] || 0) > 0) ?? [];
  const addons =
    catalogue?.addons.filter((a) => (addonQty[a.id] || 0) > 0) ?? [];

  // Client-side preview total — what we *show* in the summary. The real
  // amount charged is calculated server-side inside the Edge Function from
  // current DB prices, then echoed back. They should always agree, but the
  // server is the source of truth.
  let subtotal = 0;
  for (const t of tickets) subtotal += ticketQty[t.id] * t.pricePence;
  for (const a of addons) subtotal += addonQty[a.id] * a.pricePence;

  // Live promo lookup — the booking flow already verified this code, but
  // we look it up again here so the preview total matches what the Edge
  // Function will actually charge (the server is still the source of truth).
  const [promo, setPromo] = useState<DbPromoCode | null>(null);
  useEffect(() => {
    if (!promoCode) {
      setPromo(null);
      return;
    }
    let cancelled = false;
    lookupActivePromo(promoCode)
      .then((row) => {
        if (!cancelled) setPromo(row);
      })
      .catch(() => {
        if (!cancelled) setPromo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [promoCode]);
  const discount = promo
    ? promo.kind === "percent"
      ? Math.round((subtotal * promo.value) / 100)
      : Math.min(promo.value, subtotal)
    : 0;
  const previewTotal = Math.max(0, subtotal - discount);

  const fmtDate = (iso: string) => {
    if (!iso) return "";
    return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // --------- Customer details -> ready to create PaymentIntent ----------
  const detailsValid =
    !!email && !!firstName && !!lastName && !!phone && !!heardFrom;

  const [intent, setIntent] = useState<Intent | null>(null);
  const [intentError, setIntentError] = useState<string | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const intentRequestedRef = useRef(false);

  async function startPayment() {
    if (intentRequestedRef.current || intent || expired || !detailsValid) return;
    if (!venue || tickets.length === 0) return;
    intentRequestedRef.current = true;
    setIntentLoading(true);
    setIntentError(null);
    try {
      const res = await fetch(CREATE_PAYMENT_INTENT_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          venue_slug: venueId,
          slot_date: date,
          slot_groups: slotGroups,
          tickets: tickets.map((t) => ({
            name: t.name,
            quantity: ticketQty[t.id],
          })),
          addons: addons.map((a) => ({
            name: a.name,
            quantity: addonQty[a.id],
          })),
          promo_code: promoCode || undefined,
          customer: {
            name: `${firstName} ${lastName}`.trim(),
            email,
            phone,
            heard_from: heardFrom,
            marketing_opt_in: marketingOptIn,
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        intentRequestedRef.current = false;
        setIntentError(body?.error || `Request failed (${res.status})`);
        setIntentLoading(false);
        return;
      }
      setIntent({
        clientSecret: body.client_secret,
        reference: body.reference,
        totalPence: body.total_pence,
      });
      setIntentLoading(false);
    } catch (e) {
      intentRequestedRef.current = false;
      setIntentError(e instanceof Error ? e.message : "Network error");
      setIntentLoading(false);
    }
  }

  if (catalogueError) {
    return (
      <main className="bed-booking px-6 py-20 text-center">
        <h1 className="font-display text-3xl">Could not load checkout</h1>
        <p className="mt-3 text-sm text-cream/70">{catalogueError}</p>
      </main>
    );
  }

  if (!catalogue) {
    return (
      <main className="bed-booking px-6 py-20 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-cream/20 border-t-plonkYellow" />
        <p className="mt-6 text-sm text-cream/70">Loading checkout…</p>
      </main>
    );
  }

  if (!venue || tickets.length === 0) {
    return (
      <main className="bed-booking px-6 py-20 text-center">
        <h1 className="font-display text-3xl">Your basket is empty</h1>
        <Link
          href="/book"
          className="mt-6 inline-block rounded-full bg-plonkPink px-8 py-3 text-sm font-bold uppercase tracking-wider text-white"
        >
          Start a booking
        </Link>
      </main>
    );
  }

  const elementsOptions: StripeElementsOptions | null = intent
    ? {
        clientSecret: intent.clientSecret,
        appearance: {
          theme: "night",
          variables: {
            colorPrimary: "#ff3d8a",
            colorBackground: "#0E2A21",
            colorText: "#F2EBD9",
            colorDanger: "#ff6b6b",
            borderRadius: "10px",
            fontFamily: "DM Sans, system-ui, sans-serif",
          },
        },
      }
    : null;

  return (
    <main className="bed-booking px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/book/${venueId}`}
          className="text-xs font-semibold uppercase tracking-widest text-cream/60 hover:text-cream"
        >
          ← Back to booking
        </Link>
        <h1 className="mt-4 font-display text-4xl">Checkout</h1>
        <p className="mt-2 text-sm text-cream/70">
          Almost there — just your details, then payment.
        </p>

        {expired ? (
          <div className="mt-6 rounded-xl border border-red-400/40 bg-red-400/10 px-5 py-4">
            <p className="text-sm font-semibold text-red-300">
              Your 15-minute ticket hold has expired
            </p>
            <p className="mt-1 text-xs text-cream/70">
              Tickets have been released so other customers can book. Head
              back to the booking page to pick a slot again.
            </p>
            <Link
              href={`/book/${venueId}`}
              className="mt-3 inline-block rounded-full bg-plonkPink px-5 py-2 text-xs font-bold uppercase tracking-wider text-white"
            >
              Start again
            </Link>
          </div>
        ) : (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-plonkYellow/30 bg-plonkYellow/5 px-5 py-3 text-sm text-plonkYellow">
            <span aria-hidden className="text-lg">⏱</span>
            <span>
              Your tickets are held for{" "}
              <strong className="font-mono">{fmtCountdown(msLeft)}</strong>.
              Finish checkout before then.
            </span>
          </div>
        )}

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* Left column — details + payment */}
          <div className="space-y-6">
            <section className="rounded-2xl border border-cream/10 bg-ink/40 p-6">
              <h2 className="font-display text-xl">Your details</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="First name" required value={firstName} onChange={setFirstName} />
                <Field label="Last name" required value={lastName} onChange={setLastName} />
                <div className="sm:col-span-2">
                  <Field label="Email" type="email" required value={email} onChange={setEmail} />
                </div>
                <div className="sm:col-span-2">
                  <Field label="Phone" type="tel" required value={phone} onChange={setPhone} />
                </div>
                <div className="sm:col-span-2">
                  <SelectField
                    label="Where did you hear about us?"
                    required
                    value={heardFrom}
                    onChange={setHeardFrom}
                    options={[
                      { value: "", label: "Pick one…", disabled: true },
                      { value: "local", label: "Local" },
                      { value: "word_of_mouth", label: "Word of Mouth" },
                      { value: "google", label: "Google" },
                      { value: "social_media", label: "Social Media" },
                    ]}
                  />
                </div>
              </div>
              <label className="mt-4 flex items-start gap-3 text-sm text-cream/70">
                <input
                  type="checkbox"
                  checked={marketingOptIn}
                  onChange={(e) => setMarketingOptIn(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-cream/20 bg-ink/40"
                />
                <span>
                  Email me about Plonk deals and events — no spam, unsub
                  anytime.
                </span>
              </label>
            </section>

            <section className="rounded-2xl border border-cream/10 bg-ink/40 p-6">
              <h2 className="font-display text-xl">Payment</h2>
              <p className="mt-2 text-sm text-cream/70">
                Card, Apple Pay, Google Pay and Link all supported. You won't
                leave this page — the form below is hosted securely by Stripe.
              </p>

              {!intent && !intentLoading && !intentError && (
                <button
                  type="button"
                  onClick={startPayment}
                  disabled={expired || !detailsValid}
                  className="mt-5 w-full rounded-full border border-cream/20 py-3 text-sm font-bold uppercase tracking-wider text-cream transition hover:border-cream/50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {detailsValid
                    ? "Continue to payment"
                    : "Fill in your details to continue"}
                </button>
              )}

              {intentLoading && (
                <p className="mt-5 text-sm text-cream/60">
                  Preparing secure checkout…
                </p>
              )}

              {intentError && (
                <div className="mt-5 rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-300">
                  {intentError}
                </div>
              )}

              {intent && elementsOptions && (
                <div className="mt-5">
                  <Elements
                    stripe={getStripe()}
                    options={elementsOptions}
                  >
                    <PaymentForm
                      reference={intent.reference}
                      totalPence={intent.totalPence}
                      disabled={expired}
                      onPaying={() => sessionStorage.removeItem(HOLD_KEY)}
                    />
                  </Elements>
                </div>
              )}
            </section>
          </div>

          {/* Right column — summary */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-cream/10 bg-ink/60 p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-plonkYellow">
                {venue.name}
              </p>
              <p className="mt-2 font-display text-lg">{fmtDate(date)}</p>
              {slotGroups.length > 1 ? (
                <div className="mt-1 text-sm">
                  <p className="text-cream/70">Split across {slotGroups.length} start times:</p>
                  <ul className="mt-1 space-y-0.5">
                    {slotGroups.map((g) => (
                      <li key={g.time} className="font-mono text-xs text-plonkTeal">
                        {g.time} · {g.count} {g.count === 1 ? "player" : "players"}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-cream/70">{time}</p>
              )}

              <ul className="mt-5 divide-y divide-cream/10 border-y border-cream/10 text-sm">
                {tickets.map((t) => (
                  <li key={t.id} className="flex justify-between py-2.5">
                    <span>
                      {ticketQty[t.id]}× {t.name}
                    </span>
                    <span className="text-cream/85">
                      {fmtMoney(ticketQty[t.id] * t.pricePence)}
                    </span>
                  </li>
                ))}
                {addons.map((a) => (
                  <li key={a.id} className="flex justify-between py-2.5">
                    <span>
                      {addonQty[a.id]}× {a.name}
                    </span>
                    <span className="text-cream/85">
                      {fmtMoney(addonQty[a.id] * a.pricePence)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-cream/70">
                  <span>Subtotal</span>
                  <span>{fmtMoney(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-plonkTeal">
                    <span>Promo ({promoCode})</span>
                    <span>−{fmtMoney(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-cream/10 pt-2 text-lg">
                  <span>Total</span>
                  <span className="font-display">
                    {fmtMoney(intent?.totalPence ?? previewTotal)}
                  </span>
                </div>
                <p className="text-[10px] uppercase tracking-widest text-cream/40">
                  No VAT charged
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function PaymentForm({
  reference,
  totalPence,
  disabled,
  onPaying,
}: {
  reference: string;
  totalPence: number;
  disabled: boolean;
  onPaying: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || disabled) return;
    setSubmitting(true);
    setErr(null);
    onPaying();

    // Build the return URL — Stripe redirects here once 3DS / async methods
    // finish. We pass the reference so the success page can verify against
    // the DB. The payment_intent + status query params are added by Stripe.
    const base = `${window.location.origin}${window.location.pathname.replace(/checkout\/?$/, "success/")}`;
    const returnUrl = `${base}?ref=${encodeURIComponent(reference)}`;

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });

    if (error) {
      setErr(error.message ?? "Payment failed");
      setSubmitting(false);
    }
    // On success Stripe redirects, so we never reach this point.
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement options={{ layout: "tabs" }} />
      {err && (
        <div className="rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || !elements || disabled || submitting}
        className="w-full rounded-full bg-plonkPink py-4 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting
          ? "Processing…"
          : disabled
            ? "Hold expired — start again"
            : `Pay £${(totalPence / 100).toFixed(2)} →`}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
        {label}
        {required && <span className="text-plonkPink"> *</span>}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-2.5 text-sm text-cream placeholder:text-cream/30 focus:border-plonkPink focus:outline-none"
      />
    </label>
  );
}

// Custom dropdown — native <select> popups inherit OS chrome (grey/blue
// rectangle on macOS) which clashed with the booking flow's dark green
// palette. This is a button + panel built from divs so the styling
// matches the rest of the form. Hidden <input> keeps native form
// validation working for the required-field check.
function SelectField({
  label,
  value,
  onChange,
  required,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  options: { value: string; label: string; disabled?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value && !o.disabled);
  const placeholder = options.find((o) => o.disabled)?.label ?? "Pick one…";

  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
        {label}
        {required && <span className="text-plonkPink"> *</span>}
      </span>
      <div className="relative mt-1.5" ref={wrapperRef}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`flex w-full items-center justify-between rounded-lg border border-cream/15 bg-ink/40 px-4 py-2.5 text-left text-sm transition hover:border-cream/30 focus:border-plonkPink focus:outline-none ${
            open ? "border-plonkPink" : ""
          }`}
        >
          <span className={selected ? "text-cream" : "text-cream/40"}>
            {selected?.label ?? placeholder}
          </span>
          <span
            className={`ml-2 text-cream/50 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden
          >
            ▾
          </span>
        </button>

        {open && (
          <ul
            role="listbox"
            className="absolute left-0 right-0 z-20 mt-2 max-h-64 overflow-auto rounded-lg border border-cream/15 bg-ink/95 py-1.5 text-sm shadow-2xl backdrop-blur"
          >
            {options
              .filter((o) => !o.disabled)
              .map((o) => {
                const active = o.value === value;
                return (
                  <li
                    key={o.value}
                    role="option"
                    aria-selected={active}
                    onMouseDown={(e) => {
                      // mousedown (not click) closes immediately, before
                      // the doc-level mousedown listener can re-evaluate.
                      // stopPropagation keeps the bubble out of the
                      // wrapper button's toggler. preventDefault stops the
                      // follow-on click from re-firing this handler.
                      e.preventDefault();
                      e.stopPropagation();
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={`flex cursor-pointer items-center justify-between px-4 py-2 transition ${
                      active
                        ? "bg-plonkPink/15 text-cream"
                        : "text-cream/85 hover:bg-cream/5 hover:text-cream"
                    }`}
                  >
                    <span>{o.label}</span>
                    {active && (
                      <span aria-hidden className="text-plonkPink">
                        ✓
                      </span>
                    )}
                  </li>
                );
              })}
          </ul>
        )}

        {/* Hidden field keeps the surrounding <form>'s native required-check
            working — browsers don't see the custom dropdown as fillable. */}
        <input
          tabIndex={-1}
          aria-hidden
          required={required}
          value={value}
          onChange={() => {}}
          className="pointer-events-none absolute left-4 top-1/2 h-0 w-0 -translate-y-1/2 opacity-0"
        />
      </div>
    </label>
  );
}

export default function CheckoutClient() {
  return (
    <Suspense fallback={null}>
      <CheckoutInner />
    </Suspense>
  );
}
