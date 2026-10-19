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

export type RecurrenceType =
  | "none"
  | "weekly"
  | "fortnightly"
  | "monthly"
  | "monthly_nth_weekday";

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
  /** Free-text tag used by the public /events calendar as the
   *  filter chip (DJ Night, Match Day, Pool Night, Food Night,
   *  Deals, Special Event). Null = untagged; the event still
   *  renders on the calendar but doesn't match any chip. */
  subcategory: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  recurrence_type: RecurrenceType;
  recurrence_parent_id: string | null;
  /** For 'monthly_nth_weekday': which occurrence (1..4, or -1 = last)
   *  and which weekday (0=Sunday .. 6=Saturday). Null for other types. */
  recurrence_nth: number | null;
  recurrence_weekday: number | null;
  /** True once this child instance has been edited on its own — future
   *  edits to the series ROOT then skip it. Never cascaded. */
  recurrence_overridden: boolean;
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
  // ── Deal / special poster data (added 2026-10-19) ──────────────────────────
  // The structured fields behind a deal/special poster, so it can be
  // cross-generated for the website, the drinks-zine cover and the team-hub
  // Events flyer. Optional: older rows and non-deal events leave them null.
  /** Real ticket/entry value in £ (requires_ticket is only a yes/no). */
  ticket_price?: number | null;
  /** Free-text bottom line: "FREE ENTRY" / "£10" / "DEAL OF THE DAY". */
  poster_footer?: string | null;
  /** Sub-copy under the title, e.g. "1 round of golf / 3 tokens / 1 drink". */
  poster_subcopy?: string | null;
  /** Source artwork/photo (not the flattened poster_url) — so it's regenerable. */
  poster_image_url?: string | null;
  /** Editable QR target; blank → the event's calendar listing. */
  poster_qr_url?: string | null;
  /** Day shown on the poster's bottom line ("TUESDAYS" / "MON-THURS"). */
  poster_day_label?: string | null;
  /** Print-ready black-on-transparent A-page render for the team-hub flyer. */
  flyer_poster_url?: string | null;
  /** Show the title/time/description under the poster on the /events card. */
  show_description?: boolean | null;
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
  | "id"
  | "paid_entries_count"
  | "created_at"
  | "updated_at"
  // Defaulted by the DB to false — optional on create/update so callers
  // that don't touch the override flag stay valid.
  | "recurrence_overridden"
> & { recurrence_overridden?: boolean };

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

// All upcoming events of a given category. Used by /worldcup
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

// =============================================================
// Recurring series — master (ROOT) + per-instance override
// =============================================================
// A series is a ROOT/parent event with child instances linked via
// child.recurrence_parent_id = root.id. Editing the ROOT cascades its
// SHARED CONTENT to every child, EXCEPT any child flagged
// recurrence_overridden (edited on its own). Editing a child sets that
// flag so later root edits skip it.
//
// CASCADE_FIELDS is the ONLY set that copies root → children. Everything
// else (the per-date identity: event_date, the recurrence shape,
// recurrence_overridden, id, paid_entries_count) stays per-row.
export const CASCADE_FIELDS = [
  "name",
  "description",
  "external_link",
  "poster_url",
  "category",
  "subcategory",
  "start_time",
  "end_time",
  "show_on_pool_schedule",
  "show_on_events_calendar",
  "show_on_bar_page",
  "requires_ticket",
  "bookable",
  "max_attendees",
  "registration_open",
  "blocks_table_bookings",
  "ticket_price",
  "poster_footer",
  "poster_subcopy",
  "poster_image_url",
  "poster_qr_url",
  "poster_day_label",
  "flyer_poster_url",
] as const satisfies readonly (keyof DbEvent)[];

export type CascadeField = (typeof CASCADE_FIELDS)[number];

// Pull only the cascade fields that are actually present in a patch.
function pickCascade(patch: Partial<DbEvent>): Partial<DbEvent> {
  const out: Partial<DbEvent> = {};
  for (const f of CASCADE_FIELDS) {
    if (f in patch) {
      (out as Record<string, unknown>)[f] = (patch as Record<string, unknown>)[f];
    }
  }
  return out;
}

// Edit a series ROOT. The parent row gets the FULL patch; when cascade is
// true, the SHARED CONTENT fields present in the patch are also written to
// every child where recurrence_parent_id = parentId AND
// recurrence_overridden = false. Dates and recurrence shape never cascade.
export async function updateEventSeries(
  parentId: string,
  patch: Partial<DbEvent>,
  cascade: boolean,
): Promise<void> {
  // 1) Parent row — full patch.
  const { error: parentErr } = await supabase()
    .from("events")
    .update(patch)
    .eq("id", parentId);
  if (parentErr) throw parentErr;

  if (!cascade) return;

  // 2) Children — only the shared content fields present in the patch, and
  //    only rows that haven't been individually overridden.
  const childPatch = pickCascade(patch);
  if (Object.keys(childPatch).length === 0) return;

  const { error: childErr } = await supabase()
    .from("events")
    .update(childPatch)
    .eq("recurrence_parent_id", parentId)
    .eq("recurrence_overridden", false);
  if (childErr) throw childErr;
}

// "Reset to follow the series": copy the parent's CURRENT cascade fields
// back onto one child and clear its override flag, so it re-joins the
// series master.
export async function resetChildToSeries(
  childId: string,
  parentId: string,
): Promise<void> {
  const { data: parent, error: loadErr } = await supabase()
    .from("events")
    .select("*")
    .eq("id", parentId)
    .single();
  if (loadErr) throw loadErr;

  const patch = pickCascade(parent as DbEvent);
  patch.recurrence_overridden = false;

  const { error } = await supabase()
    .from("events")
    .update(patch)
    .eq("id", childId);
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
  // For 'monthly_nth_weekday': which occurrence (1..4, -1 = last) and
  // weekday (0=Sun..6=Sat). Ignored for other types.
  nth?: number | null,
  weekday?: number | null,
): string[] {
  if (recurrenceType === "none" || occurrenceCount < 1) {
    return [startDateIso];
  }
  const start = new Date(`${startDateIso}T00:00:00Z`);

  // "Nth weekday of the month" (first Tuesday, last Sunday, …). Walk one
  // month at a time from the start month and place the right weekday.
  if (recurrenceType === "monthly_nth_weekday") {
    const n = nth ?? 1;
    const wd = weekday ?? start.getUTCDay();
    const out: string[] = [];
    for (let i = 0; i < occurrenceCount; i++) {
      const y = start.getUTCFullYear();
      const m = start.getUTCMonth() + i; // JS normalises overflow months
      out.push(nthWeekdayOfMonth(y, m, n, wd).toISOString().slice(0, 10));
    }
    return out;
  }

  // All date maths in UTC so a "T00:00:00" local parse can't roll back a day when
  // serialized with toISOString() in British Summer Time (that shifted every
  // Monday recurrence onto the Sunday). Parse UTC, step UTC, format UTC.
  const out: string[] = [];
  for (let i = 0; i < occurrenceCount; i++) {
    const d = new Date(start);
    if (recurrenceType === "weekly") {
      d.setUTCDate(start.getUTCDate() + 7 * i);
    } else if (recurrenceType === "fortnightly") {
      d.setUTCDate(start.getUTCDate() + 14 * i);
    } else if (recurrenceType === "monthly") {
      d.setUTCMonth(start.getUTCMonth() + i);
    }
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// The concrete date of the Nth `weekday` in a given month (UTC).
// nth: 1..4, or -1 for "last". weekday: 0=Sun..6=Sat.
export function nthWeekdayOfMonth(
  year: number,
  monthIndex0: number, // may be >11; Date normalises it
  nth: number,
  weekday: number,
): Date {
  if (nth === -1) {
    // Last day of the month, walk back to the target weekday.
    const d = new Date(Date.UTC(year, monthIndex0 + 1, 0));
    const back = (d.getUTCDay() - weekday + 7) % 7;
    d.setUTCDate(d.getUTCDate() - back);
    return d;
  }
  const first = new Date(Date.UTC(year, monthIndex0, 1));
  const forward = (weekday - first.getUTCDay() + 7) % 7;
  const day = 1 + forward + (Math.max(1, nth) - 1) * 7;
  return new Date(Date.UTC(year, monthIndex0, day));
}

// Given a concrete date, which "nth weekday of the month" is it? Returns
// { nth, weekday } with nth 1..4 or -1 when it's the last such weekday.
// Used to pre-select the pattern from the date the founder picked.
export function nthWeekdayForDate(dateIso: string): {
  nth: number;
  weekday: number;
} {
  const d = new Date(`${dateIso}T00:00:00Z`);
  const weekday = d.getUTCDay();
  const nth = Math.floor((d.getUTCDate() - 1) / 7) + 1; // 1..5
  // Is it the LAST of this weekday in the month? (no same weekday 7 days on)
  const next = new Date(d);
  next.setUTCDate(d.getUTCDate() + 7);
  const isLast = next.getUTCMonth() !== d.getUTCMonth();
  return { nth: isLast ? -1 : Math.min(nth, 4), weekday };
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
