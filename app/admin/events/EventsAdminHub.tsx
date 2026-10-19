"use client";

import { useState } from "react";
import EventsAdminClient from "./EventsAdminClient";
import DealsAdminClient from "@/app/admin/deals/DealsAdminClient";

// EventsAdminHub — one place for everything event-shaped.
// Founder 19 Oct 2026: the old "Calendar posters" tab is gone — the Events tab
// below now makes any event (ticketed OR a plain poster), so there's a single
// editor. DJ nights still auto-feed from the booking system; drinks deals keep
// their own focused builder. (The /admin/calendar-events route is no longer
// linked here.)

type Tab = "ticketed" | "deals";

export default function EventsAdminHub() {
  // Read ?tab=… from the URL client-side. Server-side reads bail Next.js out of
  // the static export. (?tab=posters is retired → falls through to the Events tab.)
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "ticketed";
    const q = new URLSearchParams(window.location.search).get("tab");
    return q === "deals" ? "deals" : "ticketed";
  });

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="inline-flex rounded-full border border-cream/15 p-1">
        {(
          [
            { id: "ticketed" as const, label: "Events" },
            { id: "deals" as const, label: "Deals" },
          ]
        ).map((t) => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-5 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                isActive
                  ? "bg-plonkPink text-white"
                  : "text-cream/70 hover:text-cream"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-cream/55">
        {tab === "ticketed"
          ? "Every event — ticketed or just a poster on the calendar. Pool & ping pong tournaments, DJ nights, food nights, specials, one-off promos. Pick the category + artwork; add capacity + ticket types only if it sells tickets."
          : "Drinks deals — a focused builder for each deal. Fill the parameters, make the poster, and it drives the website, the drinks-zine cover and the printed flyer."}
      </p>

      {tab === "ticketed" ? <EventsAdminClient /> : <DealsAdminClient />}
    </div>
  );
}
