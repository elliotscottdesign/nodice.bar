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

// =============================================================
// Same-day booking cutoff (founder rule, 9 Oct 2026) — online table
// booking closes one hour before we open that day. Mirrors the
// /book/table form so a crafted request can't slip a late booking past.
// =============================================================
const BOOKING_CLOSE_LEAD_MIN = 60;

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
function dayOfWeekUtc(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}
function londonNowParts(now = new Date()): { iso: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  let hour = parseInt(parts.hour, 10);
  if (hour === 24) hour = 0;
  return {
    iso: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: hour * 60 + parseInt(parts.minute, 10),
  };
}
async function bookingCutoffError(
  productId: string,
  isoDate: string,
): Promise<string | null> {
  let openMin: number | null = null;
  const { data: ovr } = await db
    .from("bookable_date_overrides")
    .select("closed, open_time")
    .eq("product_id", productId)
    .eq("date", isoDate)
    .maybeSingle();
  if (ovr) {
    if (ovr.closed) return "We're closed on that day — walk in and we'll sort you out.";
    if (ovr.open_time) openMin = timeToMin(ovr.open_time);
  }
  if (openMin === null) {
    const dow = dayOfWeekUtc(isoDate);
    const { data: hours } = await db
      .from("bookable_hours")
      .select("open_time")
      .eq("product_id", productId)
      .eq("day_of_week", dow);
    if (!hours || hours.length === 0) {
      return "We don't take online bookings on that day — just walk in.";
    }
    openMin = Math.min(
      ...(hours as { open_time: string }[]).map((h) => timeToMin(h.open_time)),
    );
  }
  const { iso: todayIso, minutes: nowMin } = londonNowParts();
  if (isoDate < todayIso) return "That date has passed.";
  if (isoDate === todayIso && nowMin >= openMin - BOOKING_CLOSE_LEAD_MIN) {
    return "Online booking for today has closed — we stop one hour before we open. Just walk in and ask at the bar.";
  }
  return null;
}

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

  // Same-day cutoff: online table booking closes one hour before we
  // open (founder rule 9 Oct 2026) — mirrors /book/table so a crafted
  // late request can't slip through.
  const cutoffErr = await bookingCutoffError("table", input.reservation_date);
  if (cutoffErr) return jsonResponse({ error: cutoffErr }, { status: 423 });

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

  // ---------------------------------------------------------
  // Auto-confirm vs hold for review (founder 2026-09-18).
  // A website booking auto-confirms UNLESS the venue is already at
  // capacity in an overlapping window — i.e. CAPACITY_THRESHOLD+ people
  // are already reserved across pool AND tables at the same time. When
  // that's the case the booking is saved as 'pending' for staff to
  // review (no customer confirmation email); otherwise it's 'confirmed'
  // and the customer gets their email right away.
  //
  // "already reserved" = existing overlapping covers BEFORE this booking
  // (matches the founder's wording "already sixty people reserved").
  // Counts confirmed + paid + pending rows so a pile of pending web
  // requests can't quietly blow past the cap either.
  // ---------------------------------------------------------
  const CAPACITY_THRESHOLD = 60;
  const [nbh, nbm] = input.start_time.split(":").map((s) => parseInt(s, 10));
  const newStart = nbh * 60 + (nbm || 0);
  const newEnd = newStart + input.duration_minutes;
  let concurrentCovers = 0;
  {
    const { data: sameDay, error: coverErr } = await db
      .from("bar_reservations")
      .select("start_time, duration_minutes, party_size, status")
      .eq("reservation_date", input.reservation_date)
      .in("status", ["confirmed", "paid", "pending"]);
    if (coverErr) {
      return jsonResponse(
        { error: `Capacity lookup failed: ${coverErr.message}` },
        { status: 500 },
      );
    }
    for (const row of sameDay ?? []) {
      const [rh, rm] = String(row.start_time).split(":").map((s) => parseInt(s, 10));
      const s = rh * 60 + (rm || 0);
      const e = s + (row.duration_minutes ?? 0);
      // Overlap: existing starts before the new one ends AND ends after
      // the new one starts.
      if (s < newEnd && e > newStart) {
        concurrentCovers += row.party_size ?? 0;
      }
    }
  }
  const overCapacity = concurrentCovers >= CAPACITY_THRESHOLD;
  const bookingStatus = overCapacity ? "pending" : "confirmed";

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
      status: bookingStatus,
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

  // Founder alert — every web reservation emails elliot@nodice.bar
  // (2026-08-26 request). Fire-and-forget: an alert hiccup must never
  // fail the customer's booking.
  fetch(`${SUPABASE_URL}/functions/v1/notify-big-booking`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ reservation_id: r.id }),
  }).catch((e) => {
    console.error(`Booking alert failed for reservation ${r.id}:`, e);
  });

  // Auto-confirmed bookings email the customer their confirmation now
  // (via send-pool-confirmation, which handles kind 'table' too).
  // Over-capacity 'pending' bookings get NO email — staff review them
  // and confirm from /admin, which sends the email at that point.
  // Never email the info@ walk-in placeholder.
  if (
    bookingStatus === "confirmed" &&
    input.email &&
    input.email.trim().toLowerCase() !== "info@nodice.bar"
  ) {
    fetch(`${SUPABASE_URL}/functions/v1/send-pool-confirmation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ reservation_id: r.id, include_notes: false }),
    }).catch((e) => {
      console.error(`Customer confirmation email failed for ${r.id}:`, e);
    });
  }

  return jsonResponse({ reservation_id: r.id, status: bookingStatus });
});
