"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { fmtMoney } from "@/lib/format";
import { loadVenues, type DbVenue } from "@/lib/db/tickets";
import { loadBookings, slotIso, type DbBookingRow } from "@/lib/db/bookings";

function describe(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  return fallback;
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  x.setDate(x.getDate() + diff);
  return x;
}

export default function CalendarClient() {
  const [venues, setVenues] = useState<DbVenue[]>([]);
  const [bookings, setBookings] = useState<DbBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [weekOffset, setWeekOffset] = useState(0); // weeks from current

  useEffect(() => {
    (async () => {
      try {
        const [v, b] = await Promise.all([loadVenues(), loadBookings()]);
        setVenues(v);
        setBookings(b);
      } catch (e) {
        setErr(describe(e, "Failed to load bookings"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const monday = useMemo(() => {
    const m = startOfWeek(new Date());
    m.setDate(m.getDate() + weekOffset * 7);
    return m;
  }, [weekOffset]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d;
      }),
    [monday],
  );

  function bookingsOnDay(d: Date) {
    return bookings
      .filter((b) => {
        const iso = slotIso(b);
        if (!iso) return false;
        const bd = new Date(iso);
        return (
          bd.getFullYear() === d.getFullYear() &&
          bd.getMonth() === d.getMonth() &&
          bd.getDate() === d.getDate()
        );
      })
      .sort((a, b) => {
        const ia = slotIso(a) ?? "";
        const ib = slotIso(b) ?? "";
        return ia.localeCompare(ib);
      });
  }

  // For the venue badge — show 3-char abbreviation of the venue name.
  const venueBadge = (id: string) => {
    const v = venues.find((x) => x.id === id);
    if (!v) return "—";
    return v.name.replace("Plonk ", "").slice(0, 3).toUpperCase();
  };
  const venueColour = (id: string) => {
    const v = venues.find((x) => x.id === id);
    if (!v) return "text-cream/60";
    // Hackney → pink, Borough → teal. Anything else → yellow.
    if (v.slug.startsWith("hackney")) return "text-plonkPink";
    if (v.slug.startsWith("borough")) return "text-plonkTeal";
    return "text-plonkYellow";
  };

  return (
    <>
      <AdminPageHeader
        title="Calendar"
        description="Week-at-a-glance view of bookings across both venues."
        action={
          <Link
            href="/admin/bookings"
            className="rounded-full border border-cream/15 px-5 py-2 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            Table view
          </Link>
        }
      />

      {err && (
        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => setWeekOffset((w) => w - 1)}
          className="rounded-full border border-cream/15 px-4 py-1.5 text-xs hover:bg-cream/5"
        >
          ← Previous week
        </button>
        <p className="font-display text-lg">
          Week of {monday.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
        </p>
        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          className="rounded-full border border-cream/15 px-4 py-1.5 text-xs hover:bg-cream/5"
        >
          Next week →
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-cream/60">Loading…</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-7">
          {days.map((d) => {
            const items = bookingsOnDay(d);
            const total = items.reduce(
              (s, b) => s + (b.status === "confirmed" ? b.total_pence : 0),
              0,
            );
            const isToday = d.toDateString() === new Date().toDateString();
            return (
              <AdminCard key={d.toISOString()}>
                <div
                  className={`border-b border-cream/10 px-4 py-3 ${
                    isToday ? "bg-plonkPink/10" : ""
                  }`}
                >
                  <p className="text-xs font-bold uppercase tracking-widest text-plonkYellow">
                    {d.toLocaleDateString("en-GB", { weekday: "short" })}
                  </p>
                  <p className="font-display text-xl">
                    {d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </p>
                  <p className="mt-0.5 text-xs text-cream/55">
                    {items.length} booking{items.length === 1 ? "" : "s"} · {fmtMoney(total)}
                  </p>
                </div>
                <ul className="divide-y divide-cream/5">
                  {items.length === 0 ? (
                    <li className="px-4 py-4 text-center text-xs text-cream/40">— empty —</li>
                  ) : (
                    items.map((b) => {
                      const iso = slotIso(b);
                      const time = iso
                        ? new Date(iso).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—";
                      return (
                        <li key={b.id} className="px-4 py-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-cream/85">{time}</span>
                            <span
                              className={`text-[10px] uppercase tracking-widest ${venueColour(
                                b.venue_id,
                              )}`}
                            >
                              {venueBadge(b.venue_id)}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-cream/85">{b.customer_name}</p>
                          <p className="text-[11px] text-cream/55">
                            {b.party_size} ppl · {fmtMoney(b.total_pence)}
                          </p>
                        </li>
                      );
                    })
                  )}
                </ul>
              </AdminCard>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-cream/55">
        <span>
          <span className="text-plonkPink">●</span> Hackney
        </span>
        <span>
          <span className="text-plonkTeal">●</span> Borough Market
        </span>
      </div>
    </>
  );
}
