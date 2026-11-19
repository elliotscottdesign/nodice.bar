"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { confirmDialog, alertDialog } from "@/lib/dialog";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import Notice from "@/components/Notice";
import { AdminCard } from "@/components/admin/AdminCard";
import DatePickerInput from "@/components/admin/DatePickerInput";
import { fmtMoney } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { uploadImage } from "@/lib/db/media";
import VoucherPosterStudio, {
  type VoucherExport,
} from "@/components/admin/VoucherPosterStudio";
import {
  loadVouchers,
  createVoucher,
  updateVoucher,
  generateVoucherCode,
  loadVoucherDefaults,
  saveVoucherDefaults,
  loadVoucherRedemptions,
  sendVoucher,
  type DbVoucher,
  type VoucherStatus,
  type VoucherKind,
  type VoucherDefaults,
  type VoucherRedemption,
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

const KINDS: { key: VoucherKind; label: string; hint: string }[] = [
  { key: "gift", label: "Gift", hint: "Someone bought this for a friend." },
  { key: "comp", label: "Complimentary", hint: "A freebie — influencer, apology, thank-you." },
  { key: "raffle", label: "Raffle / prize", hint: "A prize to give away." },
  {
    key: "auction",
    label: "Auction / activity",
    hint: "An experience, not a cash value — e.g. mini golf + drinks for 6.",
  },
];

export default function VouchersClient() {
  const [vouchers, setVouchers] = useState<DbVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showMake, setShowMake] = useState(false);
  const [defaults, setDefaults] = useState<VoucherDefaults | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      setVouchers(await loadVouchers());
    } catch (e) {
      setErr(describe(e, "Failed to load vouchers"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    loadVoucherDefaults().then(setDefaults).catch(() => setDefaults(null));
  }, [reload]);

  async function cancelVoucher(v: DbVoucher) {
    if (
      !(await confirmDialog(
        `Cancel voucher ${v.code}? It can no longer be redeemed on the till.`,
      ))
    )
      return;
    try {
      await updateVoucher(v.id, { status: "cancelled" });
      await reload();
    } catch (e) {
      setErr(describe(e, "Cancel failed"));
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Vouchers"
        description="Make a No Dice voucher — gift, comp or prize. Generates the artwork with a locked code, emails it out, and it redeems on the till."
        action={
          !showMake && (
            <button
              onClick={() => setShowMake(true)}
              className="rounded-full bg-plonkPink px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90"
            >
              + Make a voucher
            </button>
          )
        }
      />

      {err && (
        <Notice variant="error" className="mb-6">
          {err}
        </Notice>
      )}

      {showMake && defaults && (
        <MakeVoucher
          defaults={defaults}
          onDefaultsChange={(d) => {
            setDefaults(d);
            saveVoucherDefaults(d).catch(() => {});
          }}
          onClose={() => setShowMake(false)}
          onCreated={async () => {
            await reload();
          }}
          onError={setErr}
        />
      )}

      {loading ? (
        <p className="text-sm text-cream/60">Loading…</p>
      ) : (
        <VoucherList
          vouchers={vouchers}
          onCancel={cancelVoucher}
          onChanged={reload}
          onError={setErr}
        />
      )}
    </>
  );
}

// ── Maker ────────────────────────────────────────────────────────────────────
function MakeVoucher({
  defaults,
  onDefaultsChange,
  onClose,
  onCreated,
  onError,
}: {
  defaults: VoucherDefaults;
  onDefaultsChange: (d: VoucherDefaults) => void;
  onClose: () => void;
  onCreated: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const [code] = useState(() => generateVoucherCode());
  const [kind, setKind] = useState<VoucherKind>("gift");
  const [valueStr, setValueStr] = useState("50");
  const [prize, setPrize] = useState("");
  const isAuction = kind === "auction";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [expires, setExpires] = useState(plusMonthsIso(12));
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState("");
  const [created, setCreated] = useState<DbVoucher | null>(null);
  const [sending, setSending] = useState(false);
  const exportRef = useRef<(() => Promise<VoucherExport>) | null>(null);

  const valuePence = isAuction ? 0 : Math.round((parseFloat(valueStr) || 0) * 100);
  const dirty =
    valueStr !== "50" || !!prize || !!name || !!email || !!phone || !!note || !!created;

  async function requestClose() {
    if (dirty && !created) {
      if (
        !(await confirmDialog(
          "Close this voucher without saving it? Your work will be lost.",
        ))
      )
        return;
    }
    onClose();
  }

  async function generate() {
    setLocalErr("");
    if (isAuction) {
      if (!prize.trim()) {
        setLocalErr("Describe the auction prize (e.g. mini golf + drinks for 6).");
        return;
      }
    } else if (!(valuePence > 0)) {
      setLocalErr("Enter a voucher value greater than £0.");
      return;
    }
    if (!exportRef.current) {
      setLocalErr("The artwork isn't ready yet — give it a second.");
      return;
    }
    setBusy(true);
    try {
      const art = await exportRef.current();
      // Upload the finished PNG so it has a permanent URL to email + reprint.
      const file = new File([art.blob], `voucher-${code}.png`, { type: "image/png" });
      const { public_url } = await uploadImage(file, "vouchers");
      const { data: userData } = await supabase().auth.getUser();
      const row = await createVoucher({
        code,
        value_pence: valuePence,
        prize_description: isAuction ? prize.trim() : null,
        expires_at: new Date(expires + "T23:59:59").toISOString(),
        kind,
        issued_to_name: name.trim() || null,
        issued_to_email: email.trim() || null,
        issued_to_phone: phone.trim() || null,
        note: note.trim() || null,
        poster_url: public_url,
        image_url: art.imageUrl || null,
        image_locked: defaults.image_locked,
        created_by: userData?.user?.email ?? null,
      });
      setCreated(row);
      await onCreated();
    } catch (e) {
      const m = describe(e, "Could not create the voucher.");
      setLocalErr(m);
      onError(m);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!created) return;
    if (!created.issued_to_email) {
      setLocalErr("Add an email address first, then send.");
      return;
    }
    setSending(true);
    try {
      await sendVoucher(created.id, created.issued_to_email);
      await alertDialog(`Voucher emailed to ${created.issued_to_email}.`);
      setCreated({ ...created, sent_at: new Date().toISOString() });
      await onCreated();
    } catch (e) {
      const m = describe(e, "Send failed.");
      setLocalErr(m);
      onError(m);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mb-8">
    <AdminCard>
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-display text-2xl">Make a voucher</h3>
        <button
          onClick={requestClose}
          className="rounded-full border border-cream/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/70 hover:bg-cream/5"
        >
          ✕ Close
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
        {/* Form */}
        <div className="space-y-4">
          {/* Kind */}
          <div>
            <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-cream/55">
              Type
            </span>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.key}
                  type="button"
                  onClick={() => setKind(k.key)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
                    kind === k.key
                      ? "border-plonkPink bg-plonkPink text-white"
                      : "border-cream/25 text-cream/70 hover:bg-cream/5"
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-cream/45">
              {KINDS.find((k) => k.key === kind)?.hint}
            </p>
          </div>

          {/* Value (cash vouchers) OR prize description (auction) */}
          {isAuction ? (
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
                What's the prize?
              </span>
              <textarea
                value={prize}
                onChange={(e) => setPrize(e.target.value)}
                disabled={!!created}
                rows={3}
                placeholder="e.g. A round of mini golf and a round of drinks for 6 people"
                className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none disabled:opacity-50"
              />
              <p className="mt-1 text-[11px] text-cream/45">
                No cash value — this voucher is redeemed for the experience, in one visit.
              </p>
            </label>
          ) : (
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
                Value (£)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={valueStr}
                onChange={(e) => setValueStr(e.target.value)}
                disabled={!!created}
                className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-base text-cream focus:border-plonkPink focus:outline-none disabled:opacity-50"
              />
              <div className="mt-2 flex gap-2">
                {[25, 50, 100, 150].map((v) => (
                  <button
                    key={v}
                    type="button"
                    disabled={!!created}
                    onClick={() => setValueStr(String(v))}
                    className="rounded-full border border-cream/20 px-3 py-1 text-[11px] font-bold text-cream/70 hover:bg-cream/5 disabled:opacity-40"
                  >
                    £{v}
                  </button>
                ))}
              </div>
            </label>
          )}

          {/* Code (locked) */}
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
              Voucher code (locked)
            </span>
            <div className="mt-1.5 rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 font-mono text-base tracking-wider text-plonkTeal">
              {code}
            </div>
          </div>

          {/* Recipient */}
          <div className="rounded-xl border border-cream/10 bg-ink/30 p-3">
            <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-cream/55">
              Send to (optional)
            </span>
            <div className="space-y-2">
              <input
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
              />
              <input
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
              />
            </div>
          </div>

          {/* Note + expiry */}
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
              Internal note (optional)
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Influencer @handle, raffle for the quiz"
              className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
              Expires on
            </span>
            <DatePickerInput
              value={expires}
              onChange={setExpires}
              className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-cream/45">
              Valid 1 year. Must be redeemed in full on the day it's first used —
              no change is carried over.
            </p>
          </label>

          {localErr && <Notice variant="error">{localErr}</Notice>}

          {/* Actions */}
          {!created ? (
            <button
              onClick={generate}
              disabled={busy}
              className="w-full rounded-full bg-plonkPink px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90 disabled:opacity-40"
            >
              {busy ? "Making…" : "Generate voucher"}
            </button>
          ) : (
            <div className="space-y-2">
              <Notice variant="success">
                Voucher {created.code} created
                {created.sent_at ? " and emailed." : "."}
              </Notice>
              <div className="flex gap-2">
                <button
                  onClick={send}
                  disabled={sending || !created.issued_to_email}
                  className="flex-1 rounded-full bg-plonkTeal px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkTeal/90 disabled:opacity-40"
                  title={created.issued_to_email ? "" : "Add an email to send"}
                >
                  {sending ? "Sending…" : created.sent_at ? "Resend email" : "Send email"}
                </button>
                {created.poster_url && (
                  <a
                    href={created.poster_url}
                    download={`no-dice-voucher-${created.code}.png`}
                    className="rounded-full border border-cream/25 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cream/80 hover:bg-cream/5"
                  >
                    ⬇ Download
                  </a>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-full rounded-full border border-cream/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cream/70 hover:bg-cream/5"
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* Artwork */}
        <div>
          <VoucherPosterStudio
            valuePence={valuePence}
            code={code}
            prizeDescription={isAuction ? prize : undefined}
            defaults={defaults}
            onDefaultsChange={onDefaultsChange}
            registerExport={(fn) => (exportRef.current = fn)}
          />
        </div>
      </div>
    </AdminCard>
    </div>
  );
}

// ── List ─────────────────────────────────────────────────────────────────────
function VoucherList({
  vouchers,
  onCancel,
  onChanged,
  onError,
}: {
  vouchers: DbVoucher[];
  onCancel: (v: DbVoucher) => void;
  onChanged: () => void;
  onError: (m: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [redemptions, setRedemptions] = useState<VoucherRedemption[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);

  async function viewRedemptions(v: DbVoucher) {
    if (openId === v.id) {
      setOpenId(null);
      return;
    }
    setOpenId(v.id);
    try {
      setRedemptions(await loadVoucherRedemptions(v.id));
    } catch {
      setRedemptions([]);
    }
  }

  async function resend(v: DbVoucher) {
    if (!v.issued_to_email) {
      onError("No email on this voucher — open it in Make a voucher to add one.");
      return;
    }
    setSendingId(v.id);
    try {
      await sendVoucher(v.id, v.issued_to_email);
      onChanged();
    } catch (e) {
      onError(describe(e, "Send failed"));
    } finally {
      setSendingId(null);
    }
  }

  if (vouchers.length === 0) {
    return (
      <AdminCard>
        <p className="px-5 py-10 text-center text-sm text-cream/55">
          No vouchers yet — click "+ Make a voucher".
        </p>
      </AdminCard>
    );
  }

  return (
    <AdminCard>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cream/10 text-left text-xs uppercase tracking-widest text-cream/50">
              <th className="px-4 py-3 font-bold">Code</th>
              <th className="px-4 py-3 font-bold">Type</th>
              <th className="px-4 py-3 font-bold">Issued to</th>
              <th className="px-4 py-3 font-bold">Value</th>
              <th className="px-4 py-3 font-bold">Balance</th>
              <th className="px-4 py-3 font-bold">Expires</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 text-right font-bold"></th>
            </tr>
          </thead>
          <tbody>
            {vouchers.map((v) => (
              <RowGroup
                key={v.id}
                v={v}
                open={openId === v.id}
                redemptions={openId === v.id ? redemptions : []}
                sending={sendingId === v.id}
                onView={() => viewRedemptions(v)}
                onResend={() => resend(v)}
                onCancel={() => onCancel(v)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </AdminCard>
  );
}

function RowGroup({
  v,
  open,
  redemptions,
  sending,
  onView,
  onResend,
  onCancel,
}: {
  v: DbVoucher;
  open: boolean;
  redemptions: VoucherRedemption[];
  sending: boolean;
  onView: () => void;
  onResend: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <tr className="border-b border-cream/5">
        <td className="px-4 py-3 font-mono text-xs">{v.code}</td>
        <td className="px-4 py-3 text-xs uppercase tracking-wider text-cream/60">
          {v.kind}
        </td>
        <td className="px-4 py-3 text-cream/85">
          {v.issued_to_name ?? "—"}
          {v.issued_to_email && (
            <p className="text-xs text-cream/55">{v.issued_to_email}</p>
          )}
          {v.sent_at && <p className="text-[11px] text-plonkTeal">✓ emailed</p>}
        </td>
        <td className="px-4 py-3 font-medium">
          {v.prize_description ? (
            <span className="text-plonkTeal">Prize</span>
          ) : (
            fmtMoney(v.value_pence)
          )}
        </td>
        <td className="px-4 py-3">
          {v.prize_description ? (
            <span className="text-xs text-cream/60">{v.prize_description}</span>
          ) : (
            fmtMoney(v.balance_pence)
          )}
        </td>
        <td className="px-4 py-3 text-cream/65">
          {new Date(v.expires_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </td>
        <td className="px-4 py-3">
          <StatusPill status={v.status} />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onView}
              className="text-xs font-semibold uppercase tracking-wider text-cream/60 hover:underline"
            >
              {open ? "Hide" : "History"}
            </button>
            {v.poster_url && (
              <a
                href={v.poster_url}
                download={`no-dice-voucher-${v.code}.png`}
                className="text-xs font-semibold uppercase tracking-wider text-cream/60 hover:underline"
              >
                Art
              </a>
            )}
            {v.status === "active" && v.issued_to_email && (
              <button
                onClick={onResend}
                disabled={sending}
                className="text-xs font-semibold uppercase tracking-wider text-plonkTeal hover:underline disabled:opacity-40"
              >
                {sending ? "…" : v.sent_at ? "Resend" : "Send"}
              </button>
            )}
            {v.status === "active" && (
              <button
                onClick={onCancel}
                className="text-xs font-semibold uppercase tracking-wider text-red-400/80 hover:underline"
              >
                Cancel
              </button>
            )}
          </div>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-cream/10 bg-ink/40">
          <td colSpan={8} className="px-4 py-3">
            {v.first_redeemed_on && (
              <p className="mb-2 text-xs text-cream/60">
                First used{" "}
                {new Date(v.first_redeemed_on).toLocaleDateString("en-GB")} —
                any balance left that day is void.
              </p>
            )}
            {redemptions.length === 0 ? (
              <p className="text-xs text-cream/45">Not redeemed yet.</p>
            ) : (
              <ul className="space-y-1 text-xs text-cream/75">
                {redemptions.map((r) => (
                  <li key={r.id} className="flex justify-between">
                    <span>
                      {new Date(r.redeemed_at).toLocaleString("en-GB")}
                      {r.staff ? ` · ${r.staff}` : ""}
                    </span>
                    <span>
                      −{fmtMoney(r.amount_pence)} (left {fmtMoney(r.balance_after_pence)})
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {v.note && (
              <p className="mt-2 text-xs italic text-cream/50">Note: {v.note}</p>
            )}
          </td>
        </tr>
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
