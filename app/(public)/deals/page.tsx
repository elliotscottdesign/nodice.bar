"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import PageHero from "@/components/PageHero";
import { useContent } from "@/lib/content";
import { loadCalendarDeals, type CalendarDeal } from "@/lib/db/dealsCalendar";

// /deals — a 4×2 grid of deal POSTERS, pulled straight from the events calendar
// (founder 29 Oct 2026). The founder makes each deal's poster in the admin
// calendar (tagged DEAL); this page shows those posters automatically, up to 8.
// No manual uploads.

export default function DealsPage() {
  const eyebrow = useContent("deals.eyebrow", "What's on this week");
  const title = useContent("deals.title", "Deals");
  const intro = useContent(
    "deals.intro",
    "A deal for every day of the week. Straight from the calendar — always current.",
  );

  const [deals, setDeals] = useState<CalendarDeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    loadCalendarDeals()
      .then(({ dayDeals, happyHour }) => {
        if (!alive) return;
        // Happy Hour leads, then the day deals Mon→Sun. Only deals that have a
        // poster show (the grid is poster-led); first 8 fill the 4×2.
        const ordered = [...(happyHour ? [happyHour] : []), ...dayDeals]
          .filter((d) => d.posterUrl)
          .slice(0, 8);
        setDeals(ordered);
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
        <div className="mx-auto max-w-6xl">
          {loading ? (
            <p className="py-16 text-center text-sm text-cream/55">
              Loading this week's deals…
            </p>
          ) : deals.length === 0 ? (
            <p className="py-16 text-center text-sm text-cream/55">
              No deal posters on the calendar yet — check back soon.
            </p>
          ) : (
            // 4 across on tablet+ (→ 4×2 for 8 deals), 2 across on mobile.
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {deals.map((d) => (
                <div
                  key={d.id}
                  className="relative aspect-[5/7] overflow-hidden rounded-xl bg-ink"
                >
                  <Image
                    src={d.posterUrl}
                    alt={d.name}
                    fill
                    sizes="(min-width: 640px) 25vw, 50vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
