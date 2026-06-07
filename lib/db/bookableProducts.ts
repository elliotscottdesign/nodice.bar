"use client";

import { supabase } from "@/lib/supabase";

// =============================================================
// Bookable products — DB module
// =============================================================
// Reads & writes for the four `bookable_*` tables:
//   bookable_products
//   bookable_hours
//   bookable_date_overrides
//   bookable_price_windows
//
// `loadBookableProductConfig(id)` is the one-shot read used by
// /book/<id> on every render — pulls the master row + all child
// rows in parallel and returns a single shape the customer form
// and the Edge Function can both consume.
// =============================================================

export type DbBookableProduct = {
  id: string;
  name: string;
  enabled: boolean;
  closed_message: string | null;
  slot_duration_minutes: number;
  min_duration_minutes: number;
  max_duration_minutes: number;
  duration_step_minutes: number;
  min_party_size: number;
  max_party_size: number;
  default_resource_count: number;
  customer_eyebrow: string | null;
  customer_title: string | null;
  customer_intro: string | null;
  updated_at: string;
};

export type DbBookableHour = {
  id: string;
  product_id: string;
  day_of_week: number; // 0=Sun … 6=Sat
  open_time: string; // 'HH:MM:SS'
  close_time: string;
  updated_at: string;
};

export type DbBookableDateOverride = {
  id: string;
  product_id: string;
  date: string; // 'YYYY-MM-DD'
  closed: boolean;
  open_time: string | null;
  close_time: string | null;
  note: string | null;
  updated_at: string;
};

export type DbBookablePriceWindow = {
  id: string;
  product_id: string;
  name: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  price_per_30min_pence: number;
  is_default: boolean;
  priority: number;
  updated_at: string;
};

export type BookableProductConfig = {
  product: DbBookableProduct;
  hours: DbBookableHour[];
  overrides: DbBookableDateOverride[];
  priceWindows: DbBookablePriceWindow[];
};

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// ---------------------------------------------------------------
// Reads
// ---------------------------------------------------------------
export async function loadBookableProducts(): Promise<DbBookableProduct[]> {
  const { data, error } = await supabase()
    .from("bookable_products")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []) as DbBookableProduct[];
}

export async function loadBookableProduct(
  id: string,
): Promise<DbBookableProduct | null> {
  const { data, error } = await supabase()
    .from("bookable_products")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as DbBookableProduct | null) ?? null;
}

export async function loadBookableProductConfig(
  id: string,
): Promise<BookableProductConfig | null> {
  const sb = supabase();
  const [pRes, hRes, oRes, wRes] = await Promise.all([
    sb.from("bookable_products").select("*").eq("id", id).maybeSingle(),
    sb.from("bookable_hours").select("*").eq("product_id", id),
    sb.from("bookable_date_overrides").select("*").eq("product_id", id).order("date"),
    sb
      .from("bookable_price_windows")
      .select("*")
      .eq("product_id", id)
      .order("priority", { ascending: false }),
  ]);
  if (pRes.error) throw pRes.error;
  if (hRes.error) throw hRes.error;
  if (oRes.error) throw oRes.error;
  if (wRes.error) throw wRes.error;
  if (!pRes.data) return null;
  return {
    product: pRes.data as DbBookableProduct,
    hours: (hRes.data ?? []) as DbBookableHour[],
    overrides: (oRes.data ?? []) as DbBookableDateOverride[],
    priceWindows: (wRes.data ?? []) as DbBookablePriceWindow[],
  };
}

// ---------------------------------------------------------------
// Writes — product
// ---------------------------------------------------------------
export async function updateBookableProduct(
  id: string,
  patch: Partial<Omit<DbBookableProduct, "id" | "updated_at">>,
): Promise<DbBookableProduct> {
  const { data, error } = await supabase()
    .from("bookable_products")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbBookableProduct;
}

// ---------------------------------------------------------------
// Writes — hours
// ---------------------------------------------------------------
export async function createBookableHour(
  row: Omit<DbBookableHour, "id" | "updated_at">,
): Promise<DbBookableHour> {
  const { data, error } = await supabase()
    .from("bookable_hours")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as DbBookableHour;
}
export async function updateBookableHour(
  id: string,
  patch: Partial<Omit<DbBookableHour, "id" | "product_id" | "updated_at">>,
): Promise<DbBookableHour> {
  const { data, error } = await supabase()
    .from("bookable_hours")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbBookableHour;
}
export async function deleteBookableHour(id: string): Promise<void> {
  const { error } = await supabase().from("bookable_hours").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------
// Writes — date overrides
// ---------------------------------------------------------------
export async function upsertBookableDateOverride(
  row: Omit<DbBookableDateOverride, "id" | "updated_at"> & { id?: string },
): Promise<DbBookableDateOverride> {
  const payload = { ...row };
  const { data, error } = await supabase()
    .from("bookable_date_overrides")
    .upsert(payload, { onConflict: "product_id,date" })
    .select()
    .single();
  if (error) throw error;
  return data as DbBookableDateOverride;
}
export async function deleteBookableDateOverride(id: string): Promise<void> {
  const { error } = await supabase()
    .from("bookable_date_overrides")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------
// Writes — price windows
// ---------------------------------------------------------------
export async function createBookablePriceWindow(
  row: Omit<DbBookablePriceWindow, "id" | "updated_at">,
): Promise<DbBookablePriceWindow> {
  const { data, error } = await supabase()
    .from("bookable_price_windows")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as DbBookablePriceWindow;
}
export async function updateBookablePriceWindow(
  id: string,
  patch: Partial<
    Omit<DbBookablePriceWindow, "id" | "product_id" | "updated_at">
  >,
): Promise<DbBookablePriceWindow> {
  const { data, error } = await supabase()
    .from("bookable_price_windows")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbBookablePriceWindow;
}
export async function deleteBookablePriceWindow(id: string): Promise<void> {
  const { error } = await supabase()
    .from("bookable_price_windows")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------
// Computation helpers — used by both the customer form (live
// preview, slot availability, total) and the Edge Function (final
// server-side price). Pure functions, no DB calls.
// ---------------------------------------------------------------

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function dayOfWeek(iso: string): number {
  return new Date(`${iso}T00:00:00`).getDay();
}

/** Effective open windows for a given date (taking date overrides
 *  into account). Returns [] if the day is fully closed. */
export function effectiveOpenWindows(
  cfg: BookableProductConfig,
  iso: string,
): Array<{ open: number; close: number }> {
  const override = cfg.overrides.find((o) => o.date === iso);
  if (override) {
    if (override.closed) return [];
    if (override.open_time && override.close_time) {
      return [
        { open: timeToMin(override.open_time), close: timeToMin(override.close_time) },
      ];
    }
  }
  const dow = dayOfWeek(iso);
  return cfg.hours
    .filter((h) => h.day_of_week === dow)
    .map((h) => ({ open: timeToMin(h.open_time), close: timeToMin(h.close_time) }));
}

export function isDateBookable(
  cfg: BookableProductConfig,
  iso: string,
): boolean {
  return effectiveOpenWindows(cfg, iso).length > 0;
}

/** All slot start-times for a given date+duration that fit
 *  entirely within one of the day's open windows. */
export function availableSlotsForDate(
  cfg: BookableProductConfig,
  iso: string,
  durationMinutes: number,
): string[] {
  const windows = effectiveOpenWindows(cfg, iso);
  if (windows.length === 0) return [];
  const step = cfg.product.slot_duration_minutes;
  const out: string[] = [];
  for (const w of windows) {
    for (let m = w.open; m + durationMinutes <= w.close; m += step) {
      out.push(minToTime(m));
    }
  }
  return out;
}

/** Price (pence) per 30-min block starting at `slotStartMin` on
 *  the given date. Picks the highest-priority matching window.
 *  Falls back to the default window, else 0. */
function pricePer30ForSlot(
  cfg: BookableProductConfig,
  iso: string,
  slotStartMin: number,
): number {
  const dow = dayOfWeek(iso);
  // Already ordered priority DESC by loadBookableProductConfig.
  for (const w of cfg.priceWindows) {
    if (!w.days_of_week.includes(dow)) continue;
    const ws = timeToMin(w.start_time);
    const we = timeToMin(w.end_time);
    if (slotStartMin < ws || slotStartMin >= we) continue;
    return w.price_per_30min_pence;
  }
  const def = cfg.priceWindows.find((w) => w.is_default);
  return def ? def.price_per_30min_pence : 0;
}

/** Total price (pence) for a booking starting at `time` on `iso`
 *  for `durationMinutes`. Sums the per-30-min price across each
 *  block — so a 60-min booking that straddles two price windows
 *  is priced honestly. */
export function priceForBooking(
  cfg: BookableProductConfig,
  iso: string,
  time: string,
  durationMinutes: number,
): number {
  const startMin = timeToMin(time);
  const blocks = Math.ceil(durationMinutes / 30);
  let total = 0;
  for (let i = 0; i < blocks; i++) {
    total += pricePer30ForSlot(cfg, iso, startMin + i * 30);
  }
  return total;
}

/** True if the recurring weekly rules say `iso` is closed AND no
 *  override re-opens it. Used by the calendar picker to grey out
 *  fully-closed days of the week (e.g. Saturdays for pool). */
export function recurringClosedDaysOfWeek(cfg: BookableProductConfig): number[] {
  const open = new Set(cfg.hours.map((h) => h.day_of_week));
  const out: number[] = [];
  for (let i = 0; i < 7; i++) if (!open.has(i)) out.push(i);
  return out;
}
