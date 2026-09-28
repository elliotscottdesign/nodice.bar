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
  total_pence: number;
  subtotal_pence: number;
  discount_pence: number;
  status: BookingStatus;
  stripe_payment_intent_id: string | null;
  created_at: string;
  // Joined slot rows for first-slot display in lists; lightweight on purpose.
  slots: { slot_date: string; slot_time: string; count: number }[];
};

export async function loadBookings(): Promise<DbBookingRow[]> {
  const { data, error } = await supabase()
    .from("bookings")
    .select(
      `id, reference, venue_id, customer_name, customer_email, customer_phone,
       party_size, total_pence, subtotal_pence, discount_pence, status,
       stripe_payment_intent_id, created_at,
       slots:booking_slots(slot_date, slot_time, count)`,
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
