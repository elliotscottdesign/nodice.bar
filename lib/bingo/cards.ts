// =============================================================
// 75-ball bingo card generator (B-I-N-G-O, 5×5, free centre)
// =============================================================
// US-style 75-ball card (founder, 19 Oct): 5 columns B I N G O, 5 rows,
// the centre square (N, row 3) is a FREE / joker space.
//   B = 1–15, I = 16–30, N = 31–45, G = 46–60, O = 61–75
// Each column holds 5 distinct numbers from its range (N holds 4 + the free
// centre), sorted top→bottom. 24 numbers + 1 free per card.
//
// Pure client util — no DB, no network. generateBatch() de-dupes by signature
// within a print run (cards are effectively unique anyway).
// =============================================================

export const COLS = ["B", "I", "N", "G", "O"] as const;
export const FREE = "FREE" as const;

// grid[row][col], col 0..4 = B,I,N,G,O. Centre grid[2][2] = FREE.
export type BingoCell = number | typeof FREE;
export type BingoCard = BingoCell[][]; // 5×5

const RANGES: [number, number][] = [
  [1, 15],
  [16, 30],
  [31, 45],
  [46, 60],
  [61, 75],
];

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
function sampleSorted(lo: number, hi: number, k: number): number[] {
  const pool: number[] = [];
  for (let n = lo; n <= hi; n++) pool.push(n);
  return shuffle(pool)
    .slice(0, k)
    .sort((a, b) => a - b);
}

export function generateCard(): BingoCard {
  // Start with a 5×5 grid.
  const grid: BingoCard = Array.from({ length: 5 }, () =>
    Array<BingoCell>(5).fill(0),
  );
  for (let c = 0; c < 5; c++) {
    const [lo, hi] = RANGES[c];
    const isN = c === 2;
    const nums = sampleSorted(lo, hi, isN ? 4 : 5);
    if (isN) {
      // rows 0,1,3,4 get numbers; row 2 is the free centre.
      const rows = [0, 1, 3, 4];
      rows.forEach((r, i) => {
        grid[r][c] = nums[i];
      });
      grid[2][c] = FREE;
    } else {
      for (let r = 0; r < 5; r++) grid[r][c] = nums[r];
    }
  }
  return grid;
}

function signature(card: BingoCard): string {
  return card.map((row) => row.join(",")).join("|");
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
