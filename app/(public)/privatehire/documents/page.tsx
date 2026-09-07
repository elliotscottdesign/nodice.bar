"use client";

import { useState, useEffect } from "react";
import { FileText, Lock, Download } from "lucide-react";

// =============================================================
// /privatehire/documents — gated corporate documents
// =============================================================
// Compliance documents (risk assessments, fire plan) for corporate
// clients booking private hire. Gated behind a simple access code
// the events team shares by email — a speed bump to keep the docs
// off casual browsing and search engines, not real security (the
// PDFs live in /public/docs and the code is client-side, same
// pattern as the other gates on this site). noindex via metadata
// isn't available in a client component, so the gate itself is the
// deterrent; the page is linked only from /privatehire.
//
// Code: 6767 (founder-set, 2026-09-07). Unlock persists for the
// tab session only.
// =============================================================

const ACCESS_CODE = "6767";
const STORAGE_KEY = "nd_docs_unlocked";

const DOCS: { title: string; blurb: string; href: string }[] = [
  {
    title: "Fire and Emergency Evacuation Plan",
    blurb: "Alarm, evacuation and assembly-point procedures for the venue.",
    href: "/docs/no-dice-fire-evacuation-plan.pdf",
  },
  {
    title: "Bar Operations Risk Assessment",
    blurb: "Hazards and controls for the bar function of the venue.",
    href: "/docs/no-dice-bar-risk-assessment.pdf",
  },
  {
    title: "Kitchen Operations Risk Assessment",
    blurb: "Food safety, allergens and kitchen-trailer hazards and controls.",
    href: "/docs/no-dice-kitchen-risk-assessment.pdf",
  },
  {
    title: "Golf Course Operations Risk Assessment",
    blurb: "Hazards and controls for the 9-hole crazy golf course.",
    href: "/docs/no-dice-golf-risk-assessment.pdf",
  },
  {
    title: "Summary of Insurance Cover",
    blurb:
      "Employers' (£10m), public (£5m) and products (£5m) liability — policy ASCCL251279, Ascot at Lloyd's, to 12/06/2027.",
    href: "/docs/no-dice-insurance-summary.pdf",
  },
  {
    title: "Certificate of Employers' Liability Insurance",
    blurb: "The statutory certificate issued by the insurer.",
    href: "/docs/no-dice-employers-liability-certificate.pdf",
  },
];

// Everything above, as one zip — regenerate it (zip in public/docs)
// whenever a document is added or replaced.
const ZIP_HREF = "/docs/no-dice-corporate-documents.zip";

export default function DocumentsPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") setUnlocked(true);
    } catch {
      /* storage blocked — visitor just re-enters the code */
    }
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim() === ACCESS_CODE) {
      setUnlocked(true);
      setError("");
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* fine — unlock just won't survive a refresh */
      }
    } else {
      setError("That code isn't right — check the email from our events team.");
    }
  }

  return (
    <main className="tint-forest-to-plumDeep min-h-[70vh] px-6 py-24">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-eyebrow text-plonkTeal">
          Private hire · Corporate documents
        </p>
        <h1 className="mt-3 font-display text-4xl uppercase tracking-wider text-cream sm:text-5xl">
          Venue documents
        </h1>

        {!unlocked ? (
          <>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-cream/70">
              Risk assessments and the fire &amp; evacuation plan for No Dice,
              for clients who need them for a booking. Enter the access code
              from our events team — or email{" "}
              <a href="mailto:info@nodice.bar" className="text-plonkTeal underline">
                info@nodice.bar
              </a>{" "}
              to request it.
            </p>
            <form onSubmit={submit} className="mt-8 flex max-w-sm gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(ev) => {
                  setCode(ev.target.value);
                  if (error) setError("");
                }}
                placeholder="Access code"
                aria-label="Access code"
                className="min-w-0 flex-1 rounded-full border border-cream/20 bg-ink/40 px-5 py-3 text-center text-lg tracking-[0.3em] text-cream placeholder:text-sm placeholder:tracking-normal placeholder:text-cream/40 focus:border-plonkTeal focus:outline-none"
              />
              <button
                type="submit"
                className="shrink-0 rounded-full bg-plonkTeal px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink transition hover:bg-plonkTeal/90"
              >
                <Lock className="mr-1.5 inline h-3.5 w-3.5 -translate-y-px" />
                Unlock
              </button>
            </form>
            {error && (
              <p className="mt-3 text-sm text-plonkPink" role="alert">
                {error}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-cream/70">
              Current versions of our operational documents, dated 15/06/2026.
              Questions about any of them:{" "}
              <a href="mailto:info@nodice.bar" className="text-plonkTeal underline">
                info@nodice.bar
              </a>
              .
            </p>
            <a
              href={ZIP_HREF}
              className="mt-8 flex items-center justify-center gap-2 rounded-full bg-plonkTeal px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-ink transition hover:bg-plonkTeal/90"
            >
              <Download className="h-4 w-4" />
              Download all documents (ZIP)
            </a>
            <ul className="mt-6 space-y-3">
              {DOCS.map((d) => (
                <li key={d.href}>
                  <a
                    href={d.href}
                    target="_blank"
                    rel="noopener"
                    className="group flex items-center gap-4 rounded-2xl border border-cream/10 bg-ink/40 px-5 py-4 transition hover:border-plonkTeal/50 hover:bg-ink/60"
                  >
                    <FileText className="h-8 w-8 shrink-0 text-plonkTeal" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-cream">
                        {d.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-cream/55">
                        {d.blurb}
                      </span>
                    </span>
                    <Download className="h-5 w-5 shrink-0 text-cream/40 transition group-hover:text-plonkTeal" />
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-xs text-cream/40">
              PDF · No Dice Hackney Ltd · please don't redistribute outside
              your organisation.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
