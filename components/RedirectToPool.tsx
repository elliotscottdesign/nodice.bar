"use client";

import Link from "next/link";
import { useEffect } from "react";

// The /book/tournament page (and its /success and /cancelled
// sub-pages) used to be a standalone form + redirect-to-Stripe flow.
// The full journey now lives inline on /pool with embedded Stripe
// Checkout, so these routes have no job — anyone arriving via a
// stale bookmark or Google index entry is sent to /pool where the
// schedule + sign-up form actually lives.
//
// basePath is prepended explicitly for the meta-refresh fallback
// because GitHub Pages serves us under /nodice.bar/.
export default function RedirectToPool() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  useEffect(() => {
    window.location.replace(`${basePath}/pool#tournaments`);
  }, [basePath]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-20 text-center">
      <meta httpEquiv="refresh" content={`0; url=${basePath}/pool`} />
      <h1 className="font-display text-3xl uppercase tracking-wider">
        Sign-up has moved
      </h1>
      <p className="mt-3 text-sm text-cream/70">
        Tournament sign-ups now live on the Pool page. Taking you there…
      </p>
      <Link
        href="/pool"
        className="mt-6 inline-block rounded-full bg-plonkPink px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90"
      >
        Go to Pool tournaments
      </Link>
    </main>
  );
}
