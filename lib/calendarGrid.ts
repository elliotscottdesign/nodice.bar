// Shared Monday-first month grid.
//
// Extracted from app/admin/calendar/DayCalendarClient.tsx so the
// tournament/special-events tracker calendar view and the booking
// calendar build their month grids the exact same way.
//
// `month` is ZERO-BASED (0 = January), matching JS Date.getMonth().

// Mon-Sun grid with leading/trailing nulls so every row is 7 cells.
// Leading nulls = (getDay()+6)%7 of the 1st (0 = Monday), then 1..n,
// padded to a multiple of 7.
export function buildMonthGrid(year: number, month: number): (number | null)[] {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = Mon
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// YYYY-MM-DD for a given calendar day (month is zero-based).
export function ymd(year: number, month: number, day: number): string {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}
