"use client";

import { useMemo, useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import { generateBatch, type BingoCard } from "@/lib/bingo/cards";

const PINK = "#e878f0";

// Build one card's print HTML (3×9 grid, blanks empty, big bold numbers).
function cardHtml(card: BingoCard, serial: string): string {
  const rows = card
    .map(
      (row) =>
        `<tr>${row
          .map((n) =>
            n == null
              ? `<td class="blank"></td>`
              : `<td>${n}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  return `
  <div class="card">
    <div class="chead">
      <span class="brand">NO DICE</span>
      <span class="sub">COMEDY &amp; BINGO</span>
      <span class="serial">${serial}</span>
    </div>
    <table class="grid">${rows}</table>
  </div>`;
}

// A whole self-contained printable document (no site CSS/fonts in the new
// window, so everything is inlined + web-safe fonts).
function buildPrintDoc(cards: BingoCard[], perPage: number): string {
  const pages: string[] = [];
  for (let i = 0; i < cards.length; i += perPage) {
    const chunk = cards.slice(i, i + perPage);
    const cardsHtml = chunk
      .map((c, j) => cardHtml(c, `#${String(i + j + 1).padStart(3, "0")}`))
      .join("");
    pages.push(`<div class="page cols-${perPage}">${cardsHtml}</div>`);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>No Dice bingo cards</title>
  <style>
    * { box-sizing: border-box; }
    html,body { margin:0; padding:0; background:#fff; color:#111;
      font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    @page { size: A4 portrait; margin: 10mm; }
    .page { display:grid; gap:8mm; }
    .page.cols-2 { grid-template-columns:1fr; }
    .page.cols-4 { grid-template-columns:1fr 1fr; }
    .page.cols-6 { grid-template-columns:1fr 1fr; }
    .page:not(:last-child) { break-after: page; page-break-after: always; }
    .card { break-inside: avoid; border:3px solid ${PINK}; border-radius:10px; padding:6px; }
    .chead { display:flex; align-items:baseline; gap:10px; padding:4px 6px 8px; }
    .chead .brand { font-weight:900; font-size:20px; letter-spacing:1px; color:${PINK}; }
    .chead .sub { font-weight:800; font-size:11px; letter-spacing:3px; color:#333; }
    .chead .serial { margin-left:auto; font-weight:700; font-size:11px; color:#999; }
    table.grid { width:100%; border-collapse:collapse; table-layout:fixed; }
    table.grid td { border:1.5px solid #222; height:46px; text-align:center; vertical-align:middle;
      font-weight:800; font-size:24px; }
    table.grid td.blank { background:${PINK}22; border-color:#bbb; }
    .cols-6 .card table.grid td { height:34px; font-size:18px; }
  </style></head><body onload="window.print()">
  ${pages.join("")}
  </body></html>`;
}

function SampleCard({ card }: { card: BingoCard }) {
  return (
    <div
      className="rounded-xl border-2 p-2"
      style={{ borderColor: PINK, background: "#0c0c0c" }}
    >
      <div className="flex items-baseline gap-2 px-1 pb-2">
        <span className="font-display text-base" style={{ color: PINK }}>
          NO DICE
        </span>
        <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-cream/60">
          Comedy &amp; Bingo
        </span>
      </div>
      <table className="w-full table-fixed border-collapse">
        <tbody>
          {card.map((row, r) => (
            <tr key={r}>
              {row.map((n, c) => (
                <td
                  key={c}
                  className="h-9 border text-center align-middle text-sm font-extrabold"
                  style={{
                    borderColor: n == null ? "rgba(245,239,227,0.15)" : "rgba(245,239,227,0.35)",
                    background: n == null ? `${PINK}14` : "transparent",
                    color: "#F2EBD9",
                  }}
                >
                  {n ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BingoCardsClient() {
  const [qty, setQty] = useState(60);
  const [perPage, setPerPage] = useState(4);
  const [sampleSeed, setSampleSeed] = useState(0);

  // Two sample cards for the on-screen preview (regenerate on demand).
  const samples = useMemo(() => generateBatch(2), [sampleSeed]);

  const print = () => {
    const n = Math.max(1, Math.min(600, Math.round(qty) || 1));
    const cards = generateBatch(n);
    const w = window.open("", "_blank");
    if (!w) {
      alert("Please allow pop-ups so the printable cards can open.");
      return;
    }
    w.document.open();
    w.document.write(buildPrintDoc(cards, perPage));
    w.document.close();
  };

  return (
    <div className="space-y-6">
      <AdminCard>
        <div className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap gap-5">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.28em] text-cream/55">
                How many cards
              </span>
              <input
                type="number"
                min={1}
                max={600}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className="w-28 rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-base text-cream focus:border-[#e878f0] focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.28em] text-cream/55">
                Cards per A4 page
              </span>
              <select
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value))}
                className="rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-base text-cream focus:border-[#e878f0] focus:outline-none"
              >
                <option value={2}>2 — large</option>
                <option value={4}>4 — standard</option>
                <option value={6}>6 — small</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={print}
            className="rounded-full bg-[#e878f0] px-7 py-3 text-sm font-bold uppercase tracking-widest text-ink shadow-lg shadow-[#e878f0]/30 transition hover:bg-[#e878f0]/90"
          >
            Print {Math.max(1, Math.round(qty) || 1)} cards ↗
          </button>
        </div>
        <p className="border-t border-cream/10 px-5 py-3 text-xs text-cream/50">
          Opens a printable sheet in a new tab — print it, or choose “Save as PDF”.
          Every card is random and unique. UK 90-ball: 15 numbers, 5 per row.
        </p>
      </AdminCard>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-plonkYellow">
            Preview
          </h2>
          <button
            type="button"
            onClick={() => setSampleSeed((s) => s + 1)}
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            Shuffle preview
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {samples.map((c, i) => (
            <SampleCard key={i} card={c} />
          ))}
        </div>
      </div>
    </div>
  );
}
