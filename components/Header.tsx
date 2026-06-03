"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useContent, useImage } from "@/lib/content";
import { Editable } from "./Editable";

const FALLBACK_NAV = [
  "Hackney | /venue/hackney",
  "Borough | /venue/borough-market",
  "Private hire | /private-hire",
  "Vouchers | /vouchers",
  "FAQs | /faqs",
  "About | /about",
  "Contact | /contact",
].join("\n");

// Parse a "Label | href" textarea into an array of nav items. Lines
// without a pipe are skipped so a stray word in the field never
// renders a broken link.
function parseNav(s: string): { label: string; href: string }[] {
  return s
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf("|");
      if (idx < 0) return null;
      const label = line.slice(0, idx).trim();
      const href = line.slice(idx + 1).trim();
      if (!label || !href) return null;
      return { label, href };
    })
    .filter((x): x is { label: string; href: string } => x !== null);
}

export default function Header() {
  const [open, setOpen] = useState(false);

  const logoImage = useImage("header.logo_image", "/images/plonk-logo.png");
  const logoAlt = useContent("header.logo_alt", "Plonk Golf");
  const navRaw = useContent("header.nav", FALLBACK_NAV);
  const ctaLabel = useContent("header.cta_label", "Book Now");
  const ctaHref = useContent("header.cta_href", "/book");

  const NAV = parseNav(navRaw);

  return (
    <header className="sticky top-0 z-50 bg-black">
      <div className="flex w-full items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center" aria-label={`${logoAlt} — home`}>
          <Image
            src={logoImage}
            alt={logoAlt}
            width={140}
            height={56}
            priority
            className="h-9 w-auto"
            unoptimized={logoImage.startsWith("http")}
          />
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[13px] font-semibold uppercase tracking-wider text-cream/75 transition hover:text-cream"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href={ctaHref}
            className="rounded-full bg-plonkPink px-5 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90"
          >
            <Editable k="header.cta_label">{ctaLabel}</Editable>
          </Link>
        </nav>

        <div className="flex items-center gap-2 lg:hidden">
          <Link
            href={ctaHref}
            className="rounded-full bg-plonkPink px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90"
          >
            <Editable k="header.cta_label">{ctaLabel}</Editable>
          </Link>
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={open}
            className="p-2 text-cream"
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {open ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-cream/10 bg-black px-6 py-5 lg:hidden">
          <ul className="flex flex-col gap-3">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block text-base font-medium uppercase tracking-wider text-cream/85"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={ctaHref}
                onClick={() => setOpen(false)}
                className="mt-2 inline-block rounded-full bg-plonkPink px-5 py-2 text-sm font-bold uppercase tracking-wider text-white"
              >
                {ctaLabel}
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
