// =============================================================
// match-checkout — secure World Cup ticket endpoint
// =============================================================
// POST /functions/v1/match-checkout
// Body (full entry data — no row exists yet on the client side):
//   {
//     event_id: string,
//     ticket_type_id: string,
//     attendee_name: string,
//     attendee_email: string,
//     attendee_phone: string,
//     quantity: number,
//     notes?: string | null,
//     heard_from?: string | null,
//     marketing_opt_in?: boolean
//   }
//
// Flow:
//   1. Validate the body server-side.
//   2. Look up event + ticket_type — never trust the client price.
//   3. Verify the event is open + ticket is active + capacity remains.
//   4. Compute amount = ticket_type.price_pence × quantity.
//   5. Create a Stripe PaymentIntent.
//   6. INSERT the event_entries row using the service_role key with
//      the intent_id + amount already stamped.
//   7. Return { entry_id, client_secret }.
//
// Why this shape:
//   The customer-site browser holds only the anon key. With RLS
//   enabled on event_entries (the secure config), anon cannot
//   insert directly. So the insert lives here, where the
//   service_role key bypasses RLS server-side.
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type MatchBookingInput = {
  event_id: string;
  ticket_type_id: string;
  attendee_name: string;
  attendee_email: string;
  attendee_phone: string;
  quantity: number;
  notes?: string | null;
  heard_from?: string | null;
  marketing_opt_in?: boolean;
};

function validate(body: Partial<MatchBookingInput>): {
  ok: true;
  input: MatchBookingInput;
} | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body must be a JSON object" };
  }
  if (!body.event_id || !UUID_RE.test(body.event_id)) {
    return { ok: false, error: "event_id must be a UUID" };
  }
  if (!body.ticket_type_id || !UUID_RE.test(body.ticket_type_id)) {
    return { ok: false, error: "ticket_type_id must be a UUID" };
  }
  if (
    !body.attendee_name ||
    typeof body.attendee_name !== "string" ||
    body.attendee_name.trim().length < 2
  ) {
    return { ok: false, error: "attendee_name is required" };
  }
  if (
    !body.attendee_email ||
    typeof body.attendee_email !== "string" ||
    !EMAIL_RE.test(body.attendee_email)
  ) {
    return { ok: false, error: "valid attendee_email is required" };
  }
  if (
    !body.attendee_phone ||
    typeof body.attendee_phone !== "string" ||
    body.attendee_phone.trim().length < 5
  ) {
    return { ok: false, error: "attendee_phone is required" };
  }
  if (
    typeof body.quantity !== "number" ||
    body.quantity <= 0 ||
    body.quantity > 100
  ) {
    return { ok: false, error: "quantity must be 1-100" };
  }
  return {
    ok: true,
    input: {
      event_id: body.event_id,
      ticket_type_id: body.ticket_type_id,
      attendee_name: body.attendee_name.trim(),
      attendee_email: body.attendee_email.trim(),
      attendee_phone: body.attendee_phone.trim(),
      quantity: Math.floor(body.quantity),
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      heard_from:
        typeof body.heard_from === "string" ? body.heard_from.trim() || null : null,
      marketing_opt_in: !!body.marketing_opt_in,
    },
  };
}

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

  let raw: Partial<MatchBookingInput>;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  const v = validate(raw);
  if (!v.ok) return jsonResponse({ error: v.error }, { status: 400 });
  const input = v.input;

  // Event — sanity check it's open and bookable
  const { data: ev, error: evErr } = await db
    .from("events")
    .select(
      "id, name, event_date, category, bookable, registration_open, max_attendees, paid_entries_count",
    )
    .eq("id", input.event_id)
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
    ev.paid_entries_count + input.quantity > ev.max_attendees
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
    .eq("id", input.ticket_type_id)
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
  if (tt.event_id !== input.event_id) {
    return jsonResponse(
      { error: "Ticket doesn't belong to this event" },
      { status: 400 },
    );
  }

  // Match bookings are ONE TABLE PER BOOKING at a fixed fee — the
  // ticket_type.price_pence is the per-table cost. Founder rule
  // (2026-06-22): never multiply by party-size / quantity. If a
  // customer wants multiple tables they place separate bookings.
  // Hardcoded server-side so a tampered client payload can't bill a
  // customer for multiple tables.
  const quantityForBilling = 1;
  const amount = tt.price_pence * quantityForBilling;
  if (amount <= 0) {
    return jsonResponse(
      { error: "Free tickets shouldn't go through Stripe — DB seed error" },
      { status: 400 },
    );
  }

  // Stripe FIRST — if Stripe rejects, we never write an orphan entry.
  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.create({
      amount,
      currency: "gbp",
      receipt_email: input.attendee_email,
      description: `${ev.name} — ${tt.name} × ${input.quantity}`,
      automatic_payment_methods: { enabled: true },
      metadata: {
        kind: "event_entry",
        event_id: ev.id,
        event_name: ev.name,
        event_date: ev.event_date,
        category: ev.category,
        ticket_type_id: tt.id,
        quantity: String(input.quantity),
        attendee_name: input.attendee_name,
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

  // INSERT the entry with intent + amount already attached.
  const { data: entry, error: insertErr } = await db
    .from("event_entries")
    .insert({
      event_id: input.event_id,
      ticket_type_id: input.ticket_type_id,
      attendee_name: input.attendee_name,
      attendee_email: input.attendee_email,
      attendee_phone: input.attendee_phone,
      quantity: input.quantity,
      notes: input.notes,
      heard_from: input.heard_from,
      marketing_opt_in: input.marketing_opt_in,
      amount_paid_pence: amount,
      stripe_payment_intent_id: intent.id,
    })
    .select("id")
    .single();
  if (insertErr || !entry) {
    await stripe.paymentIntents
      .cancel(intent.id, { cancellation_reason: "abandoned" })
      .catch(() => {});
    return jsonResponse(
      {
        error: `Failed to save entry: ${
          insertErr?.message ?? "unknown error"
        }`,
      },
      { status: 500 },
    );
  }

  // Stamp the entry_id onto the Stripe metadata so the webhook can
  // find it without an extra lookup.
  await stripe.paymentIntents
    .update(intent.id, {
      metadata: {
        ...intent.metadata,
        entry_id: entry.id,
      },
    })
    .catch((e) => {
      console.warn(`Could not update PaymentIntent metadata: ${e}`);
    });

  return jsonResponse({
    entry_id: entry.id,
    client_secret: intent.client_secret,
  });
});
