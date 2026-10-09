"use client";

import { useState } from "react";

// =============================================================
// XmasMenuDropdown — live Christmas menu, collapsible
// =============================================================
// A button that drops down the current Christmas menu (packages +
// à-la-carte), pulled LIVE from the On A Roll Xmas menu app — the same
// `getXmasMenu` action on the team-hub `menu` edge function that /xmas
// reads, so the kitchen edits it in one place. Fetched on first open.
// =============================================================

const MENU_FN = "https://rntcujcpsozvuxvmlejv.supabase.co/functions/v1/menu";

// Costing — mirrors /xmas and src/kitchen/XmasMenuPanel.jsx.
const num = (v: unknown) => {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};
const gcost = (g: any) =>
  num(g?.packSize) > 0 && g?.packPrice !== "" && g?.packPrice != null && g?.qtyUsed !== "" && g?.qtyUsed != null
    ? (num(g.packPrice) / num(g.packSize)) * num(g.qtyUsed)
    : num(g?.cost);
const itemCost = (it: any) => (it?.ingredients || []).reduce((s: number, g: any) => s + gcost(g), 0);
const targetPct = (it: any, settings: any) => num(settings?.targetFoodPct) || num(it?.targetPct) || 0.3;
const sellOf = (it: any, settings: any) =>
  it?.sellOverride !== "" && it?.sellOverride != null
    ? num(it.sellOverride)
    : targetPct(it, settings) > 0
      ? itemCost(it) / targetPct(it, settings)
      : 0;
const gbp = (n: number) => "£" + (n % 1 === 0 ? n.toFixed(0) : n.toFixed(2));

type Pkg = { name: string; pricePerHead: number; blurb: string; items: string[] };
type Ala = { name: string; desc: string; sell: number; board: boolean };

export default function XmasMenuDropdown() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [alacarte, setAlacarte] = useState<Ala[]>([]);
  const [err, setErr] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || loaded || loading) return;
    setLoading(true);
    setErr(false);
    try {
      const res = await fetch(MENU_FN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getXmasMenu" }),
      });
      const j = await res.json();
      const doc = j?.doc || null;
      const settings = doc?.settings ?? { targetFoodPct: 0.3 };
      const items: any[] = Array.isArray(doc?.items) ? doc.items : [];
      const byId: Record<string, any> = Object.fromEntries(items.map((it) => [it.id, it]));
      setPackages(
        (Array.isArray(doc?.packages) ? doc.packages : [])
          .filter((p: any) => p?.name)
          .map((p: any) => ({
            name: p.name,
            pricePerHead: num(p.pricePerHead),
            blurb: p.blurb || "",
            items: (p.items || []).map((x: any) => byId[x.itemId]?.name).filter(Boolean),
          })),
      );
      setAlacarte(
        items
          .filter((it) => it?.name)
          .map((it) => ({
            name: it.name,
            desc: it.desc || "",
            sell: sellOf(it, settings),
            board: num(it.portion) === 0,
          })),
      );
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }

  const hasMenu = packages.length > 0 || alacarte.length > 0;

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-nodiceRed/40 bg-nodiceRed/10 px-5 py-4 text-left transition hover:bg-nodiceRed/15"
      >
        <span className="font-display text-xl uppercase tracking-wider text-cream">
          🎄 This year&apos;s Christmas menu
        </span>
        <span
          className={`text-nodiceRed transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="mt-3 rounded-2xl border border-cream/10 bg-white/[0.02] p-5">
          {loading && (
            <p className="text-sm text-cream/55">Loading the latest menu…</p>
          )}
          {!loading && err && (
            <p className="text-sm text-cream/70">
              Couldn&apos;t load the menu just now — email{" "}
              <a className="text-nodiceRed underline" href="mailto:hello@nodice.bar">
                hello@nodice.bar
              </a>{" "}
              and we&apos;ll send it over.
            </p>
          )}
          {!loading && !err && !hasMenu && (
            <p className="text-sm text-cream/70">
              Our Christmas menu is being finalised — check back soon.
            </p>
          )}

          {!loading && !err && packages.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs font-bold uppercase tracking-[0.22em] text-plonkYellow">
                Packages
              </h4>
              <div className="mt-3 space-y-3">
                {packages.map((p) => (
                  <div key={p.name} className="rounded-xl border border-pong/30 bg-pong/[0.04] p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-display text-lg uppercase tracking-wider text-cream">
                        {p.name}
                      </span>
                      <span className="whitespace-nowrap font-display text-lg text-nodiceRed">
                        {gbp(p.pricePerHead)}
                        <span className="ml-1 text-[10px] font-normal uppercase tracking-wider text-cream/50">
                          /head
                        </span>
                      </span>
                    </div>
                    {p.blurb && <p className="mt-1.5 text-sm text-cream/70">{p.blurb}</p>}
                    {p.items.length > 0 && (
                      <p className="mt-2 text-xs text-pongLight">{p.items.join(" · ")}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && !err && alacarte.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.22em] text-plonkYellow">
                By the item
              </h4>
              <div className="mt-3 space-y-2">
                {alacarte.map((it) => (
                  <div key={it.name} className="flex items-baseline justify-between gap-4 border-b border-cream/5 pb-2">
                    <div>
                      <span className="text-sm text-cream/90">{it.name}</span>
                      {it.desc && <span className="ml-2 text-xs text-cream/50">{it.desc}</span>}
                    </div>
                    <span className="whitespace-nowrap text-sm text-nodiceRed">
                      {gbp(it.sell)}
                      <span className="ml-1 text-[10px] uppercase tracking-wider text-cream/45">
                        {it.board ? "share" : "/head"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
