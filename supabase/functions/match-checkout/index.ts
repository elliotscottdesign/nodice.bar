// =============================================================
// match-checkout — Stripe PaymentIntent for /world-cup tickets
// =============================================================
// POST /functions/v1/match-checkout
// Body: { entry_id: string, event_id: string }
//
// Flow:
//   1. Look up the pending event_entries row.
//   2. Look up the matching event + ticket_type (server-side so
//      the customer can't tamper with quantity / price).
//   3. Compute amount = ticket_type.price_pence × entry.quantity.
//   4. Create a Stripe PaymentIntent stamped with
//      metadata.kind='event_entry' so the webhook routes it.
//   5. Return { client_secret } for the inline Payment Element.
//
// The webhook (stripe-webhook) flips event_entries.status to 'paid'
// once payment_intent.succeeded fires.
// =============================================================

import Stripe from "https://esm.sh/stripe@17.4.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};
function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
}
function handlePreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return null;
}

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return jsonResponse({ error: "POST only" }, { status: 405 });
  }
  if (!STRIPE_SECRET_KEY) {
    return jsonResponse(
      { error: "STRIPE_SECRET_KEY not configured" },
      { status: 500 },
    );
  }

  let body: { entry_id?: string; event_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { entry_id, event_id } = body;
  if (!entry_id || !event_id) {
    return jsonResponse(
      { error: "Missing entry_id or event_id" },
      { status: 400 },
    );
  }

  // Entry
  const { data: entry, error: entryErr } = await db
    .from("event_entries")
    .select(
      "id, status, attendee_email, attendee_name, event_id, ticket_type_id, quantity",
    )
    .eq("id", entry_id)
    .maybeSingle();
  if (entryErr) {
    return jsonResponse(
      { error: `DB error on entry lookup: ${entryErr.message}` },
      { status: 500 },
    );
  }
  if (!entry) {
    return jsonResponse({ error: "Entry not found" }, { status: 404 });
  }
  if (entry.event_id !== event_id) {
    return jsonResponse(
      { error: "Entry doesn't belong to this event" },
      { status: 400 },
    );
  }
  if (entry.status !== "pending_payment") {
    return jsonResponse(
      { error: `Entry already in status '${entry.status}'` },
      { status: 409 },
    );
  }

  // Event — sanity check it's open and bookable
  const { data: ev, error: evErr } = await db
    .from("events")
    .select(
      "id, name, event_date, category, bookable, registration_open, max_attendees, paid_entries_count",
    )
    .eq("id", event_id)
    .maybeSingle();
  if (evErr) {
    return jsonResponse(
      { error: `DB error on event lookup: ${evErr.message}` },
      { status: 500 },
    );
  }
  if (!ev) {
    return jsonResponse({ error: "Event not found" }, { status: 404 });
  }
  if (!ev.registration_open) {
    return jsonResponse(
      { error: "Registration is closed for this match" },
      { status: 409 },
    );
  }
  if (!ev.bookable) {
    return jsonResponse(
      { error: "This match isn't publicly bookable" },
      { status: 409 },
    );
  }
  if (
    ev.max_attendees !== null &&
    ev.paid_entries_count + entry.quantity > ev.max_attendees
  ) {
    return jsonResponse(
      { error: "Not enough capacity left for this purchase" },
      { status: 409 },
    );
  }

  // Ticket type — price + active
  const { data: tt, error: ttErr } = await db
    .from("ticket_types")
    .select("id, name, price_pence, active, event_id")
    .eq("id", entry.ticket_type_id)
    .maybeSingle();
  if (ttErr) {
    return jsonResponse(
      { error: `DB error on ticket lookup: ${ttErr.message}` },
      { status: 500 },
    );
  }
  if (!tt) {
    return jsonResponse({ error: "Ticket type not found" }, { status: 404 });
  }
  if (!tt.active) {
    return jsonResponse(
      { error: "This ticket type is no longer on sale" },
      { status: 409 },
    );
  }
  if (tt.event_id !== event_id) {
    return jsonResponse(
      { error: "Ticket doesn't belong to this event" },
      { status: 400 },
    );
  }

  const qty = Math.max(1, entry.quantity);
  const amount = tt.price_pence * qty;
  if (amount <= 0) {
    return jsonResponse(
      { error: "Free tickets shouldn't go through Stripe — DB seed error" },
      { status: 400 },
    );
  }

  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.create({
      amount,
      currency: "gbp",
      receipt_email: entry.attendee_email,
      description: `${ev.name} — ${tt.name} × ${qty}`,
      automatic_payment_methods: { enabled: true },
      metadata: {
        kind: "event_entry",
        entry_id: entry.id,
        event_id: ev.id,
        event_name: ev.name,
        event_date: ev.event_date,
        category: ev.category,
        ticket_type_id: tt.id,
        quantity: String(qty),
        attendee_name: entry.attendee_name,
      },
    });
  } catch (e) {
    return jsonResponse(
      {
        error: `Stripe create-intent failed: ${
          e instanceof Error ? e.message : String(e)
        }`,
      },
      { status: 502 },
    );
  }

  if (!intent.client_secret) {
    return jsonResponse(
      { error: "Stripe returned no client_secret" },
      { status: 502 },
    );
  }

  // Stamp the intent id + final amount back onto the entry so the
  // webhook can confirm the right row even if metadata gets garbled.
  const { error: stampErr } = await db
    .from("event_entries")
    .update({
      stripe_payment_intent_id: intent.id,
      amount_paid_pence: amount,
    })
    .eq("id", entry.id);
  if (stampErr) {
    console.error(
      `Couldn't stamp intent ${intent.id} onto entry ${entry.id}: ${stampErr.message}`,
    );
  }

  return jsonResponse({ client_secret: intent.client_secret });
});
