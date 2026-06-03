"use client";

import { supabase } from "@/lib/supabase";

export type DbSiteEvent = {
  id: string;
  venue: string;
  day: string;
  title: string;
  body: string;
  featured: boolean;
  venue_order: number;
  event_order: number;
  active: boolean;
};

export async function loadEvents(): Promise<DbSiteEvent[]> {
  const { data, error } = await supabase()
    .from("site_events")
    .select(
      "id, venue, day, title, body, featured, venue_order, event_order, active",
    )
    .order("venue_order")
    .order("event_order");
  if (error) throw error;
  return (data ?? []) as DbSiteEvent[];
}

export async function createEvent(row: Omit<DbSiteEvent, "id">): Promise<DbSiteEvent> {
  const { data, error } = await supabase()
    .from("site_events")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as DbSiteEvent;
}

export async function updateEvent(
  id: string,
  patch: Partial<Omit<DbSiteEvent, "id">>,
): Promise<DbSiteEvent> {
  const { data, error } = await supabase()
    .from("site_events")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbSiteEvent;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase().from("site_events").delete().eq("id", id);
  if (error) throw error;
}

/** Group events into columns in venue_order order. */
export function groupEvents(
  rows: DbSiteEvent[],
): { venue: string; venue_order: number; items: DbSiteEvent[] }[] {
  const map = new Map<string, { venue_order: number; items: DbSiteEvent[] }>();
  for (const r of rows) {
    const entry = map.get(r.venue);
    if (entry) entry.items.push(r);
    else map.set(r.venue, { venue_order: r.venue_order, items: [r] });
  }
  return [...map.entries()]
    .map(([venue, v]) => ({
      venue,
      venue_order: v.venue_order,
      items: v.items.sort((a, b) => a.event_order - b.event_order),
    }))
    .sort((a, b) => a.venue_order - b.venue_order);
}
