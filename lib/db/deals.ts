"use client";

import { supabase } from "@/lib/supabase";

export type DbSiteDeal = {
  id: string;
  day: string;
  title: string;
  venue: string | null;
  body: string;
  sort_order: number;
  active: boolean;
};

export async function loadDeals(): Promise<DbSiteDeal[]> {
  const { data, error } = await supabase()
    .from("site_deals")
    .select("id, day, title, venue, body, sort_order, active")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as DbSiteDeal[];
}

export async function createDeal(row: Omit<DbSiteDeal, "id">): Promise<DbSiteDeal> {
  const { data, error } = await supabase()
    .from("site_deals")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as DbSiteDeal;
}

export async function updateDeal(
  id: string,
  patch: Partial<Omit<DbSiteDeal, "id">>,
): Promise<DbSiteDeal> {
  const { data, error } = await supabase()
    .from("site_deals")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbSiteDeal;
}

export async function deleteDeal(id: string): Promise<void> {
  const { error } = await supabase().from("site_deals").delete().eq("id", id);
  if (error) throw error;
}
