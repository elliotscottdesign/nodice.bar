"use client";

import { useEffect, useState } from "react";

// ─── Passphrase wall for the wedding page ────────────────────────
// Guests unlock the evening details with the code on their invite
// (KEVTARA26). Case-insensitive. Unlock state persists in
// sessionStorage under STORAGE_KEY — clears when the tab closes,
// so a shared/borrowed phone won't stay signed in.
//
// The passphrase is client-side only. This is a speed bump to keep
// the URL from being casually shared / indexed, NOT a security
// boundary. Anyone who views source will see the code. The couple
// know that; it's a "please don't gossip" wall, not a vault.
// ────────────────────────────────────────────────────────────────

const PASSPHRASE = "KEVTARA26";
const STORAGE_KEY = "ndb_kevtara_unlocked";

// ─── shared styles ────────────────────────────────────────────
const BG_SECTION = "bg-[#2f3f2a] text-cream";
const BG_PANEL = "bg-[#243128]/70 border border-[#c6a664]/25";
const eyebrow =
  "text-[11px] font-bold uppercase tracking-[0.28em] text-[#e6c98a] sm:tracking-[0.38em]";
const gold = "text-[#e6c98a]";

function OrnDivider() {
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

export default function WeddingGate() {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [entered, setEntered] = useState("");
  const [err, setErr] = useState(false);

  // Hydration-safe: only touch sessionStorage after mount. Also
  // guarantees the wall renders on first paint so nothing leaks.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") setUnlocked(true);
    } catch {}
    setReady(true);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(false);
    if (entered.trim().toUpperCase() === PASSPHRASE) {
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {}
      setUnlocked(true);
    } else {
      setErr(true);
    }
  }

  // First paint before hydration: same dark green shell so nothing
  // flashes if the user is already unlocked.
  if (!ready) {
    return <div className={`min-h-screen ${BG_SECTION}`} />;
  }

  if (!unlocked) {
    return (
      <main
        className={`relative isolate flex min-h-screen items-center justify-center overflow-hidden px-5 py-16 ${BG_SECTION}`}
      >
        {/* Subtle backdrop matching the real page's hero so the wall
            feels like the same evening rather than a separate app. */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#131c11] via-[#2f3f2a] to-[#2f3f2a]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(230,201,138,0.18),_transparent_65%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(94,140,73,0.28),_transparent_60%)]" />

        <div className="relative mx-auto w-full max-w-md text-center">
          <p className={eyebrow}>Saturday · 29 August 2026</p>
          <h1 className="mt-6 font-display text-[3rem] leading-[0.95] text-cream sm:mt-8 sm:text-[4.5rem]">
            Kevin
            <span className={`my-1 block font-display italic ${gold} sm:my-2`}>
              &amp;
            </span>
            Tara
          </h1>

          <p className="mx-auto mt-8 max-w-sm text-[0.95rem] leading-relaxed text-cream/85">
            Enter the invitation code from your card to view the evening.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <input
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="Invitation code"
              value={entered}
              onChange={(e) => {
                setEntered(e.target.value);
                if (err) setErr(false);
              }}
              className="w-full rounded-full border border-[#c6a664]/40 bg-[#243128]/60 px-5 py-3 text-center font-display text-lg uppercase tracking-[0.24em] text-cream placeholder:text-cream/40 focus:border-[#e6c98a] focus:outline-none"
              aria-label="Invitation code"
            />
            <button
              type="submit"
              className="w-full rounded-full bg-[#e6c98a] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.28em] text-[#2f3f2a] transition hover:brightness-105"
            >
              Unlock the evening
            </button>
          </form>

          {err && (
            <p
              role="alert"
              className="mt-4 text-[0.9rem] italic text-[#f6c1c1]"
            >
              That code isn't right — check your invite.
            </p>
          )}

          <p className="mt-10 text-[10px] uppercase tracking-[0.24em] text-cream/45">
            No Dice · Hackney · Private event
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={`min-h-screen ${BG_SECTION}`}>
      {/* ────────────────────────────────────────────────────────
          HERO
          ──────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-[#1e2b1c]">
        <div className="absolute inset-0 bg-gradient-to-b from-[#131c11] via-[#2f3f2a] to-[#2f3f2a]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(230,201,138,0.18),_transparent_65%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(94,140,73,0.28),_transparent_60%)]" />

        <div className="relative px-5 pb-24 pt-24 text-center sm:px-6 sm:pb-36 sm:pt-40">
          <div className="mx-auto max-w-3xl">
            <p className={eyebrow}>Saturday · 29 August 2026</p>
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
          SIGNATURE BAR
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
          SLUSHIE STATION — simplified: one base (lemon + ice),
          your choice of spirit on top from the rail.
          ──────────────────────────────────────────────────────── */}
      <section className="px-5 py-16 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className={eyebrow}>Slushie Station</p>
          <h2 className="mt-4 font-display text-4xl leading-tight text-cream sm:text-5xl">
            Lemon, ice, <span className={`italic ${gold}`}>your spirit</span>{" "}
            on top
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-[1.02rem] leading-relaxed text-cream/85 sm:text-lg">
            One clean lemon-ice slushie running all night in its own corner.
            Pour a cup, pick a spirit from the rail behind, and it's your
            cocktail — the frozen version of whatever you drink. Or leave it
            plain: it's a proper cold lemonade on its own.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-3xl gap-8 sm:grid-cols-[1.15fr_1fr]">
          <div className={`rounded-2xl ${BG_PANEL} p-6 sm:p-8`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#e6c98a] sm:tracking-[0.32em]">
              The base
            </p>
            <h3 className="mt-3 font-display text-3xl leading-tight text-cream">
              <span className={`italic ${gold}`}>Lemon</span> &amp; Ice
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-cream/85">
              Fresh-pressed lemon, sugar, water — spun cold in the slushie
              machine until it holds its shape in the cup. Deliberately
              simple: the spirit choice is what makes it yours.
            </p>
          </div>

          <div className={`rounded-2xl ${BG_PANEL} p-6 sm:p-8`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#e6c98a] sm:tracking-[0.32em]">
              Choose your spirit
            </p>
            <h3 className="mt-3 font-display text-3xl leading-tight text-cream">
              The <span className={`italic ${gold}`}>rail</span>
            </h3>
            <ul className="mt-4 space-y-1.5 text-sm leading-relaxed text-cream/85">
              <li>
                <strong className="text-cream">Vodka</strong> — the clean,
                crushable one
              </li>
              <li>
                <strong className="text-cream">Gin</strong> — botanical, hard
                to beat with lemon
              </li>
              <li>
                <strong className="text-cream">Tequila blanco</strong> —
                turns it into a frozen margarita
              </li>
              <li>
                <strong className="text-cream">Aged rum</strong> — softer, a
                proper daiquiri lean
              </li>
              <li>
                <strong className="text-cream">Bourbon</strong> — sours-adjacent,
                a warmer edge
              </li>
              <li className="italic text-cream/70">
                Or leave it as-is — it's a great lemonade too.
              </li>
            </ul>
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
