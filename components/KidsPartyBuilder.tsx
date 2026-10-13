"use client";

import { useEffect, useMemo, useState } from "react";

// =============================================================
// KidsPartyBuilder — pick-and-mix kids' party enquiry
// =============================================================
// Same machine as the Xmas builder, for kids' parties: pick a
// DATE + TIME SLOT, how many children, an optional budget, then
// mix GAMES, DRINKS and FOOD (all driven live from the OFFICE
// "Kids Party" editor, /ops → Office), add contact details and
// send. "Send my party" POSTs to the xmas-enquiry edge function
// (party_type: "kids"), which emails info@nodice.bar AND the
// customer. Enquiry only — no payment, no minimum spend.
// =============================================================

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://rntcujcpsozvuxvmlejv.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const ENQUIRY_FN_URL = `${SUPABASE_URL}/functions/v1/xmas-enquiry`;
const PKG_FN_URL = `${SUPABASE_URL}/functions/v1/xmas-packages`;

type Item = {
  id: string;
  name: string;
  price: number;
  exclusive?: boolean;
  desc?: string;
  qty?: boolean;
  note?: boolean;
  image?: string;
  imageX?: number;
  imageY?: number;
  imageZoom?: number;
};

// Fallbacks (mirror KIDS_DEFAULT_DOC in the team hub) — used until the backend
// loads, or if it's ever empty/unreachable, so the builder is never blank.
const FALLBACK_GAMES: Item[] = [
  { id: "kids_games_pack", name: "Games pack", price: 8, desc: "Golf · pool · ping pong — supervised" },
  { id: "kids_treasure", name: "Treasure hunt", price: 6, desc: "Around the venue, prizes for the winners" },
  { id: "kids_karaoke", name: "Karaoke", price: 5 },
  { id: "kids_face_paint", name: "Face painting", price: 7, desc: "Professional face painter" },
];
const FALLBACK_DRINKS: Item[] = [
  { id: "kids_soft", name: "Soft drink", price: 2, desc: "Juice / squash / soft can", qty: true },
  { id: "kids_bottomless", name: "Bottomless soft drinks", price: 6, desc: "Unlimited squash & softs all party", exclusive: true },
  { id: "kids_adult_drink", name: "Grown-up drink", price: 7, desc: "Tea / coffee / soft / house drink for parents", qty: true },
];
const FALLBACK_FOOD: Item[] = [
  { id: "kids_platter", name: "Kids party platter", price: 9, desc: "Mini burgers, fries, veg sticks & dip" },
  { id: "kids_pizza", name: "Make-your-own pizza", price: 11, desc: "Each child tops their own" },
  { id: "kids_cake", name: "Birthday cake", price: 4, desc: "Candles + a slice for everyone" },
  { id: "kids_grazing", name: "Grown-up grazing board", price: 12, desc: "For the parents" },
];
const FALLBACK_NOTES: Item[] = [
  { id: "kids_host_note", name: "🎉 A party host is included with every booking", price: 0, note: true },
];

// Party time slots (2-hour sittings). Simple fixed list — the kids party is a
// set sitting, not a min-spend private hire.
const TIME_SLOTS = [
  "11:00am – 1:00pm",
  "1:30pm – 3:30pm",
  "4:00pm – 6:00pm",
];

const MAX_DATES = 3;
const MAX_HEADS = 40;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const gbp = (n: number) => `£${n.toLocaleString()}`;
const num = (v: unknown) => {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};
const posN = (v: unknown) => {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 50;
};
const zoomN = (v: unknown) => {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? Math.min(2.5, Math.max(1, n)) : 1;
};

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
  if (nm < 0) { nm = 11; ny -= 1; }
  else if (nm > 11) { nm = 0; ny += 1; }
  setY(ny);
  setM(nm);
}

export default function KidsPartyBuilder() {
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [dates, setDates] = useState<string[]>([]);
  const [time, setTime] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qty, setQty] = useState<Record<string, number>>({});
  const [headcount, setHeadcount] = useState("");
  const [budget, setBudget] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("");
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  // Live options from the OFFICE Kids Party editor (fallbacks until loaded).
  const [games, setGames] = useState<Item[]>(FALLBACK_GAMES);
  const [drinks, setDrinks] = useState<Item[]>(FALLBACK_DRINKS);
  const [food, setFood] = useState<Item[]>(FALLBACK_FOOD);
  const [infoNotes, setInfoNotes] = useState<Item[]>(FALLBACK_NOTES);
  const [gamesLabel, setGamesLabel] = useState("Games");
  const [drinksLabel, setDrinksLabel] = useState("Drinks");
  const [foodLabel, setFoodLabel] = useState("Food");

  const minIso = todayIso();

  useEffect(() => {
    let cancelled = false;
    fetch(PKG_FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get", slug: "kids" }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const data = j?.data;
        const opts: any[] = Array.isArray(data?.options) ? data.options : [];
        if (opts.length === 0) return; // keep fallbacks
        const toItem = (o: any): Item => ({
          id: String(o.id),
          name: String(o.name ?? ""),
          price: num(o.price),
          desc: o.desc || "",
          qty: !!o.qty,
          exclusive: !!o.exclusive,
          note: !!o.note,
          image: o.image || "",
          imageX: posN(o.imageX),
          imageY: posN(o.imageY),
          imageZoom: zoomN(o.imageZoom),
        });
        setGames(opts.filter((o) => o.category === "games" && !o.note).map(toItem));
        setDrinks(opts.filter((o) => o.category === "drinks" && !o.note).map(toItem));
        setFood(opts.filter((o) => o.category === "food" && !o.note).map(toItem));
        setInfoNotes(opts.filter((o) => o.note).map(toItem));
        if (data?.categories?.games?.label) setGamesLabel(String(data.categories.games.label));
        if (data?.categories?.drinks?.label) setDrinksLabel(String(data.categories.drinks.label));
        if (data?.categories?.food?.label) setFoodLabel(String(data.categories.food.label));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

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
      if (next.has(id)) { next.delete(id); return next; }
      if (item.exclusive) {
        for (const other of group) next.delete(other.id);
      } else {
        for (const other of group) if (other.exclusive) next.delete(other.id);
      }
      next.add(id);
      return next;
    });
    if (item.exclusive) {
      const qtyIds = group.filter((g) => g.qty).map((g) => g.id);
      if (qtyIds.length) {
        setQty((q) => {
          const nq = { ...q };
          for (const qid of qtyIds) nq[qid] = 0;
          return nq;
        });
      }
    }
  }

  function changeQty(group: Item[], id: string, delta: number) {
    setQty((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) }));
    if (delta > 0) {
      const exclusiveIds = group.filter((g) => g.exclusive).map((g) => g.id);
      setSelected((prev) => {
        if (!exclusiveIds.some((x) => prev.has(x))) return prev;
        const n = new Set(prev);
        for (const x of exclusiveIds) n.delete(x);
        return n;
      });
    }
  }

  function onHeadcountChange(v: string) {
    if (v === "") return setHeadcount("");
    let n = parseInt(v, 10);
    if (Number.isNaN(n)) return;
    if (n > MAX_HEADS) n = MAX_HEADS;
    setHeadcount(String(Math.max(0, n)));
  }

  const allItems = useMemo(() => [...games, ...drinks, ...food], [games, drinks, food]);
  const heads = Math.max(0, parseInt(headcount || "0", 10) || 0);
  const perHead = useMemo(() => {
    let sum = 0;
    for (const i of allItems) {
      if (i.qty) sum += i.price * (qty[i.id] || 0);
      else if (selected.has(i.id)) sum += i.price;
    }
    return sum;
  }, [selected, qty, allItems]);
  const partyTotal = perHead * heads;
  const budgetNum = Math.max(0, parseInt(budget || "0", 10) || 0);
  const budgetLeft = budgetNum - partyTotal;
  const overBudget = budgetNum > 0 && budgetLeft < 0;

  const detailsOk = name.trim() && EMAIL_RE.test(email.trim()) && heads > 0;
  const canSend = detailsOk && state !== "sending";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setState("sending");
    setError("");
    const payload = {
      party_type: "kids",
      dates,
      time: time || null,
      budget: budgetNum,
      headcount: heads,
      child_name: childName.trim(),
      child_age: childAge.trim(),
      items: [
        ...allItems.filter((i) => i.qty && (qty[i.id] || 0) > 0).map((i) => ({
          name: `${i.name} × ${qty[i.id]}`,
          price_per_head: i.price * (qty[i.id] || 0),
        })),
        ...allItems.filter((i) => !i.qty && selected.has(i.id)).map((i) => ({
          name: i.name,
          price_per_head: i.price,
        })),
      ],
      package_per_head: perHead,
      package_total: partyTotal,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
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
        err instanceof Error ? err.message : "Something went wrong — email hello@nodice.bar instead.",
      );
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-2xl border border-pong/40 bg-pong/[0.08] p-8 text-center">
        <div className="font-display text-3xl uppercase tracking-wider text-cream">
          Party sent 🎈
        </div>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-cream/80">
          Thanks {name.trim().split(" ")[0]} — your kids&apos; party plan is with the
          No Dice team, and a copy is on its way to your inbox. We&apos;ll be in touch
          to confirm availability and send a firm quote.
        </p>
      </div>
    );
  }

  const weeks = buildMonth(calYear, calMonth);

  return (
    <form onSubmit={submit} className="space-y-10">
      {/* 1 · Dates */}
      <section>
        <StepHeading n={1} title="Pick your dates" />
        <p className="mt-1 text-center text-sm text-cream/60">
          Choose up to {MAX_DATES} options that work — we&apos;ll confirm availability.
        </p>
        <div className="mx-auto mt-4 max-w-sm rounded-2xl border border-cream/10 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <button type="button" aria-label="Previous month"
              onClick={() => shiftMonth(-1, calYear, calMonth, setCalYear, setCalMonth)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-cream/20 text-cream transition hover:border-cream/50">‹</button>
            <div className="font-display text-lg text-cream">{MONTHS[calMonth]} {calYear}</div>
            <button type="button" aria-label="Next month"
              onClick={() => shiftMonth(1, calYear, calMonth, setCalYear, setCalMonth)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-cream/20 text-cream transition hover:border-cream/50">›</button>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-cream/40">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i}>{d}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {weeks.map((d, i) => {
              if (d === null) return <div key={i} />;
              const ds = iso(calYear, calMonth, d);
              const past = ds < minIso;
              const on = dates.includes(ds);
              return (
                <button key={i} type="button" disabled={past}
                  onClick={() => toggleDate(ds)}
                  className={`aspect-square rounded-lg text-sm transition ${
                    on ? "bg-[#F97316] text-white"
                    : past ? "cursor-not-allowed text-cream/15"
                    : "text-cream/80 hover:bg-white/10"}`}>{d}</button>
              );
            })}
          </div>
        </div>
        {dates.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {dates.map((d) => (
              <span key={d} className="inline-flex items-center gap-1.5 rounded-full border border-[#F97316]/40 bg-[#F97316]/10 px-3 py-1 text-xs text-cream">
                {prettyDate(d)}
                <button type="button" aria-label={`Remove ${d}`} onClick={() => toggleDate(d)} className="text-cream/60 hover:text-cream">×</button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 2 · Time */}
      <section>
        <StepHeading n={2} title="Pick a time" />
        <p className="mt-1 text-center text-sm text-cream/60">
          Parties run as a 2-hour sitting. Choose the slot you&apos;d like.
        </p>
        <div className="mx-auto mt-4 grid max-w-xl gap-2 sm:grid-cols-3">
          {TIME_SLOTS.map((t) => (
            <button key={t} type="button" onClick={() => setTime(t)}
              className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                time === t ? "border-[#F97316] bg-[#F97316]/10 text-cream"
                : "border-cream/10 bg-white/[0.02] text-cream/80 hover:border-cream/30"}`}>{t}</button>
          ))}
        </div>
      </section>

      {/* 3 · People + birthday age + budget */}
      <section>
        <StepHeading n={3} title="How many children?" />
        <div className="mx-auto mt-4 grid max-w-2xl gap-3 sm:grid-cols-3">
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-cream/10 bg-white/[0.02] px-5 py-4">
            <span className="text-sm text-cream/70">Children</span>
            <input inputMode="numeric" value={headcount} onChange={(e) => onHeadcountChange(e.target.value)} placeholder="e.g. 12"
              className="w-16 bg-transparent text-right text-base text-cream placeholder:text-cream/35 focus:outline-none" />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-cream/10 bg-white/[0.02] px-5 py-4">
            <span className="text-sm text-cream/70">Birthday age</span>
            <input inputMode="numeric" value={childAge} onChange={(e) => setChildAge(e.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 7"
              className="w-16 bg-transparent text-right text-base text-cream placeholder:text-cream/35 focus:outline-none" />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-cream/10 bg-white/[0.02] px-5 py-4">
            <span className="text-sm text-cream/70">Budget <span className="text-cream/40">(opt)</span></span>
            <div className="flex items-center gap-1">
              <span className="text-cream/50">£</span>
              <input inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ""))} placeholder="300"
                className="w-16 bg-transparent text-base text-cream placeholder:text-cream/35 focus:outline-none" />
            </div>
          </label>
        </div>
        <p className="mx-auto mt-3 max-w-2xl text-center text-xs text-cream/50">
          Parties start from age 6 and up.
        </p>
      </section>

      {/* 4 · Build */}
      <section>
        <StepHeading n={4} title="Build your party" />
        <p className="mt-1 text-center text-sm text-cream/60">
          Prices are per head. Tap to add games, drinks and food.
        </p>
        <div className="mt-5 space-y-6">
          <ItemGroup label={gamesLabel} items={games} selected={selected} disabledIds={[]} onToggle={(id) => toggleItem(games, id)} qty={qty} onQty={(id, d) => changeQty(games, id, d)} />
          <ItemGroup label={drinksLabel} items={drinks} selected={selected}
            disabledIds={drinks.some((d) => d.exclusive && selected.has(d.id)) ? drinks.filter((i) => i.qty).map((i) => i.id) : []}
            onToggle={(id) => toggleItem(drinks, id)} qty={qty} onQty={(id, d) => changeQty(drinks, id, d)} />
          <ItemGroup label={foodLabel} items={food} selected={selected} disabledIds={[]} onToggle={(id) => toggleItem(food, id)} qty={qty} onQty={(id, d) => changeQty(food, id, d)} />
          {infoNotes.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {infoNotes.map((nItem) => (
                <span key={nItem.id} className="inline-flex items-center gap-2 rounded-full border border-pong/40 bg-pong/[0.08] px-4 py-2 text-xs font-bold uppercase tracking-wider text-pongLight">
                  {nItem.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Running total */}
        <div className="mt-6 rounded-2xl border border-cream/10 bg-white/[0.03] p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-cream/45">Your party so far</div>
              <div className="mt-1 font-display text-3xl text-[#F97316]">{gbp(partyTotal)}</div>
              {heads > 0 && perHead > 0 && (
                <div className="text-xs text-cream/50">{gbp(perHead)}/head × {heads}</div>
              )}
            </div>
            {budgetNum > 0 && (
              <div className="text-right">
                <div className="text-xs font-bold uppercase tracking-widest text-cream/45">
                  {overBudget ? "Over budget" : "Budget left"}
                </div>
                <div className={`mt-1 font-display text-2xl ${overBudget ? "text-[#F97316]" : "text-pongLight"}`}>
                  {gbp(Math.abs(budgetLeft))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 5 · Details */}
      <section>
        <StepHeading n={5} title="Your details" />
        <div className="mx-auto mt-4 grid max-w-xl gap-3 sm:grid-cols-2">
          <Field label="Your name" value={name} onChange={setName} required />
          <Field label="Email" value={email} onChange={setEmail} type="email" required />
          <Field label="Phone" value={phone} onChange={setPhone} type="tel" />
          <Field label="Birthday child's name" value={childName} onChange={setChildName} />
        </div>
        <label className="mx-auto mt-3 block max-w-xl">
          <span className="text-xs font-bold uppercase tracking-widest text-cream/50">Anything else?</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            placeholder="Allergies, themes, special requests…"
            className="mt-1.5 w-full rounded-xl border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream placeholder:text-cream/35 focus:border-[#F97316] focus:outline-none" />
        </label>

        {error && <p className="mx-auto mt-4 max-w-xl text-center text-sm text-[#F97316]">{error}</p>}

        <div className="mx-auto mt-5 max-w-xl">
          <button type="submit" disabled={!canSend}
            className={`w-full rounded-2xl px-6 py-4 font-display text-xl uppercase tracking-wider transition ${
              canSend ? "bg-[#F97316] text-white hover:bg-[#F97316]/90"
              : "cursor-not-allowed bg-white/10 text-cream/40"}`}>
            {state === "sending" ? "Sending…" : "Send my party 🎈"}
          </button>
          {!detailsOk && (
            <p className="mt-2 text-center text-xs text-cream/45">Add your name, a valid email and how many children to send.</p>
          )}
          <p className="mt-2 text-center text-xs text-cream/45">This is an enquiry, not a confirmed booking — we&apos;ll be in touch to lock it in.</p>
        </div>
      </section>
    </form>
  );
}

function StepHeading({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F97316] font-display text-base text-white">{n}</span>
      <h3 className="font-display text-xl uppercase tracking-wider text-cream sm:text-2xl">{title}</h3>
    </div>
  );
}

// Optional square thumbnail — cropped with the same focal point + zoom as the site.
function ItemThumb({ i }: { i: Item }) {
  if (!i.image) return null;
  return (
    <span className="block h-12 w-12 shrink-0 overflow-hidden rounded-lg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={i.image} alt="" className="h-full w-full object-cover" loading="lazy"
        style={{
          objectPosition: `${i.imageX ?? 50}% ${i.imageY ?? 50}%`,
          transform: (i.imageZoom ?? 1) !== 1 ? `scale(${i.imageZoom})` : undefined,
          transformOrigin: `${i.imageX ?? 50}% ${i.imageY ?? 50}%`,
        }} />
    </span>
  );
}

function ItemGroup({
  label, items, selected, disabledIds, onToggle, qty, onQty,
}: {
  label: string;
  items: Item[];
  selected: Set<string>;
  disabledIds: string[];
  onToggle: (id: string) => void;
  qty?: Record<string, number>;
  onQty?: (id: string, delta: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-center text-lg font-bold uppercase tracking-[0.22em] text-[#F97316] sm:text-xl">{label}</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {items.map((i) => {
          const isDisabled = disabledIds.includes(i.id);
          if (i.qty && qty && onQty) {
            const n = qty[i.id] || 0;
            const active = n > 0 && !isDisabled;
            return (
              <div key={i.id} className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                active ? "border-[#F97316] bg-[#F97316]/10"
                : isDisabled ? "border-cream/5 bg-white/[0.01] opacity-40"
                : "border-cream/10 bg-white/[0.02]"}`}>
                <span className="flex min-w-0 items-center gap-3">
                  <ItemThumb i={i} />
                  <span className="min-w-0">
                    <span className="block text-sm text-cream/90">{i.name}</span>
                    {i.desc && <span className="block text-[11px] text-cream/45">{i.desc}</span>}
                    <span className="text-[11px] text-cream/50">£{i.price}/head each</span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <button type="button" aria-label={`One fewer ${i.name}`} disabled={isDisabled || n === 0} onClick={() => onQty(i.id, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-cream/25 text-lg text-cream transition hover:border-cream/50 disabled:opacity-30">−</button>
                  <span className="w-5 text-center font-display text-lg text-cream">{n}</span>
                  <button type="button" aria-label={`One more ${i.name}`} disabled={isDisabled} onClick={() => onQty(i.id, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-cream/25 text-lg text-cream transition hover:border-cream/50 disabled:opacity-30">+</button>
                </span>
              </div>
            );
          }
          const isSel = selected.has(i.id);
          return (
            <button key={i.id} type="button" disabled={isDisabled} onClick={() => onToggle(i.id)}
              className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                isSel ? "border-[#F97316] bg-[#F97316]/10"
                : isDisabled ? "cursor-not-allowed border-cream/5 bg-white/[0.01] opacity-40"
                : "border-cream/10 bg-white/[0.02] hover:border-cream/30"}`}>
              <span className="flex items-start gap-2.5 text-sm text-cream/90">
                <ItemThumb i={i} />
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] ${
                  isSel ? "border-[#F97316] bg-[#F97316] text-white" : "border-cream/25 text-transparent"}`} aria-hidden>✓</span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    {i.name}
                    {i.exclusive && (
                      <span className="rounded-full bg-pong/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-pongLight">all-in</span>
                    )}
                  </span>
                  {i.desc && <span className="block text-[11px] text-cream/45">{i.desc}</span>}
                </span>
              </span>
              <span className="whitespace-nowrap font-display text-lg text-[#F97316]">
                £{i.price}
                <span className="ml-0.5 text-[10px] font-normal uppercase tracking-wider text-cream/45">/head</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", required = false,
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
        {label}{required && <span className="text-[#F97316]"> *</span>}
      </span>
      <input type={type} value={value} required={required} onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream placeholder:text-cream/35 focus:border-[#F97316] focus:outline-none" />
    </label>
  );
}
