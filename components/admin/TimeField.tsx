"use client";

import { useEffect, useRef, useState } from "react";

// =============================================================
// TimeField — phone-friendly time scroller (founder 19 Oct 2026)
// =============================================================
// Drop-in replacement for <input type="time"> on the booking admin.
// Shows the time as a tappable field; tapping opens two snap-scrolling
// wheels (hours + minutes). You scroll to the value and tap off — the
// wheel closes and the value locks in. Value in/out is "HH:MM" (also
// tolerates "HH:MM:SS" in), so it's interchangeable with the native
// input the forms used before.
//
// All load-bearing layout is INLINE-STYLED on purpose (not Tailwind
// utility classes) so the widget can't be broken by a missing class and
// renders identically everywhere. Colours are the admin theme literals.
// =============================================================

const ITEM_H = 40; // px per row
const PAD_ROWS = 2; // blank rows above/below so a row can sit centred
const INK = "#0c0c0c";
const CREAM = "#f5efe3";
const PINK = "#DA1B33";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function parse(value: string): { h: number; m: number } {
  const [hs, ms] = (value || "00:00").split(":");
  let h = parseInt(hs, 10);
  let m = parseInt(ms, 10);
  if (!Number.isFinite(h)) h = 0;
  if (!Number.isFinite(m)) m = 0;
  return { h: Math.max(0, Math.min(23, h)), m: Math.max(0, Math.min(59, m)) };
}

function Wheel({
  values,
  selected,
  onSelect,
  ariaLabel,
}: {
  values: number[];
  selected: number;
  onSelect: (v: number) => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Centre the selected value when the wheel mounts.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.max(0, values.indexOf(selected));
    el.scrollTop = idx * ITEM_H;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const idx = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(values.length - 1, idx));
      el.scrollTo({ top: clamped * ITEM_H, behavior: "smooth" });
      const v = values[clamped];
      if (v !== selected) onSelect(v);
    }, 110);
  }

  return (
    <div
      style={{ position: "relative", height: ITEM_H * (PAD_ROWS * 2 + 1), width: 70 }}
      role="listbox"
      aria-label={ariaLabel}
    >
      {/* Centre highlight band */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 4,
          right: 4,
          top: ITEM_H * PAD_ROWS,
          height: ITEM_H,
          borderRadius: 8,
          border: `1px solid ${PINK}66`,
          background: `${PINK}14`,
          pointerEvents: "none",
        }}
      />
      <div
        ref={ref}
        onScroll={onScroll}
        className="no-scrollbar"
        style={{
          height: "100%",
          overflowY: "auto",
          scrollSnapType: "y mandatory",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{ height: ITEM_H * PAD_ROWS }} />
        {values.map((v) => (
          <button
            type="button"
            key={v}
            onClick={() => {
              onSelect(v);
              const el = ref.current;
              if (el) el.scrollTo({ top: values.indexOf(v) * ITEM_H, behavior: "smooth" });
            }}
            style={{
              display: "flex",
              width: "100%",
              height: ITEM_H,
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontVariantNumeric: "tabular-nums",
              fontWeight: v === selected ? 700 : 400,
              color: v === selected ? CREAM : `${CREAM}73`,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              scrollSnapAlign: "center",
            }}
          >
            {pad(v)}
          </button>
        ))}
        <div style={{ height: ITEM_H * PAD_ROWS }} />
      </div>
    </div>
  );
}

export default function TimeField({
  value,
  onChange,
  minuteStep = 5,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  minuteStep?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { h, m } = parse(value);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from(
    { length: Math.ceil(60 / minuteStep) },
    (_, i) => i * minuteStep,
  );
  const selMin = minutes.reduce(
    (best, mm) => (Math.abs(mm - m) < Math.abs(best - m) ? mm : best),
    minutes[0],
  );

  function set(nh: number, nm: number) {
    onChange(`${pad(nh)}:${pad(nm)}`);
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={className}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          textAlign: "left",
          fontVariantNumeric: "tabular-nums",
          cursor: "pointer",
        }}
      >
        <span>{`${pad(h)}:${pad(selMin)}`}</span>
        <span style={{ marginLeft: 8, opacity: 0.5 }}>🕓</span>
      </button>

      {open && (
        <>
          {/* Click-off overlay — tapping outside locks the value in. */}
          <div
            onClick={() => setOpen(false)}
            aria-hidden
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
          />
          <div
            style={{
              position: "absolute",
              zIndex: 50,
              marginTop: 8,
              borderRadius: 12,
              border: `1px solid ${CREAM}26`,
              background: INK,
              padding: 8,
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Wheel values={hours} selected={h} onSelect={(nh) => set(nh, selMin)} ariaLabel="Hour" />
              <span style={{ padding: "0 2px", fontSize: 20, fontWeight: 700, color: `${CREAM}99` }}>:</span>
              <Wheel values={minutes} selected={selMin} onSelect={(nm) => set(h, nm)} ariaLabel="Minute" />
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                marginTop: 8,
                width: "100%",
                borderRadius: 8,
                border: "none",
                background: PINK,
                color: "#fff",
                padding: "8px 0",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
}
