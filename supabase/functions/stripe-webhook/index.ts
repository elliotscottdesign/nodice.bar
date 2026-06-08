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

// =============================================================
// Tournament entry — checkout.session.completed handler
// =============================================================
// Tournament team sign-ups go through Stripe Checkout (rather than
// PaymentIntent). When the customer finishes paying, Stripe fires
// `checkout.session.completed`. We:
//   1. Look up tournament_entries by stripe_session_id.
//   2. Flip its status to 'paid', stamp paid_at, and stamp the
//      payment_intent_id so admin refunds work later.
//   3. (TODO) Trigger a confirmation email.
// Idempotent — Stripe may re-deliver the same event; we no-op if
// the row is already 'paid' or further along.
async function handleTournamentCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<Response> {
  if (session.payment_status !== "paid") {
    // Async payment methods can complete the session but defer
    // payment confirmation; we wait for the follow-up event.
    return new Response("session not paid yet", { status: 200 });
  }

  const { data: entry, error: lookupErr } = await db
    .from("tournament_entries")
    .select("id, status")
    .eq("stripe_session_id", session.id)
    .maybeSingle();
  if (lookupErr) {
    return new Response(
      `DB lookup error: ${lookupErr.message}`,
      { status: 500 },
    );
  }
  if (!entry) {
    // Stripe sometimes retries before our DB has committed the
    // session_id stamp — return 200 so Stripe doesn't keep
    // retrying forever. Next delivery will land after the row
    // exists.
    return new Response("entry not found (will retry)", { status: 200 });
  }
  if (entry.status === "paid" || entry.status === "refunded") {
    return new Response("already settled", { status: 200 });
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const { error: updateErr } = await db
    .from("tournament_entries")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: paymentIntentId,
    })
    .eq("id", entry.id);
  if (updateErr) {
    return new Response(
      `DB update error: ${updateErr.message}`,
      { status: 500 },
    );
  }

  console.log(
    `webhook checkout.session.completed: tournament_entry ${entry.id} → paid (pi=${paymentIntentId})`,
  );

  // Fire the No Dice branded confirmation email. Failures here MUST
  // NOT fail the webhook — Stripe would just keep retrying and we'd
  // re-send the same email each time. The entry is already paid in
  // the DB at this point; the email is a nice-to-have on top. An
  // admin "resend" button can re-trigger it manually.
  fireTournamentConfirmationEmail(entry.id).catch((e) => {
    console.error(
      `Tournament confirmation email failed for entry ${entry.id}:`,
      e,
    );
  });

  return new Response("ok", { status: 200 });
}

// =============================================================
// Tournament Payment Element handler
// =============================================================
// Newer Tournament entries (post-Payment-Element switch) pay through
// PaymentIntents directly. payment_intent.succeeded means the team
// is in. Other terminal states (canceled / payment_failed) just log
// — the entry stays as `pending_payment` and is reaped by the
// 15-minute capacity-check window in tournament-checkout, so no
// extra cleanup is needed.
async function handleTournamentPaymentIntent(
  pi: Stripe.PaymentIntent,
  eventType: string,
): Promise<Response> {
  const entryId = pi.metadata?.entry_id;
  if (!entryId) {
    return new Response("tournament_entry metadata missing entry_id", { status: 200 });
  }

  if (eventType !== "payment_intent.succeeded") {
    console.log(
      `tournament webhook ${eventType}: entry ${entryId} — non-success terminal state, leaving as pending`,
    );
    return new Response("ok (non-success)", { status: 200 });
  }

  // Look up the entry. Try by id first (metadata), fall back to
  // stripe_payment_intent_id in case metadata got stripped.
  let entry: { id: string; status: string } | null = null;
  {
    const { data, error } = await db
      .from("tournament_entries")
      .select("id, status")
      .eq("id", entryId)
      .maybeSingle();
    if (error) return new Response(`DB lookup error: ${error.message}`, { status: 500 });
    entry = data;
  }
  if (!entry) {
    const { data, error } = await db
      .from("tournament_entries")
      .select("id, status")
      .eq("stripe_payment_intent_id", pi.id)
      .maybeSingle();
    if (error) return new Response(`DB lookup error: ${error.message}`, { status: 500 });
    entry = data;
  }
  if (!entry) {
    return new Response("entry not found (will retry)", { status: 200 });
  }
  if (entry.status === "paid" || entry.status === "refunded") {
    return new Response("already settled", { status: 200 });
  }

  const { error: updateErr } = await db
    .from("tournament_entries")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: pi.id,
    })
    .eq("id", entry.id);
  if (updateErr) {
    return new Response(`DB update error: ${updateErr.message}`, { status: 500 });
  }

  console.log(
    `tournament webhook payment_intent.succeeded: entry ${entry.id} → paid (pi=${pi.id})`,
  );

  fireTournamentConfirmationEmail(entry.id).catch((e) => {
    console.error(
      `Tournament confirmation email failed for entry ${entry!.id}:`,
      e,
    );
  });

  return new Response("ok", { status: 200 });
}

// =============================================================
// Pool reservation Payment Element handler
// =============================================================
// Mirrors handleTournamentPaymentIntent but updates a row in
// `bar_reservations` and doesn't currently fire a confirmation
// email (the booking notes already trigger one via the older flow
// once the founder marks it confirmed). If the founder wants an
// auto-email here too we can add a send-pool-confirmation function
// later.
async function handlePoolReservationPaymentIntent(
  pi: Stripe.PaymentIntent,
  eventType: string,
): Promise<Response> {
  const reservationId = pi.metadata?.reservation_id;
  if (!reservationId) {
    return new Response("pool_reservation metadata missing reservation_id", {
      status: 200,
    });
  }
  if (eventType !== "payment_intent.succeeded") {
    console.log(
      `pool webhook ${eventType}: reservation ${reservationId} — non-success terminal state, leaving as pending`,
    );
    return new Response("ok (non-success)", { status: 200 });
  }

  // Locate the row by id (metadata) then fall back to payment intent id.
  let r: { id: string; status: string } | null = null;
  {
    const { data, error } = await db
      .from("bar_reservations")
      .select("id, status")
      .eq("id", reservationId)
      .maybeSingle();
    if (error) {
      return new Response(`DB lookup error: ${error.message}`, { status: 500 });
    }
    r = data;
  }
  if (!r) {
    const { data, error } = await db
      .from("bar_reservations")
      .select("id, status")
      .eq("stripe_payment_intent_id", pi.id)
      .maybeSingle();
    if (error) {
      return new Response(`DB lookup error: ${error.message}`, { status: 500 });
    }
    r = data;
  }
  if (!r) {
    return new Response("reservation not found (will retry)", { status: 200 });
  }
  if (r.status === "paid" || r.status === "refunded") {
    return new Response("already settled", { status: 200 });
  }

  const { error: updateErr } = await db
    .from("bar_reservations")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: pi.id,
    })
    .eq("id", r.id);
  if (updateErr) {
    return new Response(`DB update error: ${updateErr.message}`, {
      status: 500,
    });
  }

  console.log(
    `pool webhook payment_intent.succeeded: reservation ${r.id} → paid (pi=${pi.id})`,
  );

  // Fire-and-forget confirmation email. Failure must NOT fail the
  // webhook — Stripe would just retry and the customer would be
  // confirmed in the DB twice. The booking is already confirmed at
  // this point; the email is on top.
  firePoolConfirmationEmail(r.id).catch((e) => {
    console.error(
      `Pool confirmation email failed for reservation ${r!.id}:`,
      e,
    );
  });

  return new Response("ok", { status: 200 });
}

async function firePoolConfirmationEmail(reservationId: string): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/send-pool-confirmation`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ reservation_id: reservationId }),
    },
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
}

// =============================================================
// Event-entry Payment Element handler
// =============================================================
// Powers the World Cup ticketed-match flow (and any future
// ticketed event). Mirrors the tournament handler exactly — flips
// event_entries.status to 'paid' on success.
// =============================================================
async function handleEventEntryPaymentIntent(
  pi: Stripe.PaymentIntent,
  eventType: string,
): Promise<Response> {
  const entryId = pi.metadata?.entry_id;
  if (!entryId) {
    return new Response("event_entry metadata missing entry_id", {
      status: 200,
    });
  }
  if (eventType !== "payment_intent.succeeded") {
    console.log(
      `event-entry webhook ${eventType}: entry ${entryId} — non-success terminal state, leaving as pending`,
    );
    return new Response("ok (non-success)", { status: 200 });
  }

  // Locate by id (metadata) then fall back to payment intent id.
  let entry: { id: string; status: string } | null = null;
  {
    const { data, error } = await db
      .from("event_entries")
      .select("id, status")
      .eq("id", entryId)
      .maybeSingle();
    if (error) {
      return new Response(`DB lookup error: ${error.message}`, { status: 500 });
    }
    entry = data;
  }
  if (!entry) {
    const { data, error } = await db
      .from("event_entries")
      .select("id, status")
      .eq("stripe_payment_intent_id", pi.id)
      .maybeSingle();
    if (error) {
      return new Response(`DB lookup error: ${error.message}`, { status: 500 });
    }
    entry = data;
  }
  if (!entry) {
    return new Response("entry not found (will retry)", { status: 200 });
  }
  if (entry.status === "paid" || entry.status === "refunded") {
    return new Response("already settled", { status: 200 });
  }

  const { error: updateErr } = await db
    .from("event_entries")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: pi.id,
    })
    .eq("id", entry.id);
  if (updateErr) {
    return new Response(`DB update error: ${updateErr.message}`, {
      status: 500,
    });
  }

  console.log(
    `event-entry webhook payment_intent.succeeded: entry ${entry.id} → paid (pi=${pi.id})`,
  );

  fireEventEntryConfirmationEmail(entry.id).catch((e) => {
    console.error(
      `Event-entry confirmation email failed for entry ${entry!.id}:`,
      e,
    );
  });

  return new Response("ok", { status: 200 });
}

async function fireEventEntryConfirmationEmail(
  entryId: string,
): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/send-event-entry-confirmation`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ entry_id: entryId }),
    },
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
}

async function fireTournamentConfirmationEmail(entryId: string): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/send-tournament-confirmation`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Service-role key counts as a valid JWT to Edge Functions so
        // the email function can keep JWT verification on.
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ entry_id: entryId }),
    },
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${txt}`);
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

  // Legacy: Tournament entries USED to pay via Stripe Checkout (which
  // fires checkout.session.completed). Kept as a fallback for any
  // in-flight sessions while we migrated to Payment Element. New
  // tournament payments come through as payment_intent.succeeded with
  // metadata.kind === 'tournament_entry' and are handled further down.
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    return await handleTournamentCheckoutCompleted(session);
  }

  // We only care about PaymentIntent terminal states.
  if (!event.type.startsWith("payment_intent.")) {
    return new Response("ignored", { status: 200 });
  }

  const pi = event.data.object as Stripe.PaymentIntent;
  const reference = pi.metadata?.reference;

  // Tournament team entries now go through Payment Element →
  // payment_intent.succeeded. Route by metadata.kind so we don't
  // accidentally fall through into the bookings table lookup below.
  if (pi.metadata?.kind === "tournament_entry") {
    return await handleTournamentPaymentIntent(pi, event.type);
  }

  // Pool table reservations — same Payment Element pattern as
  // tournaments, but the row lives in bar_reservations.
  if (pi.metadata?.kind === "pool_reservation") {
    return await handlePoolReservationPaymentIntent(pi, event.type);
  }

  // Ticketed events (World Cup matches + any future cover-charge
  // events) — row lives in event_entries.
  if (pi.metadata?.kind === "event_entry") {
    return await handleEventEntryPaymentIntent(pi, event.type);
  }

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
