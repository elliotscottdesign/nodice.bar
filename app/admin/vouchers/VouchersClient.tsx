"use client";

import { useEffect, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { fmtMoney } from "@/lib/format";
import {
  loadVouchers,
  createVoucher,
  updateVoucher,
  type DbVoucher,
  type VoucherStatus,
} from "@/lib/db/vouchers";

function describe(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
}

function plusMonthsIso(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export default function VouchersClient() {
  const [vouchers, setVouchers] = useState<DbVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      setVouchers(await loadVouchers());
    } catch (e) {
      setErr(describe(e, "Failed to load vouchers"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  async function cancelVoucher(v: DbVoucher) {
    if (!confirm(`Cancel voucher ${v.code}? Customers won't be able to redeem it.`)) return;
    setBusy(true);
    try {
      await updateVoucher(v.id, { status: "cancelled" });
      await reload();
    } catch (e) {
      setErr(describe(e, "Cancel failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Vouchers"
        description="Gift vouchers issued to customers — code, value, balance, expiry."
        action={
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-full bg-plonkPink px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90"
          >
            + Issue voucher
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
                  <th className="px-5 py-3 font-bold">Issued to</th>
                  <th className="px-5 py-3 font-bold">Value</th>
                  <th className="px-5 py-3 font-bold">Balance</th>
                  <th className="px-5 py-3 font-bold">Expires</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 text-right font-bold"></th>
                </tr>
              </thead>
              <tbody>
                {vouchers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-cream/55">
                      No vouchers issued yet — click "+ Issue voucher".
                    </td>
                  </tr>
                )}
                {vouchers.map((v) => (
                  <tr key={v.id} className="border-b border-cream/5 last:border-b-0">
                    <td className="px-5 py-3 font-mono text-xs">{v.code}</td>
                    <td className="px-5 py-3 text-cream/85">
                      {v.issued_to_name ?? "—"}
                      {v.issued_to_email && (
                        <p className="text-xs text-cream/55">{v.issued_to_email}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 font-medium">{fmtMoney(v.value_pence)}</td>
                    <td className="px-5 py-3">{fmtMoney(v.balance_pence)}</td>
                    <td className="px-5 py-3 text-cream/65">
                      {new Date(v.expires_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill status={v.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      {v.status === "active" && (
                        <button
                          onClick={() => cancelVoucher(v)}
                          disabled={busy}
                          className="text-xs font-semibold uppercase tracking-wider text-red-400/80 hover:underline"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}

      {showAdd && (
        <IssueVoucherModal
          onCancel={() => setShowAdd(false)}
          onSaved={async () => {
            setShowAdd(false);
            await reload();
          }}
          onError={setErr}
        />
      )}
    </>
  );
}

function StatusPill({ status }: { status: VoucherStatus }) {
  const styles: Record<VoucherStatus, string> = {
    active: "bg-plonkTeal/15 text-plonkTeal",
    redeemed: "bg-cream/10 text-cream/60",
    expired: "bg-red-400/15 text-red-300",
    cancelled: "bg-red-400/15 text-red-300",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function IssueVoucherModal({
  onCancel,
  onSaved,
  onError,
}: {
  onCancel: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [valueStr, setValueStr] = useState("50.00");
  const [issuedToName, setIssuedToName] = useState("");
  const [issuedToEmail, setIssuedToEmail] = useState("");
  const [expires, setExpires] = useState(plusMonthsIso(12));
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState("");

  async function save() {
    setLocalErr("");
    const val = parseFloat(valueStr);
    if (!Number.isFinite(val) || val <= 0) {
      setLocalErr("Value must be greater than £0.");
      return;
    }
    setBusy(true);
    try {
      await createVoucher({
        value_pence: Math.round(val * 100),
        issued_to_name: issuedToName.trim() || null,
        issued_to_email: issuedToEmail.trim() || null,
        expires_at: new Date(expires + "T23:59:59").toISOString(),
      });
      onSaved();
    } catch (e) {
      const m = describe(e, "Issue failed");
      setLocalErr(m);
      onError(m);
    } finally {
      setBusy(false);
    }
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
        <h3 className="font-display text-2xl">Issue voucher</h3>
        <p className="mt-1 text-xs text-cream/55">
          A new GIFT-xxxx code will be generated automatically.
        </p>
        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
              Value (£)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={valueStr}
              onChange={(e) => setValueStr(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
              Issued to (name, optional)
            </span>
            <input
              type="text"
              value={issuedToName}
              onChange={(e) => setIssuedToName(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
              Email (optional)
            </span>
            <input
              type="email"
              value={issuedToEmail}
              onChange={(e) => setIssuedToEmail(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
              Expires on
            </span>
            <input
              type="date"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
            />
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
            onClick={save}
            disabled={busy}
            className="rounded-full bg-plonkPink px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90 disabled:opacity-40"
          >
            {busy ? "Saving…" : "Issue"}
          </button>
        </div>
      </div>
    </div>
  );
}
