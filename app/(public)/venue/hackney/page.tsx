"use client";

import Link from "next/link";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import { useContent, useImage, useGallery } from "@/lib/content";
import { Editable, DisplayImage } from "@/components/Editable";
import ManageGalleryLink from "@/components/ManageGalleryLink";

// Default event posters used when the hackney.events gallery is empty.
const EVENT_POSTERS_FALLBACK = [
  { src: "/hackney/events/Happy_Hour.jpg", alt: "Happy Hour at No Dice" },
  { src: "/hackney/events/No_Dice_Mondays.jpg", alt: "No Dice Mondays" },
  { src: "/hackney/events/Burger_Deal.jpg", alt: "Burger deal at Snack Bar" },
  { src: "/hackney/events/Fun_of_the_Fair.jpg", alt: "Fun of the Fair" },
  { src: "/hackney/events/Cue.jpg", alt: "Cue — pool night" },
  { src: "/hackney/events/Martini_Fries.jpg", alt: "Martini & Fries" },
  { src: "/hackney/events/Rolling_Bones.jpg", alt: "Rolling Bones" },
  { src: "/hackney/events/Fun_Club.jpg", alt: "Fun Club" },
  { src: "/hackney/events/Pingers.jpg", alt: "Pingers — ping pong night" },
];

export default function HackneyPage() {
  // ---------- Hero ----------
  const eyebrow = useContent("venue.hackney.eyebrow", "Outdoors & covered");
  const title = useContent(
    "venue.hackney.title",
    "Plonk Hackney at No Dice Games Bar",
  );
  const intro = useContent(
    "venue.hackney.intro",
    "Our perfectly positioned games bar and golf spot is just a short walk from Broadway Market and looks across London Fields.",
  );
  const heroImage = useImage("venue.hackney.hero_image", "");

  // ---------- Polynesian intro ----------
  const bodyEyebrow = useContent("venue.hackney.body_eyebrow", "We've glown up");
  const bodyHeading = useContent(
    "venue.hackney.body_heading",
    "A Polynesian putting paradise",
  );
  const bodyIntro = useContent(
    "venue.hackney.body_intro",
    "Our Hackney course has been rebuilt — bigger, brighter and bolder than ever. Volcano canyons, a tiki forest, golf gods to appease, a stone circle to navigate and octopuses to dodge under the sea — all now fully covered and out of the rain.",
  );
  // body_image is rendered + edited by the DisplayImage component
  // below; no need to also resolve the URL here.

  // ---------- More than golf ----------
  const mtgEyebrow = useContent(
    "venue.hackney.morethan.eyebrow",
    "No Dice Games Bar",
  );
  const mtgHeading = useContent(
    "venue.hackney.morethan.heading",
    "More than just golf",
  );

  const f1Title = useContent("venue.hackney.feature1.title", "Pool tables");
  const f1Body = useContent(
    "venue.hackney.feature1.body",
    "Two 7ft American pool tables, £5 for 30 minutes. Perfect rematch if you don't fare so well on the course. Over-16s only.",
  );
  const f2Title = useContent("venue.hackney.feature2.title", "Retro arcade");
  const f2Body = useContent(
    "venue.hackney.feature2.body",
    "Pinball, retro multi-game cabinets, shoot-'em-ups, skee-ball and foosball. Hit 270 on the skee-ball and the cocktail's on us.",
  );
  const f3Title = useContent("venue.hackney.feature3.title", "No Dice Bar");
  const f3Body = useContent(
    "venue.hackney.feature3.body",
    "Fully loaded bar stocked with draught beers, craft cans, speciality ciders, house and classic cocktails, natural wines and a wide range of soft drinks.",
  );
  const f4Title = useContent("venue.hackney.feature4.title", "Beer garden");
  const f4Body = useContent(
    "venue.hackney.feature4.body",
    "When the sun's out — kick back with top-of-the-line ping pong tables to keep the competition going outside.",
  );
  const f5Title = useContent("venue.hackney.feature5.title", "Snack Bar");
  const f5Body = useContent(
    "venue.hackney.feature5.body",
    "Smash burgers, BBQ chicken, loaded chips. BBQ meat supplied by Smokoloko of Spitalfields.",
  );
  const f6Title = useContent("venue.hackney.feature6.title", "Doubles pool tournament");
  const f6Body = useContent(
    "venue.hackney.feature6.body",
    "2nd and 4th Wednesday of the month. £200+ in bar tabs, medals, beer and Tees. Eight slots — always sells out.",
  );

  // ---------- Events ----------
  const eventsHeading = useContent(
    "venue.hackney.events.heading",
    "Events at No Dice",
  );
  const eventsIntro = useContent(
    "venue.hackney.events.intro",
    "DJs, pool tournaments, parties, pop-ups — what's on at the games bar.",
  );
  // Events posters — read from hackney.events gallery, fall back to
  // the bundled JPGs. Plain <img> tags below (not next/image) to keep
  // this lean and avoid any next-image runtime weirdness this section
  // hit on first launch.
  const eventsPosters = useGallery(
    "hackney.events",
    EVENT_POSTERS_FALLBACK,
  );

  // ---------- Find us ----------
  const findusHeading = useContent("venue.hackney.findus.heading", "Find us");
  const findusAddressLabel = useContent(
    "venue.hackney.findus.address_label",
    "Address",
  );
  const findusAddress = useContent(
    "venue.hackney.findus.address",
    "Arch 407, Mentmore Terrace\nLondon E8 3PP\nMain entrance on Parkside",
  );
  const findusTransportLabel = useContent(
    "venue.hackney.findus.transport_label",
    "Getting here",
  );
  const findusTransport = useContent(
    "venue.hackney.findus.transport",
    "2 mins from London Fields Overground\n5 mins from Broadway Market\n10 mins from Hackney Central Overground",
  );

  const sliderImages = [
    "/hackney/course/Course_1.jpg",
    "/hackney/garden/Garden_1.jpg",
    "/hackney/course/Course_3.jpg",
    "/hackney/pool/Pool_1.jpg",
    "/hackney/drinks/Drinks_3.jpg",
    "/hackney/games/Games_2.jpg",
    "/hackney/venue/Interior_2.jpg",
    "/hackney/course/Course_5.jpg",
  ];

  return (
    <main>
      <PageHero
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        image={heroImage || sliderImages}
        eyebrowKey="venue.hackney.eyebrow"
        titleKey="venue.hackney.title"
        introKey="venue.hackney.intro"
        imageKey="venue.hackney.hero_image"
        sliderKey="hero.venue.hackney"
      />

      {/* Polynesian intro */}
      <section className="relative overflow-hidden px-6 py-20 md:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-16">
          <Reveal>
            <div>
              <p className="text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
                <Editable k="venue.hackney.body_eyebrow">{bodyEyebrow}</Editable>
              </p>
              <h2 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
                <Editable k="venue.hackney.body_heading">{bodyHeading}</Editable>
              </h2>
              <p className="mt-6 whitespace-pre-line text-base leading-relaxed text-cream/80 sm:text-lg">
                <Editable k="venue.hackney.body_intro" multiline>{bodyIntro}</Editable>
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/book/hackney"
                  className="inline-block rounded-full bg-plonkPink px-8 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-plonkPink/20 transition hover:bg-plonkPink/90"
                >
                  Book Hackney
                </Link>
                <Link
                  href="/private-hire"
                  className="inline-flex items-center text-sm font-semibold uppercase tracking-wider text-cream/80 transition hover:text-cream"
                >
                  Private hire →
                </Link>
              </div>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <DisplayImage
              k="venue.hackney.body_image"
              fallback="/hackney/course/Course_3.jpg"
              aspect="4/5"
              alt="Polynesian course detail"
              rounded
            />
          </Reveal>
        </div>
      </section>

      {/* More than golf */}
      <section className="relative overflow-hidden px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-center text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
              <Editable k="venue.hackney.morethan.eyebrow">{mtgEyebrow}</Editable>
            </p>
            <h2 className="mt-6 text-center font-display text-4xl sm:text-5xl">
              <Editable k="venue.hackney.morethan.heading">{mtgHeading}</Editable>
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard kImage="venue.hackney.feature1.image" fallbackImage="/hackney/pool/Pool_2.jpg" kTitle="venue.hackney.feature1.title" kBody="venue.hackney.feature1.body" title={f1Title} body={f1Body} />
            <FeatureCard kImage="venue.hackney.feature2.image" fallbackImage="/hackney/games/Games_2.jpg" kTitle="venue.hackney.feature2.title" kBody="venue.hackney.feature2.body" title={f2Title} body={f2Body} />
            <FeatureCard kImage="venue.hackney.feature3.image" fallbackImage="/hackney/drinks/Drinks_3.jpg" kTitle="venue.hackney.feature3.title" kBody="venue.hackney.feature3.body" title={f3Title} body={f3Body} />
            <FeatureCard kImage="venue.hackney.feature4.image" fallbackImage="/hackney/garden/Garden_2.jpg" kTitle="venue.hackney.feature4.title" kBody="venue.hackney.feature4.body" title={f4Title} body={f4Body} />
            <FeatureCard kImage="venue.hackney.feature5.image" fallbackImage="/hackney/snack_bar/Snack_bar_1.jpg" kTitle="venue.hackney.feature5.title" kBody="venue.hackney.feature5.body" title={f5Title} body={f5Body} href="/snack-bar" hrefLabel="See the menu" />
            <FeatureCard kImage="venue.hackney.feature6.image" fallbackImage="/hackney/games/Games_6.jpg" kTitle="venue.hackney.feature6.title" kBody="venue.hackney.feature6.body" title={f6Title} body={f6Body} />
          </div>
        </div>
      </section>

      {/* Events at No Dice — gallery-driven, manage at /admin/content/galleries (key: hackney.events) */}
      {eventsPosters.length > 0 && (
        <section className="tint-plum-island-ember">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="text-center font-display text-3xl sm:text-4xl">
              {eventsHeading}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-cream/75">
              {eventsIntro}
            </p>

            {/* Plain <img> grid — no Next/image loader, no aspect-[5/7]
                arbitrary class, no horizontal scroll quirks. Wraps onto
                multiple rows on every viewport so every poster is always
                visible without scrolling. */}
            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {eventsPosters.map((p, i) => (
                <article
                  key={`${p.src}-${i}`}
                  className="overflow-hidden rounded-2xl border border-cream/10 bg-black/20"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.src}
                    alt={p.alt ?? ""}
                    className="block aspect-[5/7] w-full object-cover"
                    loading="lazy"
                  />
                </article>
              ))}
            </div>

            {/* In-page admin shortcut — only visible when admin Edit
                mode is on. One click opens the gallery editor for
                this section so the admin can upload, reorder and
                remove posters. */}
            <ManageGalleryLink galleryKey="hackney.events" />
          </div>
        </section>
      )}

      {/* Find us */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="font-display text-4xl sm:text-5xl">
              <Editable k="venue.hackney.findus.heading">{findusHeading}</Editable>
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-2xl p-7">
                <p className="text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
                  <Editable k="venue.hackney.findus.address_label">{findusAddressLabel}</Editable>
                </p>
                <address className="mt-3 whitespace-pre-line not-italic text-base leading-relaxed text-cream/90">
                  <Editable k="venue.hackney.findus.address" multiline>{findusAddress}</Editable>
                </address>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <div className="h-full rounded-2xl p-7">
                <p className="text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
                  <Editable k="venue.hackney.findus.transport_label">{findusTransportLabel}</Editable>
                </p>
                <div className="mt-3 text-sm text-cream/80">
                  <Editable k="venue.hackney.findus.transport" multiline>
                    {findusTransport
                      .split("\n")
                      .map((line) => "• " + line.trim())
                      .filter((line) => line !== "• ")
                      .join("\n")}
                  </Editable>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  kImage,
  fallbackImage,
  kTitle,
  kBody,
  title,
  body,
  href,
  hrefLabel,
}: {
  kImage: string;
  fallbackImage: string;
  kTitle: string;
  kBody: string;
  title: string;
  body: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <Reveal>
      <article className="group flex h-full flex-col overflow-hidden rounded-2xl transition">
        <DisplayImage
          k={kImage}
          fallback={fallbackImage}
          aspect="5/3"
        />
        <div className="flex flex-1 flex-col p-6">
          <h3 className="font-display text-2xl">
            <Editable k={kTitle}>{title}</Editable>
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-cream/75">
            <Editable k={kBody} multiline>{body}</Editable>
          </p>
          {href && (
            <a
              href={href}
              className="mt-4 inline-block text-xs font-bold uppercase tracking-wider text-plonkYellow transition hover:text-cream"
            >
              {hrefLabel ?? "Find out more"} →
            </a>
          )}
        </div>
      </article>
    </Reveal>
  );
}
