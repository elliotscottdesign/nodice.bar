"use client";

import { supabase } from "@/lib/supabase";

export type DbMenuSection = {
  id: string;
  title: string;
  intro: string | null;
  sort_order: number;
  active: boolean;
};

export type DbMenuItem = {
  id: string;
  section_id: string;
  title: string;
  body: string | null;
  price: string | null;
  sort_order: number;
  active: boolean;
};

export async function loadMenu(): Promise<{
  sections: DbMenuSection[];
  items: DbMenuItem[];
}> {
  const [sections, items] = await Promise.all([
    supabase()
      .from("menu_sections")
      .select("id, title, intro, sort_order, active")
      .order("sort_order"),
    supabase()
      .from("menu_items")
      .select("id, section_id, title, body, price, sort_order, active")
      .order("sort_order"),
  ]);
  if (sections.error) throw sections.error;
  if (items.error) throw items.error;
  return {
    sections: (sections.data ?? []) as DbMenuSection[],
    items: (items.data ?? []) as DbMenuItem[],
  };
}

export async function createMenuSection(
  row: Omit<DbMenuSection, "id">,
): Promise<DbMenuSection> {
  const { data, error } = await supabase()
    .from("menu_sections")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as DbMenuSection;
}

export async function updateMenuSection(
  id: string,
  patch: Partial<Omit<DbMenuSection, "id">>,
): Promise<DbMenuSection> {
  const { data, error } = await supabase()
    .from("menu_sections")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbMenuSection;
}

export async function deleteMenuSection(id: string): Promise<void> {
  const { error } = await supabase()
    .from("menu_sections")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function createMenuItem(
  row: Omit<DbMenuItem, "id">,
): Promise<DbMenuItem> {
  const { data, error } = await supabase()
    .from("menu_items")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as DbMenuItem;
}

export async function updateMenuItem(
  id: string,
  patch: Partial<Omit<DbMenuItem, "id">>,
): Promise<DbMenuItem> {
  const { data, error } = await supabase()
    .from("menu_items")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbMenuItem;
}

export async function deleteMenuItem(id: string): Promise<void> {
  const { error } = await supabase().from("menu_items").delete().eq("id", id);
  if (error) throw error;
}
