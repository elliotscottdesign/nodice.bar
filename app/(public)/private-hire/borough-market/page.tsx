"use client";

import Link from "next/link";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import BigEmailCta from "@/components/BigEmailCta";
import { useContent, useImage } from "@/lib/content";
import { Editable } from "@/components/Editable";

function lines(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

const DEFAULTS = {
  hero_image: "/borough/course/Course_4.jpg",
  eyebrow: "Private hire · Plonk Borough Market",
  title: "Take Over Plonk Borough",
  intro: "Four railway arches under London Bridge — yours for the night.",
  popular_heading: "Plonk Borough is popular for",
  popular_list:
    "Birthday party\nChristmas party\nCorporate event\nUnusual space",
  about_heading: "About this venue",
  about_body:
    "Plonk at Borough Market is a celebration of all things London. A crew of London's best muralists and street artists have created a 360° gallery on the walls, ceiling and floor of the arches underneath London Bridge. This festival of street art wraps a nine-hole golf course that showcases the city's most famous monuments, sights and traditions — and some of our best ever obstacles.\n\nWith a full-service cocktail bar and a packed arcade — shooters, fighters, button-bashers, air hockey, ping pong, foosball and pinball — there's something here for every kind of guest. We can accommodate up to 100 people for private hires.",
  capacity:
    "Standing: 100\n— Perfect for smaller takeovers — and ideal to combine with a meal out in the market afterwards.",
  features:
    "9-hole crazy golf\nFull arcade\nCocktail bar\nPool tables\nPinball & ping pong\nStreet-art murals\nStorage space\nStep-free access",
  catering:
    "We offer sharing platters and boards at Borough Market — vegetarian boards, charcuterie sharers, and dip selections.",
  licences:
    "Alcohol licence until 20:00. Temporary Events Notice for later licence may be available on request.",
  welcomes:
    "Games competitions / tournaments\nVIP events\nPrivate parties\nOwn music playlists",
  house_rules: "No outside catering. Background music only.",
  testimonial:
    "\"Thank you for hosting our 2019 Summer Intern event — the feedback from the group has been great, they really enjoyed themselves.\"\n— Brad",
};

export default function BoroughPrivateHirePage() {
  const heroImage = useImage("privatehire.borough.hero_image", DEFAULTS.hero_image);
  const eyebrow = useContent("privatehire.borough.eyebrow", DEFAULTS.eyebrow);
  const title = useContent("privatehire.borough.title", DEFAULTS.title);
  const intro = useContent("privatehire.borough.intro", DEFAULTS.intro);

  const popularHeading = useContent(
    "privatehire.borough.popular_heading",
    DEFAULTS.popular_heading,
  );
  const popularList = lines(
    useContent("privatehire.borough.popular_list", DEFAULTS.popular_list),
  );
  const aboutHeading = useContent(
    "privatehire.borough.about_heading",
    DEFAULTS.about_heading,
  );
  const aboutBody = useContent("privatehire.borough.about_body", DEFAULTS.about_body);

  const capacity = useContent("privatehire.borough.capacity", DEFAULTS.capacity);
  const features = lines(
    useContent("privatehire.borough.features", DEFAULTS.features),
  );
  const catering = useContent("privatehire.borough.catering", DEFAULTS.catering);
  const licences = useContent("privatehire.borough.licences", DEFAULTS.licences);
  const welcomes = lines(
    useContent("privatehire.borough.welcomes", DEFAULTS.welcomes),
  );
  const houseRules = useContent(
    "privatehire.borough.house_rules",
    DEFAULTS.house_rules,
  );
  const testimonial = useContent(
    "privatehire.borough.testimonial",
    DEFAULTS.testimonial,
  );

  // Capacity textarea: first line "Standing: 100", optional further
  // lines render as small print under the big number.
  const capacityLines = capacity.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const capacityHead = capacityLines[0] ?? "";
  const capacityIdx = capacityHead.indexOf(":");
  const capacityLabel =
    capacityIdx >= 0 ? capacityHead.slice(0, capacityIdx).trim() : capacityHead;
  const capacityValue =
    capacityIdx >= 0 ? capacityHead.slice(capacityIdx + 1).trim() : "";
  const capacitySmall = capacityLines.slice(1).join(" ").replace(/^—\s*/, "");

  return (
    <main>
      <PageHero
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        image={heroImage}
        eyebrowKey="privatehire.borough.eyebrow"
        titleKey="privatehire.borough.title"
        introKey="privatehire.borough.intro"
        imageKey="privatehire.borough.hero_image"
        sliderKey="hero.privatehire.borough"
      />

      <section className="tint-forest-to-plumDeep px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
              <Editable k="privatehire.borough.popular_heading">{popularHeading}</Editable>
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {popularList.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-plumLine/80 bg-plumDeep/60 px-4 py-1.5 text-sm text-cream/90"
                >
                  {t}
                </span>
              ))}
            </div>
          </Reveal>

          <Reveal delay={120}>
            <h2 className="mt-12 font-display text-3xl leading-tight sm:text-4xl">
              <Editable k="privatehire.borough.about_heading">{aboutHeading}</Editable>
            </h2>
            <div className="mt-6 text-base leading-relaxed text-cream/85 sm:text-lg">
              <p className="whitespace-pre-line">
                <Editable k="privatehire.borough.about_body" multiline>{aboutBody}</Editable>
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="tint-plumDeep-to-plum px-6 py-24">
        <div className="mx-auto max-w-6xl space-y-12">
          <FactPanel title="Capacity">
            <div className="rounded-2xl border border-plumLine/80 bg-plumDeep/60 p-8 text-center">
              <p className="text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
                {capacityLabel}
              </p>
              <p className="mt-3 font-display text-6xl text-cream">{capacityValue}</p>
              {capacitySmall && (
                <p className="mt-4 text-sm text-cream/65">{capacitySmall}</p>
              )}
            </div>
          </FactPanel>

          <FactPanel title="Room features">
            <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-cream/90">
                  <Check />
                  {f}
                </li>
              ))}
            </ul>
          </FactPanel>

          <FactPanel title="Catering">
            <p className="whitespace-pre-line text-sm leading-relaxed text-cream/85 sm:text-base">
              <Editable k="privatehire.borough.catering" multiline>{catering}</Editable>
            </p>
          </FactPanel>

          <FactPanel title="Licences">
            <p className="whitespace-pre-line text-sm leading-relaxed text-cream/85 sm:text-base">
              <Editable k="privatehire.borough.licences" multiline>{licences}</Editable>
            </p>
          </FactPanel>

          <FactPanel title="Venue welcomes">
            <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {welcomes.map((w) => (
                <li key={w} className="flex items-center gap-3 text-sm text-cream/90">
                  <Check />
                  {w}
                </li>
              ))}
            </ul>
          </FactPanel>

          <FactPanel title="House rules">
            <p className="whitespace-pre-line text-sm leading-relaxed text-cream/85 sm:text-base">
              <Editable k="privatehire.borough.house_rules" multiline>{houseRules}</Editable>
            </p>
          </FactPanel>

          {testimonial && (
            <FactPanel title="Testimonial">
              <blockquote className="whitespace-pre-line text-base leading-relaxed text-cream/90 sm:text-lg">
                <Editable k="privatehire.borough.testimonial" multiline>{testimonial}</Editable>
              </blockquote>
            </FactPanel>
          )}

          <Reveal>
            <Link
              href="/private-hire"
              className="inline-flex items-center text-sm font-semibold uppercase tracking-wider text-cream/70 transition hover:text-cream"
            >
              ← Back to private hire
            </Link>
          </Reveal>
        </div>
      </section>

      <BigEmailCta subject="Private Hire Enquiry — Plonk Borough Market" />
    </main>
  );
}

function FactPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Reveal>
      <div className="rounded-3xl border border-plumLine/60 p-7 sm:p-9">
        <h3 className="font-display text-2xl text-plonkYellow sm:text-3xl">{title}</h3>
        <div className="mt-6">{children}</div>
      </div>
    </Reveal>
  );
}

function Check() {
  return (
    <span
      aria-hidden
      className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-plonkYellow/15 text-plonkYellow"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}
