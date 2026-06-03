// =============================================================
// Plonk Golf — stripe-webhook
// =============================================================
// POST /functions/v1/stripe-webhook  (called by Stripe, not the browser)
//
// Stripe pings us when a PaymentIntent transitions to a terminal state.
// We verify the signature against STRIPE_WEBHOOK_SECRET and then:
//   - payment_intent.succeeded  → booking.status = 'confirmed'
//                                 + fire the booking-confirmation email
//   - payment_intent.canceled   → booking.status = 'cancelled'
//   - payment_intent.payment_failed → booking.status = 'expired'
//     (releases capacity; customer can retry from scratch)
//
// Signature verification uses Stripe's async helper because Deno's
// Web Crypto API is async-only.
// =============================================================

import Stripe from "https://esm.sh/stripe@17.4.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Fire the confirmation email. Failures here MUST NOT fail the webhook —
// Stripe would just keep retrying and we'd re-send the same email. The
// booking is already confirmed in the DB at this point; the email is a
// nice-to-have on top.
async function sendConfirmationEmail(bookingId: string): Promise<void> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/send-booking-confirmation`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Service-role key counts as a valid JWT to Supabase Edge Functions,
          // so the email function can keep JWT verification on.
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ booking_id: bookingId }),
      },
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error(
        `Email send failed for booking ${bookingId}: ${res.status} ${txt}`,
      );
    }
  } catch (e) {
    console.error(`Email send threw for booking ${bookingId}:`, e);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  if (!STRIPE_WEBHOOK_SECRET) {
    return new Response("STRIPE_WEBHOOK_SECRET not configured", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing stripe-signature", { status: 400 });

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(`Signature verification failed: ${msg}`, { status: 400 });
  }

  // We only care about PaymentIntent terminal states.
  if (!event.type.startsWith("payment_intent.")) {
    return new Response("ignored", { status: 200 });
  }

  const pi = event.data.object as Stripe.PaymentIntent;
  const reference = pi.metadata?.reference;

  // We always update by PaymentIntent ID (which we wrote when creating the
  // booking). Metadata is a useful sanity check but never the lookup key.
  const lookup = pi.id;

  let newStatus: string | null = null;
  switch (event.type) {
    case "payment_intent.succeeded":
      newStatus = "confirmed";
      break;
    case "payment_intent.canceled":
      newStatus = "cancelled";
      break;
    case "payment_intent.payment_failed":
      newStatus = "expired";
      break;
    default:
      return new Response("ignored", { status: 200 });
  }

  // Don't overwrite a confirmed booking with anything else — once paid,
  // it stays paid until a refund flow runs through a separate path.
  const { data: existing, error: lookupErr } = await db
    .from("bookings")
    .select("id, status")
    .eq("stripe_payment_intent_id", lookup)
    .maybeSingle();
  if (lookupErr) return new Response(`DB lookup error: ${lookupErr.message}`, { status: 500 });
  if (!existing) {
    // Stripe sometimes retries before our DB has committed — return 200 so
    // Stripe doesn't keep retrying forever. The retry within their schedule
    // will normally land after the DB write.
    return new Response("booking not found (will retry)", { status: 200 });
  }
  if (existing.status === "confirmed" && newStatus !== "confirmed") {
    return new Response("already confirmed", { status: 200 });
  }

  const wasAlreadyConfirmed = existing.status === "confirmed";

  const { error: updateErr } = await db
    .from("bookings")
    .update({ status: newStatus, expires_at: null })
    .eq("id", existing.id);
  if (updateErr) return new Response(`DB update error: ${updateErr.message}`, { status: 500 });

  console.log(
    `webhook ${event.type}: booking ${existing.id} (${reference ?? "no-ref"}) → ${newStatus}`,
  );

  // Only send the confirmation email on a fresh confirmation. If Stripe
  // re-sends payment_intent.succeeded later (their retry schedule), the
  // booking is already confirmed and we don't want to spam the customer.
  if (newStatus === "confirmed" && !wasAlreadyConfirmed) {
    await sendConfirmationEmail(existing.id);
  }

  return new Response("ok", { status: 200 });
});
