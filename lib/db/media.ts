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

// Longest-edge cap for uploads. Posters, hero shots and phone photos rarely
// need more than this on a web page, and anything bigger only inflates the
// bucket (and our egress). The public CDN resizes further per use.
const MAX_EDGE = 2000;
const WEBP_QUALITY = 0.8;

// Downscale + re-encode an image to WebP in the browser BEFORE it ever reaches
// the bucket, so we never store a multi-megabyte original again (the root cause
// of the Nov 2026 egress blow-out). Returns the original file untouched for
// anything we can't safely rasterise (animated GIFs, SVGs, HEICs the browser
// can't decode) or when compression wouldn't actually make it smaller.
async function compressToWebp(file: File): Promise<File> {
  // SSR / non-browser guard — canvas only exists in the browser.
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") {
    return file;
  }
  // Only touch raster formats we can redraw. GIF (would lose animation) and
  // SVG (vector) are left exactly as-is.
  const type = file.type.toLowerCase();
  const compressible = ["image/jpeg", "image/png", "image/webp", "image/bmp"];
  if (!compressible.includes(type)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const longest = Math.max(width, height);
    const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
    const outW = Math.max(1, Math.round(width * scale));
    const outH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, outW, outH);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", WEBP_QUALITY),
    );
    // Encoding failed, or the WebP came out BIGGER than the original (can
    // happen for tiny or already-optimised files) — keep the original.
    if (!blob || blob.size >= file.size) return file;

    const webpName = file.name.replace(/\.[^./\\]+$/, "") + ".webp";
    return new File([blob], webpName, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch {
    // Any decode/encode failure → fall back to the original upload so the
    // admin's action never silently breaks.
    return file;
  }
}

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
  // Shrink + convert to WebP in the browser first. Falls back to the original
  // file for anything it can't compress (see compressToWebp).
  const toUpload = await compressToWebp(file);
  const stamp = Date.now();
  // Random suffix so a batch of same-named files (or two uploads in the same
  // millisecond) can never collide on the storage path — which, with
  // upsert:false, would throw and abort a bulk upload after the first file.
  const rand = Math.random().toString(36).slice(2, 8);
  const base = safeFilename(toUpload.name);
  const storagePath = `${pathPrefix}/${stamp}-${rand}-${base}`;

  const { error: uploadErr } = await client.storage
    .from(BUCKET)
    .upload(storagePath, toUpload, {
      cacheControl: "31536000",
      upsert: false,
      contentType: toUpload.type || undefined,
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
    bytes: toUpload.size,
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

// Remove a file from the bucket AND its media_library row. Both require an
// authenticated session (RLS). Note: anything still referencing the public URL
// (an event poster, a page image) will break — the caller should warn first.
export async function deleteMedia(
  id: string,
  storagePath: string,
): Promise<void> {
  const client = supabase();
  const { error: rmErr } = await client.storage.from(BUCKET).remove([storagePath]);
  if (rmErr) throw rmErr;
  const { error: delErr } = await client.from("media_library").delete().eq("id", id);
  if (delErr) throw delErr;
}
