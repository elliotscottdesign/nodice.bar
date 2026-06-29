"use client";

import { useEffect, useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import AddReservationForm from "@/components/admin/AddReservationForm";
import {
  loadAllTableSurfaceReservations,
  setUnifiedReservationStatus,
  type DbBarReservation,
  type UnifiedReservation,
} from "@/lib/db/barReservations";

// Admin list view for /book/pool + /book/table reservations. The
// public booking forms drop rows in as 'pending' — the admin confirms
// or cancels here. Stripe / email confirmation are stubs for now;
// confirming today just updates the status.

type Filter = "pending" | "confirmed" | "cancelled" | "all";

function describe(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  return fallback;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTime(hhmm: string): string {
  // "19:30:00" -> "7:30pm" style.
  const [hStr, mStr] = hhmm.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m === 0 ? "" : `:${String(m).padStart(2, "0")}`}${ampm}`;
}

export default function BarReservationsClient({
  kindFilter = "all",
}: {
  // Restrict visible rows to a single kind. /admin/bar-reservations
  // (legacy combined URL) leaves this as "all"; /admin/table-reservations
  // and /admin/pool-reservations pass the matching value so each page
  // is focused on one product. Founder rule (2026-06-22): pool + table
  // live on separate admin pages so staff don't have to filter to read
  // their own shift.
  kindFilter?: "pool" | "table" | "all";
} = {}) {
  const [rows, setRows] = useState<UnifiedReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  // Initial filter respects ?filter=all|pending|confirmed|cancelled in
  // the URL so the founder can bookmark "all bookings" or land staff
  // directly on the right tab via a shared link. Default stays
  // "pending" so the page opens on what needs action.
  const [filter, setFilter] = useState<Filter>(() => {
    if (typeof window === "undefined") return "pending";
    const q = new URLSearchParams(window.location.search).get("filter");
    if (q === "all" || q === "pending" || q === "confirmed" || q === "cancelled")
      return q;
    return "pending";
  });

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      // loadAllTableSurfaceReservations returns BOTH bar_reservations
      // (table + pool rows) AND World Cup event_entries shaped as
      // table rows. The kindFilter below decides which subset to show.
      setRows(await loadAllTableSurfaceReservations());
    } catch (e) {
      setErr(describe(e, "Failed to load reservations"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function setStatus(
    row: UnifiedReservation,
    status: DbBarReservation["status"],
  ) {
    setBusyId(row.id);
    setErr("");
    try {
      await setUnifiedReservationStatus(row, status);
      await reload();
    } catch (e) {
      setErr(describe(e, "Failed to update reservation"));
    } finally {
      setBusyId(null);
    }
  }

  // World Cup event_entries are always shown on the table surface
  // (founder rule: staff need to see match-night holds alongside
  // regular table bookings to spot clashes at a glance). Pool page
  // never includes event_entries.
  const kindRows =
    kindFilter === "all"
      ? rows
      : kindFilter === "table"
      ? rows.filter((r) => r.kind === "table" || r.source === "event")
      : rows.filter((r) => r.kind === "pool" && r.source === "bar");
  const filtered =
    filter === "all" ? kindRows : kindRows.filter((r) => r.status === filter);

  const pendingCount = kindRows.filter((r) => r.status === "pending").length;

  // Manual-entry surface is only meaningful on a kind-specific page.
  // On the combined /admin/bar-reservations view we don't render a
  // button (the founder would have to pick a kind anyway — easier
  // to just go to the dedicated page).
  const manualKind: "table" | "pool" | null =
    kindFilter === "table" ? "table" : kindFilter === "pool" ? "pool" : null;

  return (
    <div className="space-y-6">
      {err && (
        <div className="rounded-lg border border-plonkPink/40 bg-plonkPink/10 px-4 py-3 text-sm text-plonkPink">
          {err}
        </div>
      )}

      {manualKind && (
        <AddReservationForm kind={manualKind} onCreated={() => reload()} />
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "pending" as const, label: `Pending${pendingCount ? ` (${pendingCount})` : ""}` },
            { id: "confirmed" as const, label: "Confirmed" },
            { id: "cancelled" as const, label: "Cancelled" },
            { id: "all" as const, label: "All" },
          ]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
              filter === t.id
                ? "border-plonkPink bg-plonkPink text-white"
                : "border-cream/15 bg-ink/40 text-cream/75 hover:border-cream/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <AdminCard>
          <p className="px-5 py-6 text-sm text-cream/55">Loading…</p>
        </AdminCard>
      ) : filtered.length === 0 ? (
        <AdminCard>
          <p className="px-5 py-6 text-sm text-cream/55">
            No {filter === "all" ? "" : filter + " "}reservations.
          </p>
        </AdminCard>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <article
              key={r.id}
              className="rounded-2xl border border-cream/10 bg-ink/40 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] ${
                        r.source === "event"
                          ? "bg-plonkTeal/15 text-plonkTeal"
                          : r.kind === "pool"
                          ? "bg-plonkPink/15 text-plonkPink"
                          : "bg-plonkYellow/15 text-plonkYellow"
                      }`}
                    >
                      {r.source === "event"
                        ? "World Cup"
                        : r.kind === "pool"
                        ? "Pool"
                        : "Table"}
                    </span>
                    {r.match_name && (
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-cream/85">
                        {r.match_name}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] ${
                        r.status === "pending"
                          ? "bg-cream/10 text-cream/75"
                          : r.status === "confirmed"
                          ? "bg-plonkTeal/15 text-plonkTeal"
                          : "bg-cream/5 text-cream/40"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <h3 className="mt-2 font-display text-2xl">
                    {formatDate(r.reservation_date)} · {formatTime(r.start_time)}
                  </h3>
                  <p className="mt-1 text-sm text-cream/75">
                    {r.party_size} {r.party_size === 1 ? "guest" : "guests"}
                    {r.kind === "pool" && r.resource_count > 1
                      ? ` · ${r.resource_count} tables`
                      : ""}
                    {" · "}
                    {r.duration_minutes} min
                  </p>
                </div>

                {r.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      disabled={busyId === r.id}
                      onClick={() => setStatus(r, "confirmed")}
                      className="rounded-full bg-plonkPink px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90 disabled:opacity-50"
                    >
                      Confirm
                    </button>
                    <button
                      disabled={busyId === r.id}
                      onClick={() => setStatus(r, "cancelled")}
                      className="rounded-full border border-cream/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cream/75 transition hover:bg-cream/5 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {r.status === "confirmed" && (
                  <button
                    disabled={busyId === r.id}
                    onClick={() => setStatus(r, "cancelled")}
                    className="rounded-full border border-cream/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cream/75 transition hover:bg-cream/5 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
                {r.status === "cancelled" && (
                  <button
                    disabled={busyId === r.id}
                    onClick={() => setStatus(r, "confirmed")}
                    className="rounded-full border border-cream/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cream/75 transition hover:bg-cream/5 disabled:opacity-50"
                  >
                    Restore
                  </button>
                )}
              </div>

              <div className="mt-4 grid gap-3 border-t border-cream/10 pt-4 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cream/45">
                    Contact
                  </p>
                  <p className="mt-1 text-sm text-cream">{r.name}</p>
                  <a
                    href={`mailto:${r.email}`}
                    className="text-sm text-plonkPink underline-offset-2 hover:underline"
                  >
                    {r.email}
                  </a>
                  {r.phone && (
                    <p className="text-sm text-cream/75">{r.phone}</p>
                  )}
                </div>
                {r.notes && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cream/45">
                      Notes
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm text-cream/85">
                      {r.notes}
                    </p>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
