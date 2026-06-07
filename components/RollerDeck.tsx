"use client";

import { useEffect, useRef, useState } from "react";

// =============================================================
// RollerDeck — horizontally scrollable card rail with arrows
// =============================================================
// Shared chrome for every horizontal "swipe-able cards" surface on
// the public site so the UX is identical across:
//   • /world-cup     — match fixtures (MatchSchedule)
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
}: {
  children: React.ReactNode;
  /** Optional aria-label for the scroll region (e.g. "Upcoming matches"). */
  ariaLabel?: string;
  /** Optional extra classes for the OUTER wrapper. The rail itself
   *  always carries snap + scroll behaviour. */
  className?: string;
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
      {/* Edge-fade gradients — pointer-events: none so they don't
          intercept taps on the cards underneath. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 z-10 h-full w-8 bg-gradient-to-r from-ink to-transparent sm:w-12"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 z-10 h-full w-8 bg-gradient-to-l from-ink to-transparent sm:w-12"
      />

      {/* Arrow buttons — hidden on mobile (touch swipe is intuitive),
          shown sm+ where there's no swipe gesture. Positioned to sit
          in the rail's extra horizontal padding (added below on sm+)
          so they appear OUTSIDE the leftmost / rightmost visible card,
          not on top of it. */}
      <button
        type="button"
        aria-label={`Scroll ${ariaLabel || "list"} left`}
        onClick={() => scrollByCard(-1)}
        className={`absolute left-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-cream/20 bg-ink/80 p-3 text-cream shadow-xl backdrop-blur transition hover:bg-plonkPink hover:text-white sm:flex ${
          canLeft ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <ChevronIcon dir="left" />
      </button>
      <button
        type="button"
        aria-label={`Scroll ${ariaLabel || "list"} right`}
        onClick={() => scrollByCard(1)}
        className={`absolute right-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-cream/20 bg-ink/80 p-3 text-cream shadow-xl backdrop-blur transition hover:bg-plonkPink hover:text-white sm:flex ${
          canRight ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <ChevronIcon dir="right" />
      </button>

      {/* The actual scrollable rail. Children are placed directly
          inside — they should declare their own width / snap-start
          per card. The extra sm:px-16 padding pushes the first/last
          card INWARDS so the absolute-positioned arrows above sit
          flush in the rail's empty gutter, never overlapping a card. */}
      <div
        ref={railRef}
        onScroll={refreshArrows}
        aria-label={ariaLabel}
        className="hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2 pt-1 sm:px-16"
        style={{
          scrollPaddingLeft: "24px",
          scrollPaddingRight: "24px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ChevronIcon({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      width="18"
      height="18"
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
