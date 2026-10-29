"use client";

import { loadCalendarDeals, type CalendarDeal } from "@/lib/db/dealsCalendar";

// The public /bar page renders the live A4 menu (founder 29 Oct 2026): the
// drinks come from the print lane's `drinks-menu` edge function (its public
// `get` action resolves till prices server-side — bar_menu_items stays locked),
// the food comes from the kitchen's `menu` edge function (`getMenu`), and the
// day's deal + Happy Hour come from the events calendar. Everything is live, so
// a price change on the till or a new deal on the calendar shows here with no
// upload and no "publish" step.

const SUPA = "https://rntcujcpsozvuxvmlejv.supabase.co";

export type MenuItem = { name: string; desc: string; price: string };
export type MenuSection = { id: string; title: string; note: string; items: MenuItem[] };

function poundsFromPence(p: number | null | undefined): string {
  if (p == null) return "";
  const n = p / 100;
  return n % 1 === 0 ? `£${n}` : `£${n.toFixed(2)}`;
}
function poundsFromStr(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  if (!t) return "";
  return t.startsWith("£") ? t : `£${t}`;
}

async function callFn(fn: string, body: unknown): Promise<any> {
  // Public actions only — send just Content-Type. The functions are deployed
  // --no-verify-jwt, and adding an `apikey` header trips drinks-menu's CORS
  // preflight (its allow-list doesn't include it). Matches the On A Roll
  // client's own unauthenticated calls.
  const r = await fetch(`${SUPA}/functions/v1/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

// Pretty section name from an id like "alcoholfree" → "Alcohol Free".
function prettyId(id: string): string {
  return id
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export type BarMenu = {
  drinks: MenuSection[]; // in A4 reading order
  food: MenuSection[];
  todayDeal: CalendarDeal | null;
  happyHour: CalendarDeal | null;
};

export async function loadBarMenu(): Promise<BarMenu> {
  const todayWd = (new Date().getDay() + 6) % 7;

  const [drinksRes, foodRes, deals] = await Promise.all([
    callFn("drinks-menu", { action: "get", slug: "drinks" }).catch(() => null),
    callFn("menu", { action: "getMenu" }).catch(() => null),
    loadCalendarDeals().catch(() => ({ dayDeals: [], happyHour: null })),
  ]);

  // ----- Drinks: the `extra` sections, ordered by the A4 column layout -----
  const drinks: MenuSection[] = [];
  const data = drinksRes?.data;
  if (data?.extra) {
    const byId = new Map<string, any>();
    for (const s of data.extra as any[]) byId.set(s.id, s);
    // a4.cols is [[col1 ids], [col2 ids], …] — the sections that make up the
    // actual drinks menu, in reading order. Only these render; the zine's
    // extra pages (deal cover, "how to order", one-off deal sections) are left
    // out so the bar menu stays the drinks list.
    const order: string[] = [];
    for (const col of (data.a4?.cols ?? []) as string[][]) order.push(...col);
    for (const id of order) {
      const s = byId.get(id);
      if (!s) continue;
      const items: MenuItem[] = (s.blocks ?? [])
        .filter((b: any) => b && b.name)
        .map((b: any) => ({
          name: b.name,
          desc: b.desc ?? "",
          price: poundsFromStr(b.price),
        }));
      // Drop a section that would render as a bare heading (no items, no note).
      if (items.length === 0 && !s.deal) continue;
      drinks.push({
        id,
        title: s.title || prettyId(id),
        note: s.deal || "",
        items,
      });
    }
  }

  // ----- Food: the kitchen sections, archived items dropped -----
  const food: MenuSection[] = [];
  for (const s of (foodRes?.sections ?? []) as any[]) {
    const items: MenuItem[] = (s.items ?? [])
      .filter((i: any) => i && !i.archived && i.name)
      .map((i: any) => ({
        name: i.name,
        desc: i.desc ?? "",
        price: poundsFromPence(i.sell_pence),
      }));
    if (items.length === 0) continue;
    food.push({ id: s.id, title: s.name || prettyId(s.id), note: "", items });
  }

  const todayDeal =
    deals.dayDeals.find((d) => d.weekday === todayWd) ?? null;

  return { drinks, food, todayDeal, happyHour: deals.happyHour };
}
