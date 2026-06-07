"use client";

import { useEffect, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import {
  loadAllBookingSettings,
  updateBookingSetting,
  type DbBookingSetting,
} from "@/lib/db/bookingSettings";

// =============================================================
// Booking switches — admin page
// =============================================================
// One row per booking product (pool, table, tournament).
// Toggling `enabled` off hides the customer-facing form behind a
// "currently paused" message; the customer can't bypass this
// because the Edge Function rechecks the flag on every checkout
// request.
//
// `closed_message` is what the customer sees while bookings are
// off — keep it warm and on-brand, not a 403 page.
// =============================================================

function describe(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  return fallback;
}

const PRODUCT_LABEL: Record<string, { title: string; sub: string }> = {
  pool: {
    title: "Pool table bookings",
    sub: "Powers /book/pool. Toggle off if the floor's reconfigured for a private event.",
  },
  table: {
    title: "Bar table reservations",
    sub: "Powers /book/table. Toggle off if you want to go fully walk-in.",
  },
  tournament: {
    title: "Tournament sign-ups",
    sub: "Powers the /events tournament entries. Toggle off between seasons.",
  },
};

export default function BookingSettingsClient() {
  const [rows, setRows] = useState<DbBookingSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      const r = await loadAllBookingSettings();
      setRows(r);
      const initial: Record<string, string> = {};
      r.forEach((row) => {
        initial[row.id] = row.closed_message ?? "";
      });
      setDrafts(initial);
    } catch (e) {
      setErr(describe(e, "Failed to load settings"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  async function handleToggle(row: DbBookingSetting) {
    setBusyId(row.id);
    setErr("");
    try {
      await updateBookingSetting(row.id, { enabled: !row.enabled });
      await reload();
    } catch (e) {
      setErr(describe(e, "Toggle failed"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveMessage(row: DbBookingSetting) {
    setBusyId(row.id);
    setErr("");
    try {
      await updateBookingSetting(row.id, {
        closed_message: drafts[row.id] || null,
      });
      await reload();
    } catch (e) {
      setErr(describe(e, "Save failed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Booking switches"
        description="Master on-off switch for each bookable product. When off, the customer-facing form shows the message below instead of the booking form."
      />

      {err && (
        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-cream/60">Loading…</p>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const meta = PRODUCT_LABEL[row.id] ?? {
              title: row.id,
              sub: "Custom booking product.",
            };
            const draft = drafts[row.id] ?? "";
            const dirty = draft !== (row.closed_message ?? "");
            return (
              <AdminCard key={row.id}>
                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display text-xl">{meta.title}</h3>
                      <p className="mt-1 text-sm text-cream/60">{meta.sub}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggle(row)}
                      disabled={busyId === row.id}
                      className={`flex items-center gap-3 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider transition disabled:opacity-40 ${
                        row.enabled
                          ? "border-plonkTeal/40 bg-plonkTeal/15 text-plonkTeal"
                          : "border-red-400/40 bg-red-400/10 text-red-300"
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          row.enabled ? "bg-plonkTeal" : "bg-red-400"
                        }`}
                      />
                      {row.enabled ? "Taking bookings" : "Paused"}
                    </button>
                  </div>

                  <label className="mt-5 block">
                    <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
                      Message shown when paused
                    </span>
                    <textarea
                      value={draft}
                      onChange={(e) =>
                        setDrafts({ ...drafts, [row.id]: e.target.value })
                      }
                      rows={2}
                      placeholder="Bookings temporarily paused — DM us on Instagram."
                      className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:border-plonkTeal focus:outline-none"
                    />
                  </label>

                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-widest text-cream/40">
                      Last changed{" "}
                      {new Date(row.updated_at).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleSaveMessage(row)}
                      disabled={!dirty || busyId === row.id}
                      className="rounded-full bg-plonkTeal px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink disabled:opacity-30"
                    >
                      {busyId === row.id ? "Saving…" : "Save message"}
                    </button>
                  </div>
                </div>
              </AdminCard>
            );
          })}
        </div>
      )}
    </>
  );
}
