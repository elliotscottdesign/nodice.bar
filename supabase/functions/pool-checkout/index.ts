// =============================================================
// pool-checkout — secure pool booking endpoint
// =============================================================
// POST /functions/v1/pool-checkout
// Body (full reservation data, no row exists yet on the client side):
//   {
//     reservation_date: "YYYY-MM-DD",
//     start_time: "HH:MM",
//     duration_minutes: number,
//     party_size: number,
//     resource_count: number,
//     name: string,
//     email: string,
//     phone?: string | null,
//     notes?: string | null,
//     heard_from?: string | null,
//     marketing_opt_in?: boolean
//   }
//
// Flow:
//   1. Validate the body server-side.
//   2. Confirm the "pool" product is enabled (admin kill-switch).
//   3. Compute the fee from bookable_price_windows — never trusted
//      from the client.
//   4. Create a Stripe PaymentIntent for that total.
//   5. INSERT the bar_reservations row using the service_role key
//      with the intent_id and amount already stamped — single round-
//      trip, no follow-up UPDATE needed.
//   6. Return { reservation_id, client_secret }.
//
// Why this shape:
//   The customer-site browser holds only the anon key. With RLS
//   enabled on bar_reservations (the secure config), anon cannot
//   insert directly. So the insert lives here, where the
//   service_role key bypasses RLS server-side.
//
// stripe-webhook (separate function) handles
// payment_intent.succeeded — flips status='pending' → 'paid' and
// stamps paid_at.
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

// =============================================================
// Pricing helpers — recompute the fee here so the browser can't
// pass a tampered amount.
// =============================================================
type PriceWindow = {
  days_of_week: number[];
  start_time: string;
  end_time: string;
  price_per_30min_pence: number;
  is_default: boolean;
  priority: number;
};

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function dayOfWeekUtc(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

function pricePer30(
  windows: PriceWindow[],
  iso: string,
  slotMin: number,
): number {
  const dow = dayOfWeekUtc(iso);
  for (const w of windows) {
    if (!w.days_of_week.includes(dow)) continue;
    const ws = timeToMin(w.start_time);
    const we = timeToMin(w.end_time);
    if (slotMin < ws || slotMin >= we) continue;
    return w.price_per_30min_pence;
  }
  const def = windows.find((w) => w.is_default);
  return def ? def.price_per_30min_pence : 0;
}

async function feeForBookingFromConfig(
  productId: string,
  isoDate: string,
  startTime: string,
  durationMinutes: number,
): Promise<number> {
  const { data, error } = await db
    .from("bookable_price_windows")
    .select("*")
    .eq("product_id", productId)
    .order("priority", { ascending: false });
  if (error || !data) {
    // Fail-open to the legacy flat rate so a Supabase blip doesn't
    // break checkout — better than 500-ing the customer.
    return Math.ceil(durationMinutes / 30) * 600;
  }
  const windows = data as PriceWindow[];
  const startMin = timeToMin(startTime);
  const blocks = Math.ceil(durationMinutes / 30);
  let total = 0;
  for (let i = 0; i < blocks; i++) {
    total += pricePer30(windows, isoDate, startMin + i * 30);
  }
  return total;
}

// =============================================================
// Input validation — the body is whatever the customer's browser
// posts, so we can't trust anything. Keep checks defensive but
// permissive enough that a normal happy-path booking sails through.
// =============================================================
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

type PoolBookingInput = {
  reservation_date: string;
  start_time: string;
  duration_minutes: number;
  party_size: number;
  resource_count: number;
  name: string;
  email: string;
  phone?: string | null;
  notes?: string | null;
  heard_from?: string | null;
  marketing_opt_in?: boolean;
};

function validate(body: Partial<PoolBookingInput>): {
  ok: true;
  input: PoolBookingInput;
} | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body must be a JSON object" };
  }
  if (!body.reservation_date || !DATE_RE.test(body.reservation_date)) {
    return { ok: false, error: "reservation_date must be YYYY-MM-DD" };
  }
  if (!body.start_time || !TIME_RE.test(body.start_time)) {
    return { ok: false, error: "start_time must be HH:MM" };
  }
  if (
    typeof body.duration_minutes !== "number" ||
    body.duration_minutes <= 0 ||
    body.duration_minutes > 600
  ) {
    return { ok: false, error: "duration_minutes must be a positive number" };
  }
  if (
    typeof body.party_size !== "number" ||
    body.party_size <= 0 ||
    body.party_size > 50
  ) {
    return { ok: false, error: "party_size must be 1-50" };
  }
  if (
    typeof body.resource_count !== "number" ||
    body.resource_count <= 0 ||
    body.resource_count > 10
  ) {
    return { ok: false, error: "resource_count must be 1-10" };
  }
  if (!body.name || typeof body.name !== "string" || body.name.trim().length < 2) {
    return { ok: false, error: "name is required" };
  }
  if (!body.email || typeof body.email !== "string" || !EMAIL_RE.test(body.email)) {
    return { ok: false, error: "valid email is required" };
  }
  return {
    ok: true,
    input: {
      reservation_date: body.reservation_date,
      start_time: body.start_time,
      duration_minutes: body.duration_minutes,
      party_size: body.party_size,
      resource_count: body.resource_count,
      name: body.name.trim(),
      email: body.email.trim(),
      phone: typeof body.phone === "string" ? body.phone.trim() || null : null,
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

  let raw: Partial<PoolBookingInput>;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  const v = validate(raw);
  if (!v.ok) return jsonResponse({ error: v.error }, { status: 400 });
  const input = v.input;

  // Master kill-switch — admin flips this in /admin/products/pool.
  const { data: product } = await db
    .from("bookable_products")
    .select("enabled, closed_message")
    .eq("id", "pool")
    .maybeSingle();
  if (product && product.enabled === false) {
    return jsonResponse(
      {
        error:
          product.closed_message ||
          "Pool table bookings are temporarily paused. DM us on Instagram if it's urgent.",
      },
      { status: 423 },
    );
  }

  const amount = await feeForBookingFromConfig(
    "pool",
    input.reservation_date,
    input.start_time,
    input.duration_minutes,
  );
  if (amount <= 0) {
    return jsonResponse(
      { error: "Could not compute a positive fee" },
      { status: 400 },
    );
  }

  // Stripe FIRST — if Stripe rejects, we never write a half-baked row.
  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.create({
      amount,
      currency: "gbp",
      receipt_email: input.email,
      description: `Pool table — ${input.duration_minutes} min on ${input.reservation_date} at ${input.start_time}`,
      automatic_payment_methods: { enabled: true },
      metadata: {
        kind: "pool_reservation",
        // reservation_id stamped after the insert via update; webhook
        // also tolerates the metadata being just the kind for first-pass
        // lookups.
        reservation_date: input.reservation_date,
        start_time: input.start_time,
        duration_minutes: String(input.duration_minutes),
        party_size: String(input.party_size),
        name: input.name,
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

  // Now INSERT the reservation row with everything attached. status
  // defaults to 'pending' via the DB; the webhook flips to 'paid' once
  // Stripe confirms.
  const { data: r, error: insertErr } = await db
    .from("bar_reservations")
    .insert({
      kind: "pool",
      reservation_date: input.reservation_date,
      start_time: input.start_time,
      duration_minutes: input.duration_minutes,
      party_size: input.party_size,
      resource_count: input.resource_count,
      name: input.name,
      email: input.email,
      phone: input.phone,
      notes: input.notes,
      heard_from: input.heard_from,
      marketing_opt_in: input.marketing_opt_in,
      amount_pence: amount,
      stripe_payment_intent_id: intent.id,
    })
    .select("id")
    .single();
  if (insertErr || !r) {
    // Best-effort: cancel the orphan PaymentIntent so the customer
    // doesn't see a stale Stripe object. If cancellation fails (rare),
    // we still return an error — Stripe will auto-expire it.
    await stripe.paymentIntents
      .cancel(intent.id, { cancellation_reason: "abandoned" })
      .catch(() => {});
    return jsonResponse(
      {
        error: `Failed to save reservation: ${
          insertErr?.message ?? "unknown error"
        }`,
      },
      { status: 500 },
    );
  }

  // Stamp the reservation_id onto the PaymentIntent metadata so the
  // webhook can find it by either route (metadata.reservation_id OR
  // by looking up via stripe_payment_intent_id).
  await stripe.paymentIntents
    .update(intent.id, {
      metadata: {
        ...intent.metadata,
        reservation_id: r.id,
      },
    })
    .catch((e) => {
      console.warn(`Could not update PaymentIntent metadata: ${e}`);
    });

  return jsonResponse({
    reservation_id: r.id,
    client_secret: intent.client_secret,
  });
});
