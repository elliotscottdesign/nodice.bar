"use client";

import Link from "next/link";
import PageHero from "@/components/PageHero";
import Gallery from "@/components/Gallery";
import Reveal from "@/components/Reveal";
import { useContent, useImage, useGallery } from "@/lib/content";
import { Editable, DisplayImage } from "@/components/Editable";
import ManageGalleryLink from "@/components/ManageGalleryLink";

const BOROUGH_GALLERY_FALLBACK = [
  { src: "/borough/course/Course_2.jpg", alt: "Plonk Borough course" },
  { src: "/borough/course/Course_3.jpg", alt: "Borough London-themed course" },
  { src: "/borough/venue/Venue_1.jpg", alt: "Borough arches interior" },
  { src: "/borough/drinks/Cocktail_1.jpg", alt: "Borough cocktail" },
  { src: "/borough/course/Course_4.jpg", alt: "Borough course detail" },
  { src: "/borough/games/Games_3.jpg", alt: "Borough arcade and pool" },
  { src: "/borough/drinks/Beer_1.jpg", alt: "Borough craft beer" },
  { src: "/borough/course/Course_5.jpg", alt: "Borough course" },
  { src: "/borough/drinks/Cocktail_4.jpg", alt: "Borough cocktail trio" },
  { src: "/borough/games/Games_4.jpg", alt: "Borough games" },
  { src: "/borough/drinks/Cocktail_5.jpg", alt: "Borough drinks" },
  { src: "/borough/games/Games_6.jpg", alt: "Borough arcade detail" },
];

// Six fixed feature card "slots". The image / title / body for each slot
// is editable from /admin/content/venue/borough — the slot positions are
// kept stable so links don't reshuffle when the admin edits text. The
// fallbacks here are what shipped originally.
const FEATURES = [
  {
    keyPrefix: "venue.borough.feature1",
    fallback: {
      image: "/borough/games/Games_1.jpg",
      title: "Retro arcade",
      body:
        "Shooters, button-bashers, foosball, ping pong, plus one of London's biggest pinball collections. Buy tokens at the bar — no booking needed.",
    },
  },
  {
    keyPrefix: "venue.borough.feature2",
    fallback: {
      image: "/borough/games/Games_2.jpg",
      title: "Pool tables",
      body:
        "Two brand-new British 7ft pool tables, bookable at £5 for 30 minutes. Please note: under-18s aren't permitted to play.",
    },
  },
  {
    keyPrefix: "venue.borough.feature3",
    fallback: {
      image: "/borough/drinks/Cocktail_3.jpg",
      title: "Cocktails & craft",
      body:
        "Fully licensed bar — signature cocktails, classics, wines, cold craft beers and non-alcoholic drinks. Open till 11pm: drink while you putt, or push on into the night.",
    },
  },
  {
    keyPrefix: "venue.borough.feature4",
    fallback: {
      image: "/borough/drinks/Beer_2.png",
      title: "Local beer on tap",
      body:
        "Rotating local kegs alongside our regulars. Whatever's on, it'll be cold and properly poured.",
    },
  },
  {
    keyPrefix: "venue.borough.feature5",
    fallback: {
      image: "/borough/course/Course_6.jpg",
      title: "Murals & street art",
      body:
        "A 360° gallery on the walls, ceiling and floor — painted by some of London's most renowned spray-can talent. The course is the start; the arches are the show.",
    },
  },
  {
    keyPrefix: "venue.borough.feature6",
    fallback: {
      image: "/borough/games/Games_5.jpg",
      title: "Doubles pool tournament",
      body:
        "3rd Wednesday of the month. £200+ in bar tabs, medals, beer cases and Tees. Eight slots — always sells out.",
    },
  },
];

export default function BoroughMarketPage() {
  // Hero
  const eyebrow = useContent(
    "venue.borough.eyebrow",
    "Borough Market · Indoor · 9 holes",
  );
  const title = useContent("venue.borough.title", "Crazy Golf at London Bridge");
  const intro = useContent(
    "venue.borough.intro",
    "Tucked into four railway arches under London Bridge. A 360° gallery from London's best street artists, surrounding nine holes of London icons.",
  );
  const heroImage = useImage("venue.borough.hero_image", "");

  const bodyEyebrow = useContent(
    "venue.borough.body_eyebrow",
    "London, in one course",
  );
  const bodyHeading = useContent(
    "venue.borough.body_heading",
    "All of London, in 9 holes",
  );
  const bodyIntro = useContent(
    "venue.borough.body_intro",
    "Putt past a red phone box ramp, roll around the Thames Barrier, hop into the Tower of London, loop the London Eye and stride down Tower Bridge — all under London Bridge itself, surrounded by murals from the city's best spray-can talent.",
  );

  // Features section
  const featuresEyebrow = useContent(
    "venue.borough.features.eyebrow",
    "Across four arches",
  );
  const featuresHeading = useContent(
    "venue.borough.features.heading",
    "What's under the arches",
  );

  // Each feature card — title + body resolved via useContent below, image
  // resolved inside FeatureCard via useImage.
  const f1Title = useContent(FEATURES[0].keyPrefix + ".title", FEATURES[0].fallback.title);
  const f1Body = useContent(FEATURES[0].keyPrefix + ".body", FEATURES[0].fallback.body);
  const f2Title = useContent(FEATURES[1].keyPrefix + ".title", FEATURES[1].fallback.title);
  const f2Body = useContent(FEATURES[1].keyPrefix + ".body", FEATURES[1].fallback.body);
  const f3Title = useContent(FEATURES[2].keyPrefix + ".title", FEATURES[2].fallback.title);
  const f3Body = useContent(FEATURES[2].keyPrefix + ".body", FEATURES[2].fallback.body);
  const f4Title = useContent(FEATURES[3].keyPrefix + ".title", FEATURES[3].fallback.title);
  const f4Body = useContent(FEATURES[3].keyPrefix + ".body", FEATURES[3].fallback.body);
  const f5Title = useContent(FEATURES[4].keyPrefix + ".title", FEATURES[4].fallback.title);
  const f5Body = useContent(FEATURES[4].keyPrefix + ".body", FEATURES[4].fallback.body);
  const f6Title = useContent(FEATURES[5].keyPrefix + ".title", FEATURES[5].fallback.title);
  const f6Body = useContent(FEATURES[5].keyPrefix + ".body", FEATURES[5].fallback.body);
  const editableFeatures = [
    { ...FEATURES[0], title: f1Title, body: f1Body },
    { ...FEATURES[1], title: f2Title, body: f2Body },
    { ...FEATURES[2], title: f3Title, body: f3Body },
    { ...FEATURES[3], title: f4Title, body: f4Body },
    { ...FEATURES[4], title: f5Title, body: f5Body },
    { ...FEATURES[5], title: f6Title, body: f6Body },
  ];

  // Gallery
  const galleryHeading = useContent(
    "venue.borough.gallery_heading",
    "Inside Plonk Borough",
  );
  const galleryIntro = useContent(
    "venue.borough.gallery_intro",
    "The London-themed course, the arcade, the bar — all under London Bridge.",
  );
  const galleryImages = useGallery(
    "venue.borough.gallery",
    BOROUGH_GALLERY_FALLBACK,
  ).map((g) => ({ src: g.src, alt: g.alt ?? "" }));

  // Find us
  const findusHeading = useContent("venue.borough.findus.heading", "Find us");
  const findusCallout = useContent(
    "venue.borough.findus.callout",
    "Don't follow the postcode. We're in the arches under Borough High Street, just off Green Dragon Court. Search \"Plonk Borough\" on Google Maps rather than the address.",
  );
  const findusAddress = useContent(
    "venue.borough.findus.address",
    "Arches B, C, D & E Montague Close\nOff Green Dragon Court\nLondon SE1 9DA",
  );
  const findusEntrance = useContent(
    "venue.borough.findus.entrance",
    "The entrance is in a courtyard just below street level, directly next door to Boro Bistro.",
  );
  const findusAccessHeading = useContent(
    "venue.borough.findus.access_heading",
    "Accessibility",
  );
  const findusAccessBody = useContent(
    "venue.borough.findus.access_body",
    "Plonk Borough is accessible — there are step-free ways down to our courtyard. If you need help finding the easiest route, get in touch before your visit at info@plonkgolf.co.uk.",
  );

  const sliderImages = [
    "/borough/course/Course_1.jpg",
    "/borough/course/Course_3.jpg",
    "/borough/games/Games_1.jpg",
    "/borough/drinks/Cocktail_1.jpg",
    "/borough/course/Course_4.jpg",
    "/borough/games/Games_3.jpg",
    "/borough/drinks/Beer_1.jpg",
    "/borough/venue/Venue_1.jpg",
  ];

  return (
    <main>
      <PageHero
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        image={heroImage || sliderImages}
        eyebrowKey="venue.borough.eyebrow"
        titleKey="venue.borough.title"
        introKey="venue.borough.intro"
        imageKey="venue.borough.hero_image"
        sliderKey="hero.venue.borough"
      />

      {/* London course intro */}
      <section className="tint-forest-to-plum relative overflow-hidden px-6 py-20 md:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-16">
          <Reveal>
            <div className="md:order-2">
              <DisplayImage
                k="venue.borough.body_image"
                fallback="/borough/course/Course_2.jpg"
                aspect="4/5"
                alt="Borough London-themed course"
                rounded
              />
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="md:order-1">
              <p className="text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
                <Editable k="venue.borough.body_eyebrow">{bodyEyebrow}</Editable>
              </p>
              <h2 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
                <Editable k="venue.borough.body_heading">{bodyHeading}</Editable>
              </h2>
              <p className="mt-6 whitespace-pre-line text-base leading-relaxed text-cream/80 sm:text-lg">
                <Editable k="venue.borough.body_intro" multiline>{bodyIntro}</Editable>
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/book/borough"
                  className="inline-block rounded-full bg-plonkPink px-8 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-plonkPink/20 transition hover:bg-plonkPink/90"
                >
                  Book Borough
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
        </div>
      </section>

      {/* What's under the arches */}
      <section className="tint-plum relative overflow-hidden px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-center text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
              <Editable k="venue.borough.features.eyebrow">{featuresEyebrow}</Editable>
            </p>
            <h2 className="mt-6 text-center font-display text-4xl sm:text-5xl">
              <Editable k="venue.borough.features.heading">{featuresHeading}</Editable>
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {editableFeatures.map((f, i) => (
              <FeatureCard
                key={i}
                kImage={f.keyPrefix + ".image"}
                kTitle={f.keyPrefix + ".title"}
                kBody={f.keyPrefix + ".body"}
                fallbackImage={f.fallback.image}
                title={f.title}
                body={f.body}
              />
            ))}
          </div>
        </div>
      </section>

      <Gallery
        heading={galleryHeading}
        intro={galleryIntro}
        images={galleryImages}
        tint="tint-plum-island-ember"
      />
      <div className="px-6 -mt-4 pb-8">
        <ManageGalleryLink galleryKey="venue.borough.gallery" />
      </div>

      {/* Find us */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="font-display text-4xl sm:text-5xl">
              <Editable k="venue.borough.findus.heading">{findusHeading}</Editable>
            </h2>
          </Reveal>

          {findusCallout && (
            <Reveal delay={100}>
              <div className="mt-6 whitespace-pre-line rounded-2xl border border-plonkYellow/40 bg-plonkYellow/10 p-5 text-sm leading-relaxed text-plonkYellow">
                <Editable k="venue.borough.findus.callout" multiline>{findusCallout}</Editable>
              </div>
            </Reveal>
          )}

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-2xl border border-plumLine/60 p-7">
                <p className="text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
                  Address
                </p>
                <address className="mt-3 whitespace-pre-line not-italic text-base leading-relaxed text-cream/90">
                  <Editable k="venue.borough.findus.address" multiline>{findusAddress}</Editable>
                </address>
                {findusEntrance && (
                  <p className="mt-3 whitespace-pre-line text-sm text-cream/65">
                    <Editable k="venue.borough.findus.entrance" multiline>{findusEntrance}</Editable>
                  </p>
                )}
              </div>
            </Reveal>
            <Reveal delay={100}>
              <div className="h-full rounded-2xl border border-plumLine/60 p-7">
                <p className="text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
                  <Editable k="venue.borough.findus.access_heading">{findusAccessHeading}</Editable>
                </p>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-cream/80">
                  <Editable k="venue.borough.findus.access_body" multiline>{findusAccessBody}</Editable>
                </p>
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
  kTitle,
  kBody,
  fallbackImage,
  title,
  body,
}: {
  kImage: string;
  kTitle: string;
  kBody: string;
  fallbackImage: string;
  title: string;
  body: string;
}) {
  return (
    <Reveal>
      <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-plumLine/50 transition hover:border-plonkYellow/40">
        <DisplayImage k={kImage} fallback={fallbackImage} aspect="5/3" />
        <div className="flex flex-1 flex-col p-6">
          <h3 className="font-display text-2xl">
            <Editable k={kTitle}>{title}</Editable>
          </h3>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-cream/75">
            <Editable k={kBody} multiline>{body}</Editable>
          </p>
        </div>
      </article>
    </Reveal>
  );
}

