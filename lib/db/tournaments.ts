"use client";

import { supabase } from "@/lib/supabase";

// Tournament events + team entry sign-ups.
//
// Public-side: /book/tournament lists open tournaments via
// `loadOpenTournaments()`, then submits a team entry via
// `createTournamentEntry()`. The entry lands as `pending_payment`;
// the page then calls the Supabase Edge Function `tournament-checkout`
// which creates a Stripe Checkout session and returns the redirect
// URL. After the customer pays, Stripe webhooks the Edge Function
// `stripe-webhook`, which updates the entry to `paid`.
//
// Admin-side: /admin/tournaments creates/edits events;
// /admin/tournament-entries lists sign-ups and handles status
// transitions (cancellations, manual refunds).

export type TournamentEntryStatus =
  | "pending_payment"
  | "paid"
  | "refunded"
  | "cancelled";

export type TournamentType = "singles" | "doubles" | "special";

export type DbTournament = {
  id: string;
  name: string;
  description: string | null;
  event_date: string;        // YYYY-MM-DD
  start_time: string | null; // HH:MM[:SS]
  max_teams: number;
  /** Denormalized count of entries with status='paid'. Kept in sync
   *  by a DB trigger on tournament_entries — public clients read it
   *  to render "X / max_teams" or "SOLD OUT" without needing access
   *  to the entries table itself. */
  paid_entries_count: number;
  entry_fee_pence: number;
  /** True = shows on the public /pool schedule. */
  registration_open: boolean;
  /** True = customers can actually pay to enter. False = display
   *  only, e.g. GRAND FINAL which is invitation-only. */
  bookable: boolean;
  tournament_type: TournamentType;
  created_at: string;
  updated_at: string;
};

export type NewTournament = Omit<
  DbTournament,
  "id" | "created_at" | "updated_at"
>;

export type DbTournamentEntry = {
  id: string;
  tournament_id: string;
  team_name: string;
  captain_name: string;
  captain_email: string;
  captain_phone: string;
  player_count: number | null;
  notes: string | null;
  /** "Where did you hear about us?" — free-text source captured at
   *  sign-up so the founder can see which marketing channels work. */
  heard_from: string | null;
  /** Explicit (unchecked-by-default) newsletter opt-in. */
  marketing_opt_in: boolean;
  status: TournamentEntryStatus;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NewTournamentEntry = {
  tournament_id: string;
  team_name: string;
  captain_name: string;
  captain_email: string;
  captain_phone: string;
  player_count?: number | null;
  notes?: string | null;
  heard_from?: string | null;
  marketing_opt_in?: boolean;
};

// =========================================================
// Public reads — now sourced from the unified `events` table so
// tournaments created via the new /admin/events workbench appear on
// /pool alongside the originals. Categories pool_tournament_doubles
// / pool_tournament_singles / pool_special map back to the legacy
// `tournament_type` shape so TournamentSchedule and the booking
// flow don't need to change. Entry fee comes from the first
// (lowest sort_order) ticket type per event — multi-ticket support
// arrives with the inline booking refactor in Phase 4.
// =========================================================
export async function loadOpenTournaments(): Promise<DbTournament[]> {
  const sb = supabase();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: evs, error: evsErr }, { data: tts, error: ttsErr }] =
    await Promise.all([
      sb
        .from("events")
        .select(
          "id, name, description, event_date, start_time, category, max_attendees, bookable, registration_open, paid_entries_count, created_at, updated_at",
        )
        .in("category", [
          "pool_tournament_doubles",
          "pool_tournament_singles",
          "pool_special",
        ])
        .eq("show_on_pool_schedule", true)
        .eq("registration_open", true)
        .gte("event_date", today)
        .order("event_date", { ascending: true }),
      sb
        .from("ticket_types")
        .select("id, event_id, price_pence, sort_order, active")
        .eq("active", true)
        .order("sort_order", { ascending: true }),
    ]);
  if (evsErr) throw evsErr;
  if (ttsErr) throw ttsErr;

  // First active ticket per event by sort_order = the "headline"
  // entry price shown on the schedule row.
  const firstTicket = new Map<string, number>();
  for (const t of (tts ?? []) as Array<{
    event_id: string;
    price_pence: number;
    sort_order: number;
  }>) {
    if (!firstTicket.has(t.event_id)) firstTicket.set(t.event_id, t.price_pence);
  }

  return ((evs ?? []) as Array<{
    id: string;
    name: string;
    description: string | null;
    event_date: string;
    start_time: string | null;
    category:
      | "pool_tournament_doubles"
      | "pool_tournament_singles"
      | "pool_special";
    max_attendees: number | null;
    bookable: boolean;
    registration_open: boolean;
    paid_entries_count: number;
    created_at: string;
    updated_at: string;
  }>).map<DbTournament>((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    event_date: e.event_date,
    start_time: e.start_time,
    max_teams: e.max_attendees ?? 12,
    paid_entries_count: e.paid_entries_count,
    entry_fee_pence: firstTicket.get(e.id) ?? 0,
    registration_open: e.registration_open,
    bookable: e.bookable,
    tournament_type:
      e.category === "pool_tournament_doubles"
        ? "doubles"
        : e.category === "pool_tournament_singles"
          ? "singles"
          : "special",
    created_at: e.created_at,
    updated_at: e.updated_at,
  }));
}

// =========================================================
// Public insert — anyone (anon) can create a new entry.
// =========================================================
export async function createTournamentEntry(
  input: NewTournamentEntry,
): Promise<DbTournamentEntry> {
  const { data, error } = await supabase()
    .from("tournament_entries")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as DbTournamentEntry;
}

// =========================================================
// Admin-only reads + writes.
// =========================================================
export async function loadAllTournaments(): Promise<DbTournament[]> {
  const { data, error } = await supabase()
    .from("tournaments")
    .select("*")
    .order("event_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbTournament[];
}

export async function createTournament(
  input: NewTournament,
): Promise<DbTournament> {
  const { data, error } = await supabase()
    .from("tournaments")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as DbTournament;
}

export async function updateTournament(
  id: string,
  patch: Partial<NewTournament>,
): Promise<DbTournament> {
  const { data, error } = await supabase()
    .from("tournaments")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbTournament;
}

export async function deleteTournament(id: string): Promise<void> {
  const { error } = await supabase()
    .from("tournaments")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function loadTournamentEntries(
  tournamentId?: string,
): Promise<DbTournamentEntry[]> {
  let q = supabase()
    .from("tournament_entries")
    .select("*")
    .order("created_at", { ascending: false });
  if (tournamentId) q = q.eq("tournament_id", tournamentId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as DbTournamentEntry[];
}

export async function setTournamentEntryStatus(
  id: string,
  status: TournamentEntryStatus,
): Promise<DbTournamentEntry> {
  const { data, error } = await supabase()
    .from("tournament_entries")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbTournamentEntry;
}
