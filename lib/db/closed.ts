"use client";

import { supabase } from "@/lib/supabase";

export type DbClosedDate = {
  id: string;
  venue_id: string | null; // null = both venues
  date: string; // YYYY-MM-DD
  reason: string | null;
};

export async function loadClosedDates(): Promise<DbClosedDate[]> {
  const { data, error } = await supabase()
    .from("closed_dates")
    .select("id, venue_id, date, reason")
    .order("date");
  if (error) throw error;
  return (data ?? []) as DbClosedDate[];
}

export async function createClosedDate(
  row: Omit<DbClosedDate, "id">,
): Promise<DbClosedDate> {
  const { data, error } = await supabase()
    .from("closed_dates")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as DbClosedDate;
}

export async function deleteClosedDate(id: string): Promise<void> {
  const { error } = await supabase().from("closed_dates").delete().eq("id", id);
  if (error) throw error;
}
