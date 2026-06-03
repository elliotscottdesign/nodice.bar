"use client";

import { useEffect, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { fmtMoney } from "@/lib/format";
import { loadVenues, type DbVenue } from "@/lib/db/tickets";
import {
  loadAddons,
  createAddon,
  updateAddon,
  deleteAddon,
  type DbAddon,
} from "@/lib/db/addons";

type Draft = {
  venue_id: string | null;
  name: string;
  description: string | null;
  price_pence: number;
  vat_rate_pct: number;
  active: boolean;
  sort_order: number;
};
type Modal =
  | { mode: "create"; draft: Draft }
  | { mode: "edit"; id: string; draft: Draft }
  | null;

function describe(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    if (typeof o.message === "string") return o.message;
  }
  return fallback;
}

export default function AddonsClient() {
  const [venues, setVenues] = useState<DbVenue[]>([]);
  const [addons, setAddons] = useState<DbAddon[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<Modal>(null);

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      const [v, a] = await Promise.all([loadVenues(), loadAddons()]);
      setVenues(v);
      setAddons(a);
    } catch (e) {
      setErr(describe(e, "Failed to load add-ons"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  async function handleToggleActive(a: DbAddon) {
    setBusy(true);
    try {
      await updateAddon(a.id, { active: !a.active });
      await reload();
    } catch (e) {
      setErr(describe(e, "Toggle failed"));
    } finally {
      setBusy(false);
    }
  }
  async function handleDelete(a: DbAddon) {
    if (!confirm(`Delete "${a.name}"?`)) return;
    setBusy(true);
    try {
      await deleteAddon(a.id);
      await reload();
    } catch (e) {
      setErr(describe(e, "Delete failed"));
    } finally {
      setBusy(false);
    }
  }
  async function handleSave(draft: Draft) {
    setBusy(true);
    setErr("");
    try {
      if (modal?.mode === "create") await createAddon(draft);
      else if (modal?.mode === "edit") await updateAddon(modal.id, draft);
      setModal(null);
      await reload();
    } catch (e) {
      setErr(describe(e, "Save failed"));
    } finally {
      setBusy(false);
    }
  }
  function openCreate() {
    setModal({
      mode: "create",
      draft: {
        venue_id: null,
        name: "",
        description: null,
        price_pence: 500,
        vat_rate_pct: 20,
        active: true,
        sort_order: addons.length + 1,
      },
    });
  }
  function openEdit(a: DbAddon) {
    setModal({
      mode: "edit",
      id: a.id,
      draft: {
        venue_id: a.venue_id,
        name: a.name,
        description: a.description,
        price_pence: a.price_pence,
        vat_rate_pct: a.vat_rate_pct,
        active: a.active,
        sort_order: a.sort_order,
      },
    });
  }

  const venueLabel = (id: string | null) =>
    id == null ? "Both venues" : venues.find((v) => v.id === id)?.name ?? "—";

  return (
    <>
      <AdminPageHeader
        title="Add-ons"
        description="Extras customers can add to their basket after picking a slot — food, drink, merch."
        action={
          <button
            onClick={openCreate}
            className="rounded-full bg-plonkPink px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90"
          >
            + Add product
          </button>
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
                  <th className="px-5 py-3 font-bold">Product</th>
                  <th className="px-5 py-3 font-bold">Available at</th>
                  <th className="px-5 py-3 font-bold">Price</th>
                  <th className="px-5 py-3 font-bold">Active</th>
                  <th className="px-5 py-3 text-right font-bold"></th>
                </tr>
              </thead>
              <tbody>
                {addons.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-cream/55">
                      No add-ons yet — click "+ Add product".
                    </td>
                  </tr>
                )}
                {addons.map((a) => (
                  <tr key={a.id} className="border-b border-cream/5 last:border-b-0">
                    <td className="px-5 py-3">
                      <p className="font-medium">{a.name}</p>
                      {a.description && (
                        <p className="mt-1 max-w-md text-xs text-cream/55">{a.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-cream/65">{venueLabel(a.venue_id)}</td>
                    <td className="px-5 py-3 font-medium">{fmtMoney(a.price_pence)}</td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleToggleActive(a)}
                        aria-label={a.active ? "Deactivate" : "Activate"}
                      >
                        <Toggle on={a.active} />
                      </button>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => openEdit(a)}
                        disabled={busy}
                        className="mr-2 text-xs font-semibold uppercase tracking-wider text-plonkYellow hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(a)}
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
      )}

      {modal && (
        <AddonModal
          title={modal.mode === "create" ? "New add-on" : "Edit add-on"}
          initial={modal.draft}
          venues={venues}
          onCancel={() => setModal(null)}
          onSave={handleSave}
          busy={busy}
        />
      )}
    </>
  );
}

function AddonModal({
  title,
  initial,
  venues,
  onCancel,
  onSave,
  busy,
}: {
  title: string;
  initial: Draft;
  venues: DbVenue[];
  onCancel: () => void;
  onSave: (d: Draft) => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [priceStr, setPriceStr] = useState((initial.price_pence / 100).toFixed(2));
  const [vatStr, setVatStr] = useState(String(initial.vat_rate_pct));
  const [sortStr, setSortStr] = useState(String(initial.sort_order));
  const [localErr, setLocalErr] = useState("");

  function handleSave() {
    setLocalErr("");
    if (!draft.name.trim()) {
      setLocalErr("Name is required.");
      return;
    }
    const price = parseFloat(priceStr);
    if (!Number.isFinite(price) || price < 0) {
      setLocalErr("Enter a valid price (e.g. 5.00).");
      return;
    }
    const vat = parseInt(vatStr, 10);
    if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
      setLocalErr("VAT must be 0-100.");
      return;
    }
    const sort = parseInt(sortStr, 10);
    if (!Number.isFinite(sort)) {
      setLocalErr("Sort order must be a number.");
      return;
    }
    onSave({
      ...draft,
      name: draft.name.trim(),
      description: draft.description?.trim() || null,
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
            value={draft.name}
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
              inputMode="decimal"
              placeholder="5.00"
            />
            <Field
              label="VAT %"
              value={vatStr}
              onChange={setVatStr}
              inputMode="numeric"
              placeholder="20"
            />
          </div>
          <Select
            label="Available at"
            value={draft.venue_id ?? ""}
            options={[
              { value: "", label: "Both venues" },
              ...venues.map((v) => ({ value: v.id, label: v.name })),
            ]}
            onChange={(v) => setDraft({ ...draft, venue_id: v || null })}
          />
          <Field
            label="Sort order"
            value={sortStr}
            onChange={setSortStr}
            inputMode="numeric"
            placeholder="1"
          />
          <label className="flex items-center gap-2 text-sm text-cream/80">
            <input
              type="checkbox"
              checked={draft.active}
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
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-flex h-5 w-9 items-center rounded-full transition ${
        on ? "bg-plonkTeal/80" : "bg-cream/15"
      }`}
    >
      <span
        className={`h-4 w-4 transform rounded-full bg-white transition ${
          on ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </span>
  );
}
