// =============================================================
// pool-checkout — Stripe PaymentIntent for /book/pool
// =============================================================
// POST /functions/v1/pool-checkout
// Body: { reservation_id: string }
//
// Flow:
//   1. Look up the pending bar_reservations row.
//   2. Compute the fee server-side from `duration_minutes` (£6 per
//      30-minute slot) so the browser can't pass a tampered amount.
//   3. Create a Stripe PaymentIntent for that total.
//   4. Stamp the intent id back onto the reservation.
//   5. Return { client_secret } for the inline Payment Element.
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

// Price is recomputed server-side from the live config in Supabase
// (bookable_products + bookable_price_windows + bookable_date_overrides)
// so the customer can't tamper with the amount, and any admin price
// change applies immediately to new bookings.

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
    // Fail-closed wouldn't be customer-friendly, fail-open to the
    // legacy flat rate so a Supabase blip doesn't break checkout.
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

  let body: { reservation_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { reservation_id } = body;
  if (!reservation_id) {
    return jsonResponse({ error: "Missing reservation_id" }, { status: 400 });
  }

  const { data: r, error } = await db
    .from("bar_reservations")
    .select(
      "id, kind, status, reservation_date, start_time, duration_minutes, party_size, name, email",
    )
    .eq("id", reservation_id)
    .maybeSingle();
  if (error) {
    return jsonResponse(
      { error: `DB lookup error: ${error.message}` },
      { status: 500 },
    );
  }
  if (!r) {
    return jsonResponse({ error: "Reservation not found" }, { status: 404 });
  }
  if (r.kind !== "pool") {
    return jsonResponse(
      { error: "Reservation is not a pool booking" },
      { status: 400 },
    );
  }
  if (r.status !== "pending") {
    return jsonResponse(
      { error: `Reservation already in status '${r.status}'` },
      { status: 409 },
    );
  }

  // Master kill-switch — admin flips this in
  // /admin/products/pool. Customer can't bypass it by holding the
  // page open while we toggle.
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
    r.reservation_date,
    r.start_time,
    r.duration_minutes,
  );
  if (amount <= 0) {
    return jsonResponse(
      { error: "Could not compute a positive fee" },
      { status: 400 },
    );
  }

  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.create({
      amount,
      currency: "gbp",
      receipt_email: r.email,
      description: `Pool table — ${r.duration_minutes} min on ${r.reservation_date} at ${r.start_time}`,
      automatic_payment_methods: { enabled: true },
      metadata: {
        kind: "pool_reservation",
        reservation_id: r.id,
        reservation_date: r.reservation_date,
        start_time: r.start_time,
        duration_minutes: String(r.duration_minutes),
        party_size: String(r.party_size),
        name: r.name,
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

  const { error: stampErr } = await db
    .from("bar_reservations")
    .update({
      stripe_payment_intent_id: intent.id,
      amount_pence: amount,
    })
    .eq("id", r.id);
  if (stampErr) {
    console.error(
      `Couldn't stamp intent ${intent.id} onto reservation ${r.id}: ${stampErr.message}`,
    );
  }

  return jsonResponse({ client_secret: intent.client_secret });
});
