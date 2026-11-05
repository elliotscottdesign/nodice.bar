// =============================================================
// bookingFee — optional, retained online booking fee
// =============================================================
// Founder policy (5 Nov 2026): online bookings may carry a % booking fee that
// No Dice keeps (non-refundable admin fee). Built as an OPTION, OFF by default —
// nothing changes for customers until crm_settings.online_booking_fee_enabled
// is set to "1" AND the wired checkout functions are deployed.
//
// Keys (crm_settings):
//   online_booking_fee_enabled  "0" | "1"  (default off)
//   online_booking_fee_pct      e.g. "10"  (percent)
//
// Usage in a checkout, after you've computed the real subtotal:
//   const fee = await bookingFeePence(db, subtotal);
//   const total = subtotal + fee;   // charge `total`, store it, keep the fee
// =============================================================

// deno-lint-ignore no-explicit-any
export async function bookingFeePence(db: any, subtotalPence: number): Promise<number> {
  if (!(subtotalPence > 0)) return 0;
  try {
    const { data } = await db
      .from("crm_settings")
      .select("key, value")
      .in("key", ["online_booking_fee_enabled", "online_booking_fee_pct"]);
    const m = new Map((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
    if ((m.get("online_booking_fee_enabled") ?? "0") !== "1") return 0;
    const pct = Number(m.get("online_booking_fee_pct") ?? "10") || 0;
    if (pct <= 0) return 0;
    return Math.round((subtotalPence * pct) / 100);
  } catch {
    // If the setting can't be read, charge no extra fee — never block a booking.
    return 0;
  }
}
