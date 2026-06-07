"use client";

import { supabase } from "@/lib/supabase";

// Public-side helper for the /book/pool and /book/table reservation
// forms. Inserts a pending reservation; the admin confirms or
// cancels via the admin panel. Stripe is not wired up yet — every
// reservation lands as 'pending' regardless of amount.

export type BarReservationKind = "pool" | "table";

export type DbBarReservation = {
  id: string;
  kind: BarReservationKind;
  reservation_date: string;   // YYYY-MM-DD
  start_time: string;          // HH:MM[:SS]
  duration_minutes: number;
  party_size: number;
  resource_count: number;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  /** "Where did you hear about us?" — free text captured at booking. */
  heard_from: string | null;
  /** GDPR newsletter opt-in. Unchecked by default. */
  marketing_opt_in: boolean;
  /** Total charged in pence (£6 per 30 min for pool, null for legacy). */
  amount_pence: number | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  status: "pending" | "paid" | "confirmed" | "cancelled" | "refunded";
  created_at: string;
  updated_at: string;
};

export type NewBarReservation = Omit<
  DbBarReservation,
  | "id"
  | "status"
  | "created_at"
  | "updated_at"
  | "heard_from"
  | "marketing_opt_in"
  | "amount_pence"
  | "stripe_payment_intent_id"
  | "paid_at"
> & {
  heard_from?: string | null;
  marketing_opt_in?: boolean;
};

export async function createBarReservation(
  input: NewBarReservation,
): Promise<DbBarReservation> {
  const { data, error } = await supabase()
    .from("bar_reservations")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as DbBarReservation;
}

// Admin-side: load every reservation, newest first.
export async function loadBarReservations(): Promise<DbBarReservation[]> {
  const { data, error } = await supabase()
    .from("bar_reservations")
    .select("*")
    .order("reservation_date", { ascending: false })
    .order("start_time", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbBarReservation[];
}

export async function setBarReservationStatus(
  id: string,
  status: DbBarReservation["status"],
): Promise<DbBarReservation> {
  const { data, error } = await supabase()
    .from("bar_reservations")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbBarReservation;
}
