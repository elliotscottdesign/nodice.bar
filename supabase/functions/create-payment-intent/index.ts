// =============================================================
// Plonk Golf — create-payment-intent
// =============================================================
// POST /functions/v1/create-payment-intent
//
// Browser hands us the basket (venue slug + ticket/addon NAMES + quantities
// + slot groups + customer details). We:
//   1. Look up venue/ticket/addon prices in Postgres (NEVER trust the
//      browser for amounts — that's the whole point of doing this server-
//      side).
//   2. Apply promo code from DB if provided.
//   3. Insert a `pending` booking row + its line items + slot rows.
//   4. Create a Stripe PaymentIntent for the total in pence/gbp.
//   5. Return { client_secret, reference, total_pence } to the browser.
//
// The browser uses `client_secret` to render the Stripe Payment Element
// inline. When the payment finally succeeds, the stripe-webhook function
// flips the booking from `pending` → `confirmed`.
// =============================================================

import Stripe from "https://esm.sh/stripe@17.4.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// ---------- inlined CORS helpers (kept here so the function is self-
//            contained for the Supabase Dashboard paste-and-deploy flow) ----
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
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// 15-minute soft hold while the customer fills in the Payment Element.
const HOLD_MINUTES = 15;

type SlotGroup = { time: string; count: number };
type Line = { name: string; quantity: number };
type Customer = {
  name: string;
  email: string;
  phone?: string;
  heard_from?: string;
  marketing_opt_in?: boolean;
};

type Payload = {
  venue_slug: string;
  slot_date: string;            // "YYYY-MM-DD"
  slot_groups: SlotGroup[];     // [{ time: "19:00", count: 4 }, ...]
  tickets: Line[];
  addons: Line[];
  promo_code?: string;
  customer: Customer;
};

function bad(message: string, status = 400) {
  return jsonResponse({ error: message }, { status });
}

function randomRef(): string {
  // PLNK-XXXX-XXXX, base36 uppercase, easy to read over the phone.
  const r = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PLNK-${r()}-${r()}`;
}

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  if (req.method !== "POST") return bad("POST only", 405);
  if (!STRIPE_SECRET_KEY) return bad("STRIPE_SECRET_KEY not configured on the function", 500);

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return bad("Invalid JSON body");
  }

  const { venue_slug, slot_date, slot_groups, tickets, addons, promo_code, customer } = payload;

  // ---------- Basic validation ----------
  if (!venue_slug || !slot_date || !customer?.name || !customer?.email) {
    return bad("Missing venue_slug, slot_date, customer.name or customer.email");
  }
  if (!Array.isArray(slot_groups) || slot_groups.length === 0) {
    return bad("slot_groups must be a non-empty array");
  }
  if (!Array.isArray(tickets) || tickets.length === 0) {
    return bad("tickets must be a non-empty array");
  }
  const partySize = slot_groups.reduce((a, g) => a + (g.count || 0), 0);
  if (partySize <= 0) return bad("party_size must be > 0");

  // ---------- Look up venue ----------
  const { data: venue, error: venueErr } = await db
    .from("venues")
    .select("id, name, slug, active")
    .eq("slug", venue_slug)
    .eq("active", true)
    .maybeSingle();
  if (venueErr) return bad(`DB error (venue): ${venueErr.message}`, 500);
  if (!venue) return bad(`Unknown venue: ${venue_slug}`, 404);

  // ---------- Look up tickets (by venue + name) ----------
  const ticketNames = tickets.map((t) => t.name);
  const { data: ticketRows, error: ticketErr } = await db
    .from("tickets")
    .select("id, name, price_pence, active, venue_id")
    .eq("venue_id", venue.id)
    .eq("active", true)
    .in("name", ticketNames);
  if (ticketErr) return bad(`DB error (tickets): ${ticketErr.message}`, 500);

  const ticketsByName = new Map(
    (ticketRows ?? []).map((t) => [t.name, t]),
  );

  // Make sure every requested ticket actually resolved.
  for (const line of tickets) {
    if (!ticketsByName.has(line.name)) {
      return bad(`Ticket not found or inactive: "${line.name}"`);
    }
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      return bad(`Invalid quantity for "${line.name}"`);
    }
  }

  // ---------- Look up addons (global or venue-specific by name) ----------
  let addonsByName = new Map<string, { id: string; name: string; price_pence: number }>();
  if (Array.isArray(addons) && addons.length > 0) {
    const addonNames = addons.map((a) => a.name);
    const { data: addonRows, error: addonErr } = await db
      .from("addons")
      .select("id, name, price_pence, active, venue_id")
      .eq("active", true)
      .in("name", addonNames);
    if (addonErr) return bad(`DB error (addons): ${addonErr.message}`, 500);

    for (const row of addonRows ?? []) {
      // venue_id null = available everywhere, otherwise must match.
      if (row.venue_id && row.venue_id !== venue.id) continue;
      addonsByName.set(row.name, row);
    }
    for (const line of addons) {
      if (!addonsByName.has(line.name)) {
        return bad(`Add-on not found or not available at this venue: "${line.name}"`);
      }
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        return bad(`Invalid quantity for add-on "${line.name}"`);
      }
    }
  }

  // ---------- Pricing (pence, server-side) ----------
  let subtotal = 0;
  for (const line of tickets) {
    subtotal += ticketsByName.get(line.name)!.price_pence * line.quantity;
  }
  for (const line of addons ?? []) {
    subtotal += addonsByName.get(line.name)!.price_pence * line.quantity;
  }

  // ---------- Promo code ----------
  let discount = 0;
  let promoRow: { id: string; code: string; kind: string; value: number } | null = null;
  if (promo_code) {
    const { data: promo, error: promoErr } = await db
      .from("promo_codes")
      .select("id, code, kind, value, active, valid_from, valid_to, max_uses, uses")
      .eq("code", promo_code)
      .eq("active", true)
      .maybeSingle();
    if (promoErr) return bad(`DB error (promo): ${promoErr.message}`, 500);
    if (promo) {
      const now = new Date();
      const okWindow = new Date(promo.valid_from) <= now && new Date(promo.valid_to) >= now;
      const okUses = promo.max_uses == null || promo.uses < promo.max_uses;
      if (okWindow && okUses) {
        if (promo.kind === "percent") {
          discount = Math.round((subtotal * promo.value) / 100);
        } else if (promo.kind === "fixed") {
          discount = Math.min(subtotal, promo.value);
        }
        promoRow = promo;
      }
    }
  }

  const total = Math.max(0, subtotal - discount);
  if (total <= 0) return bad("Order total must be positive", 400);

  // ---------- Create pending booking row ----------
  const reference = randomRef();
  const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000).toISOString();

  const { data: booking, error: bookingErr } = await db
    .from("bookings")
    .insert({
      reference,
      venue_id: venue.id,
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone ?? null,
      heard_from: customer.heard_from ?? null,
      marketing_opt_in: !!customer.marketing_opt_in,
      party_size: partySize,
      subtotal_pence: subtotal,
      discount_pence: discount,
      total_pence: total,
      currency: "gbp",
      status: "pending",
      promo_code_id: promoRow?.id ?? null,
      expires_at: expiresAt,
    })
    .select("id, reference")
    .single();
  if (bookingErr) return bad(`DB error (booking insert): ${bookingErr.message}`, 500);

  // Slot rows
  const slotRows = slot_groups.map((g) => ({
    booking_id: booking.id,
    slot_date,
    slot_time: g.time,
    count: g.count,
  }));
  const { error: slotErr } = await db.from("booking_slots").insert(slotRows);
  if (slotErr) return bad(`DB error (slot insert): ${slotErr.message}`, 500);

  // Ticket line items
  const ticketLineRows = tickets.map((line) => {
    const t = ticketsByName.get(line.name)!;
    return {
      booking_id: booking.id,
      ticket_id: t.id,
      quantity: line.quantity,
      unit_price_pence: t.price_pence,
    };
  });
  const { error: ticketLineErr } = await db.from("booking_tickets").insert(ticketLineRows);
  if (ticketLineErr) return bad(`DB error (ticket lines): ${ticketLineErr.message}`, 500);

  // Addon line items
  if ((addons ?? []).length > 0) {
    const addonLineRows = addons.map((line) => {
      const a = addonsByName.get(line.name)!;
      return {
        booking_id: booking.id,
        addon_id: a.id,
        quantity: line.quantity,
        unit_price_pence: a.price_pence,
      };
    });
    const { error: addonLineErr } = await db.from("booking_addons").insert(addonLineRows);
    if (addonLineErr) return bad(`DB error (addon lines): ${addonLineErr.message}`, 500);
  }

  // ---------- Stripe PaymentIntent ----------
  let pi;
  try {
    pi = await stripe.paymentIntents.create({
      amount: total,
      currency: "gbp",
      automatic_payment_methods: { enabled: true },
      receipt_email: customer.email,
      description: `Plonk Golf — ${venue.name} — ${reference}`,
      metadata: {
        booking_id: booking.id,
        reference,
        venue_slug,
        slot_date,
      },
    });
  } catch (e) {
    // Roll the booking back if Stripe blew up — keeps capacity clean.
    await db.from("bookings").delete().eq("id", booking.id);
    const msg = e instanceof Error ? e.message : String(e);
    return bad(`Stripe error: ${msg}`, 502);
  }

  const { error: updateErr } = await db
    .from("bookings")
    .update({ stripe_payment_intent_id: pi.id })
    .eq("id", booking.id);
  if (updateErr) return bad(`DB error (PI link): ${updateErr.message}`, 500);

  return jsonResponse({
    client_secret: pi.client_secret,
    reference,
    total_pence: total,
    expires_at: expiresAt,
  });
});
