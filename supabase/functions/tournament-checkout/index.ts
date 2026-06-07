// =============================================================
// No Dice — tournament-checkout Edge Function
// =============================================================
// POST /functions/v1/tournament-checkout
//
// Body: { entry_id: string, tournament_id: string }
//
// Browser hands us the pending tournament_entries row + its parent
// tournament. We:
//   1. Look up the entry + tournament server-side (NEVER trust the
//      browser for the amount — Stripe Checkout would silently honor
//      whatever price we sent, so the price MUST come from our DB).
//   2. Create a Stripe Checkout Session with the tournament's
//      `entry_fee_pence`, customer email, and metadata pointing back
//      at the entry id.
//   3. Stamp the session id back onto the entry row so the
//      stripe-webhook function can find it again on payment success.
//   4. Return { url } — the browser hard-redirects there.
//
// What lives in env vars:
//   STRIPE_SECRET_KEY              — Stripe live or test secret key
//   SUPABASE_URL                   — auto-injected by Supabase
//   SUPABASE_SERVICE_ROLE_KEY      — auto-injected by Supabase
//   PUBLIC_SITE_URL                — root of the deployed site, used
//                                   to build success/cancel URLs.
//                                   For GitHub Pages this is
//                                   https://elliotscottdesign.github.io/nodice.bar
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
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PUBLIC_SITE_URL =
  Deno.env.get("PUBLIC_SITE_URL") ??
  "https://elliotscottdesign.github.io/nodice.bar";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type Payload = {
  entry_id?: string;
  tournament_id?: string;
};

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

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { entry_id, tournament_id } = body;
  if (!entry_id || !tournament_id) {
    return jsonResponse(
      { error: "Missing entry_id or tournament_id" },
      { status: 400 },
    );
  }

  // Look up entry + tournament server-side.
  const { data: entry, error: entryErr } = await db
    .from("tournament_entries")
    .select("id, status, captain_email, team_name, tournament_id")
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
  if (entry.tournament_id !== tournament_id) {
    return jsonResponse(
      { error: "Entry does not belong to that tournament" },
      { status: 400 },
    );
  }
  if (entry.status !== "pending_payment") {
    return jsonResponse(
      { error: `Entry already in status '${entry.status}'` },
      { status: 409 },
    );
  }

  const { data: tournament, error: tournErr } = await db
    .from("tournaments")
    .select("id, name, entry_fee_pence, registration_open, bookable")
    .eq("id", tournament_id)
    .maybeSingle();
  if (tournErr) {
    return jsonResponse(
      { error: `DB error on tournament lookup: ${tournErr.message}` },
      { status: 500 },
    );
  }
  if (!tournament) {
    return jsonResponse({ error: "Tournament not found" }, { status: 404 });
  }
  if (!tournament.registration_open) {
    return jsonResponse(
      { error: "Registration is closed for this tournament" },
      { status: 409 },
    );
  }
  // GRAND FINAL and similar invitation-only events are visible on
  // the public schedule but bookable=false blocks any direct sign-up
  // attempt — even if someone deep-links the booking form.
  if (!tournament.bookable) {
    return jsonResponse(
      { error: "This event is invitation only — not publicly bookable" },
      { status: 409 },
    );
  }
  if (!tournament.entry_fee_pence || tournament.entry_fee_pence <= 0) {
    return jsonResponse(
      { error: "Tournament has no entry fee configured" },
      { status: 500 },
    );
  }

  // Create the Checkout session.
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: entry.captain_email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: tournament.entry_fee_pence,
            product_data: {
              name: `${tournament.name} — team entry`,
              description: `Entry for team "${entry.team_name}"`,
            },
          },
        },
      ],
      metadata: {
        entry_id: entry.id,
        tournament_id: tournament.id,
        team_name: entry.team_name,
      },
      success_url: `${PUBLIC_SITE_URL}/book/tournament/success/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_SITE_URL}/book/tournament/cancelled/`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse(
      { error: `Stripe create-session failed: ${msg}` },
      { status: 502 },
    );
  }

  if (!session.url) {
    return jsonResponse(
      { error: "Stripe returned no checkout URL" },
      { status: 502 },
    );
  }

  // Stamp the session id back onto the entry so the webhook can
  // find it. (If this update fails we still let the redirect
  // happen — the webhook is the safety net.)
  const { error: stampErr } = await db
    .from("tournament_entries")
    .update({ stripe_session_id: session.id })
    .eq("id", entry.id);
  if (stampErr) {
    console.error(
      `Couldn't stamp session id ${session.id} onto entry ${entry.id}: ${stampErr.message}`,
    );
  }

  return jsonResponse({ url: session.url });
});
