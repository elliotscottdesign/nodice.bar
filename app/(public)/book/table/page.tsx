"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBarReservation } from "@/lib/db/barReservations";
import {
  loadBookableProductConfig,
  availableSlotsForDate,
  isDateBookable,
  recurringClosedDaysOfWeek,
  DAY_NAMES,
  type BookableProductConfig,
} from "@/lib/db/bookableProducts";
import DatePickerInput from "@/components/admin/DatePickerInput";
import BrandSelect from "@/components/BrandSelect";

// =============================================================
// /book/table — bar table reservation (FREE)
// =============================================================
// Mirrors the /book/pool polish:
//   • Live config from /admin/products/table (hours, closed days,
//     min/max party, slot length, header copy)
//   • On-brand calendar picker, slot grid, and "heard from" select
//   • Heard-from + marketing opt-in captured (matches the pool /
//     tournament flows for marketing reporting parity)
//   • No Stripe — table bookings stay free; founder confirms by
//     hand from /admin/bar-reservations
//
// When a match-night referral hits this page with ?date=<iso>, the
// hero booker / world-cup schedule prefills the date.
// =============================================================

const HEARD_FROM_OPTIONS = [
  { value: "Instagram", label: "Instagram" },
  { value: "Friend / word of mouth", label: "Friend / word of mouth" },
  { value: "Walked past", label: "Walked past the venue" },
  { value: "Google search", label: "Google search" },
  { value: "A DJ / event night", label: "A DJ / event night" },
  { value: "Press / blog", label: "Press / blog" },
  { value: "Other", label: "Other" },
];

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayOfWeek(iso: string): number {
  return new Date(`${iso}T00:00:00`).getDay();
}

export default function TableBookingPage() {
  return (
    <Suspense fallback={null}>
      <TableBookingPageInner />
    </Suspense>
  );
}

function TableBookingPageInner() {
  const params = useSearchParams();

  // ----- Form state -----
  const [date, setDate] = useState(params.get("date") || todayIso());
  const [time, setTime] = useState("");
  const [partySize, setPartySize] = useState<number>(
    Math.max(1, Math.min(12, parseInt(params.get("size") || "2", 10) || 2)),
  );
  const [duration, setDuration] = useState<number>(90); // sensible default until cfg lands
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [heardFrom, setHeardFrom] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  // ----- Flow state -----
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // ----- Live config from /admin/products/table -----
  const [cfg, setCfg] = useState<BookableProductConfig | null>(null);
  const [cfgLoaded, setCfgLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadBookableProductConfig("table")
      .then((c) => {
        if (!cancelled) {
          setCfg(c);
          setCfgLoaded(true);
          // Pick a sensible default duration from the cfg's min.
          if (c) setDuration(c.product.min_duration_minutes);
        }
      })
      .catch(() => {
        if (!cancelled) setCfgLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Allowed durations from cfg (e.g. 60, 90, 120, 150, 180).
  const allowedDurations = useMemo<number[]>(() => {
    if (!cfg) return [90];
    const out: number[] = [];
    for (
      let d = cfg.product.min_duration_minutes;
      d <= cfg.product.max_duration_minutes;
      d += cfg.product.duration_step_minutes
    ) {
      out.push(d);
    }
    return out.length > 0 ? out : [cfg.product.min_duration_minutes];
  }, [cfg]);

  const closedDaysOfWeek = useMemo(
    () => (cfg ? recurringClosedDaysOfWeek(cfg) : []),
    [cfg],
  );

  const slots = useMemo(
    () => (cfg ? availableSlotsForDate(cfg, date, duration) : []),
    [cfg, date, duration],
  );

  const closed = cfg ? !isDateBookable(cfg, date) : false;
  const closedOverride = cfg?.overrides.find((o) => o.date === date && o.closed);
  const closedNote = closed
    ? closedOverride?.note
      ? `Closed: ${closedOverride.note}`
      : `${DAY_NAMES[dayOfWeek(date)]} — closed.`
    : "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!time) {
      setError("Pick a time first.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await createBarReservation({
        kind: "table",
        reservation_date: date,
        start_time: time,
        duration_minutes: duration,
        party_size: partySize,
        resource_count: cfg?.product.default_resource_count ?? 1,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        notes: notes.trim() || null,
        heard_from: heardFrom || null,
        marketing_opt_in: marketingOptIn,
      });
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't send the reservation — try again or email info@nodice.bar",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ----- Success state -----
  if (success) {
    return (
      <main className="px-6 py-24">
        <div className="mx-auto max-w-xl rounded-2xl border border-plonkTeal/40 bg-plonkTeal/10 p-10 text-center">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-plonkTeal">
            Request received
          </div>
          <h1 className="mt-3 font-display text-4xl uppercase tracking-wider">
            Got it
          </h1>
          <p className="mt-4 text-base text-cream/75">
            Confirmation email will hit <strong>{email}</strong> shortly. See
            you at {time} on {date}.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 text-center text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
          {cfg?.product.customer_eyebrow || "Tables · Hackney"}
        </div>
        <h1 className="text-center font-display text-5xl uppercase tracking-wider sm:text-6xl">
          {cfg?.product.customer_title || "Reserve a Table"}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-center text-base text-cream/75">
          {cfg?.product.customer_intro ||
            "Pick a time, tell us about your group. We'll save a table."}
        </p>

        {cfgLoaded && cfg && !cfg.product.enabled && (
          <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-plonkPink/40 bg-plonkPink/10 p-8 text-center">
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-plonkPink">
              Bookings paused
            </div>
            <p className="mt-4 text-base text-cream/85">
              {cfg.product.closed_message ||
                "Table bookings are temporarily paused — DM us on Instagram."}
            </p>
            <a
              href="https://instagram.com/nodice.bar"
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-block rounded-full bg-plonkPink px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-plonkPink/90"
            >
              DM us on Instagram
            </a>
          </div>
        )}

        {cfgLoaded && cfg?.product.enabled !== false && (
          <form onSubmit={submit} className="mt-12 space-y-8">
            <FormSection label="Date">
              <DatePickerInput
                value={date}
                onChange={(iso) => {
                  setDate(iso);
                  if (
                    cfg &&
                    time &&
                    !availableSlotsForDate(cfg, iso, duration).includes(time)
                  ) {
                    setTime("");
                  }
                }}
                minIso={todayIso()}
                disabledDaysOfWeek={closedDaysOfWeek}
              />
              {closedNote && (
                <p className="mt-2 text-xs text-plonkPink">{closedNote}</p>
              )}
            </FormSection>

            {!closed && (
              <FormSection label="Time">
                {slots.length === 0 ? (
                  <p className="text-sm text-cream/55">
                    No slots fit a {duration}-minute booking on{" "}
                    {DAY_NAMES[dayOfWeek(date)]}. Try a shorter duration.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {slots.map((s) => {
                      const active = time === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setTime(s)}
                          className={`rounded-lg border px-2 py-3 text-sm transition ${
                            active
                              ? "border-plonkPink bg-plonkPink text-white"
                              : "border-cream/15 bg-ink/40 text-cream hover:border-cream/40"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                )}
              </FormSection>
            )}

            {!closed && cfg && allowedDurations.length > 1 && (
              <FormSection label="How long?">
                <div className="grid gap-3 sm:grid-cols-3">
                  {allowedDurations.map((d) => {
                    const active = duration === d;
                    const fits = availableSlotsForDate(cfg, date, d).length > 0;
                    const label =
                      d >= 60
                        ? d % 60 === 0
                          ? `${d / 60} hr${d === 60 ? "" : "s"}`
                          : `${(d / 60).toFixed(1)} hrs`
                        : `${d} min`;
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={!fits}
                        onClick={() => {
                          setDuration(d);
                          if (
                            time &&
                            !availableSlotsForDate(cfg, date, d).includes(time)
                          ) {
                            setTime("");
                          }
                        }}
                        className={`rounded-xl border px-4 py-3 text-left transition ${
                          !fits
                            ? "cursor-not-allowed border-cream/10 bg-ink/20 opacity-50"
                            : active
                              ? "border-plonkPink bg-plonkPink/10"
                              : "border-cream/15 bg-ink/40 hover:border-cream/40"
                        }`}
                      >
                        <div className="text-base font-bold text-cream">
                          {label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </FormSection>
            )}

            <FormSection label="Party size">
              <NumberPicker
                value={partySize}
                min={cfg?.product.min_party_size ?? 1}
                max={cfg?.product.max_party_size ?? 12}
                onChange={setPartySize}
              />
            </FormSection>

            <div className="grid gap-6 sm:grid-cols-2">
              <FormSection label="Name">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                />
              </FormSection>
              <FormSection label="Email">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                />
              </FormSection>
            </div>

            <FormSection label="Phone">
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="We'll text you about any updates"
                className={inputCls}
              />
            </FormSection>

            <FormSection label="Where did you hear about us?">
              <BrandSelect
                value={heardFrom}
                onChange={setHeardFrom}
                options={HEARD_FROM_OPTIONS}
                placeholder="Pick one (optional)"
              />
            </FormSection>

            <FormSection label="Dietary needs / occasion (optional)">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className={inputCls}
              />
            </FormSection>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-cream/10 bg-ink/20 px-4 py-3 text-sm text-cream/85 transition hover:border-cream/25">
              <input
                type="checkbox"
                checked={marketingOptIn}
                onChange={(e) => setMarketingOptIn(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-plonkPink"
              />
              <span>
                Keep me in the loop — send me No Dice news, upcoming events
                and the odd offer. Unsubscribe anytime.
              </span>
            </label>

            {error && (
              <div className="rounded-lg border border-plonkPink/40 bg-plonkPink/10 px-4 py-3 text-sm text-plonkPink">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !time}
              className="w-full rounded-full bg-plonkPink py-4 text-sm font-bold uppercase tracking-widest text-white shadow-lg shadow-plonkPink/20 transition hover:bg-plonkPink/90 disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Reserve the table"}
            </button>

            <p className="text-center text-xs text-cream/55">
              Free to reserve. We'll email to confirm.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}

const inputCls =
  "w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none";

function FormSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
        {label}
      </label>
      {children}
    </div>
  );
}

function NumberPicker({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="h-12 w-12 rounded-full border border-cream/15 bg-ink/40 text-xl text-cream hover:border-cream/40"
      >
        −
      </button>
      <span className="w-12 text-center font-display text-2xl">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="h-12 w-12 rounded-full border border-cream/15 bg-ink/40 text-xl text-cream hover:border-cream/40"
      >
        +
      </button>
    </div>
  );
}
