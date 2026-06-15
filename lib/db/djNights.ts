"use client";

import type { DbCalendarEvent } from "@/lib/db/calendarEvents";
import { supabase } from "@/lib/supabase";

// =============================================================
// djNights — confirmed DJ nights, auto-fed onto the /events calendar
// =============================================================
// DJ bookings are managed in the separate No Dice TEAM hub (its own
// Supabase project). When a night is signed off there it becomes
// "confirmed" and is published on a PUBLIC, no-auth feed. We fetch
// that feed cross-origin (CORS '*') and map each night into the same
// DbCalendarEvent shape the /events page already renders — so DJ
// nights appear on the public calendar automatically, with no manual
// posting.
//
// The DJ SYSTEM still owns each night's details (date, DJ, artwork,
// genres) — those are not editable here. The one thing the founder CAN
// change from this site's /admin is the event's CATEGORY: each night
// defaults to "DJ Night" but a per-night override can be saved to the
// `dj_night_overrides` table (keyed by the synthetic id). The public
// calendar reads those overrides back, so a change here shows there.
//
// Synthetic id = `dj-<date>-<slot>` (slot keeps two-session Saturdays
// distinct). The `dj-` prefix lets the UI tell these apart.
// =============================================================

// Public confirmed-nights feed (team hub Supabase project). Not a secret.
const DJ_FEED =
  "https://rntcujcpsozvuxvmlejv.supabase.co/functions/v1/events-feed";

type FeedNight = {
  date?: string;
  slot?: string | null;
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

// Stable per-night key (date + slot). Also the override-table key.
export function djEventKey(date: string, slot?: string | null): string {
  return `${DJ_EVENT_PREFIX}${date}-${slot || "main"}`;
}

// Founder-set category overrides (dj_night_overrides). anon may read them
// (RLS), so the public calendar reflects changes made in /admin.
async function loadCategoryOverrides(): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabase()
      .from("dj_night_overrides")
      .select("event_key, subcategory");
    if (error || !Array.isArray(data)) return {};
    const map: Record<string, string> = {};
    for (const r of data as { event_key: string; subcategory: string | null }[]) {
      if (r.event_key && r.subcategory) map[r.event_key] = r.subcategory;
    }
    return map;
  } catch {
    return {};
  }
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

  const overrides = await loadCategoryOverrides();

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
      const key = djEventKey(n.date as string, n.slot);
      return {
        id: key,
        event_date: n.date as string,
        start_time: n.start || null,
        title: n.dj || "DJ",
        body: bodyParts.join(" — ") || fallback,
        image_url: n.image || "",
        link_url: null,
        active: true,
        subcategory: overrides[key] || "DJ Night",
        created_at: "",
        updated_at: "",
      } as DbCalendarEvent;
    });
}

// Override one DJ night's public category. Admin-only in practice — writes
// require an authenticated Supabase session (RLS). `eventKey` is the night's
// synthetic id (`dj-<date>-<slot>`).
export async function setDjNightCategory(
  eventKey: string,
  subcategory: string,
): Promise<void> {
  const { error } = await supabase()
    .from("dj_night_overrides")
    .upsert(
      { event_key: eventKey, subcategory, updated_at: new Date().toISOString() },
      { onConflict: "event_key" },
    );
  if (error) throw error;
}
