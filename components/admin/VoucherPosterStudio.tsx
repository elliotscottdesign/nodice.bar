"use client";

// =============================================================
// VoucherPosterStudio — the voucher artwork maker
// =============================================================
// The SAME engine and the SAME tools as the deals poster studio (photo by
// upload OR from the media library, exposure dial, colour palette, image
// treatment, live preview, download), narrowed for vouchers:
//   • the headline is fixed "NO DICE VOUCHER" — no name field, the team can't
//     rename it;
//   • the terms copy is fixed;
//   • the picture is lockable — the founder uploads the token artwork once and
//     locks it, and then the team can't change it (they can only unlock to
//     swap it);
//   • the value (passed in) and the voucher's locked random code are drawn on
//     by lib/poster/voucherArt.
// The parent owns the value + code + recipient; this component owns the artwork
// and hands back the finished PNG through registerExport().
// =============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import MediaPicker from "@/components/admin/MediaPicker";
import Notice from "@/components/Notice";
import { confirmDialog } from "@/lib/dialog";
import { uploadImage } from "@/lib/db/media";
import { PALETTE, canvasToBlob, loadImage } from "@/lib/poster/engine";
import { renderVoucherPoster } from "@/lib/poster/voucherArt";
import type { VoucherDefaults } from "@/lib/db/vouchers";

const PILL =
  "rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition";

const TREATMENTS: { key: string; label: string }[] = [
  { key: "whites", label: "Colour through" },
  { key: "natural", label: "Natural photo" },
  { key: "scatter", label: "Halftone" },
];

export type VoucherExport = {
  blob: Blob;
  imageUrl: string;
  colour: string;
  treatment: string;
};

export default function VoucherPosterStudio({
  valuePence,
  code,
  defaults,
  onDefaultsChange,
  registerExport,
}: {
  valuePence: number;
  code: string;
  defaults: VoucherDefaults;
  onDefaultsChange: (d: VoucherDefaults) => void;
  registerExport: (fn: (() => Promise<VoucherExport>) | null) => void;
}) {
  const [imageUrl, setImageUrl] = useState(defaults.image_url);
  const [locked, setLocked] = useState(defaults.image_locked);
  const [treatment, setTreatment] = useState(defaults.treatment || "whites");
  const [colour, setColour] = useState(defaults.colour || "#F6A11E");
  const [exposure, setExposure] = useState(1);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  // Re-sync when the shared defaults load/change (first render races the fetch).
  useEffect(() => {
    setImageUrl(defaults.image_url);
    setLocked(defaults.image_locked);
    setTreatment(defaults.treatment || "whites");
    setColour(defaults.colour || "#F6A11E");
  }, [defaults]);

  // Load the chosen picture into an <img> the canvas can draw.
  useEffect(() => {
    let live = true;
    if (!imageUrl) {
      setImg(null);
      return;
    }
    loadImage(imageUrl)
      .then((el) => {
        if (live) setImg(el);
      })
      .catch(() => {
        if (live) {
          setImg(null);
          setErr("That picture could not be loaded.");
        }
      });
    return () => {
      live = false;
    };
  }, [imageUrl]);

  // Build the voucher canvas from the current settings.
  const build = useCallback(async (): Promise<HTMLCanvasElement> => {
    return renderVoucherPoster({
      valuePence,
      code,
      img,
      exposure,
      colour,
      treatment: treatment as "whites" | "natural" | "scatter",
    });
  }, [valuePence, code, img, exposure, colour, treatment]);

  // Live preview (scaled down into the on-screen canvas), debounced.
  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      try {
        const full = await build();
        if (!live) return;
        const pv = previewRef.current;
        if (!pv) return;
        const scale = Math.min(1, 700 / full.height);
        pv.width = Math.round(full.width * scale);
        pv.height = Math.round(full.height * scale);
        const c = pv.getContext("2d")!;
        c.clearRect(0, 0, pv.width, pv.height);
        c.drawImage(full, 0, 0, pv.width, pv.height);
      } catch {
        /* a half-typed value shouldn't throw a red box */
      }
    }, 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [build]);

  // Hand the parent a fresh export each render.
  useEffect(() => {
    registerExport(async () => {
      const full = await build();
      const blob = await canvasToBlob(full);
      return { blob, imageUrl, colour, treatment };
    });
    return () => registerExport(null);
  }, [build, registerExport, imageUrl, colour, treatment]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!f) return;
    setErr("");
    setUploading(true);
    try {
      const { public_url } = await uploadImage(f, "vouchers");
      setImageUrl(public_url);
    } catch {
      setErr("Upload failed — try a smaller image.");
    } finally {
      setUploading(false);
    }
  }

  function persistDefaults(next: Partial<VoucherDefaults>) {
    const merged: VoucherDefaults = {
      image_url: next.image_url ?? imageUrl,
      image_locked: next.image_locked ?? locked,
      treatment: next.treatment ?? treatment,
      colour: next.colour ?? colour,
    };
    onDefaultsChange(merged);
  }

  async function toggleLock() {
    if (locked) {
      if (
        !(await confirmDialog(
          "Unlock the voucher picture so it can be changed? Lock it again when you're done.",
        ))
      )
        return;
      setLocked(false);
      persistDefaults({ image_locked: false });
    } else {
      setLocked(true);
      // Locking also pins the current picture + look as the team default.
      persistDefaults({ image_locked: true, image_url: imageUrl, treatment, colour });
    }
  }

  async function download() {
    const full = await build();
    const blob = await canvasToBlob(full);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `no-dice-voucher-${code}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const canEditImage = !locked;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_auto]">
      {/* Controls */}
      <div className="space-y-5">
        {err && <Notice variant="error">{err}</Notice>}

        {/* Picture + lock */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
              Voucher picture
            </span>
            <button
              type="button"
              onClick={toggleLock}
              className={`${PILL} ${
                locked
                  ? "border-plonkTeal/40 bg-plonkTeal/15 text-plonkTeal"
                  : "border-cream/25 text-cream/70 hover:bg-cream/5"
              }`}
            >
              {locked ? "🔒 Locked" : "🔓 Unlocked"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canEditImage || uploading}
              onClick={() => fileRef.current?.click()}
              className={`${PILL} border-cream/25 text-cream/80 hover:bg-cream/5 disabled:opacity-40`}
            >
              {uploading ? "Uploading…" : "Upload a picture"}
            </button>
            <button
              type="button"
              disabled={!canEditImage}
              onClick={() => setShowLibrary(true)}
              className={`${PILL} border-cream/25 text-cream/80 hover:bg-cream/5 disabled:opacity-40`}
            >
              From library
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onFile}
              className="hidden"
            />
          </div>
          {locked && (
            <p className="mt-1.5 text-[11px] text-cream/45">
              The picture is locked so every voucher looks the same. Unlock to
              change it.
            </p>
          )}
          {!imageUrl && (
            <p className="mt-1.5 text-[11px] text-plonkPink/80">
              Upload the No Dice tokens photo, then press 🔒 Locked to pin it for
              the whole team.
            </p>
          )}
        </div>

        {/* Treatment */}
        <div>
          <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-cream/55">
            Picture style
          </span>
          <div className="flex flex-wrap gap-2">
            {TREATMENTS.map((t) => (
              <button
                key={t.key}
                type="button"
                disabled={!canEditImage}
                onClick={() => {
                  setTreatment(t.key);
                  persistDefaults({ treatment: t.key });
                }}
                className={`${PILL} disabled:opacity-40 ${
                  treatment === t.key
                    ? "border-plonkPink bg-plonkPink text-white"
                    : "border-cream/25 text-cream/70 hover:bg-cream/5"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Colour */}
        <div>
          <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-cream/55">
            Colour
          </span>
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((p) => (
              <button
                key={p.hex}
                type="button"
                disabled={!canEditImage}
                title={p.name}
                onClick={() => {
                  setColour(p.hex);
                  persistDefaults({ colour: p.hex });
                }}
                style={{ background: p.hex }}
                className={`h-8 w-8 rounded-full border-2 transition disabled:opacity-40 ${
                  colour === p.hex ? "border-cream" : "border-transparent"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Exposure */}
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-cream/55">
            Exposure
          </label>
          <input
            type="range"
            min={0.4}
            max={1.8}
            step={0.05}
            value={exposure}
            disabled={!canEditImage}
            onChange={(e) => setExposure(Number(e.target.value))}
            className="w-full accent-plonkPink disabled:opacity-40"
          />
        </div>

        <button
          type="button"
          onClick={download}
          className="rounded-full border border-cream/25 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cream/80 hover:bg-cream/5"
        >
          ⬇ Download artwork
        </button>
      </div>

      {/* Live preview */}
      <div className="flex justify-center">
        <canvas
          ref={previewRef}
          className="max-h-[70vh] rounded-xl border border-cream/15 bg-black shadow-2xl"
        />
      </div>

      {showLibrary && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/80 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl border border-cream/15 bg-ink p-5">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="font-display text-xl">Choose a picture</h4>
              <button
                onClick={() => setShowLibrary(false)}
                className="text-cream/60 hover:text-cream"
              >
                ✕
              </button>
            </div>
            <MediaPicker
              onClose={() => setShowLibrary(false)}
              onPick={(value) => {
                const url = typeof value === "string" ? value : value.src;
                if (url) setImageUrl(url);
                setShowLibrary(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
