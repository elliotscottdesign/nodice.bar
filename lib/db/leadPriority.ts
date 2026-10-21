"use client";

import { supabase } from "@/lib/supabase";
import { isDjEvent } from "@/lib/db/djNights";
import type { DbCalendarEvent } from "@/lib/db/calendarEvents";

// =============================================================
// Lead-poster priority — which event headlines a busy day
// =============================================================
// When a single day has several events, the /events calendar shows
// ONE of them as the day's lead poster (the headline image + the
// click target). This module decides the ORDER the different KINDS
// of event take — the office can reorder it from
// /admin/event-priority, and the public page reads the saved order.
//
// We group events into a fixed, code-defined set of BUCKETS using
// the SAME precedence the old hard-coded leadRank() used (a special
// is a special before we ever look at whether it recurs, etc.). Only
// the ORDER the buckets sit in is editable — stored one row per
// bucket in `event_lead_priority` (migration 20261020000010).
//
// Happy Hour is deliberately NOT an editable bucket: it is forced
// dead last, always, below every other event AND every other deal
// (founder, raised repeatedly — "Happy Hour image always loads last
// after all other DJ / events / deals"). It can never be dragged up.
// =============================================================

export type LeadBucket =
  | "special"
  | "dj"
  | "oneoff"
  | "recurring"
  | "deal";

// The editable buckets, with the copy the admin page shows. Order
// here is the DEFAULT order (= the old hard-coded behaviour), used
// as the fallback whenever nothing is saved or the table can't be
// reached, so the public calendar is unchanged until it's edited.
export const LEAD_BUCKETS: {
  key: LeadBucket;
  label: string;
  description: string;
}[] = [
  {
    key: "special",
    label: "Special events",
    description:
      "One-off specials: special events, pool specials, food parties, World Cup match days.",
  },
  {
    key: "dj",
    label: "DJ nights",
    description: "Live DJ sets — from the DJ feed or an event tagged DJ night.",
  },
  {
    key: "oneoff",
    label: "One-off nights",
    description:
      "Standalone pool / ping-pong comps and other one-off nights that don't repeat.",
  },
  {
    key: "recurring",
    label: "Weekly regulars",
    description:
      "Anything set to repeat (weekly / fortnightly / monthly) that isn't a special, DJ or deal.",
  },
  {
    key: "deal",
    label: "Deals",
    description:
      "Standing drink promos (martini + fries, etc.). Happy Hour always sits below everything.",
  },
];

// The default order as a plain array of keys (= seed order in the
// migration). Fallback for the public page.
export const DEFAULT_LEAD_ORDER: LeadBucket[] = LEAD_BUCKETS.map((b) => b.key);

// Rank handed to Happy Hour — larger than any bucket index, so it is
// always last whatever the editable order is.
const HAPPY_HOUR_RANK = 9999;

// Put an event in a bucket, or flag it as Happy Hour. Precedence is
// FIXED (and matches the old leadRank ladder): happy hour → special →
// dj → deal → recurring → one-off. Keeping this order means a
// recurring DJ night is still a "dj", not a "recurring regular".
export function classifyLeadBucket(
  e: DbCalendarEvent,
): LeadBucket | "happy_hour" {
  const cat = e.category ?? "";

  // Happy Hour never headlines — matched by name (it's category
  // drink_special like the other deals).
  if (/happy\s*hour/i.test(e.title || "")) return "happy_hour";

  // One-off / limited-edition specials.
  if (
    cat === "special_event" ||
    cat === "pool_special" ||
    cat === "food_event" ||
    cat === "world_cup"
  )
    return "special";

  // DJ night (cross-origin feed, or a category='dj_night' row).
  if (isDjEvent(e) || cat === "dj_night") return "dj";

  // Deals / standing promos.
  if (cat === "drink_special") return "deal";

  // Anything that explicitly recurs (weekly / monthly regulars).
  if (!!e.recurrence_type && e.recurrence_type !== "none") return "recurring";

  // Standard one-off night / tournament.
  return "oneoff";
}

// The sortable rank for an event, given the saved bucket order.
// Lower = leads first. Happy Hour is always last. An unknown bucket
// (shouldn't happen) sinks below the known ones but above Happy Hour.
export function leadRankFromOrder(
  e: DbCalendarEvent,
  order: LeadBucket[],
): number {
  const bucket = classifyLeadBucket(e);
  if (bucket === "happy_hour") return HAPPY_HOUR_RANK;
  const idx = order.indexOf(bucket);
  return idx === -1 ? order.length : idx;
}

type DbRow = { bucket: string; sort_order: number };

// Read the saved order. Never throws — on any error, or an empty
// table, returns the default order so the public page is unaffected.
// Unknown buckets in the DB are ignored; buckets missing from the DB
// are appended in their default order so a newly-added bucket still
// has a home.
export async function loadLeadOrder(): Promise<LeadBucket[]> {
  try {
    const { data, error } = await supabase()
      .from("event_lead_priority")
      .select("bucket, sort_order")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as DbRow[];
    const known = new Set<string>(DEFAULT_LEAD_ORDER);
    const saved = rows
      .map((r) => r.bucket)
      .filter((b): b is LeadBucket => known.has(b));
    if (saved.length === 0) return [...DEFAULT_LEAD_ORDER];
    // Append any bucket that exists in code but not (yet) in the DB.
    for (const b of DEFAULT_LEAD_ORDER) {
      if (!saved.includes(b)) saved.push(b);
    }
    return saved;
  } catch {
    return [...DEFAULT_LEAD_ORDER];
  }
}

// Save a new order (array of bucket keys, top = leads first). Writes
// sort_order = array index for every bucket. Throws on error so the
// admin page can surface it.
export async function saveLeadOrder(order: LeadBucket[]): Promise<void> {
  const rows = order.map((bucket, i) => ({
    bucket,
    sort_order: i,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase()
    .from("event_lead_priority")
    .upsert(rows, { onConflict: "bucket" });
  if (error) throw error;
}
