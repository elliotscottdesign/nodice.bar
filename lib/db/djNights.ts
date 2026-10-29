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

// Turn the feed's `instagram` field into a URL safe to put in an href — or
// null, in which case that card just stays non-clickable (today's behaviour).
//
// WHY THIS IS CAREFUL: the handle is typed by a human into the team hub and
// reaches us cross-origin from another Supabase project. It is untrusted data
// heading for an `href`, so it is NEVER passed through raw — a value like
// `javascript:alert(1)` or `data:text/html,…` in an href is a live XSS. This
// function only ever returns a URL it builds itself from a handle that has
// passed the character whitelist below, so the worst a bad feed value can do
// is produce a 404 on instagram.com, or nothing at all.
//
// The live feed carries four shapes, all seen in the data:
//   "@wafalovesrecord"                          → at-prefixed handle
//   "nickmannini"                               → bare handle
//   "https://www.instagram.com/damianbthomas/"  → full profile URL
//   "@joshffb //. @discotheque_tropicale"       → two handles; we link the 1st
const IG_HANDLE = /^[A-Za-z0-9._]{1,30}$/;

export function instagramUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Some nights list a second DJ/collective after the first. Take the leading
  // whitespace-separated token and ignore the rest.
  const first = trimmed.split(/\s+/)[0];

  // Protocol-relative ("//evil.com/x") is never a handle and never a URL we
  // can vet without a base — drop it before anything else looks at it.
  if (first.startsWith("//")) return null;

  const hasScheme = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(first);
  let handle: string;

  if (hasScheme || first.includes("/")) {
    // URL-shaped. Parse it properly and demand it really is instagram.com over
    // http(s) before trusting any part of it. This is what rejects
    // "javascript:alert(1)", "data:…", "https://instagram.com.evil.com/foo"
    // (host ends in .evil.com, not .instagram.com) and
    // "https://evil.com/instagram.com/foo" (host is evil.com).
    let url: URL;
    try {
      url = new URL(hasScheme ? first : `https://${first}`);
    } catch {
      return null;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    if (host !== "instagram.com" && !host.endsWith(".instagram.com")) {
      return null;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return null;
    // Deliberately NOT decodeURIComponent'd: it throws on malformed input
    // ("%zz") and this runs inside the calendar's render path. A real handle
    // never needs decoding, and anything percent-encoded fails the gate below.
    handle = segments[0];
  } else {
    handle = first.replace(/^@/, "");
  }

  // Final gate: only ever build a URL from a whitelisted handle, and require
  // at least one letter/digit so "..." can't become a link to nowhere.
  if (!IG_HANDLE.test(handle) || !/[A-Za-z0-9]/.test(handle)) return null;
  return `https://www.instagram.com/${handle}/`;
}

export function isDjEvent(ev: { id: string }): boolean {
  return typeof ev.id === "string" && ev.id.startsWith(DJ_EVENT_PREFIX);
}

// Stable per-night key (date + slot). Also the override-table key.
// NOTE: the key is date+slot only — the public feed exposes no per-booking id.
// So a category override is tied to a date/slot, not to a specific booking: if
// the team hub reschedules a night (date/slot changes) or books a different DJ
// into the same date/slot, the override no longer follows it (it resets to the
// default "DJ Night" and would need setting again). Acceptable + documented.
export function djEventKey(date: string, slot?: string | null): string {
  return `${DJ_EVENT_PREFIX}${date}-${slot || "main"}`;
}

// Founder-set category overrides (dj_night_overrides). anon may read them
// (RLS), so the public calendar reflects changes made in /admin. Scoped to the
// given keys so the query never grows with the table (and is skipped entirely
// when no DJ nights are in range).
async function loadCategoryOverrides(
  keys: string[],
): Promise<Record<string, string>> {
  if (!keys.length) return {};
  try {
    const { data, error } = await supabase()
      .from("dj_night_overrides")
      .select("event_key, subcategory")
      .in("event_key", keys);
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

  const inRange = nights.filter(
    (n) =>
      n &&
      typeof n.date === "string" &&
      n.date >= fromIso &&
      n.date <= toIso,
  );
  if (inRange.length === 0) return [];

  const keys = inRange.map((n) => djEventKey(n.date as string, n.slot));
  const overrides = await loadCategoryOverrides(keys);

  return inRange.map((n) => {
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
        // Tapping a DJ card opens that DJ's Instagram. The feed already
        // carries the handle for nearly every night; before this it was
        // thrown away, so every DJ card on /events was a dead, non-clickable
        // div. instagramUrl() sanitises it (see above) and returns null for
        // the odd night with no handle — those cards stay non-clickable,
        // which is exactly the founder's rule: a link only where a URL
        // genuinely exists, never an invented destination.
        link_url: instagramUrl(n.instagram),
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
