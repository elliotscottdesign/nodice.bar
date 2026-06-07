"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export type HeroSlideImage = {
  src: string;
  alt?: string;
  /** 0–100 — horizontal focal point. Defaults to 50 (centred). */
  position_x?: number;
  /** 0–100 — vertical focal point. Defaults to 50 (centred). */
  position_y?: number;
  /** 1–4 — extra zoom applied around the focal point. Defaults to 1. */
  position_zoom?: number;
  /** "cover" (default) or "contain". */
  position_fit?: "cover" | "contain";
};

export default function HeroSlider({
  images,
  intervalMs = 5500,
}: {
  images: HeroSlideImage[];
  intervalMs?: number;
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % images.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [images.length, intervalMs]);

  if (images.length === 0) return null;

  return (
    <div className="absolute inset-0">
      {images.map((img, i) => {
        const x = img.position_x ?? 50;
        const y = img.position_y ?? 50;
        const zoom = img.position_zoom ?? 1;
        const fit = img.position_fit ?? "cover";
        return (
          <div
            key={img.src}
            aria-hidden={i !== active}
            className={`absolute inset-0 transition-opacity duration-[1400ms] ease-in-out ${
              i === active ? "opacity-100" : "opacity-0"
            }`}
          >
            <Image
              src={img.src}
              alt={img.alt ?? ""}
              fill
              priority={i === 0}
              sizes="100vw"
              // CSS object-fit + object-position handle the crop. The
              // transform-scale + transform-origin around the same
              // focal point gives the founder a true "zoom in here"
              // control on top of the crop.
              style={{
                objectFit: fit,
                objectPosition: `${x}% ${y}%`,
                transform: zoom !== 1 ? `scale(${zoom})` : undefined,
                transformOrigin: `${x}% ${y}%`,
              }}
            />
          </div>
        );
      })}

      {images.length > 1 && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {images.map((img, i) => (
            <span
              key={img.src}
              className={`h-1 rounded-full transition-all duration-500 ${
                i === active ? "w-8 bg-cream/80" : "w-1.5 bg-cream/30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
