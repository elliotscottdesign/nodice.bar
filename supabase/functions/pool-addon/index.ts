// =============================================================
// pool-addon — office adds pool time to an existing TABLE booking
// =============================================================
// POST /functions/v1/pool-addon
// Body:
//   {
//     parent_reservation_id: string,   // the table bar_reservations row
//     reservation_date: "YYYY-MM-DD",  // the pool slot (any day)
//     start_time: "HH:MM",             // the pool slot start
//     duration_minutes: number,        // any length
//     amount_pence?: number,           // office override; omit = auto from pool rate
//     resource_count?: number          // pool tables wanted (default 1)
//   }
//
// Office-initiated, so it DELIBERATELY SKIPS the public-booking guards
// (no same-day cutoff, no capacity cap, any duration). The office knows
// what it's doing — this is a staff tool, not the customer form.
//
// What it does:
//   1. Load the parent TABLE reservation (must exist, kind='table').
//   2. Work out the pool fee — from bookable_price_windows (same rate
//      the public pool flow uses) unless the office passed an override.
//   3. INSERT a SEPARATE pool row in bar_reservations (kind='pool',
//      parent_reservation_id = the table row). This is what BLOCKS the
//      pool slot — the overlap check in pool-checkout counts every
//      kind='pool' row, so a pending add-on holds the table straight
//      away, exactly like a normal pool booking.
//   4. Create a Stripe PAYMENT LINK for the fee (a permanent buy.stripe
//      URL the customer pays whenever they like — not an immediate
//      charge). metadata.kind='pool_addon' so stripe-webhook flips the
//      row to 'paid' when it's paid.
//   5. Stamp pool_pay_url on the row and return it.
//
// The customer gets NO second reservation email — the pay link is shown
// inside their existing table booking (admin + the table confirmation
// email via send-pool-confirmation).
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

// ---------- Pricing (mirrors pool-checkout) ----------
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
function pricePer30(windows: PriceWindow[], iso: string, slotMin: number): number {
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
async function feeFromConfig(
  isoDate: string,
  startTime: string,
  durationMinutes: number,
): Promise<number> {
  const { data, error } = await db
    .from("bookable_price_windows")
    .select("*")
    .eq("product_id", "pool")
    .order("priority", { ascending: false });
  if (error || !data) {
    // Fail-open to the legacy flat rate (£6 per 30 min).
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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

function durationLabel(min: number): string {
  if (min < 60) return `${min} min`;
  if (min % 60 === 0) return `${min / 60} hr${min === 60 ? "" : "s"}`;
  return `${(min / 60).toFixed(1)} hrs`;
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

  let body: {
    parent_reservation_id?: string;
    reservation_date?: string;
    start_time?: string;
    duration_minutes?: number;
    amount_pence?: number;
    resource_count?: number;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parentId = (body.parent_reservation_id ?? "").trim();
  if (!parentId) {
    return jsonResponse(
      { error: "parent_reservation_id is required" },
      { status: 400 },
    );
  }
  if (!body.reservation_date || !DATE_RE.test(body.reservation_date)) {
    return jsonResponse(
      { error: "reservation_date must be YYYY-MM-DD" },
      { status: 400 },
    );
  }
  if (!body.start_time || !TIME_RE.test(body.start_time)) {
    return jsonResponse({ error: "start_time must be HH:MM" }, { status: 400 });
  }
  if (
    typeof body.duration_minutes !== "number" ||
    body.duration_minutes <= 0 ||
    body.duration_minutes > 600
  ) {
    return jsonResponse(
      { error: "duration_minutes must be a positive number (max 600)" },
      { status: 400 },
    );
  }
  const startTime = body.start_time.length === 5
    ? `${body.start_time}:00`
    : body.start_time;
  const resourceCount = Math.max(
    1,
    Math.min(4, Math.round(body.resource_count ?? 1)),
  );

  // Load the parent table reservation. Must exist and be a table row —
  // we never hang a pool add-on off a pool booking or a World Cup entry.
  const { data: parent, error: parentErr } = await db
    .from("bar_reservations")
    .select("id, kind, name, email, phone, party_size, reservation_date")
    .eq("id", parentId)
    .maybeSingle();
  if (parentErr) {
    return jsonResponse(
      { error: `Parent lookup failed: ${parentErr.message}` },
      { status: 500 },
    );
  }
  if (!parent) {
    return jsonResponse({ error: "Parent reservation not found" }, { status: 404 });
  }
  if (parent.kind !== "table") {
    return jsonResponse(
      { error: "Pool time can only be added to a table reservation" },
      { status: 400 },
    );
  }

  // Fee: office override wins; otherwise compute from the pool rate.
  let amount: number;
  if (typeof body.amount_pence === "number" && body.amount_pence > 0) {
    amount = Math.round(body.amount_pence);
  } else {
    amount = await feeFromConfig(
      body.reservation_date,
      startTime,
      body.duration_minutes,
    );
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonResponse(
      { error: "Could not work out a positive pool fee" },
      { status: 400 },
    );
  }

  // 1. INSERT the pool add-on row — this is what blocks the slot.
  const { data: row, error: insertErr } = await db
    .from("bar_reservations")
    .insert({
      kind: "pool",
      parent_reservation_id: parentId,
      reservation_date: body.reservation_date,
      start_time: startTime,
      duration_minutes: body.duration_minutes,
      party_size: parent.party_size ?? 1,
      resource_count: resourceCount,
      name: parent.name,
      email: parent.email,
      phone: parent.phone,
      notes: `Pool add-on for ${parent.name}'s table booking (office-added)`,
      heard_from: "Office pool add-on",
      marketing_opt_in: false,
      amount_pence: amount,
      // Office-added, so it's a confirmed hold straight away — no Confirm/
      // Cancel step needed (founder 19 Oct 2026). Payment is separate: the
      // stripe-webhook flips 'confirmed' → 'paid' when the customer pays the
      // link; 'confirmed' still blocks the slot like any active pool row.
      status: "confirmed",
    })
    .select("id")
    .single();
  if (insertErr || !row) {
    return jsonResponse(
      {
        error: `Failed to save pool add-on: ${
          insertErr?.message ?? "unknown error"
        }`,
      },
      { status: 500 },
    );
  }

  // 2. Stripe Payment Link — a permanent URL the customer pays later.
  //    We make a one-off Price (inline product) for the exact amount,
  //    then a link for it. metadata.kind='pool_addon' routes the webhook.
  let payUrl: string;
  try {
    const price = await stripe.prices.create({
      currency: "gbp",
      unit_amount: amount,
      product_data: {
        name: `Pool table — ${durationLabel(body.duration_minutes)} on ${body.reservation_date} at ${startTime.slice(0, 5)}`,
      },
    });
    const meta = {
      kind: "pool_addon",
      reservation_id: row.id,
      parent_reservation_id: parentId,
    };
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: meta,
      payment_intent_data: { metadata: meta },
      // One-off fee — allow a single completed payment so a customer can't
      // accidentally pay the same pool add-on twice. The link then stops
      // accepting payments on its own; no webhook teardown needed.
      restrictions: { completed_sessions: { limit: 1 } },
      after_completion: {
        type: "hosted_confirmation",
        hosted_confirmation: {
          custom_message:
            "Thanks — your pool time is paid. See you at No Dice, London Fields!",
        },
      },
    });
    if (!link.url) throw new Error("Stripe returned no link URL");
    payUrl = link.url;
  } catch (e) {
    // Roll back the orphan row so we never leave a blocked slot with no
    // way for the customer to pay.
    await db.from("bar_reservations").delete().eq("id", row.id).catch(() => {});
    return jsonResponse(
      {
        error: `Stripe payment link failed: ${
          e instanceof Error ? e.message : String(e)
        }`,
      },
      { status: 502 },
    );
  }

  // 3. Stamp the pay link onto the row.
  const { error: updErr } = await db
    .from("bar_reservations")
    .update({ pool_pay_url: payUrl })
    .eq("id", row.id);
  if (updErr) {
    // Non-fatal: the row + link exist; the admin can still open the link
    // from Stripe. But surface it so the office knows.
    return jsonResponse(
      {
        reservation_id: row.id,
        pay_url: payUrl,
        amount_pence: amount,
        warning: `Saved, but could not stamp the link on the row: ${updErr.message}`,
      },
      { status: 200 },
    );
  }

  return jsonResponse({
    reservation_id: row.id,
    pay_url: payUrl,
    amount_pence: amount,
  });
});
