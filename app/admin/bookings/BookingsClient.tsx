"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import Notice from "@/components/Notice";
import { AdminCard } from "@/components/admin/AdminCard";
import AddGolfBookingForm from "@/components/admin/AddGolfBookingForm";
import DatePickerInput from "@/components/admin/DatePickerInput";
import TimeField from "@/components/admin/TimeField";
import BookingLockedTag from "@/components/admin/BookingLockedTag";
import { confirmDialog } from "@/lib/dialog";
import { fmtMoney } from "@/lib/format";
import {
  loadBookings,
  firstSlot,
  updateGolfBooking,
  setGolfBookingStatus,
  rescheduleGolfSlot,
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

// Shared edit-field styling — matches the pool/table reservations editor
// so the two screens feel like one tool (founder 3 Nov 2026).
const editInputCls =
  "w-full rounded-lg border border-cream/15 bg-ink/30 px-3 py-2 text-sm text-cream " +
  "placeholder:text-cream/40 focus:border-plonkPink focus:outline-none";

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
  // Inline edit — one booking open at a time, mirroring the pool/table
  // reservations editor (founder 3 Nov 2026).
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    slot_date: string;
    slot_time: string;
    party_size: string;
    name: string;
    email: string;
    phone: string;
    notes: string;
  } | null>(null);
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

  // ─── Inline edit ───────────────────────────────────────────────────
  function startEdit(b: DbBookingRow) {
    const s = firstSlot(b);
    setEditingId(b.id);
    setEditForm({
      slot_date: s?.slot_date ?? "",
      slot_time: s ? s.slot_time.slice(0, 5) : "",
      party_size: String(b.party_size),
      name: b.customer_name,
      email: b.customer_email,
      phone: b.customer_phone ?? "",
      notes: b.notes ?? "",
    });
  }
  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }
  async function saveEdit(b: DbBookingRow) {
    if (!editForm) return;
    setBusyId(b.id);
    setErr("");
    try {
      const party = Math.max(1, Math.min(60, parseInt(editForm.party_size, 10) || 1));
      await updateGolfBooking(b.id, {
        customer_name: editForm.name,
        customer_email: editForm.email,
        customer_phone: editForm.phone,
        party_size: party,
        notes: editForm.notes,
      });
      // Move the slot if there is one and the date/time or (single-slot)
      // headcount changed. Multi-slot bookings only move their first slot
      // here — rare, and flagged in the editor.
      const s = firstSlot(b);
      if (s && editForm.slot_date && editForm.slot_time) {
        const timeChanged = editForm.slot_time !== s.slot_time.slice(0, 5);
        const dateChanged = editForm.slot_date !== s.slot_date;
        const singleSlot = b.slots.length === 1;
        const countChanged = singleSlot && party !== s.count;
        if (timeChanged || dateChanged || countChanged) {
          await rescheduleGolfSlot(
            s.id,
            editForm.slot_date,
            editForm.slot_time,
            singleSlot ? party : undefined,
          );
        }
      }
      cancelEdit();
      await reload();
    } catch (e) {
      setErr(describe(e, "Failed to save the booking"));
    } finally {
      setBusyId(null);
    }
  }
  async function setStatus(b: DbBookingRow, status: BookingStatus) {
    if (status === "cancelled") {
      const ok = await confirmDialog(
        `Cancel ${b.customer_name}'s golf booking (${b.reference})? This frees the slot. You can restore it afterwards.`,
        { danger: true, confirmLabel: "Cancel booking", title: "Cancel booking?" },
      );
      if (!ok) return;
    }
    setBusyId(b.id);
    setErr("");
    try {
      await setGolfBookingStatus(b.id, status);
      await reload();
    } catch (e) {
      setErr(describe(e, "Failed to update the booking"));
    } finally {
      setBusyId(null);
    }
  }

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
        description="Every golf booking taken. Search, or tap any column heading to sort. Tap Edit on a row to change it, move it to another day, or cancel it."
      />

      {err && (
        <Notice variant="error" className="mb-6">{err}</Notice>
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
          <DatePickerInput
            value={jumpDate}
            onChange={setJumpDate}
            placeholder="Jump to date"
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
                  <th className="px-5 py-3 text-right font-bold uppercase tracking-widest">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-cream/55">
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
                  const editing = editingId === b.id;
                  return (
                    <Fragment key={b.id}>
                      <tr className="border-b border-cream/5 last:border-b-0 hover:bg-cream/5">
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
                          {b.customer_phone && (
                            <p className="text-xs text-cream/55">{b.customer_phone}</p>
                          )}
                          {b.notes && (
                            <p className="mt-1 max-w-[320px] rounded border border-plonkYellow/30 bg-plonkYellow/5 px-2 py-1 text-xs text-plonkYellow">
                              📝 {b.notes}
                            </p>
                          )}
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
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => (editing ? cancelEdit() : startEdit(b))}
                              className="rounded-full border border-cream/15 bg-ink/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cream/85 transition hover:border-cream/40"
                            >
                              {editing ? "Close" : "Edit"}
                            </button>
                            {b.status === "pending" && (
                              <button
                                type="button"
                                disabled={busyId === b.id}
                                onClick={() => setStatus(b, "confirmed")}
                                className="rounded-full bg-plonkPink px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90 disabled:opacity-50"
                              >
                                Confirm
                              </button>
                            )}
                            {(b.status === "pending" || b.status === "confirmed") && (
                              <button
                                type="button"
                                disabled={busyId === b.id}
                                onClick={() => setStatus(b, "cancelled")}
                                className="rounded-full border border-cream/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cream/75 transition hover:bg-cream/5 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            )}
                            {(b.status === "cancelled" || b.status === "refunded" || b.status === "expired") && (
                              <button
                                type="button"
                                disabled={busyId === b.id}
                                onClick={() => setStatus(b, "confirmed")}
                                className="rounded-full border border-cream/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cream/75 transition hover:bg-cream/5 disabled:opacity-50"
                              >
                                Restore
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {editing && editForm && (
                        <tr className="border-b border-cream/5 bg-ink/40">
                          <td colSpan={7} className="px-5 py-4">
                            <div className="rounded-2xl border border-cream/10 bg-ink/30 p-4">
                              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-cream/55">
                                Edit booking {b.reference}
                              </p>
                              {b.slots.length > 1 && (
                                <p className="mb-3 rounded-lg border border-plonkYellow/30 bg-plonkYellow/5 px-3 py-2 text-xs text-plonkYellow">
                                  This booking is split across {b.slots.length} slots —
                                  changing the date / time here moves the first slot only.
                                </p>
                              )}
                              <div className="grid gap-3 sm:grid-cols-2">
                                {slot && (
                                  <>
                                    <div>
                                      <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">Date</label>
                                      <DatePickerInput
                                        value={editForm.slot_date}
                                        onChange={(v) => setEditForm({ ...editForm, slot_date: v })}
                                        className={editInputCls + " mt-1"}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">Tee time</label>
                                      <TimeField
                                        value={editForm.slot_time}
                                        onChange={(v) => setEditForm({ ...editForm, slot_time: v })}
                                        className={editInputCls + " mt-1"}
                                      />
                                    </div>
                                  </>
                                )}
                                <div>
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">Party size</label>
                                  <input
                                    type="number"
                                    min={1}
                                    max={60}
                                    value={editForm.party_size}
                                    onChange={(e) => setEditForm({ ...editForm, party_size: e.target.value })}
                                    className={editInputCls + " mt-1"}
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">Customer name</label>
                                  <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    className={editInputCls + " mt-1"}
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">Email</label>
                                  <input
                                    type="email"
                                    value={editForm.email}
                                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                    className={editInputCls + " mt-1"}
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">Phone</label>
                                  <input
                                    type="tel"
                                    value={editForm.phone}
                                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                    className={editInputCls + " mt-1"}
                                  />
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">Notes</label>
                                  <textarea
                                    rows={2}
                                    value={editForm.notes}
                                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                                    className={editInputCls + " mt-1"}
                                  />
                                </div>
                              </div>
                              <div className="mt-3 flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  disabled={busyId === b.id}
                                  className="rounded-full border border-cream/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cream/75 hover:bg-cream/5 disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveEdit(b)}
                                  disabled={busyId === b.id}
                                  className="rounded-full bg-plonkPink px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90 disabled:opacity-50"
                                >
                                  {busyId === b.id ? "Saving…" : "Save changes"}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
