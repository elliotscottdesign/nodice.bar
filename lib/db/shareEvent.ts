"use client";

import { supabase } from "@/lib/supabase";

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
      "id, name, description, event_date, start_time, end_time, poster_url, external_link, category, subcategory, requires_ticket, ticket_price, registration_open, bookable, max_attendees, paid_entries_count",
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
    requires_ticket: Boolean(ev.requires_ticket),
    pricePence,
    registration_open: Boolean(ev.registration_open),
    bookable: Boolean(ev.bookable),
    max_attendees: (ev.max_attendees as number | null) ?? null,
    paidCount,
  };
}
