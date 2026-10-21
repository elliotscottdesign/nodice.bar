"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PageHero from "@/components/PageHero";
import MacmillanBooking from "@/components/MacmillanBooking";
import { loadMacmillanEvent, type MacmillanEvent } from "@/lib/db/macmillan";
import type { EventTier } from "@/lib/db/tournaments";

// =============================================================
// /macmillan — 12 Hour Singles Comp with Macmillan Cancer Support
// =============================================================
// A fundraiser pool marathon (Sun 15 Nov 2026, 12pm–12am) at No Dice, London
// Fields. Modelled on the BINGO page: a poster hero, a scrolling info section
// and an inline Stripe ticket purchase — but with a SKILL-TIER SELECTOR, because
// the day runs as three timed sessions (Beginner / Intermediate / Advanced),
// 20 slots each, all £10. Each tier is its own events row so it carries its own
// 20-slot cap; the booking reuses the shared tournament-checkout Edge Function
// (see lib/db/macmillan.ts + components/MacmillanBooking.tsx). All proceeds go to
// the Macmillan fundraiser — Stripe just collects it into the usual account and
// the founder donates once tickets are sold.
//
// Reached from: the /pool pool-events selector, the /events calendar card, and a
// "Special Events" card on /book — all three repointed to here. Checked at phone
// (375px) and desktop (1280px).
// =============================================================

// The founder's own Macmillan fundraising page — a secondary CTA for spectators
// and friends who want to chip in beyond the £10 ticket.
const MACMILLAN_DONATE_URL = "https://poolmarathon.macmillan.org.uk/users/elliot-scott";

// Hero poster (from the event row) is the primary image; this CMS slider key lets
// the founder swap it from admin without a code change.
const HERO_SLIDER_KEY = "hero.macmillan";

// How the day works + what else is on — formatted from the founder's brief.
const HOW_IT_WORKS: Array<{ title: string; body: string }> = [
  {
    title: "Pick your skill level",
    body: "Three four-hour sessions across the day — Beginner, Intermediate and Advanced. Enter the one that suits your game so everyone gets a fair, fun run out.",
  },
  {
    title: "Just like the weekly comp",
    body: "Each session plays all-v-all group rounds across both tables, then a knockout — exactly like our regular Wednesday singles.",
  },
  {
    title: "The grand showdown",
    body: "The winner of each skill level goes head to head at the end of the day to crown the 12-hour champion.",
  },
];

const WHATS_ON: string[] = [
  "DJs spinning all day to keep the pace",
  "Cocktail specials + a hearty food pop-up to keep your energy up",
  "Our draught beers flowing (we're after a sponsor to raise even more)",
  "A betting system so non-players can buy tokens, back their mates and win bar drinks — all proceeds to the fundraiser",
  "Side quests between games: Carrom boards (pool's ancient ancestor) and a mini table for Beat the Bar",
];

function formatEventDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// "12:00:00" → "12pm", "16:00:00" → "4pm", "00:00:00" → "12am".
function formatHour(hhmmss: string | null): string {
  if (!hhmmss) return "";
  const [hStr, mStr] = hhmmss.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr || "0", 10);
  const suffix = h >= 12 && h < 24 ? "pm" : "am";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${suffix}` : `${h12}${suffix}`;
}

function tierWindow(tier: EventTier): string {
  const a = formatHour(tier.start_time);
  const b = formatHour(tier.end_time);
  if (a && b) return `${a} – ${b}`;
  return a || b || "";
}

// Tier events are named "Macmillan 12HR — Beginner" (clear in the admin
// tracker); the public card just shows the level ("Beginner").
function tierLevel(name: string): string {
  const parts = name.split("—");
  return (parts[parts.length - 1] ?? name).trim() || name;
}

export default function MacmillanPage() {
  const [event, setEvent] = useState<MacmillanEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const bookingRef = useRef<HTMLDivElement | null>(null);
  const selectorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadMacmillanEvent()
      .then((ev) => {
        if (!cancelled) setEvent(ev);
      })
      .catch((e) => {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : "Couldn't load the event.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Smooth-scroll the booking form into view when a tier is picked.
  useEffect(() => {
    if (!selectedTierId) return;
    const id = requestAnimationFrame(() => {
      bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(id);
  }, [selectedTierId]);

  const tiers = event?.tiers ?? [];
  const selectedTier = useMemo(
    () => tiers.find((t) => t.id === selectedTierId) ?? null,
    [tiers, selectedTierId],
  );

  const scrollToSelector = () =>
    selectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const heroTitle = "12 Hour Singles Comp";
  const heroIntro =
    "No Dice takes on a 12-hour pool marathon for Macmillan Cancer Support. £10 a player, all proceeds to the fundraiser — the long-awaited return of our singles comp.";

  return (
    <main>
      <PageHero
        eyebrow="Pool · Fundraiser · London Fields"
        title={heroTitle}
        intro={heroIntro}
        image={event?.poster_url || ""}
        sliderKey={HERO_SLIDER_KEY}
      />

      {/* Fundraiser headline band — the date + the £10/100% promise + the
          primary "pick your session" action. */}
      <section className="px-6 pb-6 pt-10 text-center">
        <div className="mx-auto max-w-2xl rounded-3xl border border-plonkPink/30 bg-plonkPink/5 px-6 py-8">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
            {event ? formatEventDate(event.event_date) : "Sunday 15 November 2026"} · 12pm – 12am
          </div>
          <div className="mt-3 font-display text-4xl uppercase leading-tight tracking-wider text-cream sm:text-5xl">
            12&nbsp;Hour Marathon
          </div>
          <p className="mx-auto mt-4 max-w-md text-sm text-cream/85">
            <strong className="text-cream">£10</strong> — 100% goes to the Macmillan 12 Hour Pool Marathon
            Fundraiser; we donate the cash once tickets are sold.
          </p>
          <button
            type="button"
            onClick={scrollToSelector}
            disabled={!loading && tiers.length === 0}
            className="mt-6 inline-block rounded-full bg-plonkPink px-10 py-4 text-sm font-bold uppercase tracking-widest text-white shadow-lg shadow-plonkPink/30 transition hover:bg-plonkPink/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Pick your session · £10
          </button>
          {!loading && !err && tiers.length === 0 && (
            <p className="mt-4 text-sm text-cream/60">
              Tickets aren&apos;t on sale just yet — check back soon, or{" "}
              <a
                href={MACMILLAN_DONATE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-plonkPink underline hover:text-plonkPink/80"
              >
                donate on our Macmillan page
              </a>
              .
            </p>
          )}
          {err && <p className="mt-4 text-sm text-plonkPink">{err}</p>}
        </div>
      </section>

      {/* ── Skill-tier selector ── */}
      {tiers.length > 0 && (
        <section ref={selectorRef} className="px-6 pb-8 pt-8 scroll-mt-24">
          <div className="mx-auto max-w-4xl">
            <div className="mb-3 text-center text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
              Choose your session
            </div>
            <h2 className="text-center font-display text-4xl uppercase tracking-wider text-cream">
              Three skill levels
            </h2>
            <p className="mx-auto mt-4 max-w-md text-center text-sm text-cream/75">
              20 players per session, £10 each. Pick the level that suits your game.
            </p>

            <div className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-3">
              {tiers.map((tier) => {
                const isSelected = tier.id === selectedTierId;
                const left = tier.spotsLeft;
                const full = tier.full;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => !full && setSelectedTierId(isSelected ? null : tier.id)}
                    disabled={full}
                    aria-pressed={isSelected}
                    className={`rounded-2xl border p-5 text-left transition ${
                      full
                        ? "cursor-not-allowed border-cream/10 bg-ink/20 opacity-60"
                        : isSelected
                          ? "border-plonkPink bg-plonkPink/15 ring-1 ring-plonkPink/40"
                          : "border-cream/15 bg-white/5 hover:border-plonkPink/60 hover:bg-plonkPink/10"
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
                      {tierWindow(tier)}
                    </div>
                    <div className="mt-2 font-display text-2xl uppercase leading-tight tracking-wider text-cream">
                      {tierLevel(tier.name)}
                    </div>
                    <div className="mt-3 text-xs uppercase tracking-widest text-cream/55">£10 entry</div>

                    {/* Spots-left bar */}
                    {tier.max_attendees != null && (
                      <div className="mt-3">
                        <div className="h-1 w-full overflow-hidden rounded-full bg-cream/10">
                          <div
                            className={`h-full transition-all ${
                              full ? "bg-cream/20" : (left ?? 0) <= 3 ? "bg-plonkPink" : "bg-plonkTeal"
                            }`}
                            style={{
                              width: `${
                                ((tier.max_attendees - (left ?? 0)) / tier.max_attendees) * 100
                              }%`,
                            }}
                          />
                        </div>
                        <div className="mt-1.5 text-[10px] uppercase tracking-widest text-cream/45">
                          {full
                            ? `${tier.max_attendees} / ${tier.max_attendees} taken`
                            : left === 1
                              ? "Last spot"
                              : `${left} of ${tier.max_attendees} left`}
                        </div>
                      </div>
                    )}

                    <div
                      className={`mt-4 inline-block rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-widest ${
                        full
                          ? "border border-cream/15 text-cream/50"
                          : isSelected
                            ? "bg-cream/10 text-cream"
                            : "bg-plonkPink text-white"
                      }`}
                    >
                      {full ? "Sold out" : isSelected ? "Selected" : "Enter →"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Booking form for the selected tier */}
      {selectedTier && (
        <section className="px-6 pb-8">
          <div ref={bookingRef} className="mx-auto max-w-2xl scroll-mt-24">
            <MacmillanBooking tier={selectedTier} onClose={() => setSelectedTierId(null)} />
          </div>
        </section>
      )}

      {/* ── How the day works ── */}
      <section className="px-6 pb-8 pt-12">
        <div className="mx-auto max-w-2xl">
          <div className="mb-3 text-center text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
            The shape of the day
          </div>
          <h2 className="text-center font-display text-4xl uppercase tracking-wider text-cream">
            How it works
          </h2>
          <ol className="mx-auto mt-8 max-w-md space-y-6">
            {HOW_IT_WORKS.map((step, i) => (
              <li key={step.title} className="flex items-start gap-4">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-plonkPink/50 bg-plonkPink/15 text-base font-bold text-plonkPink">
                  {i + 1}
                </span>
                <div>
                  <div className="text-sm font-semibold uppercase tracking-wider text-cream/90">
                    {step.title}
                  </div>
                  <p className="mt-1 text-sm text-cream/70">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── What else is on ── */}
      <section className="bg-white/[0.02] px-6 py-16">
        <div className="mx-auto max-w-2xl">
          <div className="mb-3 text-center text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
            All day long
          </div>
          <h2 className="text-center font-display text-4xl uppercase tracking-wider text-cream sm:text-5xl">
            What else is on
          </h2>
          <ul className="mx-auto mt-8 max-w-xl space-y-3">
            {WHATS_ON.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-cream/10 bg-ink/30 px-5 py-4 text-sm text-cream/85"
              >
                <span className="mt-0.5 text-plonkPink">◆</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── The cause ── */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
            Why we&apos;re doing it
          </div>
          <h2 className="font-display text-3xl uppercase tracking-wider text-cream sm:text-4xl">
            Every £10 goes to Macmillan
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-cream/75">
            We all know the damage this disease does to patients, friends and families — most of us have been
            touched by cancer at some point. So let&apos;s do our part. Play, spectate, bet on your mates or just
            come down and drink for a good cause. Big love, and we can&apos;t wait to see you there. x
          </p>
          <a
            href={MACMILLAN_DONATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block rounded-full border border-plonkPink/50 px-8 py-3 text-sm font-bold uppercase tracking-widest text-plonkPink transition hover:bg-plonkPink/10"
          >
            Donate on our Macmillan page →
          </a>
        </div>
      </section>

      {/* Venue footer line */}
      <section className="px-6 pb-16">
        <p className="text-center text-xs uppercase tracking-widest text-cream/45">
          No Dice · 407 Mentmore Terrace, London Fields, E8 3PH
        </p>
      </section>
    </main>
  );
}
