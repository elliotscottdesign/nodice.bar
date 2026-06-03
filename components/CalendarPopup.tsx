"use client";

import { useState } from "react";
import { localIso } from "@/lib/dateIso";

export default function CalendarPopup({
  value,
  minIso,
  maxIso,
  onSelect,
  onClose,
}: {
  value: string;
  minIso: string;
  maxIso: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
}) {
  const initial = new Date(value + "T00:00:00");
  const [shown, setShown] = useState<{ year: number; month: number }>(() => ({
    year: initial.getFullYear(),
    month: initial.getMonth(),
  }));

  const monthFirst = new Date(shown.year, shown.month, 1);
  const daysInMonth = new Date(shown.year, shown.month + 1, 0).getDate();
  const firstWeekday = (monthFirst.getDay() + 6) % 7; // Monday-first

  const minDate = new Date(minIso + "T00:00:00");
  const maxDate = new Date(maxIso + "T00:00:00");
  const todayIsoNow = localIso(new Date());

  function isDisabled(iso: string) {
    const d = new Date(iso + "T00:00:00");
    return d < minDate || d > maxDate;
  }

  const cells: ({ iso: string; day: number } | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${shown.year}-${String(shown.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ iso, day: d });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = monthFirst.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const prevAllowed =
    new Date(shown.year, shown.month, 1) > new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const nextAllowed =
    new Date(shown.year, shown.month + 1, 1) <=
    new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick a date"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 p-3 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-cream/15 bg-ink p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl">{monthLabel}</h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                setShown((s) =>
                  s.month - 1 < 0 ? { year: s.year - 1, month: 11 } : { ...s, month: s.month - 1 },
                )
              }
              disabled={!prevAllowed}
              aria-label="Previous month"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-cream/15 text-cream/80 hover:border-cream/30 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() =>
                setShown((s) =>
                  s.month + 1 > 11 ? { year: s.year + 1, month: 0 } : { ...s, month: s.month + 1 },
                )
              }
              disabled={!nextAllowed}
              aria-label="Next month"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-cream/15 text-cream/80 hover:border-cream/30 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ›
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-cream/70 hover:text-cream"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="mb-2 grid grid-cols-7 text-center text-[10px] font-bold uppercase tracking-widest text-cream/40">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((c, i) => {
            if (!c) return <span key={`empty-${i}`} className="aspect-square" />;
            const disabled = isDisabled(c.iso);
            const selected = c.iso === value;
            const isToday = c.iso === todayIsoNow;
            return (
              <button
                key={c.iso}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(c.iso)}
                className={`flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition ${
                  selected
                    ? "bg-plonkPink font-bold text-white"
                    : disabled
                      ? "cursor-not-allowed text-cream/20"
                      : "text-cream hover:bg-cream/10"
                } ${isToday && !selected ? "ring-1 ring-inset ring-plonkYellow/60" : ""}`}
              >
                {c.day}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-full border border-cream/15 py-2.5 text-xs font-bold uppercase tracking-widest text-cream/80 hover:bg-cream/5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
