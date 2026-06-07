"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { uploadImage } from "@/lib/db/media";
import {
  loadAllGalleryImages,
  createGalleryImage,
  updateGalleryImage,
  deleteGalleryImage,
  type DbGalleryImage,
} from "@/lib/db/galleries";
import { getImageSpec } from "@/lib/imageSpecs";
import { SpecCaption } from "@/components/admin/ContentEditor";
import ImagePositioner from "@/components/admin/ImagePositioner";
import { createPortal } from "react-dom";
import type { ImageDisplay } from "@/lib/content";

// Every gallery the public site reads from. New galleries can be added
// here (and consumed by the page that needs them); the admin will then
// list them automatically.
// Each entry maps to the public-site URL where this gallery actually
// renders. `previewPath` powers the "View page ↗" pill in the
// admin header so the founder can jump straight from editing the
// gallery to seeing the live result in a new tab.
const KNOWN_GALLERIES: {
  key: string;
  label: string;
  description: string;
  previewPath: string;
}[] = [
  // ----- Hero sliders (one per page) -----
  // Upload 2+ images to any of these and that page's hero turns into
  // an auto-cycling slider. With 0 images, page falls back to its
  // hardcoded fallback image / slider array.
  {
    key: "hero.home",
    label: "HERO slider — Home",
    description: "Top-of-page slider on nodice.bar/.",
    previewPath: "/",
  },
  {
    key: "hero.venue.hackney",
    label: "HERO slider — Hackney",
    description: "Top-of-page slider on /venue/hackney.",
    previewPath: "/venue/hackney",
  },
  {
    key: "hero.about",
    label: "HERO slider — About",
    description: "Top-of-page slider on /about.",
    previewPath: "/about",
  },
  {
    key: "hero.contact",
    label: "HERO slider — Contact",
    description: "Top-of-page slider on /contact.",
    previewPath: "/contact",
  },
  {
    key: "hero.events",
    label: "HERO slider — Events",
    description: "Top-of-page slider on /events.",
    previewPath: "/events",
  },
  {
    key: "hero.deals",
    label: "HERO slider — Deals",
    description: "Top-of-page slider on /deals.",
    previewPath: "/deals",
  },
  {
    key: "hero.bar",
    label: "HERO slider — Bar",
    description: "Top-of-page slider on /bar. Portrait shots work best.",
    previewPath: "/bar",
  },
  {
    key: "hero.pool",
    label: "HERO slider — Pool",
    description: "Top-of-page slider on /pool. Portrait shots of the tables.",
    previewPath: "/pool",
  },
  {
    key: "hero.vouchers",
    label: "HERO slider — Vouchers",
    description: "Top-of-page slider on /vouchers.",
    previewPath: "/vouchers",
  },
  {
    key: "hero.faqs",
    label: "HERO slider — FAQs",
    description: "Top-of-page slider on /faqs.",
    previewPath: "/faqs",
  },
  {
    key: "hero.terms",
    label: "HERO slider — Terms",
    description: "Top-of-page slider on /terms.",
    previewPath: "/terms",
  },
  {
    key: "hero.privacy",
    label: "HERO slider — Privacy",
    description: "Top-of-page slider on /privacy.",
    previewPath: "/privacy",
  },
  {
    key: "hero.privatehire",
    label: "HERO slider — Private hire overview",
    description: "Top-of-page slider on /private-hire.",
    previewPath: "/private-hire",
  },
  {
    key: "hero.privatehire.hackney",
    label: "HERO slider — Private hire (Hackney)",
    description: "Top-of-page slider on /private-hire/hackney.",
    previewPath: "/private-hire/hackney",
  },

  // ----- Inline content galleries -----
  {
    key: "home.features",
    label: "Homepage — More than mini-golf",
    description: "Four cards under the homepage hero (Bar, Pool, Boards, Arcade).",
    previewPath: "/",
  },
  {
    key: "home.press",
    label: "Homepage — Press logos",
    description: 'The "As featured in" marquee strip on the homepage.',
    previewPath: "/",
  },
  {
    key: "home.instagram",
    label: "Homepage — Instagram grid",
    description:
      "Curated grid at the bottom of the homepage. Upload 6–9 square photos that best represent the venue. Each tile links to the No Dice Instagram profile.",
    previewPath: "/",
  },
  {
    key: "about.gallery",
    label: "About page gallery",
    description: "The decade-of-no-dice strip at the bottom of /about.",
    previewPath: "/about",
  },
  {
    key: "venue.hackney.gallery",
    label: "Hackney page gallery",
    description: "Photo strip on /venue/hackney.",
    previewPath: "/venue/hackney",
  },
  {
    key: "hackney.events",
    label: "Hackney — Events posters",
    description: '"Events at No Dice" poster grid on /venue/hackney.',
    previewPath: "/venue/hackney",
  },
  {
    key: "bar.menu_pages",
    label: "Bar — Menu pages",
    description:
      "The menu itself, one image per page. Upload 3 (or more) portrait scans/exports of the menu — they appear as a swipeable slider at the top of /bar. First upload = page 1.",
    previewPath: "/bar",
  },
  {
    key: "bar.drinks_slider",
    label: "Bar — Drinks slider",
    description:
      "Portrait drink shots that cycle below the menu on /bar.",
    previewPath: "/bar",
  },
  {
    key: "deals.grid",
    label: "Deals — 4×2 poster grid",
    description:
      "Upload 7–10 portrait poster images for the deals grid on /deals. First 10 render in order.",
    previewPath: "/deals",
  },
];

function describe(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
}

export default function GalleriesAdminClient() {
  const [all, setAll] = useState<DbGalleryImage[]>([]);
  // Optional ?gallery=<key> query string lets us deep-link from public
  // pages straight into the right gallery editor (used by the in-page
  // "Manage these images" button). Falls back to the first gallery
  // when no query string is set or the value isn't a known key.
  const searchParams = useSearchParams();
  const requestedKey = searchParams?.get("gallery") ?? null;
  const initialKey =
    requestedKey && KNOWN_GALLERIES.some((g) => g.key === requestedKey)
      ? requestedKey
      : KNOWN_GALLERIES[0].key;
  const [activeKey, setActiveKey] = useState<string>(initialKey);
  // If the query string changes (e.g. navigation between two pages
  // that each manage a different gallery), re-select.
  useEffect(() => {
    if (
      requestedKey &&
      KNOWN_GALLERIES.some((g) => g.key === requestedKey) &&
      requestedKey !== activeKey
    ) {
      setActiveKey(requestedKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedKey]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Drag-and-drop reorder state. `dragId` is the card currently being
  // dragged; `overId` is the card it's hovering over (the future
  // insertion point). Both clear on drop / drag-end.
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  // The image currently open in the positioner modal (or null).
  const [positioningId, setPositioningId] = useState<string | null>(null);

  async function handleSavePosition(g: DbGalleryImage, d: ImageDisplay) {
    setBusy(true);
    try {
      await updateGalleryImage(g.id, {
        position_x: Math.round(d.x),
        position_y: Math.round(d.y),
        position_zoom: d.zoom,
        position_fit: d.fit,
      });
      setPositioningId(null);
      await reload();
    } catch (e) {
      setErr(describe(e, "Couldn't save position"));
    } finally {
      setBusy(false);
    }
  }

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      setAll(await loadAllGalleryImages());
    } catch (e) {
      setErr(describe(e, "Failed to load galleries"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  const images = all
    .filter((g) => g.gallery_key === activeKey)
    .sort((a, b) => a.sort_order - b.sort_order);
  const activeGalleryMeta = KNOWN_GALLERIES.find((g) => g.key === activeKey)!;

  async function handleAddFromUpload(file: File) {
    setUploading(true);
    setErr("");
    try {
      const { public_url } = await uploadImage(file, `gallery/${activeKey}`);
      await createGalleryImage({
        gallery_key: activeKey,
        src: public_url,
        alt: file.name.replace(/\.[^.]+$/, ""),
        caption: null,
        sort_order: images.length + 1,
        active: true,
        // Centred + 1× by default. Founder can tune via the
        // "Reposition" button on the card after upload.
        position_x: 50,
        position_y: 50,
        position_zoom: 1,
        position_fit: "cover",
      });
      await reload();
    } catch (e) {
      setErr(describe(e, "Upload failed"));
    } finally {
      setUploading(false);
    }
  }

  // Reorder by dragging `draggedId` to land in `targetId`'s slot. We
  // renumber EVERY image in the gallery from 1..N based on the new
  // visual order — that's more robust than the old pairwise-swap
  // approach (which silently misbehaved when two images shared the
  // same sort_order, e.g. after old deletes / uploads). Optimistic UI:
  // we update local state first so the card snaps into place, then
  // persist; if the server write fails we reload to re-sync.
  async function handleReorder(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    const list = images;
    const fromIdx = list.findIndex((x) => x.id === draggedId);
    const toIdx = list.findIndex((x) => x.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;

    const reordered = [...list];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    // Optimistic update: rewrite sort_order on the local copies so
    // `images` (derived) re-sorts immediately.
    setAll((prev) =>
      prev.map((row) => {
        const newIdx = reordered.findIndex((x) => x.id === row.id);
        return newIdx >= 0 ? { ...row, sort_order: newIdx + 1 } : row;
      }),
    );

    setBusy(true);
    try {
      // Only persist rows whose sort_order actually changed.
      await Promise.all(
        reordered
          .map((row, idx) => ({ row, idx }))
          .filter(({ row, idx }) => row.sort_order !== idx + 1)
          .map(({ row, idx }) =>
            updateGalleryImage(row.id, { sort_order: idx + 1 }),
          ),
      );
    } catch (e) {
      setErr(describe(e, "Reorder failed"));
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveAlt(g: DbGalleryImage, alt: string) {
    setBusy(true);
    try {
      await updateGalleryImage(g.id, { alt });
      await reload();
    } catch (e) {
      setErr(describe(e, "Save failed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(g: DbGalleryImage) {
    if (!confirm(`Remove this image from the gallery? (The original file in Storage isn't deleted.)`)) return;
    setBusy(true);
    try {
      await deleteGalleryImage(g.id);
      await reload();
    } catch (e) {
      setErr(describe(e, "Delete failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Galleries"
        description="Manage every photo grid on the public site. Pick a gallery on the left, upload or remove images on the right."
        action={
          // "View page ↗" — dynamically points at whichever page
          // hosts the currently-selected gallery. Lets the founder
          // hop straight from editing to seeing the live result.
          <a
            href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}${activeGalleryMeta.previewPath}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
            title={`Open ${activeGalleryMeta.previewPath} in a new tab`}
          >
            View page ↗
          </a>
        }
      />

      {err && (
        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Gallery picker */}
        <div className="lg:w-72 shrink-0">
          <ul className="space-y-1">
            {KNOWN_GALLERIES.map((g) => {
              const count = all.filter((x) => x.gallery_key === g.key).length;
              const active = g.key === activeKey;
              return (
                <li key={g.key}>
                  <button
                    onClick={() => setActiveKey(g.key)}
                    className={`block w-full rounded-xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-plonkPink/60 bg-plonkPink/10"
                        : "border-cream/10 bg-ink/40 hover:bg-cream/5"
                    }`}
                  >
                    <p className="text-sm font-medium text-cream">{g.label}</p>
                    <p className="mt-0.5 text-xs text-cream/55">
                      {g.description}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-widest text-cream/40">
                      {count} image{count === 1 ? "" : "s"}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Image grid for active gallery */}
        <div className="flex-1 space-y-3">
          <SpecCaption spec={getImageSpec(activeKey)} />
          <AdminCard
            title={activeGalleryMeta.label}
            action={
              <label
                className={`cursor-pointer rounded-full bg-plonkPink px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90 ${
                  uploading ? "pointer-events-none opacity-50" : ""
                }`}
              >
                {uploading ? "Uploading…" : "+ Upload image"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleAddFromUpload(f);
                    e.target.value = "";
                  }}
                />
              </label>
            }
          >
            {loading ? (
              <p className="px-5 py-8 text-sm text-cream/60">Loading…</p>
            ) : images.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-cream/55">
                No images in this gallery yet — click "+ Upload image". Until
                you add any, the public page falls back to its hardcoded
                images.
              </p>
            ) : (
              <>
                <p className="px-5 pt-1 text-[11px] uppercase tracking-widest text-cream/40">
                  Drag any card to reorder · drop on the slot you want
                </p>
                <ul className="grid gap-3 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
                  {images.map((g) => {
                    const isDragging = dragId === g.id;
                    const isOver = overId === g.id && dragId && dragId !== g.id;
                    return (
                      <li
                        key={g.id}
                        draggable
                        onDragStart={(e) => {
                          setDragId(g.id);
                          e.dataTransfer.effectAllowed = "move";
                          // Some browsers refuse to start the drag without
                          // a data payload — the value itself is unused.
                          e.dataTransfer.setData("text/plain", g.id);
                        }}
                        onDragOver={(e) => {
                          // preventDefault is what allows the drop. Without
                          // it, the browser shows a "no entry" cursor.
                          e.preventDefault();
                          if (dragId && dragId !== g.id) setOverId(g.id);
                        }}
                        onDragLeave={() => {
                          if (overId === g.id) setOverId(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragId) handleReorder(dragId, g.id);
                          setDragId(null);
                          setOverId(null);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverId(null);
                        }}
                        className={`cursor-grab rounded-xl border bg-ink/40 p-3 transition active:cursor-grabbing ${
                          isDragging
                            ? "border-cream/10 opacity-40"
                            : isOver
                              ? "border-plonkPink ring-2 ring-plonkPink/40"
                              : "border-cream/10 hover:border-cream/25"
                        }`}
                      >
                        {/* Preview shows the live position settings so
                            the founder can see how the image actually
                            renders before opening the positioner. */}
                        <div
                          className={`${getImageSpec(activeKey).aspectClass} pointer-events-none w-full overflow-hidden rounded-lg`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={g.src}
                            alt={g.alt ?? ""}
                            draggable={false}
                            className="h-full w-full"
                            style={{
                              objectFit: g.position_fit ?? "cover",
                              objectPosition: `${g.position_x ?? 50}% ${g.position_y ?? 50}%`,
                              transform:
                                (g.position_zoom ?? 1) !== 1
                                  ? `scale(${g.position_zoom})`
                                  : undefined,
                              transformOrigin: `${g.position_x ?? 50}% ${g.position_y ?? 50}%`,
                            }}
                          />
                        </div>
                        <input
                          type="text"
                          defaultValue={g.alt ?? ""}
                          onBlur={(e) =>
                            e.target.value !== (g.alt ?? "") &&
                            handleSaveAlt(g, e.target.value)
                          }
                          placeholder="Alt text"
                          className="mt-2 w-full rounded-md border border-cream/15 bg-ink/40 px-2 py-1 text-xs text-cream placeholder:text-cream/30 focus:border-plonkTeal focus:outline-none"
                        />
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <button
                            onClick={() => setPositioningId(g.id)}
                            disabled={busy}
                            className="rounded-full border border-plonkTeal/40 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-plonkTeal hover:bg-plonkTeal/10 disabled:opacity-40"
                          >
                            Reposition
                          </button>
                          <button
                            onClick={() => handleDelete(g)}
                            disabled={busy}
                            className="text-xs font-semibold uppercase tracking-wider text-red-400/80 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </AdminCard>
        </div>
      </div>

      {/* Positioner modal — portaled to body so it sits above
          everything regardless of the admin sidebar layout. */}
      {positioningId &&
        (() => {
          const g = images.find((x) => x.id === positioningId);
          if (!g) return null;
          if (typeof document === "undefined") return null;
          // Convert aspectClass like "aspect-[3/2]" → "3/2" for the
          // positioner.
          const aspectClass = getImageSpec(activeKey).aspectClass;
          const m = /\[([\d/]+)\]/.exec(aspectClass);
          const aspect = m?.[1] ?? "1/1";
          return createPortal(
            <div className="fixed inset-0 z-[110] flex items-stretch justify-center bg-ink/90 p-2 sm:p-6">
              <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-plonkTeal/40 bg-ink shadow-2xl">
                <div className="flex items-center justify-between gap-3 border-b border-cream/10 px-5 py-4">
                  <div className="min-w-0">
                    <h3 className="font-display text-xl">Reposition image</h3>
                    <p className="truncate text-xs text-cream/55">
                      Drag · zoom · toggle fit · save when happy
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPositioningId(null)}
                    className="rounded-full border border-cream/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
                  >
                    Cancel
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <ImagePositioner
                    src={g.src}
                    aspect={aspect}
                    initial={{
                      src: g.src,
                      fit: g.position_fit ?? "cover",
                      x: g.position_x ?? 50,
                      y: g.position_y ?? 50,
                      zoom: g.position_zoom ?? 1,
                    }}
                    onSave={(d) => handleSavePosition(g, d)}
                    onCancel={() => setPositioningId(null)}
                  />
                </div>
              </div>
            </div>,
            document.body,
          );
        })()}
    </>
  );
}
