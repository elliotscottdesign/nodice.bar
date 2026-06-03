"use client";

import { supabase } from "@/lib/supabase";

export type DbFaq = {
  id: string;
  section: string;
  question: string;
  answer: string;
  section_order: number;
  faq_order: number;
  active: boolean;
};

export async function loadFaqs(): Promise<DbFaq[]> {
  const { data, error } = await supabase()
    .from("faqs")
    .select("id, section, question, answer, section_order, faq_order, active")
    .order("section_order")
    .order("faq_order");
  if (error) throw error;
  return (data ?? []) as DbFaq[];
}

export async function createFaq(row: Omit<DbFaq, "id">): Promise<DbFaq> {
  const { data, error } = await supabase()
    .from("faqs")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as DbFaq;
}

export async function updateFaq(
  id: string,
  patch: Partial<Omit<DbFaq, "id">>,
): Promise<DbFaq> {
  const { data, error } = await supabase()
    .from("faqs")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbFaq;
}

export async function deleteFaq(id: string): Promise<void> {
  const { error } = await supabase().from("faqs").delete().eq("id", id);
  if (error) throw error;
}

// Group FAQ rows into sections in the order they appear, preserving each
// section's internal order. Used by both the public page and the admin
// editor so they show entries the same way.
export function groupFaqs(
  rows: DbFaq[],
): { section: string; section_order: number; items: DbFaq[] }[] {
  const map = new Map<string, { section_order: number; items: DbFaq[] }>();
  for (const r of rows) {
    const entry = map.get(r.section);
    if (entry) entry.items.push(r);
    else map.set(r.section, { section_order: r.section_order, items: [r] });
  }
  return [...map.entries()]
    .map(([section, v]) => ({
      section,
      section_order: v.section_order,
      items: v.items.sort((a, b) => a.faq_order - b.faq_order),
    }))
    .sort((a, b) => a.section_order - b.section_order);
}
