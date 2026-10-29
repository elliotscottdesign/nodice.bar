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

export type MenuItem = {
  name: string;
  desc: string;
  price: string;
  // A sub-heading row (e.g. "Draught") or a banner note — rendered without a
  // price, slightly set apart from priced items.
  note?: boolean;
  // A "house drink" — what's included when a deal says "a house drink" (founder
  // 29 Oct 2026). Marked with a 🏠 so people can see their deal options.
  house?: boolean;
};

// Which drinks count as "house" (deal-included). Founder's list: all draught
// pints, all wine + Prosecco, house single & mixer, draught cider, all softs
// and hot drinks.
function isHouseDrink(sectionId: string, mode: string, name: string): boolean {
  if (sectionId === "alcoholfree" || sectionId === "hotdrinks") return true;
  if (sectionId === "wine") return true;
  if (sectionId === "beers" && mode === "halfpint") return true; // draught pints
  if (sectionId === "cider" && /draught/i.test(name)) return true;
  if (/single\s*&?\s*(and)?\s*mix/i.test(name)) return true; // "single & mixer"
  return false;
}
export type MenuSection = { id: string; title: string; note: string; items: MenuItem[] };

function poundsFromPence(p: number | null | undefined): string {
  if (p == null) return "";
  const n = p / 100;
  return n % 1 === 0 ? `£${n}` : `£${n.toFixed(2)}`;
}
// Format a single price value off the menu. It can be a plain number ("7.5"),
// a word ("Varies"), or already a range ("4 / 7.5", "6/12"). £-prefix the
// numeric parts, leave words alone.
function fmtPrice(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  if (!t) return "";
  if (/[a-z]/i.test(t)) return t; // "Varies", "MKT" etc.
  if (t.includes("/")) {
    return t
      .split("/")
      .map((p) => {
        const v = p.trim();
        return v ? `£${v}` : v;
      })
      .join(" / ");
  }
  return t.startsWith("£") ? t : `£${t}`;
}
// A two-price row (half/pint, glass/bottle) → "½ £4 · pt £7.5".
function fmtPair(a: string, aLabel: string, b: string, bLabel: string): string {
  const parts: string[] = [];
  if (a) parts.push(`${aLabel} ${fmtPrice(a)}`);
  if (b) parts.push(`${bLabel} ${fmtPrice(b)}`);
  return parts.join(" · ");
}

// Flatten one drinks section's blocks into a flat item list. Blocks come in a
// few shapes: a direct priced item ({name,desc,price}); a "list" block with
// `rows` priced by its `mode` (single / halfpint / glassbottle), optionally
// under a `subhead`; or a "banner" note ({text}).
function flattenBlocks(sectionId: string, blocks: any[]): MenuItem[] {
  const items: MenuItem[] = [];
  for (const b of blocks ?? []) {
    if (!b) continue;
    if (b.type === "banner") {
      if (b.text) items.push({ name: b.text, desc: "", price: "", note: true });
      continue;
    }
    if (Array.isArray(b.rows)) {
      if (b.subhead) items.push({ name: b.subhead, desc: "", price: "", note: true });
      for (const r of b.rows) {
        if (!r || !r.name) continue;
        let price = "";
        if (b.mode === "halfpint") price = fmtPair(r.half, "½", r.pint, "pt");
        else if (b.mode === "glassbottle") price = fmtPair(r.glass, "gls", r.bottle, "btl");
        else price = fmtPrice(r.price);
        const name = r.name.trim();
        items.push({
          name,
          desc: r.desc ?? "",
          price,
          house: isHouseDrink(sectionId, b.mode, name),
        });
      }
      continue;
    }
    if (b.name)
      items.push({
        name: b.name,
        desc: b.desc ?? "",
        price: fmtPrice(b.price),
        house: isHouseDrink(sectionId, "", b.name),
      });
  }
  return items;
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
      const items = flattenBlocks(id, s.blocks ?? []);
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
