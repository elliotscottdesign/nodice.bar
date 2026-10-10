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
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://rntcujcpsozvuxvmlejv.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJudGN1amNwc296dnV4dm1sZWp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Nzk0MDIsImV4cCI6MjA5NjA1NTQwMn0.cUMy2GWme7quwDKns_sXq8OY-9SqWaIuZqhYSz3ZwrY";
const allergenLabel = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);

const num = (v: unknown) => {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};
// Focal-point percentage (object-position), centre (50) when unset.
const posN = (v: unknown) => {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 50;
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

type Pkg = { name: string; pricePerHead: number; blurb: string; items: string[]; image: string; imageX: number; imageY: number };
type Ala = { name: string; desc: string; sell: number; board: boolean };

export default function XmasMenuTab() {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [alacarte, setAlacarte] = useState<Ala[]>([]);
  // Per-dish allergens from the kitchen matrix, keyed by lower-cased dish
  // name (🎄 prefix stripped) so we can show markers under each item.
  const [allergens, setAllergens] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    let cancelled = false;
    fetch(
      `${SUPABASE_URL}/rest/v1/kitchen_allergen_matrix?select=dish,allergens`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } },
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Array<{ dish: string; allergens: Record<string, string> }>) => {
        if (cancelled) return;
        const map: Record<string, Record<string, string>> = {};
        for (const r of Array.isArray(rows) ? rows : []) {
          const d = String(r.dish || "").trim();
          if (!d.startsWith("🎄")) continue;
          map[d.replace(/^🎄\s*/, "").toLowerCase()] = r.allergens || {};
        }
        setAllergens(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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
              image: p.image || p.heroImage || "",
              imageX: posN(p.imageX),
              imageY: posN(p.imageY),
              items: (p.items || []).map((x: any) => byId[x.itemId]?.name).filter(Boolean),
            }))
            .sort((a: Pkg, b: Pkg) => (a.pricePerHead || Infinity) - (b.pricePerHead || Infinity)),
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
          {/* Packages — the festive food bundles (same ones that drive the
              package builder on the previous tab). Breakdown shown, no prices
              (those live in the builder). */}
          {packages.length > 0 && (
            <div>
              <h3 className="text-center font-display text-3xl uppercase tracking-wider text-cream sm:text-4xl">
                Festive food packages
              </h3>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {packages.map((p) => (
                  <div key={p.name} className="overflow-hidden rounded-2xl border border-pong/40 bg-pong/[0.04] text-center">
                    {p.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image}
                        alt={p.name}
                        className="aspect-[16/9] w-full object-cover"
                        style={{ objectPosition: `${p.imageX ?? 50}% ${p.imageY ?? 50}%` }}
                        loading="lazy"
                      />
                    )}
                    <div className="p-5">
                    <span className="font-display text-xl uppercase tracking-wider text-cream">
                      {p.name}
                    </span>
                    {p.blurb && <p className="mt-2 text-sm text-cream/70">{p.blurb}</p>}
                    {p.items.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {p.items.map((dish) => (
                          <li key={dish} className="flex justify-center gap-2 text-sm text-cream/85">
                            <span className="text-pongLight" aria-hidden>·</span>
                            <span>{dish}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    </div>
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
                className="text-center font-display text-5xl uppercase tracking-wider text-cream sm:text-6xl"
              />
              <EditableText
                as="p"
                k="xmas.menutab.alacarte_sub"
                fallback="Build your own spread."
                className="mt-2 text-center text-sm text-cream/60"
              />
              <div className="mt-7 space-y-9">
                {alacarte.map((it) => (
                  <div
                    key={it.name}
                    className="border-b border-dotted border-cream/25 pb-9 text-center"
                  >
                    <div className="font-display text-2xl normal-case tracking-normal text-cream sm:text-3xl">
                      {`  —  ${it.name}  —  `}
                    </div>
                    {it.desc && (
                      <div className="mx-auto mt-1.5 max-w-2xl text-sm leading-relaxed text-cream/90 sm:text-base">
                        {it.desc}
                      </div>
                    )}
                    {/* Live allergen markers from the kitchen matrix. */}
                    {(() => {
                      const a = allergens[it.name.trim().toLowerCase()];
                      if (!a) return null;
                      const marks = Object.entries(a).filter(
                        ([, s]) => s === "contains" || s === "trace",
                      );
                      if (marks.length === 0) return null;
                      return (
                        <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
                          {marks.map(([key, status]) => (
                            <span
                              key={key}
                              className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                                status === "trace"
                                  ? "border-plonkYellow/30 text-plonkYellow/70"
                                  : "border-cream/25 text-cream/55"
                              }`}
                              title={status === "trace" ? "May contain" : "Contains"}
                            >
                              {allergenLabel(key)}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
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
          <div className="text-center">
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
