"use client";

import { createElement } from "react";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import Reveal from "@/components/Reveal";
import HeroBookingWidget from "@/components/HeroBookingWidget";
import { useContent, useImage, useGallery } from "@/lib/content";
import { Editable, DisplayImage } from "@/components/Editable";
import ManageGalleryLink from "@/components/ManageGalleryLink";

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
  // Every useContent / useImage call passes the current hardcoded value as
  // its fallback, so the page renders identically when nothing's been edited
  // in the admin. Saved values override the fallback on hydration.
  // No hardcoded fallback — the Plonk Golf "shark + volcano course"
  // photo used to live here and kept resurrecting itself whenever the
  // CMS row was empty. Empty fallback + conditional render below means
  // the hero is solid black until the founder uploads a real photo via
  // admin → Site Content → Home page → "Hero image" (or the click-to-
  // edit overlay on the live page in admin Edit mode).
  const heroImage = useImage("home.hero.image", "");
  const heroEyebrow = useContent("home.hero.eyebrow", "London Fields · Hackney");
  const heroLine1 = useContent("home.hero.headline_1", "No Dice");
  const heroLine2 = useContent("home.hero.headline_2", "Hackney");
  const heroSubcopy = useContent(
    "home.hero.subcopy",
    "A neighbourhood bar in the railway arches off London Fields. Pool, board games, arcade, residents on the decks, every big match on the screens.",
  );
  const hackneyBlurb = useContent(
    "home.venues.hackney",
    "A short walk from Broadway Market overlooking London Fields. Our home in the arches — beer garden, kitchen residencies, pool tables, retro arcade and craft cocktail bar.",
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
      {/* ───────────── HERO (forest) ───────────── */}
      <section className="relative isolate flex flex-col">
        {/* Image — always fills the full width; aspect-[3/2] matches our venue
            photo ratio so the shot fits cleanly without top/bottom crop.
            The desktop booking widget floats over this image, near the top
            just below the sticky header. */}
        <div className="relative w-full bg-forest aspect-[3/2] max-h-[80vh] min-h-[360px] overflow-hidden">
          {/* Only render the Image when an actual src exists — empty
              string would error next/image. With no image, the parent
              div's bg-forest (now black) shows through, which is
              exactly what we want until an upload exists. */}
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

          {/* Booking widget — desktop only, floats over the image just below
              the sticky header. Hidden on mobile (the pink CTA below the
              image takes its place there). */}
          <div className="pointer-events-none absolute inset-x-0 top-6 z-30 hidden px-6 md:block">
            <div className="pointer-events-auto mx-auto w-full max-w-3xl">
              <HeroBookingWidget />
            </div>
          </div>
        </div>

        {/* Copy below the image — sits on forest */}
        <div className="bg-forest px-6 pb-20 pt-10 text-center">
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

          <Reveal delay={360} className="w-full">
            <Link
              href="/book"
              className="mt-8 inline-block rounded-full bg-plonkPink px-10 py-4 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-plonkPink/20 transition hover:bg-plonkPink/90 md:hidden"
            >
              Book a tee time
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ───────────── VENUES (plum) ───────────── */}
      <section id="venues" className="tint-plum relative overflow-hidden">
        <div className="glow-blob-plum pointer-events-none absolute inset-x-0 top-0 h-[40vh]" />
        <VenueSpotlight
          // Fallbacks — render when no admin override exists
          name="Hackney"
          eyebrow="London Fields · 407 Mentmore Terrace"
          blurb={hackneyBlurb}
          features={[
            "Pool & arcade",
            "Beer garden",
            "Kitchen residencies",
            "Big screens for sport",
          ]}
          bookLabel="Book Hackney"
          detailLabel="Venue details →"
          bookHref="/book"
          detailHref="/venue/hackney"
          image=""
          imageAlt="No Dice Hackney"
          align="left"
          // CMS keys — every text surface editable from admin
          nameKey="home.venues.hackney_name"
          eyebrowKey="home.venues.hackney_eyebrow"
          blurbKey="home.venues.hackney"
          featuresKey="home.venues.hackney_features"
          bookLabelKey="home.venues.hackney_book_label"
          detailLabelKey="home.venues.hackney_detail_label"
          imageKey="home.venues.hackney_image"
        />
      </section>

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

      {/* ───────────── INSTAGRAM GRID ─────────────
          Curated Instagram-style grid. Pulls images from the
          `home.instagram` gallery key — manage at /admin/content/
          galleries. Each tile links to the No Dice Instagram profile.
          When the founder uploads images via the admin, those replace
          the placeholder set below. */}
      <InstagramStrip />
    </main>
  );
}

// Live Instagram feed rendered by Behold.so. The widget pulls posts
// auto-synced from @nodice.bar (managed at behold.so) and renders
// its own grid + click-through to each post. We supply the eyebrow,
// heading and the "Follow" CTA around it.
//
// To swap providers (or feeds) in future: change the feed-id below.
// The Behold loader script lives at https://w.behold.so/widget.js
// and is loaded via Next.js's <Script> for proper hydration order.
function InstagramStrip() {
  const INSTAGRAM_URL = "https://www.instagram.com/nodice.bar/";
  const BEHOLD_FEED_ID = "Ri14ASLlH0Y21Si7xE2v";

  return (
    <section className="relative overflow-hidden px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <p className="text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
            <Editable k="home.instagram.eyebrow">
              {useContent("home.instagram.eyebrow", "@nodice.bar")}
            </Editable>
          </p>
          <h2 className="mt-5 font-display text-4xl leading-tight sm:text-5xl md:text-6xl">
            <Editable k="home.instagram.heading">
              {useContent("home.instagram.heading", "Follow along.")}
            </Editable>
          </h2>
        </div>

        {/* Behold's widget loader — Next.js handles ordering so the
            <behold-widget> custom element below upgrades correctly
            after hydration. `afterInteractive` waits until the page
            is responsive so we don't block first paint. */}
        <Script
          src="https://w.behold.so/widget.js"
          type="module"
          strategy="afterInteractive"
        />
        {/* createElement avoids the TS "unknown JSX element" warning
            that a literal <behold-widget> tag would throw. The widget
            renders its own grid + click-through; styling is themed at
            behold.so (sign in to recolour to match the site). */}
        {createElement("behold-widget", { "feed-id": BEHOLD_FEED_ID })}

        <div className="mt-10 text-center">
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-plonkPink px-8 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-plonkPink/20 transition hover:bg-plonkPink/90"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
            Follow @nodice.bar
          </a>
        </div>
      </div>
    </section>
  );
}

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
    <section className="tint-plum overflow-hidden py-12">
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
      <ManageGalleryLink galleryKey="home.press" label="Manage press logos / order" />
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
            <div className="mt-8 relative">
              <ul className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-cream/80">
                {liveFeatures.map((f, i) => (
                  <li key={`${f}-${i}`} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-plonkYellow" />
                    {f}
                  </li>
                ))}
              </ul>
              {/* Hidden Editable overlay — click anywhere on the list
                  in admin Edit mode and you get the multiline editor. */}
              <Editable k={featuresKey} multiline>{liveFeaturesRaw}</Editable>
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
