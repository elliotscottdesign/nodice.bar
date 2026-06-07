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
  /** 0–100 — horizontal focal point. Drives CSS object-position-x. */
  position_x: number;
  /** 0–100 — vertical focal point. Drives CSS object-position-y. */
  position_y: number;
  /** 1.00–4.00 — scale() transform applied around the focal point. */
  position_zoom: number;
  /** "cover" (crops overflow) or "contain" (whole image visible,
   *  letterboxed if aspect doesn't match). */
  position_fit: "cover" | "contain";
};

// Single source of truth for the column list — keeps SELECTs in sync
// as new fields land.
const GALLERY_SELECT =
  "id, gallery_key, src, alt, caption, sort_order, active, position_x, position_y, position_zoom, position_fit";

// Load every active image in a named gallery, ordered by sort_order.
export async function loadGallery(galleryKey: string): Promise<DbGalleryImage[]> {
  const { data, error } = await supabase()
    .from("gallery_images")
    .select(GALLERY_SELECT)
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
    .select(GALLERY_SELECT)
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
