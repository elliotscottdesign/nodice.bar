"use client";

import { useEffect, useState } from "react";
import PageHero from "@/components/PageHero";
import { useContent } from "@/lib/content";
import { loadCalendarDeals, type CalendarDeal } from "@/lib/db/dealsCalendar";

// Today as 0 = Mon … 6 = Sun, to highlight the deal that's on right now.
const TODAY_WD = (new Date().getDay() + 6) % 7;

// /deals — fed straight from the events calendar (founder 29 Oct 2026). The
// founder adds/edits deals in ONE place (the admin calendar, tagged DEAL) and
// this page reflects them automatically: one card per day deal, Mon→Sun, plus
// the everyday Happy Hour featured on top. No manual image uploads any more.

// Split a deal description into its individual lines so a listing like
// "PINT £5 / WINE £5 / SGL £5" renders as tidy rows. Handles new-lines,
// slashes and bullet separators.
function dealLines(desc: string): string[] {
  return desc
    .split(/\n|·|•|\s\/\s/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function DealsPage() {
  const eyebrow = useContent("deals.eyebrow", "What's on this week");
  const title = useContent("deals.title", "Deals");
  const intro = useContent(
    "deals.intro",
    "A deal for every day of the week, plus Happy Hour. Straight from the calendar — always current.",
  );

  const [dayDeals, setDayDeals] = useState<CalendarDeal[]>([]);
  const [happyHour, setHappyHour] = useState<CalendarDeal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    loadCalendarDeals()
      .then((d) => {
        if (!alive) return;
        setDayDeals(d.dayDeals);
        setHappyHour(d.happyHour);
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
        eyebrowKey="deals.eyebrow"
        titleKey="deals.title"
        introKey="deals.intro"
        sliderKey="hero.deals"
      />

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          {loading ? (
            <p className="py-16 text-center text-sm text-cream/55">
              Loading this week's deals…
            </p>
          ) : (
            <>
              {/* Happy Hour — featured wide card with the drinks listing */}
              {happyHour && (
                <div className="mb-6 overflow-hidden rounded-3xl border border-plonkPink/40 bg-plonkPink/10">
                  <div className="flex flex-col gap-6 p-7 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
                        Every day
                      </p>
                      <h2 className="mt-2 font-display text-4xl uppercase tracking-wide text-cream sm:text-5xl">
                        {happyHour.name}
                      </h2>
                    </div>
                    <ul className="flex flex-wrap gap-2 sm:justify-end">
                      {dealLines(happyHour.description).map((line) => (
                        <li
                          key={line}
                          className="rounded-full border border-plonkPink/40 bg-ink/40 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-cream"
                        >
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* One card per day deal, Mon→Sun */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {dayDeals.map((d) => {
                  const isToday = d.weekday === TODAY_WD;
                  return (
                  <div
                    key={d.id}
                    className={`flex flex-col rounded-2xl border p-6 transition ${
                      isToday
                        ? "border-plonkPink/60 bg-plonkPink/10 ring-1 ring-plonkPink/40"
                        : "border-cream/12 bg-ink/40 hover:border-plonkPink/50"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
                      {d.dayLabel}
                      {isToday && (
                        <span className="rounded-full bg-plonkPink px-2 py-0.5 text-[9px] tracking-[0.2em] text-white">
                          Today
                        </span>
                      )}
                    </span>
                    <h3 className="mt-2 font-display text-2xl uppercase leading-tight tracking-wide text-cream">
                      {d.name}
                    </h3>
                    {d.description && (
                      <p className="mt-3 text-sm leading-relaxed text-cream/70">
                        {d.description}
                      </p>
                    )}
                  </div>
                  );
                })}
              </div>

              {dayDeals.length === 0 && !happyHour && (
                <p className="py-16 text-center text-sm text-cream/55">
                  No deals on the calendar right now — check back soon.
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
