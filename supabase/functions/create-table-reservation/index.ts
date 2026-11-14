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

// =============================================================
// Same-day HARD 3pm cutoff (founder rule, 14 Nov 2026) — online table
// booking for a date closes at 15:00 Europe/London on that date, flat,
// regardless of opening time. Up to 2:59pm today is still bookable; from
// 3:00pm today drops off (future days unaffected). Stricter than, and
// additive to, the 1-hour-before-open lead rule — whichever hits first
// closes the day. Mirrors /book/table so a crafted request can't slip a
// late booking past. CUSTOMER path only — staff/office add-a-booking
// writes directly to bar_reservations and never runs through this fn.
// =============================================================
const TABLE_SAME_DAY_CUTOFF_MIN = 15 * 60; // 15:00

// =============================================================
// Capacity gate (founder rule, 2026-10-13)
// =============================================================
// Two easy-to-change knobs:
//   MAX_PARTY_SIZE  — biggest single table group we take online. The
//                     widget dropdown and /book/table clamp to this, and
//                     we enforce it here so a crafted request can't beat
//                     it. Bigger groups go through private hire.
//   DAILY_CAPACITY  — how many covers (people) we'll auto-confirm across
//                     ALL confirmed TABLE reservations on one date. Once
//                     a new booking would push the day's confirmed covers
//                     past this, we DON'T auto-confirm it — we hold it for
//                     the office to review (the customer still gets a warm
//                     "we'll be in touch" message, never a rejection).
//                     This is a PER-DAY total, not per time-slot.
const MAX_PARTY_SIZE = 20;
const DAILY_CAPACITY = 60;

// =============================================================
// Bench table capacity (founder rule, 6 Nov 2026)
// =============================================================
// The real bookable tables are the TEN orange-chair tables along the
// bench — T1 (the two-seater by the front door) through T10 — mirroring
// the till floor plan (DEFAULT_FLOOR in the team-hub repo's
// src/till/TillScreen.jsx). EACH TABLE SEATS 2, so the bench holds about
// 10 tables / 20 covers AT ANY ONE SITTING. Online reservations must not
// promise more bench tables than physically exist for an overlapping time
// window — a party needing >2 uses multiple tables (ceil(party / 2)).
//
// EDIT THESE TWO NUMBERS to match the floor plan if the bench changes.
// (The till ↔ booking live auto-integration is a later-stage job; for now
// these numbers are kept in sync with the till plan by hand.)
const BENCH_TABLE_COUNT = 10; // T1..T10 along the bench
const SEATS_PER_BENCH_TABLE = 2; // each orange-chair table seats 2
// Covers available on the bench per sitting (10 × 2 = 20). Handy for copy
// / future tweaks; the gate itself counts TABLES, not raw covers.
const BENCH_SEATS_PER_SITTING = BENCH_TABLE_COUNT * SEATS_PER_BENCH_TABLE;

/** Tables a party of `partySize` needs on the bench — 2 seats per table,
 *  so a group of 3 or 4 takes 2 tables, 5–6 takes 3, etc. */
function benchTablesForParty(partySize: number): number {
  return Math.max(1, Math.ceil(partySize / SEATS_PER_BENCH_TABLE));
}

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
    body.party_size > MAX_PARTY_SIZE
  ) {
    return {
      ok: false,
      error:
        `For groups over ${MAX_PARTY_SIZE} we'll sort you out personally — drop us a line at info@nodice.bar or ask about private hire.`,
    };
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

  // Same-day HARD 3pm cutoff (founder rule 14 Nov 2026) — once the London
  // wall-clock is at/after 3pm, today is no longer bookable online. Future
  // dates are never closed by this; past dates are already caught above.
  {
    const { iso: todayIso, minutes: nowMin } = londonNowParts();
    if (
      input.reservation_date === todayIso &&
      nowMin >= TABLE_SAME_DAY_CUTOFF_MIN
    ) {
      return jsonResponse(
        {
          error:
            "Online table bookings for today are closed — pop in and we'll seat you if we can.",
        },
        { status: 423 },
      );
    }
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

  // ---------------------------------------------------------
  // Auto-confirm vs hold for office review (founder 2026-10-13).
  // Sum the covers ALREADY CONFIRMED across every table reservation on
  // this SAME DATE (per-day, not per time-slot — a busy day is a busy
  // day), add this booking's party, and:
  //   total <= DAILY_CAPACITY  → auto-confirm, email the customer now.
  //   total  > DAILY_CAPACITY  → DON'T auto-confirm. Save as 'pending'
  //        so it lands in the office's review queue (/admin/table-
  //        reservations → Pending), send the customer a warm "gone to
  //        our office, we'll be in touch" message (NOT a guarantee), and
  //        flag the office alert as needing a look.
  // Only confirmed + paid rows count toward the running total — a pile
  // of not-yet-reviewed 'pending' holds doesn't block the cap (they're
  // not promised covers yet; the office confirms them, at which point
  // they start to count).
  // ---------------------------------------------------------
  // One fetch of the day's confirmed+paid table rows powers BOTH gates:
  //   (a) per-DAY cover gate  — sum of covers across the whole date.
  //   (b) per-SITTING bench gate — tables in use during this booking's
  //       overlapping time window (see below).
  let confirmedCoversToday = 0;
  let benchTablesInUseThisSitting = 0;
  {
    const { data: sameDay, error: coverErr } = await db
      .from("bar_reservations")
      .select("party_size, status, start_time, duration_minutes")
      .eq("reservation_date", input.reservation_date)
      .eq("kind", "table")
      .in("status", ["confirmed", "paid"]);
    if (coverErr) {
      return jsonResponse(
        { error: `Capacity lookup failed: ${coverErr.message}` },
        { status: 500 },
      );
    }
    // This booking's time window [start, start+duration) in minutes.
    const thisStart = timeToMin(input.start_time);
    const thisEnd = thisStart + input.duration_minutes;
    for (const row of sameDay ?? []) {
      confirmedCoversToday += row.party_size ?? 0;
      // Bench gate: only rows whose time window OVERLAPS this booking's
      // window compete for the same physical tables at the same sitting.
      // Rows missing a start_time can't be placed on the overlap axis, so
      // we conservatively count them as overlapping (better to hold for
      // office review than to oversell the bench).
      const rowStart =
        typeof row.start_time === "string" && row.start_time
          ? timeToMin(row.start_time)
          : null;
      const rowDur =
        typeof row.duration_minutes === "number" && row.duration_minutes > 0
          ? row.duration_minutes
          : 0;
      const overlaps =
        rowStart === null ||
        (rowStart < thisEnd && rowStart + rowDur > thisStart);
      if (overlaps) {
        benchTablesInUseThisSitting += benchTablesForParty(row.party_size ?? 0);
      }
    }
  }

  // Gate (a): per-DAY cover total across all sittings/turns (founder
  // 13 Oct 2026). Gate (b): per-SITTING bench tables — this booking's
  // tables + those already committed during its overlapping window must
  // not exceed the physical bench (founder 6 Nov 2026). EITHER gate
  // tripping routes the booking to the warm office-review hold (pending)
  // rather than a hard rejection — the customer is never turned away, the
  // office just confirms it by hand. Reconciliation of the two numbers
  // (20-cover bench/sitting vs 60-cover/day) is intentional: 60/day spans
  // multiple sittings/turns through the night; see the hand-over note.
  const dayTotalWithThis = confirmedCoversToday + input.party_size;
  const overDailyCapacity = dayTotalWithThis > DAILY_CAPACITY;

  const benchTablesWithThis =
    benchTablesInUseThisSitting + benchTablesForParty(input.party_size);
  const benchSittingFull = benchTablesWithThis > BENCH_TABLE_COUNT;

  const overCapacity = overDailyCapacity || benchSittingFull;
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

  // Email the customer either way — but with clearly different copy:
  //   confirmed    → the normal "your table's locked in" confirmation.
  //   pending      → a warm "gone to our office, we'll be in touch to
  //                  confirm" message (NOT a guaranteed table). The
  //                  office_review flag switches send-pool-confirmation
  //                  over to that variant. When staff later confirm the
  //                  hold from /admin, the standard confirmation goes out.
  // Never email the info@ walk-in placeholder.
  if (input.email && input.email.trim().toLowerCase() !== "info@nodice.bar") {
    fetch(`${SUPABASE_URL}/functions/v1/send-pool-confirmation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        reservation_id: r.id,
        include_notes: false,
        office_review: bookingStatus === "pending",
      }),
    }).catch((e) => {
      console.error(`Customer email failed for ${r.id}:`, e);
    });
  }

  return jsonResponse({ reservation_id: r.id, status: bookingStatus });
});
