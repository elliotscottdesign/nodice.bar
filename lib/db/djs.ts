"use client";

import { supabase } from "@/lib/supabase";

// =============================================================
// DJ profiles — internal entity that gives recurring DJs a single
// profile + image the founder maintains in /admin/djs.
// =============================================================
// Why this exists:
//   - Resident / returning DJs don't have to re-upload artwork
//     for every gig — their profile image becomes the default.
//   - Event admin can still upload a per-event poster that
//     overrides the profile image (the "headline" image for that
//     specific night).
//
// Display fallback chain (see resolveEventImage below):
//   1. event.poster_url
//   2. dj.profile_image_url
//   3. null → caller renders a placeholder
//
// At launch DJ profiles are INTERNAL only (no public /djs page).
// =============================================================

export type DbDj = {
  id: string;
  name: string;
  bio: string | null;
  profile_image_url: string | null;
  /** Instagram handle WITHOUT the @ — reserved for future public
   *  page; not displayed at launch. */
  instagram_handle: string | null;
  created_at: string;
  updated_at: string;
};

export type NewDj = {
  name: string;
  bio?: string | null;
  profile_image_url?: string | null;
  instagram_handle?: string | null;
};

export async function loadAllDjs(): Promise<DbDj[]> {
  const { data, error } = await supabase()
    .from("djs")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbDj[];
}

export async function loadDjById(id: string): Promise<DbDj | null> {
  const { data, error } = await supabase()
    .from("djs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as DbDj | null;
}

export async function createDj(input: NewDj): Promise<DbDj> {
  const { data, error } = await supabase()
    .from("djs")
    .insert({
      name: input.name.trim(),
      bio: input.bio?.trim() || null,
      profile_image_url: input.profile_image_url || null,
      instagram_handle: input.instagram_handle?.trim().replace(/^@/, "") || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbDj;
}

export async function updateDj(
  id: string,
  patch: Partial<NewDj>,
): Promise<DbDj> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.bio !== undefined)
    update.bio = patch.bio?.trim() || null;
  if (patch.profile_image_url !== undefined)
    update.profile_image_url = patch.profile_image_url || null;
  if (patch.instagram_handle !== undefined)
    update.instagram_handle =
      patch.instagram_handle?.trim().replace(/^@/, "") || null;
  const { data, error } = await supabase()
    .from("djs")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbDj;
}

export async function deleteDj(id: string): Promise<void> {
  // Linked events get dj_id set to NULL by the FK ON DELETE SET NULL
  // — they don't disappear; the admin re-assigns or removes them.
  const { error } = await supabase().from("djs").delete().eq("id", id);
  if (error) throw error;
}

// =============================================================
// Fallback chain helper — used by every surface that renders an
// event image (public /events calendar, admin event list, the
// edit modal, future block displays).
// =============================================================
/**
 * Resolve the best image URL for an event.
 *   1. event.poster_url (event-specific override)
 *   2. dj.profile_image_url (the DJ's standing image)
 *   3. null → caller renders a placeholder
 *
 * `dj` should be the DJ profile linked via event.dj_id, or null
 * when no DJ is attached. Passing undefined and null are
 * equivalent — both fall through to no DJ image.
 */
export function resolveEventImage(
  event: { poster_url?: string | null },
  dj?: { profile_image_url?: string | null } | null,
): string | null {
  if (event.poster_url) return event.poster_url;
  if (dj?.profile_image_url) return dj.profile_image_url;
  return null;
}
