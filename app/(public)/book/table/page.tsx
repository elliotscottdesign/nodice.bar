"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  loadBookableProductConfig,
  availableSlotsForDate,
  isDateBookable,
  recurringClosedDaysOfWeek,
  DAY_NAMES,
  type BookableProductConfig,
} from "@/lib/db/bookableProducts";
import {
  loadBlockedDates,
  findBlockedDate,
  slotCutoffMinForBlocker,
  formatMinuteOfDay,
  formatTimeLabel,
  type BlockedDate,
} from "@/lib/db/tableBlocking";
import DatePickerInput from "@/components/admin/DatePickerInput";
import BrandSelect from "@/components/BrandSelect";
import Link from "next/link";

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

// The free /book/table insert goes through an Edge Function so the
// browser doesn't need direct INSERT permission on bar_reservations
// (RLS keeps anon out of the table — only the service_role inside
// the function can write).
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://rntcujcpsozvuxvmlejv.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const RESERVATION_FN_URL = `${SUPABASE_URL}/functions/v1/create-table-reservation`;

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

  // ----- Blocked dates (World Cup match nights, food residencies) -----
  // Loaded once on mount for the next ~120 days. Drives both the
  // greyed-out cells in the date picker AND the message panel that
  // appears when the customer lands on a blocked date via ?date=… .
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  useEffect(() => {
    let cancelled = false;
    const today = new Date();
    const fromIso = today.toISOString().slice(0, 10);
    const to = new Date(today);
    to.setDate(to.getDate() + 120);
    const toIso = to.toISOString().slice(0, 10);
    loadBlockedDates(fromIso, toIso)
      .then((rows) => {
        if (!cancelled) setBlockedDates(rows);
      })
      .catch(() => {
        // Fail-open: if the lookup errors, the calendar shows all
        // dates as bookable. Worst case the customer's table booking
        // collides with a match — same as the current behaviour, so
        // we don't make things worse.
        if (!cancelled) setBlockedDates([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // HARD-blocked dates only — these are days where a blocking event
  // is on but the event has no start_time set (e.g. "Fixture TBC"
  // World Cup matches). We can't compute a 2-hour cutoff for those,
  // so the whole day is greyed out in the picker. Dates with a
  // blocking event that DOES have a start_time stay selectable —
  // their slot grid is filtered instead so customers can still book
  // an earlier table.
  const hardBlockedIsoList = useMemo(
    () =>
      blockedDates
        .filter((b) => !b.event_start_time)
        .map((b) => b.iso),
    [blockedDates],
  );

  // The earliest-starting blocking event on the picked date, or null.
  // Drives the slot cutoff + the friendly note above the slot grid.
  const blockingEvent = useMemo(
    () => findBlockedDate(blockedDates, date),
    [blockedDates, date],
  );

  // Minute-of-day after which a dining slot may NOT end. Two hours
  // before the blocking event's start_time. Null = no blocker, or
  // blocker has no start_time (hard-block path).
  const slotCutoffMin = useMemo(
    () => slotCutoffMinForBlocker(blockingEvent),
    [blockingEvent],
  );

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

  // Raw slots from the bookable-product config. Filtered below
  // when a blocking event is on this date — only slots that END by
  // (event_start_time − 2h) survive.
  const slots = useMemo(() => {
    if (!cfg) return [];
    const all = availableSlotsForDate(cfg, date, duration);
    if (slotCutoffMin === null) return all;
    return all.filter((s) => {
      const [hStr, mStr] = s.split(":");
      const startMin = parseInt(hStr, 10) * 60 + parseInt(mStr || "0", 10);
      return startMin + duration <= slotCutoffMin;
    });
  }, [cfg, date, duration, slotCutoffMin]);

  // Hides the form (time, duration, party, contact, submit) when
  // there's a blocker AND we can't offer any slots. Either:
  //   • blocker has no start_time (hard block) → can't compute cutoff
  //   • cutoff exists but no slots fit before it (event is too early)
  // The form is allowed to render when there's no blocker, or when
  // there's a soft block with a working cutoff AND slots still fit.
  const blockedFromBooking =
    !!blockingEvent && (slotCutoffMin === null || slots.length === 0);

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
      // POST to create-table-reservation Edge Function. The function
      // validates server-side, runs the kill-switch check, and inserts
      // the row via service_role so RLS on bar_reservations stays
      // locked down to anon.
      const res = await fetch(RESERVATION_FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
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
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(
          `Couldn't save the reservation (${res.status}): ${txt || "no detail"}`,
        );
      }
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
                disabledDates={hardBlockedIsoList}
              />
              {closedNote && (
                <p className="mt-2 text-xs text-plonkPink">{closedNote}</p>
              )}
            </FormSection>

            {/* HARD-BLOCK panel — only when a blocking event has NO
                start_time set (e.g. "Fixture TBC" matches). With no
                kickoff time we can't compute a 2-hour cutoff, so the
                whole day is closed and we send the customer to the
                right booking flow with a clear CTA. */}
            {blockingEvent && slotCutoffMin === null && (
              <div className="rounded-2xl border border-plonkPink/40 bg-plonkPink/10 px-6 py-7 text-cream">
                <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-plonkPink">
                  We're booked out for that night
                </div>
                <h3 className="mt-2 font-display text-2xl sm:text-3xl">
                  {blockingEvent.event_name}
                </h3>
                <p className="mt-3 max-w-prose text-sm text-cream/75">
                  {blockingEvent.category === "world_cup"
                    ? "We're showing the match — every table that night is reserved for ticket-holders. Book a match table instead, or pick a different night."
                    : blockingEvent.category === "food_event"
                      ? "We've got a food residency on that night — the kitchen team uses the dining tables for guests. See what's on, or pick a different night."
                      : "We've got something on that night that needs the dining tables. See what's on, or pick a different night."}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href={blockingEvent.redirect_href}
                    className="inline-block rounded-full bg-plonkPink px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-plonkPink/90"
                  >
                    {blockingEvent.redirect_label} →
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDate(todayIso())}
                    className="inline-block rounded-full border border-cream/25 px-6 py-3 text-xs font-bold uppercase tracking-widest text-cream/85 transition hover:border-cream/50"
                  >
                    Pick a different night
                  </button>
                </div>
              </div>
            )}

            {/* SOFT-BLOCK note — date is still bookable but the slot
                grid is filtered to slots that END by 2h before the
                event. Tell the customer why their later slots are
                missing so the page doesn't feel broken. */}
            {!closed &&
              blockingEvent &&
              slotCutoffMin !== null &&
              slots.length > 0 && (
                <div className="rounded-2xl border border-plonkYellow/40 bg-plonkYellow/5 px-5 py-4 text-cream">
                  <div className="text-[10px] font-bold uppercase tracking-[0.26em] text-plonkYellow">
                    Early dining only on this date
                  </div>
                  <p className="mt-2 text-sm text-cream/85">
                    <span className="font-semibold text-cream">
                      {blockingEvent.event_name}
                    </span>{" "}
                    starts at{" "}
                    {blockingEvent.event_start_time
                      ? formatTimeLabel(blockingEvent.event_start_time)
                      : "the venue"}
                    {" "}— dining tables must be cleared by{" "}
                    <span className="font-semibold text-cream">
                      {formatMinuteOfDay(slotCutoffMin)}
                    </span>
                    . Slots below all end by that time.
                  </p>
                  <Link
                    href={blockingEvent.redirect_href}
                    className="mt-3 inline-block text-xs font-bold uppercase tracking-widest text-plonkYellow underline-offset-4 hover:underline"
                  >
                    {blockingEvent.redirect_label} →
                  </Link>
                </div>
              )}

            {/* No slots fit before the cutoff — e.g. the event is
                early enough that even the shortest booking would run
                into it. Encourage a shorter duration or a different
                day. */}
            {!closed &&
              blockingEvent &&
              slotCutoffMin !== null &&
              slots.length === 0 && (
                <div className="rounded-2xl border border-plonkPink/40 bg-plonkPink/10 px-6 py-6 text-cream">
                  <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-plonkPink">
                    No early slots fit
                  </div>
                  <p className="mt-2 text-sm text-cream/85">
                    <span className="font-semibold text-cream">
                      {blockingEvent.event_name}
                    </span>{" "}
                    starts at{" "}
                    {blockingEvent.event_start_time
                      ? formatTimeLabel(blockingEvent.event_start_time)
                      : "the venue"}{" "}
                    — we need tables back by{" "}
                    <span className="font-semibold text-cream">
                      {formatMinuteOfDay(slotCutoffMin)}
                    </span>
                    . Try a shorter duration, or pick a different night.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={blockingEvent.redirect_href}
                      className="inline-block rounded-full bg-plonkPink px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white transition hover:bg-plonkPink/90"
                    >
                      {blockingEvent.redirect_label} →
                    </Link>
                  </div>
                </div>
              )}

            {!closed && (!blockingEvent || (slotCutoffMin !== null && slots.length > 0)) && (
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

            {/* Duration picker stays visible on a soft-block date even
                when no slots currently fit, so the customer can try a
                shorter duration and see slots reappear. Only hidden on
                a hard block (no start_time on the event). */}
            {!closed &&
              !(blockingEvent && slotCutoffMin === null) &&
              cfg &&
              allowedDurations.length > 1 && (
              <FormSection label="How long?">
                <div className="grid gap-3 sm:grid-cols-3">
                  {allowedDurations.map((d) => {
                    const active = duration === d;
                    // Whether this duration has any slot that fits AND
                    // (when there's a soft block) ends by the cutoff.
                    // Grey-out + disable durations that don't fit so
                    // the customer can see at a glance which shorter
                    // option to switch to.
                    const fits = (() => {
                      const all = availableSlotsForDate(cfg, date, d);
                      if (all.length === 0) return false;
                      if (slotCutoffMin === null) return true;
                      return all.some((s) => {
                        const [hStr, mStr] = s.split(":");
                        const startMin =
                          parseInt(hStr, 10) * 60 + parseInt(mStr || "0", 10);
                        return startMin + d <= slotCutoffMin;
                      });
                    })();
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

            {/* Everything below — party, contact, submit — is only
                relevant when the date is actually bookable. Hidden
                entirely on a hard-blocked date (event has no start
                time, so we can't compute a cutoff). Soft-blocked
                dates with a working cutoff keep the form open;
                the slot grid is already filtered above. */}
            {!blockedFromBooking && !closed && (
            <>
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
            </>
            )}
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
