// Return YYYY-MM-DD for a Date using its LOCAL calendar fields.
// Why not d.toISOString().slice(0, 10)? Because toISOString() returns the
// UTC date, so anywhere east of UTC (e.g. London during BST = UTC+1) a
// midnight-local Date prints as the *previous* UTC day. That breaks day-
// of-week logic — a Tuesday becomes "Monday" once stored as ISO.
export function localIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
