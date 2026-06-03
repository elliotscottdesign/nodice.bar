"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import type { Addon, Ticket, Venue } from "@/lib/db/catalogue";
import { fmtMoney } from "@/lib/format";
import { lookupActivePromo, type PromoKind } from "@/lib/db/promos";
import { localIso } from "@/lib/dateIso";
import CalendarPopup from "@/components/CalendarPopup";

// Mock available slots for a date — every 10 min between 17:00 and 22:00,
// some randomised to be unavailable / nearly full. Capacity is 6 per slot.
function generateSlots(dateStr: string): { time: string; left: number }[] {
  const seed = [...dateStr].reduce((s, c) => s + c.charCodeAt(0), 0);
  const rand = (n: number) => {
    const x = Math.sin(seed * n) * 10000;
    return x - Math.floor(x);
  };
  const slots: { time: string; left: number }[] = [];
  for (let h = 17; h <= 22; h++) {
    for (let m = 0; m < 60; m += 10) {
      if (h === 22 && m > 0) break;
      const i = h * 60 + m;
      const r = rand(i);
      let left: number;
      if (r < 0.15) left = 0;
      else if (r < 0.4) left = (Math.floor(r * 10) % 3) + 1;
      else left = 6;
      slots.push({
        time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
        left,
      });
    }
  }
  return slots;
}

function getNextDates(n: number): { iso: string; weekday: string; dayNumber: string; monthLabel: string }[] {
  const out: { iso: string; weekday: string; dayNumber: string; monthLabel: string }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push({
      iso: localIso(d),
      weekday: d.toLocaleDateString("en-GB", { weekday: "short" }),
      dayNumber: String(d.getDate()),
      monthLabel: d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }).toUpperCase(),
    });
  }
  return out;
}

function maxBookableDateIso(): string {
  // Allow booking up to 1 year ahead.
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return localIso(d);
}

function todayIso(): string {
  return localIso(new Date());
}

function dayOfWeekFromIso(iso: string): number {
  return new Date(iso + "T00:00:00").getDay(); // 0=Sun..6=Sat
}

function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
}

// Returns the pricing rules that apply right now, given the venue + selected
// slot. These are CUSTOMER-FACING — used to recompute prices and explain why.
type PricingContext = {
  happyHour: boolean; // Hackney £5 before 5pm Mon–Fri
  mondayBOGOF: boolean; // Hackney BOGOF Mondays (post-5pm)
  tuesdaySpecial: boolean; // Hackney Tuesday — bundle ticket available
  childCutoff: boolean; // Slot is at/after 18:00 — no child tickets
};

function computePricingContext(
  venueId: string,
  iso: string,
  slotTime: string | null,
): PricingContext {
  const dow = dayOfWeekFromIso(iso);
  const t = slotTime ? parseHHMM(slotTime) : null;
  const isHackney = venueId === "hackney";
  const isWeekday = dow >= 1 && dow <= 5;
  const isMonday = dow === 1;
  const isTuesday = dow === 2;

  return {
    // Happy hour £5 tickets: Tue–Fri before 5pm. Mondays don't get happy
    // hour because BOGOF takes over all day.
    happyHour:
      isHackney && isWeekday && !isMonday && t !== null && t < 17 * 60,
    // BOGOF: all day every Monday at Hackney.
    mondayBOGOF: isHackney && isMonday,
    tuesdaySpecial: isHackney && isTuesday,
    childCutoff: t !== null && t >= 18 * 60,
  };
}

// Returns the effective unit price for a ticket given context.
// Bundle (Tuesday special) and add-ons are not affected by happy hour / BOGOF.
function effectiveUnitPrice(ticket: Ticket, ctx: PricingContext): number {
  if (ticket.kind === "bundle") return ticket.pricePence;
  if (ctx.happyHour) return 500; // £5 happy-hour price
  return ticket.pricePence;
}

// Returns the subtotal contribution for `qty` of a ticket, applying BOGOF
// where applicable. BOGOF on top of happy-hour is NOT stacked (happy hour
// already discounts to £5 — best of the two applies).
function ticketLineTotal(
  ticket: Ticket,
  qty: number,
  ctx: PricingContext,
): { total: number; paidQty: number; freeQty: number } {
  if (qty <= 0) return { total: 0, paidQty: 0, freeQty: 0 };
  const unit = effectiveUnitPrice(ticket, ctx);
  if (ctx.mondayBOGOF && ticket.kind !== "bundle" && !ctx.happyHour) {
    const paid = Math.ceil(qty / 2);
    return { total: paid * unit, paidQty: paid, freeQty: qty - paid };
  }
  return { total: qty * unit, paidQty: qty, freeQty: 0 };
}

export default function BookingFlow({
  venue,
  tickets,
  addons,
}: {
  venue: Venue;
  tickets: Ticket[];
  addons: Addon[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read prefill values from URL (set by the homepage hero widget)
  const initialDate = (() => {
    const fromUrl = searchParams?.get("date");
    if (fromUrl && /^\d{4}-\d{2}-\d{2}$/.test(fromUrl)) return fromUrl;
    return getNextDates(1)[0].iso;
  })();
  const initialSize = (() => {
    const fromUrl = parseInt(searchParams?.get("size") || "0", 10);
    return Number.isFinite(fromUrl) && fromUrl > 0 && fromUrl <= 6 ? fromUrl : 0;
  })();

  const [dateIso, setDateIso] = useState<string>(initialDate);
  const [slotTime, setSlotTime] = useState<string | null>(null);
  const [ticketQty, setTicketQty] = useState<Record<string, number>>(() => {
    const base = Object.fromEntries(tickets.map((t) => [t.id, 0]));
    if (initialSize > 0) {
      const adult = tickets.find((t) => t.kind === "adult");
      if (adult) base[adult.id] = initialSize;
    }
    return base;
  });
  const [addonQty, setAddonQty] = useState<Record<string, number>>(
    Object.fromEntries(addons.map((a) => [a.id, 0])),
  );
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState<{
    code: string;
    kind: PromoKind;
    value: number;
  } | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);

  const dates = useMemo(() => getNextDates(365), []);
  const slots = useMemo(() => generateSlots(dateIso), [dateIso]);
  const dow = useMemo(() => dayOfWeekFromIso(dateIso), [dateIso]);

  // Date strip pagination — 6 chips visible at a time.
  const DATE_PAGE_SIZE = 6;
  const [dateOffset, setDateOffset] = useState(0);
  const visibleDates = dates.slice(dateOffset, dateOffset + DATE_PAGE_SIZE);
  const monthLabel = visibleDates[0]?.monthLabel || "";

  // Calendar popup state
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Time slots — show 12 by default, expand to all on demand.
  const [showAllSlots, setShowAllSlots] = useState(false);
  const visibleSlots = showAllSlots ? slots : slots.slice(0, 12);

  function pickDate(iso: string) {
    setDateIso(iso);
    setSlotTime(null);
    setCalendarOpen(false);
    const idx = dates.findIndex((d) => d.iso === iso);
    if (idx >= 0) setDateOffset(Math.max(0, idx - 2));
  }

  // Filter tickets to those available on the chosen day of the week.
  const availableTickets = useMemo(
    () =>
      tickets.filter(
        (t) => !t.availableDaysOfWeek || t.availableDaysOfWeek.includes(dow),
      ),
    [tickets, dow],
  );

  const ctx = useMemo(
    () => computePricingContext(venue.id, dateIso, slotTime),
    [venue.id, dateIso, slotTime],
  );

  // Per-ticket line totals using pricing rules.
  const ticketLines = useMemo(
    () =>
      availableTickets.map((t) => {
        const qty = ticketQty[t.id] || 0;
        const line = ticketLineTotal(t, qty, ctx);
        return { ticket: t, qty, ...line };
      }),
    [availableTickets, ticketQty, ctx],
  );

  const ticketSubtotal = ticketLines.reduce((s, l) => s + l.total, 0);
  const addonSubtotal = useMemo(() => {
    let s = 0;
    for (const a of addons) s += (addonQty[a.id] || 0) * a.pricePence;
    return s;
  }, [addons, addonQty]);
  const subtotalPence = ticketSubtotal + addonSubtotal;

  const discountPence = promoApplied
    ? promoApplied.kind === "percent"
      ? Math.round((subtotalPence * promoApplied.value) / 100)
      : Math.min(promoApplied.value, subtotalPence)
    : 0;
  const totalPence = Math.max(0, subtotalPence - discountPence);
  const totalTickets = Object.values(ticketQty).reduce((s, n) => s + n, 0);

  // Rule: child tickets must always be accompanied by at least one adult/bundle ticket.
  const adultCount = availableTickets
    .filter((t) => t.kind === "adult" || t.kind === "bundle")
    .reduce((s, t) => s + (ticketQty[t.id] || 0), 0);
  const childCount = availableTickets
    .filter((t) => t.kind === "child")
    .reduce((s, t) => s + (ticketQty[t.id] || 0), 0);
  const childRuleViolated = childCount > 0 && adultCount === 0;

  // Rule: child tickets only available before 6pm. If the chosen slot is at
  // or after 18:00 and any child tickets are in the basket, force them to 0.
  const childCutoffViolated = ctx.childCutoff && childCount > 0;

  // Total party size (all golf ticket types combined).
  const partyTotal = availableTickets.reduce(
    (s, t) => s + (ticketQty[t.id] || 0),
    0,
  );

  // Multi-slot bookings cap out at 2 consecutive 10-minute slots (so max
  // 12 players across two back-to-back slots). Groups bigger than that go
  // through the office so we don't end up with a 3-slot tee-off train.
  const MAX_SPLIT_SLOTS = 2;
  const MAX_PARTY_SELF_SERVICE = 12;

  const slotAllocation = useMemo(() => {
    if (!slotTime || partyTotal === 0) {
      return { groups: [] as { time: string; count: number }[], shortfall: 0 };
    }
    const startIdx = slots.findIndex((s) => s.time === slotTime);
    if (startIdx === -1) {
      return { groups: [], shortfall: partyTotal };
    }
    let remaining = partyTotal;
    const groups: { time: string; count: number }[] = [];
    const endIdx = Math.min(startIdx + MAX_SPLIT_SLOTS, slots.length);
    for (let i = startIdx; i < endIdx && remaining > 0; i++) {
      const slot = slots[i];
      const take = Math.min(slot.left, remaining);
      if (take > 0) {
        groups.push({ time: slot.time, count: take });
        remaining -= take;
      }
    }
    return { groups, shortfall: remaining };
  }, [slotTime, partyTotal, slots]);

  // Cap the + button at the max we could fit across 2 consecutive slots
  // from the chosen start time.
  const maxCumulativeCapacity = useMemo(() => {
    if (!slotTime) return 6;
    const startIdx = slots.findIndex((s) => s.time === slotTime);
    if (startIdx === -1) return 6;
    return slots
      .slice(startIdx, startIdx + MAX_SPLIT_SLOTS)
      .reduce((s, x) => s + x.left, 0);
  }, [slotTime, slots]);

  // Anything bigger than 12 must go through the office.
  const tooBigForSelfService = partyTotal > MAX_PARTY_SELF_SERVICE;

  const cannotFitParty = !!slotTime && slotAllocation.shortfall > 0;
  const isSplitBooking = slotAllocation.groups.length > 1;
  const canAddMoreTickets =
    partyTotal < maxCumulativeCapacity && partyTotal < MAX_PARTY_SELF_SERVICE;

  const canContinue =
    !!slotTime &&
    totalTickets > 0 &&
    !childRuleViolated &&
    !childCutoffViolated &&
    !cannotFitParty &&
    !tooBigForSelfService;

  async function applyPromo() {
    const code = promoCode.trim();
    if (!code) return;
    setPromoBusy(true);
    setPromoError("");
    try {
      const row = await lookupActivePromo(code);
      if (!row) {
        setPromoApplied(null);
        setPromoError("That code isn't recognised.");
        return;
      }
      if (row.max_uses != null && row.uses >= row.max_uses) {
        setPromoApplied(null);
        setPromoError("This code has reached its usage limit.");
        return;
      }
      setPromoApplied({ code: row.code, kind: row.kind, value: row.value });
    } catch {
      setPromoApplied(null);
      setPromoError("Couldn't check that code, please try again.");
    } finally {
      setPromoBusy(false);
    }
  }

  function continueToCheckout() {
    if (!canContinue) return;
    const params = new URLSearchParams({
      venue: venue.id,
      date: dateIso,
      time: slotTime!,
      tickets: JSON.stringify(ticketQty),
      addons: JSON.stringify(addonQty),
      promo: promoApplied?.code || "",
      slots: JSON.stringify(slotAllocation.groups),
    });
    router.push(`/book/checkout?${params.toString()}`);
  }

  return (
    <main className="bed-booking">
      <header className="relative isolate border-b border-cream/10 px-6 py-12">
        <div className="absolute inset-0 -z-10">
          <Image
            src={venue.id === "hackney" ? "/hackney/course/Course_1.jpg" : "/borough/course/Course_1.jpg"}
            alt=""
            fill
            priority
            className="object-cover opacity-30"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/60 to-ink" />
        </div>
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-plonkYellow">
            Book
          </p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">{venue.name}</h1>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 px-6 py-10 lg:grid-cols-[1fr_320px]">
        <div className="space-y-10">
          {/* Step 1: Date */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-2xl sm:text-3xl">Select a date</h2>
              <button
                type="button"
                onClick={() => setCalendarOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-cream/15 text-cream/70 transition hover:border-cream/30 hover:text-cream"
                aria-label="Open calendar"
                title="Pick any date"
              >
                <CalendarIcon />
              </button>
            </div>

            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-cream/55">
              {monthLabel}
            </p>

            <div className="flex items-stretch gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setDateOffset((o) => Math.max(0, o - DATE_PAGE_SIZE))}
                disabled={dateOffset === 0}
                className="flex w-9 shrink-0 items-center justify-center rounded-lg border border-cream/15 text-cream/70 transition hover:border-cream/30 hover:text-cream disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Previous dates"
              >
                ←
              </button>
              <div className="grid flex-1 grid-cols-6 gap-1.5 sm:gap-2">
                {visibleDates.map((d) => {
                  const active = d.iso === dateIso;
                  return (
                    <button
                      key={d.iso}
                      onClick={() => {
                        setDateIso(d.iso);
                        setSlotTime(null);
                      }}
                      className={`flex min-h-[64px] flex-col items-center justify-center rounded-lg border px-1 py-2 transition ${
                        active
                          ? "border-plonkPink bg-plonkPink text-white"
                          : "border-cream/15 bg-ink/40 text-cream/85 hover:border-cream/30 active:bg-cream/5"
                      }`}
                    >
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-widest ${
                          active ? "text-white/85" : "text-cream/60"
                        }`}
                      >
                        {d.weekday}
                      </span>
                      <span className="mt-0.5 text-xl font-bold leading-none">
                        {d.dayNumber}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() =>
                  setDateOffset((o) =>
                    Math.min(dates.length - DATE_PAGE_SIZE, o + DATE_PAGE_SIZE),
                  )
                }
                disabled={dateOffset + DATE_PAGE_SIZE >= dates.length}
                className="flex w-9 shrink-0 items-center justify-center rounded-lg border border-cream/15 text-cream/70 transition hover:border-cream/30 hover:text-cream disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Next dates"
              >
                →
              </button>
            </div>
          </section>

          {/* Step 2: Slot */}
          <section>
            <h2 className="font-display text-2xl sm:text-3xl">Select a time</h2>
            {venue.id === "hackney" && (
              <div className="mb-4 mt-2 inline-flex items-center rounded-full border border-plonkYellow/40 bg-plonkYellow/10 px-4 py-2 text-xs font-semibold text-cream/90">
                Happy Hour Mon – Fri, Drinks Deals til 7pm
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {visibleSlots.map((s) => {
                const sold = s.left === 0;
                const lowAvail = !sold && s.left <= 2;
                const active = s.time === slotTime;
                return (
                  <button
                    key={s.time}
                    disabled={sold}
                    onClick={() => setSlotTime(s.time)}
                    className={`flex min-h-[56px] flex-col items-center justify-center rounded-lg border text-base font-semibold transition ${
                      sold
                        ? "cursor-not-allowed border-cream/5 bg-cream/5 text-cream/30 line-through"
                        : active
                          ? "border-plonkPink bg-plonkPink text-white"
                          : "border-cream/15 bg-ink/40 text-cream hover:border-cream/30 active:bg-cream/5"
                    }`}
                  >
                    <span className="font-mono">{s.time}</span>
                    {lowAvail && (
                      <span
                        className={`mt-0.5 text-[10px] font-bold uppercase tracking-widest ${
                          active ? "text-white/85" : "text-plonkYellow"
                        }`}
                      >
                        Only {s.left} left
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {slots.length > 12 && !showAllSlots && (
              <button
                type="button"
                onClick={() => setShowAllSlots(true)}
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-plonkYellow underline-offset-4 hover:underline"
              >
                Show more times ▾
              </button>
            )}
            {showAllSlots && slots.length > 12 && (
              <button
                type="button"
                onClick={() => setShowAllSlots(false)}
                className="mt-3 inline-flex items-center gap-1 text-sm text-cream/60 underline-offset-4 hover:underline"
              >
                Show fewer
              </button>
            )}
          </section>

          {/* Step 3: Tickets */}
          <section>
            <h2 className="mb-1 font-display text-2xl sm:text-3xl">Select tickets</h2>
            <p className="mb-3 text-xs text-cream/55">
              Under-16s must be accompanied by an adult and can only book slots before 6pm.
            </p>
            {(ctx.happyHour || ctx.mondayBOGOF || ctx.tuesdaySpecial) && (
              <div className="mb-4 space-y-2">
                {ctx.happyHour && (
                  <RuleBanner color="teal">
                    Happy hour — all tickets £5 (Tue–Fri before 5pm)
                  </RuleBanner>
                )}
                {ctx.mondayBOGOF && (
                  <RuleBanner color="pink">
                    Monday — buy one, get one free on tickets, all day
                  </RuleBanner>
                )}
                {ctx.tuesdaySpecial && (
                  <RuleBanner color="yellow">
                    Tuesday special — Drink, Golf & Game bundle available below
                  </RuleBanner>
                )}
              </div>
            )}

            <ul className="space-y-3">
              {availableTickets.map((t) => {
                const unit = effectiveUnitPrice(t, ctx);
                const discounted = unit !== t.pricePence;
                const disabled = t.kind === "child" && ctx.childCutoff;
                return (
                  <li
                    key={t.id}
                    className={`rounded-xl border p-4 ${
                      t.kind === "bundle"
                        ? "border-plonkYellow/40 bg-plonkYellow/5"
                        : "border-cream/10 bg-ink/40"
                    } ${disabled ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{t.name}</p>
                          {t.kind === "bundle" && (
                            <span className="rounded-full bg-plonkYellow/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-plonkYellow">
                              Tuesday special
                            </span>
                          )}
                        </div>
                        {t.description && (
                          <p className="mt-1 text-xs text-cream/65">
                            {t.description}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-cream/55">
                          {discounted ? (
                            <>
                              <span className="text-plonkTeal">
                                {fmtMoney(unit)}
                              </span>{" "}
                              <span className="line-through">
                                {fmtMoney(t.pricePence)}
                              </span>{" "}
                              No VAT charged
                            </>
                          ) : (
                            <>{fmtMoney(t.pricePence)}</>
                          )}
                        </p>
                        {disabled && (
                          <p className="mt-1 text-xs text-plonkYellow">
                            Under-16s only available before 6pm — pick an
                            earlier slot
                          </p>
                        )}
                      </div>
                      <QtyStepper
                        value={ticketQty[t.id] || 0}
                        onChange={(v) => setTicketQty({ ...ticketQty, [t.id]: v })}
                        disabled={disabled}
                        canIncrement={canAddMoreTickets}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            {isSplitBooking && !cannotFitParty && !tooBigForSelfService && (
              <div className="mt-4 rounded-xl border border-plonkTeal/40 bg-plonkTeal/10 px-4 py-3 text-sm text-plonkTeal">
                <p className="font-semibold">
                  Your group of {partyTotal} will be split across 2 start times
                </p>
                <ul className="mt-2 space-y-0.5 text-cream/85">
                  {slotAllocation.groups.map((g) => (
                    <li key={g.time} className="font-mono text-xs">
                      <span className="text-plonkTeal">{g.time}</span> — {g.count}{" "}
                      {g.count === 1 ? "player" : "players"}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-cream/70">
                  One booking, one payment. Although your slots are apart you
                  can play together at the later time.
                </p>
              </div>
            )}
            {tooBigForSelfService && (
              <div className="mt-4 rounded-xl border border-plonkYellow/40 bg-plonkYellow/10 px-4 py-3 text-sm text-cream/90">
                <p className="font-semibold text-plonkYellow">
                  Groups of 12+ — please book via the office
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-cream/80">
                  For parties bigger than 12, email{" "}
                  <a
                    href="mailto:info@plonkgolf.co.uk"
                    className="underline-offset-4 hover:underline"
                  >
                    info@plonkgolf.co.uk
                  </a>{" "}
                  and our bookings team will arrange it — we keep online
                  bookings to a 2-slot maximum so things don't get confusing
                  on the day.
                </p>
              </div>
            )}
            {cannotFitParty && !tooBigForSelfService && (
              <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
                We can't fit {partyTotal}{" "}
                {partyTotal === 1 ? "person" : "people"} in the next two slots
                starting at {slotTime} — try an earlier start time, a different
                date, or reduce your party.
              </div>
            )}
            {childRuleViolated && !childCutoffViolated && (
              <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
                Add at least one adult ticket — children can't be booked on
                their own.
              </div>
            )}
            {childCutoffViolated && (
              <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
                Children's tickets aren't available after 6pm. Pick an earlier
                time or remove the child tickets.
              </div>
            )}
          </section>

          {/* Step 4: Add-ons */}
          {addons.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-2xl sm:text-3xl">
                Add extras{" "}
                <span className="text-sm font-normal text-cream/45">(optional)</span>
              </h2>
              <ul className="space-y-3">
                {addons.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-xl border border-cream/10 bg-ink/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{a.name}</p>
                        <p className="text-xs text-cream/55">{fmtMoney(a.pricePence)}</p>
                      </div>
                      <QtyStepper
                        value={addonQty[a.id] || 0}
                        onChange={(v) => setAddonQty({ ...addonQty, [a.id]: v })}
                      />
                    </div>
                    {a.description && (
                      <details className="group mt-2 text-xs">
                        <summary className="flex cursor-pointer items-center gap-1 text-cream/60 transition hover:text-cream">
                          <span>Details</span>
                          <span className="transition group-open:rotate-180" aria-hidden>
                            ▾
                          </span>
                        </summary>
                        <p className="mt-2 leading-relaxed text-cream/75">
                          {a.description}
                        </p>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Step 5: Promo */}
          <section>
            <h2 className="mb-3 font-display text-2xl sm:text-3xl">
              Promo code{" "}
              <span className="text-sm font-normal text-cream/45">(optional)</span>
            </h2>
            <div className="flex gap-2">
              <input
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="e.g. FRIDAY20"
                className="flex-1 rounded-lg border border-cream/15 bg-ink/40 px-4 py-2.5 text-sm uppercase tracking-wider placeholder:text-cream/30 focus:border-plonkPink focus:outline-none"
              />
              <button
                onClick={applyPromo}
                disabled={!promoCode.trim() || promoBusy}
                className="rounded-lg bg-cream/10 px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-cream disabled:opacity-50"
              >
                {promoBusy ? "Checking…" : "Apply"}
              </button>
            </div>
            {promoApplied && (
              <p className="mt-2 text-sm text-plonkTeal">
                ✓ {promoApplied.code} applied —{" "}
                {promoApplied.kind === "percent"
                  ? `${promoApplied.value}% off`
                  : `${fmtMoney(promoApplied.value)} off`}
              </p>
            )}
            {promoError && <p className="mt-2 text-sm text-red-400">{promoError}</p>}
          </section>
        </div>

        {/* Sidebar summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-cream/10 bg-ink/60 p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-plonkYellow">
              Your basket
            </p>

            {isSplitBooking && !cannotFitParty && (
              <div className="mt-4 rounded-lg border border-plonkTeal/30 bg-plonkTeal/5 p-3 text-xs">
                <p className="font-bold uppercase tracking-widest text-plonkTeal">
                  Split across {slotAllocation.groups.length} slots
                </p>
                <ul className="mt-1 space-y-0.5 text-cream/75">
                  {slotAllocation.groups.map((g) => (
                    <li key={g.time} className="font-mono">
                      {g.time} · {g.count}{" "}
                      {g.count === 1 ? "player" : "players"}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <ul className="mt-4 divide-y divide-cream/10 text-sm">
              {ticketLines
                .filter((l) => l.qty > 0)
                .map((l) => (
                  <li key={l.ticket.id} className="py-2.5">
                    <div className="flex justify-between">
                      <span>
                        {l.qty}× {l.ticket.name}
                      </span>
                      <span className="text-cream/85">{fmtMoney(l.total)}</span>
                    </div>
                    {l.freeQty > 0 && (
                      <p className="mt-0.5 text-[11px] text-plonkPink">
                        {l.freeQty} free — Monday BOGOF
                      </p>
                    )}
                  </li>
                ))}
              {addons
                .filter((a) => (addonQty[a.id] || 0) > 0)
                .map((a) => (
                  <li key={a.id} className="flex justify-between py-2.5">
                    <span>
                      {addonQty[a.id]}× {a.name}
                    </span>
                    <span className="text-cream/85">
                      {fmtMoney((addonQty[a.id] || 0) * a.pricePence)}
                    </span>
                  </li>
                ))}
              {totalTickets === 0 && (
                <li className="py-4 text-center text-cream/40">No tickets yet.</li>
              )}
            </ul>

            <div className="mt-4 space-y-1.5 border-t border-cream/10 pt-4 text-sm">
              <Row label="Subtotal" value={fmtMoney(subtotalPence)} />
              {promoApplied && (
                <Row
                  label={`Promo (${promoApplied.code})`}
                  value={`−${fmtMoney(discountPence)}`}
                  highlight
                />
              )}
              <Row label="Total" value={fmtMoney(totalPence)} bold />
            </div>

            <button
              disabled={!canContinue}
              onClick={continueToCheckout}
              className="mt-6 w-full rounded-full bg-plonkPink py-4 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {canContinue
                ? "Continue to checkout"
                : tooBigForSelfService
                  ? "Email us for 12+ groups"
                  : cannotFitParty
                    ? "Pick an earlier time"
                    : childCutoffViolated
                      ? "Children only before 6pm"
                      : childRuleViolated
                        ? "Adult ticket required"
                        : "Pick a time + tickets first"}
            </button>

            {canContinue && (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-cream/55">
                <span aria-hidden>⏱</span>
                We'll hold your tickets for 15 mins while you check out
              </p>
            )}

            <p className="mt-3 text-center text-[10px] uppercase tracking-widest text-cream/40">
              Preview — no money will be taken
            </p>
          </div>
        </aside>
      </div>

      {calendarOpen && (
        <CalendarPopup
          value={dateIso}
          minIso={todayIso()}
          maxIso={maxBookableDateIso()}
          onSelect={pickDate}
          onClose={() => setCalendarOpen(false)}
        />
      )}
    </main>
  );
}

function QtyStepper({
  value,
  onChange,
  disabled,
  canIncrement = true,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  canIncrement?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={disabled || value === 0}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-cream/20 text-lg disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Decrease"
      >
        −
      </button>
      <span className="w-6 text-center font-medium">{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        disabled={disabled || !canIncrement}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-cream/20 text-lg disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
    </svg>
  );
}

function RuleBanner({
  children,
  color,
}: {
  children: React.ReactNode;
  color: "teal" | "pink" | "yellow";
}) {
  const styles: Record<typeof color, string> = {
    teal: "border-plonkTeal/40 bg-plonkTeal/10 text-plonkTeal",
    pink: "border-plonkPink/40 bg-plonkPink/10 text-plonkPink",
    yellow: "border-plonkYellow/30 bg-plonkYellow/5 text-plonkYellow",
  };
  return (
    <div
      className={`rounded-xl border px-4 py-2.5 text-xs font-semibold uppercase tracking-widest ${styles[color]}`}
    >
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className={highlight ? "text-plonkTeal" : "text-cream/70"}>{label}</span>
      <span
        className={`${bold ? "font-display text-xl" : ""} ${
          highlight ? "text-plonkTeal" : "text-cream"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
