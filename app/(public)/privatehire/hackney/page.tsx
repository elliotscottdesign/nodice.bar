"use client";

import Link from "next/link";
import { useEffect } from "react";

// /privatehire/hackney has been consolidated into /privatehire
// (single-venue site → "Hackney" as a sub-route was redundant). Any
// stale link, bookmark or Google result lands here and bounces to
// /privatehire. basePath is prepended explicitly for the no-JS
// meta-refresh fallback because GitHub Pages serves under
// /nodice.bar/.
export default function HackneyPrivateHireRedirect() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  useEffect(() => {
    window.location.replace(`${basePath}/privatehire`);
  }, [basePath]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-20 text-center">
      <meta httpEquiv="refresh" content={`0; url=${basePath}/privatehire`} />
      <h1 className="font-display text-3xl uppercase tracking-wider">
        This page has moved
      </h1>
      <p className="mt-3 text-sm text-cream/70">
        Private hire now lives at /privatehire. Taking you there…
      </p>
      <Link
        href="/privatehire"
        className="mt-6 inline-block rounded-full bg-plonkPink px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90"
      >
        Go to private hire
      </Link>
    </main>
  );
}
