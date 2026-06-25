"use client";

import { supabase } from "@/lib/supabase";

// Public-side helper for the /book/pool and /book/table reservation
// forms. Inserts a pending reservation; the admin confirms or
// cancels via the admin panel. Stripe is not wired up yet — every
// reservation lands as 'pending' regardless of amount.

export type BarReservationKind = "pool" | "table";

export type DbBarReservation = {
  id: string;
  kind: BarReservationKind;
  reservation_date: string;   // YYYY-MM-DD
  start_time: string;          // HH:MM[:SS]
  duration_minutes: number;
  party_size: number;
  resource_count: number;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  /** "Where did you hear about us?" — free text captured at booking. */
  heard_from: string | null;
  /** GDPR newsletter opt-in. Unchecked by default. */
  marketing_opt_in: boolean;
  /** Total charged in pence (£6 per 30 min for pool, null for legacy). */
  amount_pence: number | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  status: "pending" | "paid" | "confirmed" | "cancelled" | "refunded";
  created_at: string;
  updated_at: string;
};

export type NewBarReservation = Omit<
  DbBarReservation,
  | "id"
  | "status"
  | "created_at"
  | "updated_at"
  | "heard_from"
  | "marketing_opt_in"
  | "amount_pence"
  | "stripe_payment_intent_id"
  | "paid_at"
> & {
  heard_from?: string | null;
  marketing_opt_in?: boolean;
};

export async function createBarReservation(
  input: NewBarReservation,
): Promise<DbBarReservation> {
  const { data, error } = await supabase()
    .from("bar_reservations")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as DbBarReservation;
}

// Admin-side: load every reservation, newest first.
export async function loadBarReservations(): Promise<DbBarReservation[]> {
  const { data, error } = await supabase()
    .from("bar_reservations")
    .select("*")
    .order("reservation_date", { ascending: false })
    .order("start_time", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbBarReservation[];
}

export async function setBarReservationStatus(
  id: string,
  status: DbBarReservation["status"],
): Promise<DbBarReservation> {
  const { data, error } = await supabase()
    .from("bar_reservations")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbBarReservation;
}

// ─── Unified admin loader ─────────────────────────────────────────
// A single list of "things sat at a table tonight" — the bar_reservations
// rows PLUS the paid match-night event_entries (World Cup matches),
// each shaped to fit the same render row. Founder rule (2026-06-22):
// admin needs to see both side-by-side on /admin/table-reservations
// because the World Cup rules block normal table bookings from
// clashing — staff must see what's actually held.
// ─────────────────────────────────────────────────────────────────

export type UnifiedReservation = DbBarReservation & {
  /** When set, this row is sourced from event_entries (a paid match
   *  ticket) and the match name shown on the card. */
  match_name?: string;
  /** Source: 'bar' = bar_reservations row, 'event' = event_entries row. */
  source: "bar" | "event";
};

const TODAY_MINUS_30 = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

// Map an event_entries row + its parent event into the unified shape.
// We invent minutes/party-size/resource fields with sensible defaults
// — these aren't tracked on event_entries and the founder doesn't
// want a party-size tracker anyway.
function eventEntryToUnified(row: {
  id: string;
  attendee_name: string;
  attendee_email: string;
  attendee_phone: string;
  notes: string | null;
  heard_from: string | null;
  marketing_opt_in: boolean;
  status: string;
  amount_paid_pence: number | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  event: {
    name: string;
    event_date: string;
    start_time: string | null;
    category: string;
  };
}): UnifiedReservation {
  // Map event_entries status -> bar_reservations status vocabulary.
  const statusMap: Record<string, DbBarReservation["status"]> = {
    pending_payment: "pending",
    paid: "paid",
    refunded: "refunded",
    cancelled: "cancelled",
  };
  return {
    id: row.id,
    kind: "table",
    reservation_date: row.event.event_date,
    start_time: row.event.start_time ?? "20:00:00",
    duration_minutes: 150,           // ~2h30m match window
    party_size: 2,                    // founder rule: "good for 2"
    resource_count: 1,
    name: row.attendee_name,
    email: row.attendee_email,
    phone: row.attendee_phone || null,
    notes: row.notes,
    heard_from: row.heard_from,
    marketing_opt_in: row.marketing_opt_in,
    amount_pence: row.amount_paid_pence,
    stripe_payment_intent_id: row.stripe_payment_intent_id,
    paid_at: row.paid_at,
    status: statusMap[row.status] ?? "pending",
    created_at: row.created_at,
    updated_at: row.updated_at,
    match_name: row.event.name,
    source: "event",
  };
}

// Load both sources, merged + sorted newest-date first. Limits
// event_entries to category=world_cup (other event types — pool
// tournaments etc. — have their own admin pages). Also drops anything
// older than 30 days so the list stays focused on what's coming.
export async function loadAllTableSurfaceReservations(): Promise<
  UnifiedReservation[]
> {
  const since = TODAY_MINUS_30();
  const sb = supabase();
  const [barRes, eventRes] = await Promise.all([
    sb
      .from("bar_reservations")
      .select("*")
      .gte("reservation_date", since)
      .order("reservation_date", { ascending: false })
      .order("start_time", { ascending: false }),
    sb
      .from("event_entries")
      .select(
        "id,attendee_name,attendee_email,attendee_phone,notes,heard_from,marketing_opt_in,status,amount_paid_pence,stripe_payment_intent_id,paid_at,created_at,updated_at,event:events!inner(name,event_date,start_time,category)",
      )
      .eq("event.category", "world_cup")
      .gte("event.event_date", since)
      .order("created_at", { ascending: false }),
  ]);
  if (barRes.error) throw barRes.error;
  if (eventRes.error) throw eventRes.error;
  const bar: UnifiedReservation[] = (barRes.data ?? []).map((r) => ({
    ...(r as DbBarReservation),
    source: "bar",
  }));
  const events: UnifiedReservation[] = (eventRes.data ?? []).map((r) =>
    eventEntryToUnified(
      r as unknown as Parameters<typeof eventEntryToUnified>[0],
    ),
  );
  return [...bar, ...events].sort((a, b) => {
    if (a.reservation_date !== b.reservation_date) {
      return a.reservation_date < b.reservation_date ? 1 : -1;
    }
    return (a.start_time ?? "") < (b.start_time ?? "") ? 1 : -1;
  });
}

// Update status on either source. Routes by `source` so the matching
// table gets the patch.
export async function setUnifiedReservationStatus(
  row: Pick<UnifiedReservation, "id" | "source">,
  status: DbBarReservation["status"],
): Promise<void> {
  if (row.source === "event") {
    // event_entries uses a different status vocabulary; map back.
    const eventStatus = (
      {
        pending: "pending_payment",
        paid: "paid",
        confirmed: "paid",
        refunded: "refunded",
        cancelled: "cancelled",
      } as Record<DbBarReservation["status"], string>
    )[status];
    const { error } = await supabase()
      .from("event_entries")
      .update({ status: eventStatus })
      .eq("id", row.id);
    if (error) throw error;
    return;
  }
  await setBarReservationStatus(row.id, status);
}
