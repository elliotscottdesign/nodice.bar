"use client";

import { useEffect, useState } from "react";
import { loadBarMenu, type MenuSection } from "@/lib/db/barMenu";

// DrinksMenuPanel — the live drinks menu (same source as the /bar page), shown
// as the "Drink menu" sub-tab in Private hire (founder 29 Oct 2026) next to the
// Xmas menu. Prices come live off the till, so it never goes stale. Happy Hour
// rides on top as a quick listing.

const MENU_YELLOW = "#E8C547";

export default function DrinksMenuPanel() {
  const [drinks, setDrinks] = useState<MenuSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    loadBarMenu()
      .then((m) => {
        if (!alive) return;
        setDrinks(m.drinks);
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <p className="py-16 text-center text-sm text-cream/55">Loading the drinks…</p>
    );
  }
  if (drinks.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-cream/55">
        Menu&apos;s having a moment — try again in a sec.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-7 text-sm text-cream/60">
        🏠 House drink — what&apos;s included when a deal says &ldquo;a house
        drink&rdquo;.
      </p>
      <div className="gap-x-10 sm:columns-2 lg:columns-3 [&>*]:mb-8 [&>*]:break-inside-avoid">
        {drinks.map((s) => (
          <div key={s.id}>
            <h3
              className="font-display text-xl uppercase tracking-wide"
              style={{ color: MENU_YELLOW }}
            >
              {s.title}
            </h3>
            {s.note && (
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-cream/55">
                {s.note}
              </p>
            )}
            <ul className="mt-3 space-y-3">
              {s.items.map((it, i) =>
                it.note ? (
                  <li
                    key={`${it.name}-${i}`}
                    className="pt-1 text-[11px] font-bold uppercase tracking-wider text-cream/50"
                  >
                    {it.name}
                  </li>
                ) : (
                  <li key={`${it.name}-${i}`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold text-cream">
                        {it.name}
                        {it.house && (
                          <span title="House drink — included in deals"> 🏠</span>
                        )}
                      </span>
                      {it.price && (
                        <span className="shrink-0 font-semibold tabular-nums text-cream/85">
                          {it.price}
                        </span>
                      )}
                    </div>
                    {it.desc && (
                      <p className="mt-0.5 text-xs leading-snug text-cream/55">
                        {it.desc}
                      </p>
                    )}
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
