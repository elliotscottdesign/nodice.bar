"use client";

import { supabase } from "@/lib/supabase";

// =============================================================
// Booking settings — per-product on/off switch
// =============================================================
// Backs the `booking_settings` table (migration
// 20260607000013_booking-settings.sql). Each row is one bookable
// product: 'pool', 'table', 'tournament', and any future
// surfaces (e.g. 'golf' once Plonk Golf shares this codebase).
//
// The customer-facing form reads `enabled` to decide whether to
// render the form or the `closed_message`. The Edge Function
// re-reads it server-side so a customer can't bypass the gate
// by holding the form open while we toggle it off.
// =============================================================

export type BookingProductId = "pool" | "table" | "tournament" | string;

export type DbBookingSetting = {
  id: BookingProductId;
  enabled: boolean;
  closed_message: string | null;
  updated_at: string;
};

export async function loadBookingSetting(
  id: BookingProductId,
): Promise<DbBookingSetting | null> {
  const { data, error } = await supabase()
    .from("booking_settings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as DbBookingSetting | null) ?? null;
}

export async function loadAllBookingSettings(): Promise<DbBookingSetting[]> {
  const { data, error } = await supabase()
    .from("booking_settings")
    .select("*")
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbBookingSetting[];
}

export async function updateBookingSetting(
  id: BookingProductId,
  patch: Partial<Pick<DbBookingSetting, "enabled" | "closed_message">>,
): Promise<DbBookingSetting> {
  const { data, error } = await supabase()
    .from("booking_settings")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbBookingSetting;
}
