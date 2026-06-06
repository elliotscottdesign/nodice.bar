"use client";

import { supabase } from "@/lib/supabase";

// Reads + writes for the calendar at /events. Each row is a concrete
// dated event with artwork + title + body + optional link.

export type DbCalendarEvent = {
  id: string;
  event_date: string;     // YYYY-MM-DD
  title: string;
  body: string | null;
  image_url: string;      // public URL or empty
  link_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type NewCalendarEvent = Omit<
  DbCalendarEvent,
  "id" | "created_at" | "updated_at"
>;

// Load all events within [from, to] (inclusive). Used to fill a
// month's calendar in one fetch.
export async function loadCalendarEventsInRange(
  fromIso: string,
  toIso: string,
): Promise<DbCalendarEvent[]> {
  const { data, error } = await supabase()
    .from("calendar_events")
    .select("*")
    .gte("event_date", fromIso)
    .lte("event_date", toIso)
    .order("event_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbCalendarEvent[];
}

// Admin: load everything sorted by date. Lighter pages can use the
// range loader above instead.
export async function loadAllCalendarEvents(): Promise<DbCalendarEvent[]> {
  const { data, error } = await supabase()
    .from("calendar_events")
    .select("*")
    .order("event_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbCalendarEvent[];
}

export async function createCalendarEvent(
  row: NewCalendarEvent,
): Promise<DbCalendarEvent> {
  const { data, error } = await supabase()
    .from("calendar_events")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as DbCalendarEvent;
}

export async function updateCalendarEvent(
  id: string,
  patch: Partial<NewCalendarEvent>,
): Promise<DbCalendarEvent> {
  const { data, error } = await supabase()
    .from("calendar_events")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbCalendarEvent;
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const { error } = await supabase().from("calendar_events").delete().eq("id", id);
  if (error) throw error;
}
