"use client";

import { supabase } from "@/lib/supabase";

export type TicketKind = "adult" | "child" | "bundle" | "other";
export type TicketCategory = "golf" | "pool";

export type DbTicket = {
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

export type DbVenue = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  active: boolean;
};

export async function loadVenues(): Promise<DbVenue[]> {
  const { data, error } = await supabase()
    .from("venues")
    .select("id, slug, name, sort_order, active")
    .eq("active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as DbVenue[];
}

export async function loadTickets(): Promise<DbTicket[]> {
  const { data, error } = await supabase()
    .from("tickets")
    .select(
      "id, venue_id, name, description, kind, category, price_pence, vat_rate_pct, active, sort_order, available_days_of_week",
    )
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as DbTicket[];
}

export async function updateTicket(
  id: string,
  patch: Partial<Omit<DbTicket, "id" | "venue_id">>,
): Promise<DbTicket> {
  const { data, error } = await supabase()
    .from("tickets")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbTicket;
}

export async function deleteTicket(id: string): Promise<void> {
  const { error } = await supabase().from("tickets").delete().eq("id", id);
  if (error) throw error;
}

export async function createTicket(
  ticket: Omit<DbTicket, "id">,
): Promise<DbTicket> {
  const { data, error } = await supabase()
    .from("tickets")
    .insert(ticket)
    .select()
    .single();
  if (error) throw error;
  return data as DbTicket;
}
