import Image from "next/image";

export default function EventsScroller({
  heading = "Events at No Dice",
  intro,
  posters,
  tint = "tint-plum-island-ember",
}: {
  heading?: string;
  intro?: string;
  posters: { src: string; alt: string; href?: string }[];
  tint?: string;
}) {
  if (posters.length === 0) return null;

  return (
    <section className={tint}>
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center font-display text-3xl sm:text-4xl">
          {heading}
        </h2>
        {intro && (
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-cream/75">
            {intro}
          </p>
        )}

        {/* Side-scroller — posters snap to start as you swipe */}
        <div
          className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-4 sm:gap-5"
          style={{ scrollPaddingLeft: "0.25rem" }}
          aria-label={heading}
        >
          {posters.map((p) => {
            const inner = (
              <article className="group relative aspect-[5/7] w-[70vw] shrink-0 snap-start overflow-hidden rounded-2xl border border-cream/10 bg-black/20 sm:w-[42vw] md:w-[28vw] lg:w-[23%]">
                <Image
                  src={p.src}
                  alt={p.alt}
                  fill
                  sizes="(min-width: 1024px) 22vw, (min-width: 768px) 26vw, (min-width: 640px) 40vw, 70vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
              </article>
            );
            if (p.href) {
              return (
                <a
                  key={p.src}
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-plonkYellow/60"
                >
                  {inner}
                </a>
              );
            }
            return <div key={p.src}>{inner}</div>;
          })}
        </div>

        {/* Swipe hint on mobile */}
        <p className="mt-4 text-center text-xs uppercase tracking-eyebrow text-cream/40 md:hidden">
          ← Swipe →
        </p>
      </div>
    </section>
  );
}
