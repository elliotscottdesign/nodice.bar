"use client";

// =============================================================
// openDecks — public DJ sign-up for FREE 1-hour open-decks slots
// =============================================================
// Open-decks nights (Sun/Tue/Wed by default) are managed in the No
// Dice TEAM hub. This public page reads the calendar of free dates +
// slots and submits a sign-up through the hub's `open-decks` edge
// function (cross-origin, no auth — same pattern as the DJ nights
// feed). The hub closes a date automatically once a DJ night is
// booked on it, and blocks a slot once someone's signed up for it.
// =============================================================

const FN =
  "https://rntcujcpsozvuxvmlejv.supabase.co/functions/v1/open-decks";

export type OpenDeckSlot = { start: string; label: string; taken: boolean };
export type OpenDeckDate = {
  date: string;
  weekday: string;
  closed: boolean;
  full: boolean;
  slots: OpenDeckSlot[];
};
export type OpenDecksCalendar = {
  start: string;
  days: number[];
  slots: { start: string; label: string }[];
  dates: OpenDeckDate[];
};

export async function loadOpenDecksCalendar(): Promise<OpenDecksCalendar> {
  const res = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "calendar" }),
  });
  if (!res.ok) throw new Error("Couldn't load the open-decks calendar.");
  return res.json();
}

export type OpenDeckSignup = {
  date: string;
  slot: string;
  name: string;
  phone: string;
  email: string;
  genres: string[];
  format: "cdj" | "vinyl";
  instagram?: string;
};

export async function submitOpenDeckSignup(
  s: OpenDeckSignup
): Promise<{ ok: true }> {
  const res = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "signup", ...s }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error)
    throw new Error(data?.error || "Sorry — that didn't go through. Try again.");
  return { ok: true };
}
