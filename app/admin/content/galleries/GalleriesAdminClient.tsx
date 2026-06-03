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

// Every gallery the public site reads from. New galleries can be added
// here (and consumed by the page that needs them); the admin will then
// list them automatically.
const KNOWN_GALLERIES: { key: string; label: string; description: string }[] = [
  // ----- Hero sliders (one per page) -----
  // Upload 2+ images to any of these and that page's hero turns into
  // an auto-cycling slider. With 0 images, page falls back to its
  // hardcoded fallback image / slider array.
  {
    key: "hero.home",
    label: "HERO slider — Home",
    description: "Top-of-page slider on plonkgolf.co.uk/.",
  },
  {
    key: "hero.venue.hackney",
    label: "HERO slider — Hackney",
    description: "Top-of-page slider on /venue/hackney.",
  },
  {
    key: "hero.venue.borough",
    label: "HERO slider — Borough Market",
    description: "Top-of-page slider on /venue/borough-market.",
  },
  {
    key: "hero.about",
    label: "HERO slider — About",
    description: "Top-of-page slider on /about.",
  },
  {
    key: "hero.contact",
    label: "HERO slider — Contact",
    description: "Top-of-page slider on /contact.",
  },
  {
    key: "hero.events",
    label: "HERO slider — Events",
    description: "Top-of-page slider on /events.",
  },
  {
    key: "hero.deals",
    label: "HERO slider — Deals",
    description: "Top-of-page slider on /deals.",
  },
  {
    key: "hero.vouchers",
    label: "HERO slider — Vouchers",
    description: "Top-of-page slider on /vouchers.",
  },
  {
    key: "hero.faqs",
    label: "HERO slider — FAQs",
    description: "Top-of-page slider on /faqs.",
  },
  {
    key: "hero.terms",
    label: "HERO slider — Terms",
    description: "Top-of-page slider on /terms.",
  },
  {
    key: "hero.privacy",
    label: "HERO slider — Privacy",
    description: "Top-of-page slider on /privacy.",
  },
  {
    key: "hero.privatehire",
    label: "HERO slider — Private hire overview",
    description: "Top-of-page slider on /private-hire.",
  },
  {
    key: "hero.privatehire.hackney",
    label: "HERO slider — Private hire (Hackney)",
    description: "Top-of-page slider on /private-hire/hackney.",
  },
  {
    key: "hero.privatehire.borough",
    label: "HERO slider — Private hire (Borough)",
    description: "Top-of-page slider on /private-hire/borough-market.",
  },

  // ----- Inline content galleries -----
  {
    key: "home.features",
    label: "Homepage — More than mini-golf",
    description: "Four cards under the homepage hero (Bar, Pool, Boards, Arcade).",
  },
  {
    key: "home.press",
    label: "Homepage — Press logos",
    description: 'The "As featured in" marquee strip on the homepage.',
  },
  {
    key: "about.gallery",
    label: "About page gallery",
    description: "The decade-of-Plonking strip at the bottom of /about.",
  },
  {
    key: "venue.hackney.gallery",
    label: "Hackney page gallery",
    description: "Photo strip on /venue/hackney.",
  },
  {
    key: "venue.borough.gallery",
    label: "Borough page gallery",
    description: "Photo strip on /venue/borough-market.",
  },
  {
    key: "hackney.events",
    label: "Hackney — Events posters",
    description: '"Events at No Dice" poster grid on /venue/hackney.',
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
      });
      await reload();
    } catch (e) {
      setErr(describe(e, "Upload failed"));
    } finally {
      setUploading(false);
    }
  }

  async function handleMove(g: DbGalleryImage, direction: -1 | 1) {
    const list = images;
    const idx = list.findIndex((x) => x.id === g.id);
    if (idx < 0) return;
    const swapWith = list[idx + direction];
    if (!swapWith) return;
    setBusy(true);
    try {
      await updateGalleryImage(g.id, { sort_order: swapWith.sort_order });
      await updateGalleryImage(swapWith.id, { sort_order: g.sort_order });
      await reload();
    } catch (e) {
      setErr(describe(e, "Reorder failed"));
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
              <ul className="grid gap-3 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
                {images.map((g, idx) => (
                  <li key={g.id} className="rounded-xl border border-cream/10 bg-ink/40 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={g.src}
                      alt={g.alt ?? ""}
                      className={`${getImageSpec(activeKey).aspectClass} w-full rounded-lg object-cover`}
                    />
                    <input
                      type="text"
                      defaultValue={g.alt ?? ""}
                      onBlur={(e) =>
                        e.target.value !== (g.alt ?? "") &&
                        handleSaveAlt(g, e.target.value)
                      }
                      placeholder="Alt text"
                      className="mt-2 w-full rounded-md border border-cream/15 bg-ink/40 px-2 py-1 text-xs text-cream placeholder:text-cream/30 focus:border-plonkPink focus:outline-none"
                    />
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleMove(g, -1)}
                          disabled={busy || idx === 0}
                          className="rounded border border-cream/15 px-2 py-1 text-cream/70 disabled:opacity-30"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => handleMove(g, 1)}
                          disabled={busy || idx === images.length - 1}
                          className="rounded border border-cream/15 px-2 py-1 text-cream/70 disabled:opacity-30"
                          title="Move down"
                        >
                          ↓
                        </button>
                      </div>
                      <button
                        onClick={() => handleDelete(g)}
                        disabled={busy}
                        className="text-xs font-semibold uppercase tracking-wider text-red-400/80 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </div>
      </div>
    </>
  );
}
