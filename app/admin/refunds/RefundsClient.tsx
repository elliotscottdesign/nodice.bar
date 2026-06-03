"use client";

import { useEffect, useMemo, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { fmtMoney } from "@/lib/format";
import { loadVenues, type DbVenue } from "@/lib/db/tickets";
import { loadBookings, firstSlot, type DbBookingRow } from "@/lib/db/bookings";

function describe(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  return fallback;
}

function stripePaymentUrl(pi: string | null) {
  if (!pi) return null;
  // The Stripe dashboard URL pattern. We open in a new tab — the user
  // does the actual refund from inside Stripe, then a `charge.refunded`
  // webhook (configured later) flips our booking to status=refunded.
  return `https://dashboard.stripe.com/payments/${pi}`;
}

export default function RefundsClient() {
  const [venues, setVenues] = useState<DbVenue[]>([]);
  const [bookings, setBookings] = useState<DbBookingRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      const [v, b] = await Promise.all([loadVenues(), loadBookings()]);
      setVenues(v);
      setBookings(b);
    } catch (e) {
      setErr(describe(e, "Failed to load bookings"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  const refunded = useMemo(
    () => bookings.filter((b) => b.status === "refunded"),
    [bookings],
  );
  const refundable = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings
      .filter((b) => b.status === "confirmed")
      .filter((b) => {
        if (!q) return true;
        return (
          b.reference.toLowerCase().includes(q) ||
          b.customer_email.toLowerCase().includes(q) ||
          b.customer_name.toLowerCase().includes(q)
        );
      })
      .slice(0, 50);
  }, [bookings, search]);

  function venueName(id: string) {
    return venues.find((v) => v.id === id)?.name.replace("Plonk ", "") ?? "—";
  }

  return (
    <>
      <AdminPageHeader
        title="Refunds"
        description="Refund a booking — Stripe processes the refund within 5–10 working days."
      />

      {err && (
        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      )}

      <AdminCard
        title="Recent refunds"
        action={
          <span className="text-xs text-cream/55">
            {refunded.length} refund{refunded.length === 1 ? "" : "s"} on record
          </span>
        }
      >
        {refunded.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-cream/55">
            No refunds processed yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream/10 text-left text-xs uppercase tracking-widest text-cream/50">
                  <th className="px-5 py-3 font-bold">Ref</th>
                  <th className="px-5 py-3 font-bold">Slot</th>
                  <th className="px-5 py-3 font-bold">Customer</th>
                  <th className="px-5 py-3 font-bold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {refunded.map((b) => {
                  const slot = firstSlot(b);
                  return (
                    <tr key={b.id} className="border-b border-cream/5 last:border-b-0">
                      <td className="px-5 py-3 font-mono text-xs">{b.reference}</td>
                      <td className="px-5 py-3 text-xs text-cream/85">
                        {slot
                          ? `${new Date(slot.slot_date + "T12:00:00").toLocaleDateString(
                              "en-GB",
                              { weekday: "short", day: "numeric", month: "short" },
                            )} · ${slot.slot_time.slice(0, 5)}`
                          : "—"}
                      </td>
                      <td className="px-5 py-3">{b.customer_name}</td>
                      <td className="px-5 py-3 font-medium text-red-300">
                        −{fmtMoney(b.total_pence)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      <div className="mt-8">
        <AdminCard title="Find a booking to refund">
          <div className="border-b border-cream/10 px-5 py-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by reference, email, or name…"
              className="w-full rounded-full border border-cream/15 bg-ink/40 px-4 py-2 text-sm text-cream placeholder:text-cream/40 focus:border-plonkPink focus:outline-none"
            />
          </div>
          {loading ? (
            <p className="px-5 py-8 text-sm text-cream/60">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cream/10 text-left text-xs uppercase tracking-widest text-cream/50">
                    <th className="px-5 py-3 font-bold">Ref</th>
                    <th className="px-5 py-3 font-bold">Slot</th>
                    <th className="px-5 py-3 font-bold">Venue</th>
                    <th className="px-5 py-3 font-bold">Customer</th>
                    <th className="px-5 py-3 font-bold">Amount</th>
                    <th className="px-5 py-3 text-right font-bold"></th>
                  </tr>
                </thead>
                <tbody>
                  {refundable.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-sm text-cream/55">
                        No confirmed bookings match.
                      </td>
                    </tr>
                  )}
                  {refundable.map((b) => {
                    const slot = firstSlot(b);
                    const piUrl = stripePaymentUrl(b.stripe_payment_intent_id);
                    return (
                      <tr
                        key={b.id}
                        className="border-b border-cream/5 last:border-b-0 hover:bg-cream/5"
                      >
                        <td className="px-5 py-3 font-mono text-xs">{b.reference}</td>
                        <td className="px-5 py-3 text-xs text-cream/85">
                          {slot
                            ? `${new Date(slot.slot_date + "T12:00:00").toLocaleDateString(
                                "en-GB",
                                { weekday: "short", day: "numeric", month: "short" },
                              )} · ${slot.slot_time.slice(0, 5)}`
                            : "—"}
                        </td>
                        <td className="px-5 py-3 text-xs text-plonkYellow">
                          {venueName(b.venue_id)}
                        </td>
                        <td className="px-5 py-3">{b.customer_name}</td>
                        <td className="px-5 py-3 font-medium">{fmtMoney(b.total_pence)}</td>
                        <td className="px-5 py-3 text-right">
                          {piUrl ? (
                            <a
                              href={piUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-full bg-red-400/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-red-300 hover:bg-red-400/25"
                            >
                              Refund in Stripe ↗
                            </a>
                          ) : (
                            <span className="text-xs text-cream/40">No PI on record</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>

        <p className="mt-4 text-xs text-cream/50">
          Clicking "Refund in Stripe" opens the payment in your Stripe Dashboard
          so you can refund full or partial there. Once you've refunded, the
          booking flips to "refunded" automatically (via Stripe webhook).
        </p>
      </div>
    </>
  );
}
