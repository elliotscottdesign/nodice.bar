"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PageHero from "@/components/PageHero";
import RollerDeck from "@/components/RollerDeck";
import BingoLineup from "@/components/BingoLineup";
import BingoBooking from "@/components/BingoBooking";
import { useContent } from "@/lib/content";
import { useEditMode } from "@/lib/editMode";
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
// Accent: warm poster-red #D65139, sampled from the Comedy Bingo poster
// (Nov 2026 — founder "suit this colourway in red not pink"), used for CTAs,
// headings and the bar-sponsored prizes. Checked at 375px + 1280px.
// =============================================================

// No baked-in fallback image. The hero is driven by the admin Galleries
// → "hero.bingo" upload (the founder's pink header). While that loads we
// show the plain hero background, NOT the old black/red word-stamped
// placeholder, which used to flash in behind the title on every load
// (founder, 18 Oct 2026 — "didn't want the old one coming up as it loads").
const HERO_FALLBACK = "";

// Hidden pre-launch (founder, 19 Oct 2026 — "hide bingo page again for now").
// While true, the page bounces to home so it isn't publicly viewable; the
// event is also hidden from /events and the nav link is pulled. Flip to false
// (and re-show the event + nav) to launch.
const BINGO_HIDDEN = false;

// Bar-sponsored prizes (founder, 11 Oct 2026) — free to play, bar puts up
// the pot so it isn't gambling.
const PRIZES: Array<{ label: string; amount: string }> = [
  { label: "First vertical line", amount: "£20" },
  { label: "First horizontal line", amount: "£20" },
  { label: "First diagonal line", amount: "£20" },
  { label: "Full house — BINGO!", amount: "£40" },
];

// The shape of the evening (founder, 18 Oct 2026): two comics, a round of
// bingo, a break — twice — then the headline set. Times are a guide from the
// 7:30 start; comedian/host names get added to each comic slot later.
const RUN_ORDER: Array<{
  label: string;
  kind: "comedy" | "bingo" | "break";
  time: string;
}> = [
  { label: "Two comics", kind: "comedy", time: "7:30 – 8:00pm" },
  { label: "Round of bingo", kind: "bingo", time: "8:00 – 8:15pm" },
  { label: "Break", kind: "break", time: "8:15 – 8:30pm" },
  { label: "Two comics", kind: "comedy", time: "8:30 – 9:00pm" },
  { label: "Round of bingo", kind: "bingo", time: "9:00 – 9:15pm" },
  { label: "Break", kind: "break", time: "9:15 – 9:30pm" },
  { label: "Headline set", kind: "comedy", time: "9:30 – 10:00pm" },
];

// Split the single event-date field into a big DATE line and a smaller
// TIMES line (doors / show) on its own line below, so the two read as
// self-contained sections and never flap onto one another. Splits on a
// newline the founder added (Return in Edit mode), else on the first
// "doors" word; falls back to the whole string as the date line.
function splitEventDate(s: string): { date: string; times: string } {
  const nl = s.indexOf("\n");
  if (nl >= 0)
    return { date: s.slice(0, nl).trim(), times: s.slice(nl + 1).trim() };
  const m = s.match(/\s+(doors\b[\s\S]*)$/i);
  if (m && m.index != null)
    return { date: s.slice(0, m.index).trim(), times: m[1].trim() };
  return { date: s.trim(), times: "" };
}

export default function BingoPage() {
  // CMS copy — editable in /admin or on-page in Edit mode. The KEY
  // header the founder uses for the next event + its date lives in
  // bingo.event_header / bingo.event_date (shown prominently below the
  // hero), separate from the evergreen hero title.
  const eyebrow = useContent("bingo.eyebrow", "Comedy & Bingo · London Fields");
  const title = useContent("bingo.title", "Bingo Night");
  const intro = useContent(
    "bingo.intro",
    "Comedy and bingo under one roof at No Dice. £10 a ticket gets you the comedy and 5 bingo cards to play across the 2 games — bingo's free to play, with prizes put up by the bar. Eyes down, London Fields.",
  );
  // The headline the founder points at the next event + its date(s).
  const eventHeader = useContent("bingo.event_header", "Our first-ever Bingo Night");
  const eventDate = useContent("bingo.event_date", "Wednesday 25 November 2026 · 7pm");
  const editing = useEditMode();
  const eventParts = splitEventDate(eventDate);

  const bookLine = useContent(
    "bingo.book_line",
    "£10 a ticket — one per person. Comedy + 5 bingo cards across the 2 games. Grab yours below.",
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

  // Photo slider — comedian/host headshots + the bingo machine. Founder
  // uploads to the "bingo.gallery" gallery in /admin/content/galleries.
  const galleryTitle = useContent("bingo.gallery_title", "The line-up");
  const [nights, setNights] = useState<DbTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const bookingRef = useRef<HTMLDivElement | null>(null);
  // Sticky "Book your ticket" CTA — shows once the header CTA scrolls out of
  // view (so it follows the reader down the page on phone + desktop).
  const headerCtaRef = useRef<HTMLButtonElement | null>(null);
  const [showStickyCta, setShowStickyCta] = useState(false);

  useEffect(() => {
    if (!expandedId) return;
    const id = requestAnimationFrame(() => {
      bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(id);
  }, [expandedId]);

  // Show the top sticky CTA only once the in-page book button has scrolled
  // UP out of view (its bottom is above the nav). A plain scroll listener,
  // not an IntersectionObserver — the observer skipped the "in view" state
  // on fast/jump scrolls, so the pill either never showed or popped over
  // the hero. Hidden at the top and while the button is on screen, so it
  // never covers the eyebrow/title.
  useEffect(() => {
    const el = headerCtaRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      setShowStickyCta(el.getBoundingClientRect().bottom < 72);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Hidden pre-launch: bounce to home so the page isn't publicly viewable.
  useEffect(() => {
    if (BINGO_HIDDEN && typeof window !== "undefined") {
      window.location.replace((process.env.NEXT_PUBLIC_BASE_PATH || "") + "/");
    }
  }, []);

  const openBooking = () => {
    const next = upcoming[0];
    if (next) setExpandedId(next.id);
  };

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

  // Hidden pre-launch — render a blank placeholder while the redirect above
  // takes effect (keeps the full page below intact for an easy re-launch).
  if (BINGO_HIDDEN) {
    return <main style={{ minHeight: "60vh" }} />;
  }

  return (
    <main className="bingo-page">
      {/* The hero eyebrow is rendered by the SHARED PageHero in the brand
          red (text-plonkYellow). Re-skin it to the bingo poster-red page-wide here,
          the same way the booking form is re-skinned below. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `.bingo-page [class~="text-plonkYellow"]{color:#D65139 !important}`,
        }}
      />
      {/* Hero — image removed for now (founder, Nov 2026 — "remove banner
          image for now, add later"). The hero renders its plain background
          + title band. To bring a banner back, re-add sliderKey="hero.bingo"
          (and upload an image to that gallery in admin). */}
      <PageHero
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        image={HERO_FALLBACK}
        eyebrowKey="bingo.eyebrow"
        titleKey="bingo.title"
        introKey="bingo.intro"
      />

      {/* ── Line-up: comedian / host photos ──
          Above the booking (founder, 18 Oct 2026) so the acts are seen
          before the CTA. DESKTOP shows every face across the full page
          width; PHONE is a centred carousel. Names (red, Bebas Neue) sit
          above each photo. Founder uploads to "bingo.gallery" in admin. */}
      <section className="bg-white/[0.02] py-8">
        <BingoLineup
          galleryKey="bingo.gallery"
          heading={galleryTitle}
          headingKey="bingo.gallery_title"
          blankLabel="Host / machine photo"
          nameColor="#D65139"
          nameFontFamily='"Bebas Neue", Impact, sans-serif'
        />
      </section>

      {/* KEY EVENT HEADER — the next event + its date, big and bold.
          Both lines are on-page editable so the founder can roll it to the
          next date each month. */}
      <section className="px-6 pb-8 pt-12 text-center">
        <div className="mx-auto max-w-2xl rounded-3xl border border-[#D65139]/30 bg-[#D65139]/5 px-6 py-8">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#D65139]">
            <Editable k="bingo.event_header">{eventHeader}</Editable>
          </div>
          {/* Date + times. In Edit mode it's a single editable field (the
              founder can press Return to split the two lines); on the live
              page it renders as a big DATE line and a smaller TIMES line
              directly below, each self-contained so they never overlap. */}
          {editing ? (
            <div
              className="mt-3 font-display text-3xl uppercase leading-tight tracking-wider text-cream sm:text-5xl"
              style={{ textWrap: "balance" }}
            >
              <Editable k="bingo.event_date">{eventDate}</Editable>
            </div>
          ) : (
            <>
              <div
                className="mt-3 font-display text-3xl uppercase leading-tight tracking-wider text-cream sm:text-5xl"
                style={{ textWrap: "balance" }}
              >
                {eventParts.date}
              </div>
              {eventParts.times && (
                <div
                  className="mt-2 font-display text-lg uppercase leading-snug tracking-wider text-cream/85 sm:text-2xl"
                  style={{ textWrap: "balance" }}
                >
                  {eventParts.times}
                </div>
              )}
            </>
          )}
          <p className="mx-auto mt-4 max-w-md text-sm text-cream/80">
            <Editable k="bingo.book_line">{bookLine}</Editable>
          </p>
          <button
            ref={headerCtaRef}
            type="button"
            onClick={openBooking}
            disabled={!loading && upcoming.length === 0}
            className="mt-6 inline-block rounded-full bg-[#D65139] px-10 py-4 text-sm font-bold uppercase tracking-widest text-ink shadow-lg shadow-[#D65139]/30 transition hover:bg-[#D65139]/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Editable k="bingo.cta_label">{ctaLabel}</Editable>
          </button>
          {!loading && !err && upcoming.length === 0 && (
            <p className="mt-4 text-sm text-cream/60">
              Tickets aren&apos;t on sale just yet — check back soon.
            </p>
          )}
          {err && <p className="mt-4 text-sm text-[#D65139]">{err}</p>}
        </div>
      </section>

      {/* Booking — opens inline from the header CTA above (one book link, at
          the top). Bingo has its OWN pink BingoBooking component + bingo-checkout
          Edge Function now — no longer the shared pool InlineTournamentBooking,
          so no red→pink re-skin hack is needed. */}
      {selected && (
        <section className="px-6 pb-8">
          <div ref={bookingRef} className="mx-auto max-w-2xl scroll-mt-24">
            <BingoBooking night={selected} onClose={() => setExpandedId(null)} />
          </div>
        </section>
      )}

      {/* ── Running order ── */}
      <section className="px-6 pb-8 pt-16">
        <div className="mx-auto max-w-2xl">
          <div className="mb-3 text-center text-xs font-bold uppercase tracking-[0.3em] text-[#D65139]">
            The shape of the evening
          </div>
          <h2 className="text-center font-display text-4xl uppercase tracking-wider text-cream">
            <Editable k="bingo.run_title">{runTitle}</Editable>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-center text-sm text-cream/75">
            <Editable k="bingo.run_intro">{runIntro}</Editable>
          </p>
          <ol className="mx-auto mt-8 max-w-md space-y-0">
            {runTexts.map((r, i) => {
              const isBreak = r.kind === "break";
              // Number only the acts — breaks sit between them as a pause.
              const actNo = runTexts
                .slice(0, i + 1)
                .filter((x) => x.kind !== "break").length;
              return (
                <li
                  key={r.key}
                  className="relative flex items-start gap-4 pb-6 last:pb-0"
                >
                  {/* Connector line between steps */}
                  {i < runTexts.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute left-[17px] top-9 h-full w-px bg-[#D65139]/25"
                    />
                  )}
                  <span
                    className={`relative z-10 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-base font-bold ${
                      isBreak
                        ? "border-cream/15 bg-ink"
                        : r.kind === "bingo"
                          ? "border-[#D65139]/50 bg-[#D65139]/15 text-[#D65139]"
                          : "border-cream/20 bg-white/5 text-cream/70"
                    }`}
                  >
                    {isBreak ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-cream/40" />
                    ) : (
                      actNo
                    )}
                  </span>
                  <div className="flex flex-1 flex-col gap-1 pt-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div
                      className={`text-sm font-semibold uppercase tracking-wider ${
                        isBreak ? "text-cream/45" : "text-cream/90"
                      }`}
                    >
                      <Editable k={r.key}>{r.label}</Editable>
                      {/* Comedian / host names get added here later. */}
                    </div>
                    <div
                      className={`shrink-0 text-xs font-bold uppercase tracking-widest ${
                        isBreak ? "text-cream/40" : "text-[#D65139]"
                      }`}
                    >
                      <Editable k={r.timeKey}>{r.time}</Editable>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ── Prizes ── */}
      <section className="bg-white/[0.02] px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <div className="mb-3 text-center text-xs font-bold uppercase tracking-[0.3em] text-[#D65139]">
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
                className="flex items-center justify-between gap-4 rounded-2xl border border-[#D65139]/25 bg-[#D65139]/5 px-6 py-5"
              >
                <span className="text-sm font-semibold uppercase tracking-wider text-cream/85">
                  <Editable k={p.labelKey}>{p.label}</Editable>
                </span>
                <span className="font-display text-2xl text-[#D65139]">
                  <Editable k={p.amountKey}>{p.amount}</Editable>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Venue footer line */}
      <section className="px-6 py-16">
        <p className="text-center text-xs uppercase tracking-widest text-cream/45">
          No Dice · 407 Mentmore Terrace, London Fields, E8 3PH
        </p>
      </section>

      {/* Sticky "Book your ticket" CTA — pinned just under the nav at the TOP
          of the viewport (founder, Nov 2026 — "stay at top so users can read
          the info and book quickly"), once the header CTA has scrolled away.
          Hidden while the booking form is open, or when there's no night on
          sale. z-40 sits under the sticky nav (z-50). */}
      {showStickyCta && !selected && upcoming.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 top-[60px] z-40 flex justify-center px-4 pt-2 sm:top-[68px]">
          <button
            type="button"
            onClick={openBooking}
            className="pointer-events-auto rounded-full bg-[#D65139] px-8 py-4 text-sm font-bold uppercase tracking-widest text-ink shadow-xl shadow-black/40 ring-1 ring-black/10 transition hover:bg-[#D65139]/90"
          >
            {ctaLabel}
          </button>
        </div>
      )}
    </main>
  );
}
