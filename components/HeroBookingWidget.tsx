"use client";

import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import CalendarPopup from "./CalendarPopup";
import { localIso } from "@/lib/dateIso";

// HeroBookingWidget — the single floating front door for every kind
// of reservation No Dice takes. User picks WHAT (Pool / Table /
// World Cup / Golf), WHEN, and WHO (party size), then we route to
// the matching flow with date + size as query params. Visually
// retains the Plonk Golf "search bar" shape so it slots into the
// homepage hero unchanged.
//
// Item-routing table:
//   pool       /book/pool   — 30-min slots on the hour, pool tables
//   table      /book/table  — 15-min granularity, restaurant tables
//   worldcup   /world-cup   — match-anchored reservations
//   golf       (external)   — Plonk Golf's own booking site
type ItemId = "pool" | "table" | "worldcup" | "golf";

const ITEMS: { id: ItemId; label: string; description: string }[] = [
  { id: "pool",     label: "Pool table",   description: "30 min slots · on the hour" },
  { id: "table",    label: "Table",        description: "Drinks · dinner · groups" },
  { id: "worldcup", label: "World Cup",    description: "Reserve a spot for a match" },
  { id: "golf",     label: "Golf",         description: "Plonk Golf — Hackney" },
];

// Plonk Golf is on its own domain — opening it in a new tab keeps the
// user's No Dice session intact.
const GOLF_EXTERNAL_URL = "https://www.plonkgolf.co.uk/";

function todayIso(): string {
  return localIso(new Date());
}

function maxIso(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return localIso(d);
}

function prettyDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(today);
  t.setDate(today.getDate() + 1);
  const isToday = d.toDateString() === today.toDateString();
  const isTomorrow = d.toDateString() === t.toDateString();
  if (isToday) return "Today";
  if (isTomorrow) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default function HeroBookingWidget() {
  const router = useRouter();
  const [item, setItem] = useState<"" | ItemId>("");
  const [date, setDate] = useState<string>("");
  const [size, setSize] = useState<number>(0);

  const [openField, setOpenField] = useState<null | "item" | "size">(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Refs to the trigger buttons so the portaled dropdown can position
  // itself flush under whichever one was clicked.
  const itemBtnRef = useRef<HTMLButtonElement | null>(null);
  const sizeBtnRef = useRef<HTMLButtonElement | null>(null);

  function search() {
    // Default to "table" if nothing picked — most common booking type
    // for a bar, and the table flow accepts walk-up sizes anyway.
    const chosen: ItemId = item || "table";

    // Golf is external — open Plonk Golf and bail; query params are
    // dropped because their booking system has its own date picker.
    if (chosen === "golf") {
      window.open(GOLF_EXTERNAL_URL, "_blank", "noopener,noreferrer");
      return;
    }

    // Build the query string. World Cup uses date only (no party-size
    // checkout flow yet); pool and table take both.
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (size > 0 && chosen !== "worldcup") params.set("size", String(size));
    const qs = params.toString();

    const path = chosen === "worldcup" ? "/world-cup" : `/book/${chosen}`;
    router.push(`${path}${qs ? `?${qs}` : ""}`);
  }

  const itemLabel =
    item ? ITEMS.find((i) => i.id === item)?.label : "What to book";

  return (
    <>
      <div className="relative mx-auto hidden w-full max-w-3xl rounded-full bg-cream/95 p-1.5 shadow-2xl md:flex">
        {/* What */}
        <Field
          ref={itemBtnRef}
          label="What"
          value={itemLabel}
          placeholder={!item}
          active={openField === "item"}
          onClick={() => setOpenField(openField === "item" ? null : "item")}
        />
        {openField === "item" && (
          <DropdownPanel
            anchorRef={itemBtnRef}
            align="left"
            width={272}
            onClose={() => setOpenField(null)}
          >
            {ITEMS.map((i) => (
              <button
                key={i.id}
                onClick={() => {
                  setItem(i.id);
                  setOpenField(null);
                }}
                className="block w-full rounded-md px-3 py-2.5 text-left hover:bg-ink/5"
              >
                <p className="text-sm font-semibold text-ink">{i.label}</p>
                <p className="text-[11px] text-ink/55">{i.description}</p>
              </button>
            ))}
          </DropdownPanel>
        )}

        <Divider />

        {/* When */}
        <Field
          label="When"
          value={date ? prettyDate(date) : "Pick a date"}
          placeholder={!date}
          active={false}
          onClick={() => setCalendarOpen(true)}
        />

        <Divider />

        {/* Who — generic "guests" works across pool, table, world cup */}
        <Field
          ref={sizeBtnRef}
          label="Who"
          value={size > 0 ? `${size} ${size === 1 ? "guest" : "guests"}` : "Party size"}
          placeholder={size === 0}
          active={openField === "size"}
          onClick={() => setOpenField(openField === "size" ? null : "size")}
        />
        {openField === "size" && (
          <DropdownPanel
            anchorRef={sizeBtnRef}
            align="center"
            onClose={() => setOpenField(null)}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((n) => (
              <button
                key={n}
                onClick={() => {
                  setSize(n);
                  setOpenField(null);
                }}
                className="block w-full rounded-md px-3 py-2.5 text-left text-sm text-ink hover:bg-ink/5"
              >
                {n} {n === 1 ? "guest" : "guests"}
              </button>
            ))}
          </DropdownPanel>
        )}

        {/* Search */}
        <button
          onClick={search}
          className="ml-auto inline-flex items-center gap-2 rounded-full bg-plonkPink px-6 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Search
        </button>
      </div>

      {calendarOpen && (
        <CalendarPopup
          value={date || todayIso()}
          minIso={todayIso()}
          maxIso={maxIso()}
          onSelect={(iso) => {
            setDate(iso);
            setCalendarOpen(false);
          }}
          onClose={() => setCalendarOpen(false)}
        />
      )}
    </>
  );
}

type FieldProps = {
  label: string;
  value: React.ReactNode;
  placeholder?: boolean;
  active?: boolean;
  onClick: () => void;
};
const Field = forwardRef<HTMLButtonElement, FieldProps>(function Field(
  { label, value, placeholder, active, onClick },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={`group flex-1 rounded-full px-5 py-2.5 text-left transition ${
        active ? "bg-cream" : "hover:bg-cream"
      }`}
    >
      <p className="text-[11px] font-bold uppercase tracking-widest text-ink">{label}</p>
      <p
        className={`mt-0.5 text-sm font-medium ${
          placeholder ? "text-ink/55" : "text-ink"
        }`}
      >
        {value}
      </p>
    </button>
  );
});

function Divider() {
  return <div className="my-2 w-px bg-ink/15" aria-hidden />;
}

// Rendered into document.body via portal so the panel can never be clipped
// by a parent's overflow:hidden (we had cases where the dropdown extended
// past the hero section and the next section's background painted over it).
// Position is computed from the trigger button's getBoundingClientRect, and
// kept in sync on scroll/resize.
function DropdownPanel({
  children,
  onClose,
  anchorRef,
  align = "left",
  width = 224,
}: {
  children: React.ReactNode;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  align?: "left" | "center";
  width?: number;
}) {
  const PANEL_WIDTH = width;
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    function update() {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const top = r.bottom + 8 + window.scrollY;
      const left =
        align === "center"
          ? r.left + r.width / 2 + window.scrollX - PANEL_WIDTH / 2
          : r.left + window.scrollX;
      setCoords({ top, left });
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, align, PANEL_WIDTH]);

  if (!mounted || !coords) return null;

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] cursor-default"
        aria-hidden
        onClick={onClose}
      />
      <div
        style={{ top: coords.top, left: coords.left, width: PANEL_WIDTH }}
        className="absolute z-[70] rounded-xl border border-ink/10 bg-cream p-2 shadow-xl"
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
