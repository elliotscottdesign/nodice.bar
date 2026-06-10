"use client";

import { supabase } from "@/lib/supabase";

// =============================================================
// Events platform — unified DB module
// =============================================================
// Talks to the events / ticket_types / event_entries tables added
// in migration 20260607000009_events-platform-schema.sql.
//
// Not to be confused with lib/db/events.ts, which is the legacy
// module for the older `site_events` table (weekly DJ listings on
// the homepage). Those two systems will eventually merge but for
// Phase 1 they're separate.
// =============================================================

export type EventCategory =
  | "pool_tournament_doubles"
  | "pool_tournament_singles"
  | "pool_special"
  | "dj_night"
  | "food_event"
  | "drink_special"
  | "arcade"
  | "golf"
  | "world_cup"
  | "other";

export type RecurrenceType = "none" | "weekly" | "fortnightly" | "monthly";

export type EventEntryStatus =
  | "pending_payment"
  | "paid"
  | "refunded"
  | "cancelled";

export type DbEvent = {
  id: string;
  name: string;
  description: string | null;
  external_link: string | null;
  poster_url: string | null;
  category: EventCategory;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  recurrence_type: RecurrenceType;
  recurrence_parent_id: string | null;
  show_on_pool_schedule: boolean;
  show_on_events_calendar: boolean;
  show_on_bar_page: boolean;
  requires_ticket: boolean;
  bookable: boolean;
  max_attendees: number | null;
  registration_open: boolean;
  paid_entries_count: number;
  /** True = this event closes /book/table reservations for
   *  event_date. The booking calendar greys out the day and surfaces
   *  a message linking to the right booking flow. */
  blocks_table_bookings: boolean;
  created_at: string;
  updated_at: string;
};

export type DbTicketType = {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price_pence: number;
  capacity: number | null;
  available_from: string | null;
  available_until: string | null;
  sort_order: number;
  active: boolean;
  paid_count: number;
  created_at: string;
  updated_at: string;
};

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
  status: EventEntryStatus;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NewEvent = Omit<
  DbEvent,
  "id" | "paid_entries_count" | "created_at" | "updated_at"
>;

export type NewTicketType = Omit<
  DbTicketType,
  "id" | "event_id" | "paid_count" | "created_at" | "updated_at"
>;

export type NewEventEntry = {
  event_id: string;
  ticket_type_id: string;
  attendee_name: string;
  attendee_email: string;
  attendee_phone: string;
  team_name?: string | null;
  notes?: string | null;
  heard_from?: string | null;
  marketing_opt_in?: boolean;
  quantity?: number;
};

// =============================================================
// Public reads
// =============================================================
export async function loadOpenEvents(): Promise<DbEvent[]> {
  const { data, error } = await supabase()
    .from("events")
    .select("*")
    .order("event_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbEvent[];
}

export async function loadEventsForPoolSchedule(): Promise<DbEvent[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase()
    .from("events")
    .select("*")
    .eq("show_on_pool_schedule", true)
    .gte("event_date", today)
    .order("event_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbEvent[];
}

// All upcoming events of a given category. Used by /world-cup
// (category='world_cup') and any future category-led schedule
// pages.
export async function loadUpcomingEventsByCategory(
  category: EventCategory,
): Promise<DbEvent[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase()
    .from("events")
    .select("*")
    .eq("category", category)
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbEvent[];
}

export async function loadEventsForCalendar(
  fromIso: string,
  toIso: string,
): Promise<DbEvent[]> {
  const { data, error } = await supabase()
    .from("events")
    .select("*")
    .eq("show_on_events_calendar", true)
    .gte("event_date", fromIso)
    .lte("event_date", toIso)
    .order("event_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbEvent[];
}

export async function loadTicketTypesForEvent(
  eventId: string,
): Promise<DbTicketType[]> {
  const { data, error } = await supabase()
    .from("ticket_types")
    .select("*")
    .eq("event_id", eventId)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbTicketType[];
}

// =============================================================
// Public write — anyone can insert an entry (the booking form).
// =============================================================
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

// =============================================================
// Admin reads / writes
// =============================================================
export async function loadAllEvents(): Promise<DbEvent[]> {
  const { data, error } = await supabase()
    .from("events")
    .select("*")
    .order("event_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbEvent[];
}

export async function loadAllTicketTypes(): Promise<DbTicketType[]> {
  const { data, error } = await supabase()
    .from("ticket_types")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbTicketType[];
}

export async function createEvent(input: NewEvent): Promise<DbEvent> {
  const { data, error } = await supabase()
    .from("events")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as DbEvent;
}

export async function updateEvent(
  id: string,
  patch: Partial<NewEvent>,
): Promise<DbEvent> {
  const { data, error } = await supabase()
    .from("events")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbEvent;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase().from("events").delete().eq("id", id);
  if (error) throw error;
}

export async function createTicketType(
  eventId: string,
  input: NewTicketType,
): Promise<DbTicketType> {
  const { data, error } = await supabase()
    .from("ticket_types")
    .insert({ ...input, event_id: eventId })
    .select()
    .single();
  if (error) throw error;
  return data as DbTicketType;
}

export async function updateTicketType(
  id: string,
  patch: Partial<NewTicketType>,
): Promise<DbTicketType> {
  const { data, error } = await supabase()
    .from("ticket_types")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbTicketType;
}

export async function deleteTicketType(id: string): Promise<void> {
  const { error } = await supabase()
    .from("ticket_types")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function loadEventEntries(
  eventId?: string,
): Promise<DbEventEntry[]> {
  let q = supabase()
    .from("event_entries")
    .select("*")
    .order("created_at", { ascending: false });
  if (eventId) q = q.eq("event_id", eventId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as DbEventEntry[];
}

export async function setEventEntryStatus(
  id: string,
  status: EventEntryStatus,
): Promise<DbEventEntry> {
  const { data, error } = await supabase()
    .from("event_entries")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbEventEntry;
}

// =============================================================
// Recurrence helper — given a start date + recurrence type + how
// many occurrences, returns the concrete dates. Used by the admin
// "Create Event" form to materialise child instances.
// =============================================================
export function generateRecurrenceDates(
  startDateIso: string, // YYYY-MM-DD
  recurrenceType: RecurrenceType,
  occurrenceCount: number,
): string[] {
  if (recurrenceType === "none" || occurrenceCount < 1) {
    return [startDateIso];
  }
  const start = new Date(`${startDateIso}T00:00:00`);
  const out: string[] = [];
  for (let i = 0; i < occurrenceCount; i++) {
    const d = new Date(start);
    if (recurrenceType === "weekly") {
      d.setDate(start.getDate() + 7 * i);
    } else if (recurrenceType === "fortnightly") {
      d.setDate(start.getDate() + 14 * i);
    } else if (recurrenceType === "monthly") {
      d.setMonth(start.getMonth() + i);
    }
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// Human-readable label for a category. Keep in sync with the
// events.category check constraint in the schema migration.
export const CATEGORY_LABEL: Record<EventCategory, string> = {
  pool_tournament_doubles: "Pool tournament — Doubles",
  pool_tournament_singles: "Pool tournament — Singles",
  pool_special: "Pool — Special event",
  dj_night: "DJ night",
  food_event: "Food event",
  drink_special: "Drink special",
  arcade: "Arcade",
  golf: "Golf",
  world_cup: "World Cup — Match",
  other: "Other",
};
