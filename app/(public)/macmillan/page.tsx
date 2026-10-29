"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PageHero from "@/components/PageHero";
import MacmillanBooking from "@/components/MacmillanBooking";
import EventsScroller from "@/components/EventsScroller";
import { Editable } from "@/components/Editable";
import { useContent } from "@/lib/content";
import { loadMacmillanEvent, type MacmillanEvent } from "@/lib/db/macmillan";
import type { EventTier } from "@/lib/db/tournaments";

// =============================================================
// /macmillan — 12 Hour Singles Comp with Macmillan Cancer Support
// =============================================================
// A fundraiser pool marathon (Sun 15 Nov 2026, 12pm–12am) at No Dice, London
// Fields. Modelled on the BINGO page: a poster hero, scrolling info and an inline
// Stripe ticket purchase — with a SKILL-TIER SELECTOR, because the day runs as
// three timed sessions (Beginner / Intermediate / Advanced), 20 slots each, all
// £10. Each tier is its own events row so it carries its own cap; booking reuses
// the shared tournament-checkout Edge Function (see lib/db/macmillan.ts +
// components/MacmillanBooking.tsx). All proceeds go to the Macmillan fundraiser.
//
// EVERY visible sentence is CMS-editable: useContent() reads the saved copy from
// page_content (falling back to the text here) and <Editable k="…"> makes it
// click-to-edit on-page in Edit mode (visit /macmillan?edit=1 while signed in to
// /admin). The session names, times, prices and 20-slot caps are edited from
// /admin/events (each tier is its own event). The hero image is swapped from
// admin Galleries → "hero.macmillan". Checked at phone (375px) + desktop (1280px).
// =============================================================

const HERO_SLIDER_KEY = "hero.macmillan";

// Default copy — overridden per-field from the backend. The three "how it works"
// steps and the "what else is on" bullets are editable by key too (see below).
const HOW_DEFAULTS = [
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

const WHATSON_DEFAULTS = [
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

  // ── CMS copy (editable on-page in Edit mode) ──
  const heroEyebrow = useContent("macmillan.eyebrow", "Pool · Fundraiser · London Fields");
  const heroTitle = useContent("macmillan.title", "12 Hour Singles Comp");
  const heroIntro = useContent(
    "macmillan.intro",
    "No Dice takes on a 12-hour pool marathon for Macmillan Cancer Support. £10 a player, all proceeds to the fundraiser — the long-awaited return of our singles comp.",
  );
  const bandTime = useContent("macmillan.band_time", "12pm – 12am");
  const bandHeadline = useContent("macmillan.band_headline", "12 Hour Marathon");
  const bandPromise = useContent(
    "macmillan.band_promise",
    "£10 — 100% goes to the Macmillan 12 Hour Pool Marathon Fundraiser; we donate the cash once tickets are sold.",
  );
  const ctaLabel = useContent("macmillan.cta_label", "Pick your session · £10");
  const soldOutNote = useContent(
    "macmillan.soldout_note",
    "Tickets aren't on sale just yet — check back soon.",
  );

  const selectorEyebrow = useContent("macmillan.selector_eyebrow", "Choose your session");
  const selectorTitle = useContent("macmillan.selector_title", "Three skill levels");
  const selectorIntro = useContent(
    "macmillan.selector_intro",
    "20 players per session, £10 each. Pick the level that suits your game.",
  );

  const howEyebrow = useContent("macmillan.how_eyebrow", "The shape of the day");
  const howTitle = useContent("macmillan.how_title", "How it works");
  const howSteps = HOW_DEFAULTS.map((s, i) => ({
    titleKey: `macmillan.how${i + 1}_title`,
    bodyKey: `macmillan.how${i + 1}_body`,
    title: useContent(`macmillan.how${i + 1}_title`, s.title),
    body: useContent(`macmillan.how${i + 1}_body`, s.body),
  }));

  const whatsonEyebrow = useContent("macmillan.whatson_eyebrow", "All day long");
  const whatsonTitle = useContent("macmillan.whatson_title", "What else is on");
  const whatsonItems = WHATSON_DEFAULTS.map((item, i) => ({
    key: `macmillan.whatson${i + 1}`,
    text: useContent(`macmillan.whatson${i + 1}`, item),
  }));

  const causeEyebrow = useContent("macmillan.cause_eyebrow", "Why we're doing it");
  const causeTitle = useContent("macmillan.cause_title", "Every £10 goes to Macmillan");
  const causeBody = useContent(
    "macmillan.cause_body",
    "We all know the damage this disease does to patients, friends and families — most of us have been touched by cancer at some point. So let's do our part. Play, spectate, bet on your mates or just come down and drink for a good cause. Big love, and we can't wait to see you there. x",
  );
  const donateLabel = useContent("macmillan.donate_label", "Donate on our Macmillan page →");
  // The founder's own Macmillan fundraising page — editable so it can be repointed.
  const donateUrl = useContent(
    "macmillan.donate_url",
    "https://poolmarathon.macmillan.org.uk/users/elliot-scott",
  );
  const footerLine = useContent(
    "macmillan.footer",
    "No Dice · 407 Mentmore Terrace, London Fields, E8 3PH",
  );

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

  // This event and its three session tiers already own the top of the page —
  // the scroller is for everything ELSE that's on.
  const excludeFromScroller = useMemo(
    () => (event ? [event.id, ...tiers.map((t) => t.id)] : []),
    [event, tiers],
  );

  return (
    <main>
      <PageHero
        eyebrow={heroEyebrow}
        title={heroTitle}
        intro={heroIntro}
        image={event?.poster_url || ""}
        eyebrowKey="macmillan.eyebrow"
        titleKey="macmillan.title"
        introKey="macmillan.intro"
        sliderKey={HERO_SLIDER_KEY}
      />

      {/* Fundraiser headline band — the date + the £10/100% promise + the
          primary "pick your session" action. */}
      <section className="px-6 pb-6 pt-10 text-center">
        <div className="mx-auto max-w-2xl rounded-3xl border border-plonkPink/30 bg-plonkPink/5 px-6 py-8">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
            {event ? formatEventDate(event.event_date) : "Sunday 15 November 2026"} ·{" "}
            <Editable k="macmillan.band_time">{bandTime}</Editable>
          </div>
          <div className="mt-3 font-display text-4xl uppercase leading-tight tracking-wider text-cream sm:text-5xl">
            <Editable k="macmillan.band_headline">{bandHeadline}</Editable>
          </div>
          <p className="mx-auto mt-4 max-w-md text-sm text-cream/85">
            <Editable k="macmillan.band_promise" multiline>
              {bandPromise}
            </Editable>
          </p>
          <button
            type="button"
            onClick={scrollToSelector}
            disabled={!loading && tiers.length === 0}
            className="mt-6 inline-block rounded-full bg-plonkPink px-10 py-4 text-sm font-bold uppercase tracking-widest text-white shadow-lg shadow-plonkPink/30 transition hover:bg-plonkPink/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Editable k="macmillan.cta_label">{ctaLabel}</Editable>
          </button>
          {!loading && !err && tiers.length === 0 && (
            <p className="mt-4 text-sm text-cream/60">
              <Editable k="macmillan.soldout_note">{soldOutNote}</Editable>{" "}
              <a
                href={donateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-plonkPink underline hover:text-plonkPink/80"
              >
                Donate on our Macmillan page
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
              <Editable k="macmillan.selector_eyebrow">{selectorEyebrow}</Editable>
            </div>
            <h2 className="text-center font-display text-4xl uppercase tracking-wider text-cream">
              <Editable k="macmillan.selector_title">{selectorTitle}</Editable>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-center text-sm text-cream/75">
              <Editable k="macmillan.selector_intro" multiline>
                {selectorIntro}
              </Editable>
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
                    className={`rounded-2xl border p-5 text-center transition ${
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
            <Editable k="macmillan.how_eyebrow">{howEyebrow}</Editable>
          </div>
          <h2 className="text-center font-display text-4xl uppercase tracking-wider text-cream">
            <Editable k="macmillan.how_title">{howTitle}</Editable>
          </h2>
          <ol className="mx-auto mt-8 max-w-md space-y-6">
            {howSteps.map((step, i) => (
              <li key={step.titleKey} className="flex items-start gap-4">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-plonkPink/50 bg-plonkPink/15 text-base font-bold text-plonkPink">
                  {i + 1}
                </span>
                <div>
                  <div className="text-sm font-semibold uppercase tracking-wider text-cream/90">
                    <Editable k={step.titleKey}>{step.title}</Editable>
                  </div>
                  <p className="mt-1 text-sm text-cream/70">
                    <Editable k={step.bodyKey} multiline>
                      {step.body}
                    </Editable>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Events scroller — the day's own programme, then what's coming up ──
          Was a static bullet list. Now a side-scroller of pictures and
          information fed by the events calendar (food nights, DJs, other games
          nights), so adding an event in /admin/events puts it on this page. */}
      <EventsScroller
        className="bg-white/[0.02]"
        eyebrow={<Editable k="macmillan.whatson_eyebrow">{whatsonEyebrow}</Editable>}
        heading={<Editable k="macmillan.whatson_title">{whatsonTitle}</Editable>}
        highlights={whatsonItems.map((item) => ({
          key: item.key,
          node: (
            <Editable k={item.key} multiline>
              {item.text}
            </Editable>
          ),
        }))}
        excludeIds={excludeFromScroller}
      />

      {/* ── The cause ── */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
            <Editable k="macmillan.cause_eyebrow">{causeEyebrow}</Editable>
          </div>
          <h2 className="font-display text-3xl uppercase tracking-wider text-cream sm:text-4xl">
            <Editable k="macmillan.cause_title">{causeTitle}</Editable>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-cream/75">
            <Editable k="macmillan.cause_body" multiline>
              {causeBody}
            </Editable>
          </p>
          <a
            href={donateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block rounded-full border border-plonkPink/50 px-8 py-3 text-sm font-bold uppercase tracking-widest text-plonkPink transition hover:bg-plonkPink/10"
          >
            <Editable k="macmillan.donate_label">{donateLabel}</Editable>
          </a>
        </div>
      </section>

      {/* Venue footer line */}
      <section className="px-6 pb-16">
        <p className="text-center text-xs uppercase tracking-widest text-cream/45">
          <Editable k="macmillan.footer">{footerLine}</Editable>
        </p>
      </section>
    </main>
  );
}
