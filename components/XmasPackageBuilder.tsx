"use client";

import { useEffect, useMemo, useState } from "react";

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

type Item = {
  id: string;
  name: string;
  price: number;
  exclusive?: boolean;
  desc?: string;
  // Quantity items let the guest pick how many per head (e.g. drinks).
  qty?: boolean;
  // Food packages carry the list of dishes they include, shown in a dropdown.
  breakdown?: string[];
};

const DRINKS: Item[] = [
  { id: "house_drink", name: "House drink", price: 8, qty: true, desc: "Pint / single & mix / wine / bottles / softs" },
  { id: "xmas_cocktail", name: "Xmas cocktail", price: 12, qty: true, desc: "One from our Xmas seasonal menu" },
  { id: "open_bar", name: "Open Bar — house drinks", price: 70, exclusive: true },
];
const GAMES: Item[] = [
  { id: "gaming_pack", name: "Gaming pack", price: 12, desc: "Golf · tokens · pool · darts · ping pong" },
  { id: "bingo", name: "Bingo", price: 5, desc: "5 cards per person, across the event" },
  { id: "treasure_hunt", name: "Xmas treasure hunt", price: 10 },
];

// Food is driven LIVE by the On A Roll Xmas menu backend — every package the
// kitchen publishes there becomes a selectable food add-on here, with its
// dish breakdown shown in a dropdown. Prices come straight from the backend
// (pricePerHead), so new or changed packages flow through automatically.
const MENU_FN = `${SUPABASE_URL}/functions/v1/menu`;
const num = (v: unknown) => {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

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
  { id: "sat-day", label: "Saturday · 12:00–6:30pm", min: 7000, note: "£7,000 min spend · free DJ" },
  { id: "sat-eve", label: "Saturday · 7:00pm–12:00am", min: 7000, note: "£7,000 min spend · free DJ" },
  { id: "sun-day", label: "Sunday · 12:00–6:00pm", min: 7000, note: "£7,000 min spend · free DJ" },
  { id: "sun-eve", label: "Sunday · 7:00pm–12:00am", min: 7000, note: "£7,000 min spend · free DJ" },
] as const;

const MAX_DATES = 4;
const MAX_HEADS_NO_HIRE = 40;
const MAX_HEADS_HIRE = 100;
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
  // Food add-on packages, pulled live from the On A Roll Xmas backend.
  const [foodPkgs, setFoodPkgs] = useState<Item[]>([]);
  // Per-head quantity for drink items (house drink + cocktail).
  const [qty, setQty] = useState<Record<string, number>>({
    house_drink: 0,
    xmas_cocktail: 0,
  });
  const [headcount, setHeadcount] = useState("");
  // Optional budget — used on the no-private-hire path to show what's left.
  const [budget, setBudget] = useState("");
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

  // Pull the live food packages from the On A Roll Xmas menu. Each published
  // package → a food add-on, priced by the backend, with its dishes listed.
  useEffect(() => {
    let cancelled = false;
    fetch(MENU_FN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getXmasMenu" }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const doc = j?.doc || {};
        const items: any[] = Array.isArray(doc.items) ? doc.items : [];
        const byId: Record<string, any> = Object.fromEntries(
          items.map((it) => [it.id, it]),
        );
        const pkgs: Item[] = (Array.isArray(doc.packages) ? doc.packages : [])
          .filter((p: any) => p?.name)
          .map((p: any) => ({
            id: `food_${String(p.name)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "_")
              .replace(/^_|_$/g, "")}`,
            name: p.name,
            price: num(p.pricePerHead),
            desc: p.blurb || "",
            breakdown: (p.items || [])
              .map((x: any) => byId[x.itemId]?.name)
              .filter(Boolean),
          }));
        setFoodPkgs(pkgs);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
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
    const willSelect = !selected.has(id);
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
    // An exclusive pick (Open Bar) also clears the group's per-head drink
    // quantities.
    if (item.exclusive && willSelect) {
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

  // Step a drink quantity up/down. Adding a drink clears Open Bar (they're
  // exclusive within Drinks).
  function changeQty(id: string, delta: number) {
    setQty((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) }));
    if (delta > 0) {
      setSelected((prev) => {
        if (!prev.has("open_bar")) return prev;
        const n = new Set(prev);
        n.delete("open_bar");
        return n;
      });
    }
  }

  function onHeadcountChange(v: string) {
    if (v === "") return setHeadcount("");
    let n = parseInt(v, 10);
    if (Number.isNaN(n)) return;
    const cap = privateHire ? MAX_HEADS_HIRE : MAX_HEADS_NO_HIRE;
    if (n > cap) n = cap;
    setHeadcount(String(Math.max(0, n)));
  }

  const openBar = selected.has("open_bar");

  // Drinks + games + the live food packages — the full pick-and-mix set.
  const allItems = useMemo(() => [...DRINKS, ...GAMES, ...foodPkgs], [foodPkgs]);

  const heads = Math.max(0, parseInt(headcount || "0", 10) || 0);
  const perHead = useMemo(() => {
    let sum = 0;
    for (const i of allItems) {
      if (i.qty) sum += i.price * (qty[i.id] || 0);
      else if (selected.has(i.id)) sum += i.price;
    }
    return sum;
  }, [selected, qty, allItems]);
  const packageTotal = perHead * heads;
  // Budget (no-private-hire path): how much of their budget is left.
  const budgetNum = Math.max(0, parseInt(budget || "0", 10) || 0);
  const budgetLeft = budgetNum - packageTotal;
  const overBudget = budgetNum > 0 && budgetLeft < 0;

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
      budget: !privateHire ? budgetNum : 0,
      headcount: heads,
      items: [
        // Quantity drinks (× per head), then the toggled items.
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
              const on = e.target.checked;
              setPrivateHire(on);
              if (!on) {
                setSlot("");
                // Drop back to the no-hire cap if they'd gone over.
                setHeadcount((h) => {
                  const n = parseInt(h || "0", 10) || 0;
                  return n > MAX_HEADS_NO_HIRE ? String(MAX_HEADS_NO_HIRE) : h;
                });
              }
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
        <div className="mt-3 flex flex-wrap items-end gap-5">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/50">
              Guests
            </span>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={privateHire ? MAX_HEADS_HIRE : MAX_HEADS_NO_HIRE}
                inputMode="numeric"
                value={headcount}
                onChange={(e) => onHeadcountChange(e.target.value)}
                placeholder="e.g. 20"
                className="w-28 rounded-xl border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream placeholder:text-cream/35 focus:border-nodiceRed focus:outline-none"
              />
              <span className="text-xs text-cream/50">
                up to {privateHire ? MAX_HEADS_HIRE : MAX_HEADS_NO_HIRE}
              </span>
            </div>
          </label>

          {/* Budget — only on the no-private-hire path (private hire uses the
              minimum-spend tracker instead). */}
          {!privateHire && (
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-cream/50">
                What&apos;s your budget?{" "}
                <span className="text-cream/35">(optional)</span>
              </span>
              <div className="mt-1.5 flex items-center gap-1.5 rounded-xl border border-cream/15 bg-ink/40 px-3 py-3 focus-within:border-nodiceRed">
                <span className="text-cream/55">£</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-24 bg-transparent text-base text-cream placeholder:text-cream/35 focus:outline-none"
                />
              </div>
            </label>
          )}
        </div>
      </section>

      {/* ── 4 · Packages ────────────────────────────── */}
      <section>
        <StepHeading n={4} title="Build your package" />
        <p className="mt-1 text-sm text-cream/60">
          Prices are per head. Open Bar covers all house drinks. Tap a food
          package to see what&apos;s inside.
        </p>
        <div className="mt-5 space-y-6">
          <ItemGroup
            label="Drinks"
            items={DRINKS}
            selected={selected}
            disabledIds={openBar ? DRINKS.filter((i) => i.qty).map((i) => i.id) : []}
            onToggle={(id) => toggleItem(DRINKS, id)}
            qty={qty}
            onQty={changeQty}
          />
          <FoodPackageGroup
            packages={foodPkgs}
            selected={selected}
            onToggle={(id) => toggleItem(foodPkgs, id)}
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
          {!privateHire && budgetNum > 0 && (
            <>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-cream/10">
                <div
                  className={`h-full rounded-full transition-all ${overBudget ? "bg-nodiceRed" : "bg-pong"}`}
                  style={{
                    width: `${Math.min(100, (packageTotal / budgetNum) * 100)}%`,
                  }}
                />
              </div>
              <p className={`mt-2 text-sm ${overBudget ? "text-nodiceRed" : "text-pongLight"}`}>
                {overBudget
                  ? `${gbp(-budgetLeft)} over your ${gbp(budgetNum)} budget.`
                  : `${gbp(budgetLeft)} left of your ${gbp(budgetNum)} budget.`}
              </p>
            </>
          )}
          {!privateHire && budgetNum === 0 && (
            <p className="mt-3 text-xs text-cream/45">
              No private-hire minimum — your total adds up as you go. Pop in a
              budget above to track what&apos;s left. The team will confirm a
              firm quote.
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

      <p className="rounded-xl border border-pong/30 bg-pong/[0.06] px-4 py-3 text-sm leading-relaxed text-pongLight">
        When confirmed, a final food-ordering link will be sent to you — no need
        for menu selections today.
      </p>

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
  qty,
  onQty,
}: {
  label: string;
  items: Item[];
  selected: Set<string>;
  disabledIds: string[];
  onToggle: (id: string) => void;
  qty?: Record<string, number>;
  onQty?: (id: string, delta: number) => void;
}) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-[0.22em] text-plonkYellow">
        {label}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {items.map((i) => {
          const isDisabled = disabledIds.includes(i.id);

          // Quantity item → stepper (how many per head).
          if (i.qty && qty && onQty) {
            const n = qty[i.id] || 0;
            const active = n > 0 && !isDisabled;
            return (
              <div
                key={i.id}
                className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                  active
                    ? "border-nodiceRed bg-nodiceRed/10"
                    : isDisabled
                      ? "border-cream/5 bg-white/[0.01] opacity-40"
                      : "border-cream/10 bg-white/[0.02]"
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-sm text-cream/90">{i.name}</span>
                  {i.desc && (
                    <span className="block text-[11px] text-cream/45">{i.desc}</span>
                  )}
                  <span className="text-[11px] text-cream/50">£{i.price}/head each</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    aria-label={`One fewer ${i.name}`}
                    disabled={isDisabled || n === 0}
                    onClick={() => onQty(i.id, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-cream/25 text-lg text-cream transition hover:border-cream/50 disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-5 text-center font-display text-lg text-cream">{n}</span>
                  <button
                    type="button"
                    aria-label={`One more ${i.name}`}
                    disabled={isDisabled}
                    onClick={() => onQty(i.id, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-cream/25 text-lg text-cream transition hover:border-cream/50 disabled:opacity-30"
                  >
                    +
                  </button>
                </span>
              </div>
            );
          }

          // Toggle item.
          const isSel = selected.has(i.id);
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
              <span className="flex items-start gap-2.5 text-sm text-cream/90">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] ${
                    isSel
                      ? "border-nodiceRed bg-nodiceRed text-white"
                      : "border-cream/25 text-transparent"
                  }`}
                  aria-hidden
                >
                  ✓
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    {i.name}
                    {i.exclusive && (
                      <span className="rounded-full bg-pong/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-pongLight">
                        all-in
                      </span>
                    )}
                  </span>
                  {i.desc && (
                    <span className="block text-[11px] text-cream/45">{i.desc}</span>
                  )}
                </span>
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

// Food packages come live from the On A Roll backend. Each is a selectable
// pill with a dropdown revealing its dishes (works the same on phone + desktop
// — an inline disclosure, not a native select). Selecting the pill adds it to
// the package; the "what's included" row just expands the breakdown.
function FoodPackageGroup({
  packages,
  selected,
  onToggle,
}: {
  packages: Item[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggleOpen = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-[0.22em] text-plonkYellow">
        Food
      </div>
      {packages.length === 0 ? (
        <p className="mt-2 text-sm text-cream/55">
          Our festive food packages are being finalised — check back soon, or
          add a note below and we&apos;ll build the food around you.
        </p>
      ) : (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {packages.map((p) => {
            const isSel = selected.has(p.id);
            const isOpen = open.has(p.id);
            const hasDetail = (p.breakdown && p.breakdown.length > 0) || !!p.desc;
            return (
              <div
                key={p.id}
                className={`overflow-hidden rounded-2xl border transition ${
                  isSel
                    ? "border-nodiceRed bg-nodiceRed/10"
                    : "border-cream/10 bg-white/[0.02]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onToggle(p.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="flex items-start gap-2.5 text-sm text-cream/90">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] ${
                        isSel
                          ? "border-nodiceRed bg-nodiceRed text-white"
                          : "border-cream/25 text-transparent"
                      }`}
                      aria-hidden
                    >
                      ✓
                    </span>
                    <span className="min-w-0 font-medium">{p.name}</span>
                  </span>
                  <span className="whitespace-nowrap font-display text-lg text-nodiceRed">
                    {p.price > 0 ? (
                      <>
                        £{p.price}
                        <span className="ml-0.5 text-[10px] font-normal uppercase tracking-wider text-cream/45">
                          /head
                        </span>
                      </>
                    ) : (
                      <span className="text-xs font-normal uppercase tracking-wider text-cream/45">
                        Price TBC
                      </span>
                    )}
                  </span>
                </button>

                {hasDetail && (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleOpen(p.id)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center gap-1.5 border-t border-cream/10 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-plonkYellow transition hover:bg-white/[0.03]"
                    >
                      {isOpen ? "Hide" : "See what's included"}
                      <span
                        className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                        aria-hidden
                      >
                        ▾
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-3.5 pt-0.5">
                        {p.desc && (
                          <p className="mb-2 text-xs italic leading-relaxed text-cream/60">
                            {p.desc}
                          </p>
                        )}
                        {p.breakdown && p.breakdown.length > 0 && (
                          <ul className="space-y-1">
                            {p.breakdown.map((dish) => (
                              <li
                                key={dish}
                                className="flex gap-2 text-xs text-cream/80"
                              >
                                <span className="text-plonkYellow" aria-hidden>
                                  ·
                                </span>
                                <span>{dish}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
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
