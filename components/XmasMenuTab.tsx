"use client";

import { useEffect, useState } from "react";
import MediaStrip from "./MediaStrip";
import AllergenMatrix from "./AllergenMatrix";
import EditableText from "./EditableText";

// =============================================================
// XmasMenuTab — the "Xmas menu" view on /privatehire
// =============================================================
// Festive food image scroller + the live Christmas menu (packages +
// à-la-carte, WITH prices) pulled from the On A Roll Xmas menu app,
// plus the live allergen matrix. All driven by the kitchen's own
// tools so it stays current.
// =============================================================

const MENU_FN = "https://rntcujcpsozvuxvmlejv.supabase.co/functions/v1/menu";

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

export default function XmasMenuTab() {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [alacarte, setAlacarte] = useState<Ala[]>([]);

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
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      {/* Food image scroller — shared gallery + heading with /xmas. */}
      <MediaStrip
        galleryKey="xmas.menu"
        heading="This year's festive menu"
        intro="A taste of what's on — swipe through."
        headingKey="xmas.menu_heading"
        introKey="xmas.menu_intro"
        blankLabel="Menu photo"
        aspect="4 / 3"
        blankCount={5}
      />

      <section className="px-6 py-10">
        <div className="mx-auto max-w-3xl space-y-12">
          {/* Packages */}
          {packages.length > 0 && (
            <div>
              <h3 className="font-display text-3xl uppercase tracking-wider text-cream sm:text-4xl">
                Party packages
              </h3>
              <p className="mt-2 text-sm text-cream/60">Per head · minimum numbers may apply</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {packages.map((p) => (
                  <div key={p.name} className="rounded-2xl border border-pong/40 bg-pong/[0.04] p-5">
                    <span className="font-display text-xl uppercase tracking-wider text-cream">
                      {p.name}
                    </span>
                    {p.blurb && <p className="mt-2 text-sm text-cream/70">{p.blurb}</p>}
                    {p.items.length > 0 && (
                      <p className="mt-3 text-xs text-pongLight">{p.items.join(" · ")}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* À la carte */}
          {alacarte.length > 0 && (
            <div>
              <EditableText
                as="h3"
                k="xmas.menutab.alacarte_heading"
                fallback="Christmessy menu"
                className="text-center font-display text-3xl uppercase tracking-wider text-cream sm:text-4xl"
              />
              <EditableText
                as="p"
                k="xmas.menutab.alacarte_sub"
                fallback="Build your own spread."
                className="mt-2 text-center text-sm text-cream/60"
              />
              <div className="mt-5 space-y-3">
                {alacarte.map((it) => (
                  <div
                    key={it.name}
                    className="border-b border-dotted border-cream/25 pb-4 text-center"
                  >
                    <div className="font-display text-2xl normal-case tracking-normal text-cream sm:text-3xl">
                      {it.name}
                    </div>
                    {it.desc && (
                      <div className="mx-auto mt-1 max-w-xl text-xs leading-relaxed text-cream/50">
                        {it.desc}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && packages.length === 0 && alacarte.length === 0 && (
            <p className="text-center text-sm text-cream/60">
              Our Christmas menu is being finalised — check back soon.
            </p>
          )}

          {/* Allergen matrix */}
          <div>
            <h3 className="font-display text-3xl uppercase tracking-wider text-cream sm:text-4xl">
              Allergens
            </h3>
            <p className="mb-5 mt-2 text-sm text-cream/60">
              Live from our kitchen. Always tell us about allergies when you book.
            </p>
            <AllergenMatrix menuPrefix="🎄" />
          </div>
        </div>
      </section>
    </div>
  );
}
