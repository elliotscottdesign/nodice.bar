"use client";

import { useEffect, useRef, useState } from "react";
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
  CircleDot,
  Gamepad2,
  Target,
  Disc3,
  Flag,
  Dices,
  Truck,
  ChefHat,
  LayoutGrid,
} from "lucide-react";
import PageHero from "@/components/PageHero";
import MediaStrip from "@/components/MediaStrip";
import RollerDeck from "@/components/RollerDeck";
import ManageGalleryLink from "@/components/ManageGalleryLink";
import XmasMenuTab from "@/components/XmasMenuTab";
import XmasPackageBuilder from "@/components/XmasPackageBuilder";
import { useEditMode } from "@/lib/editMode";
import Reveal from "@/components/Reveal";
import BigEmailCta from "@/components/BigEmailCta";
import InstagramFeed from "@/components/InstagramFeed";
import { useContent, useImage, useGallery } from "@/lib/content";
import { Editable } from "@/components/Editable";

// Icon component shape shared by the lucide icons and our custom SVGs
// below — just the props the grid actually passes.
type UseCaseIcon = React.ComponentType<{
  className?: string;
  strokeWidth?: string | number;
  "aria-hidden"?: boolean | "true" | "false";
}>;

// Table-tennis bat — lucide has no paddle, so this is a hand-drawn line
// icon in the same stroke style (blade + handle + ball).
function PingPongPaddle({
  className,
  strokeWidth = 1.5,
  ...rest
}: {
  className?: string;
  strokeWidth?: string | number;
  "aria-hidden"?: boolean | "true" | "false";
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...rest}
    >
      <circle cx="9.5" cy="9.5" r="6.2" />
      <path d="M13.9 13.9l4 4.1a1.9 1.9 0 0 1-2.7 2.7l-4-4.1" />
      <circle cx="18.5" cy="6" r="1.3" />
    </svg>
  );
}

// Pick an icon by keyword for a free-text "popular for" use-case.
// CMS-editable — falls back to a generic Tag icon when nothing
// matches so the grid never breaks on a custom string.
function iconForUseCase(label: string): UseCaseIcon {
  const t = label.toLowerCase();
  if (/birthday/.test(t)) return Cake;
  if (/christmas|xmas|festive|holiday/.test(t)) return Gift;
  if (/corporate|office|work|company|team/.test(t)) return Briefcase;
  if (/outdoor|garden|terrace|beer garden/.test(t)) return Sun;
  if (/park|green/.test(t)) return Trees;
  if (/unusual|unique|quirky|different/.test(t)) return Sparkles;
  // Venue activities. DJ rule sits before the generic music rule so "DJs"
  // gets the turntable icon; food-truck/catering sit before the generic
  // food rule so they don't collapse into plain cutlery.
  if (/pool|cue|billiard/.test(t)) return CircleDot;
  if (/mini.?golf|crazy golf|golf/.test(t)) return Flag;
  if (/bingo/.test(t)) return LayoutGrid;
  if (/board game|boardgame/.test(t)) return Dices;
  if (/dart/.test(t)) return Target; // the concentric "dartboard" icon
  if (/arcade|gaming/.test(t)) return Gamepad2;
  if (/ping.?pong|table tennis/.test(t)) return PingPongPaddle;
  if (/dj|deck|turntable/.test(t)) return Disc3;
  if (/food truck|food.?truck|truck/.test(t)) return Truck;
  if (/cater/.test(t)) return ChefHat;
  if (/party|club|night/.test(t)) return PartyPopper;
  if (/music|live/.test(t)) return Music;
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
    "Birthday party\nChristmas party\nCorporate event\nOutdoor space\nParkside location\nUnusual space\nPool\nArcade\nPing pong\nDJs\nBingo\nMini golf\nBoard games\nDarts\nFood truck\nCatering",
  about_heading: "About this venue",
  about_body:
    "We're a neighbourhood bar in the railway arches off London Fields, ready to host your party or event. You bring the people, and we'll provide them with a fantastic selection of drinks from our cocktail bar alongside Snack Bar burgers from the kitchen.\n\nThe venue features two pool tables, a full bar with craft beer + cocktails, plenty of room for groups and the option to take over either an arch-end or the whole place. We can accommodate up to 100 people for private hires.",
  capacity:
    "Standing: 100\nDining: 40\nCabaret: 60",
  features:
    "Two pool tables\nFull cocktail bar\nCraft beer on draught\nSnack Bar kitchen\nNatural light\nWi-Fi\nStorage space\nStep-free access\nFull DJ booth — 2× Technics SL-1200 MK7, 2× Pioneer CDJ-900 Nexus, rotary mixer\nMartin Audio sound system — bring your own DJ or plug in a playlist",
  catering:
    "In-house catering\nApproved caterers only\nWe provide alcohol\nKitchen facilities available\nHalal available\nKosher available\nComplimentary water\nExtensive vegan menu\nExtensive gluten-free menu\nBuyout fee for external catering\nno: External catering (general)\nno: BYOB alcohol\nno: Complimentary tea & coffee",
  licences:
    "Alcohol licence until 23:00. Later licenses can be applied for with notice.",
  welcomes:
    // DJ kit lines mirror the booth spec in the DJ portal ("The kit") —
    // keep the two in step if the booth changes.
    "Games competitions / tournaments\nVIP events\nPrivate parties\nFull DJ booth — 2× Technics SL-1200 MK7, 2× Pioneer CDJ-900 Nexus, rotary mixer\nMartin Audio sound system — bring your own DJ or plug in a playlist",
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
    "License & Documents",
  );
  // Floorplan image — single CMS gallery so the team uploads/swaps it in
  // the admin. Transparent PNG sits straight on the page; nothing shows
  // on the live site until one is uploaded.
  // Default to the floorplan the founder uploaded (9 Oct 2026). Still
  // overridable via the privatehire.floorplan gallery in the admin.
  const floorplan = useGallery("privatehire.floorplan", [
    {
      src: "https://rntcujcpsozvuxvmlejv.supabase.co/storage/v1/object/public/media/library/1791563582090-neon-cad-venue-floor-plan.png",
      alt: "No Dice Hackney venue floorplan",
    },
  ]);
  const editing = useEditMode();

  // Three sticky sub-tabs (founder 9 Oct 2026). All panels stay MOUNTED
  // (toggled with `hidden`), so the package builder keeps its dates,
  // selections and details when you switch away and back.
  const TABS = [
    { id: "venue" as const, label: "Venue details" },
    { id: "menu" as const, label: "Xmas menu" },
    { id: "builder" as const, label: "Package builder" },
  ];
  type TabId = (typeof TABS)[number]["id"];
  const [activeTab, setActiveTab] = useState<TabId>("venue");
  const tabsRef = useRef<HTMLDivElement | null>(null);

  // Deep-link + back-button support via the URL hash (#menu / #builder).
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace("#", "");
      if (h === "venue" || h === "menu" || h === "builder") setActiveTab(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  function selectTab(id: TabId) {
    setActiveTab(id);
    if (typeof window !== "undefined") {
      history.replaceState(null, "", `#${id}`);
      requestAnimationFrame(() =>
        tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }

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

      {/* Sticky sub-tabs — pinned below the site header as you scroll. */}
      <div
        ref={tabsRef}
        className="sticky top-[60px] z-40 scroll-mt-[60px] border-y border-cream/15 bg-black sm:top-[68px] sm:scroll-mt-[68px]"
      >
        <div className="mx-auto flex max-w-4xl gap-1 p-1 sm:gap-2 sm:p-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTab(t.id)}
              className={`flex-1 rounded-xl px-2 py-3.5 text-xs font-bold uppercase tracking-wider transition sm:text-base ${
                activeTab === t.id
                  ? "bg-nodiceRed text-white shadow-lg shadow-nodiceRed/30"
                  : "bg-white/[0.04] text-cream/65 hover:bg-white/10 hover:text-cream"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════ VENUE DETAILS ═══════════ */}
      <div hidden={activeTab !== "venue"}>
      {/* VENUE scroller — full-width, shared `parties.venue` gallery
          (same photos as /xmas). Blank placeholders until the team
          uploads shots of the space in the galleries admin. */}
      <MediaStrip
        galleryKey="parties.venue"
        blankLabel="Venue photo"
        aspect="16 / 9"
        blankCount={6}
      />

      {/* Popular for + about */}
      <section className="tint-forest-to-plumDeep px-6 pb-6 pt-10">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-center text-lg font-bold uppercase tracking-[0.3em] text-plonkTeal sm:text-2xl">
              <Editable k="privatehire.hackney.popular_heading">
                {popularHeading}
              </Editable>
            </p>
          </Reveal>
        </div>
        {/* Full-width scrollable line of activity icons (founder 9 Oct
            2026) — breaks out of the max-w-4xl so it spans the page like
            the photo scrollers above. */}
        <Reveal>
          <RollerDeck ariaLabel="What No Dice is popular for" className="mt-6">
              {popularList.map((t) => {
                const Icon = iconForUseCase(t);
                return (
                  <div
                    key={t}
                    className="flex w-28 shrink-0 snap-start flex-col items-center gap-3 rounded-2xl border border-plumLine/80 bg-plumDeep/60 px-3 py-5 text-center transition hover:border-plonkTeal/40"
                  >
                    <Icon
                      className="h-7 w-7 text-plonkTeal"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-medium leading-tight text-cream/90">
                      {t}
                    </span>
                  </div>
                );
              })}
            </RollerDeck>
        </Reveal>

        <div className="mx-auto max-w-4xl">
          <Reveal delay={120}>
            <h2 className="mt-8 font-display text-3xl leading-tight sm:text-4xl">
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

      {/* Fact sheet. pt trimmed (founder, 9 Sep 2026): the capacity
          stats should sit close under the intro text, not a screen away. */}
      <section className="tint-plumDeep-to-plum px-6 pb-14 pt-6">
        <div className="mx-auto max-w-6xl space-y-8">
          <FactPanel title={capacityTitle} titleKey="privatehire.hackney.capacity_title">
            {/* One row on every screen size (founder, 9 Sep 2026) —
                three compact cards beat three full-width slabs. */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {capacities.map((c) => (
                <div
                  key={c.label}
                  className="rounded-2xl border border-plumLine/80 bg-plumDeep/60 p-3 text-center sm:p-6"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-plonkYellow sm:text-xs sm:tracking-eyebrow">
                    {c.label}
                  </p>
                  <p className="mt-1 font-display text-3xl text-cream sm:mt-3 sm:text-5xl">
                    {c.value}
                  </p>
                </div>
              ))}
            </div>
          </FactPanel>
        </div>

        {/* GAMES kit scroller — full width, under the Capacity section
            (founder 9 Oct 2026). New privatehire.games gallery; blank
            placeholders until the team uploads photos of the games kit. */}
        <div className="-mx-6 my-4">
          <MediaStrip
            galleryKey="privatehire.games"
            heading="Our games kit"
            headingKey="privatehire.games_heading"
            intro="Pool, ping pong, board games and more."
            introKey="privatehire.games_intro"
            blankLabel="Games photo"
            aspect="16 / 9"
            blankCount={6}
          />
        </div>

        <div className="mx-auto max-w-6xl space-y-8">
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

          {/* Venue floorplan — sits below Room Features (founder 9 Oct
              2026). Transparent image straight on the page; shrinks on
              phones, caps on desktop. */}
          {(floorplan.length > 0 || editing) && (
            <div className="relative mx-auto max-w-3xl">
              {floorplan.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={floorplan[0].src}
                  alt="No Dice Hackney venue floorplan"
                  className="mx-auto block h-auto w-full"
                />
              ) : (
                <div className="flex min-h-[160px] items-center justify-center rounded-2xl border border-dashed border-cream/20 text-sm text-cream/40">
                  Floorplan — add an image
                </div>
              )}
              <ManageGalleryLink
                galleryKey="privatehire.floorplan"
                label={floorplan.length ? "Change floorplan" : "Add floorplan"}
              />
            </div>
          )}
        </div>

        <div className="mx-auto max-w-6xl space-y-8">
          <FactPanel title={cateringTitle} titleKey="privatehire.hackney.catering_title">
            {/* Ticks flow across 2 columns so the section isn't a tall
                single column (founder 9 Oct 2026); the "no" items sit
                below, also 2-up. */}
            <div className="space-y-4">
              <ul className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
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
              {cateringNo.length > 0 && (
                <ul className="grid gap-x-10 gap-y-3 border-t border-cream/10 pt-4 sm:grid-cols-2">
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
              )}
            </div>
          </FactPanel>

          <FactPanel title={licencesTitle} titleKey="privatehire.hackney.licences_title">
            <p className="whitespace-pre-line text-sm leading-relaxed text-cream/85 sm:text-base">
              <Editable k="privatehire.hackney.licences" multiline>
                {licences}
              </Editable>
            </p>
            {/* Gated corporate documents (code from the events team) —
                moved into this section + renamed (founder 9 Oct 2026). */}
            <a
              href="/privatehire/documents"
              className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-plonkTeal/40 bg-plonkTeal/10 px-5 py-4 transition hover:bg-plonkTeal/15"
            >
              <span className="font-display text-xl uppercase tracking-wider text-cream">
                📄 Corporate documents — risk assessments &amp; fire plan
              </span>
              <span className="rounded-full bg-plonkTeal px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink">
                Access with code →
              </span>
            </a>
          </FactPanel>
        </div>
      </section>

      <BigEmailCta subject="Private Hire Enquiry — No Dice" />

      {/* Instagram feed at the end of Venue details (founder 9 Oct 2026). */}
      <InstagramFeed
        headingKey="privatehire.hackney.instagram_heading"
        headingFallback="Follow the parties"
      />
      </div>

      {/* ═══════════ XMAS MENU ═══════════ */}
      <div hidden={activeTab !== "menu"}>
        <XmasMenuTab />
      </div>

      {/* ═══════════ PACKAGE BUILDER ═══════════ */}
      <div hidden={activeTab !== "builder"}>
        <section className="px-6 py-10">
          <div className="mx-auto max-w-3xl">
            <XmasPackageBuilder />
          </div>
        </section>
      </div>
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
        <h3 className="text-center font-display text-2xl text-plonkYellow sm:text-3xl">
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
