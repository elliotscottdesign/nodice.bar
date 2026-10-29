"use client";

import { supabase } from "@/lib/supabase";

// The public /deals page is fed straight from the events calendar — the founder
// keeps the deals in ONE place (the admin calendar) and the page reflects them
// automatically (founder 29 Oct 2026). A "deal" is any events row tagged
// drink_special. There are two kinds:
//   • day deals  — one recurring deal per weekday (Happy Mondays, Fun of the
//                  Fare, Snackbar Spesh, Martini & Fries, Hackney Fun Club,
//                  Beat the Bar …). We show ONE card per deal, on its day.
//   • happy hour — the everyday HAPPY HOUR drinks list (Pint £5, Wine £5 …).
//                  Shown as its own highlighted card.

export type CalendarDeal = {
  id: string;
  name: string;
  description: string;
  weekday: number; // 0 = Mon … 6 = Sun
  dayLabel: string; // MON / TUE …
  posterUrl: string;
  isHappyHour: boolean;
};

const WD_SHORT = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

// JS getUTCDay(): 0 = Sun … 6 = Sat. We want 0 = Mon … 6 = Sun.
function mondayIndex(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return (d + 6) % 7;
}

function isHappyHour(name: string): boolean {
  return name.trim().toUpperCase() === "HAPPY HOUR";
}

// Returns the week's deals: the day deals sorted Mon→Sun, with the everyday
// Happy Hour pulled out separately so the page can feature it.
export async function loadCalendarDeals(): Promise<{
  dayDeals: CalendarDeal[];
  happyHour: CalendarDeal | null;
}> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase()
    .from("events")
    .select("id, name, description, poster_url, event_date")
    .eq("category", "drink_special")
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .limit(200);
  if (error) throw error;

  // One card per deal NAME — the soonest upcoming instance of each. A weekly
  // series shows many future dates; we only want the deal once.
  const seen = new Map<string, CalendarDeal>();
  for (const r of (data ?? []) as {
    id: string;
    name: string;
    description: string | null;
    poster_url: string | null;
    event_date: string;
  }[]) {
    const key = r.name.trim().toUpperCase();
    if (seen.has(key)) continue;
    const wd = mondayIndex(r.event_date);
    seen.set(key, {
      id: r.id,
      name: r.name,
      description: r.description ?? "",
      weekday: wd,
      dayLabel: WD_SHORT[wd],
      posterUrl: r.poster_url ?? "",
      isHappyHour: isHappyHour(r.name),
    });
  }

  const all = [...seen.values()];
  const happyHour = all.find((d) => d.isHappyHour) ?? null;
  const dayDeals = all
    .filter((d) => !d.isHappyHour)
    .sort((a, b) => a.weekday - b.weekday);
  return { dayDeals, happyHour };
}
