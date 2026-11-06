// =============================================================
// voucherArt — No Dice voucher artwork
// =============================================================
// A voucher is a deals-engine poster with the voucher furniture laid on top.
// We deliberately REUSE renderEventPoster (lib/poster/engine.ts) so the artwork
// is byte-identical to the deals generator — same photo treatment, same font,
// same colour, same framing — and only ADD the things that make it a voucher
// and make it hard to fake:
//   • a fixed headline "NO DICE VOUCHER" the team can't rename
//   • fixed terms copy along the foot
//   • the VALUE, large, bottom-left
//   • the locked random CODE + value in a panel bottom-right (where a deal's
//     date/address/time sits)
//   • the engine's A3 QR (top-right) pointing at the public verify page, so any
//     phone can scan and see the voucher is genuine and its live balance.
// The code shown here is the exact code stored on the voucher row, so a photo-
// copy can't be spent twice — the till checks the balance server-side.
// =============================================================

import {
  renderEventPoster,
  ensureFont,
  loadImage,
  type PosterTreatment,
} from "./engine";

const FONT = "AmsiProCondUltra";

// The No Dice tokens picture is locked onto EVERY voucher. If the studio didn't
// pass a loaded image (e.g. the shared setting hadn't loaded yet), fall back to
// this so a voucher never renders without the tokens — the founder's rule.
export const VOUCHER_TOKENS_IMAGE =
  "https://rntcujcpsozvuxvmlejv.supabase.co/storage/v1/object/public/media/gallery/hero.deals/1780848054195-coins-300x-colour.png";
let _tokensImg: HTMLImageElement | null = null;

export type VoucherArtInput = {
  valuePence: number;
  code: string;
  img: HTMLImageElement | null;
  exposure?: number;
  colour: string;
  treatment?: PosterTreatment; // default "whites" = colour-through
  verifyUrl?: string; // the QR target; default nodice.bar/voucher?c=CODE
  prizeDescription?: string | null; // auction/activity prize instead of a £ value
  ox?: number;
  oy?: number;
  zoom?: number;
};

const TERMS = "TO BE USED IN STORE IN PERSON\nNOT VALID FOR FUTURE BOOKINGS";

function money(pence: number): string {
  const p = Math.max(0, Math.round(pence));
  return p % 100 === 0 ? `£${p / 100}` : `£${(p / 100).toFixed(2)}`;
}

// Shrink a font until the text fits `maxW`, starting at `start`px.
function fitPx(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  start: number,
): number {
  let px = start;
  for (let i = 0; i < 80; i++) {
    ctx.font = `${px}px "${FONT}"`;
    if (ctx.measureText(text).width <= maxW || px <= 10) break;
    px = Math.floor(px * 0.94);
  }
  return px;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function renderVoucherPoster(
  input: VoucherArtInput,
): Promise<HTMLCanvasElement> {
  await ensureFont();
  const code = input.code;
  const verify =
    input.verifyUrl ?? `https://nodice.bar/voucher?c=${encodeURIComponent(code)}`;

  // The tokens picture is locked onto every voucher. Use what the studio loaded,
  // else the baked-in fallback so it can never render blank.
  let img = input.img;
  if (!img) {
    if (!_tokensImg) {
      try {
        _tokensImg = await loadImage(VOUCHER_TOKENS_IMAGE);
      } catch {
        _tokensImg = null;
      }
    }
    img = _tokensImg;
  }

  // Base poster from the SAME engine the deals use. A3 so the QR renders and the
  // print is crisp. Headline + terms are fixed; the photo is the locked art.
  const cv = await renderEventPoster({
    name: "NO DICE VOUCHER",
    date: new Date().toISOString().slice(0, 10),
    footer: TERMS,
    colour: input.colour,
    size: "a3",
    mode: "colour",
    treatment: input.treatment ?? "whites",
    img,
    exposure: input.exposure ?? 1,
    qrUrl: verify,
    imgs: img
      ? [
          {
            img,
            exposure: input.exposure ?? 1,
            ox: input.ox ?? 0.5,
            oy: input.oy ?? 0.5,
            z: input.zoom ?? 1,
          },
        ]
      : null,
  });

  const ctx = cv.getContext("2d")!;
  const W = cv.width;
  const H = cv.height;
  const C = input.colour;
  const M = Math.round(W * 0.05);

  // ── Voucher plate: a solid band across the lower third, over the photo, so
  // the value/prize + code are always legible and the sheet reads unmistakably
  // as a voucher. A prize can run to a few lines, so its plate is taller.
  const prize = (input.prizeDescription || "").trim();
  const bandH = Math.round(H * (prize ? 0.26 : 0.2));
  const bandY = Math.round(H * (prize ? 0.56 : 0.6));
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.82)";
  roundRect(ctx, M, bandY, W - 2 * M, bandH, Math.round(W * 0.02));
  ctx.fill();
  ctx.lineWidth = Math.max(3, Math.round(W * 0.004));
  ctx.strokeStyle = C;
  ctx.stroke();

  const padX = Math.round(W * 0.035);
  const innerW = W - 2 * M - 2 * padX;
  const colGap = Math.round(W * 0.03);
  const leftW = Math.round(innerW * 0.46);
  const rightW = innerW - leftW - colGap;
  const leftX = M + padX;
  const rightX = leftX + leftW + colGap;

  const labelPx = Math.round(W * 0.028);
  ctx.fillStyle = C;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  if (prize) {
    // ── Auction / activity prize: the experience, not a £ value. Label at top,
    // the description fit into the middle, the code on a line beneath — laid out
    // so nothing overlaps however long the description is.
    ctx.font = `${labelPx}px "${FONT}"`;
    ctx.fillText("AUCTION PRIZE", leftX, bandY + Math.round(bandH * 0.16));

    const subPx = Math.round(W * 0.024);
    const codeY = bandY + bandH - Math.round(bandH * 0.1);
    const regionTop = bandY + Math.round(bandH * 0.22);
    const regionBottom = codeY - Math.round(subPx * 2.2);
    const regionH = regionBottom - regionTop;

    const innerFullW = W - 2 * M - 2 * padX;
    // Fit so the lines fit BOTH the width and the region height (no overlap).
    let wrapped = wrapFit(ctx, prize.toUpperCase(), innerFullW, Math.round(W * 0.066), 3);
    while (wrapped.lines.length * wrapped.px * 1.14 > regionH && wrapped.px > 22) {
      wrapped = wrapFit(
        ctx,
        prize.toUpperCase(),
        innerFullW,
        Math.floor(wrapped.px * 0.9),
        4,
      );
    }
    ctx.font = `${wrapped.px}px "${FONT}"`;
    ctx.fillStyle = C;
    const lh = Math.round(wrapped.px * 1.14);
    const blockH = wrapped.lines.length * lh;
    let ty = regionTop + Math.max(0, (regionH - blockH) / 2) + wrapped.px;
    for (const ln of wrapped.lines) {
      ctx.fillText(ln, leftX, ty);
      ty += lh;
    }
    ctx.font = `${subPx}px "${FONT}"`;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText(`CODE ${code}  ·  VALID 1 YEAR  ·  SCAN TO VERIFY`, leftX, codeY);
  } else {
    // ── Cash value: VALUE on the left, CODE on the right.
    ctx.font = `${labelPx}px "${FONT}"`;
    ctx.fillText("VOUCHER VALUE", leftX, bandY + Math.round(bandH * 0.3));
    const valStr = money(input.valuePence);
    const valPx = fitPx(ctx, valStr, leftW, Math.round(W * 0.16));
    ctx.font = `${valPx}px "${FONT}"`;
    ctx.fillText(valStr, leftX, bandY + bandH - Math.round(bandH * 0.18));

    // Divider.
    ctx.strokeStyle = `${C}`;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(2, Math.round(W * 0.002));
    ctx.beginPath();
    ctx.moveTo(rightX - colGap / 2, bandY + Math.round(bandH * 0.18));
    ctx.lineTo(rightX - colGap / 2, bandY + bandH - Math.round(bandH * 0.18));
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = C;
    ctx.font = `${labelPx}px "${FONT}"`;
    ctx.fillText("VOUCHER CODE", rightX, bandY + Math.round(bandH * 0.3));
    const codePx = fitPx(ctx, code, rightW, Math.round(W * 0.08));
    ctx.font = `${codePx}px "${FONT}"`;
    ctx.fillText(code, rightX, bandY + Math.round(bandH * 0.62));
    const subPx = Math.round(W * 0.03);
    ctx.font = `${subPx}px "${FONT}"`;
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillText(
      `${valStr} · VALID 1 YEAR · SCAN TO VERIFY`,
      rightX,
      bandY + bandH - Math.round(bandH * 0.16),
    );
  }
  ctx.restore();

  return cv;
}

// Wrap `text` to fit `maxW`, shrinking the font until it uses at most maxLines.
function wrapFit(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  startPx: number,
  maxLines: number,
): { lines: string[]; px: number } {
  let px = startPx;
  for (let i = 0; i < 60; i++) {
    ctx.font = `${px}px "${FONT}"`;
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(t).width <= maxW || !cur) cur = t;
      else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    if (lines.length <= maxLines || px <= 14) return { lines, px };
    px = Math.floor(px * 0.92);
  }
  return { lines: [text], px };
}
