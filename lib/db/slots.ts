"use client";

import { supabase } from "@/lib/supabase";

export type DbSlotOverride = {
  id: string;
  venue_id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // "HH:MM:SS"
  end_time: string;
  capacity: number;
  reason: string | null;
};

export async function loadSlotOverrides(): Promise<DbSlotOverride[]> {
  const { data, error } = await supabase()
    .from("slot_overrides")
    .select("id, venue_id, date, start_time, end_time, capacity, reason")
    .order("date");
  if (error) throw error;
  return (data ?? []) as DbSlotOverride[];
}

export async function createSlotOverride(
  row: Omit<DbSlotOverride, "id">,
): Promise<DbSlotOverride> {
  const { data, error } = await supabase()
    .from("slot_overrides")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as DbSlotOverride;
}

export async function updateSlotOverride(
  id: string,
  patch: Partial<Omit<DbSlotOverride, "id">>,
): Promise<DbSlotOverride> {
  const { data, error } = await supabase()
    .from("slot_overrides")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbSlotOverride;
}

export async function deleteSlotOverride(id: string): Promise<void> {
  const { error } = await supabase().from("slot_overrides").delete().eq("id", id);
  if (error) throw error;
}
