"use client";

import { supabase } from "@/lib/supabase";
import type { DbTournament } from "@/lib/db/tournaments";

// =============================================================
// Bingo nights — public read for the /bingo page
// =============================================================
// Bingo is a COMEDY + BINGO night: a £10 ticket (entry + a drink, with
// the bingo free to play and bar-sponsored prizes). We reuse the exact
// same ticket flow as the pool/ping-pong tournaments — InlineTournament-
// Booking + the `tournament-checkout` Edge Function — so bingo needs NO
// new booking component and NO edge-function change.
//
// WHERE A BINGO EVENT LIVES
// -------------------------
// A bingo night is an `events`-platform row with its OWN category **'bingo'**
// (19 Oct 2026 — decoupled from the pool-tournament hack). Booking goes through
// the dedicated `bingo-checkout` Edge Function + <BingoBooking> component (NOT
// the shared pool/tournament checkout). It also carries:
//   • show_on_events_calendar = TRUE, subcategory = 'Special Event'
//       — so it appears under Special Events on the /events calendar.
//   • one active ticket_type at £10 (price_pence 1000).
//   • a mirror public.tournaments row (same id) satisfying the
//     tournament_entries.tournament_id FK (bingo-checkout writes entries there
//     so they show in the admin tracker + the existing stripe-webhook flips
//     them to paid). See supabase/sql/bingo_event_insert.sql.
// =============================================================

const BINGO_CATEGORY = "bingo";

export async function loadBingoNights(): Promise<DbTournament[]> {
  const sb = supabase();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: evs, error: evsErr }, { data: tts, error: ttsErr }] =
    await Promise.all([
      sb
        .from("events")
        .select(
          "id, name, description, event_date, start_time, category, max_attendees, bookable, registration_open, paid_entries_count, show_on_pool_schedule, created_at, updated_at",
        )
        .eq("category", BINGO_CATEGORY)
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

  // First active ticket per event by sort_order = the headline price.
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
    max_teams: e.max_attendees ?? 60,
    paid_entries_count: e.paid_entries_count,
    poster_url: null,          // bingo books inline, not via a poster link
    external_link: null,
    entry_fee_pence: firstTicket.get(e.id) ?? 0,
    registration_open: e.registration_open,
    bookable: e.bookable,
    // 'singles' drives InlineTournamentBooking to ask for one person's
    // name + email + phone only (no team name) — exactly a bingo ticket.
    tournament_type: "singles",
    created_at: e.created_at,
    updated_at: e.updated_at,
  }));
}
