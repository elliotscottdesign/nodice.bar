"use client";

import { supabase } from "@/lib/supabase";

export type DbGalleryImage = {
  id: string;
  gallery_key: string;
  src: string;
  alt: string | null;
  caption: string | null;
  sort_order: number;
  active: boolean;
};

// Load every active image in a named gallery, ordered by sort_order.
export async function loadGallery(galleryKey: string): Promise<DbGalleryImage[]> {
  const { data, error } = await supabase()
    .from("gallery_images")
    .select("id, gallery_key, src, alt, caption, sort_order, active")
    .eq("gallery_key", galleryKey)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as DbGalleryImage[];
}

// Admin: load every image across every gallery (with the active=true filter
// dropped so the admin can see and resurrect deactivated images).
export async function loadAllGalleryImages(): Promise<DbGalleryImage[]> {
  const { data, error } = await supabase()
    .from("gallery_images")
    .select("id, gallery_key, src, alt, caption, sort_order, active")
    .order("gallery_key")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as DbGalleryImage[];
}

export async function createGalleryImage(
  row: Omit<DbGalleryImage, "id">,
): Promise<DbGalleryImage> {
  const { data, error } = await supabase()
    .from("gallery_images")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as DbGalleryImage;
}

export async function updateGalleryImage(
  id: string,
  patch: Partial<Omit<DbGalleryImage, "id">>,
): Promise<DbGalleryImage> {
  const { data, error } = await supabase()
    .from("gallery_images")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbGalleryImage;
}

export async function deleteGalleryImage(id: string): Promise<void> {
  const { error } = await supabase()
    .from("gallery_images")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
