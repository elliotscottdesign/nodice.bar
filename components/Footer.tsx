"use client";

import { useState } from "react";
import Link from "next/link";
import { useContent } from "@/lib/content";
import { Editable } from "./Editable";

// Newsletter signup — footer + popup both insert straight into
// newsletter_signups (source tag distinguishes them in the table).
// No welcome email, no discount: WELCOME20 retired 26 Aug 2026.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://rntcujcpsozvuxvmlejv.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
// (send-welcome-discount no longer called — signups insert straight into
// newsletter_signups; the WELCOME20 incentive was retired 26 Aug 2026.)

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

// Twitter + YouTube removed per founder direction. Instagram + Facebook
// stay; URLs are editable from /admin/content/global/footer.
const FALLBACK_SOCIALS = [
  "Instagram | https://www.instagram.com/nodice.bar/",
  "Facebook | https://www.facebook.com/pages/NO DICE-Golf/749762088452016",
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
      {/* 3-column grid: Hackney · Socials · Newsletter signup. On
          mobile the columns stack; on md+ they sit side by side.
          Brand_* content keys remain in the DB (unused but harmless)
          in case the old brand block ever comes back. */}
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-3">
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

        <FooterNewsletter />
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

// =============================================================
// FooterNewsletter — compact join-the-list email signup
// =============================================================
// Posts to the same Edge Function the popup uses, tagged with
// source='footer' so the founder can tell where signups originate.
// On success the form swaps to a confirmation panel so the visitor
// gets immediate feedback without leaving the page.
// =============================================================
function FooterNewsletter() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError("That email doesn't look right.");
      return;
    }
    setError("");
    setState("sending");
    try {
      // Record-only — no discount email (WELCOME20 retired 26 Aug 2026,
      // founder: "0 deals for emails"). Direct RLS-permitted anon insert,
      // same pattern as the /minigolf capture.
      const res = await fetch(`${SUPABASE_URL}/rest/v1/newsletter_signups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          source: "footer",
          consent: true,
        }),
      });
      if (!res.ok) {
        setState("err");
        setError("Couldn't send right now — try again in a minute.");
        return;
      }
      setState("ok");
    } catch {
      setState("err");
      setError("Network blip — please try again.");
    }
  }

  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
        Join the list
      </h4>
      {state === "ok" ? (
        <div className="mt-3 rounded-xl border border-plonkPink/40 bg-plonkPink/5 px-4 py-3 text-sm leading-relaxed text-cream/85">
          <strong className="text-plonkPink">You're in.</strong> We'll keep you
          posted on what's on. No spam.
        </div>
      ) : (
        <>
          <p className="mt-3 text-sm leading-relaxed text-cream/65">
            The occasional update on what's on at No Dice. Unsubscribe anytime.
          </p>
          <form onSubmit={submit} className="mt-3" noValidate>
            <div className="flex gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(ev) => {
                  setEmail(ev.target.value);
                  if (error) setError("");
                  if (state === "err") setState("idle");
                }}
                placeholder="you@email.com"
                autoComplete="email"
                className="min-w-0 flex-1 rounded-lg border border-cream/20 bg-ink/40 px-3 py-2 text-sm text-cream placeholder:text-cream/35 outline-none transition focus:border-plonkPink"
                aria-label="Email address"
              />
              <button
                type="submit"
                disabled={state === "sending"}
                className="shrink-0 rounded-lg bg-plonkPink px-4 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90 disabled:opacity-60"
              >
                {state === "sending" ? "…" : "Join"}
              </button>
            </div>
            {error && (
              <p className="mt-2 text-xs text-plonkPink" role="alert">
                {error}
              </p>
            )}
          </form>
        </>
      )}
    </div>
  );
}
