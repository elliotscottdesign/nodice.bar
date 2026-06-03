"use client";

// =============================================================
// Plonk Golf admin — media library picker
// =============================================================
// Full-screen modal showing every image known to the project:
//   - Built-in images from public/ (read from media-manifest.json,
//     generated at build time)
//   - User uploads from Supabase storage (media_library table)
// Plus an Upload zone at the top: drag-and-drop or click to add a
// new file, which uploads to Supabase storage and is immediately
// selected as the new image.
// =============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { listRecentMedia, uploadImage, type DbMediaRow } from "@/lib/db/media";
import ImagePositioner from "@/components/admin/ImagePositioner";
import type { ImageDisplay } from "@/lib/content";

type MediaItem = {
  path: string;
  filename: string;
  folder: string;
  source: "repo" | "upload";
};

type Manifest = {
  generated_at: string;
  count: number;
  images: Array<{ path: string; filename: string; folder: string }>;
};

export default function MediaPicker({
  onPick,
  onClose,
  aspect,
  initial,
}: {
  // Backwards-compatible callback. New callers should also pass
  // `aspect` so the positioner step can show the right slot shape.
  onPick: (value: string | ImageDisplay) => void;
  onClose: () => void;
  // Aspect ratio of the destination slot, e.g. "4/5". When provided,
  // the picker shows a positioner screen after a thumbnail is
  // chosen so the admin can fine-tune crop and zoom.
  aspect?: string;
  // Starting transform when re-opening the picker on an existing
  // image — lets the admin tweak rather than restart.
  initial?: Partial<ImageDisplay>;
}) {
  // When the admin clicks a thumbnail (or finishes an upload) we
  // first land them on the positioner. Skip it entirely when the
  // caller didn't pass an aspect (legacy mode).
  const [staged, setStaged] = useState<string | null>(null);
  const [repoImages, setRepoImages] = useState<MediaItem[]>([]);
  const [uploads, setUploads] = useState<MediaItem[]>([]);
  const [err, setErr] = useState("");
  const [query, setQuery] = useState("");
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Load both sources on mount.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/media-manifest.json?t=${Date.now()}`);
        if (!res.ok) throw new Error(`Manifest fetch failed: ${res.status}`);
        const json = (await res.json()) as Manifest;
        if (cancelled) return;
        setRepoImages(
          json.images.map((i) => ({
            path: i.path,
            filename: i.filename,
            folder: i.folder,
            source: "repo" as const,
          })),
        );
      } catch (e) {
        if (!cancelled)
          setErr(
            e instanceof Error
              ? `Couldn't load the built-in image list: ${e.message}`
              : "Couldn't load the built-in image list.",
          );
      }
    })();

    (async () => {
      try {
        const rows = await listRecentMedia(200);
        if (cancelled) return;
        setUploads(
          rows.map((r: DbMediaRow) => ({
            path: r.public_url,
            filename: r.filename,
            folder: "Uploads",
            source: "upload" as const,
          })),
        );
      } catch {
        /* uploads list is optional — repo images alone are still useful */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const all = useMemo<MediaItem[]>(() => [...uploads, ...repoImages], [uploads, repoImages]);
  const folders = useMemo(() => {
    const set = new Set<string>();
    for (const img of all) set.add(img.folder);
    return Array.from(set).sort();
  }, [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((img) => {
      if (activeFolder !== "all" && img.folder !== activeFolder) return false;
      if (!q) return true;
      return (
        img.filename.toLowerCase().includes(q) ||
        img.folder.toLowerCase().includes(q)
      );
    });
  }, [all, query, activeFolder]);

  async function handleUpload(file: File) {
    setUploading(true);
    setErr("");
    try {
      const { public_url, filename } = await uploadImage(file);
      // Prepend so the new one shows up first in the grid.
      setUploads((prev) => [
        { path: public_url, filename, folder: "Uploads", source: "upload" },
        ...prev,
      ]);
      // Take the admin to the positioner (or save directly if no
      // aspect was supplied).
      handlePick(public_url);
    } catch (e) {
      setErr(
        e instanceof Error ? `Upload failed: ${e.message}` : "Upload failed.",
      );
    } finally {
      setUploading(false);
    }
  }

  // Default to a square slot if the caller didn't tell us a specific
  // aspect — better to always give the admin a crop/zoom step than
  // silently save without one.
  const effectiveAspect = aspect ?? "1/1";

  function handlePick(path: string) {
    setStaged(path);
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleUpload(f);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleUpload(f);
  }

  // Escape key closes the whole picker, in case the Close button
  // gets covered by something or a click handler misfires.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (staged) setStaged(null);
        else onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [staged, onClose]);

  function handleCloseClick() {
    setStaged(null);
    onClose();
  }

  // Portal to document.body so the modal always anchors to the
  // viewport, not whichever Reveal/transform/filter ancestor we
  // happen to be nested inside. Without this, parent transforms
  // create a new containing block and the modal gets trapped
  // inside the image's box.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-stretch justify-center bg-ink/90 p-2 sm:p-6"
      // The click-outside-closes target — only on the backdrop, not
      // bubbled through the panel itself.
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCloseClick();
      }}
    >
      <div
        className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-cream/15 bg-ink shadow-2xl"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragOver(false);
        }}
        onDrop={onDrop}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-cream/10 px-5 py-4">
          <div className="min-w-0">
            <h3 className="font-display text-2xl">
              {staged ? "Position image" : "Media library"}
            </h3>
            <p className="truncate text-xs text-cream/55">
              {staged
                ? "Drag to reposition · zoom to enlarge · save when happy."
                : `${repoImages.length + uploads.length} images${
                    uploads.length > 0 ? ` (${uploads.length} uploaded)` : ""
                  }`}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCloseClick}
            className="rounded-full border border-cream/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            Close
          </button>
        </div>

        {/* Positioner — takes over the body when an image is staged. */}
        {staged && (
          <div className="flex-1 overflow-y-auto">
            <ImagePositioner
              src={staged}
              aspect={effectiveAspect}
              initial={initial}
              onCancel={() => setStaged(null)}
              onSave={(d) => {
                onPick(d);
                setStaged(null);
              }}
            />
          </div>
        )}

        {staged ? null : (
        <>
          {/* Picker toolbar + grid only show when nothing is staged */}

        {/* Toolbar: upload + search + filter */}
        <div className="flex flex-col gap-3 border-b border-cream/10 px-5 py-4 sm:flex-row sm:items-center">
          <label
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-full bg-plonkPink px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90 ${
              uploading ? "pointer-events-none opacity-60" : ""
            }`}
            title="Upload a new image — appears here and gets selected automatically."
          >
            {uploading ? "Uploading…" : "+ Upload image"}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChosen}
            />
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by filename or folder…"
            className="flex-1 rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream placeholder:text-cream/40 focus:border-plonkPink focus:outline-none"
          />
          <select
            value={activeFolder}
            onChange={(e) => setActiveFolder(e.target.value)}
            className="rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
          >
            <option value="all">All folders</option>
            {folders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {/* Drop hint when dragging a file over */}
        {dragOver && (
          <div className="pointer-events-none absolute inset-4 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-plonkPink bg-plonkPink/10 text-base font-bold uppercase tracking-wider text-plonkPink">
            Drop image to upload
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {err && (
            <div className="mb-4 rounded-lg border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
              {err}
            </div>
          )}
          {all.length === 0 && !err && (
            <p className="text-sm text-cream/60">Loading media library…</p>
          )}
          {filtered.length === 0 && all.length > 0 && !err && (
            <p className="text-sm text-cream/60">No images match your search.</p>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filtered.map((img) => (
              <button
                key={img.path}
                type="button"
                onClick={() => handlePick(img.path)}
                className="group relative flex flex-col overflow-hidden rounded-lg border border-cream/10 bg-ink/40 text-left transition hover:border-plonkPink hover:shadow-lg"
                title={img.path}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.path}
                  alt=""
                  loading="lazy"
                  className="aspect-square w-full object-cover transition group-hover:opacity-90"
                />
                <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                  <p className="min-w-0 truncate text-[11px] text-cream/85">
                    {img.filename}
                  </p>
                  {img.source === "upload" && (
                    <span className="shrink-0 rounded-full bg-plonkTeal/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-plonkTeal">
                      New
                    </span>
                  )}
                </div>
                <p className="truncate px-2 pb-1.5 text-[10px] text-cream/45">
                  {img.folder}
                </p>
              </button>
            ))}
          </div>
        </div>
        </>
        )}
      </div>
    </div>,
    document.body,
  );
}
