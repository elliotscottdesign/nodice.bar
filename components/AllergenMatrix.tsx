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
  const [open, setOpen] = useState(false);

  // Download a print-friendly A4 sheet built from the LIVE matrix, so a
  // customer's download always reflects the current kitchen data.
  function downloadSheet() {
    if (!rows || rows.length === 0) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const esc = (s: unknown) =>
      String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const sym = (s?: string) =>
      s === "contains" ? "●" : s === "trace" ? "○" : s === "pending" ? "⧗" : "";
    const head = ALLERGENS.map((a) => `<th>${esc(a.label)}</th>`).join("");
    const body = rows
      .map((r) => {
        const cells = ALLERGENS.map(
          (a) => `<td style="text-align:center">${sym(r.allergens?.[a.key])}</td>`,
        ).join("");
        return `<tr><td style="font-weight:600">${esc(r.dish.replace(/^🎄\s*/, ""))}</td>${cells}</tr>`;
      })
      .join("");
    const today = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>No Dice — Christmas Allergen Matrix</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        body { font-family: Arial, Helvetica, sans-serif; color:#111; }
        h1 { font-size:18px; margin:0 0 2px; }
        .sub { color:#666; font-size:11px; margin:0 0 14px; }
        table { width:100%; border-collapse:collapse; font-size:11px; }
        th,td { border:1px solid #ccc; padding:5px 6px; }
        th { background:#f3f3f3; text-align:center; }
        th:first-child, td:first-child { text-align:left; }
        .legend { margin-top:10px; font-size:11px; color:#444; }
      </style></head><body>
      <h1>No Dice · Christmas Allergen Matrix</h1>
      <p class="sub">London Fields, E8 · generated ${esc(today)} · always tell us about allergies when you book</p>
      <table><thead><tr><th>Dish</th>${head}</tr></thead><tbody>${body}</tbody></table>
      <p class="legend">● Contains &nbsp;&nbsp; ○ May contain / trace &nbsp;&nbsp; ⧗ Confirming</p>
      </body></html>`,
    );
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

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
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-full border border-cream/20 bg-white/[0.03] px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-cream transition hover:bg-white/10"
        >
          {open ? "Hide allergen matrix" : "View full allergen matrix"}
          <span className={`transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>▾</span>
        </button>
        <button
          type="button"
          onClick={downloadSheet}
          className="inline-flex items-center gap-2 rounded-full bg-nodiceRed px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-nodiceRedDeep"
        >
          ⤓ Download
        </button>
      </div>

      {!open ? null : (
        <div className="mt-4">
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
      )}
    </div>
  );
}
