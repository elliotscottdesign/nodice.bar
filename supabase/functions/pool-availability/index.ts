// =============================================================
// /functions/v1/pool-availability
// =============================================================
// Read-only companion to pool-checkout. The public /book/pool page
// cannot read bar_reservations directly (anon has INSERT only, no
// SELECT — customer names/emails must never reach the browser). This
// function runs with the service_role key and returns ONLY what the
// slot grid needs to grey out full times: the pool-table capacity and
// a privacy-safe list of the day's active bookings (start_time,
// duration_minutes, resource_count — no name, email, phone or notes).
//
// The frontend then mirrors the exact same overlap/capacity maths that
// pool-checkout enforces at payment, so a slot that WOULD be rejected
// at checkout is shown locked up front instead of failing after the
// customer has filled in the whole form.
//
// GET  /pool-availability?date=YYYY-MM-DD
// POST /pool-availability   { "date": "YYYY-MM-DD" }
//   → { capacity: number, bookings: [{ start_time, duration_minutes,
//       resource_count }] }
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Same fallback chain as pool-checkout: bookable_products.capacity,
// then POOL_TABLE_COUNT env, then a hardcoded 4. Keeping these in
// lockstep is what makes the greyed-out grid match the checkout guard.
const HARDCODED_POOL_TABLES = 4;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  let date = "";
  try {
    if (req.method === "GET") {
      date = new URL(req.url).searchParams.get("date") ?? "";
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      date = typeof body?.date === "string" ? body.date : "";
    } else {
      return jsonResponse({ error: "Method not allowed" }, { status: 405 });
    }
  } catch {
    date = "";
  }

  if (!DATE_RE.test(date)) {
    return jsonResponse(
      { error: "Pass a date as YYYY-MM-DD." },
      { status: 400 },
    );
  }

  // Capacity (number of pool tables bookable online at once).
  const { data: product } = await db
    .from("bookable_products")
    .select("capacity")
    .eq("id", "pool")
    .maybeSingle();

  const envCount = parseInt(Deno.env.get("POOL_TABLE_COUNT") ?? "", 10);
  const capacity =
    (product && (product as { capacity?: number }).capacity) ||
    (Number.isFinite(envCount) && envCount > 0 ? envCount : HARDCODED_POOL_TABLES);

  // Active bookings on the date — SAME status filter as the checkout
  // capacity guard. No PII columns selected.
  const { data: rows, error } = await db
    .from("bar_reservations")
    .select("start_time, duration_minutes, resource_count")
    .eq("kind", "pool")
    .eq("reservation_date", date)
    .in("status", ["pending", "paid", "confirmed"]);

  if (error) {
    return jsonResponse(
      { error: `Availability lookup failed: ${error.message}` },
      { status: 500 },
    );
  }

  const bookings = (rows ?? []).map((r) => ({
    start_time: String(r.start_time),
    duration_minutes: r.duration_minutes ?? 0,
    resource_count: r.resource_count ?? 1,
  }));

  return jsonResponse({ capacity, bookings });
});
