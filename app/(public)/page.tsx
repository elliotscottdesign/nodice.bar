"use client";

import Image from "next/image";
import Link from "next/link";
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
    image: "/hackney/drinks/Drinks_3.jpg",
    title: "Bar",
    body: "Draught beers, craft cans, speciality ciders, house and classic cocktails, natural wines and a wide range of soft drinks.",
  },
  {
    image: "/hackney/pool/Pool_2.jpg",
    title: "Pool",
    body: "American 7ft pool tables in Hackney, brand-new British 7ft tables in Borough. £5 for 30 minutes. Over-16s only.",
  },
  {
    image: "/hackney/games/Games_8.jpg",
    title: "Board games",
    body: "A wall of board games at Hackney. Borrow whatever you fancy from the bar and settle the score between rounds.",
  },
  {
    image: "/hackney/games/Games_2.jpg",
    title: "Arcade",
    body: "Pinball machines, retro multi-game cabinets, shoot-'em-ups, foosball and skee-ball. Buy tokens at the bar.",
  },
];

export default function HomePage() {
  // Every useContent / useImage call passes the current hardcoded value as
  // its fallback, so the page renders identically when nothing's been edited
  // in the admin. Saved values override the fallback on hydration.
  const heroImage = useImage("home.hero.image", "/borough/course/Course_1.jpg");
  const heroEyebrow = useContent("home.hero.eyebrow", "Hackney · Borough Market");
  const heroLine1 = useContent("home.hero.headline_1", "Crazy Golf Creations");
  const heroLine2 = useContent("home.hero.headline_2", "Across the Capital");
  const heroSubcopy = useContent(
    "home.hero.subcopy",
    "Two original courses. Two iconic London arches. One unforgettable round — with cocktails, food and games to match.",
  );
  const hackneyBlurb = useContent(
    "home.venues.hackney",
    "A short walk from Broadway Market overlooking London Fields. Our Polynesian-themed outdoor course, with a beer garden, taco kitchen, pool, retro arcade and craft cocktail bar.",
  );
  const boroughBlurb = useContent(
    "home.venues.borough",
    "Tucked into four railway arches under London Bridge. A London-themed indoor course threading past the city's monuments, surrounded by murals from London's best spray-can talent.",
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
          <Image
            src={heroImage}
            alt=""
            fill
            priority
            className="object-cover"
            sizes="100vw"
            unoptimized={heroImage.startsWith("http")}
          />
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
          name="Hackney"
          bookHref="/book/hackney"
          detailHref="/venue/hackney"
          eyebrow="Outdoor · 9 holes · beer garden"
          image="/hackney/course/Course_1.jpg"
          imageAlt="Plonk Hackney crazy golf"
          imageKey="home.venues.hackney_image"
          blurb={hackneyBlurb}
          blurbKey="home.venues.hackney"
          features={[
            "9-hole Polynesian course",
            "Outdoor beer garden",
            "Taco kitchen",
            "Pool & arcade",
          ]}
          align="left"
        />
        <VenueSpotlight
          name="Borough Market"
          bookHref="/book/borough"
          detailHref="/venue/borough-market"
          eyebrow="Indoor · 9 holes · under London Bridge"
          image="/borough/course/Course_2.jpg"
          imageAlt="Plonk Borough Market crazy golf"
          imageKey="home.venues.borough_image"
          blurb={boroughBlurb}
          blurbKey="home.venues.borough"
          features={[
            "9-hole London-themed course",
            "4 covered arches",
            "Stone-baked pizza",
            "Ping pong & pinball",
          ]}
          align="right"
        />
      </section>

      {/* ───────────── FEATURES (plum → ember) ───────────── */}
      <section className="tint-plum-to-ember relative overflow-hidden px-6 py-28">
        <div className="glow-blob-ember pointer-events-none absolute inset-x-0 bottom-0 h-[50vh]" />
        <div className="relative mx-auto max-w-6xl">
          <Reveal>
            <p className="text-center text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
              <Editable k="home.features.eyebrow">{useContent("home.features.eyebrow", "Inside every Plonk")}</Editable>
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

      {/* ───────────── PRESS MARQUEE (ember) ───────────── */}
      <PressMarquee fallback={PRESS} />


      {/* ───────────── PRIVATE HIRE + VOUCHERS (ember → forest) ───────────── */}
      <section className="px-6 py-28">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2">
          <CtaCard
            eyebrow="Bring your people"
            title="Private hire & events"
            blurb="Birthdays, work parties, hen dos, weddings. Take over a course, an arch, or the whole venue."
            href="/private-hire"
            image="/hackney/venue/Interior_5.jpg"
          />
          <CtaCard
            eyebrow="The easy gift"
            title="Plonk gift vouchers"
            blurb="A round, a meal, a cocktail flight, or all three. Delivered to inbox, redeemable at either venue."
            href="/vouchers"
            image="/borough/drinks/Cocktail_1.jpg"
          />
        </div>
      </section>

      {/* ───────────── BIG CTA FOOTER (forest → forestDeep) ───────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Image
            src="/hackney/pool/Pool_1.jpg"
            alt=""
            fill
            className="object-cover opacity-25"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-forest/80 via-forest/90 to-forestDeep" />
        </div>
        <div className="mx-auto max-w-3xl px-6 py-32 text-center">
          <Reveal>
            <h2 className="font-display text-4xl leading-tight sm:text-5xl md:text-6xl">
              Right then.
              <br />
              <span className="text-plonkYellow italic">Book your round.</span>
            </h2>
          </Reveal>
          <Reveal delay={150}>
            <p className="mx-auto mt-8 max-w-md text-base text-cream/70">
              30 seconds to book. 6 players per slot. 9 holes of chaos.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <Link
              href="/book"
              className="mt-10 inline-block rounded-full bg-plonkPink px-12 py-4 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-plonkPink/20 transition hover:bg-plonkPink/90"
            >
              Book a tee time
            </Link>
          </Reveal>
        </div>
      </section>
    </main>
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

function VenueSpotlight({
  name,
  bookHref,
  detailHref,
  eyebrow,
  image,
  imageAlt,
  imageKey,
  blurb,
  blurbKey,
  features,
  align,
}: {
  name: string;
  bookHref: string;
  detailHref: string;
  eyebrow: string;
  image: string;
  imageAlt: string;
  imageKey: string;
  blurb: string;
  blurbKey: string;
  features: string[];
  align: "left" | "right";
}) {
  const imageFirst = align === "left";
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
              {eyebrow}
            </p>
            <h3 className="mt-4 font-display text-5xl leading-tight sm:text-6xl">
              {name}
            </h3>
            <p className="mt-6 text-base leading-relaxed text-cream/75 sm:text-lg">
              <Editable k={blurbKey} multiline>{blurb}</Editable>
            </p>

            <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-cream/80">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-plonkYellow" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href={bookHref}
                className="inline-block rounded-full bg-plonkPink px-8 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90"
              >
                Book {name}
              </Link>
              <Link
                href={detailHref}
                className="inline-flex items-center text-sm font-semibold uppercase tracking-wider text-cream/80 transition hover:text-cream"
              >
                Venue details →
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
