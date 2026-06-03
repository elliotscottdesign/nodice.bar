"use client";

import Link from "next/link";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import BigEmailCta from "@/components/BigEmailCta";
import { useContent, useImage } from "@/lib/content";
import { Editable } from "@/components/Editable";

// Split a textarea value (one item per line) into a clean list of
// strings — used everywhere a fact panel renders bullets.
function lines(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

// For lines like "Label: Value" — used by the Capacity panel.
function pairs(s: string): { label: string; value: string }[] {
  return lines(s).map((line) => {
    const idx = line.indexOf(":");
    if (idx < 0) return { label: line, value: "" };
    return {
      label: line.slice(0, idx).trim(),
      value: line.slice(idx + 1).trim(),
    };
  });
}

// Catering rows can be prefixed with "no:" / "n:" to mark them as
// strikethrough (the "we don't do this" column). Anything else is
// rendered with a tick. Lets the admin manage both lists from one
// textarea without us needing two separate fields.
function cateringRows(s: string): { yes: string[]; no: string[] } {
  const yes: string[] = [];
  const no: string[] = [];
  for (const line of lines(s)) {
    if (/^no:\s*/i.test(line)) no.push(line.replace(/^no:\s*/i, ""));
    else if (/^n:\s*/i.test(line)) no.push(line.replace(/^n:\s*/i, ""));
    else yes.push(line);
  }
  return { yes, no };
}

const DEFAULTS = {
  hero_image: "/hackney/garden/Garden_1.jpg",
  eyebrow: "Private hire · Plonk Hackney",
  title: "Take Over Plonk Hackney",
  intro: "Our nine-hole Polynesian course, beer garden, pool, arcade and tiki bar — all yours.",
  popular_heading: "Plonk Hackney is popular for",
  popular_list:
    "Birthday party\nChristmas party\nCorporate event\nOutdoor space\nParkside location\nUnusual space",
  about_heading: "About this venue",
  about_body:
    "This isn't just another nine-hole mini golf course — it's a full games bar with a wide range of options to keep you and your guests entertained for hours. We're ready to host your party or event. You bring the people, and we'll provide them with a fantastic selection of drinks from our cocktail bar, alongside Snack Bar burgers from the kitchen.\n\nOur Hackney venue features a full nine-hole Polynesian course, two pool tables, retro arcade machines, modern pinball and a big selection of board games. We can accommodate up to 65 people for private hires.",
  capacity:
    "Standing: 65\nDining: 40\nCabaret: 30",
  features:
    "9-hole crazy golf\nRetro arcade\nPool tables\nPinball + board games\nOutdoor beer garden\nTiki cocktail bar\nSnack Bar kitchen\nNatural light\nWi-Fi\nStorage space\nStep-free access",
  catering:
    "In-house catering\nApproved caterers only\nWe provide alcohol\nKitchen facilities available\nHalal available\nKosher available\nComplimentary water\nExtensive vegan menu\nExtensive gluten-free menu\nBuyout fee for external catering\nno: External catering (general)\nno: BYOB alcohol\nno: Complimentary tea & coffee",
  licences:
    "Alcohol licence until 23:00. Later licenses can be applied for with notice.",
  welcomes:
    "Games competitions / tournaments\nVIP events\nPrivate parties\nOwn music equipment / DJ",
  house_rules: "No outside catering. No BYOB. Background music only.",
};

export default function HackneyPrivateHirePage() {
  const heroImage = useImage("privatehire.hackney.hero_image", DEFAULTS.hero_image);
  const eyebrow = useContent("privatehire.hackney.eyebrow", DEFAULTS.eyebrow);
  const title = useContent("privatehire.hackney.title", DEFAULTS.title);
  const intro = useContent("privatehire.hackney.intro", DEFAULTS.intro);

  const popularHeading = useContent(
    "privatehire.hackney.popular_heading",
    DEFAULTS.popular_heading,
  );
  const popularList = lines(
    useContent("privatehire.hackney.popular_list", DEFAULTS.popular_list),
  );
  const aboutHeading = useContent(
    "privatehire.hackney.about_heading",
    DEFAULTS.about_heading,
  );
  const aboutBody = useContent("privatehire.hackney.about_body", DEFAULTS.about_body);

  const capacities = pairs(
    useContent("privatehire.hackney.capacity", DEFAULTS.capacity),
  );
  const features = lines(
    useContent("privatehire.hackney.features", DEFAULTS.features),
  );
  const { yes: cateringYes, no: cateringNo } = cateringRows(
    useContent("privatehire.hackney.catering", DEFAULTS.catering),
  );
  const licences = useContent("privatehire.hackney.licences", DEFAULTS.licences);
  const welcomes = lines(
    useContent("privatehire.hackney.welcomes", DEFAULTS.welcomes),
  );
  const houseRules = useContent(
    "privatehire.hackney.house_rules",
    DEFAULTS.house_rules,
  );

  return (
    <main>
      <PageHero
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        image={heroImage}
        eyebrowKey="privatehire.hackney.eyebrow"
        titleKey="privatehire.hackney.title"
        introKey="privatehire.hackney.intro"
        imageKey="privatehire.hackney.hero_image"
        sliderKey="hero.privatehire.hackney"
      />

      {/* Popular for + about */}
      <section className="tint-forest-to-plumDeep px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
              <Editable k="privatehire.hackney.popular_heading">{popularHeading}</Editable>
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
              <Editable k="privatehire.hackney.about_heading">{aboutHeading}</Editable>
            </h2>
            <div className="mt-6 text-base leading-relaxed text-cream/85 sm:text-lg">
              <p className="whitespace-pre-line">
                <Editable k="privatehire.hackney.about_body" multiline>{aboutBody}</Editable>
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Fact sheet */}
      <section className="tint-plumDeep-to-plum px-6 py-24">
        <div className="mx-auto max-w-6xl space-y-12">
          <FactPanel title="Capacity">
            <div className="grid gap-4 sm:grid-cols-3">
              {capacities.map((c) => (
                <div
                  key={c.label}
                  className="rounded-2xl border border-plumLine/80 bg-plumDeep/60 p-6 text-center"
                >
                  <p className="text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
                    {c.label}
                  </p>
                  <p className="mt-3 font-display text-5xl text-cream">{c.value}</p>
                </div>
              ))}
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
            <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
              <ul className="space-y-3">
                {cateringYes.map((c) => (
                  <li key={c} className="flex items-start gap-3 text-sm text-cream/90">
                    <Check />
                    {c}
                  </li>
                ))}
              </ul>
              <ul className="space-y-3">
                {cateringNo.map((c) => (
                  <li key={c} className="flex items-start gap-3 text-sm text-cream/60">
                    <Cross />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </FactPanel>

          <FactPanel title="Licences">
            <p className="whitespace-pre-line text-sm leading-relaxed text-cream/85 sm:text-base">
              <Editable k="privatehire.hackney.licences" multiline>{licences}</Editable>
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
              <Editable k="privatehire.hackney.house_rules" multiline>{houseRules}</Editable>
            </p>
          </FactPanel>

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

      <BigEmailCta subject="Private Hire Enquiry — Plonk Hackney" />
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

function Cross() {
  return (
    <span
      aria-hidden
      className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cream/10 text-cream/50"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </span>
  );
}
