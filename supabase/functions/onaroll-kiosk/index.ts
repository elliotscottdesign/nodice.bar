// =============================================================
// onaroll-kiosk — self-serve iPad KIOSK order + payment endpoint
// =============================================================
// Stage 1 of the On A Roll self-serve till: a portrait iPad at the food van
// where the customer orders and pays THEMSELVES on a SumUp Solo card reader,
// with zero staff interaction (one chef, busy cooking).
//
// POST /functions/v1/onaroll-kiosk
//
//   { action: "createOrder", name, phone, email?, note?, allergen_note?,
//     tip_pct?, tip_pence?, cart: [ { id, qty, addon_ids? } | { bundle_id, qty } ] }
//       → prices the cart SERVER-SIDE from the live menu (never trusts the
//         client — mirrors food-order-checkout, bundle lines included), checks
//         open/closed + stock, inserts a food_orders row as:
//           status='pending', paid=false, source='kiosk',
//           payment_provider='sumup', sumup_client_tx_id=<fresh uuid>
//         → returns { order_id, order_no, client_tx_id, amount_pence }.
//
//   { action: "takePayment", order_id, client_tx_id }
//       → triggers the card-present charge on the Solo and marks the order paid.
//         ***STUB*** right now: it just flips the order to paid+'new' so the
//         whole flow runs end-to-end into the kitchen KDS + "ready" SMS. The
//         REAL SumUp Cloud API wiring is written below behind SUMUP_LIVE — see
//         tillCharge() + the webhook route — and is a drop-in once SumUp enables
//         unattended Cloud API access on merchant MY3311CY and we have the keys.
//
//   { action: "sumupWebhook", ... }   ***not live yet*** — see handleWebhook()
//
// WHY a pending→paid split (not one shot): a card-present charge can be declined
// or time out at the reader. We create the order first (so it has a number and a
// client_transaction_id for idempotency), THEN charge, THEN mark paid only on a
// successful reader result — exactly how food-order-checkout does it with Stripe.
//
// An order reaches the kitchen screen + the "ready"-SMS flow the instant it is
// paid+'new' (the KDS lists status in new/preparing/ready; the kitchen tapping
// "Ready" fires the SMS via the food-order function — unchanged, provider-agnostic).
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};
function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "content-type": "application/json", ...(init.headers || {}) },
  });
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// Admin gate for the one-off pairing call (same shared secret the food-order fn uses).
const SEND_SECRET = Deno.env.get("SEND_SECRET") ?? "";

// ── SumUp Cloud API config (PENDING the keys below — see the go-live checklist) ──
// Set SUMUP_LIVE=true only once every one of these is in place. Until then the
// takePayment action runs the STUB (mark-paid) so the kiosk works end-to-end.
// Confirmed by SumUp Integration Team (29 Oct 2026).
const SUMUP_LIVE = (Deno.env.get("SUMUP_LIVE") ?? "") === "true";
// The SECRET API key (Dashboard → Settings → For Developers → API Keys), sent as a
// Bearer credential. NOT the public key, and no separate OAuth token is needed.
const SUMUP_API_KEY = Deno.env.get("SUMUP_API_KEY") ?? "";
// The ACCOUNT merchant code (dashboard top-left under the business name). Confirmed
// via GET /v0.1/me on 29 Oct 2026 to be "MY3311CY" for No Dice Bars Ltd. (SumUp
// support had called this the "device identifier", but the API returns it as the
// merchant_code — it's what goes in the /merchants/{code}/... path.) Set as a secret.
const SUMUP_MERCHANT_CODE = Deno.env.get("SUMUP_MERCHANT_CODE") ?? "";
// The paired Solo's reader id — begins with "rdr_" (returned by Create Reader at
// pairing time). This is the separate per-reader id, not the merchant code.
const SUMUP_READER_ID = Deno.env.get("SUMUP_READER_ID") ?? "";
// Affiliate key + application id identify THIS app; they go in the `affiliate`
// section of every reader-checkout (separate from the secret API key).
// Dashboard → For Developers → Affiliate Keys.
const SUMUP_AFFILIATE_KEY = Deno.env.get("SUMUP_AFFILIATE_KEY") ?? "";
const SUMUP_APP_ID = Deno.env.get("SUMUP_APP_ID") ?? "nodice-onaroll-kiosk";
const SUMUP_API_BASE = Deno.env.get("SUMUP_API_BASE") ?? "https://api.sumup.com";
// Where SumUp POSTs the solo.transaction.updated event. Point this at THIS function:
//   https://<project>.supabase.co/functions/v1/onaroll-kiosk  (action:"sumupWebhook")
const SUMUP_WEBHOOK_URL = Deno.env.get("SUMUP_WEBHOOK_URL") ?? "";
//
// ── ONE-TIME PAIRING (per SumUp Integration Team, 29 Oct 2026) ──────────────────
// Pairs the physical Solo to the merchant account. Done ONCE, reader LOGGED OUT:
//   1. On the Solo: connect to the internet and log out of the SumUp account.
//   2. On the Solo: Connections → API → Connect → the Solo shows a PAIRING CODE.
//   3. Within 5 MINUTES our server POSTs { pairing_code, name } to Create Reader
//      (POST /v0.1/merchants/{MERCHANT_CODE}/readers) — see the `pairReader` action
//      below — which returns the reader id "rdr_…". Store it as SUMUP_READER_ID.
//   Reader + our server both need internet, but NOT the same network.
//   Refs: https://developer.sumup.com/terminal-payments/cloud-api/
//         https://developer.sumup.com/api/readers/create-checkout/
//
// ⚠️ NOT fully unattended (SumUp, 29 Oct): the customer presses Pay in the kiosk and
// completes on the reader (incl. PIN if asked), but staff may occasionally need to
// assist at the device — the kiosk's error/"see staff" path covers that.

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ── helpers shared in spirit with food-order-checkout ───────────────────────────
function normalisePhone(raw: string): string {
  const s = String(raw || "").replace(/[^\d+]/g, "");
  if (s.startsWith("+")) return s;
  if (s.startsWith("07") && s.length === 11) return "+44" + s.slice(1);
  if (s.startsWith("447")) return "+" + s;
  if (s.startsWith("44")) return "+" + s;
  return s;
}
function londonMinutes(): number {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const h = Number(p.find((x) => x.type === "hour")?.value ?? "0");
  const m = Number(p.find((x) => x.type === "minute")?.value ?? "0");
  return (h % 24) * 60 + m;
}
function hhmmToMin(s?: string | null): number | null {
  const mt = /^(\d{1,2}):(\d{2})$/.exec(String(s || "").trim());
  return mt ? Number(mt[1]) * 60 + Number(mt[2]) : null;
}

// Normalise a SumUp reader callback (or our own sumupWebhook body) into a flat
// shape. SumUp may nest the fields under `payload` or `transaction`, and names the
// id either client_transaction_id or foreign_transaction_id (we send ours as both).
function parseSumupHook(b: any): { clientTxId: string; status: string; txCode: string; reason: string } | null {
  const p = b?.payload || b?.transaction || {};
  const clientTxId = String(b.client_transaction_id || p.client_transaction_id || b.foreign_transaction_id || p.foreign_transaction_id || b.checkout_reference || p.checkout_reference || "");
  const status = String(b.status || p.status || "").toLowerCase();
  const txCode = String(b.transaction_code || p.transaction_code || b.transaction_id || p.transaction_id || "");
  const reason = String(b.reason || p.reason || b.error || p.error || "");
  if (!clientTxId && !status) return null;   // not a SumUp callback
  return { clientTxId, status, txCode, reason };
}
// Same open/paused rule the kitchen screen + food-order-checkout enforce.
async function orderingOpen(): Promise<{ open: boolean; reason: string | null; waiting?: number }> {
  const { data: s } = await db.from("food_settings").select("*").eq("id", 1).maybeSingle();
  const paused = !!s?.paused, auto = !!s?.auto_pause, threshold = s?.auto_threshold ?? 8;
  const nowMin = londonMinutes(), closeMin = hhmmToMin(s?.close_hhmm || "22:00"), openMin = hhmmToMin(s?.open_hhmm);
  const outsideHours = (closeMin != null && nowMin >= closeMin) || (openMin != null && nowMin < openMin);
  const { count } = await db.from("food_orders").select("id", { count: "exact", head: true }).in("status", ["new", "preparing", "ready"]);
  const active = count || 0;
  const autoTripped = auto && threshold >= 1 && active >= threshold;
  const open = !(outsideHours || paused || autoTripped);
  const reason = outsideHours ? "closed" : paused ? "paused" : autoTripped ? "busy" : null;
  return { open, reason, waiting: active };
}

type CartLine = { id?: string; qty: number; addon_ids?: string[]; bundle_id?: string };

// Price the cart from the live menu. Mirrors food-order-checkout EXACTLY, including
// beer+burger bundle lines — so the kiosk can never be made to pay the wrong amount.
async function priceCart(cart: CartLine[]): Promise<
  | { ok: true; lineItems: any[]; total: number }
  | { ok: false; status: number; body: Record<string, unknown> }
> {
  const { data: menu } = await db.from("menu_catalog").select("sections, bundles").eq("id", 1).maybeSingle();
  const sections: any[] = Array.isArray(menu?.sections) ? menu!.sections : [];
  const itemIndex = new Map<string, any>();
  for (const sec of sections) for (const it of (sec.items || [])) { if (it.archived || sec.archived) continue; itemIndex.set(String(it.id), it); }
  const bundles: any[] = Array.isArray(menu?.bundles) ? menu!.bundles : [];
  const bundleIndex = new Map<string, any>();
  for (const bn of bundles) if (bn && bn.id) bundleIndex.set(String(bn.id), bn);
  const todayDow = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short" }).format(new Date());

  const lineItems: any[] = [];
  let total = 0;
  for (const line of cart) {
    const qty = Math.min(20, Math.max(1, parseInt(String(line.qty), 10) || 1));
    if (line.bundle_id) {
      const bn = bundleIndex.get(String(line.bundle_id));
      if (!bn) return { ok: false, status: 409, body: { error: "That deal has just changed — please refresh and try again." } };
      const days = Array.isArray(bn.days) ? bn.days : [];
      if (days.length && !days.includes(todayDow)) return { ok: false, status: 409, body: { error: "That deal isn't running today — please refresh the menu." } };
      const burger = itemIndex.get(String(bn.burger_id));
      if (!burger) return { ok: false, status: 409, body: { error: "That deal's burger isn't available right now — please refresh the menu." } };
      const price = parseInt(bn.price_pence, 10) || 0;
      if (price <= 0) return { ok: false, status: 409, body: { error: "That deal isn't priced — please refresh the menu." } };
      const drink = (typeof bn.drink === "string" && bn.drink.trim()) ? bn.drink.trim() : "beer";
      total += price * qty;
      lineItems.push({ name: `🎟 ${bn.name || "Beer + Burger"}: ${burger.name} + ${drink} (pour at bar)`, qty, price_pence: price, cost_pence: parseInt(burger.cost_pence, 10) || 0, options: [], bundle: true, stock: Array.isArray(burger.stock) ? burger.stock : [] });
      continue;
    }
    const it = itemIndex.get(String(line.id));
    if (!it) return { ok: false, status: 409, body: { error: "That menu has just changed — please refresh and try again." } };
    const addonIds = Array.isArray(line.addon_ids) ? line.addon_ids.map(String) : [];
    const chosen = (it.addons || []).filter((a: any) => addonIds.includes(String(a.id)));
    const options = chosen.map((a: any) => ({ name: a.name, price_pence: parseInt(a.price_pence, 10) || 0, cost_pence: parseInt(a.cost_pence, 10) || 0 }));
    const unit = (parseInt(it.sell_pence, 10) || 0) + options.reduce((s: number, o: any) => s + o.price_pence, 0);
    total += unit * qty;
    lineItems.push({ name: it.name, qty, price_pence: parseInt(it.sell_pence, 10) || 0, cost_pence: parseInt(it.cost_pence, 10) || 0, options, stock: Array.isArray(it.stock) ? it.stock : [] });
  }
  if (total <= 0) return { ok: false, status: 400, body: { error: "Could not price this order — please refresh and try again." } };
  return { ok: true, lineItems, total };
}

// Guard against overselling — identical to food-order-checkout (no draw-down here;
// stock is drawn down the same place Stripe orders are, at webhook/mark-paid time).
async function stockOk(lineItems: any[]): Promise<{ ok: true } | { ok: false; body: Record<string, unknown> }> {
  const need: Record<string, number> = {};
  for (const line of lineItems) for (const ing of (line.stock || [])) need[ing] = (need[ing] || 0) + line.qty;
  if (!Object.keys(need).length) return { ok: true };
  const { data: levelRows } = await db.from("kitchen_stock_levels").select("*");
  const lvl: Record<string, any> = Object.fromEntries((levelRows || []).map((r: any) => [r.ingredient, r]));
  for (const [ing, qty] of Object.entries(need)) {
    const r = lvl[ing];
    if (!r) continue;
    const soldOut = r.override === "sold_out" || (r.override !== "available" && r.count <= 0);
    const avail = r.override === "available" ? Infinity : r.count;
    if (soldOut || qty > avail) return { ok: false, body: { error: `Sorry — we've just run low on ${r.label || ing}. Please adjust your order.`, sold_out: ing } };
  }
  return { ok: true };
}

// ───────────────────────────────────────────────────────────────────────────────
// SumUp Cloud API — the REAL charge. Wired but gated behind SUMUP_LIVE. This is the
// single drop-in point: once the keys + unattended approval land, set SUMUP_LIVE=true.
// Docs: https://developer.sumup.com/terminal-payments/cloud-api
// POST /v0.1/merchants/{MERCHANT_CODE}/readers/{READER_ID}/checkout
//   body: { total_amount: { currency:'GBP', minor_unit:2, value:<pence> },
//           return_url: <webhook>, client_transaction_id:<uuid> }
//   NB: OMIT tip_rates — tips are handled in the kiosk UI, not on the reader.
// The reader shows the amount, the customer taps their own card, and SumUp POSTs
// solo.transaction.updated { status: successful|failed, client_transaction_id } to
// return_url. We mark the order paid in handleWebhook() on "successful".
// ───────────────────────────────────────────────────────────────────────────────
async function tillCharge(opts: { amountPence: number; clientTxId: string; description?: string }): Promise<{ ok: boolean; error?: string }> {
  // TODO(sumup-live): remove this guard when going live.
  if (!SUMUP_LIVE) return { ok: false, error: "SUMUP_LIVE is off — using the stub mark-paid path." };
  if (!SUMUP_API_KEY || !SUMUP_READER_ID || !SUMUP_MERCHANT_CODE) return { ok: false, error: "SumUp API key / merchant code / reader id not configured." };
  const res = await fetch(`${SUMUP_API_BASE}/v0.1/merchants/${SUMUP_MERCHANT_CODE}/readers/${SUMUP_READER_ID}/checkout`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${SUMUP_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      total_amount: { currency: "GBP", minor_unit: 2, value: opts.amountPence },
      ...(opts.description ? { description: opts.description } : {}),
      ...(SUMUP_WEBHOOK_URL ? { return_url: SUMUP_WEBHOOK_URL } : {}),
      client_transaction_id: opts.clientTxId,
      // Affiliate section identifies this app (separate from the Bearer API key).
      ...(SUMUP_AFFILIATE_KEY ? { affiliate: { key: SUMUP_AFFILIATE_KEY, app_id: SUMUP_APP_ID, foreign_transaction_id: opts.clientTxId } } : {}),
      // tip_rates intentionally omitted — tips are taken in the kiosk UI.
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: `SumUp checkout failed (${res.status}): ${t.slice(0, 300)}` };
  }
  // 2xx = the reader has been told to collect. Payment itself is confirmed by
  // polling SumUp (confirmSumupPaid) — the return_url webhook is only a fast-path.
  return { ok: true };
}

// Ask SumUp directly whether our charge settled. The reader checkout's
// client_transaction_id comes back as the transaction's `foreign_transaction_id`.
// This is the RELIABLE confirmation (don't depend on the return_url webhook firing).
async function confirmSumupPaid(clientTxId: string): Promise<{ state: "successful" | "failed" | "pending"; txCode: string }> {
  if (!SUMUP_API_KEY || !clientTxId) return { state: "pending", txCode: "" };
  try {
    const res = await fetch(`${SUMUP_API_BASE}/v0.1/me/transactions?foreign_transaction_id=${encodeURIComponent(clientTxId)}`, {
      headers: { "Authorization": `Bearer ${SUMUP_API_KEY}` },
    });
    if (res.status === 404) return { state: "pending", txCode: "" };   // not created yet = still waiting at the reader
    if (!res.ok) return { state: "pending", txCode: "" };
    const t = await res.json().catch(() => ({} as any));
    const status = String(t?.status || "").toUpperCase();
    const txCode = String(t?.transaction_code || "");
    if (status === "SUCCESSFUL") return { state: "successful", txCode };
    if (status === "FAILED" || status === "CANCELLED" || status === "CANCELED") return { state: "failed", txCode };
    return { state: "pending", txCode };   // PENDING / in-progress at the reader
  } catch {
    return { state: "pending", txCode: "" };
  }
}

// Flip a priced, pending kiosk order to PAID + 'new' so it hits the kitchen KDS and
// the "ready"-SMS flow. Shared by the stub and the real webhook path. Draws stock
// down the same way createCodedOrder/the Stripe webhook do.
async function markOrderPaid(order_id: string, extra: Record<string, unknown> = {}): Promise<{ ok: boolean; order_no?: number; error?: string }> {
  const { data: row } = await db.from("food_orders").select("id, order_no, items, paid, status").eq("id", order_id).maybeSingle();
  if (!row) return { ok: false, error: "order not found" };
  if (row.paid) return { ok: true, order_no: row.order_no };   // idempotent — webhook may fire twice
  // Draw down limiting ingredients (best-effort; mirrors createCodedOrder).
  const need: Record<string, number> = {};
  for (const line of (row.items || [])) for (const ing of (line.stock || [])) need[ing] = (need[ing] || 0) + (line.qty || 1);
  for (const [ing, qty] of Object.entries(need)) {
    const { data: cur } = await db.from("kitchen_stock_levels").select("count").eq("ingredient", ing).maybeSingle();
    if (cur) await db.from("kitchen_stock_levels").update({ count: Math.max(0, cur.count - qty), updated_at: new Date().toISOString() }).eq("ingredient", ing);
  }
  const { error } = await db.from("food_orders").update({ paid: true, status: "new", ...extra }).eq("id", order_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, order_no: row.order_no };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, { status: 405 });

  let b: any = {};
  try { b = await req.json(); } catch { return json({ error: "Invalid JSON body" }, { status: 400 }); }
  const action = String(b.action || "");

  // ── SumUp reader callback (sent to return_url) + our own sumupWebhook action ─────
  // SumUp POSTs its OWN shape to return_url (no `action` field) — fields may sit at
  // the top level or under payload/transaction. We also accept our explicit
  // {action:"sumupWebhook"}. Normalise both, then look the order up by the client
  // transaction id. A non-matching call just 404s harmlessly.
  // TODO(sumup-live): verify the webhook signature header before trusting the body.
  const hook = (action === "sumupWebhook" || !action) ? parseSumupHook(b) : null;
  if (hook) {
    if (!hook.clientTxId) return json({ ok: false, error: "no client_transaction_id" }, { status: 400 });
    const { data: order } = await db.from("food_orders").select("id, order_no, paid").eq("sumup_client_tx_id", hook.clientTxId).maybeSingle();
    if (!order) return json({ ok: false, error: "no matching order" }, { status: 404 });
    if (hook.status === "successful") {
      const r = await markOrderPaid(order.id, { sumup_tx_code: hook.txCode || null });
      return json({ ok: r.ok, order_no: r.order_no });
    }
    if (hook.status === "failed" || hook.status === "cancelled" || hook.status === "canceled") {
      await db.from("food_orders").update({ failure_reason: (hook.reason || hook.status).slice(0, 200) }).eq("id", order.id);
    }
    return json({ ok: true, paid: false });   // 'pending'/unknown → ack, wait for the next event
  }

  // ── Pair the Solo (one-off, admin) — Create Reader with the pairing code ─────────
  // Call once with { action:"pairReader", secret:<SEND_SECRET>, pairing_code:"XXXX",
  // name:"On A Roll van" }. Returns the reader id "rdr_…" → set it as SUMUP_READER_ID.
  // The pairing code is only valid ~5 minutes after the Solo generates it.
  if (action === "pairReader") {
    if (!SEND_SECRET || b.secret !== SEND_SECRET) return json({ error: "not allowed" }, { status: 403 });
    if (!SUMUP_API_KEY || !SUMUP_MERCHANT_CODE) return json({ error: "SUMUP_API_KEY / SUMUP_MERCHANT_CODE not configured yet." }, { status: 400 });
    const pairing_code = String(b.pairing_code || "").trim();
    if (!pairing_code) return json({ error: "Enter the pairing code shown on the Solo." }, { status: 400 });
    const name = String(b.name || "On A Roll van").trim().slice(0, 60);
    const res = await fetch(`${SUMUP_API_BASE}/v0.1/merchants/${SUMUP_MERCHANT_CODE}/readers`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${SUMUP_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ pairing_code, name }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return json({ error: `Pairing failed (${res.status}): ${JSON.stringify(body).slice(0, 300)}` }, { status: 502 });
    // body.id is the "rdr_…" reader id to store as SUMUP_READER_ID.
    return json({ ok: true, reader_id: body.id ?? null, reader: body });
  }

  // ── Create the (pending) kiosk order ───────────────────────────────────────────
  if (action === "createOrder") {
    const name = String(b.name || "").trim();
    const phone = normalisePhone(String(b.phone || ""));
    const emailRaw = String(b.email || "").trim().slice(0, 120);
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : null;
    const allergen_note = b.allergen_note ? String(b.allergen_note).trim().slice(0, 500) : null;
    const customer_note = b.note ? String(b.note).trim().slice(0, 300) : null;
    const cart = Array.isArray(b.cart) ? b.cart.slice(0, 50) : [];
    const tipPct = [5, 10].includes(parseInt(String(b.tip_pct), 10)) ? parseInt(String(b.tip_pct), 10) : 0;
    const tipCustomPence = Math.max(0, Math.min(50000, parseInt(String(b.tip_pence), 10) || 0));

    if (name.length < 2) return json({ error: "Please enter a name." }, { status: 400 });
    // Kiosk: a phone is how we text "ready" — required (no email fallback on the till).
    if (!phone || phone.replace(/\D/g, "").length < 10) return json({ error: "Please enter a mobile number so we can text you when it's ready." }, { status: 400 });
    if (!cart.length) return json({ error: "Your order is empty." }, { status: 400 });

    const { open, reason, waiting } = await orderingOpen();
    if (!open) return json({
      error: reason === "closed"
        ? "The kitchen is closed — we're open until 10pm. No payment has been taken."
        : "Ordering is paused right now — please try again shortly. No payment has been taken.",
      open: false, reason, waiting,
    }, { status: 409 });

    const priced = await priceCart(cart);
    if (!priced.ok) return json(priced.body, { status: priced.status });
    const stock = await stockOk(priced.lineItems);
    if (!stock.ok) return json(stock.body, { status: 409 });

    const tip = tipPct > 0 ? Math.round(priced.total * tipPct / 100) : tipCustomPence;
    const grand = priced.total + tip;
    const clientTxId = crypto.randomUUID();

    const { data: row, error: insErr } = await db.from("food_orders").insert({
      customer_name: name,
      customer_phone: phone,
      customer_email: email,
      customer_note,
      items: priced.lineItems,
      total_pence: grand,
      tip_pence: tip,
      status: "pending",
      paid: false,
      allergen_note,
      source: "kiosk",
      payment_provider: "sumup",
      sumup_client_tx_id: clientTxId,
    }).select("id, order_no").single();
    if (insErr || !row) return json({ error: `Failed to save order: ${insErr?.message ?? "unknown error"}` }, { status: 500 });

    return json({ order_id: row.id, order_no: row.order_no, client_tx_id: clientTxId, amount_pence: grand });
  }

  // ── Take payment on the Solo, then mark the order paid ──────────────────────────
  if (action === "takePayment") {
    const order_id = String(b.order_id || "");
    const client_tx_id = String(b.client_tx_id || "");
    if (!order_id) return json({ error: "no order_id" }, { status: 400 });

    const { data: order } = await db.from("food_orders").select("id, order_no, total_pence, paid, source, sumup_client_tx_id").eq("id", order_id).maybeSingle();
    if (!order) return json({ error: "order not found" }, { status: 404 });
    if (order.source !== "kiosk") return json({ error: "not a kiosk order" }, { status: 400 });
    if (order.paid) return json({ ok: true, paid: true, order_no: order.order_no });   // idempotent
    if (client_tx_id && order.sumup_client_tx_id && client_tx_id !== order.sumup_client_tx_id) {
      return json({ error: "client_tx_id mismatch" }, { status: 400 });
    }

    if (SUMUP_LIVE) {
      // REAL path: tell the Solo to collect, then WAIT for the webhook to mark paid.
      // The kiosk polls this order's status (action:"orderStatus") until paid/failed.
      const charge = await tillCharge({ amountPence: order.total_pence, clientTxId: order.sumup_client_tx_id, description: `On A Roll #${order.order_no}` });
      if (!charge.ok) {
        await db.from("food_orders").update({ failure_reason: (charge.error || "reader error").slice(0, 200) }).eq("id", order_id);
        return json({ error: charge.error || "Could not start the card reader." }, { status: 502 });
      }
      return json({ ok: true, pending: true });   // not paid yet — poll orderStatus / await webhook
    }

    // ── STUB (current) ── no real reader yet: mark the order paid so the whole
    // flow runs end-to-end into the kitchen KDS + "ready" SMS. Swap for the
    // SUMUP_LIVE branch above by setting SUMUP_LIVE=true once SumUp is enabled.
    const r = await markOrderPaid(order_id, { sumup_tx_code: `STUB-${Date.now()}` });
    if (!r.ok) return json({ error: r.error || "Could not complete the order." }, { status: 500 });
    return json({ ok: true, paid: true, order_no: r.order_no, stub: true });
  }

  // ── Order status poll (used by the kiosk while the reader collects) ─────────────
  // This is also where a LIVE charge gets CONFIRMED: if the order is still unpaid,
  // we ask SumUp directly whether our charge settled (reliable; not dependent on the
  // return_url webhook) and mark it paid here. The kiosk polls this until paid/failed.
  if (action === "orderStatus") {
    const order_id = String(b.order_id || "");
    if (!order_id) return json({ error: "no order_id" }, { status: 400 });
    const { data: order } = await db.from("food_orders").select("id, order_no, paid, status, failure_reason, source, sumup_client_tx_id").eq("id", order_id).maybeSingle();
    if (!order) return json({ error: "order not found" }, { status: 404 });

    if (!order.paid && SUMUP_LIVE && order.source === "kiosk" && order.sumup_client_tx_id) {
      const chk = await confirmSumupPaid(order.sumup_client_tx_id);
      if (chk.state === "successful") {
        const r = await markOrderPaid(order.id, { sumup_tx_code: chk.txCode || null });
        return json({ ok: true, paid: r.ok, status: "new", order_no: order.order_no, failure_reason: null });
      }
      if (chk.state === "failed") {
        await db.from("food_orders").update({ failure_reason: "reader declined/cancelled" }).eq("id", order.id);
        return json({ ok: true, paid: false, status: order.status, order_no: order.order_no, failure_reason: "reader declined/cancelled" });
      }
      // pending → fall through and report current (unpaid) state
    }
    return json({ ok: true, paid: !!order.paid, status: order.status, order_no: order.order_no, failure_reason: order.failure_reason || null });
  }

  return json({ error: `Unknown action: ${action}` }, { status: 400 });
});
