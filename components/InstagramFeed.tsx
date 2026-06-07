"use client";

import { createElement } from "react";
import Script from "next/script";
import { useContent } from "@/lib/content";
import { Editable } from "@/components/Editable";

// =============================================================
// InstagramFeed — Behold.so widget wrapped with No Dice chrome
// =============================================================
// Live grid pulled from @nodice.bar via Behold (managed at
// behold.so). Eyebrow + heading are CMS-editable; pass keys per
// mount so different pages can have different copy without
// duplicating the widget setup.
//
// Defaults match the homepage usage so existing edits there carry
// over without a migration.
// =============================================================

const INSTAGRAM_URL = "https://www.instagram.com/nodice.bar/";
const BEHOLD_FEED_ID = "Ri14ASLlH0Y21Si7xE2v";

export default function InstagramFeed({
  eyebrowKey = "home.instagram.eyebrow",
  eyebrowFallback = "@nodice.bar",
  headingKey = "home.instagram.heading",
  headingFallback = "Follow along.",
}: {
  eyebrowKey?: string;
  eyebrowFallback?: string;
  headingKey?: string;
  headingFallback?: string;
}) {
  const eyebrow = useContent(eyebrowKey, eyebrowFallback);
  const heading = useContent(headingKey, headingFallback);

  return (
    <section className="relative overflow-hidden px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <p className="text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
            <Editable k={eyebrowKey}>{eyebrow}</Editable>
          </p>
          <h2 className="mt-5 font-display text-4xl leading-tight sm:text-5xl md:text-6xl">
            <Editable k={headingKey}>{heading}</Editable>
          </h2>
        </div>

        {/* Behold loader. afterInteractive so first paint isn't blocked. */}
        <Script
          src="https://w.behold.so/widget.js"
          type="module"
          strategy="afterInteractive"
        />
        {/* createElement avoids the TS "unknown JSX element" warning a
            literal <behold-widget> tag would throw. Theme + grid are
            configured at behold.so. */}
        {createElement("behold-widget", { "feed-id": BEHOLD_FEED_ID })}

        <div className="mt-10 text-center">
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-plonkPink px-8 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-plonkPink/20 transition hover:bg-plonkPink/90"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
            Follow @nodice.bar
          </a>
        </div>
      </div>
    </section>
  );
}
