"use client";

import { useEffect, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { fmtMoney } from "@/lib/format";
import {
  loadPromos,
  createPromo,
  updatePromo,
  deletePromo,
  type DbPromoCode,
  type PromoKind,
} from "@/lib/db/promos";

type ModalState =
  | { mode: "create"; draft: DraftPromo }
  | { mode: "edit"; id: string; draft: DraftPromo }
  | null;

type DraftPromo = {
  code: string;
  kind: PromoKind;
  value: number; // % when kind=percent; pence when kind=fixed
  valid_from: string; // ISO date "YYYY-MM-DD"
  valid_to: string;
  max_uses: number | null;
  active: boolean;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function plusDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function describe(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    const msg = typeof o.message === "string" ? o.message : "";
    if (msg) return msg;
  }
  return fallback;
}

export default function PromosClient() {
  const [promos, setPromos] = useState<DbPromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      setPromos(await loadPromos());
    } catch (e) {
      setErr(describe(e, "Failed to load promo codes"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  async function handleToggleActive(p: DbPromoCode) {
    setBusy(true);
    try {
      await updatePromo(p.id, { active: !p.active });
      await reload();
    } catch (e) {
      setErr(describe(e, "Toggle failed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(p: DbPromoCode) {
    if (!confirm(`Delete code "${p.code}"? This can't be undone.`)) return;
    setBusy(true);
    try {
      await deletePromo(p.id);
      await reload();
    } catch (e) {
      setErr(describe(e, "Delete failed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(draft: DraftPromo) {
    setBusy(true);
    setErr("");
    try {
      const payload = {
        code: draft.code.trim().toUpperCase(),
        kind: draft.kind,
        value: draft.value,
        valid_from: new Date(draft.valid_from + "T00:00:00").toISOString(),
        valid_to: new Date(draft.valid_to + "T23:59:59").toISOString(),
        max_uses: draft.max_uses,
        active: draft.active,
      };
      if (modal?.mode === "create") {
        await createPromo(payload);
      } else if (modal?.mode === "edit") {
        await updatePromo(modal.id, payload);
      }
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
        code: "",
        kind: "percent",
        value: 10,
        valid_from: todayIso(),
        valid_to: plusDaysIso(90),
        max_uses: null,
        active: true,
      },
    });
  }
  function openEdit(p: DbPromoCode) {
    setModal({
      mode: "edit",
      id: p.id,
      draft: {
        code: p.code,
        kind: p.kind,
        value: p.value,
        valid_from: p.valid_from.slice(0, 10),
        valid_to: p.valid_to.slice(0, 10),
        max_uses: p.max_uses,
        active: p.active,
      },
    });
  }

  return (
    <>
      <AdminPageHeader
        title="Promo Codes"
        description="Discount codes customers can enter at checkout. Set the value, dates, and usage limit."
        action={
          <button
            onClick={openCreate}
            className="rounded-full bg-plonkPink px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90"
          >
            + New code
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
                  <th className="px-5 py-3 font-bold">Code</th>
                  <th className="px-5 py-3 font-bold">Discount</th>
                  <th className="px-5 py-3 font-bold">Valid</th>
                  <th className="px-5 py-3 font-bold">Uses</th>
                  <th className="px-5 py-3 font-bold">Active</th>
                  <th className="px-5 py-3 text-right font-bold"></th>
                </tr>
              </thead>
              <tbody>
                {promos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-cream/55">
                      No promo codes yet — click "+ New code".
                    </td>
                  </tr>
                )}
                {promos.map((p) => {
                  const discount =
                    p.kind === "percent" ? `${p.value}% off` : `${fmtMoney(p.value)} off`;
                  const from = new Date(p.valid_from).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });
                  const to = new Date(p.valid_to).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });
                  return (
                    <tr key={p.id} className="border-b border-cream/5 last:border-b-0">
                      <td className="px-5 py-3 font-mono text-xs">{p.code}</td>
                      <td className="px-5 py-3 font-medium">{discount}</td>
                      <td className="px-5 py-3 text-cream/65 text-xs">
                        {from} → {to}
                      </td>
                      <td className="px-5 py-3">
                        {p.uses}
                        {p.max_uses ? (
                          <span className="text-cream/50"> / {p.max_uses}</span>
                        ) : (
                          <span className="text-cream/50"> / ∞</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleToggleActive(p)}
                          aria-label={p.active ? "Deactivate" : "Activate"}
                        >
                          <Toggle on={p.active} />
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => openEdit(p)}
                          disabled={busy}
                          className="mr-2 text-xs font-semibold uppercase tracking-wider text-plonkYellow hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          disabled={busy}
                          className="text-xs font-semibold uppercase tracking-wider text-red-400/80 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}

      <p className="mt-8 text-xs text-cream/50">
        Codes are case-sensitive at checkout and stored uppercase. Percentage
        discounts apply to the subtotal before VAT settlement, fixed-amount
        discounts come off in pence.
      </p>

      {modal && (
        <PromoModal
          title={modal.mode === "create" ? "New promo code" : "Edit promo code"}
          initial={modal.draft}
          onCancel={() => setModal(null)}
          onSave={handleSave}
          busy={busy}
        />
      )}
    </>
  );
}

function PromoModal({
  title,
  initial,
  onCancel,
  onSave,
  busy,
}: {
  title: string;
  initial: DraftPromo;
  onCancel: () => void;
  onSave: (d: DraftPromo) => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<DraftPromo>(initial);
  const [valueStr, setValueStr] = useState<string>(
    initial.kind === "percent" ? String(initial.value) : (initial.value / 100).toFixed(2),
  );
  const [maxUsesStr, setMaxUsesStr] = useState<string>(
    initial.max_uses == null ? "" : String(initial.max_uses),
  );
  const [localErr, setLocalErr] = useState("");

  function handleSave() {
    setLocalErr("");
    const code = draft.code.trim().toUpperCase();
    if (!code) {
      setLocalErr("Code is required.");
      return;
    }
    let value: number;
    if (draft.kind === "percent") {
      const n = parseInt(valueStr, 10);
      if (!Number.isFinite(n) || n < 1 || n > 100) {
        setLocalErr("Percent must be between 1 and 100.");
        return;
      }
      value = n;
    } else {
      const f = parseFloat(valueStr);
      if (!Number.isFinite(f) || f <= 0) {
        setLocalErr("Fixed discount must be greater than £0.");
        return;
      }
      value = Math.round(f * 100);
    }
    let maxUses: number | null = null;
    if (maxUsesStr.trim() !== "") {
      const u = parseInt(maxUsesStr, 10);
      if (!Number.isFinite(u) || u < 1) {
        setLocalErr("Max uses must be a whole number, or leave blank for unlimited.");
        return;
      }
      maxUses = u;
    }
    if (draft.valid_to < draft.valid_from) {
      setLocalErr("Valid-to date cannot be before valid-from date.");
      return;
    }
    onSave({ ...draft, code, value, max_uses: maxUses });
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
            label="Code"
            value={draft.code}
            onChange={(v) => setDraft({ ...draft, code: v })}
            placeholder="FRIDAY20"
          />
          <Select
            label="Kind"
            value={draft.kind}
            options={[
              { value: "percent", label: "Percentage off" },
              { value: "fixed", label: "Fixed amount off" },
            ]}
            onChange={(v) => {
              const k = v as PromoKind;
              setDraft({ ...draft, kind: k, value: k === "percent" ? 10 : 500 });
              setValueStr(k === "percent" ? "10" : "5.00");
            }}
          />
          <Field
            label={draft.kind === "percent" ? "Percent off (1-100)" : "Amount off in £"}
            value={valueStr}
            onChange={setValueStr}
            inputMode={draft.kind === "percent" ? "numeric" : "decimal"}
            placeholder={draft.kind === "percent" ? "20" : "5.00"}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Valid from"
              type="date"
              value={draft.valid_from}
              onChange={(v) => setDraft({ ...draft, valid_from: v })}
            />
            <Field
              label="Valid to"
              type="date"
              value={draft.valid_to}
              onChange={(v) => setDraft({ ...draft, valid_to: v })}
            />
          </div>
          <Field
            label="Max uses (blank = unlimited)"
            value={maxUsesStr}
            onChange={setMaxUsesStr}
            inputMode="numeric"
            placeholder=""
          />
          <label className="flex items-center gap-2 text-sm text-cream/80">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
              className="h-4 w-4 rounded border-cream/20 bg-ink/40"
            />
            Active
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
