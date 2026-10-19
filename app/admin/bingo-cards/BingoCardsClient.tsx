"use client";

import { useMemo, useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import { generateBatch, FREE, type BingoCard } from "@/lib/bingo/cards";

// Cards print BLACK INK on COLOURED PAPER (founder, 19 Oct) — so the artwork is
// pure black, no fills; the paper supplies the colour. Brand look mirrors the
// posters (bold condensed uppercase). A6 per card, 4-up on A4 with cut guides
// for staff to guillotine (or hand the same PDF to a print shop). Layout:
// 15% top band (brand / date / card no.), ~70% number grid, 15% bottom band
// (prizes).

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function gridHtml(card: BingoCard): string {
  const head = `<tr class="bingo-head">${["B", "I", "N", "G", "O"]
    .map((l) => `<th>${l}</th>`)
    .join("")}</tr>`;
  const body = card
    .map(
      (row) =>
        `<tr>${row
          .map((cell) =>
            cell === FREE
              ? `<td class="free">★</td>`
              : `<td>${cell}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  return `<table class="grid">${head}${body}</table>`;
}

function cardHtml(card: BingoCard, serial: string, dateLabel: string, prizes: string): string {
  return `
  <div class="card">
    <div class="band top">
      <div class="brandblock">
        <div class="brand">NO DICE</div>
        <div class="sub">COMEDY &amp; BINGO</div>
      </div>
      <div class="meta">
        <div class="date">${esc(dateLabel)}</div>
        <div class="serial">CARD ${serial}</div>
      </div>
    </div>
    <div class="gridwrap">${gridHtml(card)}</div>
    <div class="band bottom">${esc(prizes)}</div>
  </div>`;
}

function buildPrintDoc(cards: BingoCard[], dateLabel: string, prizes: string): string {
  // 4 A6 cards per A4 (2×2), edge to edge with dashed cut guides.
  const pages: string[] = [];
  for (let i = 0; i < cards.length; i += 4) {
    const chunk = cards.slice(i, i + 4);
    const cells = chunk
      .map((c, j) => cardHtml(c, String(i + j + 1).padStart(3, "0"), dateLabel, prizes))
      .join("");
    pages.push(`<div class="page">${cells}</div>`);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>No Dice bingo cards</title>
  <style>
    * { box-sizing: border-box; }
    html,body { margin:0; padding:0; background:#fff; color:#000;
      font-family: "Arial Narrow", Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    @page { size: A4 portrait; margin: 0; }
    .page { display:grid; grid-template-columns:105mm 105mm; grid-template-rows:148.5mm 148.5mm;
      width:210mm; height:297mm; }
    .page:not(:last-child) { break-after: page; page-break-after: always; }
    /* A6 card — dashed cut guide, pure black ink on (coloured) paper */
    .card { width:105mm; height:148.5mm; padding:6mm; border:0.3mm dashed #000;
      display:flex; flex-direction:column; color:#000; }
    .band.top { flex:0 0 15%; display:flex; justify-content:space-between; align-items:flex-start;
      border-bottom:0.6mm solid #000; padding-bottom:2mm; }
    .brandblock .brand { font-weight:900; font-size:26px; letter-spacing:1px; line-height:1; text-transform:uppercase; }
    .brandblock .sub { font-weight:800; font-size:11px; letter-spacing:3px; margin-top:1mm; text-transform:uppercase; }
    .meta { text-align:right; }
    .meta .date { font-weight:800; font-size:12px; text-transform:uppercase; }
    .meta .serial { font-weight:700; font-size:10px; letter-spacing:1px; margin-top:1mm; }
    .gridwrap { flex:1 1 auto; display:flex; align-items:center; justify-content:center; padding:3mm 0; }
    table.grid { width:100%; height:100%; border-collapse:collapse; table-layout:fixed; }
    table.grid th { font-weight:900; font-size:22px; text-align:center; padding-bottom:1.5mm; text-transform:uppercase; }
    table.grid td { border:0.5mm solid #000; text-align:center; vertical-align:middle;
      font-weight:800; font-size:26px; }
    table.grid td.free { font-size:20px; }
    .band.bottom { flex:0 0 15%; display:flex; align-items:center; justify-content:center;
      border-top:0.6mm solid #000; padding-top:2mm; text-align:center;
      font-weight:800; font-size:12px; letter-spacing:0.5px; text-transform:uppercase; }
  </style></head><body onload="setTimeout(function(){window.print();},120)">
  ${pages.join("")}
  </body></html>`;
}

// On-screen preview: black ink shown on a coloured-paper swatch so staff see
// the "black on coloured paper" concept.
function SamplePreview({ card, dateLabel, prizes }: { card: BingoCard; dateLabel: string; prizes: string }) {
  return (
    <div
      className="mx-auto flex flex-col rounded-sm p-3 text-black"
      style={{ background: "#f3d7f7", aspectRatio: "105 / 148.5", maxWidth: 280, border: "1px dashed #000" }}
    >
      <div className="flex items-start justify-between border-b-2 border-black pb-1" style={{ flex: "0 0 15%" }}>
        <div>
          <div className="text-lg font-black uppercase leading-none">NO DICE</div>
          <div className="text-[7px] font-bold uppercase tracking-[0.3em]">Comedy &amp; Bingo</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-extrabold uppercase">{dateLabel}</div>
          <div className="text-[7px] font-bold tracking-wider">CARD 001</div>
        </div>
      </div>
      <div className="flex flex-1 items-center py-1">
        <table className="h-full w-full table-fixed border-collapse">
          <tbody>
            <tr>
              {["B", "I", "N", "G", "O"].map((l) => (
                <th key={l} className="pb-0.5 text-center text-sm font-black uppercase">
                  {l}
                </th>
              ))}
            </tr>
            {card.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className="border border-black text-center align-middle text-[11px] font-extrabold"
                  >
                    {cell === FREE ? "★" : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        className="flex items-center justify-center border-t-2 border-black pt-1 text-center text-[8px] font-bold uppercase"
        style={{ flex: "0 0 15%" }}
      >
        {prizes}
      </div>
    </div>
  );
}

export default function BingoCardsClient() {
  const [qty, setQty] = useState(60);
  const [dateLabel, setDateLabel] = useState("Wed 25 Nov 2026");
  const [prizes, setPrizes] = useState("1 Line £15 · 2 Lines £25 · Full House £50");
  const [sampleSeed, setSampleSeed] = useState(0);

  const sample = useMemo(() => generateBatch(1)[0], [sampleSeed]);

  const print = () => {
    const n = Math.max(1, Math.min(600, Math.round(qty) || 1));
    const cards = generateBatch(n);
    const w = window.open("", "_blank");
    if (!w) {
      alert("Please allow pop-ups so the printable cards can open.");
      return;
    }
    w.document.open();
    w.document.write(buildPrintDoc(cards, dateLabel, prizes));
    w.document.close();
  };

  return (
    <div className="space-y-6">
      <AdminCard>
        <div className="space-y-5 px-5 py-5">
          <div className="flex flex-wrap items-end gap-5">
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
                Date (printed top-right)
              </span>
              <input
                type="text"
                value={dateLabel}
                onChange={(e) => setDateLabel(e.target.value)}
                className="w-48 rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-base text-cream focus:border-[#e878f0] focus:outline-none"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.28em] text-cream/55">
              Prizes (printed along the bottom)
            </span>
            <input
              type="text"
              value={prizes}
              onChange={(e) => setPrizes(e.target.value)}
              className="w-full max-w-xl rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-base text-cream focus:border-[#e878f0] focus:outline-none"
            />
          </label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={print}
              className="rounded-full bg-[#e878f0] px-7 py-3 text-sm font-bold uppercase tracking-widest text-ink shadow-lg shadow-[#e878f0]/30 transition hover:bg-[#e878f0]/90"
            >
              Print {Math.max(1, Math.round(qty) || 1)} cards ↗
            </button>
            <p className="text-xs text-cream/50">
              Black ink, A6 each, 4 to an A4 sheet with cut guides — print on
              coloured paper and guillotine, or send the PDF to a print shop.
            </p>
          </div>
        </div>
      </AdminCard>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-plonkYellow">
            Preview (black ink on coloured paper)
          </h2>
          <button
            type="button"
            onClick={() => setSampleSeed((s) => s + 1)}
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            Shuffle preview
          </button>
        </div>
        <SamplePreview card={sample} dateLabel={dateLabel} prizes={prizes} />
      </div>
    </div>
  );
}
