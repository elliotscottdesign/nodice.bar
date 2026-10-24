"use client";

// openDecksNights — upcoming OPEN-DECKS nights for the public /events calendar.
// DJs sign themselves up at /open-decks (free 1-hour slots on the quiet nights);
// the team hub's `open-decks` edge fn publishes a no-contact listing (date + the
// signed-up DJ names + the standing poster image) which we map into the same
// DbCalendarEvent shape /events already renders — so an open-decks night appears
// automatically as DJs sign up (founder, 24 Oct). Mirrors djNights.ts.

import type { DbCalendarEvent } from "@/lib/db/calendarEvents";

const FN = "https://rntcujcpsozvuxvmlejv.supabase.co/functions/v1/open-decks";

type ListingNight = { date?: string; start?: string | null; end?: string | null; djs?: string[]; image?: string | null };

export async function loadOpenDecksNightsInRange(
  fromIso: string,
  toIso: string,
): Promise<DbCalendarEvent[]> {
  let nights: ListingNight[] = [];
  try {
    const res = await fetch(FN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "listing" }),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.nights)) nights = data.nights as ListingNight[];
    }
  } catch {
    nights = [];
  }

  return nights
    .filter((n) => typeof n.date === "string" && n.date >= fromIso && n.date <= toIso)
    .map((n) => {
      const djs = Array.isArray(n.djs) ? n.djs.filter(Boolean) : [];
      return {
        id: `od-${n.date}`,
        event_date: n.date as string,
        start_time: n.start || null,
        title: "Open Decks",
        body: djs.length ? djs.join(" · ") : "All welcome — sign up to play",
        image_url: n.image || "",
        link_url: "/open-decks/",   // tap the night → the sign-up page
        active: true,
        subcategory: "DJ Night",
        created_at: "",
        updated_at: "",
      } as DbCalendarEvent;
    });
}
