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
// A bingo night is an `events`-platform row with:
//   • category               = 'pool_tournament_singles'
//       — the only existing category that makes tournament-checkout work
//         UNCHANGED *and* makes InlineTournamentBooking render the right
//         form (singles shape = one person: name + email + phone +
//         marketing opt-in, no "team name"). Bingo is one ticket per
//         person, so that's exactly right.
//   • show_on_pool_schedule  = FALSE
//       — keeps it OFF the /pool tournament schedule (loadOpenTournaments
//         only reads rows where this is TRUE). This FALSE flag is also
//         how we tell a bingo night apart from a real pool-singles night.
//   • show_on_events_calendar = TRUE, subcategory = 'Special Event'
//       — so it ALSO appears under Special Events on the /events calendar.
//   • one active ticket_type at £10 (price_pence 1000).
//
// (A dedicated 'bingo' category would be tidier, but it would force a
// change to the shared tournament-checkout Edge Function — deliberately
// avoided here while the paid pool/ping-pong flow is live. See the hand-
// off note for the post-launch tidy-up.)
// =============================================================

const BINGO_CATEGORY = "pool_tournament_singles";

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
        // Bingo nights are hidden from the pool schedule — that FALSE flag
        // is what separates them from genuine pool-singles tournaments.
        .eq("show_on_pool_schedule", false)
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
