"use client";

import { supabase } from "@/lib/supabase";

// =============================================================
// tableBlocking — dates that close out free /book/table
// reservations because a competing event is on.
// =============================================================
// Sources:
//   • events table where blocks_table_bookings = true
//   • Driven by category — World Cup matches (selling £15 tables)
//     and food residencies (kitchen takes the tables) flip this
//     flag automatically; the admin can override per event.
//
// The /book/table calendar reads this on mount, greys out the
// dates in the date picker, and shows a message linking to the
// right booking flow when a customer lands on one (e.g. via
// ?date=… from a deep link).
// =============================================================

export type BlockedDate = {
  /** YYYY-MM-DD */
  iso: string;
  event_id: string;
  event_name: string;
  category: string;
  /** HH:MM[:SS] — the event's kickoff/start time. NULL when the
   *  event is "fixture TBC" and has no time set. Drives the 2-hour
   *  cutoff for available dining slots: a table booking must end
   *  at (event_start_time − 2h) or earlier. */
  event_start_time: string | null;
  /** Where the customer should book instead. */
  redirect_href: string;
  /** Label for the CTA button on the message panel. */
  redirect_label: string;
};

// Maps each blocking category to where the customer should book
// instead. world_cup matches live on /worldcup; everything else
// (food residencies, future categories) routes to /events where
// the calendar shows the poster + any external link.
function redirectFor(category: string): {
  href: string;
  label: string;
} {
  switch (category) {
    case "world_cup":
      return { href: "/worldcup", label: "Book a match table" };
    case "food_event":
      return { href: "/events", label: "See what's on" };
    default:
      return { href: "/events", label: "See what's on" };
  }
}

/** Load all blocked dates within an inclusive date range. */
export async function loadBlockedDates(
  fromIso: string,
  toIso: string,
): Promise<BlockedDate[]> {
  const { data, error } = await supabase()
    .from("events")
    .select("id, name, category, event_date, start_time")
    .eq("blocks_table_bookings", true)
    .gte("event_date", fromIso)
    .lte("event_date", toIso)
    .order("event_date", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<{
    id: string;
    name: string;
    category: string;
    event_date: string;
    start_time: string | null;
  }>).map((e) => {
    const { href, label } = redirectFor(e.category);
    return {
      iso: e.event_date,
      event_id: e.id,
      event_name: e.name,
      category: e.category,
      event_start_time: e.start_time,
      redirect_href: href,
      redirect_label: label,
    };
  });
}

/** Find the earliest-starting blocking event for a given iso date,
 *  or null. Events with no start_time sort last — when the only
 *  blocker has no time set, the date is HARD-blocked (greyed out)
 *  rather than slot-restricted, because we can't compute a 2-hour
 *  cutoff without a kickoff time. */
export function findBlockedDate(
  blocked: BlockedDate[],
  iso: string,
): BlockedDate | null {
  const onDay = blocked.filter((b) => b.iso === iso);
  if (onDay.length === 0) return null;
  onDay.sort((a, b) => {
    if (!a.event_start_time && !b.event_start_time) return 0;
    if (!a.event_start_time) return 1;
    if (!b.event_start_time) return -1;
    return a.event_start_time.localeCompare(b.event_start_time);
  });
  return onDay[0];
}

/** 2 hours, in minutes — the lead time the venue needs to clear
 *  dining tables before a blocking event starts. */
export const SLOT_CUTOFF_LEAD_MIN = 120;

/** Latest minute-of-day a dining slot may end on a date with a
 *  blocking event. Returns null when the event has no start_time
 *  (and therefore can't be slot-restricted — those days are
 *  hard-blocked at the date-picker level instead). */
export function slotCutoffMinForBlocker(b: BlockedDate | null): number | null {
  if (!b || !b.event_start_time) return null;
  const [hStr, mStr] = b.event_start_time.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || "0", 10);
  if (Number.isNaN(h)) return null;
  return h * 60 + m - SLOT_CUTOFF_LEAD_MIN;
}

/** Pretty "4:00 pm" from a HH:MM[:SS] string. Returns the input
 *  string unchanged if it can't be parsed. */
export function formatTimeLabel(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || "0", 10);
  if (Number.isNaN(h)) return hhmm;
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m === 0 ? "" : `:${String(m).padStart(2, "0")}`}${ampm}`;
}

/** Pretty "4:00 pm" from minute-of-day. */
export function formatMinuteOfDay(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return formatTimeLabel(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
}
