"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { fmtMoney, fmtDate, fmtTime } from "@/lib/format";
import { loadVenues, type DbVenue } from "@/lib/db/tickets";
import { loadBookings, slotIso, type DbBookingRow } from "@/lib/db/bookings";

function describe(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  return fallback;
}

function isSameDay(iso: string, ref: Date) {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

export default function DashboardClient() {
  const [venues, setVenues] = useState<DbVenue[]>([]);
  const [bookings, setBookings] = useState<DbBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [v, b] = await Promise.all([loadVenues(), loadBookings()]);
        setVenues(v);
        setBookings(b);
      } catch (e) {
        setErr(describe(e, "Failed to load dashboard data"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const today = useMemo(() => new Date(), []);
  const todays = useMemo(
    () =>
      bookings.filter((b) => {
        if (b.status !== "confirmed") return false;
        const iso = slotIso(b);
        return iso ? isSameDay(iso, today) : false;
      }),
    [bookings, today],
  );
  const todaysRevenue = todays.reduce((s, b) => s + b.total_pence, 0);
  const todaysHeads = todays.reduce((s, b) => s + b.party_size, 0);

  const next7 = useMemo(() => {
    const start = today.getTime();
    const end = start + 7 * 24 * 3600 * 1000;
    return bookings.filter((b) => {
      if (b.status !== "confirmed") return false;
      const iso = slotIso(b);
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return t >= start && t <= end;
    });
  }, [bookings, today]);
  const next7Revenue = next7.reduce((s, b) => s + b.total_pence, 0);

  function venueLabel(id: string) {
    return venues.find((v) => v.id === id)?.name ?? "—";
  }

  return (
    <>
      <AdminPageHeader title="Dashboard" description="Snapshot of today and the week ahead." />

      {err && (
        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-cream/60">Loading…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile
              label="Today's revenue"
              value={fmtMoney(todaysRevenue)}
              sub={`${todays.length} bookings`}
            />
            <Tile
              label="Today's golfers"
              value={todaysHeads.toString()}
              sub="confirmed heads"
            />
            <Tile
              label="Next 7 days revenue"
              value={fmtMoney(next7Revenue)}
              sub={`${next7.length} bookings`}
            />
            <Tile
              label="Active venues"
              value={venues.length.toString()}
              sub={venues.map((v) => v.name.replace("Plonk ", "")).join(" + ") || "—"}
            />
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <AdminCard
              title="Today's bookings"
              action={
                <Link
                  href="/admin/bookings"
                  className="text-xs font-semibold uppercase tracking-wider text-plonkYellow hover:underline"
                >
                  All bookings →
                </Link>
              }
            >
              {todays.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-cream/55">
                  No bookings today.
                </p>
              ) : (
                <ul className="divide-y divide-cream/5">
                  {todays.map((b) => {
                    const iso = slotIso(b);
                    return (
                      <li
                        key={b.id}
                        className="flex items-center justify-between px-5 py-3 text-sm"
                      >
                        <div>
                          <p className="font-medium">{b.customer_name}</p>
                          <p className="text-xs text-cream/55">
                            {iso ? fmtTime(iso) : "—"} · {venueLabel(b.venue_id)} ·{" "}
                            {b.party_size} people
                          </p>
                        </div>
                        <span className="text-sm text-cream/85">
                          {fmtMoney(b.total_pence)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </AdminCard>

            <AdminCard title="Quick actions">
              <ul className="divide-y divide-cream/5">
                {[
                  { label: "Edit ticket prices", href: "/admin/tickets" },
                  { label: "Block a date (private hire / holiday)", href: "/admin/closed" },
                  { label: "Create a promo code", href: "/admin/promos" },
                  { label: "Issue a gift voucher", href: "/admin/vouchers" },
                  { label: "View calendar of bookings", href: "/admin/bookings/calendar" },
                ].map((a) => (
                  <li key={a.href}>
                    <Link
                      href={a.href}
                      className="block px-5 py-3 text-sm text-cream/80 transition hover:bg-cream/5 hover:text-cream"
                    >
                      {a.label} →
                    </Link>
                  </li>
                ))}
              </ul>
            </AdminCard>
          </div>

          <div className="mt-8">
            <AdminCard title="Next 7 days">
              {next7.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-cream/55">
                  No upcoming bookings.
                </p>
              ) : (
                <ul className="divide-y divide-cream/5">
                  {next7.map((b) => {
                    const iso = slotIso(b);
                    return (
                      <li
                        key={b.id}
                        className="grid grid-cols-12 items-center gap-4 px-5 py-3 text-sm"
                      >
                        <span className="col-span-3 text-xs text-cream/55">
                          {iso ? `${fmtDate(iso)} · ${fmtTime(iso)}` : "—"}
                        </span>
                        <span className="col-span-2 text-xs text-plonkYellow">
                          {venueLabel(b.venue_id).replace("Plonk ", "")}
                        </span>
                        <span className="col-span-4">{b.customer_name}</span>
                        <span className="col-span-1 text-xs text-cream/55">
                          {b.party_size} ppl
                        </span>
                        <span className="col-span-2 text-right text-cream/85">
                          {fmtMoney(b.total_pence)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </AdminCard>
          </div>
        </>
      )}
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-cream/10 bg-ink/40 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-plonkYellow">{label}</p>
      <p className="mt-2 font-display text-3xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-cream/55">{sub}</p>}
    </div>
  );
}
