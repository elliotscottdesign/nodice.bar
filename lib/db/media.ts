"use client";

import { supabase } from "@/lib/supabase";

const BUCKET = "media";

export type DbMediaRow = {
  id: string;
  filename: string;
  storage_path: string;
  public_url: string;
  alt: string | null;
  bytes: number | null;
  uploaded_at: string;
};

function safeFilename(name: string): string {
  // Strip anything that could break a URL path; keep extension intact.
  const cleaned = name
    .toLowerCase()
    .replace(/\.[^./\\]+$/, "") // drop extension temporarily
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const ext = name.match(/\.[a-zA-Z0-9]+$/)?.[0]?.toLowerCase() ?? "";
  return `${cleaned || "image"}${ext}`;
}

// Uploads a file to the Supabase Storage "media" bucket, records it in
// the media_library table, and returns the public URL the admin form
// should then save into the page_content row's `value`.
export async function uploadImage(
  file: File,
  pathPrefix = "page",
): Promise<{ public_url: string; storage_path: string; filename: string }> {
  const client = supabase();
  const stamp = Date.now();
  const base = safeFilename(file.name);
  const storagePath = `${pathPrefix}/${stamp}-${base}`;

  const { error: uploadErr } = await client.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type || undefined,
    });
  if (uploadErr) throw uploadErr;

  const { data: pub } = client.storage.from(BUCKET).getPublicUrl(storagePath);
  const publicUrl = pub.publicUrl;

  // Register in media_library so we can list past uploads later. Failure to
  // record is non-fatal for the upload itself — the file is already in the
  // bucket and has a URL — but we surface the error so it doesn't go silent.
  const { error: insertErr } = await client.from("media_library").insert({
    filename: file.name,
    storage_path: storagePath,
    public_url: publicUrl,
    bytes: file.size,
  });
  if (insertErr) {
    console.warn("Media uploaded but library insert failed:", insertErr.message);
  }

  return { public_url: publicUrl, storage_path: storagePath, filename: file.name };
}

export async function listRecentMedia(limit = 50): Promise<DbMediaRow[]> {
  const { data, error } = await supabase()
    .from("media_library")
    .select("id, filename, storage_path, public_url, alt, bytes, uploaded_at")
    .order("uploaded_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as DbMediaRow[];
}
