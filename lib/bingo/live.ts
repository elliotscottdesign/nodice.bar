// Shared helpers for the 75-ball live caller board.
// Column letters: B 1-15, I 16-30, N 31-45, G 46-60, O 61-75.

export const COLUMNS: { letter: string; lo: number; hi: number }[] = [
  { letter: "B", lo: 1, hi: 15 },
  { letter: "I", lo: 16, hi: 30 },
  { letter: "N", lo: 31, hi: 45 },
  { letter: "G", lo: 46, hi: 60 },
  { letter: "O", lo: 61, hi: 75 },
];

export function letterFor(n: number): string {
  const col = COLUMNS.find((c) => n >= c.lo && n <= c.hi);
  return col ? col.letter : "";
}

export function ballLabel(n: number | null | undefined): string {
  if (n == null) return "";
  return `${letterFor(n)}${n}`;
}
