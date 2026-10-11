"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText } from "lucide-react";
import PageHero from "@/components/PageHero";
import RollerDeck from "@/components/RollerDeck";
import MediaStrip from "@/components/MediaStrip";
import InlineTournamentBooking from "@/components/InlineTournamentBooking";
import { useContent } from "@/lib/content";
import { Editable } from "@/components/Editable";
import { loadBingoNights } from "@/lib/db/bingo";
import type { DbTournament } from "@/lib/db/tournaments";

// =============================================================
// /bingo — Comedy & Bingo Night at No Dice (London Fields)
// =============================================================
// Modelled on /pingpong: a PageHero banner (CMS-swappable image via the
// "hero.bingo" gallery, falling back to the shipped placeholder), an
// editable copy band, a rail of upcoming nights → inline Stripe booking
// (£10 a ticket, one per person), a prizes block, a photo slider
// ("bingo.gallery" — comedian/host headshots + the bingo machine), a
// click-to-download rules sheet, and an FAQ.
//
// Every visible sentence is CMS-editable (useContent / <Editable>) so the
// founder can change copy on-page in Edit mode. The booking + payment is
// the SAME flow as the pool / ping-pong tournaments: the bingo night is
// an events-platform row the shared `tournament-checkout` function and
// InlineTournamentBooking already understand (see lib/db/bingo.ts) — no
// bespoke booking code, no edge-function change.
//
// Accent: bright pink #e878f0, sampled from the founder's magenta halftone
// hero artwork (11 Oct 2026 — "style all red to pink"), used for CTAs,
// headings and the bar-sponsored prizes. Checked at 375px + 1280px.
// =============================================================

const HERO_FALLBACK = "/bingo-header.jpg";

// Bar-sponsored prizes (founder, 11 Oct 2026) — free to play, bar puts up
// the pot so it isn't gambling.
const PRIZES: Array<{ label: string; amount: string }> = [
  { label: "First vertical line", amount: "£20" },
  { label: "First horizontal line", amount: "£20" },
  { label: "First diagonal line", amount: "£20" },
  { label: "Full house — BINGO!", amount: "£40" },
];

// The shape of the evening (founder, 11 Oct 2026): alternating comedy
// sets and bingo rounds, building to the headline act. 15-minute slots
// from the 7pm start; comedian/host names get added to each slot later.
const RUN_ORDER: Array<{
  label: string;
  kind: "comedy" | "bingo";
  time: string;
}> = [
  { label: "Warm-up comedy set", kind: "comedy", time: "7:00 – 7:15pm" },
  { label: "Bingo round", kind: "bingo", time: "7:15 – 7:30pm" },
  { label: "Comedy set", kind: "comedy", time: "7:30 – 7:45pm" },
  { label: "Bingo round", kind: "bingo", time: "7:45 – 8:00pm" },
  { label: "Main comedy set", kind: "comedy", time: "8:00 – 8:15pm" },
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Is it gambling?",
    a: "No. The bingo is free to play and every prize is sponsored by the bar — there's no stake and nothing to buy to join in. Your ticket is for the comedy night and your arrival drink.",
  },
  {
    q: "What does my £10 get me?",
    a: "Entry to the comedy & bingo night plus a drink on arrival. Bingo cards are handed out free on the night.",
  },
  {
    q: "Can I just turn up?",
    a: "Grab a ticket ahead to guarantee your spot — these nights fill up. Any spare spaces on the night can be bought at the bar while they last.",
  },
];

export default function BingoPage() {
  // CMS copy — editable in /admin or on-page in Edit mode. The KEY
  // header the founder uses for the next event + its date lives in
  // bingo.event_header / bingo.event_date (shown prominently below the
  // hero), separate from the evergreen hero title.
  const eyebrow = useContent("bingo.eyebrow", "Comedy & Bingo · London Fields");
  const title = useContent("bingo.title", "Bingo Night");
  const intro = useContent(
    "bingo.intro",
    "Comedy and bingo under one roof at No Dice. £10 a ticket gets you in and gets you a drink — the bingo's free to play, with prizes put up by the bar. Eyes down, London Fields.",
  );
  // The headline the founder points at the next event + its date(s).
  const eventHeader = useContent("bingo.event_header", "Our first-ever Bingo Night");
  const eventDate = useContent("bingo.event_date", "Wednesday 25 November 2026 · 7pm");

  const bookLine = useContent(
    "bingo.book_line",
    "£10 a ticket — one per person, drink included. Grab yours below.",
  );
  const ctaLabel = useContent("bingo.cta_label", "Book your ticket · £10");

  const prizeTexts = [
    {
      labelKey: "bingo.prize1_label",
      label: useContent("bingo.prize1_label", PRIZES[0].label),
      amountKey: "bingo.prize1_amount",
      amount: useContent("bingo.prize1_amount", PRIZES[0].amount),
    },
    {
      labelKey: "bingo.prize2_label",
      label: useContent("bingo.prize2_label", PRIZES[1].label),
      amountKey: "bingo.prize2_amount",
      amount: useContent("bingo.prize2_amount", PRIZES[1].amount),
    },
    {
      labelKey: "bingo.prize3_label",
      label: useContent("bingo.prize3_label", PRIZES[2].label),
      amountKey: "bingo.prize3_amount",
      amount: useContent("bingo.prize3_amount", PRIZES[2].amount),
    },
    {
      labelKey: "bingo.prize4_label",
      label: useContent("bingo.prize4_label", PRIZES[3].label),
      amountKey: "bingo.prize4_amount",
      amount: useContent("bingo.prize4_amount", PRIZES[3].amount),
    },
  ];
  const prizesTitle = useContent("bingo.prizes_title", "Prizes on the night");
  const prizesIntro = useContent(
    "bingo.prizes_intro",
    "All put up by the bar — free to play, so it's a game not a gamble. Win it, spend it over the bar.",
  );

  const runTexts = RUN_ORDER.map((r, i) => ({
    key: `bingo.run${i + 1}`,
    timeKey: `bingo.run${i + 1}_time`,
    kind: r.kind,
    label: useContent(`bingo.run${i + 1}`, r.label),
    time: useContent(`bingo.run${i + 1}_time`, r.time),
  }));
  const runTitle = useContent("bingo.run_title", "How the night runs");
  const runIntro = useContent(
    "bingo.run_intro",
    "Comedy and bingo, back to back — building to the headline act.",
  );

  const faqTexts = [
    {
      qKey: "bingo.faq1_q",
      q: useContent("bingo.faq1_q", FAQS[0].q),
      aKey: "bingo.faq1_a",
      a: useContent("bingo.faq1_a", FAQS[0].a),
    },
    {
      qKey: "bingo.faq2_q",
      q: useContent("bingo.faq2_q", FAQS[1].q),
      aKey: "bingo.faq2_a",
      a: useContent("bingo.faq2_a", FAQS[1].a),
    },
    {
      qKey: "bingo.faq3_q",
      q: useContent("bingo.faq3_q", FAQS[2].q),
      aKey: "bingo.faq3_a",
      a: useContent("bingo.faq3_a", FAQS[2].a),
    },
  ];
  const faqTitle = useContent("bingo.faq_title", "Good to know");

  // Rules sheet — click-to-download. The founder drops the real rules in
  // by either replacing /bingo-rules.pdf in the repo's public/ folder OR
  // setting the bingo.rules_url content key to a hosted file. A TBD
  // placeholder ships until then.
  const rulesTitle = useContent("bingo.rules_title", "How to play");
  const rulesBlurb = useContent(
    "bingo.rules_blurb",
    "New to bingo, or just want the house rules? Download the one-pager.",
  );
  const rulesUrl = useContent("bingo.rules_url", "/bingo-rules.pdf");
  const rulesLabel = useContent("bingo.rules_label", "Download the rules (PDF)");

  // Photo slider — comedian/host headshots + the bingo machine. Founder
  // uploads to the "bingo.gallery" gallery in /admin/content/galleries.
  const galleryTitle = useContent("bingo.gallery_title", "The line-up");
  const galleryIntro = useContent(
    "bingo.gallery_intro",
    "Your hosts for the night, and the machine that calls the shots.",
  );
  const [nights, setNights] = useState<DbTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const bookingRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!expandedId) return;
    const id = requestAnimationFrame(() => {
      bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(id);
  }, [expandedId]);

  useEffect(() => {
    let cancelled = false;
    loadBingoNights()
      .then((rows) => {
        if (!cancelled) setNights(rows);
      })
      .catch((e) => {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : "Couldn't load the bingo nights.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return nights
      .filter((t) => t.event_date >= today && t.bookable)
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
  }, [nights]);

  const selected = upcoming.find((t) => t.id === expandedId) ?? null;

  return (
    <main className="bingo-page">
      {/* The hero eyebrow is rendered by the SHARED PageHero in the brand
          red (text-plonkYellow). Re-skin it to bingo pink page-wide here,
          the same way the booking form is re-skinned below. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `.bingo-page [class~="text-plonkYellow"]{color:#e878f0 !important}
.bingo-page details > summary::-webkit-details-marker{display:none}
.bingo-page .faq-chevron{transition:transform .2s ease}
.bingo-page details[open] .faq-chevron{transform:rotate(180deg)}`,
        }}
      />
      {/* Hero banner — swap the image from admin Galleries → "hero.bingo",
          falls back to the shipped placeholder until the founder uploads. */}
      <PageHero
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        image={HERO_FALLBACK}
        eyebrowKey="bingo.eyebrow"
        titleKey="bingo.title"
        introKey="bingo.intro"
        sliderKey="hero.bingo"
      />

      {/* KEY EVENT HEADER — the next event + its date, big and bold.
          Both lines are on-page editable so the founder can roll it to the
          next date each month. */}
      <section className="px-6 pb-4 pt-10 text-center">
        <div className="mx-auto max-w-2xl rounded-3xl border border-[#e878f0]/30 bg-[#e878f0]/5 px-6 py-8">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#e878f0]">
            <Editable k="bingo.event_header">{eventHeader}</Editable>
          </div>
          <div className="mt-3 font-display text-4xl uppercase leading-tight tracking-wider text-cream sm:text-5xl">
            <Editable k="bingo.event_date">{eventDate}</Editable>
          </div>
          <p className="mx-auto mt-4 max-w-md text-sm text-cream/80">
            <Editable k="bingo.book_line">{bookLine}</Editable>
          </p>
          <button
            type="button"
            onClick={() => {
              const next = upcoming[0];
              if (next) setExpandedId(next.id);
            }}
            disabled={!loading && upcoming.length === 0}
            className="mt-6 inline-block rounded-full bg-[#e878f0] px-10 py-4 text-sm font-bold uppercase tracking-widest text-ink shadow-lg shadow-[#e878f0]/30 transition hover:bg-[#e878f0]/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Editable k="bingo.cta_label">{ctaLabel}</Editable>
          </button>
          {!loading && !err && upcoming.length === 0 && (
            <p className="mt-4 text-sm text-cream/60">
              Tickets aren&apos;t on sale just yet — check back soon.
            </p>
          )}
          {err && <p className="mt-4 text-sm text-[#e878f0]">{err}</p>}
        </div>
      </section>

      {/* Booking — opens inline from the header CTA above. The separate
          "pick your night" section was removed (founder, 11 Oct 2026): one
          book link, at the top. The booking form is the SHARED
          InlineTournamentBooking (pool + ping pong use it too, in brand red);
          we re-skin just this instance red → bingo pink via scoped overrides
          on its exact utility classes (the Stripe card iframe's own accent,
          set inside the shared component, stays red — page CSS can't reach it). */}
      {selected && (
        <section className="px-6 pb-8">
          <div
            ref={bookingRef}
            className="bingo-pay mx-auto max-w-2xl scroll-mt-24"
          >
            <style
              dangerouslySetInnerHTML={{
                __html: `
                  .bingo-pay [class~="text-plonkPink"]{color:#e878f0 !important}
                  .bingo-pay [class~="bg-plonkPink"]{background-color:#e878f0 !important}
                  .bingo-pay [class~="bg-plonkPink"][class~="text-white"]{color:#000 !important}
                  .bingo-pay [class~="bg-plonkPink/5"]{background-color:rgb(232 120 240 / .05) !important}
                  .bingo-pay [class~="bg-plonkPink/10"]{background-color:rgb(232 120 240 / .10) !important}
                  .bingo-pay [class~="border-plonkPink/30"]{border-color:rgb(232 120 240 / .30) !important}
                  .bingo-pay [class~="border-plonkPink/40"]{border-color:rgb(232 120 240 / .40) !important}
                  .bingo-pay [class~="border-plonkPink/45"]{border-color:rgb(232 120 240 / .45) !important}
                  .bingo-pay [class~="accent-plonkPink"]{accent-color:#e878f0 !important}
                  .bingo-pay [class~="shadow-plonkPink/20"]{--tw-shadow-color:rgb(232 120 240 / .20) !important}
                  .bingo-pay .focus\\:border-plonkPink:focus{border-color:#e878f0 !important}
                `,
              }}
            />
            <InlineTournamentBooking
              tournament={selected}
              onClose={() => setExpandedId(null)}
            />
          </div>
        </section>
      )}

      {/* ── Running order ── */}
      <section className="px-6 pb-4">
        <div className="mx-auto max-w-2xl">
          <div className="mb-3 text-center text-xs font-bold uppercase tracking-[0.3em] text-[#e878f0]">
            The shape of the evening
          </div>
          <h2 className="text-center font-display text-4xl uppercase tracking-wider text-cream">
            <Editable k="bingo.run_title">{runTitle}</Editable>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-center text-sm text-cream/75">
            <Editable k="bingo.run_intro">{runIntro}</Editable>
          </p>
          <ol className="mx-auto mt-8 max-w-md space-y-0">
            {runTexts.map((r, i) => (
              <li key={r.key} className="relative flex items-start gap-4 pb-6 last:pb-0">
                {/* Connector line between steps */}
                {i < runTexts.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute left-[17px] top-9 h-full w-px bg-[#e878f0]/25"
                  />
                )}
                <span
                  className={`relative z-10 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-base font-bold ${
                    r.kind === "bingo"
                      ? "border-[#e878f0]/50 bg-[#e878f0]/15 text-[#e878f0]"
                      : "border-cream/20 bg-white/5 text-cream/70"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="flex flex-1 flex-col gap-1 pt-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div className="text-sm font-semibold uppercase tracking-wider text-cream/90">
                    <Editable k={r.key}>{r.label}</Editable>
                    {/* Comedian / host names get added here later. */}
                  </div>
                  <div className="shrink-0 text-xs font-bold uppercase tracking-widest text-[#e878f0]">
                    <Editable k={r.timeKey}>{r.time}</Editable>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Prizes ── */}
      <section className="bg-white/[0.02] px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <div className="mb-3 text-center text-xs font-bold uppercase tracking-[0.3em] text-[#e878f0]">
            Bar-sponsored · free to play
          </div>
          <h2 className="text-center font-display text-5xl uppercase tracking-wider text-cream">
            <Editable k="bingo.prizes_title">{prizesTitle}</Editable>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-base text-cream/75">
            <Editable k="bingo.prizes_intro">{prizesIntro}</Editable>
          </p>
          <div className="mx-auto mt-10 grid max-w-2xl gap-3 sm:grid-cols-2">
            {prizeTexts.map((p) => (
              <div
                key={p.labelKey}
                className="flex items-center justify-between gap-4 rounded-2xl border border-[#e878f0]/25 bg-[#e878f0]/5 px-6 py-5"
              >
                <span className="text-sm font-semibold uppercase tracking-wider text-cream/85">
                  <Editable k={p.labelKey}>{p.label}</Editable>
                </span>
                <span className="font-display text-2xl text-[#e878f0]">
                  <Editable k={p.amountKey}>{p.amount}</Editable>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Photo slider: hosts + the bingo machine ──
          Same component, uploader and behaviour as the parties-page strips
          (MediaStrip → the "Add / manage photos" pill in Edit mode →
          /admin/content/galleries). Shows placeholder tiles until the
          founder uploads to the "bingo.gallery" gallery. */}
      <section className="bg-white/[0.02] py-8">
        <MediaStrip
          galleryKey="bingo.gallery"
          heading={galleryTitle}
          intro={galleryIntro}
          headingKey="bingo.gallery_title"
          introKey="bingo.gallery_intro"
          aspect="4 / 5"
          blankCount={4}
          blankLabel="Host / machine photo"
        />
      </section>

      {/* ── Rules download ── */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl uppercase tracking-wider text-cream">
            <Editable k="bingo.rules_title">{rulesTitle}</Editable>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm text-cream/75">
            <Editable k="bingo.rules_blurb">{rulesBlurb}</Editable>
          </p>
          <a
            href={rulesUrl}
            target="_blank"
            rel="noopener"
            className="group mx-auto mt-7 inline-flex items-center gap-3 rounded-full border border-[#e878f0]/35 bg-[#e878f0]/5 px-7 py-3.5 text-xs font-bold uppercase tracking-widest text-cream transition hover:border-[#e878f0]/70 hover:bg-[#e878f0]/10"
          >
            <FileText className="h-4 w-4 text-[#e878f0]" />
            <Editable k="bingo.rules_label">{rulesLabel}</Editable>
            <Download className="h-4 w-4 text-cream/50 transition group-hover:text-[#e878f0]" />
          </a>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-white/[0.02] px-6 py-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center font-display text-4xl uppercase tracking-wider text-cream">
            <Editable k="bingo.faq_title">{faqTitle}</Editable>
          </h2>
          <div className="mt-8 space-y-4">
            {faqTexts.map((f) => (
              <details
                key={f.qKey}
                className="group rounded-2xl border border-[#e878f0]/20 bg-white/[0.03] p-5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-[#e878f0]">
                  <span>
                    <Editable k={f.qKey}>{f.q}</Editable>
                  </span>
                  <svg
                    className="faq-chevron h-5 w-5 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-cream/75">
                  <Editable k={f.aKey}>{f.a}</Editable>
                </p>
              </details>
            ))}
          </div>
          <p className="mt-10 text-center text-xs uppercase tracking-widest text-cream/45">
            No Dice · 407 Mentmore Terrace, London Fields, E8 3PH
          </p>
        </div>
      </section>
    </main>
  );
}
