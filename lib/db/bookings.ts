"use client";

import { supabase } from "@/lib/supabase";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "expired"
  | "refunded";

export type DbBookingRow = {
  id: string;
  reference: string;
  venue_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  party_size: number;
  notes: string | null;
  total_pence: number;
  subtotal_pence: number;
  discount_pence: number;
  status: BookingStatus;
  stripe_payment_intent_id: string | null;
  created_at: string;
  // Joined slot rows for first-slot display in lists; lightweight on purpose.
  // `id` is carried so the admin can reschedule a specific slot row.
  slots: { id: string; slot_date: string; slot_time: string; count: number }[];
};

export async function loadBookings(): Promise<DbBookingRow[]> {
  const { data, error } = await supabase()
    .from("bookings")
    .select(
      `id, reference, venue_id, customer_name, customer_email, customer_phone,
       party_size, notes, total_pence, subtotal_pence, discount_pence, status,
       stripe_payment_intent_id, created_at,
       slots:booking_slots(id, slot_date, slot_time, count)`,
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as DbBookingRow[];
}

// First slot (chronological) — useful for "when is the booking" displays.
export function firstSlot(b: DbBookingRow) {
  if (!b.slots || b.slots.length === 0) return null;
  return [...b.slots].sort((a, b) =>
    a.slot_date === b.slot_date
      ? a.slot_time.localeCompare(b.slot_time)
      : a.slot_date.localeCompare(b.slot_date),
  )[0];
}

export function slotIso(b: DbBookingRow): string | null {
  const s = firstSlot(b);
  if (!s) return null;
  return `${s.slot_date}T${s.slot_time}`;
}

// =============================================================
// Manual golf booking (admin) — founder 28 Sep 2026.
// The golf equivalent of the pool/table/tournament "+ Add
// manually" forms. Golf normally goes card → Stripe → webhook;
// this records a phone / walk-in / comp booking straight as a
// CONFIRMED booking (+ slot + ticket lines) with no card.
// Authenticated admin session; anon already has INSERT grants on
// these tables for the public pending-booking path.
// =============================================================

export type GolfTicketLine = {
  name: string;      // must match a row in `tickets` (e.g. "Adult round")
  quantity: number;
};

export type ManualGolfBooking = {
  slot_date: string;   // YYYY-MM-DD
  slot_time: string;   // HH:MM
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  tickets: GolfTicketLine[];
  comp?: boolean;      // true = free/guest entry (total £0)
  notes?: string | null; // optional free-text (occasion / accessibility / request)
};

// Short, phone-friendly reference. "ND-" prefix (the old golf flow
// used "PLNK-" — withheld while the Plonk name is on hold).
function manualGolfRef(): string {
  const r = () =>
    Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ND-${r()}-${r()}`;
}

export async function createManualGolfBooking(
  input: ManualGolfBooking,
): Promise<{ id: string; reference: string }> {
  const sb = supabase();

  // Golf venue (slug 'hackney') + the ticket rows we're selling.
  const [{ data: venue, error: venueErr }, { data: ticketRows, error: tErr }] =
    await Promise.all([
      sb.from("venues").select("id").eq("slug", "hackney").single(),
      sb.from("tickets").select("id, name, price_pence").eq("active", true),
    ]);
  if (venueErr || !venue) throw new Error(venueErr?.message || "Golf venue not found");
  if (tErr) throw new Error(tErr.message);

  const ticketByName = new Map(
    (ticketRows ?? []).map((t) => [t.name, t]),
  );

  const lines = input.tickets.filter((l) => l.quantity > 0);
  if (lines.length === 0) throw new Error("Add at least one player / ticket.");

  let subtotal = 0;
  const ticketLineData = lines.map((l) => {
    const t = ticketByName.get(l.name);
    if (!t) throw new Error(`Ticket "${l.name}" not found`);
    subtotal += t.price_pence * l.quantity;
    return { ticket_id: t.id, quantity: l.quantity, unit_price_pence: t.price_pence };
  });
  const partySize = lines.reduce((n, l) => n + l.quantity, 0);
  // Comp = fully discounted to £0; paid = full price.
  const discount = input.comp ? subtotal : 0;
  const total = input.comp ? 0 : subtotal;

  const reference = manualGolfRef();
  const { data: booking, error: bErr } = await sb
    .from("bookings")
    .insert({
      reference,
      venue_id: venue.id,
      customer_name: input.customer_name,
      customer_email: input.customer_email,
      customer_phone: input.customer_phone,
      heard_from: "Manual admin entry",
      marketing_opt_in: false,
      notes: input.notes?.trim() ? input.notes.trim().slice(0, 500) : null,
      party_size: partySize,
      subtotal_pence: subtotal,
      discount_pence: discount,
      total_pence: total,
      currency: "gbp",
      status: "confirmed",
    })
    .select("id, reference")
    .single();
  if (bErr || !booking) throw new Error(bErr?.message || "Booking insert failed");

  const { error: sErr } = await sb.from("booking_slots").insert({
    booking_id: booking.id,
    slot_date: input.slot_date,
    slot_time: input.slot_time,
    count: partySize,
  });
  if (sErr) throw new Error(`Booking saved but slot failed: ${sErr.message}`);

  const { error: tlErr } = await sb.from("booking_tickets").insert(
    ticketLineData.map((t) => ({ ...t, booking_id: booking.id })),
  );
  if (tlErr) throw new Error(`Booking saved but tickets failed: ${tlErr.message}`);

  return booking;
}

// =============================================================
// Editing an existing golf booking (admin) — founder 3 Nov 2026.
// Golf was the one booking type with no edit path: pool / table /
// private-hire (bar_reservations) and tournaments could be changed
// in the admin, golf could only be created + viewed. These bring it
// in line — change the contact details, party size, notes and status
// (incl. cancel/restore), and move the booking to another day / time.
//
// Every write re-SELECTs the row it changed and treats ZERO returned
// rows as a hard error. On this project an anon/authenticated write
// that RLS blocks comes back as a silent 204 / 0-rows "success" (the
// gallery_images trap), so without this guard a save could look fine
// and change nothing. The admin runs as an authenticated Supabase
// session (AdminGate → signInWithPassword), which has update grants
// on these tables.
// =============================================================

function noRowsMsg(what: string): string {
  return (
    `Couldn't save the ${what} — the booking wasn't changed. ` +
    `This is a backend permissions block, not a typo. Tell the developer ` +
    `(golf bookings tables need an authenticated update policy).`
  );
}

export type GolfBookingEdit = {
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  party_size: number;
  notes: string | null;
};

// Update the contact details / party size / notes on the booking row.
export async function updateGolfBooking(
  id: string,
  fields: GolfBookingEdit,
): Promise<void> {
  const { data, error } = await supabase()
    .from("bookings")
    .update({
      customer_name: fields.customer_name.trim(),
      customer_email: fields.customer_email.trim(),
      customer_phone: fields.customer_phone?.trim() || null,
      party_size: fields.party_size,
      notes: fields.notes?.trim() ? fields.notes.trim().slice(0, 500) : null,
    })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error(noRowsMsg("booking details"));
}

// Change a booking's status — confirm, cancel, restore, mark refunded.
export async function setGolfBookingStatus(
  id: string,
  status: BookingStatus,
): Promise<void> {
  const { data, error } = await supabase()
    .from("bookings")
    .update({ status })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error(noRowsMsg("status change"));
}

// Reschedule — move one slot row to a new date / time (and keep its
// headcount in step with the party size for the usual single-slot
// booking). Golf slots have no hard server-side capacity on this
// project (availability is advisory), so this just moves the slot.
export async function rescheduleGolfSlot(
  slotId: string,
  slot_date: string,
  slot_time: string,
  count?: number,
): Promise<void> {
  const patch: Record<string, unknown> = {
    slot_date,
    // store seconds-precision time like the booking flow does
    slot_time: slot_time.length === 5 ? `${slot_time}:00` : slot_time,
  };
  if (typeof count === "number" && count > 0) patch.count = count;
  const { data, error } = await supabase()
    .from("booking_slots")
    .update(patch)
    .eq("id", slotId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error(noRowsMsg("new date / time"));
}
