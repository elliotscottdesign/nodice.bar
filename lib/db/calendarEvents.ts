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
  subcategory: string | null;   // event type: DJ Night / Match Day / Pool Night / Food Night / Special Event
  created_at: string;
  updated_at: string;
};

// The event-type tags the founder picks when adding/editing an event.
export const EVENT_TYPES = [
  "DJ Night",
  "Match Day",
  "Pool Night",
  "Food Night",
  "Special Event",
] as const;

// Fallback poster shown on the PUBLIC calendar when an event has no artwork of
// its own — keyed by category, so a customer never sees a blank tile (e.g. a
// recurring pool night nobody added art to). The admin still shows the real
// state, so you know which events are using the default. Swap any of these for
// bespoke default art by uploading a 4:5 image and changing the URL here.
const MEDIA =
  "https://rntcujcpsozvuxvmlejv.supabase.co/storage/v1/object/public/media/";
export const CATEGORY_DEFAULT_POSTERS: Record<string, string> = {
  "DJ Night": MEDIA + "gallery/hero.events/1780755968715-red-decks-bitmap.png",
  "Match Day": MEDIA + "page/1780867523626-football-300x-colour.png",
  "Pool Night": MEDIA + "gallery/hero.pool/1780752253680-pool-bitmap.png",
  "Food Night": MEDIA + "library/1781565605067-food-night-burger.jpg",
  "Special Event": MEDIA + "library/1781564278755-happy-hour-pics.png",
};
export function defaultPosterFor(subcategory: string | null): string {
  return (subcategory && CATEGORY_DEFAULT_POSTERS[subcategory]) || "";
}

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
  subcategory: string | null;
  created_at: string;
  updated_at: string;
};

const SELECT =
  "id, event_date, start_time, name, description, poster_url, external_link, registration_open, subcategory, created_at, updated_at";

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
    subcategory: r.subcategory,
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
  if (input.subcategory !== undefined) out.subcategory = input.subcategory || null;
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

// Apply one poster to many events at once — used to keep a recurring series'
// artwork in sync (change the artwork on one, they all follow).
export async function setPosterForEvents(
  ids: string[],
  imageUrl: string,
): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase()
    .from("events")
    .update({ poster_url: imageUrl || null })
    .in("id", ids);
  if (error) throw error;
}
