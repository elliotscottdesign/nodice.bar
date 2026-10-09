"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import AddGolfBookingForm from "@/components/admin/AddGolfBookingForm";
import BookingLockedTag from "@/components/admin/BookingLockedTag";
import { fmtMoney } from "@/lib/format";
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
  const [bookings, setBookings] = useState<DbBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");
  // Search + sortable columns (founder 5 Oct 2026).
  const [search, setSearch] = useState("");
  // Date filters — same set as the pool/table reservations toolbar so the
  // two lists match (founder 5 Oct 2026).
  const [dateFilter, setDateFilter] = useState<
    "upcoming" | "today" | "week" | "past" | "all"
  >("upcoming");
  const [jumpDate, setJumpDate] = useState("");
  type SortKey =
    | "ref" | "slot" | "customer" | "size" | "total" | "status";
  const [sortKey, setSortKey] = useState<SortKey>("slot");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      const b = await loadBookings();
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
    const q = search.trim().toLowerCase();
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const weekEnd = new Date(now.getTime() + 7 * 86400_000);
    const weekIso = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, "0")}-${String(weekEnd.getDate()).padStart(2, "0")}`;
    const rows = bookings.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      // Date filter — by the booking's first slot date.
      const sd = firstSlot(b)?.slot_date ?? "";
      if (jumpDate) {
        if (sd !== jumpDate) return false;
      } else if (dateFilter === "today") {
        if (sd !== todayIso) return false;
      } else if (dateFilter === "upcoming") {
        if (sd < todayIso) return false;
      } else if (dateFilter === "week") {
        if (sd < todayIso || sd > weekIso) return false;
      } else if (dateFilter === "past") {
        if (sd >= todayIso) return false;
      }
      if (q) {
        const hay = [
          b.reference,
          b.customer_name,
          b.customer_email,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // Sort value per column. Slot sorts by the first slot's date+time ISO
    // string (chronological); numbers compare numerically; text A–Z.
    const val = (b: DbBookingRow): string | number => {
      switch (sortKey) {
        case "ref": return b.reference.toLowerCase();
        case "slot": {
          const s = firstSlot(b);
          return s ? `${s.slot_date}T${s.slot_time}` : "";
        }
        case "customer": return b.customer_name.toLowerCase();
        case "size": return b.party_size;
        case "total": return b.total_pence;
        case "status": return b.status;
      }
    };
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [bookings, statusFilter, search, sortKey, sortDir, dateFilter, jumpDate]);

  return (
    <>
      <AdminPageHeader
        title="Bookings"
        description="Every booking taken. Search, or tap any column heading to sort."
      />

      {err && (
        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      )}

      {/* Toolbar — same three-row layout as the pool/table reservations
          page (founder 5 Oct 2026): add button, search, status pills,
          then date filters + calendar. */}
      <div className="mb-4">
        <AddGolfBookingForm onCreated={reload} />
      </div>

      {/* Row 1 — search */}
      <div className="mb-3 flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ref, name, email…"
          className="min-w-[220px] flex-1 rounded-full border border-cream/15 bg-ink/40 px-4 py-1.5 text-xs text-cream placeholder:text-cream/40 focus:border-plonkPink focus:outline-none"
        />
      </div>

      {/* Row 2 — status pills */}
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {STATUS_FILTERS.map((f) => (
          <Filter
            key={f.value}
            label={f.label}
            active={statusFilter === f.value}
            onClick={() => setStatusFilter(f.value)}
          />
        ))}
      </div>

      {/* Row 3 — date filters + calendar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            { id: "upcoming" as const, label: "Upcoming" },
            { id: "today" as const, label: "Today" },
            { id: "week" as const, label: "Next 7 days" },
            { id: "past" as const, label: "Past" },
            { id: "all" as const, label: "All dates" },
          ]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setDateFilter(t.id);
              setJumpDate("");
            }}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
              dateFilter === t.id && !jumpDate
                ? "border-plonkYellow bg-plonkYellow/15 text-plonkYellow"
                : "border-cream/15 bg-ink/40 text-cream/60 hover:border-cream/40"
            }`}
          >
            {t.label}
          </button>
        ))}
        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-cream/45">
          Jump to
          <input
            type="date"
            value={jumpDate}
            onChange={(e) => setJumpDate(e.target.value)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-normal focus:outline-none ${
              jumpDate
                ? "border-plonkYellow bg-plonkYellow/10 text-plonkYellow"
                : "border-cream/15 bg-ink/40 text-cream/75 focus:border-plonkPink"
            }`}
          />
        </label>
        {jumpDate && (
          <button
            onClick={() => setJumpDate("")}
            className="rounded-full border border-cream/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-cream/60 hover:bg-cream/5"
          >
            ✕ Clear
          </button>
        )}
        <Link
          href="/admin/calendar"
          className="ml-auto rounded-full border border-plonkTeal/50 bg-plonkTeal/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-plonkTeal transition hover:bg-plonkTeal/20"
        >
          📅 Calendar view
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-cream/60">Loading…</p>
      ) : (
        <AdminCard>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream/10 text-left text-xs uppercase tracking-widest text-cream/50">
                  {(
                    [
                      ["ref", "Ref"],
                      ["slot", "Slot"],
                      ["customer", "Customer"],
                      ["size", "Size"],
                      ["total", "Total"],
                      ["status", "Status"],
                    ] as [SortKey, string][]
                  ).map(([key, label]) => (
                    <th key={key} className="px-5 py-3 font-bold">
                      <button
                        type="button"
                        onClick={() => toggleSort(key)}
                        className="flex items-center gap-1 uppercase tracking-widest transition hover:text-cream"
                      >
                        {label}
                        <span className="text-[10px] text-plonkPink">
                          {sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-cream/55">
                      {jumpDate
                        ? "No bookings on that date."
                        : dateFilter === "upcoming"
                        ? "No bookings coming up — try Past or All dates."
                        : "No bookings match the current filter."}
                    </td>
                  </tr>
                )}
                {filtered.map((b) => {
                  const slot = firstSlot(b);
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
                      <td className="px-5 py-3">
                        <p className="font-medium">{b.customer_name}</p>
                        <p className="text-xs text-cream/55">{b.customer_email}</p>
                      </td>
                      <td className="px-5 py-3 text-cream/85">{b.party_size}</td>
                      <td className="px-5 py-3 font-medium">{fmtMoney(b.total_pence)}</td>
                      <td className="px-5 py-3">
                        {b.status === "confirmed" ? (
                          <BookingLockedTag name={b.customer_name} />
                        ) : (
                          <StatusPill status={b.status} />
                        )}
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
      className={`rounded-full border px-4 py-1.5 font-bold uppercase tracking-wider transition ${
        active
          ? "border-plonkPink bg-plonkPink text-white"
          : "border-cream/15 bg-ink/40 text-cream/75 hover:border-cream/40"
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
