"use client";

import { useEffect, useState } from "react";
import PageHero from "@/components/PageHero";
import { useContent } from "@/lib/content";
import { loadBarMenu, type BarMenu, type MenuSection } from "@/lib/db/barMenu";

// /bar — the LIVE A4 menu (founder 29 Oct 2026). Nothing is uploaded any more:
// the drinks come from the till (via the public drinks-menu feed), the food
// from the kitchen menu, and the day's deal + Happy Hour from the calendar, so
// a price change or a new deal shows here automatically. Laid out like the A4
// sheet — sections flow into columns on desktop, stack on a phone — with the
// house yellow on every section header.

// The "same yellow as the header" the founder means — the warm No Dice gold.
const MENU_YELLOW = "#E8C547";

export default function BarPage() {
  const eyebrow = useContent("bar.eyebrow", "Drinks · Cocktails · Pints");
  const title = useContent("bar.title", "The Bar");
  const intro = useContent(
    "bar.intro",
    "Cask + craft on rotation, classic cocktails poured properly, low-intervention wines and soft drinks done right.",
  );

  const [menu, setMenu] = useState<BarMenu | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    loadBarMenu()
      .then((m) => {
        if (!alive) return;
        setMenu(m);
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main>
      <PageHero
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        image={[""]}
        eyebrowKey="bar.eyebrow"
        titleKey="bar.title"
        introKey="bar.intro"
        sliderKey="hero.bar"
      />

      <section className="px-6 pb-20 pt-14">
        <div className="mx-auto max-w-5xl">
          {loading ? (
            <p className="py-16 text-center text-sm text-cream/55">
              Loading the menu…
            </p>
          ) : !menu ? (
            <p className="py-16 text-center text-sm text-cream/55">
              Menu's having a moment — try again in a sec.
            </p>
          ) : (
            <>
              {/* Today's deal + Happy Hour — the moving parts, up top */}
              <DealStrip deal={menu.todayDeal} />

              {/* DRINKS — flows into columns like the A4 sheet */}
              {menu.drinks.length > 0 && (
                <>
                  <MenuHeading>Drinks</MenuHeading>
                  <p className="-mt-4 mb-7 text-sm text-cream/60">
                    🏠 House drink — what&apos;s included when a deal says &ldquo;a
                    house drink&rdquo;.
                  </p>
                  <div className="gap-x-10 sm:columns-2 lg:columns-3 [&>*]:mb-8 [&>*]:break-inside-avoid">
                    {menu.drinks.map((s) => (
                      <SectionBlock key={s.id} section={s} />
                    ))}
                  </div>
                </>
              )}

              {/* FOOD — the A4 has the room, so the kitchen menu rides along */}
              {menu.food.length > 0 && (
                <>
                  <MenuHeading>Kitchen · On A Roll</MenuHeading>
                  <div className="gap-x-10 sm:columns-2 [&>*]:mb-8 [&>*]:break-inside-avoid">
                    {menu.food.map((s) => (
                      <SectionBlock key={s.id} section={s} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

// A big yellow band that separates Drinks from Food.
function MenuHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mb-7 mt-4 border-b-2 pb-2 font-display text-3xl uppercase tracking-wider"
      style={{ color: MENU_YELLOW, borderColor: MENU_YELLOW }}
    >
      {children}
    </h2>
  );
}

function DealStrip({
  deal,
}: {
  deal: { name: string; description: string } | null;
}) {
  if (!deal) return null;
  return (
    <div className="mb-10">
      <div
        className="rounded-2xl border bg-ink/40 p-5 sm:max-w-md"
        style={{ borderColor: `${MENU_YELLOW}66` }}
      >
        <p
          className="text-xs font-bold uppercase tracking-[0.3em]"
          style={{ color: MENU_YELLOW }}
        >
          Today's deal
        </p>
        <h3 className="mt-1 font-display text-2xl uppercase tracking-wide text-cream">
          {deal.name}
        </h3>
        {deal.description && (
          <p className="mt-2 text-sm leading-relaxed text-cream/70">
            {deal.description}
          </p>
        )}
      </div>
    </div>
  );
}

// One menu section: a yellow title, an optional deal note, then its items.
function SectionBlock({ section }: { section: MenuSection }) {
  return (
    <div>
      <h3
        className="font-display text-xl uppercase tracking-wide"
        style={{ color: MENU_YELLOW }}
      >
        {section.title}
      </h3>
      {section.note && (
        <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-cream/55">
          {section.note}
        </p>
      )}
      <ul className="mt-3 space-y-3">
        {section.items.map((it, i) =>
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
  );
}
