import type { Metadata } from "next";

// Private wedding page — Kevin & Tara, 29 August 2026.
// Unlisted (noindex, not in sitemap, no in-site nav link). Founder
// shares the URL with the couple + guests + floor staff. Everything
// on the page is a static snapshot of the timeline the founder read
// out on 2026-07-02; edit here to change anything.
export const metadata: Metadata = {
  title: "Kevin & Tara · 29 August 2026 — No Dice",
  description:
    "Kevin & Tara's wedding evening at No Dice, Hackney — 29 August 2026, from 6pm.",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

const PALETTE = {
  section: "px-6 py-16 sm:py-20",
  container: "mx-auto max-w-3xl",
  eyebrow:
    "text-xs font-bold uppercase tracking-[0.3em] text-plonkYellow",
  h2: "font-display text-4xl leading-tight text-cream sm:text-5xl",
  body: "text-base leading-relaxed text-cream/80 sm:text-lg",
  divider:
    "mx-auto my-16 h-px w-24 bg-gradient-to-r from-transparent via-cream/40 to-transparent",
};

function TimeStop({
  time,
  title,
  children,
}: {
  time: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 border-l border-cream/15 pl-6 sm:grid-cols-[6rem_1fr] sm:gap-8 sm:border-none sm:pl-0">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
          {time}
        </p>
      </div>
      <div>
        <h3 className="font-display text-2xl leading-tight text-cream sm:text-3xl">
          {title}
        </h3>
        <div className="mt-3 space-y-2 text-base leading-relaxed text-cream/80">
          {children}
        </div>
      </div>
    </div>
  );
}

function MenuItem({
  name,
  detail,
}: {
  name: string;
  detail?: string;
}) {
  return (
    <div>
      <p className="font-display text-xl text-cream sm:text-2xl">{name}</p>
      {detail && (
        <p className="mt-1 text-sm text-cream/70 sm:text-base">{detail}</p>
      )}
    </div>
  );
}

export default function KevinAndTaraWeddingPage() {
  return (
    <main className="min-h-screen bg-ink text-cream">
      {/* ────────────────────────────────────────────────────────
          HERO
          ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-forest px-6 pb-24 pt-24 text-center sm:pt-32">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-plonkYellow">
            Saturday · 29 August 2026 · No Dice, Hackney
          </p>
          <h1 className="mt-6 font-display text-6xl leading-[1.05] text-cream sm:text-7xl md:text-8xl">
            Kevin
            <span className="italic text-plonkYellow"> &amp; </span>
            Tara
          </h1>
          <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-cream/85 sm:text-xl">
            A private evening at the arches — bubbles, oysters, tacos, decks,
            cake, and more of the same until late. Sixty of your favourite
            people, all in the same room, dancing.
          </p>
          <p className="mt-6 text-sm uppercase tracking-[0.28em] text-cream/60">
            Doors 6pm · Private party from arrival
          </p>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
          THE EVENING
          ──────────────────────────────────────────────────────── */}
      <section className={PALETTE.section}>
        <div className={PALETTE.container}>
          <p className={PALETTE.eyebrow}>The Evening</p>
          <h2 className={`${PALETTE.h2} mt-3`}>How the night runs</h2>
          <p className={`${PALETTE.body} mt-5`}>
            The timeline below is what the No Dice floor team is working
            towards. Everything is served — no one's queuing for food. Music
            runs across two DJs; the whole space is yours from 6pm.
          </p>

          <div className="mt-14 space-y-14">
            <TimeStop time="6:00 pm" title="Bubbles &amp; Oysters">
              <p>
                Guests welcomed at the door with a glass of sparkling — Prosecco
                or English fizz, poured on arrival. Passed around by the floor
                team so nobody's stuck queueing at the bar for a first drink.
              </p>
              <p>
                <strong className="text-cream">120 Maldon oysters</strong>,
                shucked live by Joe. Two per guest, served on trays with two
                dressings on the side — an apple &amp; dill vinaigrette (bright
                and grassy) and a classic lemon &amp; Tabasco mignonette. On the
                same round, small plates of <em>gildas</em> (anchovy, guindilla,
                Manzanilla olive on a skewer) for the "one more bite" moment.
              </p>
            </TimeStop>

            <TimeStop time="6:00 pm" title="Charlie on the decks">
              <p>
                Warm-up set. 80s disco, big pop, easy-listening bangers.
                Everyone-can-sing-along music while the room fills up and the
                bubbles do their thing.
              </p>
            </TimeStop>

            <TimeStop time="6:45 pm" title="Build-your-own tacos">
              <p>
                Central taco station opens. Everything is gluten-free, nut-free,
                and sesame-free — no allergen dance for anyone.
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-cream/80">
                <li>
                  <strong className="text-cream">Smoked brisket</strong>{" "}
                  <em className="text-cream/60">— slow-cooked at Smoky Lokos,
                  Spitalfields, delivered ready to serve.</em>
                </li>
                <li>
                  <strong className="text-cream">Smoked chicken</strong>{" "}
                  <em className="text-cream/60">— same shop, same treatment,
                  pulled and warm.</em>
                </li>
                <li>
                  <strong className="text-cream">Vegan / veggie option</strong>{" "}
                  <em className="text-cream/60">— from the Fabián's-birthday
                  menu we ran last summer. Same crowd-favourite spread.</em>
                </li>
              </ul>
              <p>
                On the side: charred padrón peppers, potato salad, and a plate
                of Josie's spring rolls (veggie). The station stays out — pick
                back up whenever.
              </p>
            </TimeStop>

            <TimeStop time="7:45 pm" title="Josh on the decks">
              <p>
                Room-goes-up shift change. Josh takes over and pushes the
                energy up — dancing officially begins.
              </p>
            </TimeStop>

            <TimeStop time="10:00 pm" title="Wedding cake">
              <p>
                Cake moment. Cut and served by the couple. Cake stand set up
                near the DJ booth; floor team clears and hands out portions
                once the ceremony bit is done.
              </p>
            </TimeStop>

            <TimeStop time="12:00 am" title="Late bites">
              <p>
                Trays of simple, please-god-more-food handhelds circulate for
                the last stretch:
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-cream/80">
                <li>Ham &amp; cheese toasties</li>
                <li>Veggie toasties</li>
              </ul>
              <p>Cold water refills go out at the same time.</p>
            </TimeStop>
          </div>
        </div>
      </section>

      <div className={PALETTE.divider} />

      {/* ────────────────────────────────────────────────────────
          BAR — SIGNATURE DRINKS
          ──────────────────────────────────────────────────────── */}
      <section className={PALETTE.section}>
        <div className={PALETTE.container}>
          <p className={PALETTE.eyebrow}>Signature Bar</p>
          <h2 className={`${PALETTE.h2} mt-3`}>
            Two drinks for the room, all night
          </h2>
          <p className={`${PALETTE.body} mt-5`}>
            The full No Dice bar is open for anyone who wants a bespoke drink,
            but two easy-serve signatures are pre-batched and ready to pour so
            nobody's waiting. One boozy, one soft — both proper.
          </p>

          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            <div className="rounded-2xl border border-cream/10 bg-ink/40 p-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
                Boozy · house pour
              </p>
              <h3 className="mt-3 font-display text-3xl leading-tight text-cream">
                Kevin &amp; Tara Punch
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-cream/80">
                Aged rum + amaro, pressed lemon, honey, a touch of oloroso and
                a strong hit of ripe stone fruit. Batched cold and served in
                jugs with a slab of ice, mint sprig on top. Whiskey version on
                request — same shape, bourbon in place of rum.
              </p>
            </div>

            <div className="rounded-2xl border border-cream/10 bg-ink/40 p-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-plonkTeal">
                Non-alcoholic · house pour
              </p>
              <h3 className="mt-3 font-display text-3xl leading-tight text-cream">
                Garden Mint Iced Tea
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-cream/80">
                Cold-brewed jasmine + green tea, muddled fresh mint, lemon,
                a whisper of honey. Served long over crushed ice with cucumber.
                As good as the punch — no compromise.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className={PALETTE.divider} />

      {/* ────────────────────────────────────────────────────────
          THE ROOM
          ──────────────────────────────────────────────────────── */}
      <section className={PALETTE.section}>
        <div className={PALETTE.container}>
          <p className={PALETTE.eyebrow}>Logistics</p>
          <h2 className={`${PALETTE.h2} mt-3`}>The room</h2>

          <dl className="mt-12 grid gap-6 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.28em] text-cream/55">
                Where
              </dt>
              <dd className="mt-2 text-cream">
                No Dice
                <br />
                Arch 407, Mentmore Terrace
                <br />
                London Fields, Hackney
                <br />
                E8 3PH
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.28em] text-cream/55">
                When
              </dt>
              <dd className="mt-2 text-cream">
                Saturday 29 August 2026
                <br />
                6pm — late
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.28em] text-cream/55">
                Room
              </dt>
              <dd className="mt-2 text-cream">
                Whole venue, private hire.
                <br />
                Approx. 60 guests. Adults only.
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.28em] text-cream/55">
                Getting there
              </dt>
              <dd className="mt-2 text-cream">
                Two minutes from London Fields station.
                <br />
                Under the arches behind the park.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
          FOOTER — small, warm
          ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-cream/10 px-6 py-12 text-center">
        <p className="font-display text-2xl italic text-plonkYellow">
          Congratulations, Kevin &amp; Tara.
        </p>
        <p className="mt-2 text-xs uppercase tracking-[0.28em] text-cream/50">
          No Dice · Hackney · 2026
        </p>
      </footer>
    </main>
  );
}
