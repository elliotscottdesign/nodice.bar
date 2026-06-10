// =============================================================
// create-table-reservation — free /book/table reservations
// =============================================================
// POST /functions/v1/create-table-reservation
// Body (full reservation data — no row exists yet on the client side):
//   {
//     reservation_date: "YYYY-MM-DD",
//     start_time: "HH:MM",
//     duration_minutes: number,
//     party_size: number,
//     resource_count: number,
//     name: string,
//     email: string,
//     phone?: string | null,
//     notes?: string | null,
//     heard_from?: string | null,
//     marketing_opt_in?: boolean
//   }
//
// Flow:
//   1. Validate the body server-side.
//   2. Confirm the "table" product is enabled (admin kill-switch).
//   3. INSERT the bar_reservations row using the service_role key.
//   4. Return { reservation_id }.
//
// Free booking — no Stripe involved. status defaults to 'pending'
// in the DB and the founder confirms in /admin/bar-reservations.
//
// Why this shape:
//   The customer-site browser holds only the anon key. With RLS
//   enabled on bar_reservations (the secure config), anon cannot
//   insert directly. So the insert lives here, where the
//   service_role key bypasses RLS server-side.
// =============================================================

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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

type TableBookingInput = {
  reservation_date: string;
  start_time: string;
  duration_minutes: number;
  party_size: number;
  resource_count: number;
  name: string;
  email: string;
  phone?: string | null;
  notes?: string | null;
  heard_from?: string | null;
  marketing_opt_in?: boolean;
};

function validate(body: Partial<TableBookingInput>): {
  ok: true;
  input: TableBookingInput;
} | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body must be a JSON object" };
  }
  if (!body.reservation_date || !DATE_RE.test(body.reservation_date)) {
    return { ok: false, error: "reservation_date must be YYYY-MM-DD" };
  }
  if (!body.start_time || !TIME_RE.test(body.start_time)) {
    return { ok: false, error: "start_time must be HH:MM" };
  }
  if (
    typeof body.duration_minutes !== "number" ||
    body.duration_minutes <= 0 ||
    body.duration_minutes > 600
  ) {
    return { ok: false, error: "duration_minutes must be a positive number" };
  }
  if (
    typeof body.party_size !== "number" ||
    body.party_size <= 0 ||
    body.party_size > 50
  ) {
    return { ok: false, error: "party_size must be 1-50" };
  }
  if (
    typeof body.resource_count !== "number" ||
    body.resource_count <= 0 ||
    body.resource_count > 10
  ) {
    return { ok: false, error: "resource_count must be 1-10" };
  }
  if (!body.name || typeof body.name !== "string" || body.name.trim().length < 2) {
    return { ok: false, error: "name is required" };
  }
  if (!body.email || typeof body.email !== "string" || !EMAIL_RE.test(body.email)) {
    return { ok: false, error: "valid email is required" };
  }
  return {
    ok: true,
    input: {
      reservation_date: body.reservation_date,
      start_time: body.start_time,
      duration_minutes: body.duration_minutes,
      party_size: body.party_size,
      resource_count: body.resource_count,
      name: body.name.trim(),
      email: body.email.trim(),
      phone: typeof body.phone === "string" ? body.phone.trim() || null : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      heard_from:
        typeof body.heard_from === "string" ? body.heard_from.trim() || null : null,
      marketing_opt_in: !!body.marketing_opt_in,
    },
  };
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return jsonResponse({ error: "POST only" }, { status: 405 });
  }

  let raw: Partial<TableBookingInput>;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  const v = validate(raw);
  if (!v.ok) return jsonResponse({ error: v.error }, { status: 400 });
  const input = v.input;

  // Master kill-switch — admin flips this in /admin/products/table.
  const { data: product } = await db
    .from("bookable_products")
    .select("enabled, closed_message")
    .eq("id", "table")
    .maybeSingle();
  if (product && product.enabled === false) {
    return jsonResponse(
      {
        error:
          product.closed_message ||
          "Table reservations are temporarily paused. DM us on Instagram if it's urgent.",
      },
      { status: 423 },
    );
  }

  // ---------------------------------------------------------
  // Blocking-event check — match the client-side rule on /book/table.
  // If a World Cup match or food residency is on for this date with
  // blocks_table_bookings=true, the booking's [start_time,
  // start_time+duration_minutes) must END by 2 hours before the
  // event's start_time, or we reject. Stops anyone bypassing the
  // greyed-out slot grid by crafting a direct POST.
  // ---------------------------------------------------------
  const { data: blockers, error: blockersErr } = await db
    .from("events")
    .select("id, name, start_time, blocks_table_bookings")
    .eq("event_date", input.reservation_date)
    .eq("blocks_table_bookings", true);
  if (blockersErr) {
    return jsonResponse(
      { error: `Blocking-event lookup failed: ${blockersErr.message}` },
      { status: 500 },
    );
  }
  if (blockers && blockers.length > 0) {
    // Earliest-starting blocker. start_time-less blockers come last
    // and trigger a full-day refusal (we can't compute a cutoff).
    const sorted = [...blockers].sort((a, b) => {
      if (!a.start_time && !b.start_time) return 0;
      if (!a.start_time) return 1;
      if (!b.start_time) return -1;
      return String(a.start_time).localeCompare(String(b.start_time));
    });
    const earliest = sorted[0];
    if (!earliest.start_time) {
      return jsonResponse(
        {
          error:
            `Tables are fully booked on this date — ${earliest.name}. Pick a different night.`,
        },
        { status: 409 },
      );
    }
    const [eh, em] = String(earliest.start_time).split(":").map((s) => parseInt(s, 10));
    const eventMin = eh * 60 + (em || 0);
    const cutoffMin = eventMin - 120; // 2-hour lead time
    const [bh, bm] = input.start_time.split(":").map((s) => parseInt(s, 10));
    const bookingStart = bh * 60 + (bm || 0);
    const bookingEnd = bookingStart + input.duration_minutes;
    if (bookingEnd > cutoffMin) {
      const cutoffH = Math.floor(cutoffMin / 60);
      const cutoffM = cutoffMin % 60;
      return jsonResponse(
        {
          error:
            `That slot runs into ${earliest.name}. Last seating ends by ${String(cutoffH).padStart(2, "0")}:${String(cutoffM).padStart(2, "0")} on this date.`,
        },
        { status: 409 },
      );
    }
  }

  const { data: r, error: insertErr } = await db
    .from("bar_reservations")
    .insert({
      kind: "table",
      reservation_date: input.reservation_date,
      start_time: input.start_time,
      duration_minutes: input.duration_minutes,
      party_size: input.party_size,
      resource_count: input.resource_count,
      name: input.name,
      email: input.email,
      phone: input.phone,
      notes: input.notes,
      heard_from: input.heard_from,
      marketing_opt_in: input.marketing_opt_in,
    })
    .select("id")
    .single();
  if (insertErr || !r) {
    return jsonResponse(
      {
        error: `Failed to save reservation: ${
          insertErr?.message ?? "unknown error"
        }`,
      },
      { status: 500 },
    );
  }

  return jsonResponse({ reservation_id: r.id });
});
