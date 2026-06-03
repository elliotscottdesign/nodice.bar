"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { fmtMoney } from "@/lib/format";
import { loadVenues, type DbVenue } from "@/lib/db/tickets";
import {
  loadBookings,
  firstSlot,
  type DbBookingRow,
  type BookingStatus,
} from "@/lib/db/bookings";

const STATUS_FILTERS: { label: string; value: BookingStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Pending", value: "pending" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Refunded", value: "refunded" },
];

function describe(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  return fallback;
}

export default function BookingsClient() {
  const [venues, setVenues] = useState<DbVenue[]>([]);
  const [bookings, setBookings] = useState<DbBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");
  const [venueFilter, setVenueFilter] = useState<string | "all">("all");

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

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (venueFilter !== "all" && b.venue_id !== venueFilter) return false;
      return true;
    });
  }, [bookings, statusFilter, venueFilter]);

  return (
    <>
      <AdminPageHeader
        title="Bookings"
        description="Every booking taken. Most recent first."
        action={
          <div className="flex gap-2">
            <Link
              href="/admin/bookings/calendar"
              className="rounded-full border border-cream/15 px-5 py-2 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
            >
              Calendar view
            </Link>
          </div>
        }
      />

      {err && (
        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {STATUS_FILTERS.map((f) => (
          <Filter
            key={f.value}
            label={f.label}
            active={statusFilter === f.value}
            onClick={() => setStatusFilter(f.value)}
          />
        ))}
        <span className="mx-2 text-cream/30">·</span>
        <Filter
          label="Both venues"
          active={venueFilter === "all"}
          onClick={() => setVenueFilter("all")}
        />
        {venues.map((v) => (
          <Filter
            key={v.id}
            label={v.name.replace("Plonk ", "")}
            active={venueFilter === v.id}
            onClick={() => setVenueFilter(v.id)}
          />
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-cream/60">Loading…</p>
      ) : (
        <AdminCard>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream/10 text-left text-xs uppercase tracking-widest text-cream/50">
                  <th className="px-5 py-3 font-bold">Ref</th>
                  <th className="px-5 py-3 font-bold">Slot</th>
                  <th className="px-5 py-3 font-bold">Venue</th>
                  <th className="px-5 py-3 font-bold">Customer</th>
                  <th className="px-5 py-3 font-bold">Size</th>
                  <th className="px-5 py-3 font-bold">Total</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-cream/55">
                      No bookings match the current filter.
                    </td>
                  </tr>
                )}
                {filtered.map((b) => {
                  const slot = firstSlot(b);
                  const venueName =
                    venues.find((v) => v.id === b.venue_id)?.name.replace("Plonk ", "") ?? "—";
                  return (
                    <tr key={b.id} className="border-b border-cream/5 last:border-b-0 hover:bg-cream/5">
                      <td className="px-5 py-3 font-mono text-xs">{b.reference}</td>
                      <td className="px-5 py-3 text-xs text-cream/85">
                        {slot
                          ? `${new Date(slot.slot_date + "T12:00:00").toLocaleDateString(
                              "en-GB",
                              { weekday: "short", day: "numeric", month: "short" },
                            )} · ${slot.slot_time.slice(0, 5)}`
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-plonkYellow text-xs">{venueName}</td>
                      <td className="px-5 py-3">
                        <p className="font-medium">{b.customer_name}</p>
                        <p className="text-xs text-cream/55">{b.customer_email}</p>
                      </td>
                      <td className="px-5 py-3 text-cream/85">{b.party_size}</td>
                      <td className="px-5 py-3 font-medium">{fmtMoney(b.total_pence)}</td>
                      <td className="px-5 py-3">
                        <StatusPill status={b.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}
    </>
  );
}

function Filter({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 transition ${
        active
          ? "border-plonkPink bg-plonkPink/15 text-cream"
          : "border-cream/15 text-cream/70 hover:bg-cream/5"
      }`}
    >
      {label}
    </button>
  );
}

function StatusPill({ status }: { status: BookingStatus }) {
  const styles: Record<BookingStatus, string> = {
    confirmed: "bg-plonkTeal/15 text-plonkTeal",
    pending: "bg-plonkYellow/15 text-plonkYellow",
    cancelled: "bg-cream/10 text-cream/60",
    expired: "bg-cream/10 text-cream/60",
    refunded: "bg-red-400/15 text-red-300",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${styles[status]}`}
    >
      {status}
    </span>
  );
}
