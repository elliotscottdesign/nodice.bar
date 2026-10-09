"use client";

import { useEffect, useState } from "react";

// =============================================================
// AllergenMatrix — customer-facing allergen grid for a menu
// =============================================================
// Reads the live kitchen allergen matrix (kitchen_allergen_matrix,
// the same record the kitchen edits in the On A Roll app) via the
// public anon key, filtered to one menu by its emoji prefix (🎄 =
// Christmas). Cells: ● contains · ○ may contain / trace · ⧗ checking.
// Blank = not present. Dishes the kitchen adds tonight appear here
// automatically.
// =============================================================

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://rntcujcpsozvuxvmlejv.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJudGN1amNwc296dnV4dm1sZWp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Nzk0MDIsImV4cCI6MjA5NjA1NTQwMn0.cUMy2GWme7quwDKns_sXq8OY-9SqWaIuZqhYSz3ZwrY";

// Mirrors src/kitchen/allergens.js (14 FSA allergens + mushroom).
const ALLERGENS = [
  { key: "celery", label: "Celery" },
  { key: "gluten", label: "Gluten" },
  { key: "crustaceans", label: "Crustaceans" },
  { key: "eggs", label: "Eggs" },
  { key: "fish", label: "Fish" },
  { key: "lupin", label: "Lupin" },
  { key: "milk", label: "Milk" },
  { key: "molluscs", label: "Molluscs" },
  { key: "mustard", label: "Mustard" },
  { key: "nuts", label: "Nuts" },
  { key: "peanuts", label: "Peanuts" },
  { key: "sesame", label: "Sesame" },
  { key: "soya", label: "Soya" },
  { key: "sulphites", label: "Sulphites" },
  { key: "mushroom", label: "Mushroom" },
] as const;

// Status glyphs (mirrors STATUS_META). Absent key = not present.
const CELL: Record<string, { sym: string; cls: string; title: string }> = {
  contains: { sym: "●", cls: "text-nodiceRed", title: "Contains" },
  trace: { sym: "○", cls: "text-plonkYellow", title: "May contain (trace / cross-contact)" },
  pending: { sym: "⧗", cls: "text-cream/40", title: "Still confirming" },
};

type Row = { dish: string; allergens: Record<string, string>; notes: string | null };

export default function AllergenMatrix({ menuPrefix = "🎄" }: { menuPrefix?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(
      `${SUPABASE_URL}/rest/v1/kitchen_allergen_matrix?select=dish,allergens,notes&order=dish`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      },
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Row[]) => {
        if (cancelled) return;
        setRows(
          (Array.isArray(data) ? data : []).filter((r) =>
            String(r.dish || "").trim().startsWith(menuPrefix),
          ),
        );
      })
      .catch(() => !cancelled && setRows([]));
    return () => {
      cancelled = true;
    };
  }, [menuPrefix]);

  if (rows === null) {
    return <p className="text-sm text-cream/55">Loading allergen info…</p>;
  }
  if (rows.length === 0) {
    return (
      <p className="text-sm text-cream/70">
        Full allergen information is being finalised — ask our team and we&apos;ll
        guide you to safe options.
      </p>
    );
  }

  const clean = (dish: string) => dish.replace(/^🎄\s*/, "");

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-cream/10">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-white/[0.03]">
              <th className="sticky left-0 z-10 bg-ink px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-cream/60">
                Dish
              </th>
              {ALLERGENS.map((a) => (
                <th
                  key={a.key}
                  className="px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-cream/55"
                  title={a.label}
                >
                  <span className="inline-block min-w-[2.5rem] [writing-mode:vertical-rl] rotate-180 sm:[writing-mode:horizontal-tb] sm:rotate-0">
                    {a.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.dish} className="border-t border-cream/5">
                <td className="sticky left-0 z-10 bg-ink px-4 py-3 text-sm text-cream/90">
                  {clean(r.dish)}
                </td>
                {ALLERGENS.map((a) => {
                  const status = r.allergens?.[a.key];
                  const cell = status ? CELL[status] : null;
                  return (
                    <td key={a.key} className="px-2 py-3 text-center">
                      {cell ? (
                        <span className={`text-base ${cell.cls}`} title={`${a.label} — ${cell.title}`}>
                          {cell.sym}
                        </span>
                      ) : (
                        <span className="text-cream/15">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-cream/60">
        <span><span className="text-nodiceRed">●</span> Contains</span>
        <span><span className="text-plonkYellow">○</span> May contain / trace</span>
        <span><span className="text-cream/40">⧗</span> Confirming</span>
        <span className="text-cream/45">Always tell us about allergies when you book.</span>
      </div>
    </div>
  );
}
