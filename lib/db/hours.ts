"use client";

import { supabase } from "@/lib/supabase";

export type DbOpeningHour = {
  venue_id: string;
  day_of_week: number; // 0 = Sunday
  open_time: string; // "HH:MM:SS"
  close_time: string; // "HH:MM:SS"
  closed: boolean;
};

export async function loadOpeningHours(): Promise<DbOpeningHour[]> {
  const { data, error } = await supabase()
    .from("opening_hours")
    .select("venue_id, day_of_week, open_time, close_time, closed")
    .order("day_of_week");
  if (error) throw error;
  return (data ?? []) as DbOpeningHour[];
}

// opening_hours uses (venue_id, day_of_week) as the primary key, so writes
// are upserts against that composite key.
export async function upsertOpeningHour(row: DbOpeningHour): Promise<DbOpeningHour> {
  const { data, error } = await supabase()
    .from("opening_hours")
    .upsert(row, { onConflict: "venue_id,day_of_week" })
    .select()
    .single();
  if (error) throw error;
  return data as DbOpeningHour;
}
