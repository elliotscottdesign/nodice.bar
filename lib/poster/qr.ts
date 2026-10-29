// QR code encoder — byte mode, error-correction level M, versions 1–10.
// ─────────────────────────────────────────────────────────────────────────────
// Written by hand rather than pulled in as a dependency: the poster maker has to
// work in the static export with no new npm package, and the only thing needed
// here is "turn a short https:// URL into a grid of black squares".
//
// Returns a square boolean matrix — true = dark module. Drawing (quiet zone,
// colours, print vs screen) is the poster engine's job, not this file's.
//
// Level M (15% recovery) is the standard default and keeps the module count
// down, which matters more: a sparser code survives being photographed off a
// printed A3 better than a dense one with more redundancy.
// ─────────────────────────────────────────────────────────────────────────────

// Per version (index 0 = version 1), for ECC level M:
//   ec   = error-correction codewords per block
//   g1n/g1d = number of blocks in group 1 / data codewords in each
//   g2n/g2d = same for group 2 (0 when the version has one group)
const VERSIONS = [
  { ec: 10, g1n: 1, g1d: 16, g2n: 0, g2d: 0 }, // 1
  { ec: 16, g1n: 1, g1d: 28, g2n: 0, g2d: 0 }, // 2
  { ec: 26, g1n: 1, g1d: 44, g2n: 0, g2d: 0 }, // 3
  { ec: 18, g1n: 2, g1d: 32, g2n: 0, g2d: 0 }, // 4
  { ec: 24, g1n: 2, g1d: 43, g2n: 0, g2d: 0 }, // 5
  { ec: 16, g1n: 4, g1d: 27, g2n: 0, g2d: 0 }, // 6
  { ec: 18, g1n: 4, g1d: 31, g2n: 0, g2d: 0 }, // 7
  { ec: 22, g1n: 2, g1d: 38, g2n: 2, g2d: 39 }, // 8
  { ec: 22, g1n: 3, g1d: 36, g2n: 2, g2d: 37 }, // 9
  { ec: 26, g1n: 4, g1d: 43, g2n: 1, g2d: 44 }, // 10
];

// Row/column centres of the alignment patterns, per version.
const ALIGN: number[][] = [
  [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
  [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
];

const dataCapacity = (v: number) => {
  const t = VERSIONS[v - 1];
  return t.g1n * t.g1d + t.g2n * t.g2d;
};

// ── GF(256) arithmetic for Reed-Solomon (primitive polynomial 0x11D) ─────────
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const mul = (a: number, b: number) =>
  a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];

// Generator polynomial for `n` error-correction codewords.
function rsGenerator(n: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < n; i++) {
    const next = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

// Remainder of data ÷ generator = the error-correction codewords.
function rsEncode(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGenerator(ecLen);
  const res = new Uint8Array(data.length + ecLen);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const factor = res[i];
    if (factor === 0) continue;
    for (let j = 0; j < gen.length; j++) res[i + j] ^= mul(gen[j], factor);
  }
  return res.slice(data.length);
}

// ── BCH codes for the format and version information areas ──────────────────
function bch(value: number, poly: number, bits: number): number {
  let v = value << bits;
  const polyBits = 32 - Math.clz32(poly);
  while (32 - Math.clz32(v) >= polyBits) v ^= poly << (32 - Math.clz32(v) - polyBits);
  return v;
}

// ── Encoding ────────────────────────────────────────────────────────────────
function toBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function pickVersion(byteLen: number): number {
  for (let v = 1; v <= 10; v++) {
    // 4 bits mode + (8 or 16) bits length + the data itself
    const header = 4 + (v < 10 ? 8 : 16);
    if (Math.ceil((header + byteLen * 8) / 8) <= dataCapacity(v)) return v;
  }
  throw new Error(
    "That link is too long to put in a QR code on the poster — shorten it.",
  );
}

function buildDataCodewords(bytes: Uint8Array, version: number): Uint8Array {
  const cap = dataCapacity(version);
  const lenBits = version < 10 ? 8 : 16;
  const bits: number[] = [];
  const push = (value: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };
  push(0b0100, 4); // byte mode
  push(bytes.length, lenBits);
  for (const b of bytes) push(b, 8);
  // Terminator, up to four zero bits, then pad to a byte boundary.
  for (let i = 0; i < 4 && bits.length < cap * 8; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const out = new Uint8Array(cap);
  for (let i = 0; i < bits.length / 8; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j];
    out[i] = b;
  }
  // Pad codewords alternate 0xEC / 0x11 to the end of the data capacity.
  for (let i = Math.ceil(bits.length / 8); i < cap; i++)
    out[i] = i % 2 === Math.ceil(bits.length / 8) % 2 ? 0xec : 0x11;
  return out;
}

// Split into blocks, add EC to each, then interleave both sets — this is what
// makes a QR survive a coffee ring over one corner.
function interleave(data: Uint8Array, version: number): Uint8Array {
  const t = VERSIONS[version - 1];
  const blocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let at = 0;
  for (let i = 0; i < t.g1n; i++) {
    const b = data.slice(at, at + t.g1d);
    at += t.g1d;
    blocks.push(b);
    ecBlocks.push(rsEncode(b, t.ec));
  }
  for (let i = 0; i < t.g2n; i++) {
    const b = data.slice(at, at + t.g2d);
    at += t.g2d;
    blocks.push(b);
    ecBlocks.push(rsEncode(b, t.ec));
  }
  const out: number[] = [];
  const maxData = Math.max(t.g1d, t.g2n ? t.g2d : 0);
  for (let i = 0; i < maxData; i++)
    for (const b of blocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < t.ec; i++) for (const b of ecBlocks) out.push(b[i]);
  return new Uint8Array(out);
}

// ── Matrix ──────────────────────────────────────────────────────────────────
type Grid = { m: (boolean | null)[][]; size: number };

function blankGrid(version: number): Grid {
  const size = version * 4 + 17;
  const m: (boolean | null)[][] = Array.from({ length: size }, () =>
    new Array<boolean | null>(size).fill(null),
  );
  return { m, size };
}

function placeFunctionPatterns(g: Grid, version: number): void {
  const { m, size } = g;
  const finder = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++)
      for (let c = -1; c <= 7; c++) {
        const rr = r0 + r,
          cc = c0 + c;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        const inRing =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6));
        const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        m[rr][cc] = inRing || inCore;
      }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);

  // Timing patterns.
  for (let i = 8; i < size - 8; i++) {
    m[6][i] = i % 2 === 0;
    m[i][6] = i % 2 === 0;
  }

  // Alignment patterns — skipped where they'd collide with a finder.
  const centres = ALIGN[version - 1];
  for (const r of centres)
    for (const c of centres) {
      if (
        (r <= 8 && c <= 8) ||
        (r <= 8 && c >= size - 9) ||
        (r >= size - 9 && c <= 8)
      )
        continue;
      for (let dr = -2; dr <= 2; dr++)
        for (let dc = -2; dc <= 2; dc++)
          m[r + dr][c + dc] =
            Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
    }

  m[size - 8][8] = true; // the always-dark module

  // Reserve the format areas so data placement skips them.
  for (let i = 0; i < 9; i++) {
    if (m[8][i] === null) m[8][i] = false;
    if (m[i][8] === null) m[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    if (m[8][size - 1 - i] === null) m[8][size - 1 - i] = false;
    if (m[size - 1 - i][8] === null) m[size - 1 - i][8] = false;
  }
  // Version information areas (version 7 and up).
  if (version >= 7)
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 3; j++) {
        if (m[size - 11 + j][i] === null) m[size - 11 + j][i] = false;
        if (m[i][size - 11 + j] === null) m[i][size - 11 + j] = false;
      }
}

// Which cells carry data: everything the function patterns didn't claim.
function placeData(g: Grid, codewords: Uint8Array, reserved: boolean[][]): void {
  const { m, size } = g;
  let bit = 0;
  const total = codewords.length * 8;
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right = 5; // column 6 is the vertical timing pattern
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (let k = 0; k < 2; k++) {
        const col = right - k;
        if (reserved[row][col]) continue;
        let v = false;
        if (bit < total)
          v = ((codewords[bit >> 3] >> (7 - (bit & 7))) & 1) === 1;
        m[row][col] = v;
        bit++;
      }
    }
    upward = !upward;
  }
}

const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyFormat(
  m: boolean[][],
  size: number,
  mask: number,
  version: number,
): void {
  // ECC level M = 0b00.
  const fmt = (bch(mask, 0x537, 10) | (mask << 10)) ^ 0x5412;
  const get = (i: number) => ((fmt >> i) & 1) === 1;
  // First copy, wrapped around the top-left finder: bits 0–6 run DOWN column 8,
  // bit 7 sits in the corner, bits 8–14 run LEFT along row 8. (Getting this
  // pair of arms the wrong way round produces a QR that looks perfectly normal
  // and decodes in nothing.)
  for (let i = 0; i <= 5; i++) m[i][8] = get(i);
  m[7][8] = get(6);
  m[8][8] = get(7);
  m[8][7] = get(8);
  for (let i = 9; i <= 14; i++) m[8][14 - i] = get(i);
  // Second copy: bits 0–7 up column 8 from the bottom, 8–14 along row 8 at the right.
  for (let i = 0; i <= 7; i++) m[size - 1 - i][8] = get(i);
  for (let i = 8; i <= 14; i++) m[8][size - 15 + i] = get(i);
  m[size - 8][8] = true;

  if (version >= 7) {
    const vinfo = bch(version, 0x1f25, 12) | (version << 12);
    for (let i = 0; i < 18; i++) {
      const b = ((vinfo >> i) & 1) === 1;
      m[Math.floor(i / 3)][size - 11 + (i % 3)] = b;
      m[size - 11 + (i % 3)][Math.floor(i / 3)] = b;
    }
  }
}

// The four penalty rules from the spec — lower is easier to scan.
function penalty(m: boolean[][], size: number): number {
  let score = 0;
  // Rule 1: runs of five or more of the same colour.
  for (let i = 0; i < size; i++)
    for (const horizontal of [true, false]) {
      let run = 1;
      for (let j = 1; j < size; j++) {
        const a = horizontal ? m[i][j] : m[j][i];
        const b = horizontal ? m[i][j - 1] : m[j - 1][i];
        if (a === b) run++;
        else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
      if (run >= 5) score += run - 2;
    }
  // Rule 2: 2x2 blocks of one colour.
  for (let i = 0; i < size - 1; i++)
    for (let j = 0; j < size - 1; j++)
      if (
        m[i][j] === m[i][j + 1] &&
        m[i][j] === m[i + 1][j] &&
        m[i][j] === m[i + 1][j + 1]
      )
        score += 3;
  // Rule 3: the finder-like 1:1:3:1:1 pattern.
  const pat1 = [true, false, true, true, true, false, true, false, false, false, false];
  const pat2 = [false, false, false, false, true, false, true, true, true, false, true];
  for (let i = 0; i < size; i++)
    for (let j = 0; j <= size - 11; j++)
      for (const horizontal of [true, false]) {
        let ok1 = true,
          ok2 = true;
        for (let k = 0; k < 11; k++) {
          const v = horizontal ? m[i][j + k] : m[j + k][i];
          if (v !== pat1[k]) ok1 = false;
          if (v !== pat2[k]) ok2 = false;
        }
        if (ok1) score += 40;
        if (ok2) score += 40;
      }
  // Rule 4: how far the dark/light balance is from 50%.
  let dark = 0;
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) if (m[i][j]) dark++;
  const pct = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

/**
 * Encode a string as a QR matrix. `true` = a dark module.
 * Throws if the text is too long for version 10 at level M (≈200 bytes).
 */
export function qrMatrix(text: string): boolean[][] {
  const bytes = toBytes(text);
  const version = pickVersion(bytes.length);
  const codewords = interleave(buildDataCodewords(bytes, version), version);

  const base = blankGrid(version);
  placeFunctionPatterns(base, version);
  // Anything already set is a function pattern — data must skip those cells.
  const reserved = base.m.map((row) => row.map((v) => v !== null));
  placeData(base, codewords, reserved);

  let best: boolean[][] | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const m: boolean[][] = base.m.map((row, r) =>
      row.map((v, c) => {
        const bit = v === true;
        // Only data modules get masked; function patterns are left alone.
        return reserved[r][c] ? bit : bit !== MASKS[mask](r, c);
      }),
    );
    applyFormat(m, base.size, mask, version);
    const s = penalty(m, base.size);
    if (s < bestScore) {
      bestScore = s;
      best = m;
    }
  }
  return best!;
}

/** The calendar link a poster's QR points at for a given event date. */
export function eventQrUrl(date: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) ? date : "";
  return d
    ? `https://nodice.bar/events/?d=${d}`
    : "https://nodice.bar/events/";
}
