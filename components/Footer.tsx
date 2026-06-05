"use client";

import Link from "next/link";
import { useContent } from "@/lib/content";
import { Editable } from "./Editable";

const FALLBACK_SOCIALS = [
  "Instagram | https://www.instagram.com/plonkgolf/",
  "Facebook | https://www.facebook.com/pages/NO DICE-Golf/749762088452016",
  "Twitter | https://twitter.com/plonkgolf",
  "YouTube | https://www.youtube.com/channel/UCrMFq-Wzdk1ry81KTp0HPyw",
].join("\n");

function parseLinks(s: string): { label: string; href: string }[] {
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

// Address lines starting with — render as muted subtext.
function addressLines(s: string): { text: string; muted: boolean }[] {
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) =>
      line.startsWith("—")
        ? { text: line.replace(/^—\s*/, ""), muted: true }
        : { text: line, muted: false },
    );
}

export default function Footer() {
  const brandTitle = useContent("footer.brand_title", "No Dice");
  const brandTagline = useContent(
    "footer.brand_tagline",
    "London's Original Crazy Golf and Games Bars. Accept no imitators.",
  );
  const brandEmail = useContent("footer.brand_email", "info@nodice.bar");

  // Single-venue site — only the Hackney address renders in the footer.
  // The borough_* content keys are intentionally removed; if Borough ever
  // comes back, restore the column block + keys from git history.
  const hackneyHeading = useContent("footer.hackney_heading", "Hackney");
  const hackneyAddress = useContent(
    "footer.hackney_address",
    "Arch 407, Mentmore Terrace\nLondon Fields, Hackney\nLondon E8 3PH",
  );

  const socialsHeading = useContent("footer.socials_heading", "Follow");
  const socialsRaw = useContent("footer.socials", FALLBACK_SOCIALS);
  const SOCIALS = parseLinks(socialsRaw);

  const copyrightTemplate = useContent(
    "footer.copyright",
    "© {{year}} No Dice Ltd. All rights reserved.",
  );
  const copyright = copyrightTemplate.replace(
    /\{\{\s*year\s*\}\}/gi,
    String(new Date().getFullYear()),
  );

  const hackneyRows = addressLines(hackneyAddress);

  return (
    <footer className="bg-forestDeep">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-3">
        <div>
          <h3 className="font-display text-2xl">
            <Editable k="footer.brand_title">{brandTitle}</Editable>
          </h3>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-cream/70">
            <Editable k="footer.brand_tagline" multiline>{brandTagline}</Editable>
          </p>
          {brandEmail && (
            <p className="mt-4 text-sm text-cream/70">
              <a
                href={`mailto:${brandEmail}`}
                className="underline-offset-4 hover:text-cream hover:underline"
              >
                <Editable k="footer.brand_email">{brandEmail}</Editable>
              </a>
            </p>
          )}
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
            <Editable k="footer.hackney_heading">{hackneyHeading}</Editable>
          </h4>
          <address className="mt-3 not-italic text-sm leading-relaxed text-cream/65">
            <Editable k="footer.hackney_address" multiline>
              {hackneyRows.map((r) => r.text).join("\n")}
            </Editable>
          </address>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
            <Editable k="footer.socials_heading">{socialsHeading}</Editable>
          </h4>
          <ul className="mt-3 space-y-2 text-sm">
            {SOCIALS.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cream/70 transition hover:text-cream"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-plumLine/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-5 text-xs text-cream/50 md:flex-row md:items-center md:justify-between">
          <span>
            <Editable k="footer.copyright">{copyright}</Editable>
          </span>
          <div className="flex flex-wrap gap-5">
            <Link href="/privacy" className="hover:text-cream">Privacy</Link>
            <Link href="/terms" className="hover:text-cream">Terms</Link>
            <Link href="/contact" className="hover:text-cream">Contact</Link>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("plonk:cookies:open"))}
              className="hover:text-cream"
            >
              Cookie settings
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
