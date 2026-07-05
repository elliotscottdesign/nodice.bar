import type { Metadata } from "next";

// Private wedding page — Kevin & Tara, 29 August 2026.
// Unlisted (noindex, not in sitemap, no in-site nav link). Founder
// shares the URL with the couple + guests + floor staff. Everything
// on the page is a static snapshot; edit here to change anything.
//
// Palette: mid-sage green base with cream + antique-gold (plonkYellow)
// accents. Warm and romantic — closer to a wedding-invite feel than
// the sharper cocktail-bar palette used elsewhere on the site.
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

// ─── shared styles ────────────────────────────────────────────
// Everything hangs off one warm-sage palette so the sections read
// as one romantic surface, not a stack of unrelated cards.
//
// Phone-first sizing: eyebrow letter-spacing eases from 0.28em on
// small screens to 0.38em on sm+ so labels don't stretch off the
// edge on a 320px iPhone SE.
const BG_SECTION = "bg-[#2f3f2a] text-cream";
const BG_PANEL = "bg-[#243128]/70 border border-[#c6a664]/25";
const eyebrow =
  "text-[11px] font-bold uppercase tracking-[0.28em] text-[#e6c98a] sm:tracking-[0.38em]";
const gold = "text-[#e6c98a]";

function OrnDivider() {
  // Antique-gold hairline with a filled diamond at its centre —
  // acts as an elegant course-break rather than a hard section rule.
  return (
    <div className="my-14 flex items-center justify-center gap-3">
      <span className="h-px w-16 bg-gradient-to-r from-transparent to-[#c6a664]/70 sm:w-24" />
      <span className="h-1.5 w-1.5 rotate-45 bg-[#c6a664]" />
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-[#c6a664]/70 sm:w-24" />
    </div>
  );
}

function TimeStop({
  time,
  title,
  children,
}: {
  time: string;
  title: string;
  children: React.ReactNode;
}) {
  // Phone: a slim gold rail on the left with the time badge nudged
  // slightly forward; content sits close to the rail. Desktop: time
  // moves to a fixed right-aligned column and the rail vanishes.
  return (
    <div className="grid gap-2 border-l border-[#c6a664]/30 pl-5 sm:grid-cols-[7rem_1fr] sm:gap-10 sm:border-none sm:pl-0">
      <div className="sm:text-right">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#e6c98a] sm:text-[11px] sm:tracking-[0.32em]">
          {time}
        </p>
      </div>
      <div>
        <h3 className="mt-1 font-display text-[1.6rem] leading-tight text-cream sm:mt-0 sm:text-[2rem]">
          {title}
        </h3>
        <div className="mt-3 space-y-3 text-[0.95rem] leading-relaxed text-cream/85 sm:text-[0.98rem]">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function KevinAndTaraWeddingPage() {
  return (
    <main className={`min-h-screen ${BG_SECTION}`}>
      {/* ────────────────────────────────────────────────────────
          HERO — deep-green gradient stand-in for the park view. The
          real venue photos on the live site are all illustrations, so
          rather than reference a broken path, layered gradients here
          suggest greenery + gold light at dusk. Founder can drop in
          a real park photo later (swap the two gradients for an <img
          className="absolute inset-0 h-full w-full object-cover" /> +
          overlay).
          ──────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-[#1e2b1c]">
        <div className="absolute inset-0 bg-gradient-to-b from-[#131c11] via-[#2f3f2a] to-[#2f3f2a]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(230,201,138,0.18),_transparent_65%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(94,140,73,0.28),_transparent_60%)]" />

        <div className="relative px-5 pb-24 pt-24 text-center sm:px-6 sm:pb-36 sm:pt-40">
          <div className="mx-auto max-w-3xl">
            <p className={eyebrow}>
              Saturday · 29 August 2026
            </p>
            <h1 className="mt-6 font-display text-[3rem] leading-[0.95] text-cream sm:mt-8 sm:text-[6rem] md:text-[7rem]">
              Kevin
              <span className={`my-1 block font-display italic ${gold} sm:my-2`}>
                &amp;
              </span>
              Tara
            </h1>
            <p className="mx-auto mt-8 max-w-xl font-display text-lg italic leading-snug text-cream/90 sm:mt-10 sm:text-2xl">
              An evening at the arches — under the vines, over London Fields.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.24em] text-cream/70 sm:mt-10 sm:gap-x-6 sm:text-[11px] sm:tracking-[0.32em]">
              <span>Doors 6pm</span>
              <span className="text-[#c6a664]/60">•</span>
              <span>Whole venue, private</span>
              <span className="text-[#c6a664]/60">•</span>
              <span>Reception with park views</span>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
          THE EVENING
          ──────────────────────────────────────────────────────── */}
      <section className="px-5 py-16 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className={eyebrow}>The Evening</p>
          <h2 className="mt-4 font-display text-4xl leading-tight text-cream sm:text-5xl">
            <span className={`italic ${gold}`}>How</span> the night runs
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-[1.02rem] leading-relaxed text-cream/85 sm:text-lg">
            Everything is served to you — no queues, no scrambles. Two DJs
            across the evening. The whole space is yours from 6pm. Sixty of
            your favourite people, all in the same room, dancing.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-3xl space-y-14">
          <TimeStop time="6:00 pm" title="Bubbles & oysters">
            <p>
              Guests welcomed at the door with a glass of sparkling — Prosecco
              or English fizz, poured on arrival. Passed around by the floor
              team so nobody's stuck waiting at the bar for a first drink.
            </p>
            <p>
              <strong className="text-cream">120 Maldon oysters</strong> from
              <span className={gold}> Fin and Flounder</span>, our local
              fishmongers — shucked live by Joe. Two per guest, served on trays
              with two dressings on the side: an apple &amp; dill vinaigrette
              (bright and grassy) and a classic lemon &amp; Tabasco mignonette.
              On the same round, small plates of <em>gildas</em> (anchovy,
              guindilla, Manzanilla olive on a skewer) and{" "}
              <strong className="text-cream">Thai spring rolls</strong>{" "}
              (veggie) for the "one more bite" moment.
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
            <ul className="list-inside list-[square] space-y-1 marker:text-[#c6a664]">
              <li>
                <strong className="text-cream">Smoked brisket</strong>{" "}
                <em className="text-cream/60">
                  — slow-cooked at Smoky Lokos, Spitalfields, delivered ready
                  to serve.
                </em>
              </li>
              <li>
                <strong className="text-cream">Smoked chicken</strong>{" "}
                <em className="text-cream/60">
                  — same shop, same treatment, pulled and warm.
                </em>
              </li>
              <li>
                <strong className="text-cream">Vegan / veggie option</strong>{" "}
                <em className="text-cream/60">
                  — from the Fabián's-birthday menu we ran last summer. Same
                  crowd-favourite spread.
                </em>
              </li>
            </ul>
            <p>
              On the side: charred padrón peppers and a proper potato salad.
              The station stays out — pick back up whenever.
            </p>
          </TimeStop>

          <TimeStop time="7:45 pm" title="Josh on the decks">
            <p>
              Room-goes-up shift change. Josh takes over and pushes the energy
              up — dancing officially begins.
            </p>
          </TimeStop>

          <TimeStop time="9:00 pm" title="Cheese course">
            <p>
              Two large wheels of{" "}
              <strong className="text-cream">Gubbeen</strong> from Fermoy, West
              Cork — a milky, hazelnut-edged washed-rind cheese. About{" "}
              <strong className="text-cream">80g per guest</strong>, cut through
              the room from 9 until 10 on proper boards.
            </p>
            <ul className="list-inside list-[square] space-y-1 marker:text-[#c6a664]">
              <li>
                <strong className="text-cream">Nairn's rough oatcakes</strong>{" "}
                <em className="text-cream/60">
                  — earthy and honest, traditional Irish pairing.
                </em>
              </li>
              <li>
                <strong className="text-cream">
                  Peter's Yard sourdough crispbreads
                </strong>{" "}
                <em className="text-cream/60">
                  — light and neutral, lets the cheese lead.
                </em>
              </li>
              <li>
                <strong className="text-cream">
                  Fresh black figs, split and drizzled with wildflower honey
                </strong>{" "}
                <em className="text-cream/60">— August is peak fig.</em>
              </li>
              <li>
                <strong className="text-cream">
                  Egremont Russet apple, thin-sliced
                </strong>{" "}
                <em className="text-cream/60">
                  — bookends the apple &amp; dill from the oyster round.
                </em>
              </li>
            </ul>
          </TimeStop>

        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6">
        <OrnDivider />
      </div>

      {/* ────────────────────────────────────────────────────────
          SIGNATURE BAR — the two batched drinks, jug-served. Distinct
          from the slushie station below.
          ──────────────────────────────────────────────────────── */}
      <section className="px-5 py-16 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className={eyebrow}>Signature Bar</p>
          <h2 className="mt-4 font-display text-4xl leading-tight text-cream sm:text-5xl">
            Two <span className={`italic ${gold}`}>house pours</span> for the
            room
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-[1.02rem] leading-relaxed text-cream/85 sm:text-lg">
            The full bar is open all night for anyone who wants a bespoke
            drink, but two easy-serve signatures are pre-batched and ready to
            pour in jugs so nobody's waiting. One boozy, one soft — both
            proper.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-3xl gap-8 sm:grid-cols-2">
          <div className={`rounded-2xl ${BG_PANEL} p-6 sm:p-8`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#e6c98a] sm:tracking-[0.32em]">
              House pour · boozy
            </p>
            <h3 className="mt-3 font-display text-3xl leading-tight text-cream">
              <span className={`italic ${gold}`}>Kevin &amp; Tara</span> Punch
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-cream/85">
              Aged rum + amaro, pressed lemon, honey, a touch of oloroso and a
              strong hit of ripe stone fruit. Batched cold and served in jugs
              with a slab of ice, mint sprig on top. Whiskey version on
              request — same shape, bourbon in place of rum.
            </p>
          </div>

          <div className={`rounded-2xl ${BG_PANEL} p-6 sm:p-8`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#e6c98a] sm:tracking-[0.32em]">
              House pour · non-alcoholic
            </p>
            <h3 className="mt-3 font-display text-3xl leading-tight text-cream">
              <span className={`italic ${gold}`}>Garden Mint</span> Iced Tea
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-cream/85">
              Cold-brewed jasmine + green tea, muddled fresh mint, lemon, a
              whisper of honey. Served long over crushed ice with cucumber. As
              good as the punch — no compromise.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6">
        <OrnDivider />
      </div>

      {/* ────────────────────────────────────────────────────────
          SLUSHIE STATION — separate from the signature bar; its own
          self-serve corner with fruit-forward slushies and a shot
          top-up rail.
          ──────────────────────────────────────────────────────── */}
      <section className="px-5 py-16 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className={eyebrow}>Slushie Station</p>
          <h2 className="mt-4 font-display text-4xl leading-tight text-cream sm:text-5xl">
            A frozen <span className={`italic ${gold}`}>corner</span> of the
            room
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-[1.02rem] leading-relaxed text-cream/85 sm:text-lg">
            A dedicated slushie machine set up in its own corner. Two fruit-
            forward flavours running all night, fresh fruit and mint on the
            counter to top, and a small spirit rail behind for a shot on the
            top when you want to make it a cocktail.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-3xl gap-8 sm:grid-cols-2">
          <div className={`rounded-2xl ${BG_PANEL} p-6 sm:p-8`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#e6c98a] sm:tracking-[0.32em]">
              Slushie · flavour 1
            </p>
            <h3 className="mt-3 font-display text-3xl leading-tight text-cream">
              <span className={`italic ${gold}`}>Frozen</span> Strawberry &amp;
              Basil
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-cream/85">
              Ripe English strawberries, fresh basil, lemon, a whisper of
              sugar. Bright, garden-scented, works with a shot of gin or
              tequila blanco (or nothing at all — still perfect).
            </p>
          </div>

          <div className={`rounded-2xl ${BG_PANEL} p-6 sm:p-8`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#e6c98a] sm:tracking-[0.32em]">
              Slushie · flavour 2
            </p>
            <h3 className="mt-3 font-display text-3xl leading-tight text-cream">
              <span className={`italic ${gold}`}>Frozen</span> Watermelon
              &amp; Lime
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-cream/85">
              Watermelon crushed with lime and a pinch of sea salt — the
              summer version of a Margarita base. Pairs with tequila blanco
              or bourbon, or drinks fine on its own.
            </p>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-3xl sm:mt-10">
          <div
            className={`rounded-2xl ${BG_PANEL} p-5 text-center sm:p-6`}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#e6c98a] sm:tracking-[0.32em]">
              On the counter
            </p>
            <div className="mt-4 space-y-3 text-[0.95rem] leading-relaxed text-cream/85 sm:space-y-2">
              <p>
                <strong className="text-cream">Fruit</strong> — strawberries,
                watermelon, sliced peach, orange wheels, muddled mint, basil,
                lime.
              </p>
              <p>
                <strong className="text-cream">Rail</strong> — aged rum,
                bourbon, tequila blanco, gin.
              </p>
              <p className="italic text-cream/70">
                A shot on top of any slushie turns it into a proper cocktail.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6">
        <OrnDivider />
      </div>

      {/* ────────────────────────────────────────────────────────
          THE ROOM
          ──────────────────────────────────────────────────────── */}
      <section className="px-5 py-16 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className={eyebrow}>Logistics</p>
          <h2 className="mt-4 font-display text-4xl leading-tight text-cream sm:text-5xl">
            The <span className={`italic ${gold}`}>room</span>
          </h2>
        </div>

        <dl className="mx-auto mt-14 grid max-w-3xl gap-8 sm:grid-cols-2">
          <div className={`rounded-2xl ${BG_PANEL} p-5 sm:p-7`}>
            <dt className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#e6c98a]">
              Where
            </dt>
            <dd className="mt-3 leading-relaxed text-cream">
              No Dice
              <br />
              Arch 407, Mentmore Terrace
              <br />
              London Fields, Hackney
              <br />
              E8 3PH
            </dd>
          </div>
          <div className={`rounded-2xl ${BG_PANEL} p-5 sm:p-7`}>
            <dt className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#e6c98a]">
              When
            </dt>
            <dd className="mt-3 leading-relaxed text-cream">
              Saturday 29 August 2026
              <br />
              6pm — late
            </dd>
          </div>
          <div className={`rounded-2xl ${BG_PANEL} p-5 sm:p-7`}>
            <dt className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#e6c98a]">
              Room
            </dt>
            <dd className="mt-3 leading-relaxed text-cream">
              Whole venue, private hire.
              <br />
              Approx. 60 guests. Adults only.
              <br />
              Reception with London Fields views.
            </dd>
          </div>
          <div className={`rounded-2xl ${BG_PANEL} p-5 sm:p-7`}>
            <dt className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#e6c98a]">
              Getting there
            </dt>
            <dd className="mt-3 leading-relaxed text-cream">
              Two minutes from London Fields station.
              <br />
              Under the arches behind the park.
            </dd>
          </div>
        </dl>
      </section>

      {/* ────────────────────────────────────────────────────────
          FOOTER
          ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#c6a664]/20 px-5 py-12 text-center sm:px-6 sm:py-16">
        <p className="font-display text-2xl italic leading-tight text-[#e6c98a] sm:text-4xl">
          Congratulations, Kevin &amp; Tara.
        </p>
        <p className="mt-4 text-[10px] uppercase tracking-[0.24em] text-cream/60 sm:text-[11px] sm:tracking-[0.32em]">
          No Dice · Hackney · 2026
        </p>
      </footer>
    </main>
  );
}
