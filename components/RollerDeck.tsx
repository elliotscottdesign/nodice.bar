"use client";

import { useEffect, useRef, useState } from "react";

// =============================================================
// RollerDeck — horizontally scrollable card rail with arrows
// =============================================================
// Shared chrome for every horizontal "swipe-able cards" surface on
// the public site so the UX is identical across:
//   • /worldcup     — match fixtures (MatchSchedule)
//   • /pool          — tournament sign-ups (TournamentSchedule)
//   • /events        — DJ-night poster rail (EventsScroller)
//   • Any future card rail — drop the children inside <RollerDeck>
//
// What it provides, automatically:
//   1. Snap-scroll behaviour (scroll-snap-x mandatory) — every card
//      lands flush as the customer swipes.
//   2. Edge-fade gradients on both sides so the rail's contents
//      look like they continue past the viewport.
//   3. Left / right arrow pills that scroll the rail by ~one card.
//      Both arrows fade out at the corresponding end of the scroll
//      range so a click never goes nowhere. The right arrow shows
//      on first paint when there are more cards than fit — that's
//      the affordance new visitors need to know they can scroll.
//   4. Hidden native scrollbar (`hide-scrollbar`) so the rail looks
//      designed, not raw.
//   5. Negative horizontal margin on mobile so cards bleed past the
//      section's edge padding (the next card peeks in to signal
//      scrollability). On sm+ that bleed is dropped.
//
// Usage:
//   <RollerDeck ariaLabel="Upcoming matches">
//     {events.map(e => <Card key={e.id} … />)}
//   </RollerDeck>
//
// Direct children should be `shrink-0 snap-start` cards. The
// component intentionally does NOT impose card sizing or styling
// so each rail keeps its own card design.
// =============================================================

export default function RollerDeck({
  children,
  ariaLabel,
  className,
  center,
  centerMode,
  fade = true,
  arrowAccent = false,
  arrowTop,
}: {
  children: React.ReactNode;
  /** Optional aria-label for the scroll region (e.g. "Upcoming matches"). */
  ariaLabel?: string;
  /** Optional extra classes for the OUTER wrapper. The rail itself
   *  always carries snap + scroll behaviour. */
  className?: string;
  /** Centre the cards when they fit (e.g. a single date), falling back to
   *  start alignment — no clipping — once they overflow and scroll. */
  center?: boolean;
  /** Snap-centre mode: drops the rail's left gutter + scroll-padding so
   *  callers that add leading/trailing spacers can centre each card in the
   *  viewport (used by the bingo line-up). */
  centerMode?: boolean;
  /** Edge-fade gradients fade cards into a BLACK page. Set false on a
   *  coloured/gradient background where the black fade would show as a band. */
  fade?: boolean;
  /** Bigger, brand-red arrow buttons (founder, 12 Nov 2026 — used on the
   *  homepage rails). Default keeps the subtle cream pill every other rail
   *  uses, so this is opt-in and never changes /pool, /worldcup, /events… */
  arrowAccent?: boolean;
  /** Vertical anchor for the arrows as a CSS top value (e.g. "40%"), applied
   *  inline so it survives this project's Tailwind purge. Used to sit the
   *  arrows on the poster rather than the whole card. Defaults to centre. */
  arrowTop?: string;
}) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  function refreshArrows() {
    const el = railRef.current;
    if (!el) return;
    // 1px tolerance for sub-pixel scroll rounding (Safari quirk).
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }

  function scrollByCard(direction: -1 | 1) {
    const el = railRef.current;
    if (!el) return;
    // Card width is variable per rail (~240–320px). 60% of the rail
    // width is a sensible "one page" step that feels right on both
    // mobile (single card) and desktop (3–4 cards visible).
    const step = Math.max(240, Math.round(el.clientWidth * 0.6));
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  // Recompute on mount and whenever the viewport resizes. Children
  // changing (e.g. a tab swap) triggers a layout pass which also
  // fires onScroll, so we don't need a children-count effect.
  useEffect(() => {
    refreshArrows();
    window.addEventListener("resize", refreshArrows);
    return () => window.removeEventListener("resize", refreshArrows);
  }, []);

  // Also re-check after first paint so the initial right-arrow
  // visibility is correct (scrollWidth needs the cards to be laid
  // out, which can be one frame after mount).
  useEffect(() => {
    const id = requestAnimationFrame(refreshArrows);
    return () => cancelAnimationFrame(id);
  });

  return (
    <div className={`relative -mx-6 sm:mx-0 ${className ?? ""}`}>
      {/* Edge-fade gradients sit at the RAIL edges (inset by the arrow
          gutter on sm+) so they fade the cards near the arrows, not the
          empty gutter. pointer-events: none so they never block a tap. */}
      {fade && (<>
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 z-10 h-full w-8 bg-gradient-to-r from-ink to-transparent sm:left-14"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 z-10 h-full w-8 bg-gradient-to-l from-ink to-transparent sm:right-14"
      />
      </>)}

      {/* Arrow buttons — hidden on mobile (touch swipe is intuitive),
          shown sm+. They sit in the reserved side gutter (the sm:px-14
          wrapper below), which is OUTSIDE the scroll rail — so they can
          never overlap the first / last card, and they auto-hide when
          the rail isn't scrollable. */}
      <button
        type="button"
        aria-label={`Scroll ${ariaLabel || "list"} left`}
        onClick={() => scrollByCard(-1)}
        style={arrowTop ? { top: arrowTop } : undefined}
        className={`absolute left-1 z-20 hidden -translate-y-1/2 rounded-full shadow-xl backdrop-blur transition sm:flex ${
          arrowTop ? "" : "top-1/2"
        } ${
          arrowAccent
            ? "border-2 border-plonkPink bg-ink/85 p-3.5 text-plonkPink hover:bg-plonkPink hover:text-white"
            : "border border-cream/20 bg-ink/80 p-3 text-cream hover:bg-plonkPink hover:text-white"
        } ${canLeft ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <ChevronIcon dir="left" size={arrowAccent ? 26 : 18} />
      </button>
      <button
        type="button"
        aria-label={`Scroll ${ariaLabel || "list"} right`}
        onClick={() => scrollByCard(1)}
        style={arrowTop ? { top: arrowTop } : undefined}
        className={`absolute right-1 z-20 hidden -translate-y-1/2 rounded-full shadow-xl backdrop-blur transition sm:flex ${
          arrowTop ? "" : "top-1/2"
        } ${
          arrowAccent
            ? "border-2 border-plonkPink bg-ink/85 p-3.5 text-plonkPink hover:bg-plonkPink hover:text-white"
            : "border border-cream/20 bg-ink/80 p-3 text-cream hover:bg-plonkPink hover:text-white"
        } ${canRight ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <ChevronIcon dir="right" size={arrowAccent ? 26 : 18} />
      </button>

      {/* Gutter wrapper — reserves room for the arrows on sm+ as PADDING
          on this wrapper (not on the rail), so the gutter never counts as
          scroll overflow. That's what lets a short rail that fits show no
          arrows at all, while a long one scrolls with arrows that stay in
          the gutter. */}
      <div className="sm:px-14">
        <div
          ref={railRef}
          onScroll={refreshArrows}
          aria-label={ariaLabel}
          className={`hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto py-2 sm:px-0 ${
            centerMode ? "" : "px-6"
          }`}
          style={{
            scrollPaddingLeft: centerMode ? "0px" : "12px",
            scrollPaddingRight: centerMode ? "0px" : "12px",
            ...(center ? { justifyContent: "safe center" } : null),
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function ChevronIcon({ dir, size = 18 }: { dir: "left" | "right"; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {dir === "left" ? (
        <polyline points="15 18 9 12 15 6" />
      ) : (
        <polyline points="9 18 15 12 9 6" />
      )}
    </svg>
  );
}
