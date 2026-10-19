// =============================================================
// UK 90-ball bingo card generator
// =============================================================
// A standard UK bingo ticket: 3 rows × 9 columns, 15 numbers (5 per row),
// the rest blank. Column ranges: col0 = 1–9, col1 = 10–19 … col7 = 70–79,
// col8 = 80–90. Each column holds 1–3 numbers, sorted top→bottom; every
// column has at least one number; every row has exactly five.
//
// Pure, deterministic-given-a-seed-free client util — no DB, no network.
// Each generated card is effectively unique (15 of 90 in a constrained
// layout → astronomically low collision); generateBatch() also de-dupes by
// signature to be certain within a print run.
// =============================================================

export type BingoCard = (number | null)[][]; // [3 rows][9 cols]

function randInt(n: number): number {
  return Math.floor(Math.random() * n);
}
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function colRange(c: number): [number, number] {
  if (c === 0) return [1, 9];
  if (c === 8) return [80, 90];
  return [c * 10, c * 10 + 9];
}

// Column number-counts: 9 values each 1–3 summing to 15 (start at 1 each = 9,
// then sprinkle 6 more, max 3 per column).
function columnCounts(): number[] {
  const counts = Array(9).fill(1);
  let extra = 6;
  while (extra > 0) {
    const c = randInt(9);
    if (counts[c] < 3) {
      counts[c]++;
      extra--;
    }
  }
  return counts;
}

// Assign each column's numbers to rows so every row ends with exactly 5.
// Randomised greedy with full restart on dead-end; always converges fast.
function rowAssignment(counts: number[]): number[][] {
  for (let attempt = 0; attempt < 2000; attempt++) {
    const rowCount = [0, 0, 0];
    const chosen: number[][] = [];
    let ok = true;
    for (let c = 0; c < 9; c++) {
      const avail = [0, 1, 2].filter((r) => rowCount[r] < 5);
      if (avail.length < counts[c]) {
        ok = false;
        break;
      }
      const pick = shuffle(avail).slice(0, counts[c]);
      pick.forEach((r) => rowCount[r]++);
      chosen.push(pick.sort((a, b) => a - b));
    }
    if (ok && rowCount[0] === 5 && rowCount[1] === 5 && rowCount[2] === 5) {
      return chosen;
    }
  }
  // Deterministic fallback (counts all 1 or 2 round-robin) — practically never hit.
  const chosen: number[][] = [];
  const rowCount = [0, 0, 0];
  for (let c = 0; c < 9; c++) {
    const avail = [0, 1, 2]
      .filter((r) => rowCount[r] < 5)
      .sort((a, b) => rowCount[a] - rowCount[b]);
    const pick = avail.slice(0, counts[c]).sort((a, b) => a - b);
    pick.forEach((r) => rowCount[r]++);
    chosen.push(pick);
  }
  return chosen;
}

function sampleSorted(lo: number, hi: number, k: number): number[] {
  const pool: number[] = [];
  for (let n = lo; n <= hi; n++) pool.push(n);
  return shuffle(pool)
    .slice(0, k)
    .sort((a, b) => a - b);
}

export function generateCard(): BingoCard {
  const counts = columnCounts();
  const rows = rowAssignment(counts);
  const grid: BingoCard = [
    Array(9).fill(null),
    Array(9).fill(null),
    Array(9).fill(null),
  ];
  for (let c = 0; c < 9; c++) {
    const [lo, hi] = colRange(c);
    const nums = sampleSorted(lo, hi, counts[c]);
    rows[c].forEach((r, i) => {
      grid[r][c] = nums[i];
    });
  }
  return grid;
}

function signature(card: BingoCard): string {
  return card.map((row) => row.map((n) => n ?? "_").join(",")).join("|");
}

export function generateBatch(n: number): BingoCard[] {
  const out: BingoCard[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < n && guard < n * 50 + 100) {
    guard++;
    const card = generateCard();
    const sig = signature(card);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(card);
  }
  return out;
}
