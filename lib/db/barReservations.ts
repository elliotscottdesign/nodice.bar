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
  /** Office pool add-on: the parent TABLE reservation this pool row hangs
   *  off (null for a standalone booking). See the pool-addon Edge Fn. */
  parent_reservation_id: string | null;
  /** Office pool add-on: the Stripe Payment Link the customer pays later. */
  pool_pay_url: string | null;
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
// rows (table bookings + office pool add-ons), each shaped to the same
// render row for /admin/table-reservations.
// ─────────────────────────────────────────────────────────────────

export type UnifiedReservation = DbBarReservation & {
  /** When set, this row is sourced from event_entries (a paid match
   *  ticket) and the match name shown on the card. */
  match_name?: string;
  /** Source: 'bar' = bar_reservations row, 'event' = event_entries row. */
  source: "bar" | "event";
  /** Office pool add-on hung off this TABLE row (most recent non-cancelled),
   *  attached for display so the pool time + pay link shows inside the one
   *  table booking instead of as a separate card. */
  pool_addon?: DbBarReservation | null;
};

const TODAY_MINUS_30 = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

// Load the table-surface reservations (bar_reservations), newest-date first,
// dropping anything older than 30 days so the list stays focused on what's
// coming. (Match-night event_entries were removed with World Cup, Oct 2026.)
export async function loadAllTableSurfaceReservations(): Promise<
  UnifiedReservation[]
> {
  const since = TODAY_MINUS_30();
  const sb = supabase();
  const barRes = await sb
    .from("bar_reservations")
    .select("*")
    .gte("reservation_date", since)
    .order("reservation_date", { ascending: false })
    .order("start_time", { ascending: false });
  if (barRes.error) throw barRes.error;
  const barRows = (barRes.data ?? []) as DbBarReservation[];
  // Pool add-ons (office-added pool time) are kind='pool' rows that point
  // at a parent TABLE row. Attach the most recent non-cancelled add-on to
  // its parent so the table card can show it as a pool line + pay link.
  // The add-on rows still appear on the Pool page as genuine holds (the
  // slot IS blocked); they just don't show as a second card on the Table
  // page because that page only lists kind='table' / event rows.
  const addonByParent = new Map<string, DbBarReservation>();
  for (const row of barRows) {
    if (row.kind === "pool" && row.parent_reservation_id && row.status !== "cancelled") {
      const existing = addonByParent.get(row.parent_reservation_id);
      if (!existing || row.created_at > existing.created_at) {
        addonByParent.set(row.parent_reservation_id, row);
      }
    }
  }
  const bar: UnifiedReservation[] = barRows.map((r) => ({
    ...r,
    source: "bar",
    pool_addon: addonByParent.get(r.id) ?? null,
  }));
  return bar.sort((a, b) => {
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
  await setBarReservationStatus(row.id, status);
}
