"use client";

import { useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import { createManualGolfBooking } from "@/lib/db/bookings";

// =============================================================
// AddGolfBookingForm — manual admin golf booking
// =============================================================
// The golf equivalent of the pool/table/tournament "+ Add
// manually" forms. Golf normally goes card → Stripe; this records
// a phone / walk-in / comp booking straight as CONFIRMED, no card.
// Fields mirror what a customer picks online: date, tee time,
// players (ticket types), name/email/phone, plus a Paid/Comp
// settlement toggle.
// =============================================================

const inputCls =
  "w-full rounded-lg border border-cream/15 bg-ink/30 px-3 py-2 text-sm text-cream " +
  "placeholder:text-cream/40 focus:border-plonkPink focus:outline-none";

// Golf ticket types (names must match rows in `tickets`). Prices are
// shown for reference; the real price is read from the DB on save so a
// price change in admin flows through without touching this file.
const GOLF_TICKETS: { name: string; label: string; hint: string }[] = [
  { name: "Adult round", label: "Adult", hint: "£7" },
  { name: "Child round", label: "Child", hint: "£7" },
  { name: "Drink, Golf & Game", label: "Drink · Golf · Game", hint: "£12" },
];

export default function AddGolfBookingForm({
  onCreated,
  initialDate,
  startOpen = false,
}: {
  onCreated: () => void;
  initialDate?: string;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(initialDate || today);
  const [time, setTime] = useState("18:00");
  const [qty, setQty] = useState<Record<string, number>>({
    "Adult round": 2,
    "Child round": 0,
    "Drink, Golf & Game": 0,
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [settlement, setSettlement] = useState<"paid" | "comp">("paid");

  const totalPlayers = Object.values(qty).reduce((a, b) => a + b, 0);

  function setCount(name: string, n: number) {
    setQty((q) => ({ ...q, [name]: Math.max(0, n) }));
  }

  function reset() {
    setTime("18:00");
    setQty({ "Adult round": 2, "Child round": 0, "Drink, Golf & Game": 0 });
    setName("");
    setEmail("");
    setPhone("");
    setSettlement("paid");
    setErr("");
    setOk("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setOk("");
    if (!name.trim()) {
      setErr("Customer name is required.");
      return;
    }
    if (totalPlayers < 1) {
      setErr("Add at least one player.");
      return;
    }
    setBusy(true);
    try {
      const { reference } = await createManualGolfBooking({
        slot_date: date,
        slot_time: time,
        customer_name: name.trim(),
        customer_email: email.trim(),
        customer_phone: phone.trim() || null,
        tickets: GOLF_TICKETS.map((t) => ({
          name: t.name,
          quantity: qty[t.name] ?? 0,
        })),
        comp: settlement === "comp",
      });
      setOk(
        `Golf booking added for ${name.trim()} — ${totalPlayers} player${
          totalPlayers === 1 ? "" : "s"
        } (${settlement === "comp" ? "comp" : "paid at venue"}). Ref ${reference}.`,
      );
      reset();
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add golf booking.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-plonkPink px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90"
        >
          + Add golf booking manually
        </button>
      </div>
    );
  }

  return (
    <AdminCard title="Add golf booking">
      <form onSubmit={submit} className="space-y-4 px-5 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
              Date
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls + " mt-1"}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
              Tee time
            </label>
            <input
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={inputCls + " mt-1"}
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
            Players
          </label>
          <div className="mt-1 space-y-2">
            {GOLF_TICKETS.map((t) => (
              <div
                key={t.name}
                className="flex items-center gap-3 rounded-lg border border-cream/10 bg-ink/30 px-3 py-2"
              >
                <span className="flex-1 text-sm text-cream/90">
                  {t.label}
                  <span className="ml-2 text-xs text-cream/45">{t.hint}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setCount(t.name, (qty[t.name] ?? 0) - 1)}
                  className="h-7 w-7 rounded-full border border-cream/20 text-cream/80 hover:bg-cream/5"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-bold text-cream">
                  {qty[t.name] ?? 0}
                </span>
                <button
                  type="button"
                  onClick={() => setCount(t.name, (qty[t.name] ?? 0) + 1)}
                  className="h-7 w-7 rounded-full border border-cream/20 text-cream/80 hover:bg-cream/5"
                >
                  +
                </button>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-cream/45">
            {totalPlayers} player{totalPlayers === 1 ? "" : "s"} total
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
              Customer name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Their name"
              className={inputCls + " mt-1"}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
              Email (optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="For their records"
              className={inputCls + " mt-1"}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
              Phone (optional)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Useful if anything changes"
              className={inputCls + " mt-1"}
            />
          </div>
        </div>

        {/* Settlement — how it was paid for. Comp records £0. */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
            Settlement
          </label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSettlement("paid")}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                settlement === "paid"
                  ? "border-plonkTeal/60 bg-plonkTeal/10 text-plonkTeal"
                  : "border-cream/15 bg-ink/30 text-cream/60 hover:bg-cream/5"
              }`}
            >
              <span className="block font-semibold">Paid at venue</span>
              <span className="mt-0.5 block text-[11px] text-cream/55">
                Cash or card on the till
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSettlement("comp")}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                settlement === "comp"
                  ? "border-plonkYellow/60 bg-plonkYellow/10 text-plonkYellow"
                  : "border-cream/15 bg-ink/30 text-cream/60 hover:bg-cream/5"
              }`}
            >
              <span className="block font-semibold">Comp (free)</span>
              <span className="mt-0.5 block text-[11px] text-cream/55">
                Guest / staff / free round
              </span>
            </button>
          </div>
        </div>

        {err && (
          <div className="rounded-lg border border-plonkPink/40 bg-plonkPink/10 px-3 py-2 text-sm text-plonkPink">
            {err}
          </div>
        )}
        {ok && (
          <div className="rounded-lg border border-plonkTeal/40 bg-plonkTeal/10 px-3 py-2 text-sm text-plonkTeal">
            {ok}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            disabled={busy}
            className="rounded-full border border-cream/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cream/75 transition hover:bg-cream/5 disabled:opacity-50"
          >
            Close
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-plonkPink px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add golf booking"}
          </button>
        </div>
      </form>
    </AdminCard>
  );
}
