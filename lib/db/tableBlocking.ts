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
  /** Where the customer should book instead. */
  redirect_href: string;
  /** Label for the CTA button on the message panel. */
  redirect_label: string;
};

// Maps each blocking category to where the customer should book
// instead. world_cup matches live on /world-cup; everything else
// (food residencies, future categories) routes to /events where
// the calendar shows the poster + any external link.
function redirectFor(category: string): {
  href: string;
  label: string;
} {
  switch (category) {
    case "world_cup":
      return { href: "/world-cup", label: "Book a match table" };
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
    .select("id, name, category, event_date")
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
  }>).map((e) => {
    const { href, label } = redirectFor(e.category);
    return {
      iso: e.event_date,
      event_id: e.id,
      event_name: e.name,
      category: e.category,
      redirect_href: href,
      redirect_label: label,
    };
  });
}

/** Find the BlockedDate for a specific iso date, or null. Useful
 *  when the customer hits /book/table?date=… with a date that has
 *  since become blocked — we surface the message panel without
 *  needing to scan a full range. */
export function findBlockedDate(
  blocked: BlockedDate[],
  iso: string,
): BlockedDate | null {
  return blocked.find((b) => b.iso === iso) ?? null;
}
