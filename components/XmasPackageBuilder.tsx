"use client";

import { useMemo, useState } from "react";

// =============================================================
// XmasPackageBuilder — pick-and-mix Christmas party enquiry
// =============================================================
// Customer picks up to 4 preferred dates, optionally a private-hire
// slot, then mixes drinks / food / games packages and gives their
// details. "Send to the No Dice team" POSTs to the `xmas-enquiry`
// edge function, which emails info@nodice.bar. It's an ENQUIRY, not a
// payment — the running total is indicative (per head × headcount).
// (Founder spec, 9 Oct 2026.)
// =============================================================

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://rntcujcpsozvuxvmlejv.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const ENQUIRY_FN_URL = `${SUPABASE_URL}/functions/v1/xmas-enquiry`;

type Item = { id: string; name: string; price: number; exclusive?: boolean };

const DRINKS: Item[] = [
  { id: "house_drink", name: "House drink", price: 8 },
  { id: "xmas_cocktail", name: "Xmas cocktail", price: 12 },
  { id: "open_bar", name: "Open Bar — house drinks", price: 70, exclusive: true },
];
const FOOD: Item[] = [
  { id: "main", name: "Main", price: 12 },
  { id: "sides", name: "Sides", price: 5 },
  { id: "sharer", name: "Xmas sharer menu", price: 40 },
  { id: "open_buffet", name: "Bottomless Xmas buffet", price: 70, exclusive: true },
];
const GAMES: Item[] = [
  { id: "gaming_pack", name: "Gaming pack", price: 12 },
  { id: "bingo", name: "Bingo", price: 5 },
  { id: "treasure_hunt", name: "Xmas treasure hunt", price: 10 },
];
const ALL_ITEMS = [...DRINKS, ...FOOD, ...GAMES];

const SLOTS = [
  { id: "lunch", label: "12:00 – 3:00pm", note: "£3,000 min spend" },
  { id: "afternoon", label: "3:30 – 6:30pm", note: "£3,000 min spend" },
  {
    id: "evening",
    label: "7:00pm – 12:00am",
    note: "£7,000 min spend · free DJ all night",
  },
] as const;

const MAX_DATES = 4;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Calendar helpers ─────────────────────────────────────────
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function todayIso(): string {
  const n = new Date();
  return iso(n.getFullYear(), n.getMonth(), n.getDate());
}
function prettyDate(isoStr: string): string {
  return new Date(`${isoStr}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function XmasPackageBuilder() {
  // Start the calendar on December 2026 — peak party season.
  const [calYear, setCalYear] = useState(2026);
  const [calMonth, setCalMonth] = useState(11); // 0-indexed → December
  const [dates, setDates] = useState<string[]>([]);
  const [privateHire, setPrivateHire] = useState(false);
  const [slot, setSlot] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [headcount, setHeadcount] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  const minIso = todayIso();

  function toggleDate(d: string) {
    setDates((prev) => {
      if (prev.includes(d)) return prev.filter((x) => x !== d);
      if (prev.length >= MAX_DATES) return prev; // cap at 4
      return [...prev, d].sort();
    });
  }

  function toggleItem(group: Item[], id: string) {
    const item = group.find((i) => i.id === id)!;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (item.exclusive) {
        // Open Bar / Open Buffet clears the rest of its group.
        for (const other of group) next.delete(other.id);
      } else {
        // Selecting any normal item clears the group's exclusive pick.
        for (const other of group) if (other.exclusive) next.delete(other.id);
      }
      next.add(id);
      return next;
    });
  }

  const openBar = selected.has("open_bar");
  const openBuffet = selected.has("open_buffet");

  const heads = Math.max(0, parseInt(headcount || "0", 10) || 0);
  const perHead = useMemo(
    () =>
      ALL_ITEMS.filter((i) => selected.has(i.id)).reduce(
        (s, i) => s + i.price,
        0,
      ),
    [selected],
  );
  const estimate = perHead * heads;

  const canSend =
    name.trim() &&
    EMAIL_RE.test(email.trim()) &&
    heads > 0 &&
    state !== "sending";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setState("sending");
    setError("");
    const chosenSlot = privateHire
      ? SLOTS.find((s) => s.id === slot)
      : undefined;
    const payload = {
      dates,
      private_hire: privateHire,
      slot: chosenSlot
        ? `${chosenSlot.label} (${chosenSlot.note})`
        : null,
      headcount: heads,
      items: ALL_ITEMS.filter((i) => selected.has(i.id)).map((i) => ({
        name: i.name,
        price_per_head: i.price,
      })),
      estimate_per_head: perHead,
      estimate_total: estimate,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      company: company.trim(),
      notes: notes.trim(),
    };
    try {
      const res = await fetch(ENQUIRY_FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Couldn't send (${res.status})`);
      }
      setState("sent");
    } catch (err) {
      setState("error");
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong — email hello@nodice.bar instead.",
      );
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-2xl border border-pong/40 bg-pong/[0.08] p-8 text-center">
        <div className="font-display text-3xl uppercase tracking-wider text-cream">
          Enquiry sent 🎄
        </div>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-cream/80">
          Thanks {name.trim().split(" ")[0]} — your Christmas party enquiry is
          with the No Dice team. We&apos;ll be in touch shortly to lock in the
          details.
        </p>
      </div>
    );
  }

  const weeks = buildMonth(calYear, calMonth);

  return (
    <form onSubmit={submit} className="space-y-10">
      {/* ── 1 · Dates ───────────────────────────────── */}
      <section>
        <StepHeading n={1} title="Pick your dates" />
        <p className="mt-1 text-sm text-cream/60">
          Choose up to {MAX_DATES} options that work — we&apos;ll confirm
          availability.
        </p>
        <div className="mt-4 max-w-sm rounded-2xl border border-cream/10 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1, calYear, calMonth, setCalYear, setCalMonth)}
              className="rounded-full px-3 py-1 text-cream/70 hover:bg-cream/10"
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className="font-display text-lg uppercase tracking-wider text-cream">
              {MONTHS[calMonth]} {calYear}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1, calYear, calMonth, setCalYear, setCalMonth)}
              className="rounded-full px-3 py-1 text-cream/70 hover:bg-cream/10"
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-widest text-cream/40">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {weeks.map((d, i) => {
              if (d === null) return <div key={i} />;
              const ds = iso(calYear, calMonth, d);
              const isPast = ds < minIso;
              const isSel = dates.includes(ds);
              const full = dates.length >= MAX_DATES && !isSel;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isPast || full}
                  onClick={() => toggleDate(ds)}
                  className={`aspect-square rounded-lg text-sm transition ${
                    isSel
                      ? "bg-nodiceRed font-bold text-white"
                      : isPast
                        ? "cursor-not-allowed text-cream/20"
                        : full
                          ? "cursor-not-allowed text-cream/25"
                          : "text-cream/80 hover:bg-cream/10"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
        {dates.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {dates.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDate(d)}
                className="inline-flex items-center gap-1.5 rounded-full border border-nodiceRed/40 bg-nodiceRed/10 px-3 py-1 text-xs text-cream"
              >
                {prettyDate(d)} <span aria-hidden>✕</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── 2 · Private hire ────────────────────────── */}
      <section>
        <StepHeading n={2} title="Private hire?" />
        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border border-cream/10 bg-white/[0.02] p-4">
          <input
            type="checkbox"
            checked={privateHire}
            onChange={(e) => {
              setPrivateHire(e.target.checked);
              if (!e.target.checked) setSlot("");
            }}
            className="mt-0.5 h-5 w-5 accent-nodiceRed"
          />
          <span className="text-sm text-cream/85">
            Take the space privately — pick a slot below. Minimum spends apply.
          </span>
        </label>
        {privateHire && (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {SLOTS.map((s) => (
              <label
                key={s.id}
                className={`cursor-pointer rounded-2xl border p-4 text-left transition ${
                  slot === s.id
                    ? "border-nodiceRed bg-nodiceRed/10"
                    : "border-cream/10 bg-white/[0.02] hover:border-cream/30"
                }`}
              >
                <input
                  type="radio"
                  name="slot"
                  value={s.id}
                  checked={slot === s.id}
                  onChange={() => setSlot(s.id)}
                  className="sr-only"
                />
                <div className="font-display text-lg uppercase tracking-wider text-cream">
                  {s.label}
                </div>
                <div className="mt-1 text-xs text-pongLight">{s.note}</div>
              </label>
            ))}
          </div>
        )}
      </section>

      {/* ── 3 · Packages ────────────────────────────── */}
      <section>
        <StepHeading n={3} title="Build your package" />
        <p className="mt-1 text-sm text-cream/60">
          Prices are per head. Open Bar or Bottomless Buffet cover everything in
          their section.
        </p>
        <div className="mt-5 space-y-6">
          <ItemGroup
            label="Drinks"
            items={DRINKS}
            selected={selected}
            disabledIds={openBar ? DRINKS.filter((i) => !i.exclusive).map((i) => i.id) : []}
            onToggle={(id) => toggleItem(DRINKS, id)}
          />
          <ItemGroup
            label="Food"
            items={FOOD}
            selected={selected}
            disabledIds={openBuffet ? FOOD.filter((i) => !i.exclusive).map((i) => i.id) : []}
            onToggle={(id) => toggleItem(FOOD, id)}
          />
          <ItemGroup
            label="Games"
            items={GAMES}
            selected={selected}
            disabledIds={[]}
            onToggle={(id) => toggleItem(GAMES, id)}
          />
        </div>
      </section>

      {/* ── 4 · Numbers + estimate ──────────────────── */}
      <section>
        <StepHeading n={4} title="How many people?" />
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={headcount}
            onChange={(e) => setHeadcount(e.target.value)}
            placeholder="e.g. 20"
            className="w-32 rounded-xl border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream placeholder:text-cream/35 focus:border-nodiceRed focus:outline-none"
          />
          {perHead > 0 && heads > 0 && (
            <div className="text-sm text-cream/80">
              Indicative total{" "}
              <span className="font-display text-2xl text-nodiceRed">
                £{estimate.toLocaleString()}
              </span>{" "}
              <span className="text-cream/50">
                (£{perHead}/head × {heads})
              </span>
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-cream/45">
          A guide only — the team will send a firm quote with your enquiry.
        </p>
      </section>

      {/* ── 5 · Your details ────────────────────────── */}
      <section>
        <StepHeading n={5} title="Your details" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Name" value={name} onChange={setName} required />
          <Field label="Email" value={email} onChange={setEmail} type="email" required />
          <Field label="Phone" value={phone} onChange={setPhone} type="tel" />
          <Field label="Company (optional)" value={company} onChange={setCompany} />
        </div>
        <label className="mt-3 block">
          <span className="text-xs font-bold uppercase tracking-widest text-cream/50">
            Notes
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Anything else — dietaries, occasion, must-haves…"
            className="mt-1.5 w-full rounded-xl border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream placeholder:text-cream/35 focus:border-nodiceRed focus:outline-none"
          />
        </label>
      </section>

      {error && (
        <p className="rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSend}
        className="w-full rounded-full bg-nodiceRed px-8 py-4 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-nodiceRedDeep disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
      >
        {state === "sending" ? "Sending…" : "Send to the No Dice team →"}
      </button>
    </form>
  );
}

// ── Sub-components ───────────────────────────────────────────
function StepHeading({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-nodiceRed/20 text-xs font-bold text-nodiceRed">
        {n}
      </span>
      <h3 className="font-display text-2xl uppercase tracking-wider text-cream sm:text-3xl">
        {title}
      </h3>
    </div>
  );
}

function ItemGroup({
  label,
  items,
  selected,
  disabledIds,
  onToggle,
}: {
  label: string;
  items: Item[];
  selected: Set<string>;
  disabledIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-[0.22em] text-plonkYellow">
        {label}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {items.map((i) => {
          const isSel = selected.has(i.id);
          const isDisabled = disabledIds.includes(i.id);
          return (
            <button
              key={i.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onToggle(i.id)}
              className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                isSel
                  ? "border-nodiceRed bg-nodiceRed/10"
                  : isDisabled
                    ? "cursor-not-allowed border-cream/5 bg-white/[0.01] opacity-40"
                    : "border-cream/10 bg-white/[0.02] hover:border-cream/30"
              }`}
            >
              <span className="flex items-center gap-2.5 text-sm text-cream/90">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-md border text-[11px] ${
                    isSel
                      ? "border-nodiceRed bg-nodiceRed text-white"
                      : "border-cream/25 text-transparent"
                  }`}
                  aria-hidden
                >
                  ✓
                </span>
                {i.name}
                {i.exclusive && (
                  <span className="rounded-full bg-pong/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-pongLight">
                    all-in
                  </span>
                )}
              </span>
              <span className="whitespace-nowrap font-display text-lg text-nodiceRed">
                £{i.price}
                <span className="ml-0.5 text-[10px] font-normal uppercase tracking-wider text-cream/45">
                  /head
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-widest text-cream/50">
        {label}
        {required && <span className="text-nodiceRed"> *</span>}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream placeholder:text-cream/35 focus:border-nodiceRed focus:outline-none"
      />
    </label>
  );
}

// ── Calendar month builder (Mon-first, leading/trailing blanks) ──
function buildMonth(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // JS getDay: 0=Sun..6=Sat → convert to Mon-first index 0=Mon..6=Sun.
  const lead = (first.getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function shiftMonth(
  dir: -1 | 1,
  y: number,
  m: number,
  setY: (v: number) => void,
  setM: (v: number) => void,
) {
  let nm = m + dir;
  let ny = y;
  if (nm < 0) {
    nm = 11;
    ny -= 1;
  } else if (nm > 11) {
    nm = 0;
    ny += 1;
  }
  setY(ny);
  setM(nm);
}
