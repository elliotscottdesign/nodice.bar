// =============================================================
// enquiry-payment — a full-payment Stripe link for a CRM enquiry
// =============================================================
// POST /functions/v1/enquiry-payment
// Body: { enquiry_id: string, amount_pence: number, description?: string }
//
// Office-initiated, one-click. The office types the full amount owed for a
// confirmed enquiry; this creates a Stripe PAYMENT LINK (a permanent URL the
// client pays whenever they like — NOT an immediate charge) and stamps it on
// the enquiry. The office then sends it (via enquiry-email or by copying it).
//
// Deliberately generic: it just needs an amount and a description. metadata
// .kind='enquiry_payment' is set so a future stripe-webhook branch can flip
// the enquiry to paid automatically — until that ships, the office marks the
// enquiry paid manually. This function does NOT touch the shared webhook.
//
// Mirrors the proven pool-addon Payment Link flow (one-off inline Price →
// Payment Link, single completed session so it can't be paid twice).
//
// Auth: verify_jwt stays ON (admin calls it with the anon key + the admin's
// session, same as the other admin edge calls). Deploy:
//   supabase functions deploy enquiry-payment --project-ref <ref>
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

  let body: {
    enquiry_id?: string;
    amount_pence?: number;
    description?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  const enquiryId = (body.enquiry_id ?? "").trim();
  if (!enquiryId) {
    return jsonResponse({ error: "enquiry_id is required" }, { status: 400 });
  }
  const amount = Math.round(body.amount_pence ?? 0);
  if (!Number.isFinite(amount) || amount < 100) {
    return jsonResponse(
      { error: "amount_pence must be a whole number of at least 100 (£1)" },
      { status: 400 },
    );
  }
  if (amount > 10_000_00) {
    return jsonResponse(
      { error: "amount_pence looks too large (max £10,000)" },
      { status: 400 },
    );
  }

  // Load the enquiry so we can name the payment and confirm it exists.
  const { data: enq, error: enqErr } = await db
    .from("enquiries")
    .select("id, contact_name, event_type, requested_date")
    .eq("id", enquiryId)
    .maybeSingle();
  if (enqErr) {
    return jsonResponse(
      { error: `Enquiry lookup failed: ${enqErr.message}` },
      { status: 500 },
    );
  }
  if (!enq) {
    return jsonResponse({ error: "Enquiry not found" }, { status: 404 });
  }

  const label =
    (body.description ?? "").trim() ||
    [enq.event_type || "No Dice event", enq.requested_date]
      .filter(Boolean)
      .join(" · ") ||
    "No Dice event";

  // Stripe Payment Link — one-off inline Price, single completed session.
  let payUrl: string;
  try {
    const price = await stripe.prices.create({
      currency: "gbp",
      unit_amount: amount,
      product_data: { name: label.slice(0, 250) },
    });
    const meta = { kind: "enquiry_payment", enquiry_id: enq.id };
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: meta,
      payment_intent_data: { metadata: meta },
      restrictions: { completed_sessions: { limit: 1 } },
      after_completion: {
        type: "hosted_confirmation",
        hosted_confirmation: {
          custom_message:
            "Thanks — payment received. See you at No Dice, London Fields!",
        },
      },
    });
    if (!link.url) throw new Error("Stripe returned no link URL");
    payUrl = link.url;
  } catch (e) {
    return jsonResponse(
      {
        error: `Stripe payment link failed: ${
          e instanceof Error ? e.message : String(e)
        }`,
      },
      { status: 502 },
    );
  }

  // Stamp the link + amount on the enquiry.
  const { error: updErr } = await db
    .from("enquiries")
    .update({ payment_url: payUrl, amount_pence: amount })
    .eq("id", enq.id);
  if (updErr) {
    return jsonResponse(
      {
        pay_url: payUrl,
        amount_pence: amount,
        warning: `Link created, but could not save it on the enquiry: ${updErr.message}`,
      },
      { status: 200 },
    );
  }

  return jsonResponse({ pay_url: payUrl, amount_pence: amount });
});
