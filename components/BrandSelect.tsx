"use client";

import { useEffect, useRef, useState } from "react";

// =============================================================
// BrandSelect — on-brand dropdown matching the rest of the site
// =============================================================
// Replaces the native <select>, which renders in OS chrome (white
// list, blue selected row) that clashes with the dark ink theme.
// Used by /book/pool, /book/checkout, and the inline tournament
// sign-up under /pool — anywhere a "Where did you hear about us?"
// or similar dropdown is needed.
//
// API mirrors a controlled <select>:
//   <BrandSelect value={v} onChange={setV} options={[…]} />
//
// Behaviour: click toggles, click-outside closes, Esc closes,
// selecting an option closes. A hidden <input> mirrors the value
// so any wrapping <form> with required-validation still works.
// =============================================================

export type BrandSelectOption = {
  value: string;
  label: string;
};

export default function BrandSelect({
  value,
  onChange,
  options,
  placeholder = "Pick one…",
  required = false,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: BrandSelectOption[];
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={wrapperRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between rounded-lg border bg-ink/40 px-4 py-3 text-left text-base transition focus:outline-none ${
          open
            ? "border-plonkPink"
            : "border-cream/15 hover:border-cream/30"
        }`}
      >
        <span className={selected ? "text-cream" : "text-cream/40"}>
          {selected?.label ?? placeholder}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden
          className={`text-plonkPink transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-2 max-h-72 overflow-auto rounded-lg border border-plonkPink/30 bg-ink py-1.5 text-sm shadow-2xl shadow-black/40"
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <li
                key={o.value || "__empty__"}
                role="option"
                aria-selected={active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex cursor-pointer items-center justify-between px-4 py-2.5 transition ${
                  active
                    ? "bg-plonkPink/15 text-cream"
                    : "text-cream/85 hover:bg-cream/5 hover:text-cream"
                }`}
              >
                <span>{o.label}</span>
                {active && (
                  <span aria-hidden className="text-plonkPink">
                    ✓
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Hidden field keeps the surrounding <form>'s native
          required-check working — browsers don't see the custom
          dropdown as fillable. */}
      <input
        tabIndex={-1}
        aria-hidden
        required={required}
        value={value}
        onChange={() => {}}
        className="pointer-events-none absolute left-4 top-1/2 h-0 w-0 -translate-y-1/2 opacity-0"
      />
    </div>
  );
}
