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

export type TournamentType = "singles" | "doubles" | "special" | "teams";

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
  /** SPECIAL EVENTS (founder rule, 18 Oct 2026): a special event is
   *  presented by its POSTER and its button goes to the organiser's own
   *  page — these nights are run or ticketed elsewhere (Macmillan's
   *  fundraising page, Ball Breakers on clyx, Pocket Society on Ticket
   *  Tailor), so the inline booking form would be wrong. */
  poster_url: string | null;
  external_link: string | null;
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
          "id, name, description, event_date, start_time, category, max_attendees, bookable, registration_open, paid_entries_count, poster_url, external_link, created_at, updated_at",
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
    poster_url: string | null;
    external_link: string | null;
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
    poster_url: e.poster_url,
    external_link: e.external_link,
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
// Ping pong Sunday team nights live in the legacy `tournaments` table
// (tournament_type='teams') rather than the events platform — the public
// /pingpong page reads them here. RLS exposes registration_open rows only.
// =========================================================
export async function loadPingPongNights(): Promise<DbTournament[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase()
    .from("tournaments")
    .select("*")
    .eq("tournament_type", "teams")
    .gte("event_date", today)
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

// Manual admin sign-up (phone / DM / walk-in paying at the venue, or a
// comp/guest team) — the tournament equivalent of the pool/table
// "+ Add booking manually" form. Unlike the public flow this never
// touches Stripe: it lands straight as `paid` (so it counts as a real
// team and shows up in Copy-team-names), with paid_at set and the
// settlement method recorded. Partner columns exist on the table even
// though the public flow leaves them null.
export type ManualTournamentEntry = {
  tournament_id: string;
  team_name: string;
  captain_name: string;
  captain_email: string;
  captain_phone: string;
  partner_name?: string | null;
  partner_email?: string | null;
  partner_phone?: string | null;
  player_count?: number | null;
  notes?: string | null;
};

export async function createManualTournamentEntry(
  input: ManualTournamentEntry,
): Promise<DbTournamentEntry> {
  const { data, error } = await supabase()
    .from("tournament_entries")
    .insert({
      ...input,
      status: "paid" as TournamentEntryStatus,
      paid_at: new Date().toISOString(),
      heard_from: "Manual admin entry",
    })
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

// ── Skill tiers on a single event ────────────────────────────────────────────
// A big event can be split into several bookable slots that share one public
// card: the Macmillan 12-hour marathon runs Amateur / Intermediate / Pro, four
// hours each, 16 players apiece. Each tier is its own events row (so it has its
// own cap, start time and paid count, and the checkout validates it unchanged)
// whose `recurrence_parent_id` points at the event customers actually see, and
// whose `show_on_pool_schedule` is false so it never appears as a card of its
// own. In the engine each tier is a separate competition with the same id.
export type EventTier = {
  id: string;
  name: string;
  start_time: string | null;
  end_time: string | null;
  max_attendees: number | null;
  paid_entries_count: number;
  registration_open: boolean;
  spotsLeft: number | null;
  full: boolean;
};

export async function loadEventTiers(parentId: string): Promise<EventTier[]> {
  // `recurrence_parent_id` is ALSO how a weekly series links its occurrences
  // back to the first one, so a plain children-of-parent query would return
  // every future CUE / Happy Mondays / Ball Breakers date as a bogus "session"
  // (15 identical "CUE · 19:00–22:30" tiles was the 28 Oct booking outage).
  // A genuine skill-tier runs on the SAME DAY as its public card (Macmillan:
  // Beginner / Intermediate / Advanced on one date); a weekly recurrence never
  // does. So pin the lookup to the parent's own event_date.
  const { data: parent } = await supabase()
    .from("events")
    .select("event_date")
    .eq("id", parentId)
    .maybeSingle();
  const parentDate = parent?.event_date as string | undefined;
  if (!parentDate) return [];
  const { data, error } = await supabase()
    .from("events")
    .select(
      "id, name, start_time, end_time, max_attendees, paid_entries_count, registration_open",
    )
    .eq("recurrence_parent_id", parentId)
    .eq("event_date", parentDate)
    .order("start_time", { ascending: true });
  // A tier lookup must never block a booking — fall back to "no tiers".
  if (error) return [];
  return (data ?? []).map((e) => {
    const cap = e.max_attendees ?? null;
    const left = cap == null ? null : Math.max(0, cap - (e.paid_entries_count ?? 0));
    return {
      id: e.id as string,
      name: e.name as string,
      start_time: e.start_time as string | null,
      end_time: e.end_time as string | null,
      max_attendees: cap,
      paid_entries_count: (e.paid_entries_count ?? 0) as number,
      registration_open: Boolean(e.registration_open),
      spotsLeft: left,
      full: left === 0 || !e.registration_open,
    };
  });
}
