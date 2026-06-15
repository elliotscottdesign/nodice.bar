"use client";

import { useEffect, useRef, useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import {
  listRecentMedia,
  uploadImage,
  deleteMedia,
  type DbMediaRow,
} from "@/lib/db/media";

// /admin/media — upload + manage images, video and files in the shared media
// library (Supabase "media" bucket + media_library table). Uploads/deletes need
// an authenticated session (RLS); the whole /admin area is already gated.

function describe(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function fmtBytes(n: number | null): string {
  if (!n) return "";
  const units = ["B", "KB", "MB", "GB"];
  let x = n;
  let i = 0;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i++;
  }
  return `${x.toFixed(x < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

type Kind = "image" | "video" | "audio" | "pdf" | "file";
function kindOf(name: string): Kind {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "avif", "svg", "bmp"].includes(ext))
    return "image";
  if (["mp4", "webm", "mov", "m4v", "ogv"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "m4a", "aac"].includes(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  return "file";
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function MediaLibraryClient() {
  const [rows, setRows] = useState<DbMediaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      setRows(await listRecentMedia(300));
    } catch (e) {
      setErr(describe(e, "Failed to load media"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    setErr("");
    let done = 0;
    try {
      for (const f of list) {
        setProgress(`${done + 1} / ${list.length} — ${f.name}`);
        await uploadImage(f, "library");
        done++;
      }
      await reload();
    } catch (e) {
      setErr(describe(e, "Upload failed"));
    } finally {
      setUploading(false);
      setProgress("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onCopy(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
    setCopied(id);
    setTimeout(() => setCopied(null), 1600);
  }

  async function onDelete(row: DbMediaRow) {
    if (
      !confirm(
        `Delete “${row.filename}”? This removes the file permanently — anything still using its URL (an event poster, a page image) will break.`,
      )
    )
      return;
    try {
      await deleteMedia(row.id, row.storage_path);
      await reload();
    } catch (e) {
      setErr(describe(e, "Delete failed"));
    }
  }

  return (
    <div className="space-y-8">
      {err && (
        <div className="rounded-lg border border-plonkPink/40 bg-plonkPink/10 px-4 py-3 text-sm text-plonkPink">
          {err}
        </div>
      )}

      {/* ───── Upload ───── */}
      <AdminCard title="Upload">
        <div className="p-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
              dragOver
                ? "border-plonkPink bg-plonkPink/5"
                : "border-cream/15 bg-ink/30"
            }`}
          >
            <p className="text-sm text-cream/75">
              Drag &amp; drop images, video or files here
            </p>
            <p className="text-xs text-cream/45">or</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-full bg-plonkPink px-5 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Choose files"}
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            {progress && (
              <p className="text-xs text-cream/60">Uploading {progress}</p>
            )}
            <p className="text-[11px] text-cream/40">
              Images, video (mp4/webm/mov), PDFs and other files. Large videos
              may take a moment to upload.
            </p>
          </div>
        </div>
      </AdminCard>

      {/* ───── Library ───── */}
      <AdminCard title={`Library${rows.length ? ` (${rows.length})` : ""}`}>
        {loading ? (
          <p className="px-5 py-6 text-sm text-cream/55">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-cream/55">
            Nothing uploaded yet — drop a file above to get started.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-4">
            {rows.map((m) => {
              const k = kindOf(m.filename);
              const ext = (m.filename.split(".").pop() || "file").toLowerCase();
              return (
                <div
                  key={m.id}
                  className="flex flex-col overflow-hidden rounded-xl border border-cream/10 bg-ink/40"
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-ink">
                    {k === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.public_url}
                        alt={m.alt ?? m.filename}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : k === "video" ? (
                      <video
                        src={m.public_url}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-cream/45">
                        <span className="text-3xl">
                          {k === "pdf" ? "📕" : k === "audio" ? "🎵" : "📄"}
                        </span>
                        <span className="text-[10px] uppercase tracking-widest">
                          {ext}
                        </span>
                      </div>
                    )}
                    <span className="absolute left-1 top-1 rounded-full bg-ink/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cream/85">
                      {k}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-2.5">
                    <p
                      className="truncate text-xs font-semibold text-cream"
                      title={m.filename}
                    >
                      {m.filename}
                    </p>
                    <p className="text-[10px] text-cream/50">
                      {fmtBytes(m.bytes)}
                      {m.bytes ? " · " : ""}
                      {fmtDate(m.uploaded_at)}
                    </p>
                    <div className="mt-auto flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => onCopy(m.public_url, m.id)}
                        className="flex-1 rounded-full border border-cream/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
                      >
                        {copied === m.id ? "Copied ✓" : "Copy URL"}
                      </button>
                      <a
                        href={m.public_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-cream/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
                      >
                        Open
                      </a>
                      <button
                        type="button"
                        onClick={() => onDelete(m)}
                        className="rounded-full border border-cream/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-cream/55 transition hover:bg-plonkPink/10 hover:text-plonkPink"
                      >
                        Del
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AdminCard>
    </div>
  );
}
