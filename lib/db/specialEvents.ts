"use client";

// =============================================================
// Unified "Special events & tournaments" tracker loader.
// =============================================================
// The real bookings still live in two places:
//   • LEGACY `tournaments` + `tournament_entries` — every pool /
//     ping-pong / special night that was created before the events
//     platform, plus anything still made in /admin/tournaments.
//   • The events platform `events` + `event_entries` — the newer
//     calendar (food nights, pool specials, World Cup match days).
//
// This module unions the two into one flat list of TrackerEvent so
// the admin tracker can browse, filter and calendar them together,
// and loads/updates entries from whichever table a given event lives
// in. It deliberately adds NO new tables — it only reads the existing
// loaders in tournaments.ts / eventsPlatform.ts.
// =============================================================

import {
  loadAllTournaments,
  loadTournamentEntries,
  setTournamentEntryStatus,
  type DbTournamentEntry,
} from "@/lib/db/tournaments";
import {
  loadAllEvents,
  loadEventEntries,
  setEventEntryStatus,
  type DbEvent,
  type DbEventEntry,
} from "@/lib/db/eventsPlatform";

export type TrackerTypeGroup = "special" | "food" | "tournament";

export type TrackerEntryStatus =
  | "pending_payment"
  | "paid"
  | "refunded"
  | "cancelled";

export type TrackerEvent = {
  id: string;
  source: "tournament" | "event";
  name: string;
  event_date: string; // YYYY-MM-DD
  start_time: string | null;
  typeGroup: TrackerTypeGroup;
  category: string;
  count: number; // paid sign-ups
};

// Normalized entry shape shared by both tables so the admin table,
// CSV export, "Copy team names" and the Entrants marketing list all
// work regardless of which table a given event's sign-ups live in.
export type TrackerEntry = {
  id: string;
  team_name: string;
  captain_name: string;
  captain_email: string;
  captain_phone: string;
  player_count: number | null;
  status: TrackerEntryStatus;
  heard_from: string | null;
  marketing_opt_in: boolean;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  // Present on doubles/teams tournament rows; always null for events.
  partner_name?: string | null;
  partner_email?: string | null;
  partner_phone?: string | null;
};

// Only these events-platform categories belong in this tracker, and
// each maps to a type group. (pool_tournament_* events are NOT pulled
// in here — their sign-ups land in tournament_entries and are already
// represented by the legacy `tournaments` rows.)
const EVENT_CATEGORY_GROUP: Record<string, TrackerTypeGroup> = {
  food_event: "food",
  pool_special: "special",
  special_event: "special",
  bingo: "special",
};

const dedupKey = (name: string, date: string) =>
  `${name.trim().toLowerCase()}|${date}`;

export async function loadTrackerEvents(): Promise<TrackerEvent[]> {
  const [tournaments, events] = await Promise.all([
    loadAllTournaments(),
    loadAllEvents(),
  ]);

  const out: TrackerEvent[] = [];
  const seen = new Set<string>();

  // Legacy tournaments first — these are the authoritative bookings.
  for (const t of tournaments) {
    out.push({
      id: t.id,
      source: "tournament",
      name: t.name,
      event_date: t.event_date,
      start_time: t.start_time,
      typeGroup: t.tournament_type === "special" ? "special" : "tournament",
      category: t.tournament_type,
      count: t.paid_entries_count ?? 0,
    });
    seen.add(dedupKey(t.name, t.event_date));
  }

  // Events platform — only the relevant categories, and skip any that
  // duplicate a legacy tournament already added (same name + date).
  for (const e of events as DbEvent[]) {
    const group = EVENT_CATEGORY_GROUP[e.category];
    if (!group) continue;
    if (seen.has(dedupKey(e.name, e.event_date))) continue;
    out.push({
      id: e.id,
      source: "event",
      name: e.name,
      event_date: e.event_date,
      start_time: e.start_time,
      typeGroup: group,
      category: e.category,
      count: e.paid_entries_count ?? 0,
    });
  }

  // Newest first.
  out.sort((a, b) => b.event_date.localeCompare(a.event_date));
  return out;
}

export async function loadTrackerEntries(
  ev: TrackerEvent,
): Promise<TrackerEntry[]> {
  if (ev.source === "tournament") {
    const rows = await loadTournamentEntries(ev.id);
    return rows.map(fromTournamentEntry);
  }
  const rows = await loadEventEntries(ev.id);
  return rows.map(fromEventEntry);
}

// A sign-up row tagged with which event (and table) it belongs to, so
// the combined tracker view can show the event name per row and route
// status changes without re-fetching per event.
export type TrackerEntryRow = TrackerEntry & {
  eventSource: "tournament" | "event";
  eventId: string;
};

// Every sign-up across both tables in one go. Used by the admin
// tracker for the combined / all-events view and the deduped Entrants
// marketing list (event_entries is tiny — 2 rows today — so loading it
// unfiltered is free).
export async function loadAllTrackerEntries(): Promise<TrackerEntryRow[]> {
  const [tRows, eRows] = await Promise.all([
    loadTournamentEntries(),
    loadEventEntries(),
  ]);
  return [
    ...tRows.map((e) => ({
      ...fromTournamentEntry(e),
      eventSource: "tournament" as const,
      eventId: e.tournament_id,
    })),
    ...eRows.map((e) => ({
      ...fromEventEntry(e),
      eventSource: "event" as const,
      eventId: e.event_id,
    })),
  ];
}

function fromTournamentEntry(e: DbTournamentEntry): TrackerEntry {
  // Partner columns exist on the table even though the type doesn't
  // list them (the public flow leaves them null; manual doubles add
  // sets them).
  const p = e as unknown as {
    partner_name?: string | null;
    partner_email?: string | null;
    partner_phone?: string | null;
  };
  return {
    id: e.id,
    team_name: e.team_name,
    captain_name: e.captain_name,
    captain_email: e.captain_email,
    captain_phone: e.captain_phone,
    player_count: e.player_count,
    status: e.status,
    heard_from: e.heard_from,
    marketing_opt_in: e.marketing_opt_in,
    paid_at: e.paid_at,
    notes: e.notes,
    created_at: e.created_at,
    partner_name: p.partner_name ?? null,
    partner_email: p.partner_email ?? null,
    partner_phone: p.partner_phone ?? null,
  };
}

function fromEventEntry(e: DbEventEntry): TrackerEntry {
  return {
    id: e.id,
    // event_entries have no team concept — fall back to the attendee's
    // name so the "team" column and Copy-team-names still read sensibly.
    team_name: e.team_name || e.attendee_name,
    captain_name: e.attendee_name,
    captain_email: e.attendee_email,
    captain_phone: e.attendee_phone,
    player_count: e.quantity ?? null,
    status: e.status,
    heard_from: e.heard_from,
    marketing_opt_in: e.marketing_opt_in,
    paid_at: e.paid_at,
    notes: e.notes,
    created_at: e.created_at,
    partner_name: null,
    partner_email: null,
    partner_phone: null,
  };
}

export async function setTrackerEntryStatus(
  ev: TrackerEvent,
  entryId: string,
  status: TrackerEntryStatus,
): Promise<void> {
  if (ev.source === "tournament") {
    await setTournamentEntryStatus(entryId, status);
  } else {
    await setEventEntryStatus(entryId, status);
  }
}
