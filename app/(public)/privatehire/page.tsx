"use client";

import Link from "next/link";
import { useEffect } from "react";

// =============================================================
// /privatehire → /parties  (permanent redirect stub)
// =============================================================
// The public party / private-hire page was renamed /privatehire →
// /parties (founder, Oct 2026). Links to /privatehire have already
// been shared (e.g. a Gmail "Christmas party booking" link), so this
// stub stays forever to bounce any old bookmark, email link or
// search result to the new URL. The live page now lives at
// app/(public)/parties/. CMS content keys are UNCHANGED (still
// privatehire.hackney.*) — only the URL moved.
//
// This site is a static export (output:"export"), so Next.js
// redirects() in next.config aren't emitted. A client-side redirect
// page is the established pattern on this site (see how
// /privatehire/hackney used to bounce to /privatehire). basePath is
// prepended explicitly for the no-JS meta-refresh fallback.
// =============================================================
export default function PrivateHireRedirect() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  useEffect(() => {
    window.location.replace(`${basePath}/parties`);
  }, [basePath]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-20 text-center">
      <meta httpEquiv="refresh" content={`0; url=${basePath}/parties`} />
      <h1 className="font-display text-3xl uppercase tracking-wider">
        This page has moved
      </h1>
      <p className="mt-3 text-sm text-cream/70">
        Parties now live at /parties. Taking you there…
      </p>
      <Link
        href="/parties"
        className="mt-6 inline-block rounded-full bg-plonkPink px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90"
      >
        Go to parties
      </Link>
    </main>
  );
}
