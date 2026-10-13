"use client";

import Link from "next/link";
import { useEffect } from "react";

// /privatehire/hackney → /parties (permanent redirect stub). This
// sub-route was already consolidated into the main page; with the
// /privatehire → /parties rename (founder, Oct 2026) it now bounces
// straight to /parties. Static export → client-side redirect.
export default function PrivateHireHackneyRedirect() {
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
