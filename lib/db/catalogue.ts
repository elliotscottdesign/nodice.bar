"use client";

import { supabase } from "@/lib/supabase";
import type { TicketCategory, TicketKind } from "@/lib/db/tickets";

// Loads the customer-facing catalogue (one venue + its tickets + its addons)
// from Supabase and returns it in the same shape the existing UI expects.
//
// We keep the DB rows out of the UI by converting venue UUIDs → slug strings
// here. That way BookingFlow / CheckoutClient don't have to know anything
// has moved; they keep treating venue.id as "hackney"/"borough".

// Public-facing types — camelCase, slug-keyed. These are the shape the
// booking UI components consume; the DB row types live in their per-table
// db modules.
export type Venue = { id: "hackney" | "borough"; name: string };

export type Ticket = {
  id: string;
  venueId: Venue["id"];
  name: string;
  description?: string;
  pricePence: number;
  vatRatePct: number;
  active: boolean;
  sortOrder: number;
  kind: TicketKind;
  category: TicketCategory;
  availableDaysOfWeek?: number[];
};

export type Addon = {
  id: string;
  venueId: Venue["id"] | "all";
  name: string;
  description?: string;
  pricePence: number;
  active: boolean;
};

export type Catalogue = {
  venue: Venue;
  tickets: Ticket[];
  addons: Addon[];
};

type VenueRow = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  active: boolean;
};

type TicketRow = {
  id: string;
  venue_id: string;
  name: string;
  description: string | null;
  kind: TicketKind;
  category: TicketCategory;
  price_pence: number;
  vat_rate_pct: number;
  active: boolean;
  sort_order: number;
  available_days_of_week: number[] | null;
};

type AddonRow = {
  id: string;
  venue_id: string | null;
  name: string;
  description: string | null;
  price_pence: number;
  vat_rate_pct: number;
  active: boolean;
  sort_order: number;
};

function isKnownVenueSlug(s: string): s is Venue["id"] {
  return s === "hackney" || s === "borough";
}

export async function loadCatalogue(venueSlug: string): Promise<Catalogue | null> {
  const client = supabase();

  const { data: venueRow, error: venueErr } = await client
    .from("venues")
    .select("id, slug, name, sort_order, active")
    .eq("slug", venueSlug)
    .eq("active", true)
    .maybeSingle<VenueRow>();
  if (venueErr) throw venueErr;
  if (!venueRow || !isKnownVenueSlug(venueRow.slug)) return null;

  const [{ data: ticketRows, error: ticketErr }, { data: addonRows, error: addonErr }] =
    await Promise.all([
      client
        .from("tickets")
        .select(
          "id, venue_id, name, description, kind, category, price_pence, vat_rate_pct, active, sort_order, available_days_of_week",
        )
        .eq("venue_id", venueRow.id)
        .eq("active", true)
        .order("sort_order")
        .returns<TicketRow[]>(),
      client
        .from("addons")
        .select(
          "id, venue_id, name, description, price_pence, vat_rate_pct, active, sort_order",
        )
        .eq("active", true)
        .order("sort_order")
        .returns<AddonRow[]>(),
    ]);

  if (ticketErr) throw ticketErr;
  if (addonErr) throw addonErr;

  const slug = venueRow.slug;

  const tickets: Ticket[] = (ticketRows ?? []).map((t) => ({
    id: t.id,
    venueId: slug,
    name: t.name,
    description: t.description ?? undefined,
    pricePence: t.price_pence,
    vatRatePct: t.vat_rate_pct,
    active: t.active,
    sortOrder: t.sort_order,
    kind: t.kind,
    category: t.category,
    availableDaysOfWeek: t.available_days_of_week ?? undefined,
  }));

  // Addons available at this venue = global (venue_id null) OR matching this venue.
  const addons: Addon[] = (addonRows ?? [])
    .filter((a) => a.venue_id === null || a.venue_id === venueRow.id)
    .map((a) => ({
      id: a.id,
      venueId: a.venue_id === null ? "all" : slug,
      name: a.name,
      description: a.description ?? undefined,
      pricePence: a.price_pence,
      active: a.active,
    }));

  const venue: Venue = { id: slug, name: venueRow.name };

  return { venue, tickets, addons };
}
