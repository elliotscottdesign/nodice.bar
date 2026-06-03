"use client";

import { useEffect, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { fmtMoney } from "@/lib/format";
import {
  loadVenues,
  loadTickets,
  updateTicket,
  deleteTicket,
  createTicket,
  type DbTicket,
  type DbVenue,
  type TicketKind,
} from "@/lib/db/tickets";

type TicketKindOpt = TicketKind;
const KIND_OPTS: TicketKindOpt[] = ["adult", "child", "bundle", "other"];
const CATEGORY_OPTS = ["golf", "pool"] as const;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type EditState = Partial<DbTicket> & { id: string; venue_id: string };
type CreateState = Omit<DbTicket, "id"> | null;

export default function TicketsClient() {
  const [venues, setVenues] = useState<DbVenue[]>([]);
  const [tickets, setTickets] = useState<DbTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<EditState | null>(null);
  const [creatingFor, setCreatingFor] = useState<CreateState>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      const [v, t] = await Promise.all([loadVenues(), loadTickets()]);
      setVenues(v);
      setTickets(t);
    } catch (e: unknown) {
      setErr(describeError(e, "Failed to load tickets"));
    } finally {
      setLoading(false);
    }
  }

  function describeError(e: unknown, fallback: string): string {
    if (e instanceof Error) return e.message;
    if (typeof e === "object" && e !== null) {
      const o = e as Record<string, unknown>;
      const msg = typeof o.message === "string" ? o.message : "";
      const code = typeof o.code === "string" ? o.code : "";
      const hint = typeof o.hint === "string" ? o.hint : "";
      const parts = [msg, code ? `(${code})` : "", hint ? `— ${hint}` : ""].filter(Boolean);
      if (parts.length > 0) return parts.join(" ");
    }
    return fallback;
  }

  useEffect(() => {
    reload();
  }, []);

  async function saveEdit(final: EditState) {
    setBusy(true);
    setErr("");
    try {
      const { id, venue_id, ...patch } = final;
      void venue_id;
      await updateTicket(id, patch);
      setEditing(null);
      await reload();
    } catch (e: unknown) {
      setErr(describeError(e, "Save failed"));
    } finally {
      setBusy(false);
    }
  }

  async function quickToggleActive(t: DbTicket) {
    setBusy(true);
    setErr("");
    try {
      await updateTicket(t.id, { active: !t.active });
      await reload();
    } catch (e: unknown) {
      setErr(describeError(e, "Toggle failed"));
    } finally {
      setBusy(false);
    }
  }

  async function removeTicket(t: DbTicket) {
    if (!confirm(`Delete "${t.name}"? This can't be undone.`)) return;
    setBusy(true);
    setErr("");
    try {
      await deleteTicket(t.id);
      await reload();
    } catch (e: unknown) {
      setErr(describeError(e, "Delete failed"));
    } finally {
      setBusy(false);
    }
  }

  async function saveCreate(final: EditState) {
    setBusy(true);
    setErr("");
    try {
      const { id, ...rest } = final;
      void id;
      await createTicket(rest as Omit<DbTicket, "id">);
      setCreatingFor(null);
      await reload();
    } catch (e: unknown) {
      setErr(describeError(e, "Create failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Tickets & Prices"
        description="The ticket types customers can buy at checkout. Plonk is currently below the UK VAT threshold, so no VAT is charged — prices are the final amount the customer pays. Changes go live immediately on the public booking page."
      />

      {err && (
        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-cream/60">Loading…</p>
      ) : (
        <div className="space-y-6">
          {venues.map((venue) => {
            const items = tickets
              .filter((t) => t.venue_id === venue.id)
              .sort((a, b) => a.sort_order - b.sort_order);
            return (
              <AdminCard
                key={venue.id}
                title={venue.name}
                action={
                  <button
                    onClick={() =>
                      setCreatingFor({
                        venue_id: venue.id,
                        name: "",
                        description: null,
                        kind: "adult",
                        category: "golf",
                        price_pence: 1100,
                        vat_rate_pct: 20,
                        active: true,
                        sort_order: items.length + 1,
                        available_days_of_week: null,
                      })
                    }
                    className="rounded-full bg-plonkPink px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90"
                  >
                    + Add ticket
                  </button>
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-cream/10 text-left text-xs uppercase tracking-widest text-cream/50">
                        <th className="px-5 py-3 font-bold">Name</th>
                        <th className="px-5 py-3 font-bold">Kind</th>
                        <th className="px-5 py-3 font-bold">Price</th>
                        <th className="px-5 py-3 font-bold">VAT %</th>
                        <th className="px-5 py-3 font-bold">Days</th>
                        <th className="px-5 py-3 font-bold">Active</th>
                        <th className="px-5 py-3 text-right font-bold"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-5 py-8 text-center text-sm text-cream/55">
                            No tickets at this venue yet — click "Add ticket".
                          </td>
                        </tr>
                      )}
                      {items.map((t) => (
                        <tr key={t.id} className="border-b border-cream/5 last:border-b-0">
                          <td className="px-5 py-3">
                            {t.name}
                            {t.description && (
                              <p className="mt-0.5 text-xs text-cream/55">{t.description}</p>
                            )}
                          </td>
                          <td className="px-5 py-3"><KindBadge kind={t.kind} /></td>
                          <td className="px-5 py-3 font-medium">{fmtMoney(t.price_pence)}</td>
                          <td className="px-5 py-3 text-cream/65">{t.vat_rate_pct}%</td>
                          <td className="px-5 py-3 text-cream/65 text-xs">
                            {t.available_days_of_week && t.available_days_of_week.length > 0
                              ? t.available_days_of_week.map((d) => DAY_LABELS[d]).join(", ")
                              : "Every day"}
                          </td>
                          <td className="px-5 py-3">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => quickToggleActive(t)}
                              className="cursor-pointer"
                              aria-label={t.active ? "Deactivate" : "Activate"}
                            >
                              <Toggle on={t.active} />
                            </button>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => setEditing(t)}
                              disabled={busy}
                              className="mr-2 text-xs font-semibold uppercase tracking-wider text-plonkYellow hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => removeTicket(t)}
                              disabled={busy}
                              className="text-xs font-semibold uppercase tracking-wider text-red-400/80 hover:underline"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </AdminCard>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-xs text-cream/50">
        <strong>Kind</strong> drives booking rules — children can't be booked
        without an adult, bundles count as adults. Available days lets you
        restrict a ticket to a specific weekday (used by Tuesday Hackney's
        Drink, Golf &amp; Game bundle).
      </p>

      {editing && (
        <TicketModal
          title="Edit ticket"
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={saveEdit}
          busy={busy}
        />
      )}
      {creatingFor && (
        <TicketModal
          title="Add ticket"
          initial={creatingFor as unknown as EditState}
          onCancel={() => setCreatingFor(null)}
          onSave={saveCreate}
          busy={busy}
        />
      )}
    </>
  );
}

function TicketModal({
  title,
  initial,
  onCancel,
  onSave,
  busy,
}: {
  title: string;
  initial: EditState;
  onCancel: () => void;
  onSave: (final: EditState) => void;
  busy: boolean;
}) {
  // Draft of the non-numeric fields. Numeric fields are tracked as raw strings
  // below so the user can type without us reformatting on every keystroke.
  const [draft, setDraft] = useState<EditState>(initial);
  const [priceStr, setPriceStr] = useState<string>(
    ((initial.price_pence ?? 0) / 100).toFixed(2),
  );
  const [vatStr, setVatStr] = useState<string>(String(initial.vat_rate_pct ?? 20));
  const [sortStr, setSortStr] = useState<string>(String(initial.sort_order ?? 0));
  const [localErr, setLocalErr] = useState<string>("");

  const days = draft.available_days_of_week ?? [];

  function toggleDay(d: number) {
    const cur = new Set(days);
    if (cur.has(d)) cur.delete(d);
    else cur.add(d);
    setDraft({
      ...draft,
      available_days_of_week: cur.size === 0 ? null : Array.from(cur).sort(),
    });
  }

  function handleSave() {
    setLocalErr("");
    const price = parseFloat(priceStr.replace(/[^0-9.\-]/g, ""));
    if (!Number.isFinite(price) || price < 0) {
      setLocalErr("Enter a valid price (e.g. 11.00).");
      return;
    }
    const vat = parseInt(vatStr, 10);
    if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
      setLocalErr("VAT % must be between 0 and 100.");
      return;
    }
    const sort = parseInt(sortStr, 10);
    if (!Number.isFinite(sort)) {
      setLocalErr("Sort order must be a whole number.");
      return;
    }
    if (!draft.name || draft.name.trim().length === 0) {
      setLocalErr("Ticket needs a name.");
      return;
    }
    onSave({
      ...draft,
      name: draft.name!.trim(),
      price_pence: Math.round(price * 100),
      vat_rate_pct: vat,
      sort_order: sort,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 p-3 sm:items-center sm:p-6"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-cream/15 bg-ink p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-2xl">{title}</h3>

        <div className="mt-5 space-y-4">
          <Field
            label="Name"
            value={draft.name ?? ""}
            onChange={(v) => setDraft({ ...draft, name: v })}
          />
          <Field
            label="Description (optional)"
            value={draft.description ?? ""}
            onChange={(v) => setDraft({ ...draft, description: v || null })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Price (£)"
              value={priceStr}
              onChange={setPriceStr}
              type="text"
              inputMode="decimal"
              placeholder="11.00"
            />
            <Field
              label="VAT %"
              value={vatStr}
              onChange={setVatStr}
              type="text"
              inputMode="numeric"
              placeholder="20"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Kind"
              value={draft.kind ?? "adult"}
              options={KIND_OPTS.map((k) => ({ value: k, label: k }))}
              onChange={(v) => setDraft({ ...draft, kind: v as TicketKind })}
            />
            <Select
              label="Category"
              value={draft.category ?? "golf"}
              options={CATEGORY_OPTS.map((c) => ({ value: c, label: c }))}
              onChange={(v) => setDraft({ ...draft, category: v as "golf" | "pool" })}
            />
          </div>
          <Field
            label="Sort order"
            value={sortStr}
            onChange={setSortStr}
            type="text"
            inputMode="numeric"
            placeholder="1"
          />

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-cream/55">
              Available days (none = every day)
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DAY_LABELS.map((d, i) => {
                const on = days.includes(i);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                      on
                        ? "border-plonkPink bg-plonkPink/15 text-cream"
                        : "border-cream/15 text-cream/65 hover:border-cream/30"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-cream/80">
            <input
              type="checkbox"
              checked={!!draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
              className="h-4 w-4 rounded border-cream/20 bg-ink/40"
            />
            Active (visible to customers)
          </label>

          {localErr && (
            <p className="rounded-lg border border-red-400/30 bg-red-400/5 px-3 py-2 text-sm text-red-300">
              {localErr}
            </p>
          )}
        </div>

        <div className="mt-6 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-cream/20 px-5 py-2 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="rounded-full bg-plonkPink px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90 disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: "text" | "decimal" | "numeric";
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-widest text-cream/55">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:border-plonkPink focus:outline-none"
      />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-widest text-cream/55">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full appearance-none rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function KindBadge({ kind }: { kind: TicketKind }) {
  const styles: Record<TicketKind, string> = {
    adult: "bg-plonkPink/15 text-plonkPink",
    child: "bg-plonkYellow/15 text-plonkYellow",
    bundle: "bg-plonkTeal/15 text-plonkTeal",
    other: "bg-cream/10 text-cream/70",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${styles[kind]}`}>
      {kind}
    </span>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span className={`inline-flex h-5 w-9 items-center rounded-full transition ${on ? "bg-plonkTeal/80" : "bg-cream/15"}`}>
      <span className={`h-4 w-4 transform rounded-full bg-white transition ${on ? "translate-x-4" : "translate-x-0.5"}`} />
    </span>
  );
}
