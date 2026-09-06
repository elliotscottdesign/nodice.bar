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
import { supabase } from "@/lib/supabase";

const STRIPE_PAYMENT_URL = (pi: string) =>
  `https://dashboard.stripe.com/payments/${pi}`;

// For the confirm-time email offer on pending rows — same Edge Function
// the manual add form uses (handles both pool + table kinds).
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://rntcujcpsozvuxvmlejv.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SEND_CONFIRMATION_URL = `${SUPABASE_URL}/functions/v1/send-pool-confirmation`;

function looksLikeRealEmail(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  if (!s || s === "info@nodice.bar") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

const editInputCls =
  "w-full rounded-lg border border-cream/15 bg-ink/30 px-3 py-2 text-sm text-cream " +
  "placeholder:text-cream/40 focus:border-plonkPink focus:outline-none";

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
  // Source filter — distinguishes regular bar_reservations rows from
  // World Cup match-night event_entries shown on the table surface.
  // Only matters on the table page (and the combined /admin/bar-
  // reservations view); the pool page never has event-sourced rows.
  const [sourceFilter, setSourceFilter] = useState<"all" | "bar" | "event">(
    "all",
  );
  // Search box — matches name / email / phone / notes / match name.
  const [search, setSearch] = useState("");
  // Inline-edit state — only one row open at a time.
  const [editingId, setEditingId] = useState<string | null>(null);
  // Number fields kept as strings so the founder can clear the box
  // and type a new value — a raw number state coerces empty back to
  // the default the instant the input goes blank.
  const [editForm, setEditForm] = useState<{
    reservation_date: string;
    start_time: string;
    duration_minutes: string;
    party_size: string;
    name: string;
    email: string;
    phone: string;
    notes: string;
  } | null>(null);
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
      // Pending → confirmed is the moment a pencilled-in booking becomes
      // real, so offer the standard confirmation email here (manual
      // pending entries never emailed at creation). Only for regular
      // bar rows with a real-looking address — never the info@ walk-in
      // placeholder, and event_entries have their own email flow.
      if (
        status === "confirmed" &&
        row.status === "pending" &&
        row.source === "bar" &&
        looksLikeRealEmail(row.email) &&
        window.confirm(
          `Send ${row.name} the confirmation email now? (${row.email})`,
        )
      ) {
        try {
          const res = await fetch(SEND_CONFIRMATION_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              reservation_id: row.id,
              include_notes: false,
            }),
          });
          if (!res.ok)
            setErr(
              `Confirmed, but the email failed (HTTP ${res.status}) — you can resend by cancelling and re-confirming.`,
            );
        } catch (e) {
          setErr(
            `Confirmed, but the email errored: ${describe(e, "network problem")}`,
          );
        }
      }
      await reload();
    } catch (e) {
      setErr(describe(e, "Failed to update reservation"));
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(r: UnifiedReservation) {
    setEditingId(r.id);
    setEditForm({
      reservation_date: r.reservation_date,
      start_time: r.start_time.slice(0, 5),
      duration_minutes: String(r.duration_minutes),
      party_size: String(r.party_size),
      name: r.name,
      email: r.email,
      phone: r.phone ?? "",
      notes: r.notes ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit(r: UnifiedReservation) {
    if (!editForm) return;
    setBusyId(r.id);
    setErr("");
    try {
      if (r.source === "event") {
        // event_entries rows are tied to a match — date/time/duration
        // come from the parent event. Only customer fields editable.
        const { error } = await supabase()
          .from("event_entries")
          .update({
            attendee_name: editForm.name.trim(),
            attendee_email: editForm.email.trim(),
            attendee_phone: editForm.phone.trim(),
            notes: editForm.notes.trim() || null,
          })
          .eq("id", r.id);
        if (error) throw error;
      } else {
        const duration = Math.max(
          30,
          Math.min(300, parseInt(editForm.duration_minutes, 10) || 60),
        );
        const party = Math.max(
          1,
          Math.min(50, parseInt(editForm.party_size, 10) || 2),
        );
        const { error } = await supabase()
          .from("bar_reservations")
          .update({
            reservation_date: editForm.reservation_date,
            start_time: editForm.start_time + ":00",
            duration_minutes: duration,
            party_size: party,
            name: editForm.name.trim(),
            email: editForm.email.trim(),
            phone: editForm.phone.trim() || null,
            notes: editForm.notes.trim() || null,
          })
          .eq("id", r.id);
        if (error) throw error;
      }
      cancelEdit();
      await reload();
    } catch (e) {
      setErr(describe(e, "Failed to save changes"));
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
  const sourceRows =
    sourceFilter === "all"
      ? kindRows
      : kindRows.filter((r) => r.source === sourceFilter);
  const q = search.trim().toLowerCase();
  const searchedRows = !q
    ? sourceRows
    : sourceRows.filter((r) =>
        [r.name, r.email, r.phone ?? "", r.notes ?? "", r.match_name ?? ""]
          .some((v) => v.toLowerCase().includes(q)),
      );
  const filtered =
    filter === "all"
      ? searchedRows
      : searchedRows.filter((r) => r.status === filter);

  const pendingCount = kindRows.filter((r) => r.status === "pending").length;
  // The source dropdown is only meaningful when event_entries can be
  // mixed in — i.e. the table page or the combined view. On the pool
  // page the dropdown would only ever have one option, so we hide it.
  const showSourceFilter = kindFilter !== "pool";
  const worldCupCount = kindRows.filter((r) => r.source === "event").length;

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

      <div className="flex flex-wrap gap-3">
        {/* Search input — matches name, email, phone, notes, match name. */}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone, notes, match…"
          className="min-w-[220px] flex-1 rounded-full border border-cream/15 bg-ink/40 px-4 py-1.5 text-xs text-cream placeholder:text-cream/40 focus:border-plonkPink focus:outline-none"
        />
        {showSourceFilter && (
          <select
            value={sourceFilter}
            onChange={(e) =>
              setSourceFilter(e.target.value as "all" | "bar" | "event")
            }
            className="rounded-full border border-cream/15 bg-ink/40 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 focus:border-plonkPink focus:outline-none"
          >
            <option value="all">All sources</option>
            <option value="bar">Regular tables only</option>
            <option value="event">
              World Cup only{worldCupCount > 0 ? ` (${worldCupCount})` : ""}
            </option>
          </select>
        )}
      </div>

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
                          ? "bg-amber-400/15 text-amber-300"
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

              {/* Secondary action row — Edit + Refund. Shown beneath the
                  contact panel so the primary Confirm/Cancel actions
                  stay top-right. Refund opens Stripe in a new tab
                  (only when there's a real payment intent to refund).
                  Edit toggles the inline form below. */}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    editingId === r.id ? cancelEdit() : startEdit(r)
                  }
                  className="rounded-full border border-cream/15 bg-ink/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cream/85 transition hover:border-cream/40"
                >
                  {editingId === r.id ? "Close edit" : "Edit"}
                </button>
                {r.stripe_payment_intent_id && (
                  <a
                    href={STRIPE_PAYMENT_URL(r.stripe_payment_intent_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-plonkPink/40 bg-plonkPink/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-plonkPink transition hover:bg-plonkPink/20"
                  >
                    Refund in Stripe ↗
                  </a>
                )}
                {r.amount_pence !== null && r.amount_pence > 0 && (
                  <span className="rounded-full bg-cream/5 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cream/55">
                    Paid £{(r.amount_pence / 100).toFixed(2)}
                  </span>
                )}
              </div>

              {editingId === r.id && editForm && (
                <div className="mt-4 rounded-2xl border border-cream/10 bg-ink/30 p-4">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-cream/55">
                    Edit booking
                    {r.source === "event" && " (match-tied — only contact details editable)"}
                  </p>
                  {r.source === "bar" && (
                    <div className="mb-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">Date</label>
                        <input type="date" value={editForm.reservation_date} onChange={(e) => setEditForm({ ...editForm, reservation_date: e.target.value })} className={editInputCls + " mt-1"} />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">Start time</label>
                        <input type="time" value={editForm.start_time} onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })} className={editInputCls + " mt-1"} />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">Duration (min)</label>
                        <input type="number" min={30} max={300} step={30} value={editForm.duration_minutes} onChange={(e) => setEditForm({ ...editForm, duration_minutes: e.target.value })} className={editInputCls + " mt-1"} />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">Party size</label>
                        <input type="number" min={1} max={50} value={editForm.party_size} onChange={(e) => setEditForm({ ...editForm, party_size: e.target.value })} className={editInputCls + " mt-1"} />
                      </div>
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">Customer name</label>
                      <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={editInputCls + " mt-1"} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">Email</label>
                      <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className={editInputCls + " mt-1"} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">Phone</label>
                      <input type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className={editInputCls + " mt-1"} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">Notes</label>
                      <textarea rows={2} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className={editInputCls + " mt-1"} />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button type="button" onClick={cancelEdit} disabled={busyId === r.id} className="rounded-full border border-cream/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cream/75 hover:bg-cream/5 disabled:opacity-50">
                      Cancel
                    </button>
                    <button type="button" onClick={() => saveEdit(r)} disabled={busyId === r.id} className="rounded-full bg-plonkPink px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90 disabled:opacity-50">
                      {busyId === r.id ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
