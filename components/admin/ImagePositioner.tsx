"use client";

// =============================================================
// Plonk Golf admin — image positioner
// =============================================================
// Mini cropper/positioner. After the admin picks an image, this
// screen lets them drag it around within the target slot's aspect
// ratio, zoom in/out, and toggle between cover (fill the box) and
// contain (show the whole image, possibly with letterboxing).
//
// The output is an ImageDisplay record:
//   { src, fit, x, y, zoom }
// which the caller saves into page_content. The renderer applies
// it via CSS object-fit / object-position / transform: scale.
// =============================================================

import { useEffect, useRef, useState } from "react";
import type { ImageDisplay } from "@/lib/content";

export default function ImagePositioner({
  src,
  aspect,
  initial,
  onSave,
  onCancel,
}: {
  src: string;
  // Aspect ratio of the target slot, like "4/5" or "5/3".
  aspect: string;
  initial?: Partial<ImageDisplay>;
  onSave: (d: ImageDisplay) => void;
  onCancel: () => void;
}) {
  const [fit, setFit] = useState<"cover" | "contain">(initial?.fit ?? "cover");
  const [x, setX] = useState<number>(initial?.x ?? 50);
  const [y, setY] = useState<number>(initial?.y ?? 50);
  const [zoom, setZoom] = useState<number>(initial?.zoom ?? 1);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    posX: number;
    posY: number;
  } | null>(null);

  function startDrag(e: React.PointerEvent) {
    if (fit === "contain") return; // panning only matters when cropped
    const box = boxRef.current;
    if (!box) return;
    box.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: x,
      posY: y,
    };
  }

  function moveDrag(e: React.PointerEvent) {
    const d = dragRef.current;
    const box = boxRef.current;
    if (!d || !box) return;
    const rect = box.getBoundingClientRect();
    const dx = ((e.clientX - d.startX) / rect.width) * 100;
    const dy = ((e.clientY - d.startY) / rect.height) * 100;
    // Drag right → image content shifts right → object-position % goes DOWN.
    setX(clamp(d.posX - dx, 0, 100));
    setY(clamp(d.posY - dy, 0, 100));
  }

  function endDrag(e: React.PointerEvent) {
    const box = boxRef.current;
    if (box && box.hasPointerCapture(e.pointerId)) {
      box.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  }

  function reset() {
    setFit("cover");
    setX(50);
    setY(50);
    setZoom(1);
  }

  return (
    <div className="space-y-4 px-5 py-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-plonkYellow">
          Position image in slot
        </p>
        <p className="mt-1 text-xs text-cream/55">
          Drag to reposition. Use the slider to zoom. Toggle fit if you want
          the whole image visible.
        </p>
      </div>

      <div
        ref={boxRef}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-cream/15 bg-ink/40 select-none touch-none"
        style={{ aspectRatio: aspect, cursor: fit === "cover" ? "grab" : "default" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: fit,
            objectPosition: `${x}% ${y}%`,
            transform: `scale(${zoom})`,
            transformOrigin: `${x}% ${y}%`,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-ink/70 px-3 py-1 text-center text-[10px] uppercase tracking-widest text-cream/70">
          Live preview · slot aspect {aspect.replace("/", " : ")}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-xs text-cream/85">
          <span className="font-bold uppercase tracking-wider text-cream/55">
            Zoom · {zoom.toFixed(2)}×
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="mt-2 block w-full accent-plonkPink"
          />
        </label>

        <label className="block text-xs text-cream/85">
          <span className="font-bold uppercase tracking-wider text-cream/55">
            Horizontal · {Math.round(x)}%
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={x}
            onChange={(e) => setX(parseFloat(e.target.value))}
            className="mt-2 block w-full accent-plonkPink"
          />
        </label>

        <label className="block text-xs text-cream/85">
          <span className="font-bold uppercase tracking-wider text-cream/55">
            Vertical · {Math.round(y)}%
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={y}
            onChange={(e) => setY(parseFloat(e.target.value))}
            className="mt-2 block w-full accent-plonkPink"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
            Fit:
          </span>
          <button
            type="button"
            onClick={() => setFit("cover")}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
              fit === "cover"
                ? "bg-plonkYellow text-ink"
                : "border border-cream/15 text-cream/75 hover:bg-cream/5"
            }`}
            title="Fill the box — image will be cropped if needed"
          >
            Fill
          </button>
          <button
            type="button"
            onClick={() => setFit("contain")}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
              fit === "contain"
                ? "bg-plonkYellow text-ink"
                : "border border-cream/15 text-cream/75 hover:bg-cream/5"
            }`}
            title="Show the whole image — may letterbox"
          >
            Fit whole image
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-cream/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-cream/60 hover:bg-cream/5"
          >
            Reset
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-cream/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => onSave({ src, fit, x, y, zoom })}
            className="rounded-full bg-plonkPink px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90"
          >
            Save image
          </button>
        </div>
      </div>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
