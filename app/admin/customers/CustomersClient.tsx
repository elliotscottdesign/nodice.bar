"use client";

import { useEffect, useMemo, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { fmtMoney } from "@/lib/format";
import { loadBookings, slotIso, type DbBookingRow } from "@/lib/db/bookings";

type CustomerRow = {
  email: string;
  name: string;
  bookings: number;
  heads: number;
  totalSpent: number;
  lastVisit: string | null;
  nextVisit: string | null;
};

function describe(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  return fallback;
}

function aggregate(bookings: DbBookingRow[]): CustomerRow[] {
  const map = new Map<string, CustomerRow>();
  const now = Date.now();
  for (const b of bookings) {
    if (b.status !== "confirmed") continue;
    const key = b.customer_email.toLowerCase();
    const r = map.get(key) ?? {
      email: b.customer_email,
      name: b.customer_name,
      bookings: 0,
      heads: 0,
      totalSpent: 0,
      lastVisit: null,
      nextVisit: null,
    };
    r.bookings += 1;
    r.heads += b.party_size;
    r.totalSpent += b.total_pence;
    const iso = slotIso(b);
    if (iso) {
      const t = new Date(iso).getTime();
      if (t < now) {
        if (!r.lastVisit || new Date(r.lastVisit).getTime() < t) r.lastVisit = iso;
      } else {
        if (!r.nextVisit || new Date(r.nextVisit).getTime() > t) r.nextVisit = iso;
      }
    }
    map.set(key, r);
  }
  return [...map.values()].sort((a, b) => b.totalSpent - a.totalSpent);
}

const FMT_DATE = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

export default function CustomersClient() {
  const [bookings, setBookings] = useState<DbBookingRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setBookings(await loadBookings());
      } catch (e) {
        setErr(describe(e, "Failed to load bookings"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rows = useMemo(() => aggregate(bookings), [bookings]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.email.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
    );
  }, [rows, search]);

  return (
    <>
      <AdminPageHeader
        title="Customers"
        description="Everyone who's booked, sorted by total spend."
        action={
          <input
            type="search"
            placeholder="Search by email or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-full border border-cream/15 bg-ink/40 px-4 py-2 text-xs text-cream placeholder:text-cream/40 focus:border-plonkPink focus:outline-none"
          />
        }
      />

      {err && (
        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-cream/60">Loading…</p>
      ) : (
        <AdminCard>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream/10 text-left text-xs uppercase tracking-widest text-cream/50">
                  <th className="px-5 py-3 font-bold">Customer</th>
                  <th className="px-5 py-3 font-bold">Bookings</th>
                  <th className="px-5 py-3 font-bold">Heads</th>
                  <th className="px-5 py-3 font-bold">Total spent</th>
                  <th className="px-5 py-3 font-bold">Last visit</th>
                  <th className="px-5 py-3 font-bold">Next visit</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-cream/55">
                      {rows.length === 0
                        ? "No confirmed bookings yet."
                        : "No customers match your search."}
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr
                    key={r.email}
                    className="border-b border-cream/5 last:border-b-0 hover:bg-cream/5"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-cream/55">{r.email}</p>
                    </td>
                    <td className="px-5 py-3 text-cream/85">{r.bookings}</td>
                    <td className="px-5 py-3 text-cream/85">{r.heads}</td>
                    <td className="px-5 py-3 font-medium">{fmtMoney(r.totalSpent)}</td>
                    <td className="px-5 py-3 text-xs text-cream/65">{FMT_DATE(r.lastVisit)}</td>
                    <td className="px-5 py-3 text-xs text-cream/65">{FMT_DATE(r.nextVisit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}

      <p className="mt-6 text-xs text-cream/50">
        Customer rows are aggregated by email from confirmed bookings.
      </p>
    </>
  );
}
