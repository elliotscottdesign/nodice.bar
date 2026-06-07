"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import DatePickerInput from "@/components/admin/DatePickerInput";
import {
  loadBookableProductConfig,
  updateBookableProduct,
  createBookableHour,
  updateBookableHour,
  deleteBookableHour,
  upsertBookableDateOverride,
  deleteBookableDateOverride,
  createBookablePriceWindow,
  updateBookablePriceWindow,
  deleteBookablePriceWindow,
  DAY_NAMES,
  DAY_SHORT,
  type BookableProductConfig,
  type DbBookableHour,
  type DbBookableDateOverride,
  type DbBookablePriceWindow,
} from "@/lib/db/bookableProducts";

// =============================================================
// /admin/products/[id] — full configuration editor
// =============================================================
// Four tabs:
//   General        — name, on/off, lengths, party size, header copy
//   Opening hours  — recurring weekly hours
//   Prices         — time-of-day price windows
//   Date overrides — closed days + special-hours days
// =============================================================

function describe(err: unknown, fb: string): string {
  if (err instanceof Error) return err.message;
  return fb;
}
function fmtTime(t: string): string {
  // Strip seconds for display.
  return t.length > 5 ? t.slice(0, 5) : t;
}
function fmtMoney(p: number): string {
  if (p === 0) return "Free";
  if (p % 100 === 0) return `£${p / 100}`;
  return `£${(p / 100).toFixed(2)}`;
}

type Tab = "general" | "hours" | "prices" | "overrides";

export default function ProductConfigClient({
  productId,
}: {
  productId: string;
}) {
  const [cfg, setCfg] = useState<BookableProductConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<Tab>("general");

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      const c = await loadBookableProductConfig(productId);
      if (!c) {
        setErr(`No product with id '${productId}' found in Supabase.`);
        setCfg(null);
      } else {
        setCfg(c);
      }
    } catch (e) {
      setErr(describe(e, "Failed to load config"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  return (
    <>
      <AdminPageHeader
        title={cfg ? cfg.product.name : "Configure product"}
        description={
          cfg
            ? `Customer-facing booking page: /book/${cfg.product.id}`
            : "Loading…"
        }
        action={
          <Link
            href="/admin/products/"
            className="text-xs font-bold uppercase tracking-wider text-cream/55 hover:text-cream"
          >
            ← All products
          </Link>
        }
      />

      {err && (
        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      )}

      {loading || !cfg ? (
        <p className="text-sm text-cream/60">Loading…</p>
      ) : (
        <>
          {/* Tab strip */}
          <div className="mb-6 flex flex-wrap gap-1 border-b border-cream/10">
            {(
              [
                ["general", "General"],
                ["hours", "Opening hours"],
                ["prices", "Prices"],
                ["overrides", "Date overrides"],
              ] as [Tab, string][]
            ).map(([k, label]) => {
              const active = tab === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`-mb-px border-b-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition ${
                    active
                      ? "border-plonkTeal text-plonkTeal"
                      : "border-transparent text-cream/55 hover:text-cream"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {tab === "general" && (
            <GeneralTab cfg={cfg} onChanged={reload} onError={setErr} />
          )}
          {tab === "hours" && (
            <HoursTab cfg={cfg} onChanged={reload} onError={setErr} />
          )}
          {tab === "prices" && (
            <PricesTab cfg={cfg} onChanged={reload} onError={setErr} />
          )}
          {tab === "overrides" && (
            <OverridesTab cfg={cfg} onChanged={reload} onError={setErr} />
          )}
        </>
      )}
    </>
  );
}

// =============================================================
// General tab
// =============================================================
function GeneralTab({
  cfg,
  onChanged,
  onError,
}: {
  cfg: BookableProductConfig;
  onChanged: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const p = cfg.product;
  const [draft, setDraft] = useState({
    name: p.name,
    enabled: p.enabled,
    closed_message: p.closed_message ?? "",
    slot_duration_minutes: p.slot_duration_minutes,
    min_duration_minutes: p.min_duration_minutes,
    max_duration_minutes: p.max_duration_minutes,
    duration_step_minutes: p.duration_step_minutes,
    min_party_size: p.min_party_size,
    max_party_size: p.max_party_size,
    default_resource_count: p.default_resource_count,
    customer_eyebrow: p.customer_eyebrow ?? "",
    customer_title: p.customer_title ?? "",
    customer_intro: p.customer_intro ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateBookableProduct(p.id, {
        name: draft.name.trim(),
        enabled: draft.enabled,
        closed_message: draft.closed_message.trim() || null,
        slot_duration_minutes: draft.slot_duration_minutes,
        min_duration_minutes: draft.min_duration_minutes,
        max_duration_minutes: draft.max_duration_minutes,
        duration_step_minutes: draft.duration_step_minutes,
        min_party_size: draft.min_party_size,
        max_party_size: draft.max_party_size,
        default_resource_count: draft.default_resource_count,
        customer_eyebrow: draft.customer_eyebrow.trim() || null,
        customer_title: draft.customer_title.trim() || null,
        customer_intro: draft.customer_intro.trim() || null,
      });
      await onChanged();
    } catch (e) {
      onError(describe(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminCard>
        <div className="p-5">
          <h3 className="font-display text-xl">Master switch</h3>
          <p className="mt-1 text-sm text-cream/60">
            Off = customer sees the closed message instead of the booking form.
            Toggle without touching anything else when bookings pause briefly.
          </p>
          <div className="mt-5 flex items-center gap-4">
            <button
              type="button"
              onClick={() => setDraft({ ...draft, enabled: !draft.enabled })}
              className={`flex items-center gap-3 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider ${
                draft.enabled
                  ? "border-plonkTeal/40 bg-plonkTeal/15 text-plonkTeal"
                  : "border-red-400/40 bg-red-400/10 text-red-300"
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  draft.enabled ? "bg-plonkTeal" : "bg-red-400"
                }`}
              />
              {draft.enabled ? "Taking bookings" : "Paused"}
            </button>
          </div>
          <Field
            label="Message shown when paused"
            multiline
            value={draft.closed_message}
            onChange={(v) => setDraft({ ...draft, closed_message: v })}
          />
        </div>
      </AdminCard>

      <AdminCard>
        <div className="p-5">
          <h3 className="font-display text-xl">Booking length & party size</h3>
          <p className="mt-1 text-sm text-cream/60">
            Customers pick a slot length between the min and max in steps of the
            step size. e.g. 30 / 30 / 60 / 30 = "30 or 60 minute" options.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumField
              label="Slot length (min)"
              value={draft.slot_duration_minutes}
              onChange={(v) =>
                setDraft({ ...draft, slot_duration_minutes: v })
              }
            />
            <NumField
              label="Min booking (min)"
              value={draft.min_duration_minutes}
              onChange={(v) =>
                setDraft({ ...draft, min_duration_minutes: v })
              }
            />
            <NumField
              label="Max booking (min)"
              value={draft.max_duration_minutes}
              onChange={(v) =>
                setDraft({ ...draft, max_duration_minutes: v })
              }
            />
            <NumField
              label="Step (min)"
              value={draft.duration_step_minutes}
              onChange={(v) =>
                setDraft({ ...draft, duration_step_minutes: v })
              }
            />
            <NumField
              label="Min party size"
              value={draft.min_party_size}
              onChange={(v) => setDraft({ ...draft, min_party_size: v })}
            />
            <NumField
              label="Max party size"
              value={draft.max_party_size}
              onChange={(v) => setDraft({ ...draft, max_party_size: v })}
            />
            <NumField
              label="Tables / resources used per booking"
              value={draft.default_resource_count}
              onChange={(v) =>
                setDraft({ ...draft, default_resource_count: v })
              }
            />
          </div>
        </div>
      </AdminCard>

      <AdminCard>
        <div className="p-5">
          <h3 className="font-display text-xl">Customer-facing copy</h3>
          <p className="mt-1 text-sm text-cream/60">
            Headers on the public booking page. Leave blank to use the default.
          </p>
          <div className="mt-5 space-y-4">
            <Field
              label="Eyebrow (small line above title)"
              value={draft.customer_eyebrow}
              onChange={(v) => setDraft({ ...draft, customer_eyebrow: v })}
            />
            <Field
              label="Title"
              value={draft.customer_title}
              onChange={(v) => setDraft({ ...draft, customer_title: v })}
            />
            <Field
              label="Intro"
              multiline
              value={draft.customer_intro}
              onChange={(v) => setDraft({ ...draft, customer_intro: v })}
            />
          </div>
        </div>
      </AdminCard>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-plonkTeal px-7 py-3 text-xs font-bold uppercase tracking-widest text-ink disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// =============================================================
// Hours tab
// =============================================================
function HoursTab({
  cfg,
  onChanged,
  onError,
}: {
  cfg: BookableProductConfig;
  onChanged: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function addHour(dow: number) {
    setBusy(true);
    try {
      await createBookableHour({
        product_id: cfg.product.id,
        day_of_week: dow,
        open_time: "16:00",
        close_time: "23:30",
      });
      await onChanged();
    } catch (e) {
      onError(describe(e, "Add hours failed"));
    } finally {
      setBusy(false);
    }
  }

  async function updateHour(h: DbBookableHour, patch: Partial<DbBookableHour>) {
    setBusy(true);
    try {
      await updateBookableHour(h.id, {
        open_time: patch.open_time ?? h.open_time,
        close_time: patch.close_time ?? h.close_time,
        day_of_week: patch.day_of_week ?? h.day_of_week,
      });
      await onChanged();
    } catch (e) {
      onError(describe(e, "Save failed"));
    } finally {
      setBusy(false);
    }
  }

  async function delHour(h: DbBookableHour) {
    if (!confirm(`Remove ${DAY_NAMES[h.day_of_week]} ${fmtTime(h.open_time)}–${fmtTime(h.close_time)}?`)) return;
    setBusy(true);
    try {
      await deleteBookableHour(h.id);
      await onChanged();
    } catch (e) {
      onError(describe(e, "Delete failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-cream/65">
        The recurring weekly pattern. Multiple rows on one day = split shift.
        No row on a day = closed all day. One-off changes go in the
        <strong className="text-plonkTeal"> Date overrides</strong> tab.
      </p>

      {[0, 1, 2, 3, 4, 5, 6].map((dow) => {
        const hoursToday = cfg.hours.filter((h) => h.day_of_week === dow);
        return (
          <AdminCard key={dow}>
            <div className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="font-display text-lg">{DAY_NAMES[dow]}</p>
                {hoursToday.length === 0 && (
                  <p className="mt-1 text-xs uppercase tracking-widest text-red-300/80">
                    Closed
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => addHour(dow)}
                disabled={busy}
                className="rounded-full border border-plonkTeal/40 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-plonkTeal hover:bg-plonkTeal/10 disabled:opacity-40"
              >
                + Add hours
              </button>
            </div>
            {hoursToday.length > 0 && (
              <div className="space-y-2 border-t border-cream/5 p-5">
                {hoursToday.map((h) => (
                  <div
                    key={h.id}
                    className="flex flex-wrap items-center gap-3"
                  >
                    <TimeField
                      label="Open"
                      value={fmtTime(h.open_time)}
                      onCommit={(t) => updateHour(h, { open_time: t })}
                    />
                    <span className="text-cream/40">→</span>
                    <TimeField
                      label="Close"
                      value={fmtTime(h.close_time)}
                      onCommit={(t) => updateHour(h, { close_time: t })}
                    />
                    <button
                      type="button"
                      onClick={() => delHour(h)}
                      disabled={busy}
                      className="ml-auto text-[11px] font-bold uppercase tracking-wider text-red-400/80 hover:underline disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </AdminCard>
        );
      })}
    </div>
  );
}

// =============================================================
// Prices tab
// =============================================================
function PricesTab({
  cfg,
  onChanged,
  onError,
}: {
  cfg: BookableProductConfig;
  onChanged: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  async function add(row: Omit<DbBookablePriceWindow, "id" | "updated_at">) {
    setBusy(true);
    try {
      await createBookablePriceWindow(row);
      setShowAdd(false);
      await onChanged();
    } catch (e) {
      onError(describe(e, "Add window failed"));
    } finally {
      setBusy(false);
    }
  }
  async function save(w: DbBookablePriceWindow, patch: Partial<DbBookablePriceWindow>) {
    setBusy(true);
    try {
      await updateBookablePriceWindow(w.id, patch);
      await onChanged();
    } catch (e) {
      onError(describe(e, "Save failed"));
    } finally {
      setBusy(false);
    }
  }
  async function del(w: DbBookablePriceWindow) {
    if (!confirm(`Delete price window '${w.name}'?`)) return;
    setBusy(true);
    try {
      await deleteBookablePriceWindow(w.id);
      await onChanged();
    } catch (e) {
      onError(describe(e, "Delete failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-cream/65">
          Each window says "on these days, between these times, charge X per
          30 mins." When multiple match a slot, the highest priority wins.
          Mark one as default — it's the fallback if nothing else matches.
        </p>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="shrink-0 rounded-full bg-plonkTeal px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-ink hover:bg-plonkTeal/90"
        >
          + Add window
        </button>
      </div>

      {cfg.priceWindows.length === 0 ? (
        <p className="text-sm text-cream/55">
          No price windows yet. Add at least one default window.
        </p>
      ) : (
        cfg.priceWindows.map((w) => (
          <PriceWindowRow
            key={w.id}
            w={w}
            busy={busy}
            onSave={save}
            onDelete={del}
          />
        ))
      )}

      {showAdd && (
        <PriceWindowAddModal
          productId={cfg.product.id}
          onCancel={() => setShowAdd(false)}
          onAdd={add}
        />
      )}
    </div>
  );
}

function PriceWindowRow({
  w,
  busy,
  onSave,
  onDelete,
}: {
  w: DbBookablePriceWindow;
  busy: boolean;
  onSave: (
    w: DbBookablePriceWindow,
    patch: Partial<DbBookablePriceWindow>,
  ) => Promise<void>;
  onDelete: (w: DbBookablePriceWindow) => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    name: w.name,
    days_of_week: w.days_of_week,
    start_time: fmtTime(w.start_time),
    end_time: fmtTime(w.end_time),
    price_per_30min_pence: w.price_per_30min_pence,
    is_default: w.is_default,
    priority: w.priority,
  });
  const dirty =
    draft.name !== w.name ||
    JSON.stringify(draft.days_of_week.slice().sort()) !==
      JSON.stringify(w.days_of_week.slice().sort()) ||
    draft.start_time !== fmtTime(w.start_time) ||
    draft.end_time !== fmtTime(w.end_time) ||
    draft.price_per_30min_pence !== w.price_per_30min_pence ||
    draft.is_default !== w.is_default ||
    draft.priority !== w.priority;

  return (
    <AdminCard>
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1 min-w-[200px]">
            <Field
              label="Window name"
              value={draft.name}
              onChange={(v) => setDraft({ ...draft, name: v })}
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {w.is_default && (
              <span className="rounded-full bg-plonkTeal/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-plonkTeal">
                Default
              </span>
            )}
            <span className="text-cream/40">·</span>
            <span className="text-xs text-cream/60">
              Priority {draft.priority}
            </span>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
            Days
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const on = draft.days_of_week.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    const next = on
                      ? draft.days_of_week.filter((x) => x !== d)
                      : [...draft.days_of_week, d];
                    setDraft({ ...draft, days_of_week: next });
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${
                    on
                      ? "border-plonkTeal bg-plonkTeal/15 text-plonkTeal"
                      : "border-cream/15 text-cream/55 hover:border-cream/30"
                  }`}
                >
                  {DAY_SHORT[d]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <TimeField
            label="From"
            value={draft.start_time}
            onCommit={(t) => setDraft({ ...draft, start_time: t })}
          />
          <TimeField
            label="Until"
            value={draft.end_time}
            onCommit={(t) => setDraft({ ...draft, end_time: t })}
          />
          <PriceField
            label="Per 30 min"
            pence={draft.price_per_30min_pence}
            onChange={(p) =>
              setDraft({ ...draft, price_per_30min_pence: p })
            }
          />
          <NumField
            label="Priority"
            value={draft.priority}
            onChange={(v) => setDraft({ ...draft, priority: v })}
          />
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-cream/80">
          <input
            type="checkbox"
            checked={draft.is_default}
            onChange={(e) =>
              setDraft({ ...draft, is_default: e.target.checked })
            }
            className="h-4 w-4 accent-plonkTeal"
          />
          Use as default window (fallback when nothing else matches)
        </label>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => onDelete(w)}
            disabled={busy}
            className="text-[11px] font-bold uppercase tracking-wider text-red-400/80 hover:underline disabled:opacity-40"
          >
            Delete
          </button>
          <button
            type="button"
            disabled={busy || !dirty}
            onClick={() =>
              onSave(w, {
                name: draft.name.trim(),
                days_of_week: draft.days_of_week
                  .slice()
                  .sort((a, b) => a - b),
                start_time: draft.start_time,
                end_time: draft.end_time,
                price_per_30min_pence: draft.price_per_30min_pence,
                is_default: draft.is_default,
                priority: draft.priority,
              })
            }
            className="rounded-full bg-plonkTeal px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-ink disabled:opacity-30"
          >
            Save
          </button>
        </div>
      </div>
    </AdminCard>
  );
}

function PriceWindowAddModal({
  productId,
  onCancel,
  onAdd,
}: {
  productId: string;
  onCancel: () => void;
  onAdd: (
    row: Omit<DbBookablePriceWindow, "id" | "updated_at">,
  ) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [startT, setStartT] = useState("00:00");
  const [endT, setEndT] = useState("23:59");
  const [price, setPrice] = useState(600);
  const [priority, setPriority] = useState(10);
  const [isDefault, setIsDefault] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 p-3 sm:items-center sm:p-6"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-plonkTeal/40 bg-ink p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-2xl">Add price window</h3>
        <div className="mt-5 space-y-4">
          <Field label="Name" value={name} onChange={setName} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
              Days
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const on = days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      setDays(
                        on ? days.filter((x) => x !== d) : [...days, d],
                      )
                    }
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${
                      on
                        ? "border-plonkTeal bg-plonkTeal/15 text-plonkTeal"
                        : "border-cream/15 text-cream/55"
                    }`}
                  >
                    {DAY_SHORT[d]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TimeField label="From" value={startT} onCommit={setStartT} />
            <TimeField label="Until" value={endT} onCommit={setEndT} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <PriceField
              label="Per 30 min"
              pence={price}
              onChange={setPrice}
            />
            <NumField
              label="Priority"
              value={priority}
              onChange={setPriority}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 accent-plonkTeal"
            />
            Use as default window
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-cream/20 px-5 py-2 text-xs font-bold uppercase tracking-wider text-cream/85"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onAdd({
                product_id: productId,
                name: name.trim() || "Untitled",
                days_of_week: days.slice().sort((a, b) => a - b),
                start_time: startT,
                end_time: endT,
                price_per_30min_pence: price,
                is_default: isDefault,
                priority,
              })
            }
            className="rounded-full bg-plonkTeal px-5 py-2 text-xs font-bold uppercase tracking-wider text-ink"
          >
            Add window
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// Date overrides tab
// =============================================================
function OverridesTab({
  cfg,
  onChanged,
  onError,
}: {
  cfg: BookableProductConfig;
  onChanged: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  async function add(row: Omit<DbBookableDateOverride, "id" | "updated_at">) {
    setBusy(true);
    try {
      await upsertBookableDateOverride(row);
      setShowAdd(false);
      await onChanged();
    } catch (e) {
      onError(describe(e, "Add override failed"));
    } finally {
      setBusy(false);
    }
  }
  async function del(o: DbBookableDateOverride) {
    if (!confirm(`Remove override for ${o.date}?`)) return;
    setBusy(true);
    try {
      await deleteBookableDateOverride(o.id);
      await onChanged();
    } catch (e) {
      onError(describe(e, "Delete failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-cream/65">
          One-off date changes. Use 'Closed' to block a day entirely (e.g.
          private hire, bank holiday). Use 'Special hours' to open at
          different times than the weekly pattern (e.g. World Cup matinée).
        </p>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="shrink-0 rounded-full bg-plonkTeal px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-ink hover:bg-plonkTeal/90"
        >
          + Add override
        </button>
      </div>

      <AdminCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cream/10 text-left text-xs uppercase tracking-widest text-cream/50">
                <th className="px-5 py-3 font-bold">Date</th>
                <th className="px-5 py-3 font-bold">Type</th>
                <th className="px-5 py-3 font-bold">Hours</th>
                <th className="px-5 py-3 font-bold">Note</th>
                <th className="px-5 py-3 text-right font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {cfg.overrides.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-sm text-cream/55"
                  >
                    No date overrides scheduled.
                  </td>
                </tr>
              )}
              {cfg.overrides.map((o) => {
                const d = new Date(`${o.date}T12:00:00`);
                return (
                  <tr
                    key={o.id}
                    className="border-b border-cream/5 last:border-b-0"
                  >
                    <td className="px-5 py-3 font-medium">
                      {d.toLocaleDateString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3">
                      {o.closed ? (
                        <span className="rounded-full bg-red-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-red-300">
                          Closed
                        </span>
                      ) : (
                        <span className="rounded-full bg-plonkTeal/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-plonkTeal">
                          Special hours
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-cream/80">
                      {o.closed
                        ? "—"
                        : `${fmtTime(o.open_time ?? "")} – ${fmtTime(o.close_time ?? "")}`}
                    </td>
                    <td className="px-5 py-3 text-cream/65">{o.note ?? "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => del(o)}
                        disabled={busy}
                        className="text-[11px] font-bold uppercase tracking-wider text-red-400/80 hover:underline disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AdminCard>

      {showAdd && (
        <OverrideAddModal
          productId={cfg.product.id}
          onCancel={() => setShowAdd(false)}
          onAdd={add}
        />
      )}
    </div>
  );
}

function OverrideAddModal({
  productId,
  onCancel,
  onAdd,
}: {
  productId: string;
  onCancel: () => void;
  onAdd: (
    row: Omit<DbBookableDateOverride, "id" | "updated_at">,
  ) => Promise<void>;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [closed, setClosed] = useState(true);
  const [openT, setOpenT] = useState("16:00");
  const [closeT, setCloseT] = useState("23:30");
  const [note, setNote] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 p-3 sm:items-center sm:p-6"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-plonkTeal/40 bg-ink p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-2xl">Date override</h3>
        <div className="mt-5 space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
              Date
            </p>
            <div className="mt-1.5">
              <DatePickerInput value={date} onChange={setDate} />
            </div>
          </div>

          <div className="flex gap-2 rounded-lg border border-cream/10 bg-ink/40 p-1">
            <button
              type="button"
              onClick={() => setClosed(true)}
              className={`flex-1 rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${
                closed
                  ? "bg-red-400/15 text-red-300"
                  : "text-cream/55 hover:text-cream"
              }`}
            >
              Closed all day
            </button>
            <button
              type="button"
              onClick={() => setClosed(false)}
              className={`flex-1 rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${
                !closed
                  ? "bg-plonkTeal/15 text-plonkTeal"
                  : "text-cream/55 hover:text-cream"
              }`}
            >
              Special hours
            </button>
          </div>

          {!closed && (
            <div className="grid gap-3 sm:grid-cols-2">
              <TimeField label="Open" value={openT} onCommit={setOpenT} />
              <TimeField label="Close" value={closeT} onCommit={setCloseT} />
            </div>
          )}

          <Field
            label="Note (optional)"
            value={note}
            onChange={setNote}
            placeholder="Private hire / Bank holiday / Sky Sports special…"
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-cream/20 px-5 py-2 text-xs font-bold uppercase tracking-wider text-cream/85"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onAdd({
                product_id: productId,
                date,
                closed,
                open_time: closed ? null : openT,
                close_time: closed ? null : closeT,
                note: note.trim() || null,
              })
            }
            className="rounded-full bg-plonkTeal px-5 py-2 text-xs font-bold uppercase tracking-wider text-ink"
          >
            Save override
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// Tiny field primitives
// =============================================================
function Field({
  label,
  value,
  onChange,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          placeholder={placeholder}
          className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:border-plonkTeal focus:outline-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:border-plonkTeal focus:outline-none"
        />
      )}
    </label>
  );
}
function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
        {label}
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkTeal focus:outline-none"
      />
    </label>
  );
}
function TimeField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (t: string) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => {
    setLocal(value);
  }, [value]);
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
        {label}
      </span>
      <input
        type="time"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          if (local !== value) onCommit(local);
        }}
        className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkTeal focus:outline-none"
      />
    </label>
  );
}
function PriceField({
  label,
  pence,
  onChange,
}: {
  label: string;
  pence: number;
  onChange: (p: number) => void;
}) {
  const [local, setLocal] = useState((pence / 100).toFixed(2));
  useEffect(() => {
    setLocal((pence / 100).toFixed(2));
  }, [pence]);
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
        {label}
      </span>
      <div className="relative mt-1.5">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-cream/40">
          £
        </span>
        <input
          type="text"
          value={local}
          onChange={(e) => setLocal(e.target.value.replace(/[^0-9.]/g, ""))}
          onBlur={() => {
            const n = parseFloat(local);
            if (!isNaN(n)) onChange(Math.round(n * 100));
          }}
          className="w-full rounded-lg border border-cream/15 bg-ink/40 py-2 pl-7 pr-3 text-sm text-cream focus:border-plonkTeal focus:outline-none"
        />
      </div>
    </label>
  );
}
