"use client";

import type { DbCalendarEvent } from "@/lib/db/calendarEvents";

// =============================================================
// djNights — confirmed DJ nights, auto-fed onto the /events calendar
// =============================================================
// DJ bookings are managed in the separate No Dice TEAM hub (its own
// Supabase project). When a night is signed off there it becomes
// "confirmed" and is published on a PUBLIC, no-auth feed. We fetch
// that feed cross-origin (CORS '*') and map each night into the same
// DbCalendarEvent shape the /events page already renders — so DJ
// nights appear on the public calendar automatically, with no manual
// posting and no coupling between the two databases.
//
// These rows are READ-ONLY here: they're not in this site's `events`
// table, so they can't be edited from /admin — that's deliberate, the
// DJ system owns them. Their synthetic id is prefixed `dj-` so the UI
// can tell them apart.
// =============================================================

// Public confirmed-nights feed (team hub Supabase project). Not a secret.
const DJ_FEED =
  "https://rntcujcpsozvuxvmlejv.supabase.co/functions/v1/events-feed";

type FeedNight = {
  date?: string;
  weekday?: string;
  start?: string | null;
  end?: string | null;
  kind?: string | null;
  dj?: string | null;
  image?: string | null;
  instagram?: string | null;
  night_name?: string | null;
  genres?: string[] | null;
  set_type?: string | null;
};

export const DJ_EVENT_PREFIX = "dj-";

export function isDjEvent(ev: { id: string }): boolean {
  return typeof ev.id === "string" && ev.id.startsWith(DJ_EVENT_PREFIX);
}

// Returns confirmed DJ nights within [fromIso, toIso] mapped to the
// calendar-event shape. Never throws — a feed/network failure just
// yields an empty list so the rest of the calendar still renders.
export async function loadDjNightsInRange(
  fromIso: string,
  toIso: string,
): Promise<DbCalendarEvent[]> {
  let nights: FeedNight[] = [];
  try {
    const res = await fetch(DJ_FEED, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) nights = data as FeedNight[];
    }
  } catch {
    nights = [];
  }

  return nights
    .filter(
      (n) =>
        n &&
        typeof n.date === "string" &&
        n.date >= fromIso &&
        n.date <= toIso,
    )
    .map((n) => {
      const genres = Array.isArray(n.genres) ? n.genres.join(" · ") : "";
      const bodyParts = [
        n.night_name ? `“${n.night_name}”` : null,
        genres || null,
      ].filter(Boolean) as string[];
      const fallback = n.kind === "opendecks" ? "Open Decks" : "DJ set";
      return {
        id: `${DJ_EVENT_PREFIX}${n.date}`,
        event_date: n.date as string,
        start_time: n.start || null,
        title: n.dj || "DJ",
        body: bodyParts.join(" — ") || fallback,
        image_url: n.image || "",
        link_url: null,
        active: true,
        created_at: "",
        updated_at: "",
      } as DbCalendarEvent;
    });
}
