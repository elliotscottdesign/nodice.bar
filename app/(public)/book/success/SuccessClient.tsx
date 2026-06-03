"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GET_BOOKING_URL, SUPABASE_ANON_KEY } from "@/lib/stripe";

type SlotRow = { slot_date: string; slot_time: string; count: number };
type Booking = {
  reference: string;
  status: "pending" | "confirmed" | "cancelled" | "expired" | "refunded";
  total_pence: number;
  customer_name: string;
  customer_email: string;
  party_size: number;
  venue: { slug: string; name: string };
  slots: SlotRow[];
  tickets: { quantity: number; unit_price_pence: number; ticket: { name: string } }[];
  addons: { quantity: number; unit_price_pence: number; addon: { name: string } }[];
};

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 20_000;

function fmtMoney(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

function fmtDateLong(iso: string) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function trimTime(t: string) {
  return t?.slice(0, 5) ?? t;
}

function SuccessInner() {
  const params = useSearchParams();
  const ref = params.get("ref") || "";
  const paymentIntentId = params.get("payment_intent") || "";
  const redirectStatus = params.get("redirect_status") || "";

  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stillPending, setStillPending] = useState(false);

  useEffect(() => {
    if (!ref || !paymentIntentId) {
      setError("Missing booking reference. If you've just paid, check your email for confirmation.");
      return;
    }

    let cancelled = false;
    const startedAt = Date.now();

    async function poll() {
      while (!cancelled) {
        try {
          const res = await fetch(GET_BOOKING_URL, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              apikey: SUPABASE_ANON_KEY,
              authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              reference: ref,
              payment_intent_id: paymentIntentId,
            }),
          });
          const body = await res.json();
          if (!res.ok) {
            if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
              setError(body?.error || "Could not find your booking");
              return;
            }
          } else {
            const b = body.booking as Booking;
            if (cancelled) return;
            setBooking(b);
            if (b.status === "confirmed") return;
            if (b.status === "cancelled" || b.status === "expired") return;
            if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
              setStillPending(true);
              return;
            }
          }
        } catch {
          if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            setError("Network problem looking up your booking. Check your email.");
            return;
          }
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [ref, paymentIntentId]);

  // ---------- Failure / fall-back states ----------
  if (redirectStatus && redirectStatus !== "succeeded" && redirectStatus !== "processing") {
    return (
      <main className="bed-booking px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-4xl">Payment didn't go through</h1>
          <p className="mt-4 text-cream/80">
            Your card wasn't charged. Head back to the booking page and try
            again, or pick a different card.
          </p>
          <Link
            href="/book"
            className="mt-8 inline-block rounded-full bg-plonkPink px-6 py-3 text-sm font-bold uppercase tracking-wider text-white"
          >
            Try again
          </Link>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="bed-booking px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-4xl">Hmm, something's odd</h1>
          <p className="mt-4 text-cream/80">{error}</p>
          {ref && (
            <p className="mt-2 font-mono text-sm text-cream/60">Reference: {ref}</p>
          )}
        </div>
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="bed-booking px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-cream/20 border-t-plonkYellow" />
          <h1 className="mt-6 font-display text-3xl">Confirming your booking…</h1>
          <p className="mt-2 text-sm text-cream/70">
            Just a couple of seconds. Don't refresh the page.
          </p>
        </div>
      </main>
    );
  }

  const confirmed = booking.status === "confirmed";
  const showPendingNote = !confirmed && (stillPending || booking.status === "pending");

  return (
    <main className="bed-booking px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-plonkTeal/20 text-3xl text-plonkTeal">
          ✓
        </div>
        <h1 className="mt-6 font-display text-4xl sm:text-5xl">You're booked in!</h1>
        <p className="mt-3 text-cream/80">
          {`Thanks ${booking.customer_name.split(" ")[0]} — your booking is `}
          {confirmed ? "confirmed" : "going through"}.
          {" "}A confirmation email is on its way to{" "}
          <span className="text-cream">{booking.customer_email}</span>.
        </p>

        {showPendingNote && (
          <div className="mx-auto mt-6 max-w-md rounded-xl border border-plonkYellow/30 bg-plonkYellow/5 px-4 py-3 text-xs text-plonkYellow">
            Stripe is still finalising the payment. This usually clears in a
            few seconds — you don't need to pay again. We've held your slot
            and will email you the moment it's confirmed.
          </div>
        )}

        <div className="mt-10 rounded-2xl border border-cream/10 bg-ink/40 p-8 text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-plonkYellow">
            Booking reference
          </p>
          <p className="mt-1 font-mono text-2xl">{booking.reference}</p>

          <dl className="mt-6 space-y-3 border-t border-cream/10 pt-6 text-sm">
            <Row label="Venue" value={booking.venue.name} />
            <Row
              label="Date"
              value={fmtDateLong(booking.slots[0]?.slot_date ?? "")}
            />
            {booking.slots.length > 1 ? (
              <div className="flex justify-between">
                <dt className="text-cream/60">Start times</dt>
                <dd className="text-right">
                  {booking.slots.map((s) => (
                    <div
                      key={s.slot_time}
                      className="font-mono text-sm text-plonkTeal"
                    >
                      {trimTime(s.slot_time)} · {s.count}{" "}
                      {s.count === 1 ? "player" : "players"}
                    </div>
                  ))}
                </dd>
              </div>
            ) : (
              <Row
                label="Time"
                value={trimTime(booking.slots[0]?.slot_time ?? "")}
              />
            )}
            <Row label="Party" value={`${booking.party_size} people`} />
            <Row
              label="Total paid"
              value={fmtMoney(booking.total_pence)}
              bold
            />
          </dl>

          {booking.slots.length > 1 && (
            <p className="mt-4 rounded-lg border border-plonkTeal/30 bg-plonkTeal/5 p-3 text-xs leading-relaxed text-cream/80">
              One booking, one payment. Although your slots are apart, you can
              all play together at the later start time —{" "}
              <span className="font-mono text-plonkTeal">
                {trimTime(booking.slots[booking.slots.length - 1].slot_time)}
              </span>
              .
            </p>
          )}

          <p className="mt-6 text-xs text-cream/60">
            Show this reference (or your confirmation email) at the bar when
            you arrive. Easy.
          </p>
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="rounded-full border border-cream/20 px-6 py-3 text-sm font-bold uppercase tracking-wider text-cream"
          >
            Back to Plonk
          </Link>
          <Link
            href="/book"
            className="rounded-full bg-plonkPink px-6 py-3 text-sm font-bold uppercase tracking-wider text-white"
          >
            Book another
          </Link>
        </div>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-cream/60">{label}</dt>
      <dd className={bold ? "font-display text-xl text-cream" : "text-cream/90"}>
        {value}
      </dd>
    </div>
  );
}

export default function SuccessClient() {
  return (
    <Suspense fallback={null}>
      <SuccessInner />
    </Suspense>
  );
}
