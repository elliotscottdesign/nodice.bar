// =============================================================
// bingo-checkout — standalone Comedy & Bingo ticket endpoint
// =============================================================
// POST /functions/v1/bingo-checkout
// Body: { event_id, name, email, phone, marketing_opt_in? }
//
// Bingo used to piggyback on `tournament-checkout` by masquerading as a
// pool_tournament_singles event (founder, 11 Oct). From 19 Oct bingo is its
// OWN product with its OWN category 'bingo' and this OWN checkout — so the
// pool / ping-pong checkout no longer has to know about it.
//
// It still WRITES to `tournament_entries` (not a new table) on purpose:
//   • the /admin special-events tracker already reads tournament_entries, so
//     bingo bookings stay visible with zero admin work;
//   • the existing `stripe-webhook` already flips tournament_entries → 'paid'
//     by PaymentIntent metadata (kind='tournament_entry' + entry_id), so we
//     reuse it UNTOUCHED — no webhook change, no pool/pingpong risk.
// The FK target tournament_entries.tournament_id → tournaments(id) is satisfied
// by the events row's mirror `tournaments` row (same id — created by
// supabase/sql/bingo_event_insert.sql).
//
// Single £10 ticket per person: name + email + phone + marketing opt-in. No
// teams, partners, league or free-entry path — that's all pool/pingpong stuff.
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
    headers: { ...corsHeaders, "content-type": "application/json", ...(init.headers || {}) },
  });
}
function handlePreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
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

// UK mobile → canonical 07… form, or null. Accepts +44 / 0044 / 44 spellings
// (rejecting +44 autofill blocked real customers, 20 Aug 2026).
function normUkMobile(v: unknown): string | null {
  let n = String(v ?? "").replace(/[^0-9+]/g, "");
  if (n.startsWith("+")) n = n.slice(1);
  if (n.startsWith("00")) n = n.slice(2);
  if (n.startsWith("44")) n = "0" + n.slice(2);
  return /^07\d{9}$/.test(n) ? n : null;
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type BingoInput = {
  event_id: string;
  name: string;
  email: string;
  phone: string;
  heard_from?: string | null;
  marketing_opt_in?: boolean;
};

function validate(body: Partial<BingoInput>):
  | { ok: true; input: BingoInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Body must be a JSON object" };
  if (!body.event_id || !UUID_RE.test(body.event_id)) return { ok: false, error: "event_id must be a UUID" };
  if (!body.name || typeof body.name !== "string" || body.name.trim().length < 2)
    return { ok: false, error: "name is required" };
  if (!body.email || typeof body.email !== "string" || !EMAIL_RE.test(body.email))
    return { ok: false, error: "a valid email is required" };
  if (!body.phone || typeof body.phone !== "string" || !normUkMobile(body.phone))
    return { ok: false, error: "A UK mobile number is required (starting 07 or +44 7)." };
  return {
    ok: true,
    input: {
      event_id: body.event_id,
      name: body.name.trim(),
      email: body.email.trim(),
      phone: normUkMobile(body.phone)!,
      heard_from: typeof body.heard_from === "string" ? body.heard_from.trim() || null : null,
      marketing_opt_in: !!body.marketing_opt_in,
    },
  };
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonResponse({ error: "POST only" }, { status: 405 });
  if (!STRIPE_SECRET_KEY) return jsonResponse({ error: "STRIPE_SECRET_KEY not configured" }, { status: 500 });

  let raw: Partial<BingoInput>;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }
  const v = validate(raw);
  if (!v.ok) return jsonResponse({ error: v.error }, { status: 400 });
  const input = v.input;

  // Look up the bingo event. MUST be category 'bingo' — this endpoint only
  // ever takes bingo money; anything else is rejected.
  const { data: ev, error: evErr } = await db
    .from("events")
    .select("id, name, category, registration_open, bookable, max_attendees")
    .eq("id", input.event_id)
    .maybeSingle();
  if (evErr) return jsonResponse({ error: `DB error on event lookup: ${evErr.message}` }, { status: 500 });
  if (!ev) return jsonResponse({ error: "Bingo night not found" }, { status: 404 });
  if (ev.category !== "bingo") return jsonResponse({ error: "That event is not a bingo night" }, { status: 400 });
  if (!ev.registration_open) return jsonResponse({ error: "Tickets are closed for this night" }, { status: 409 });
  if (!ev.bookable) return jsonResponse({ error: "This night isn't bookable" }, { status: 409 });

  // Fee = first active ticket type (never trust the client).
  const { data: tt, error: ttErr } = await db
    .from("ticket_types")
    .select("price_pence, active")
    .eq("event_id", input.event_id)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (ttErr) return jsonResponse({ error: `DB error on ticket lookup: ${ttErr.message}` }, { status: 500 });
  const feePence = tt?.price_pence ?? null;
  if (feePence == null || feePence <= 0) {
    return jsonResponse({ error: "Bingo night has no ticket price configured" }, { status: 500 });
  }

  // One ticket per person per night — block a repeat PAID booking on the same
  // email or phone (a retry after a failed payment is never refused).
  {
    const email = input.email.toLowerCase();
    const { data: dupes } = await db
      .from("tournament_entries")
      .select("id, captain_email, captain_phone")
      .eq("tournament_id", input.event_id)
      .eq("status", "paid");
    const clash = (dupes || []).some(
      (d) => (d.captain_email || "").toLowerCase() === email || d.captain_phone === input.phone,
    );
    if (clash) {
      return jsonResponse(
        { error: "You've already got a ticket for this night on these details. Booking for someone else? Use THEIR name, email and mobile." },
        { status: 409 },
      );
    }
  }

  // Capacity — paid + recent (15-min) pending count vs the room cap.
  const FIFTEEN_MIN_AGO = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count: activeCount, error: countErr } = await db
    .from("tournament_entries")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", input.event_id)
    .or(`status.eq.paid,and(status.eq.pending_payment,created_at.gte.${FIFTEEN_MIN_AGO})`);
  if (countErr) return jsonResponse({ error: `Capacity check failed: ${countErr.message}` }, { status: 500 });
  const cap = ev.max_attendees ?? 60;
  if ((activeCount ?? 0) >= cap) {
    return jsonResponse({ error: `Sorry — this bingo night just sold out (${cap} tickets). Try another date.` }, { status: 409 });
  }

  // Stripe FIRST — never leave an orphan entry if the intent fails.
  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.create({
      amount: feePence,
      currency: "gbp",
      receipt_email: input.email,
      description: `${ev.name} — bingo ticket for ${input.name}`,
      automatic_payment_methods: { enabled: true },
      // kind='tournament_entry' so the EXISTING stripe-webhook flips the row to
      // 'paid' with no webhook change.
      metadata: { kind: "tournament_entry", tournament_id: ev.id, team_name: input.name },
    });
  } catch (e) {
    return jsonResponse({ error: `Stripe create-intent failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }
  if (!intent.client_secret) return jsonResponse({ error: "Stripe returned no client_secret" }, { status: 502 });

  // Insert the entry. One person: their name doubles as team_name + captain_name
  // (keeps the shared tournament_entries shape + admin tracker happy).
  const { data: entry, error: insertErr } = await db
    .from("tournament_entries")
    .insert({
      tournament_id: input.event_id,
      team_name: input.name,
      captain_name: input.name,
      captain_email: input.email,
      captain_phone: input.phone,
      heard_from: input.heard_from,
      marketing_opt_in: input.marketing_opt_in,
      stripe_payment_intent_id: intent.id,
    })
    .select("id")
    .single();
  if (insertErr || !entry) {
    await stripe.paymentIntents.cancel(intent.id, { cancellation_reason: "abandoned" }).catch(() => {});
    return jsonResponse({ error: `Failed to save ticket: ${insertErr?.message ?? "unknown error"}` }, { status: 500 });
  }

  await stripe.paymentIntents
    .update(intent.id, { metadata: { ...intent.metadata, entry_id: entry.id } })
    .catch((e) => console.warn(`Could not update PaymentIntent metadata: ${e}`));

  return jsonResponse({ entry_id: entry.id, client_secret: intent.client_secret });
});
