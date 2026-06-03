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
