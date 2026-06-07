"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

// =============================================================
// DatePickerInput — admin date field with inline calendar popup
// =============================================================
// Wraps react-day-picker so admin forms (the new /admin/events
// create form, future calendar editors, etc.) get a proper visual
// month calendar instead of the OS-native date input.
//
// Theme matches the rest of the admin chrome — teal accent on dark
// background. Selecting a date closes the popup; clicking outside
// or pressing Esc closes without changing anything.
//
// API matches a plain controlled input as closely as possible:
//   <DatePickerInput value={iso} onChange={setIso} />
// where `iso` is a YYYY-MM-DD string (same format as the previous
// <input type="date">).
// =============================================================

function isoFromDate(d: Date): string {
  // Build YYYY-MM-DD from the LOCAL date parts. toISOString() shifts
  // to UTC, which in BST (UTC+1) rolls the date back a day — picking
  // Wed midnight local would round-trip as Tue's ISO string.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateFromIso(s: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(`${s}T00:00:00`);
  return isNaN(d.getTime()) ? undefined : d;
}

function formatDisplay(s: string): string {
  const d = dateFromIso(s);
  if (!d) return "Pick a date";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function DatePickerInput({
  value,
  onChange,
  minIso,
  disabledDaysOfWeek,
  className,
  placeholder = "Pick a date",
}: {
  value: string; // YYYY-MM-DD
  onChange: (iso: string) => void;
  minIso?: string;
  /** Day-of-week numbers to grey out (0=Sun, 1=Mon, …, 6=Sat).
   *  Used by /book/pool to disable Saturdays. */
  disabledDaysOfWeek?: number[];
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = dateFromIso(value);
  const minDate = minIso ? dateFromIso(minIso) : undefined;

  // Click-outside + Escape close. The popup is rendered as a sibling
  // of the trigger inside the same wrapper so a single ref covers
  // both for the outside-click check.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-cream/15 bg-ink/40 px-4 py-2.5 text-left text-sm text-cream focus:border-plonkTeal focus:outline-none"
      >
        <span className={value ? "" : "text-cream/40"}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
          className="text-plonkTeal"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 rounded-2xl border border-plonkTeal/40 bg-ink p-3 shadow-2xl shadow-black/40">
          {/* DayPicker styled inline so the bundle doesn't need a
              global CSS file. Variables match the admin teal theme. */}
          <style>{`
            .ndb-dp .rdp { margin: 0; }
            .ndb-dp .rdp-months { color: #F5EFE3; }
            .ndb-dp .rdp-caption_label { font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; font-size: 13px; color: #F5EFE3; }
            .ndb-dp .rdp-nav_button { color: #1ec8b8; border-radius: 999px; }
            .ndb-dp .rdp-nav_button:hover { background: rgba(30,200,184,0.1); }
            .ndb-dp .rdp-head_cell { color: rgba(245,239,227,0.55); font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em; padding-top: 6px; padding-bottom: 6px; }
            .ndb-dp .rdp-day { color: #F5EFE3; border-radius: 8px; }
            .ndb-dp .rdp-day:hover:not([disabled]):not(.rdp-day_selected) { background: rgba(30,200,184,0.12); }
            .ndb-dp .rdp-day_today { color: #1ec8b8; font-weight: 700; }
            .ndb-dp .rdp-day_selected { background: #1ec8b8 !important; color: #000 !important; }
            .ndb-dp .rdp-day_outside { color: rgba(245,239,227,0.25); }
            .ndb-dp .rdp-day_disabled { color: rgba(245,239,227,0.2); cursor: not-allowed; }
          `}</style>
          <div className="ndb-dp">
            <DayPicker
              mode="single"
              selected={selected}
              defaultMonth={selected ?? new Date()}
              onSelect={(d) => {
                if (d) {
                  onChange(isoFromDate(d));
                  setOpen(false);
                }
              }}
              disabled={[
                ...(minDate ? [{ before: minDate }] : []),
                ...(disabledDaysOfWeek && disabledDaysOfWeek.length > 0
                  ? [{ dayOfWeek: disabledDaysOfWeek }]
                  : []),
              ]}
              weekStartsOn={1}
              showOutsideDays
            />
          </div>
        </div>
      )}
    </div>
  );
}
