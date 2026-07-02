"use client";

import { useState } from "react";
import EventsAdminClient from "./EventsAdminClient";
import CalendarEventsAdminClient from "@/app/admin/calendar-events/CalendarEventsAdminClient";

// EventsAdminHub — merged admin surface for the two event tables.
// Founder rule (2026-07-02): one sidebar entry, one starting point.
// Ticketed events (World Cup matches, pool tournaments, DJ nights)
// and calendar posters (artwork on /events with no bookings) still
// live in separate database tables — merging under the hood would
// mean a risky migration that breaks the DJ auto-feed and existing
// paid bookings. The two tabs below preserve the boundary without
// forcing the founder to remember where each thing lives.

type Tab = "ticketed" | "posters";

export default function EventsAdminHub({
  initialTab,
}: {
  initialTab: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="inline-flex rounded-full border border-cream/15 p-1">
        {(
          [
            { id: "ticketed" as const, label: "Ticketed events" },
            { id: "posters" as const, label: "Calendar posters" },
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
          ? "Anything customers pay for or reserve a spot at — World Cup match tables, pool tournaments, DJ nights with tickets. Category, capacity, ticket types."
          : "Poster artwork on the public /events calendar — DJ nights, food specials, one-off promos. No bookings, no tickets. DJ nights from the DJ booking system auto-feed here."}
      </p>

      {tab === "ticketed" ? (
        <EventsAdminClient />
      ) : (
        <CalendarEventsAdminClient />
      )}
    </div>
  );
}
