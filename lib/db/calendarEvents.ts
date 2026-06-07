"use client";

import { supabase } from "@/lib/supabase";

// =============================================================
// calendarEvents — shim onto the new events platform
// =============================================================
// What used to be a thin wrapper around the `calendar_events`
// table is now a shim onto the unified `events` table that powers
// /admin/events. The shape (`DbCalendarEvent`) is preserved so the
// /events public page and CalendarEventModal don't need rewriting —
// the field names just get translated as data crosses this boundary:
//
//   title       ↔ events.name
//   body        ↔ events.description
//   image_url   ↔ events.poster_url  (nullable → "")
//   link_url    ↔ events.external_link
//   active      ↔ events.registration_open
//
// Writes set sensible defaults for the fields the calendar UI
// doesn't surface yet (category='dj_night', visible on calendar,
// not on pool/bar, no ticket required). The founder can change any
// of those from /admin/events.
// =============================================================

export type DbCalendarEvent = {
  id: string;
  event_date: string;
  start_time: string | null;
  title: string;
  body: string | null;
  image_url: string;
  link_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type NewCalendarEvent = Omit<
  DbCalendarEvent,
  "id" | "created_at" | "updated_at"
>;

// Internal row type for SELECTs against `events`.
type EventsRow = {
  id: string;
  event_date: string;
  start_time: string | null;
  name: string;
  description: string | null;
  poster_url: string | null;
  external_link: string | null;
  registration_open: boolean;
  created_at: string;
  updated_at: string;
};

const SELECT =
  "id, event_date, start_time, name, description, poster_url, external_link, registration_open, created_at, updated_at";

function toCalendar(r: EventsRow): DbCalendarEvent {
  return {
    id: r.id,
    event_date: r.event_date,
    start_time: r.start_time,
    title: r.name,
    body: r.description,
    image_url: r.poster_url ?? "",
    link_url: r.external_link,
    active: r.registration_open,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function fromCalendar(input: Partial<NewCalendarEvent>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.event_date !== undefined) out.event_date = input.event_date;
  if (input.start_time !== undefined) out.start_time = input.start_time;
  if (input.title !== undefined) out.name = input.title;
  if (input.body !== undefined) out.description = input.body;
  if (input.image_url !== undefined) out.poster_url = input.image_url || null;
  if (input.link_url !== undefined) out.external_link = input.link_url;
  if (input.active !== undefined) out.registration_open = input.active;
  return out;
}

// Reads — the public events calendar shows everything that's
// flagged show_on_events_calendar=true. The new admin can opt an
// event out of the calendar, but rows authored through this shim
// always get show_on_events_calendar=true on insert so the founder
// gets the "make it appear" behaviour they expect.
export async function loadCalendarEventsInRange(
  fromIso: string,
  toIso: string,
): Promise<DbCalendarEvent[]> {
  const { data, error } = await supabase()
    .from("events")
    .select(SELECT)
    .eq("show_on_events_calendar", true)
    .gte("event_date", fromIso)
    .lte("event_date", toIso)
    .order("event_date", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as EventsRow[]).map(toCalendar);
}

export async function loadAllCalendarEvents(): Promise<DbCalendarEvent[]> {
  const { data, error } = await supabase()
    .from("events")
    .select(SELECT)
    .eq("show_on_events_calendar", true)
    .order("event_date", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as EventsRow[]).map(toCalendar);
}

export async function createCalendarEvent(
  row: NewCalendarEvent,
): Promise<DbCalendarEvent> {
  const payload = {
    ...fromCalendar(row),
    // Sensible defaults for fields the inline calendar modal doesn't
    // currently expose. The founder can refine via /admin/events.
    category: "dj_night",
    recurrence_type: "none",
    show_on_pool_schedule: false,
    show_on_events_calendar: true,
    show_on_bar_page: false,
    requires_ticket: false,
    bookable: true,
  };
  const { data, error } = await supabase()
    .from("events")
    .insert(payload)
    .select(SELECT)
    .single();
  if (error) throw error;
  return toCalendar(data as EventsRow);
}

export async function updateCalendarEvent(
  id: string,
  patch: Partial<NewCalendarEvent>,
): Promise<DbCalendarEvent> {
  const { data, error } = await supabase()
    .from("events")
    .update(fromCalendar(patch))
    .eq("id", id)
    .select(SELECT)
    .single();
  if (error) throw error;
  return toCalendar(data as EventsRow);
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const { error } = await supabase().from("events").delete().eq("id", id);
  if (error) throw error;
}
