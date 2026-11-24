// PayStatusChip — a small, explicit PAID / UNPAID pill shown on every admin
// booking view (table/pool reservations, golf bookings, calendar) so staff can
// tell at a glance whether the money's in (founder 4 Nov 2026). Matches the
// existing status-chip style.
//
// Rules:
//  - paid  → green  "PAID £X"  (amount shown when known)
//  - comp  → teal   "COMP · FREE"  (a free / guest booking — nothing to pay)
//  - owed  → amber  "UNPAID £X"  (money expected but not collected yet)
//  - no amount, not paid, not comp → nothing (a free walk-in table hold; a
//    blanket "unpaid" there would just be noise).
export default function PayStatusChip({
  paid,
  amountPence,
  comp = false,
  className = "",
}: {
  paid: boolean;
  amountPence?: number | null;
  comp?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] " +
    className;
  const hasAmount = typeof amountPence === "number" && amountPence > 0;
  const amt = hasAmount ? ` £${(amountPence! / 100).toFixed(2)}` : "";

  if (paid) {
    return <span className={`${base} bg-green-400/15 text-green-300`}>Paid{amt}</span>;
  }
  if (comp) {
    return <span className={`${base} bg-plonkTeal/15 text-plonkTeal`}>Comp · free</span>;
  }
  if (!hasAmount) return null;
  return <span className={`${base} bg-amber-400/15 text-amber-300`}>Unpaid{amt}</span>;
}
