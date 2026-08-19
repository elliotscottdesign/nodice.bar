// =============================================================
// food-order-checkout — secure "On A Roll" food-order payment endpoint
// =============================================================
// POST /functions/v1/food-order-checkout
// Body (the customer's cart — NO row exists yet on the client side):
//   {
//     name: string,
//     phone: string,                       // UK mobile, for the "food ready" SMS
//     allergen_note?: string | null,
//     cart: [{ id: string, qty: number, addon_ids?: string[] }]
//   }
//
// Flow (mirrors pool-checkout exactly):
//   1. Validate the body server-side.
//   2. Confirm ordering isn't paused (manual or auto — same rule the
//      kitchen screen enforces).
//   3. Recompute the total from the live menu_catalog doc — NEVER
//      trust an amount from the browser.
//   4. Create a Stripe PaymentIntent for that total.
//   5. INSERT the food_orders row (service_role, bypasses RLS) as
//      status='pending', paid=false, with the intent id stamped.
//   6. Return { order_id, order_no, client_secret }.
//
// stripe-webhook (separate function) handles payment_intent.succeeded
// for metadata.kind='food_order' — flips status 'pending' → 'new' and
// paid=true, at which point the order appears on the kitchen screen.
// The kitchen tapping "Ready" is what fires the customer SMS (via the
// food-order function), not this endpoint.
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
function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "content-type": "application/json", ...(init.headers || {}) },
  });
}

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// UK mobile → E.164 so Twilio can text them. Best-effort; leaves an
// already-+ number alone.
function normalisePhone(raw: string): string {
  const s = String(raw || "").replace(/[^\d+]/g, "");
  if (s.startsWith("+")) return s;
  if (s.startsWith("07") && s.length === 11) return "+44" + s.slice(1);
  if (s.startsWith("447")) return "+" + s;
  if (s.startsWith("44")) return "+" + s;
  return s;
}

// Effective open/paused — same rule as the food-order function's getEffective.
async function orderingOpen(): Promise<{ open: boolean }> {
  const { data: s } = await db.from("food_settings").select("*").eq("id", 1).maybeSingle();
  const paused = !!s?.paused, auto = !!s?.auto_pause, threshold = s?.auto_threshold ?? 8;
  const { count } = await db
    .from("food_orders")
    .select("id", { count: "exact", head: true })
    .in("status", ["new", "preparing", "ready"]);
  const active = count || 0;
  return { open: !(paused || (auto && active >= threshold)) };
}

type CartLine = { id: string; qty: number; addon_ids?: string[] };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, { status: 405 });
  if (!STRIPE_SECRET_KEY) return json({ error: "STRIPE_SECRET_KEY not configured" }, { status: 500 });

  let b: {
    name?: string; phone?: string; allergen_note?: string | null; cart?: CartLine[];
  };
  try { b = await req.json(); } catch { return json({ error: "Invalid JSON body" }, { status: 400 }); }

  const name = String(b.name || "").trim();
  const phone = normalisePhone(String(b.phone || ""));
  const allergen_note = b.allergen_note ? String(b.allergen_note).trim().slice(0, 500) : null;
  const cart = Array.isArray(b.cart) ? b.cart.slice(0, 50) : [];

  if (name.length < 2) return json({ error: "Please enter your name." }, { status: 400 });
  if (phone.replace(/\D/g, "").length < 10) return json({ error: "Please enter a valid mobile number so we can text you when it's ready." }, { status: 400 });
  if (!cart.length) return json({ error: "Your order is empty." }, { status: 400 });

  // Ordering paused? (manual or auto). Match the kitchen rule so we never
  // take money for an order the kitchen isn't accepting.
  const { open } = await orderingOpen();
  if (!open) return json({ error: "Ordering is paused right now — please try again shortly.", open: false }, { status: 409 });

  // ── Recompute the total from the live menu (never trust the client) ──
  const { data: menu } = await db.from("menu_catalog").select("sections").eq("id", 1).maybeSingle();
  const sections: any[] = Array.isArray(menu?.sections) ? menu!.sections : [];
  const itemIndex = new Map<string, any>();
  for (const sec of sections) for (const it of (sec.items || [])) itemIndex.set(String(it.id), it);

  const lineItems: any[] = [];
  let total = 0;
  for (const line of cart) {
    const it = itemIndex.get(String(line.id));
    if (!it) return json({ error: "That menu has just changed — please refresh and try again." }, { status: 409 });
    const qty = Math.min(20, Math.max(1, parseInt(String(line.qty), 10) || 1));
    const addonIds = Array.isArray(line.addon_ids) ? line.addon_ids.map(String) : [];
    const chosen = (it.addons || []).filter((a: any) => addonIds.includes(String(a.id)));
    const options = chosen.map((a: any) => ({ name: a.name, price_pence: parseInt(a.price_pence, 10) || 0 }));
    const unit = (parseInt(it.sell_pence, 10) || 0) + options.reduce((s: number, o: any) => s + o.price_pence, 0);
    total += unit * qty;
    lineItems.push({ name: it.name, qty, price_pence: parseInt(it.sell_pence, 10) || 0, options });
  }
  if (total <= 0) return json({ error: "Could not price this order — please refresh and try again." }, { status: 400 });

  // Stripe FIRST — if Stripe rejects, no half-baked order row is written.
  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.create({
      amount: total,
      currency: "gbp",
      description: `On A Roll — ${lineItems.reduce((n, l) => n + l.qty, 0)} item(s)`,
      automatic_payment_methods: { enabled: true },
      metadata: { kind: "food_order", name },
    });
  } catch (e) {
    return json({ error: `Stripe create-intent failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }
  if (!intent.client_secret) return json({ error: "Stripe returned no client_secret" }, { status: 502 });

  // Insert the order as PENDING (not shown on the kitchen screen, not
  // counted toward auto-pause). The webhook flips it to 'new' + paid.
  const { data: row, error: insErr } = await db
    .from("food_orders")
    .insert({
      customer_name: name,
      customer_phone: phone,
      items: lineItems,
      total_pence: total,
      status: "pending",
      paid: false,
      payment_ref: intent.id,
      allergen_note,
    })
    .select("id, order_no")
    .single();
  if (insErr || !row) {
    await stripe.paymentIntents.cancel(intent.id, { cancellation_reason: "abandoned" }).catch(() => {});
    return json({ error: `Failed to save order: ${insErr?.message ?? "unknown error"}` }, { status: 500 });
  }

  // Stamp order_id onto the PI so the webhook can find the row by either route.
  await stripe.paymentIntents
    .update(intent.id, { metadata: { ...intent.metadata, order_id: row.id } })
    .catch((e) => console.warn(`Could not update PaymentIntent metadata: ${e}`));

  return json({ order_id: row.id, order_no: row.order_no, client_secret: intent.client_secret });
});
