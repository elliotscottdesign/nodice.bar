"use client";

import {
  Cake,
  Gift,
  Briefcase,
  Sun,
  Trees,
  Sparkles,
  PartyPopper,
  Music,
  Camera,
  Utensils,
  Wine,
  Users,
  Tag,
  type LucideIcon,
} from "lucide-react";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import BigEmailCta from "@/components/BigEmailCta";
import { useContent, useImage } from "@/lib/content";
import { Editable } from "@/components/Editable";

// Pick an icon by keyword for a free-text "popular for" use-case.
// CMS-editable — falls back to a generic Tag icon when nothing
// matches so the grid never breaks on a custom string.
function iconForUseCase(label: string): LucideIcon {
  const t = label.toLowerCase();
  if (/birthday/.test(t)) return Cake;
  if (/christmas|xmas|festive|holiday/.test(t)) return Gift;
  if (/corporate|office|work|company|team/.test(t)) return Briefcase;
  if (/outdoor|garden|terrace|beer garden/.test(t)) return Sun;
  if (/park|green/.test(t)) return Trees;
  if (/unusual|unique|quirky|different/.test(t)) return Sparkles;
  if (/party|club|night/.test(t)) return PartyPopper;
  if (/music|dj|live/.test(t)) return Music;
  if (/photo|shoot|brand|launch/.test(t)) return Camera;
  if (/food|dinner|tasting/.test(t)) return Utensils;
  if (/drink|cocktail|wine/.test(t)) return Wine;
  if (/group|crowd|guest|hen|stag/.test(t)) return Users;
  return Tag;
}

// =============================================================
// /privatehire — single-venue private hire page
// =============================================================
// Single-venue site → the previous /privatehire (overview) +
// /privatehire/hackney (Hackney fact sheet) split has been folded
// into ONE page that lives here. /privatehire/hackney now redirects
// to /privatehire.
//
// CMS keys remain on the `privatehire.hackney.*` namespace so any
// edits the founder has already made are preserved without a
// migration. New keys for this page should use the same prefix.
// =============================================================

function lines(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

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

// Catering rows prefixed with "no:" / "n:" render as the "we don't
// do this" strikethrough column. Anything else is a tick.
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
  hero_image: "",
  eyebrow: "Private hire · No Dice",
  title: "Take Over No Dice",
  intro:
    "London Fields' newest bar — yours for the night. Two arches of pool, drinks and snacks for parties of up to 65.",
  popular_heading: "No Dice is popular for",
  popular_list:
    "Birthday party\nChristmas party\nCorporate event\nOutdoor space\nParkside location\nUnusual space",
  about_heading: "About this venue",
  about_body:
    "We're a neighbourhood bar in the railway arches off London Fields, ready to host your party or event. You bring the people, and we'll provide them with a fantastic selection of drinks from our cocktail bar alongside Snack Bar burgers from the kitchen.\n\nThe venue features two pool tables, a full bar with craft beer + cocktails, plenty of room for groups and the option to take over either an arch-end or the whole place. We can accommodate up to 65 people for private hires.",
  capacity:
    "Standing: 65\nDining: 40\nCabaret: 30",
  features:
    "Two pool tables\nFull cocktail bar\nCraft beer on draught\nSnack Bar kitchen\nNatural light\nWi-Fi\nStorage space\nStep-free access",
  catering:
    "In-house catering\nApproved caterers only\nWe provide alcohol\nKitchen facilities available\nHalal available\nKosher available\nComplimentary water\nExtensive vegan menu\nExtensive gluten-free menu\nBuyout fee for external catering\nno: External catering (general)\nno: BYOB alcohol\nno: Complimentary tea & coffee",
  licences:
    "Alcohol licence until 23:00. Later licenses can be applied for with notice.",
  welcomes:
    "Games competitions / tournaments\nVIP events\nPrivate parties\nOwn music equipment / DJ",
  house_rules: "No outside catering. No BYOB. Background music only.",
};

export default function PrivateHirePage() {
  const heroImage = useImage(
    "privatehire.hackney.hero_image",
    DEFAULTS.hero_image,
  );
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
  const aboutBody = useContent(
    "privatehire.hackney.about_body",
    DEFAULTS.about_body,
  );

  const capacities = pairs(
    useContent("privatehire.hackney.capacity", DEFAULTS.capacity),
  );
  const features = lines(
    useContent("privatehire.hackney.features", DEFAULTS.features),
  );
  const { yes: cateringYes, no: cateringNo } = cateringRows(
    useContent("privatehire.hackney.catering", DEFAULTS.catering),
  );
  const licences = useContent(
    "privatehire.hackney.licences",
    DEFAULTS.licences,
  );
  const welcomes = lines(
    useContent("privatehire.hackney.welcomes", DEFAULTS.welcomes),
  );
  const houseRules = useContent(
    "privatehire.hackney.house_rules",
    DEFAULTS.house_rules,
  );

  // Section titles. Hardcoded for years — surfacing them as CMS
  // fields means the founder can rename "Capacity" → "Numbers" or
  // "Venue welcomes" → "Yes to" etc., direct from the live page.
  const capacityTitle = useContent(
    "privatehire.hackney.capacity_title",
    "Capacity",
  );
  const featuresTitle = useContent(
    "privatehire.hackney.features_title",
    "Room features",
  );
  const cateringTitle = useContent(
    "privatehire.hackney.catering_title",
    "Catering",
  );
  const licencesTitle = useContent(
    "privatehire.hackney.licences_title",
    "Licences",
  );
  const welcomesTitle = useContent(
    "privatehire.hackney.welcomes_title",
    "Venue welcomes",
  );
  const houseRulesTitle = useContent(
    "privatehire.hackney.house_rules_title",
    "House rules",
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
            <p className="text-xs font-bold uppercase tracking-eyebrow text-plonkTeal">
              <Editable k="privatehire.hackney.popular_heading">
                {popularHeading}
              </Editable>
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-6">
              {popularList.map((t) => {
                const Icon = iconForUseCase(t);
                return (
                  <div
                    key={t}
                    className="flex flex-col items-center gap-3 rounded-2xl border border-plumLine/80 bg-plumDeep/60 px-3 py-5 text-center transition hover:border-plonkTeal/40"
                  >
                    <Icon
                      className="h-7 w-7 text-plonkTeal"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-medium leading-tight text-cream/90 sm:text-sm">
                      {t}
                    </span>
                  </div>
                );
              })}
            </div>
          </Reveal>

          <Reveal delay={120}>
            <h2 className="mt-12 font-display text-3xl leading-tight sm:text-4xl">
              <Editable k="privatehire.hackney.about_heading">
                {aboutHeading}
              </Editable>
            </h2>
            <div className="mt-6 text-base leading-relaxed text-cream/85 sm:text-lg">
              <p className="whitespace-pre-line">
                <Editable k="privatehire.hackney.about_body" multiline>
                  {aboutBody}
                </Editable>
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Fact sheet */}
      <section className="tint-plumDeep-to-plum px-6 py-24">
        <div className="mx-auto max-w-6xl space-y-12">
          <FactPanel title={capacityTitle} titleKey="privatehire.hackney.capacity_title">
            <div className="grid gap-4 sm:grid-cols-3">
              {capacities.map((c) => (
                <div
                  key={c.label}
                  className="rounded-2xl border border-plumLine/80 bg-plumDeep/60 p-6 text-center"
                >
                  <p className="text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
                    {c.label}
                  </p>
                  <p className="mt-3 font-display text-5xl text-cream">
                    {c.value}
                  </p>
                </div>
              ))}
            </div>
          </FactPanel>

          <FactPanel title={featuresTitle} titleKey="privatehire.hackney.features_title">
            <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-3 text-sm text-cream/90"
                >
                  <Check />
                  {f}
                </li>
              ))}
            </ul>
          </FactPanel>

          <FactPanel title={cateringTitle} titleKey="privatehire.hackney.catering_title">
            <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
              <ul className="space-y-3">
                {cateringYes.map((c) => (
                  <li
                    key={c}
                    className="flex items-start gap-3 text-sm text-cream/90"
                  >
                    <Check />
                    {c}
                  </li>
                ))}
              </ul>
              <ul className="space-y-3">
                {cateringNo.map((c) => (
                  <li
                    key={c}
                    className="flex items-start gap-3 text-sm text-cream/60"
                  >
                    <Cross />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </FactPanel>

          <FactPanel title={licencesTitle} titleKey="privatehire.hackney.licences_title">
            <p className="whitespace-pre-line text-sm leading-relaxed text-cream/85 sm:text-base">
              <Editable k="privatehire.hackney.licences" multiline>
                {licences}
              </Editable>
            </p>
          </FactPanel>

          <FactPanel title={welcomesTitle} titleKey="privatehire.hackney.welcomes_title">
            <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {welcomes.map((w) => (
                <li
                  key={w}
                  className="flex items-center gap-3 text-sm text-cream/90"
                >
                  <Check />
                  {w}
                </li>
              ))}
            </ul>
          </FactPanel>

          <FactPanel title={houseRulesTitle} titleKey="privatehire.hackney.house_rules_title">
            <p className="whitespace-pre-line text-sm leading-relaxed text-cream/85 sm:text-base">
              <Editable k="privatehire.hackney.house_rules" multiline>
                {houseRules}
              </Editable>
            </p>
          </FactPanel>
        </div>
      </section>

      <BigEmailCta subject="Private Hire Enquiry — No Dice" />
    </main>
  );
}

function FactPanel({
  title,
  titleKey,
  children,
}: {
  title: string;
  /** CMS key for the title — wrapping it in Editable lets the
   *  founder click-to-edit the section heading on the live page. */
  titleKey: string;
  children: React.ReactNode;
}) {
  return (
    <Reveal>
      <div className="rounded-3xl border border-plumLine/60 p-7 sm:p-9">
        <h3 className="font-display text-2xl text-plonkYellow sm:text-3xl">
          <Editable k={titleKey}>{title}</Editable>
        </h3>
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
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
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
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </span>
  );
}
