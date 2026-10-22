// =============================================================
// enquiry-booking — turn a CRM enquiry into a real venue booking
// =============================================================
// POST /functions/v1/enquiry-booking
// Body: {
//   enquiry_id: string,
//   kind: "table" | "pool" | "golf" | "private_hire",
//   reservation_date: "YYYY-MM-DD",
//   start_time: "HH:MM",
//   duration_minutes?: number,     // default 120
//   party_size: number,
//   amount_pence?: number          // if set, also makes a Stripe pay link
// }
//
// Office-initiated from the enquiry drawer ("Add booking"). Writes a real
// bar_reservations row (status 'confirmed', so it blocks the slot + shows on
// the bar calendar), links it to the enquiry (linked_kind='booking'), flips the
// enquiry to 'confirmed', and — if an amount is given — creates a Stripe Payment
// Link and stamps it on the enquiry so the confirmation email carries it.
// (NB: golf also has a separate public slot calendar; syncing there is a
// follow-on — this records + blocks the venue time + takes payment.)
//
// Mirrors the proven pool-addon Stripe flow. Auth: verify_jwt on (anon-key
// bearer, like the other admin calls). Deploy: supabase functions deploy
// enquiry-booking --project-ref <ref>
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

const KINDS = ["table", "pool", "golf", "private_hire"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function label(kind: string): string {
  return kind === "private_hire" ? "Private hire" : kind.charAt(0).toUpperCase() + kind.slice(1);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, { status: 405 });

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "Invalid JSON body" }, { status: 400 }); }

  const enquiryId = String(b.enquiry_id ?? "").trim();
  const kind = String(b.kind ?? "").trim();
  const date = String(b.reservation_date ?? "").trim();
  let startTime = String(b.start_time ?? "").trim();
  const party = Math.round(Number(b.party_size ?? 0));
  const duration = Math.round(Number(b.duration_minutes ?? 120));
  const amount = b.amount_pence != null ? Math.round(Number(b.amount_pence)) : 0;

  if (!enquiryId) return json({ error: "enquiry_id is required" }, { status: 400 });
  if (!KINDS.includes(kind)) return json({ error: "kind must be table/pool/golf/private_hire" }, { status: 400 });
  if (!DATE_RE.test(date)) return json({ error: "reservation_date must be YYYY-MM-DD" }, { status: 400 });
  if (!TIME_RE.test(startTime)) return json({ error: "start_time must be HH:MM" }, { status: 400 });
  if (startTime.length === 5) startTime = startTime + ":00";
  if (!Number.isFinite(party) || party < 1) return json({ error: "party_size must be 1+" }, { status: 400 });

  const { data: enq, error: enqErr } = await db
    .from("enquiries")
    .select("contact_name, contact_email, contact_phone, event_type")
    .eq("id", enquiryId)
    .maybeSingle();
  if (enqErr) return json({ error: `Enquiry lookup failed: ${enqErr.message}` }, { status: 500 });
  if (!enq) return json({ error: "Enquiry not found" }, { status: 404 });
  const email = (enq.contact_email ?? "").trim();
  if (!EMAIL_RE.test(email)) {
    return json({ error: "Add a valid email to this enquiry before booking." }, { status: 400 });
  }

  // 1. Create the reservation (confirmed = blocks the slot).
  const { data: row, error: insErr } = await db
    .from("bar_reservations")
    .insert({
      kind,
      reservation_date: date,
      start_time: startTime,
      duration_minutes: duration > 0 ? duration : 120,
      party_size: party,
      name: enq.contact_name || "Guest",
      email,
      phone: enq.contact_phone || null,
      notes: `${label(kind)} — created from CRM enquiry (${enq.event_type || "enquiry"})`,
      status: "confirmed",
      amount_pence: amount > 0 ? amount : null,
      marketing_opt_in: false,
    })
    .select("id")
    .single();
  if (insErr || !row) {
    return json({ error: `Could not create booking: ${insErr?.message ?? "unknown"}` }, { status: 500 });
  }

  // 2. Optional Stripe payment link.
  let payUrl = "";
  if (amount >= 100) {
    try {
      const price = await stripe.prices.create({
        currency: "gbp",
        unit_amount: amount,
        product_data: { name: `${label(kind)} — ${date} ${startTime.slice(0, 5)} (${party}p)`.slice(0, 250) },
      });
      const meta = { kind: "enquiry_booking", enquiry_id: enquiryId, reservation_id: row.id };
      const link = await stripe.paymentLinks.create({
        line_items: [{ price: price.id, quantity: 1 }],
        metadata: meta,
        payment_intent_data: { metadata: meta },
        restrictions: { completed_sessions: { limit: 1 } },
        after_completion: {
          type: "hosted_confirmation",
          hosted_confirmation: { custom_message: "Thanks — payment received. See you at No Dice!" },
        },
      });
      payUrl = link.url || "";
      await db.from("bar_reservations").update({ pool_pay_url: payUrl }).eq("id", row.id).then(() => {}, () => {});
    } catch (e) {
      // Booking still made; surface that the pay link failed.
      return json({
        reservation_id: row.id,
        warning: `Booking created, but the payment link failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  // 3. Link the booking to the enquiry + confirm it. requested_date set so the
  //    confirmation email reflects the booked date.
  await db
    .from("enquiries")
    .update({
      status: "confirmed",
      linked_kind: "booking",
      linked_id: row.id,
      requested_date: date,
      party_size: party,
      ...(amount >= 100 ? { amount_pence: amount, payment_url: payUrl } : {}),
    })
    .eq("id", enquiryId)
    .then(() => {}, () => {});

  return json({ reservation_id: row.id, pay_url: payUrl, amount_pence: amount });
});
