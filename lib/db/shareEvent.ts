"use client";

import { supabase } from "@/lib/supabase";
import { eventSlug } from "@/lib/eventSlug";

// =============================================================
// Share-event read — public read for /event?o=<id>
// =============================================================
// Every special event gets ONE shareable link, /event?o=<event id>, that
// opens a dedicated page built from the event's own data (poster, title,
// date/time, blurb) with a ticket-purchase block. The site is a static
// export, so the id comes from a query param (NOT a dynamic [id] route,
// which 404s for ids not known at build time — bit us on the voucher page).
//
// Ticketing reuses the already-deployed, category-agnostic `event-checkout`
// Edge Function: it charges the event's own price (ticket_types → else
// events.ticket_price in POUNDS) and auto-creates the FK mirror tournaments
// row on first booking. So a DJ night, a party, a one-off — anything with
// requires_ticket + a price — can sell tickets on-site without changing its
// category or touching the pool/bingo checkouts.
// =============================================================

export type ShareEvent = {
  id: string;
  name: string;
  description: string | null;
  event_date: string; // YYYY-MM-DD
  start_time: string | null;
  end_time: string | null;
  poster_url: string | null;
  external_link: string | null;
  category: string | null;
  subcategory: string | null;
  /** 'popup' (default) = the compact share card; 'page' = the full long-form
   *  layout. Chosen per event in the builder. Deals are always treated as
   *  'popup' regardless of the stored value. */
  page_style: "popup" | "page";
  requires_ticket: boolean;
  /** Headline ticket price in pence, resolved from ticket_types (first active)
   *  then events.ticket_price (stored in pounds). null = no price configured. */
  pricePence: number | null;
  registration_open: boolean;
  bookable: boolean;
  max_attendees: number | null;
  /** Paid tickets so far — from the mirror tournaments row (trigger-maintained,
   *  anon-readable), falling back to the events counter. Drives "sold out". */
  paidCount: number;
};

export async function loadShareEvent(id: string): Promise<ShareEvent | null> {
  const sb = supabase();

  const { data: ev, error } = await sb
    .from("events")
    .select(
      "id, name, description, event_date, start_time, end_time, poster_url, external_link, category, subcategory, page_style, requires_ticket, ticket_price, registration_open, bookable, max_attendees, paid_entries_count",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!ev) return null;

  // Price: first active ticket_type (pence) wins; else events.ticket_price,
  // which is stored in POUNDS as a numeric (e.g. "5.00") → convert to pence.
  let pricePence: number | null = null;
  const { data: tt } = await sb
    .from("ticket_types")
    .select("price_pence, active, sort_order")
    .eq("event_id", id)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (tt?.price_pence != null) {
    pricePence = Number(tt.price_pence);
  } else if (ev.ticket_price != null) {
    const pounds = Number(ev.ticket_price);
    if (!Number.isNaN(pounds)) pricePence = Math.round(pounds * 100);
  }

  // Live paid count from the mirror tournaments row (same id) when it exists;
  // the events counter is unreliable for this ticketing path (see loadEventTiers).
  let paidCount = Number(ev.paid_entries_count ?? 0);
  const { data: mirror } = await sb
    .from("tournaments")
    .select("paid_entries_count")
    .eq("id", id)
    .maybeSingle();
  if (mirror?.paid_entries_count != null) {
    paidCount = Number(mirror.paid_entries_count);
  }

  return {
    id: ev.id as string,
    name: ev.name as string,
    description: (ev.description as string | null) ?? null,
    event_date: ev.event_date as string,
    start_time: (ev.start_time as string | null) ?? null,
    end_time: (ev.end_time as string | null) ?? null,
    poster_url: (ev.poster_url as string | null) ?? null,
    external_link: (ev.external_link as string | null) ?? null,
    category: (ev.category as string | null) ?? null,
    subcategory: (ev.subcategory as string | null) ?? null,
    page_style: (ev.page_style as string) === "page" ? "page" : "popup",
    requires_ticket: Boolean(ev.requires_ticket),
    pricePence,
    registration_open: Boolean(ev.registration_open),
    bookable: Boolean(ev.bookable),
    max_attendees: (ev.max_attendees as number | null) ?? null,
    paidCount,
  };
}

// -------------------------------------------------------------
// Short links — nodice.bar/<nameofevent> (see lib/eventSlug.ts)
// -------------------------------------------------------------
// Finds the event a short link means: the NEXT one on or after today with
// that name, else the most recent past one (so an old link still lands on
// the right page). Events are a small table (a few hundred rows), so one
// windowed read is fine.
export async function findEventIdBySlug(slug: string): Promise<string | null> {
  const want = eventSlug(slug);
  if (!want) return null;
  const today = new Date();
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const from = new Date(today);
  from.setDate(from.getDate() - 120);
  const { data, error } = await supabase()
    .from("events")
    .select("id, name, event_date")
    .gte("event_date", ymd(from))
    .order("event_date", { ascending: true })
    .limit(1000);
  if (error) throw error;
  const hits = (data ?? []).filter((e) => eventSlug(e.name as string) === want);
  if (!hits.length) return null;
  const t = ymd(today);
  const next = hits.find((e) => (e.event_date as string) >= t);
  return ((next ?? hits[hits.length - 1]).id as string) ?? null;
}
