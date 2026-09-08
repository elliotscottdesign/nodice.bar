// =============================================================
// No Dice — staff-golf-feed
// =============================================================
// POST /functions/v1/staff-golf-feed
// Body: { key: string, from: "YYYY-MM-DD", to: "YYYY-MM-DD" }
//
// Serves the team hub's Reservations tab (team.nodice.bar) a
// sanitized list of CONFIRMED golf bookings whose slots fall in
// the window. Exists because the `bookings` table (rightly) has
// no anon read access — RLS blocks the hub's public key, so golf
// bookings were invisible to staff until this function (2026-09-08).
//
// Reads with the service role; returns only the fields staff need.
// The `key` check is a speed bump in line with the hub's access-code
// tier, not real auth — the table itself stays locked to the public.
//
// Deploy with --no-verify-jwt (the hub sends no Supabase auth).
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const STAFF_KEY = "NDSTAFF-2026";

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

const db = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "POST only" }, { status: 405 });
  }

  let body: { key?: string; from?: string; to?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body.key !== STAFF_KEY) {
    return jsonResponse({ error: "Bad key" }, { status: 403 });
  }
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const from = body.from ?? "";
  const to = body.to ?? "";
  if (!iso.test(from) || !iso.test(to) || from > to) {
    return jsonResponse(
      { error: "from/to must be YYYY-MM-DD with from <= to" },
      { status: 400 },
    );
  }

  // Bookings whose slots touch the window. booking_slots has no FK
  // filter syntax worth fighting here — pull confirmed bookings with
  // slots, filter in code (volumes are small).
  const { data, error } = await db
    .from("bookings")
    .select(
      "id, reference, status, customer_name, customer_email, customer_phone, party_size, booking_slots(slot_date, slot_time)",
    )
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    return jsonResponse({ error: `DB error: ${error.message}` }, { status: 500 });
  }

  const rows = (data ?? [])
    .map((b) => ({
      id: b.id,
      reference: b.reference,
      customer_name: b.customer_name,
      customer_email: b.customer_email,
      customer_phone: b.customer_phone,
      party_size: b.party_size,
      slots: (b.booking_slots ?? [])
        .filter((s) => s.slot_date >= from && s.slot_date <= to)
        .sort((a, z) =>
          `${a.slot_date}T${a.slot_time}`.localeCompare(
            `${z.slot_date}T${z.slot_time}`,
          ),
        ),
    }))
    .filter((b) => b.slots.length > 0);

  return jsonResponse({ bookings: rows });
});
