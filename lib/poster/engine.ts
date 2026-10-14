// No Dice EVENT poster generator — deterministic canvas renderer.
// ─────────────────────────────────────────────────────────────────────────────
// PORTED COPY of the DJ poster engine. The original lives in the TEAM HUB repo at
//   Plonk-Borough-2.0/src/dj/poster.js   (and its UI at src/dj/PosterStudio.jsx)
// The two repos can't share an import, so this is a deliberate second copy of the
// layout maths. IF YOU CHANGE THE LAYOUT, SCALES, BORDER RATIO, HALFTONE OR
// EXPOSURE BEHAVIOUR HERE, MAKE THE SAME CHANGE IN THE TEAM HUB FILE — and the
// other way round. The look must stay identical between DJ nights and events.
//
// Ported unchanged from the DJ engine:
//   AmsiProCond-Ultra headline · Scatter (Floyd-Steinberg) halftone duotone photo
//   thick coloured border · NO DICE line flush to the bottom border
//   margin W*0.037 · border 16*W/1080 · headline 0.135 · small line 0.044
//   NO DICE line 0.09 · halftone grain dw/5 · 1% autocontrast · exposure dial
//   smart crop · cover-fill reposition + zoom · 'colour' / 'negative' modes
//
// Added here for events (see the NOTES below each one):
//   • 'story' size — 1080x1920 with Instagram's safe areas respected
//   • 'zine'  size — 1080x1527, the A-series page ratio (1:√2), for the DRINKS
//     DEAL poster that the team-hub drinks zine prints as its front cover. See
//     the NOTE on SIZES. This is EVENTS-ONLY (DJ nights have no deals), so unlike
//     the layout/scale/border/halftone rules above it does NOT need mirroring in
//     the team-hub engine — it adds a size, it doesn't change any existing one.
//   • event text block — name (wraps), optional detail line, optional price
//   • AM/PM worked out per time instead of the DJ engine's hardcoded "PM"
//
//   size:  'ig'    (1080x1350 Instagram post)
//          'story' (1080x1920 Instagram story)
//          'zine'  (1080x1527 A-page / deal poster, 1:√2)
//          'a3'    (3508x4961 A3 @ 300dpi)
//   mode:  'colour'   = the colour on black (screen / IG)
//          'negative' = BLACK on TRANSPARENT, to print black ink on coloured paper
// Same inputs always produce the same output — no randomness.
// ─────────────────────────────────────────────────────────────────────────────

const FONT_FAMILY = "AmsiProCondUltra";

// Static export can be served under a basePath (GitHub Pages), so the font URL
// has to carry it — a bare /fonts/… 404s there and the poster silently renders
// in a fallback face.
function fontUrl(): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return `${base}/fonts/AmsiProCondUltra.ttf`;
}

let _fontPromise: Promise<boolean> | null = null;

// Load the embedded headline font once (admin-only surface). Resolves FALSE if
// the font could not be loaded — callers must warn rather than export a poster
// set in a fallback face, which silently ruins every scale on the page.
export function ensureFont(): Promise<boolean> {
  if (_fontPromise) return _fontPromise;
  try {
    const f = new FontFace(FONT_FAMILY, `url(${fontUrl()})`);
    _fontPromise = f
      .load()
      .then((ff) => {
        (document as unknown as { fonts: FontFaceSet }).fonts.add(ff);
        return true;
      })
      .catch(() => false);
  } catch {
    _fontPromise = Promise.resolve(false);
  }
  return _fontPromise;
}

// Checks the font is actually usable for measurement, not just loaded. A poster
// measured before the face is ready lays out against a fallback metric and every
// line ends up the wrong size.
export function fontReady(): boolean {
  try {
    return (document as unknown as { fonts: FontFaceSet }).fonts.check(
      `16px "${FONT_FAMILY}"`,
    );
  } catch {
    return false;
  }
}

// The existing No Dice colourways (from the InDesign swatches) — the quick picks
// pinned above the full RAL chart.
export const PALETTE: { name: string; hex: string }[] = [
  { name: "Cream", hex: "#F5E069" }, // C4 M12 Y59
  { name: "Yellow", hex: "#FFED00" }, // C0 M0 Y100
  { name: "Gold", hex: "#F6A11E" }, // C0 M39 Y95
  { name: "Orange", hex: "#FF8C49" }, // R255 G140 B73
  { name: "Red", hex: "#E8432A" }, // C2 M83 Y90
  { name: "Pink", hex: "#FF006A" }, // R255 G0 B106
  { name: "Purple", hex: "#9E5BB6" }, // C33 M68 Y0
  { name: "Cyan", hex: "#009EE2" }, // C100 M0 Y0
  { name: "Teal", hex: "#20748A" }, // R32 G116 B138
  { name: "Green", hex: "#3FA535" }, // R63 G165 B53
];

export type PosterSize = "ig" | "story" | "zine" | "a3";
export type PosterMode = "colour" | "negative";
export type PosterTreatment = "scatter" | "natural";

// NOTE (added for events): 'story' is the new size.
//
// safeTop/safeBottom — Instagram lays its own UI (profile row, caption, DM bar,
// progress pips) over roughly the top and bottom 250px of a 1920-tall story. No
// type goes in there, so the whole poster is inset by that much.
//
// scaleBase — every type size in this engine is a fraction of the canvas HEIGHT.
// That's fine for 'ig' and 'a3' (ported as-is) but a story is 570px taller at the
// same width, so height-based sizes would come out noticeably chunkier than the
// post and the two files wouldn't look like the same artwork. For 'story' the
// scale base is therefore the POST's height, so a story's type lands at exactly
// the same pixel size as the post's — the extra height goes to the photo, which
// is the whole point of the taller frame.
// NOTE (added for events): 'zine' is the DEAL poster, shaped to the A-series
// page ratio (1:√2 ≈ 0.7071) so it FILLS the team-hub drinks zine's front cover
// — a 9:16 story only fit that page with big side margins. 1080 wide keeps it in
// the same type/border family as the post; 1080×1527 gives the A ratio. No
// Instagram safe areas — it's a printed page, not a story. It uses the post's
// type scale (like 'story', see scaleBaseFor) so the lettering lands at the same
// size as the post and it reads as the same artwork. The zine INVERTS this
// poster (invert + grayscale + multiply) to print black ink on coloured paper,
// so it works best with LIGHT ink on the black ground — Cream is the default the
// studio picks for deals — which inverts to near-black on the stock.
const SIZES: Record<
  PosterSize,
  { w: number; h: number; safeTop: number; safeBottom: number }
> = {
  ig: { w: 1080, h: 1350, safeTop: 0, safeBottom: 0 },
  story: { w: 1080, h: 1920, safeTop: 250, safeBottom: 250 },
  zine: { w: 1080, h: 1527, safeTop: 0, safeBottom: 0 },
  a3: { w: 3508, h: 4961, safeTop: 0, safeBottom: 0 },
};

export const SIZE_LABEL: Record<PosterSize, string> = {
  ig: "Instagram post · 1080×1350",
  story: "Instagram story · 1080×1920",
  zine: "Deal poster · page shape",
  a3: "A3 print · 3508×4961",
};

function scaleBaseFor(size: PosterSize, w: number, h: number): number {
  // 'story' and 'zine' borrow the post's type scale (see the NOTEs above) so
  // their lettering matches the post pixel-for-pixel; the others use their own
  // height exactly as the DJ engine does.
  return size === "story" || size === "zine" ? 1350 * (w / 1080) : h;
}

type RGB = [number, number, number];

const hexRGB = (h: string | undefined): RGB => {
  const s = (h || "#C25A9E").replace("#", "");
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ];
};

// Loads a picture for the canvas. crossOrigin is required: a picture drawn from
// another origin without CORS headers taints the canvas and every export throws.
// With crossOrigin set, such a picture fails to LOAD instead — which lands here
// as a readable error rather than a mystery failure at export time.
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = () =>
      rej(
        new Error(
          "Couldn't load that picture into the poster. It's probably hosted somewhere that blocks it — upload the picture with the Upload button instead and it'll work.",
        ),
      );
    i.src = url;
  });
}

// ── Date + time wording ──────────────────────────────────────────────────────
// fmtDate is the DJ engine's, unchanged: "13.6".
const fmtDate = (iso: string): string => {
  const parts = String(iso || "").split("-");
  if (parts.length < 3) return "";
  return `${+parts[2]}.${+parts[1]}`;
};

// NOTE (changed for events): the DJ engine hardcodes "PM" because DJ nights are
// always evening. Events aren't — a bingo matinee or an 11am screening would
// print the wrong half of the day. So the period is worked out per time, and
// collapsed to one suffix when both ends share it ("7-11PM", but "11AM-4PM").
const hour24 = (t: string): number => Number(String(t).slice(0, 2));
const h12 = (t: string): number => hour24(t) % 12 || 12;
const isPM = (t: string): boolean => {
  const h = hour24(t);
  if (h >= 12) return true;
  // 01:xx–05:xx is the small hours of a night out. The DJ poster already prints
  // a 2am finish as "9-2PM", so keep that shorthand. Midnight itself (00:xx) is
  // the exception — a noon-to-midnight event has to read "12PM-12AM", not
  // "12-12PM", and there IS one of those in the diary.
  return h >= 1 && h < 6;
};
const period = (t: string): string => (isPM(t) ? "PM" : "AM");

function fmtTime(start?: string | null, end?: string | null): string {
  if (!start) return "";
  if (!end) return `${h12(start)}${period(start)}`;
  const a = period(start);
  const b = period(end);
  return a === b
    ? `${h12(start)}-${h12(end)}${b}`
    : `${h12(start)}${a}-${h12(end)}${b}`;
}

// ── Type fitting ─────────────────────────────────────────────────────────────
// Ported unchanged: shrink until the line fits the measure.
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  startPx: number,
): number {
  let px = startPx;
  ctx.font = `${px}px "${FONT_FAMILY}"`;
  while (px > 8 && ctx.measureText(text).width > maxW) {
    px -= Math.max(2, px * 0.04);
    ctx.font = `${px}px "${FONT_FAMILY}"`;
  }
  return px;
}

// NOTE (added for events): the DJ engine only ever sets a DJ name — short, always
// one line. Event names run long ("Bottomless Bingo with Glitter Dave"), and
// shrinking one of those to fit a single line would leave the headline tiny. So
// the headline wraps: it stays at the FULL display size and takes more lines,
// and only shrinks once it would need more lines than it's allowed. A short name
// still renders identically to the DJ poster — one line, 0.135 of the scale base.
function wrapAt(
  ctx: CanvasRenderingContext2D,
  words: string[],
  maxW: number,
  px: number,
): string[] {
  ctx.font = `${px}px "${FONT_FAMILY}"`;
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(next).width > maxW) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function fitDisplayBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  targetPx: number,
  maxLines: number,
  maxBlockH: number,
): { px: number; lines: string[] } {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return { px: targetPx, lines: [] };
  let px = targetPx;
  for (let guard = 0; guard < 60 && px > 8; guard++) {
    const lines = wrapAt(ctx, words, maxW, px);
    // A single word longer than the measure can't wrap — fitFont it instead.
    const tooWide = lines.some((l) => ctx.measureText(l).width > maxW);
    const blockH = lines.length * px * 1.05;
    if (!tooWide && lines.length <= maxLines && blockH <= maxBlockH) {
      return { px, lines };
    }
    px -= Math.max(2, px * 0.04);
  }
  const px2 = fitFont(ctx, words.join(" "), maxW, targetPx);
  return { px: px2, lines: [words.join(" ")] };
}

// ── Photo treatment (all ported unchanged) ───────────────────────────────────
// Content-aware cover crop for a target aspect `tar`: finds where the faces /
// bodies are (skin tone + detail) and slides the crop window to keep them centred,
// instead of a fixed centre crop. No ML model — works on any device, synchronously.
function smartCrop(
  img: HTMLImageElement,
  tar: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const iw = img.width,
    ih = img.height;
  let sw: number, sh: number;
  if (iw / ih > tar) {
    sw = Math.round(ih * tar);
    sh = ih;
  } else {
    sh = Math.round(iw / tar);
    sw = iw;
  }
  const horizontal = iw / ih > tar; // which axis the crop slides along
  try {
    const AW = 72,
      AH = Math.max(1, Math.round((AW * ih) / iw));
    const c = document.createElement("canvas");
    c.width = AW;
    c.height = AH;
    const cx = c.getContext("2d")!;
    cx.drawImage(img, 0, 0, AW, AH);
    const d = cx.getImageData(0, 0, AW, AH).data;
    const imp = new Float32Array(AW * AH);
    for (let y = 0; y < AH; y++)
      for (let x = 0; x < AW; x++) {
        const i = (y * AW + x) * 4,
          r = d[i],
          g = d[i + 1],
          b = d[i + 2];
        let s = 0.05;
        if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15)
          s += 1.0; // skin → face/body
        if (x > 0) {
          const j = i - 4;
          s +=
            Math.min(
              1,
              (Math.abs(r - d[j]) +
                Math.abs(g - d[j + 1]) +
                Math.abs(b - d[j + 2])) /
                300,
            ) * 0.35;
        } // detail
        imp[y * AW + x] = s;
      }
    if (horizontal) {
      const win = Math.max(1, Math.round((sw / iw) * AW));
      let best = -1,
        bestA = 0;
      for (let a = 0; a <= AW - win; a++) {
        let sum = 0;
        for (let y = 0; y < AH; y++)
          for (let x = a; x < a + win; x++) sum += imp[y * AW + x];
        sum *= 1 - 0.18 * Math.abs((a + win / 2) / AW - 0.5) * 2; // gentle centre bias
        if (sum > best) {
          best = sum;
          bestA = a;
        }
      }
      return {
        sx: Math.min(iw - sw, Math.max(0, Math.round((bestA / AW) * iw))),
        sy: 0,
        sw,
        sh,
      };
    }
    const win = Math.max(1, Math.round((sh / ih) * AH));
    let best = -1,
      bestA = 0;
    for (let a = 0; a <= AH - win; a++) {
      let sum = 0;
      for (let y = a; y < a + win; y++)
        for (let x = 0; x < AW; x++) sum += imp[y * AW + x];
      sum *= 1 - 0.14 * Math.abs((a + win / 2) / AH - 0.45) * 2; // faces sit a touch high
      if (sum > best) {
        best = sum;
        bestA = a;
      }
    }
    return {
      sx: 0,
      sy: Math.min(ih - sh, Math.max(0, Math.round((bestA / AH) * ih))),
      sw,
      sh,
    };
  } catch {
    // tainted canvas / tiny image → fall back to the old fixed crop
    return horizontal
      ? { sx: Math.round((iw - sw) / 2), sy: 0, sw, sh }
      : { sx: 0, sy: Math.round((ih - sh) * 0.15), sw, sh };
  }
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

// Cover-fill source rect: fills (dw×dh) edge-to-edge, cropping the overflow,
// positioned by ox/oy ∈ [0,1] (0.5 = centred) and zoomed by `zoom` (1 = fill,
// >1 = zoomed in). This is what the reposition + zoom tool drives.
export function coverRect(
  iw: number,
  ih: number,
  dw: number,
  dh: number,
  ox = 0.5,
  oy = 0.5,
  zoom = 1,
): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(dw / iw, dh / ih) * Math.max(1, zoom || 1);
  const sw = Math.min(iw, Math.round(dw / scale)),
    sh = Math.min(ih, Math.round(dh / scale));
  return {
    sx: Math.round((iw - sw) * clamp01(ox)),
    sy: Math.round((ih - sh) * clamp01(oy)),
    sw,
    sh,
  };
}

// Smart crop position as {ox, oy} ∈ [0,1] — the default reposition.
export function smartOffset(
  img: HTMLImageElement,
  aspect: number,
): { ox: number; oy: number } {
  const { sx, sy, sw, sh } = smartCrop(img, aspect);
  const iw = img.width,
    ih = img.height;
  return {
    ox: iw > sw ? sx / (iw - sw) : 0.5,
    oy: ih > sh ? sy / (ih - sh) : 0.5,
  };
}

type SrcRect = { sx: number; sy: number; sw: number; sh: number };

// Scatter duotone: dark tone where the photo is dark, light tone where light.
// `src` = the source rect to use (cover-fill + reposition); the image always
// fills the frame edge-to-edge. Falls back to smartCrop if src is omitted.
function drawHalftone(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  dark: number[],
  light: number[],
  exposure: number,
  src?: SrcRect | null,
): void {
  const { sx, sy, sw, sh } = src || smartCrop(img, dw / dh);
  const cols = Math.max(120, Math.round(dw / 5)); // grain scales with size → same look
  const rows = Math.max(1, Math.round((cols * dh) / dw));
  const c = document.createElement("canvas");
  c.width = cols;
  c.height = rows;
  const cx = c.getContext("2d")!;
  cx.drawImage(img, sx, sy, sw, sh, 0, 0, cols, rows);
  const id = cx.getImageData(0, 0, cols, rows),
    px = id.data,
    n = cols * rows;
  const g = new Float32Array(n);
  for (let i = 0; i < n; i++)
    g[i] =
      0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  // autocontrast (1% cutoff)
  const hist = new Array(256).fill(0);
  for (let i = 0; i < n; i++)
    hist[Math.max(0, Math.min(255, Math.round(g[i])))]++;
  const cut = Math.floor(n * 0.01);
  let lo = 0,
    hi = 255,
    acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc > cut) {
      lo = v;
      break;
    }
  }
  acc = 0;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc > cut) {
      hi = v;
      break;
    }
  }
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < n; i++) {
    const v = ((g[i] - lo) / range) * 255 * exposure;
    g[i] = v < 0 ? 0 : v > 255 ? 255 : v;
  }
  // Floyd-Steinberg dither → 1-bit
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x,
        old = g[i],
        nw = old < 128 ? 0 : 255,
        err = old - nw;
      g[i] = nw;
      if (x + 1 < cols) g[i + 1] += (err * 7) / 16;
      if (y + 1 < rows) {
        if (x > 0) g[i + cols - 1] += (err * 3) / 16;
        g[i + cols] += (err * 5) / 16;
        if (x + 1 < cols) g[i + cols + 1] += (err * 1) / 16;
      }
    }
  for (let i = 0; i < n; i++) {
    const t = g[i] >= 128 ? light : dark;
    px[i * 4] = t[0];
    px[i * 4 + 1] = t[1];
    px[i * 4 + 2] = t[2];
    px[i * 4 + 3] = t[3];
  }
  cx.putImageData(id, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, 0, 0, cols, rows, dx, dy, dw, dh);
  ctx.imageSmoothingEnabled = true;
}

// Draw the photo "natural" (not rasterised): the real image, cover-fitted into
// the frame, with exposure applied as brightness.
function drawNatural(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  exposure: number,
  src?: SrcRect | null,
): void {
  const { sx, sy, sw, sh } = src || smartCrop(img, dw / dh);
  const prev = ctx.filter;
  try {
    ctx.filter = `brightness(${exposure})`;
  } catch {
    /* older canvas: no filter */
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.filter = prev || "none";
}

export type PosterImage = {
  img: HTMLImageElement;
  exposure?: number;
  ox?: number;
  oy?: number;
  z?: number;
};

export type EventPosterInput = {
  /** The event name — the headline. Wraps over up to 3 lines. */
  name: string;
  /** Event date, YYYY-MM-DD. Prints as "18.10" in the NO DICE line. */
  date: string;
  /** Start / end time, HH:MM. Print as "7-11PM" in the NO DICE line. */
  start?: string | null;
  end?: string | null;
  /** One short line under the headline (from the description). Optional. */
  detail?: string | null;
  /** Price wording, e.g. "£5 on the door" / "Free entry". Optional. */
  price?: string | null;
  colour: string;
  size?: PosterSize;
  mode?: PosterMode;
  treatment?: PosterTreatment;
  img?: HTMLImageElement | null;
  exposure?: number;
  imgs?: PosterImage[] | null;
};

// Render to a canvas. Images are pre-loaded HTMLImageElements (see loadImage).
//   treatment: 'scatter' = Scatter halftone (default) | 'natural' = the real photo.
//   imgs: optional array of { img, exposure } — one entry = single image,
//         two entries = a split of two portrait columns with a gap.
export async function renderEventPoster({
  name,
  date,
  start,
  end,
  detail,
  price,
  colour,
  size = "ig",
  mode = "colour",
  exposure = 1,
  treatment = "scatter",
  img,
  imgs = null,
}: EventPosterInput): Promise<HTMLCanvasElement> {
  await ensureFont();
  const S = SIZES[size] || SIZES.ig;
  const W = S.w,
    H = S.h;
  const SB = scaleBaseFor(size, W, H);
  const BORDER = Math.round((16 * W) / 1080);
  const C = hexRGB(colour);
  const ink: RGB = mode === "negative" ? [0, 0, 0] : C;
  const dark = [0, 0, 0, 255];
  const light =
    mode === "negative" ? [0, 0, 0, 0] : [C[0], C[1], C[2], 255];
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  if (mode !== "negative") {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
  }
  const inkCss = `rgb(${ink[0]},${ink[1]},${ink[2]})`;
  ctx.fillStyle = inkCss;
  ctx.textBaseline = "alphabetic";
  const m = Math.round(W * 0.037),
    x0 = m,
    x1 = W - m;
  // Ported: text starts at the margin. For a story it also clears Instagram's
  // top UI band (safeTop is 0 for the post and the A3, so they're unchanged).
  let y = S.safeTop + m;

  // One small line, set to `target` of the scale base, with `extra` trailing gap.
  // Ported unchanged from the DJ engine's line().
  const line = (text: string, target: number, extra: number) => {
    fitFont(ctx, text, x1 - x0, Math.round(SB * target));
    const mm = ctx.measureText(text);
    const asc = mm.actualBoundingBoxAscent,
      desc = mm.actualBoundingBoxDescent;
    ctx.fillText(text, x0, y + asc);
    y += asc + desc + Math.round(SB * extra);
  };

  // Headline. Same 0.135 scale and 0.018 trailing gap as the DJ name, but it may
  // take up to 3 lines (see fitDisplayBlock).
  const usableH = H - S.safeTop - S.safeBottom - 2 * m;
  const head = fitDisplayBlock(
    ctx,
    (name || "EVENT").toUpperCase(),
    x1 - x0,
    Math.round(SB * 0.135),
    3,
    usableH * 0.45,
  );
  ctx.font = `${head.px}px "${FONT_FAMILY}"`;
  for (const l of head.lines) {
    const mm = ctx.measureText(l);
    ctx.fillText(l, x0, y + mm.actualBoundingBoxAscent);
    y += mm.actualBoundingBoxAscent + mm.actualBoundingBoxDescent;
    // tight caps stacking, with a hair of leading between lines
    if (l !== head.lines[head.lines.length - 1]) y += Math.round(head.px * 0.05);
    ctx.font = `${head.px}px "${FONT_FAMILY}"`;
  }
  y += Math.round(SB * 0.018);

  // Optional detail line, at the DJ genres scale (0.044).
  const d = (detail || "").trim();
  if (d) line(d.toUpperCase(), 0.044, 0.02);
  // Optional price line, a touch bigger — it's a selling point, not a footnote.
  const p = (price || "").trim();
  if (p) line(p.toUpperCase(), 0.058, 0.02);
  // With neither, keep the DJ poster's exact gap before the photo (0.018+0.02).
  if (!d && !p) y += Math.round(SB * 0.02);

  const imgTop = y;

  const timeStr = fmtTime(start, end);
  const bottom = `NO DICE - ${fmtDate(date)}${timeStr ? ` / ${timeStr}` : ""}`;
  fitFont(ctx, bottom, x1 - x0, Math.round(SB * 0.09));
  const bm = ctx.measureText(bottom);
  const basc = bm.actualBoundingBoxAscent,
    bdesc = bm.actualBoundingBoxDescent;
  // Ported, plus the story's bottom safe band (0 for the post and the A3).
  const imgBottom =
    H - S.safeBottom - m - (basc + bdesc) - Math.round(SB * 0.01);

  // One framed image (border + photo) within a given x-column. The image always
  // fills the frame; ox/oy (0–1) set where it's cropped.
  const drawFramed = (
    cx0: number,
    cw: number,
    im: HTMLImageElement,
    exp: number,
    ox?: number,
    oy?: number,
    zoom?: number,
  ) => {
    ctx.fillStyle = inkCss;
    ctx.fillRect(cx0, imgTop, cw, BORDER);
    ctx.fillRect(cx0, imgBottom - BORDER, cw, BORDER);
    ctx.fillRect(cx0, imgTop, BORDER, imgBottom - imgTop);
    ctx.fillRect(cx0 + cw - BORDER, imgTop, BORDER, imgBottom - imgTop);
    const iX = cx0 + BORDER,
      iY = imgTop + BORDER,
      iW = cw - 2 * BORDER,
      iH = imgBottom - imgTop - 2 * BORDER;
    const src =
      typeof ox === "number"
        ? coverRect(im.width, im.height, iW, iH, ox, oy, zoom)
        : null;
    if (treatment === "natural")
      drawNatural(ctx, im, iX, iY, iW, iH, exp, src);
    else drawHalftone(ctx, im, iX, iY, iW, iH, dark, light, exp, src);
  };
  const list: PosterImage[] = (
    Array.isArray(imgs) && imgs.length
      ? imgs
      : ([{ img: img as HTMLImageElement, exposure }] as PosterImage[])
  ).filter((e) => e && e.img);
  if (list.length >= 2) {
    const gap = Math.round(W * 0.022),
      colW = Math.round((x1 - x0 - gap) / 2);
    drawFramed(
      x0,
      colW,
      list[0].img,
      list[0].exposure ?? 1,
      list[0].ox,
      list[0].oy,
      list[0].z,
    );
    drawFramed(
      x1 - colW,
      colW,
      list[1].img,
      list[1].exposure ?? 1,
      list[1].ox,
      list[1].oy,
      list[1].z,
    );
  } else if (list.length === 1) {
    drawFramed(
      x0,
      x1 - x0,
      list[0].img,
      list[0].exposure ?? 1,
      list[0].ox ?? 0.5,
      list[0].oy ?? 0.5,
      list[0].z,
    );
  }

  ctx.fillStyle = inkCss;
  ctx.font = `${fitFont(ctx, bottom, x1 - x0, Math.round(SB * 0.09))}px "${FONT_FAMILY}"`;
  ctx.fillText(bottom, x0, imgBottom + basc);
  return cv;
}

// The aspect of the photo frame for a given size — what the reposition well
// should show so the crop preview matches where the picture actually lands.
export function frameAspect(
  size: PosterSize,
  hasDetail: boolean,
  hasPrice: boolean,
): number {
  // Rough but stable: the text block eats a fairly predictable share of height.
  const S = SIZES[size] || SIZES.ig;
  const SB = scaleBaseFor(size, S.w, S.h);
  const m = Math.round(S.w * 0.037);
  const head = SB * 0.135 * 1.05 + SB * 0.018;
  const extra =
    (hasDetail ? SB * 0.044 + SB * 0.02 : 0) +
    (hasPrice ? SB * 0.058 + SB * 0.02 : 0) ||
    SB * 0.02;
  const bottomLine = SB * 0.09 + SB * 0.01;
  const h =
    S.h - S.safeTop - S.safeBottom - 2 * m - head - extra - bottomLine;
  return (S.w - 2 * m) / Math.max(1, h);
}

export const canvasToBlob = (cv: HTMLCanvasElement): Promise<Blob> =>
  new Promise((res, rej) => {
    try {
      cv.toBlob(
        (b) =>
          b
            ? res(b)
            : rej(
                new Error(
                  "That size is too large to export in the browser here — try it on a computer.",
                ),
              ),
        "image/png",
      );
    } catch {
      // SecurityError: a picture from another origin tainted the canvas.
      rej(
        new Error(
          "The picture you used blocks being saved into a poster. Upload it with the Upload button instead and try again.",
        ),
      );
    }
  });

export async function downloadCanvas(
  cv: HTMLCanvasElement,
  filename: string,
): Promise<void> {
  const b = await canvasToBlob(cv);
  const u = URL.createObjectURL(b);
  const a = document.createElement("a");
  a.href = u;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1500);
}

export const posterName = (
  eventName: string,
  date: string,
  tag: string,
): string =>
  `NoDice_${(eventName || "Event").replace(/[^a-z0-9]+/gi, "-")}_${date}_${tag}.png`;
