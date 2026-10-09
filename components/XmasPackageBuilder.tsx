"use client";

import { useMemo, useState } from "react";

// =============================================================
// XmasPackageBuilder — pick-and-mix Christmas party enquiry
// =============================================================
// Two paths (founder spec, 9 Oct 2026):
//  • Private hire — pick a slot with a MINIMUM SPEND (£3,000 or
//    £6,000). Add packages until the running package total reaches
//    that minimum; the builder shows how much more to spend. Only
//    once the minimum is met can they send the application.
//  • No private hire — up to 40 people; no minimum, the total just
//    accrues as they add packages. Send any time.
// "Happy with my package" POSTs to the xmas-enquiry edge function,
// which emails a report to info@nodice.bar AND back to the customer.
// Enquiry only — no payment.
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

// Private-hire slots and their MINIMUM SPEND (not an extra fee — the
// packages have to add up to at least this). The minimum depends on the
// day + slot (founder schedule 9 Oct 2026): Mon–Wed 3-hour slots are
// £3k; Thu/Fri evenings and all of Sat/Sun are £7k. Each slot names its
// day so the customer self-selects and the minimum is unambiguous.
const SLOTS = [
  { id: "mw-lunch", label: "Mon–Wed · 12:00–3:00pm", min: 3000, note: "£3,000 min spend · 3 hrs" },
  { id: "mw-aft", label: "Mon–Wed · 3:30–6:30pm", min: 3000, note: "£3,000 min spend · 3 hrs" },
  { id: "mw-eve", label: "Mon–Wed · 7:00–11:00pm", min: 4000, note: "£4,000 min spend · 4 hrs" },
  { id: "thufri-eve", label: "Thu/Fri · 7:00pm–12:00am", min: 7000, note: "£7,000 min spend · free DJ" },
  { id: "sat-day", label: "Saturday · 12:00–6:30pm", min: 7000, note: "£7,000 min spend" },
  { id: "sat-eve", label: "Saturday · 7:00pm–12:00am", min: 7000, note: "£7,000 min spend · free DJ" },
  { id: "sun-day", label: "Sunday · 12:00–6:00pm", min: 7000, note: "£7,000 min spend" },
  { id: "sun-eve", label: "Sunday · 7:00pm–12:00am", min: 7000, note: "£7,000 min spend · free DJ" },
] as const;

const MAX_DATES = 4;
const MAX_HEADS_NO_HIRE = 40;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const gbp = (n: number) => `£${n.toLocaleString()}`;

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
  const [calYear, setCalYear] = useState(2026);
  const [calMonth, setCalMonth] = useState(11); // December
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
      if (prev.length >= MAX_DATES) return prev;
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
        for (const other of group) next.delete(other.id);
      } else {
        for (const other of group) if (other.exclusive) next.delete(other.id);
      }
      next.add(id);
      return next;
    });
  }

  function onHeadcountChange(v: string) {
    if (v === "") return setHeadcount("");
    let n = parseInt(v, 10);
    if (Number.isNaN(n)) return;
    if (!privateHire && n > MAX_HEADS_NO_HIRE) n = MAX_HEADS_NO_HIRE;
    setHeadcount(String(Math.max(0, n)));
  }

  const openBar = selected.has("open_bar");
  const openBuffet = selected.has("open_buffet");

  const heads = Math.max(0, parseInt(headcount || "0", 10) || 0);
  const perHead = useMemo(
    () =>
      ALL_ITEMS.filter((i) => selected.has(i.id)).reduce((s, i) => s + i.price, 0),
    [selected],
  );
  const packageTotal = perHead * heads;

  const chosenSlot = privateHire ? SLOTS.find((s) => s.id === slot) : undefined;
  const minSpend = chosenSlot?.min ?? 0;
  const remaining = Math.max(0, minSpend - packageTotal);
  const minMet = !privateHire || (!!chosenSlot && packageTotal >= minSpend);

  const detailsOk =
    name.trim() && EMAIL_RE.test(email.trim()) && heads > 0;
  const hireOk = !privateHire || (!!chosenSlot && minMet);
  const canSend = detailsOk && hireOk && state !== "sending";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setState("sending");
    setError("");
    const payload = {
      dates,
      private_hire: privateHire,
      slot: chosenSlot ? chosenSlot.label : null,
      min_spend: privateHire ? minSpend : 0,
      headcount: heads,
      items: ALL_ITEMS.filter((i) => selected.has(i.id)).map((i) => ({
        name: i.name,
        price_per_head: i.price,
      })),
      package_per_head: perHead,
      package_total: packageTotal,
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
          Package sent 🎄
        </div>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-cream/80">
          Thanks {name.trim().split(" ")[0]} — your Christmas party package is
          with the No Dice team, and a copy is on its way to your inbox. We&apos;ll
          be in touch to lock it in.
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
            Take the space privately — pick a slot below. Each has a minimum
            spend you build up to with your packages. Not private? You can book
            up to {MAX_HEADS_NO_HIRE} people with no minimum.
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

      {/* ── 3 · Numbers ─────────────────────────────── */}
      <section>
        <StepHeading n={3} title="How many people?" />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="number"
            min={1}
            max={privateHire ? undefined : MAX_HEADS_NO_HIRE}
            inputMode="numeric"
            value={headcount}
            onChange={(e) => onHeadcountChange(e.target.value)}
            placeholder="e.g. 20"
            className="w-32 rounded-xl border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream placeholder:text-cream/35 focus:border-nodiceRed focus:outline-none"
          />
          <span className="text-sm text-cream/55">
            {privateHire
              ? "guests"
              : `guests · up to ${MAX_HEADS_NO_HIRE} without private hire`}
          </span>
        </div>
      </section>

      {/* ── 4 · Packages ────────────────────────────── */}
      <section>
        <StepHeading n={4} title="Build your package" />
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

        {/* Live spend summary — min-spend tracker for private hire,
            accruing total otherwise. */}
        <div className="mt-6 rounded-2xl border border-cream/10 bg-white/[0.03] p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-cream/45">
                Your package so far
              </div>
              <div className="mt-1 font-display text-3xl text-nodiceRed">
                {gbp(packageTotal)}
              </div>
              {heads > 0 && perHead > 0 && (
                <div className="text-xs text-cream/50">
                  {gbp(perHead)}/head × {heads}
                </div>
              )}
            </div>
            {privateHire && chosenSlot && (
              <div className="text-right">
                <div className="text-xs font-bold uppercase tracking-widest text-cream/45">
                  Minimum spend
                </div>
                <div className="mt-1 font-display text-2xl text-cream">
                  {gbp(minSpend)}
                </div>
              </div>
            )}
          </div>

          {privateHire && chosenSlot && (
            <>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-cream/10">
                <div
                  className={`h-full rounded-full transition-all ${minMet ? "bg-pong" : "bg-nodiceRed"}`}
                  style={{
                    width: `${Math.min(100, minSpend ? (packageTotal / minSpend) * 100 : 0)}%`,
                  }}
                />
              </div>
              <p className={`mt-2 text-sm ${minMet ? "text-pongLight" : "text-cream/75"}`}>
                {minMet
                  ? "✓ Minimum reached — you're ready to send your package."
                  : heads > 0
                    ? `Add ${gbp(remaining)} more to reach your minimum (pick more packages, or add guests).`
                    : "Add your guest numbers and packages to build up to your minimum."}
              </p>
            </>
          )}
          {privateHire && !chosenSlot && (
            <p className="mt-3 text-sm text-cream/60">
              Pick a private-hire slot above to see your minimum spend.
            </p>
          )}
          {!privateHire && (
            <p className="mt-3 text-xs text-cream/45">
              No private-hire minimum — your total just adds up as you go. The
              team will confirm a firm quote.
            </p>
          )}
        </div>
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

      <div>
        <button
          type="submit"
          disabled={!canSend}
          className="w-full rounded-full bg-nodiceRed px-8 py-4 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-nodiceRedDeep disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          {state === "sending" ? "Sending…" : "Happy with my package →"}
        </button>
        {!canSend && state !== "sending" && (
          <p className="mt-2 text-xs text-cream/45">
            {!detailsOk
              ? "Add your name, a valid email and guest numbers to send."
              : privateHire && !chosenSlot
                ? "Pick a private-hire slot to continue."
                : privateHire && !minMet
                  ? `You're ${gbp(remaining)} short of your minimum spend.`
                  : ""}
          </p>
        )}
      </div>
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
  const lead = (first.getDay() + 6) % 7; // Mon-first
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
