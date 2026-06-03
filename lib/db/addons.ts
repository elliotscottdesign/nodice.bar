"use client";

import { supabase } from "@/lib/supabase";

export type DbAddon = {
  id: string;
  venue_id: string | null; // null = available at every venue
  name: string;
  description: string | null;
  price_pence: number;
  vat_rate_pct: number;
  active: boolean;
  sort_order: number;
};

export async function loadAddons(): Promise<DbAddon[]> {
  const { data, error } = await supabase()
    .from("addons")
    .select(
      "id, venue_id, name, description, price_pence, vat_rate_pct, active, sort_order",
    )
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as DbAddon[];
}

export async function createAddon(
  addon: Omit<DbAddon, "id">,
): Promise<DbAddon> {
  const { data, error } = await supabase()
    .from("addons")
    .insert(addon)
    .select()
    .single();
  if (error) throw error;
  return data as DbAddon;
}

export async function updateAddon(
  id: string,
  patch: Partial<Omit<DbAddon, "id">>,
): Promise<DbAddon> {
  const { data, error } = await supabase()
    .from("addons")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbAddon;
}

export async function deleteAddon(id: string): Promise<void> {
  const { error } = await supabase().from("addons").delete().eq("id", id);
  if (error) throw error;
}
