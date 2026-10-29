"use client";

import { supabase } from "@/lib/supabase";
import { loadEventTiers, type EventTier } from "@/lib/db/tournaments";

// =============================================================
// Macmillan 12-hour Singles Comp — public read for /macmillan
// =============================================================
// A fundraiser pool marathon (Sun 15 Nov 2026, 12pm–12am) modelled on the
// BINGO event: a ticketed special that reuses the pool-tournament ticketing
// (tournament-checkout + the tournament_entries table), so no bespoke
// payment code and no edge-function change.
//
// HOW IT'S SHAPED
// ---------------
// The day runs as THREE timed skill tiers — Beginner (12–4pm), Intermediate
// (4–8pm), Advanced (8pm–12am) — 20 slots each, all £10. Each tier is its OWN
// `events` row (category 'pool_special', which tournament-checkout already
// accepts) so it carries its own 20-slot cap, start time and paid count, with:
//   • recurrence_parent_id = the public "display" event customers see on
//     /pool + /events (the pool_special marathon card), and
//   • show_on_pool_schedule = show_on_events_calendar = FALSE, so a tier never
//     shows as a card of its own — it's only reachable via this page's selector.
// loadEventTiers() (lib/db/tournaments.ts) reads those child rows.
//
// The display event's `external_link` is repointed to '/macmillan' so the
// existing /pool + /events cards click through here instead of out to the
// Macmillan fundraising site. See supabase/sql/macmillan_tiers_insert.sql.
//
// Each tier also has a MATCHING public.tournaments row (same id,
// tournament_type 'special') — REQUIRED because tournament_entries.tournament_id
// is a FK to tournaments(id); the mirror also makes bookings show in the /admin
// special-events tracker with their live paid count.
// =============================================================

export type MacmillanEvent = {
  id: string;
  name: string;
  description: string | null;
  event_date: string; // YYYY-MM-DD
  start_time: string | null;
  end_time: string | null;
  poster_url: string | null;
  external_link: string | null;
  tiers: EventTier[];
};

export async function loadMacmillanEvent(): Promise<MacmillanEvent | null> {
  const sb = supabase();
  const today = new Date().toISOString().slice(0, 10);

  // The public "display" event — the upcoming pool_special marathon whose name
  // mentions Macmillan. Matched by name (not a hard-coded id) so it survives a
  // re-create. recurrence_parent_id IS NULL excludes the tier children.
  const { data, error } = await sb
    .from("events")
    .select(
      "id, name, description, event_date, start_time, end_time, poster_url, external_link",
    )
    .eq("category", "pool_special")
    .is("recurrence_parent_id", null)
    // "%macmill%" matches both the correct spelling and the founder's own
    // "MacMillian" spelling on the live event row.
    .ilike("name", "%macmill%")
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const tiers = await loadEventTiers(data.id);
  return { ...(data as Omit<MacmillanEvent, "tiers">), tiers };
}
