"use client";

import { supabase } from "@/lib/supabase";

// =============================================================
// event_entries — paid ticket purchases for `events`
// =============================================================
// One row per ticket transaction. Used by:
//   • World Cup match tickets (events.category = 'world_cup')
//   • Future ticketed events (DJ nights with cover, etc.)
//
// The matching Stripe flow lives in the `match-checkout` Edge
// Function — it reads the row, creates a PaymentIntent, and
// returns the client_secret. The webhook flips status to 'paid'
// once Stripe confirms.
// =============================================================

export type DbEventEntry = {
  id: string;
  event_id: string;
  ticket_type_id: string;
  attendee_name: string;
  attendee_email: string;
  attendee_phone: string;
  team_name: string | null;
  notes: string | null;
  heard_from: string | null;
  marketing_opt_in: boolean;
  quantity: number;
  amount_paid_pence: number | null;
  status: "pending_payment" | "paid" | "refunded" | "cancelled";
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NewEventEntry = {
  event_id: string;
  ticket_type_id: string;
  attendee_name: string;
  attendee_email: string;
  attendee_phone: string;
  quantity: number;
  notes?: string | null;
  heard_from?: string | null;
  marketing_opt_in?: boolean;
};

export async function createEventEntry(
  input: NewEventEntry,
): Promise<DbEventEntry> {
  const { data, error } = await supabase()
    .from("event_entries")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as DbEventEntry;
}
