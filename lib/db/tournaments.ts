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
  entry_fee_pence: number;
  registration_open: boolean;
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
};

// =========================================================
// Public reads — only registration_open=true rows are visible
// to anon thanks to the RLS policy on `tournaments`.
// =========================================================
export async function loadOpenTournaments(): Promise<DbTournament[]> {
  const { data, error } = await supabase()
    .from("tournaments")
    .select("*")
    .order("event_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbTournament[];
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
