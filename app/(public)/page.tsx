"use client";

import { createElement } from "react";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import Reveal from "@/components/Reveal";
import HeroBookingWidget from "@/components/HeroBookingWidget";
import { useContent, useGallery, useImage } from "@/lib/content";
import { Editable, DisplayImage } from "@/components/Editable";
import ManageGalleryLink from "@/components/ManageGalleryLink";
import InstagramFeed from "@/components/InstagramFeed";
import UpcomingEvents from "@/components/UpcomingEvents";

const PRESS = [
  { name: "Evening Standard", src: "/images/London-Evening-Standard-logo.jpg" },
  { name: "Londonist", src: "/images/londonist.jpg" },
  { name: "Time Out", src: "/images/timeput_logo_2-1.png" },
  { name: "The Nudge", src: "/images/The-Nudge.jpg" },
  { name: "Secret London", src: "/images/SecretLondon.jpg" },
  { name: "Metro", src: "/images/metro-logo.jpg" },
];

const FEATURES = [
  {
    image: "",
    title: "Bar",
    body: "Draught beers, craft cans, speciality ciders, house and classic cocktails, natural wines and a wide range of soft drinks.",
  },
  {
    image: "",
    title: "Pool",
    body: "American 7ft pool tables. £5 for 30 minutes. Over-16s only.",
  },
  {
    image: "",
    title: "Board games",
    body: "A wall of board games. Borrow whatever you fancy from the bar and settle the score between rounds.",
  },
  {
    image: "",
    title: "Arcade",
    body: "Pinball machines, retro multi-game cabinets, shoot-'em-ups, foosball and skee-ball. Buy tokens at the bar.",
  },
];

export default function HomePage() {
  // Every useContent call passes the current hardcoded value as its
  // fallback, so the page renders identically when nothing's been edited
  // in the admin. Saved values override the fallback on hydration.
  // Header photo restored (founder, 12 Nov 2026 — "put the header image
  // back in, removed by accident"). The hero leads with the venue photo
  // again (home.hero.image CMS row), then title + intro + booking, then
  // the "what's coming up" rails. Image only renders when the CMS row has
  // one — empty just shows the copy on forest, never a black box.
  const heroImage = useImage("home.hero.image", "");
  const heroEyebrow = useContent("home.hero.eyebrow", "London Fields · Hackney");
  const heroLine1 = useContent("home.hero.headline_1", "No Dice");
  const heroLine2 = useContent("home.hero.headline_2", "Hackney");
  const heroSubcopy = useContent(
    "home.hero.subcopy",
    "A neighbourhood bar in the railway arches off London Fields. Pool, board games, arcade, residents on the decks, every big match on the screens.",
  );
  const f1Title = useContent("home.feature1.title", FEATURES[0].title);
  const f1Body = useContent("home.feature1.body", FEATURES[0].body);
  const f2Title = useContent("home.feature2.title", FEATURES[1].title);
  const f2Body = useContent("home.feature2.body", FEATURES[1].body);
  const f3Title = useContent("home.feature3.title", FEATURES[2].title);
  const f3Body = useContent("home.feature3.body", FEATURES[2].body);
  const f4Title = useContent("home.feature4.title", FEATURES[3].title);
  const f4Body = useContent("home.feature4.body", FEATURES[3].body);
  const editableFeatures = [
    { ...FEATURES[0], title: f1Title, body: f1Body },
    { ...FEATURES[1], title: f2Title, body: f2Body },
    { ...FEATURES[2], title: f3Title, body: f3Body },
    { ...FEATURES[3], title: f4Title, body: f4Body },
  ];

  return (
    <main>
      {/* ───────────── HERO (forest) ─────────────
          Header photo restored (founder, 12 Nov 2026 — "put the header image
          back in"). Full-width image banner with the desktop booking widget
          floating over it, just below the sticky header, so the search bar
          rides down the page with the banner the way it used to before the
          image was stripped out. Copy (title + intro) sits on forest below,
          with a plain Book button standing in for the widget on phones. */}
      <section className="relative isolate flex flex-col">
        {/* Image banner + floating booking widget. The container always
            renders so the booking bar has its place even before an image is
            uploaded; the <Image> itself only paints when home.hero.image has
            a value, otherwise the forest background shows through. */}
        <div className="relative w-full overflow-hidden bg-forest aspect-[3/2] max-h-[80vh] min-h-[360px]">
          {heroImage && (
            <Image
              src={heroImage}
              alt=""
              fill
              priority
              className="object-cover"
              sizes="100vw"
              unoptimized={heroImage.startsWith("http")}
            />
          )}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-forestDeep/55 to-transparent" />

          {/* Booking widget — desktop only, floats over the banner just below
              the sticky header. Hidden on mobile (the pink CTA below the
              image takes its place there). */}
          <div className="pointer-events-none absolute inset-x-0 top-6 z-30 hidden px-6 md:block">
            <div className="pointer-events-auto mx-auto w-full max-w-3xl">
              <HeroBookingWidget />
            </div>
          </div>
        </div>

        {/* Copy below the banner — sits on forest */}
        <div className="bg-forest px-6 pb-16 pt-10 text-center">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
              <Editable k="home.hero.eyebrow">{heroEyebrow}</Editable>
            </p>
          </Reveal>
          <Reveal delay={120}>
            <h1 className="mt-5 font-display text-5xl leading-[1.05] sm:text-6xl md:text-7xl lg:text-[80px]">
              <Editable k="home.hero.headline_1">{heroLine1}</Editable>
              <br />
              <span className="italic text-plonkYellow">
                <Editable k="home.hero.headline_2">{heroLine2}</Editable>
              </span>
            </h1>
          </Reveal>
          <Reveal delay={240}>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-cream/85 sm:text-lg">
              <Editable k="home.hero.subcopy" multiline>{heroSubcopy}</Editable>
            </p>
          </Reveal>

          {/* Phones: the desktop search bar renders nothing below md, so show
              a plain booking button in its place rather than a dead gap. */}
          <Reveal delay={360}>
            <Link
              href="/book"
              className="mx-auto mt-8 flex w-full max-w-sm items-center justify-center rounded-full bg-plonkPink px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90 md:hidden"
            >
              Book a table or pool
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ───────────── WHAT'S ON — two rails, next 30 days ─────────────
          Up top on purpose. First the special events / pool / food / drink
          nights, then a separate rail just for the DJs (in order of play,
          Open Decks included). Each renders nothing when its 30-day window
          is empty, so neither leaves a bare band. */}
      <UpcomingEvents
        kind="events"
        eyebrow="Next 30 days"
        heading="Special events"
      />
      <UpcomingEvents
        kind="djs"
        eyebrow="On the decks"
        heading="Music sessions"
      />

      {/* VENUES (plum) — the "No Dice Crazy Golf" venue spotlight was
          removed on founder request (12 Nov 2026). The VenueSpotlight
          component is kept defined below (unused) so the block can be
          restored quickly if wanted. */}

      {/* ───────────── FEATURES (plum → ember) ───────────── */}
      <section className="tint-plum-to-ember relative overflow-hidden px-6 py-28">
        <div className="glow-blob-ember pointer-events-none absolute inset-x-0 bottom-0 h-[50vh]" />
        <div className="relative mx-auto max-w-6xl">
          <Reveal>
            <p className="text-center text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
              <Editable k="home.features.eyebrow">{useContent("home.features.eyebrow", "Inside every No Dice")}</Editable>
            </p>
            <h2 className="mt-6 text-center font-display text-4xl sm:text-5xl">
              <Editable k="home.features.heading">{useContent("home.features.heading", "More than mini golf.")}</Editable>
            </h2>
          </Reveal>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {editableFeatures.map((f, i) => (
              <Reveal key={i} delay={i * 80}>
                <FeatureCard
                  imageKey={`home.feature${i + 1}.image`}
                  titleKey={`home.feature${i + 1}.title`}
                  bodyKey={`home.feature${i + 1}.body`}
                  image={f.image}
                  title={f.title}
                  body={f.body}
                />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PRESS MARQUEE removed per founder direction — the PressMarquee
          component below is left in the file (unused) in case the
          "As featured in" strip is wanted back later. */}

      {/* PRIVATE HIRE + VOUCHERS cards removed per founder direction —
          CtaCard component below is left in the file (unused) in case
          the two cards are wanted back later. */}

      {/* ───────────── INSTAGRAM FEED ─────────────
          Live @nodice.bar feed via Behold.so. Shared component used
          on /events too so the widget setup lives in one place. CMS
          keys keep the existing home.instagram.* edits valid. */}
      <InstagramFeed />
    </main>
  );
}

// Live Instagram feed rendered by Behold.so. The widget pulls posts
// auto-synced from @nodice.bar (managed at behold.so). The widget
// is now in components/InstagramFeed.tsx — used here AND on /events
// (and any future page that wants the live grid).

/* ───────────── components ───────────── */

// Press logo marquee — reads the strip from the home.press gallery in
// Supabase when populated, otherwise falls back to the hardcoded
// PRESS list at the top of this file. The eyebrow line above the
// logos is editable via the home.press.eyebrow page_content key.
function PressMarquee({
  fallback,
}: {
  fallback: { name: string; src: string }[];
}) {
  const eyebrow = useContent("home.press.eyebrow", "As featured in");
  const gallery = useGallery(
    "home.press",
    fallback.map((p) => ({ src: p.src, alt: p.name })),
  );
  // Duplicate the array so the CSS marquee animation loops seamlessly.
  const looped = [...gallery, ...gallery];
  return (
    <section className="tint-plum relative overflow-hidden py-12">
      <p className="text-center text-xs font-bold uppercase tracking-eyebrow text-cream/40">
        {eyebrow}
      </p>
      <div className="no-scrollbar mt-8 flex w-full overflow-x-hidden">
        <div className="marquee flex shrink-0 items-center gap-16 px-8">
          {looped.map((p, i) => (
            <div
              key={`${p.src}-${i}`}
              className="relative h-10 w-28 shrink-0 opacity-60 grayscale"
            >
              <Image
                src={p.src}
                alt={p.alt ?? ""}
                fill
                className="object-contain"
                sizes="112px"
                unoptimized={p.src.startsWith("http")}
              />
            </div>
          ))}
        </div>
      </div>
      <ManageGalleryLink galleryKey="home.press" label="Manage press logos" />
    </section>
  );
}

// Every visible string here is now CMS-driven via the *Key props.
// The hardcoded `name`/`eyebrow`/`features`/etc. props become FALLBACKS
// — they render when no DB row is set, and the admin can override
// each one by editing the matching page_content row.
//
// Features are stored as a single multiline string in the CMS, one
// bullet per line, parsed on render (matches the Header nav pattern).
function VenueSpotlight({
  // Display fallbacks (used when no DB value is set)
  name,
  eyebrow,
  blurb,
  features,
  bookHref,
  detailHref,
  bookLabel,
  detailLabel,
  // Static
  image,
  imageAlt,
  align,
  // CMS keys — every editable surface gets a key
  nameKey,
  eyebrowKey,
  blurbKey,
  featuresKey,
  bookLabelKey,
  detailLabelKey,
  imageKey,
}: {
  name: string;
  eyebrow: string;
  blurb: string;
  features: string[];
  bookHref: string;
  detailHref: string;
  bookLabel: string;
  detailLabel: string;
  image: string;
  imageAlt: string;
  align: "left" | "right";
  nameKey: string;
  eyebrowKey: string;
  blurbKey: string;
  featuresKey: string;
  bookLabelKey: string;
  detailLabelKey: string;
  imageKey: string;
}) {
  const imageFirst = align === "left";

  // Pull live values from the CMS (fallbacks shown until something
  // is saved). features key holds a single newline-separated string.
  const liveEyebrow     = useContent(eyebrowKey, eyebrow);
  const liveName        = useContent(nameKey, name);
  const liveFeaturesRaw = useContent(featuresKey, features.join("\n"));
  const liveBookLabel   = useContent(bookLabelKey, bookLabel);
  const liveDetailLabel = useContent(detailLabelKey, detailLabel);

  const liveFeatures = liveFeaturesRaw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="relative px-6 py-20 md:py-32">
      <div
        className={`relative mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-16 ${
          imageFirst ? "" : "md:[&>div:first-child]:order-2"
        }`}
      >
        <Reveal>
          <DisplayImage k={imageKey} fallback={image} aspect="4/5" alt={imageAlt} rounded />
        </Reveal>

        <Reveal delay={120}>
          <div>
            <p className="text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
              <Editable k={eyebrowKey}>{liveEyebrow}</Editable>
            </p>
            <h3 className="mt-4 font-display text-5xl leading-tight sm:text-6xl">
              <Editable k={nameKey}>{liveName}</Editable>
            </h3>
            <p className="mt-6 text-base leading-relaxed text-cream/75 sm:text-lg">
              <Editable k={blurbKey} multiline>{blurb}</Editable>
            </p>

            {/* The whole bullet list is one editable multiline field —
                each line in the textarea becomes a bullet. Edit icon
                sits on the kicker line so the click target is clear. */}
            {/* Features — styled bullets, always. The inline Edit-mode
                overlay was removed 2026-09-13: it kept rendering the raw
                newline text as a duplicate list (and its "Features — one
                per line" label showed in edit mode). These four venue
                facts rarely change; edit them in the `features` array
                where VenueSpotlight is used, above. */}
            <div className="mt-8">
              <ul className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-cream/80">
                {liveFeatures.map((f, i) => (
                  <li key={`${f}-${i}`} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-plonkYellow" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href={bookHref}
                className="inline-block rounded-full bg-plonkPink px-8 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90"
              >
                <Editable k={bookLabelKey}>{liveBookLabel}</Editable>
              </Link>
              <Link
                href={detailHref}
                className="inline-flex items-center text-sm font-semibold uppercase tracking-wider text-cream/80 transition hover:text-cream"
              >
                <Editable k={detailLabelKey}>{liveDetailLabel}</Editable>
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

function CtaCard({
  eyebrow,
  title,
  blurb,
  href,
  image,
}: {
  eyebrow: string;
  title: string;
  blurb: string;
  href: string;
  image: string;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-plumLine/60 transition hover:border-plonkYellow/60"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={image}
          alt=""
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover transition duration-700 group-hover:scale-105"
        />
      </div>
      <div className="p-8">
        <p className="text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
          {eyebrow}
        </p>
        <h3 className="mt-3 font-display text-3xl">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-cream/70">{blurb}</p>
        <span className="mt-6 inline-block text-sm font-semibold uppercase tracking-wider text-cream group-hover:text-plonkYellow">
          Find out more →
        </span>
      </div>
    </Link>
  );
}

function FeatureCard({
  imageKey,
  titleKey,
  bodyKey,
  image,
  title,
  body,
}: {
  imageKey: string;
  titleKey: string;
  bodyKey: string;
  image: string;
  title: string;
  body: string;
}) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-plumLine/50 transition hover:border-plonkYellow/40">
      <DisplayImage k={imageKey} fallback={image} aspect="5/3" />
      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-display text-2xl">
          <Editable k={titleKey}>{title}</Editable>
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-cream/75">
          <Editable k={bodyKey} multiline>{body}</Editable>
        </p>
      </div>
    </article>
  );
}
