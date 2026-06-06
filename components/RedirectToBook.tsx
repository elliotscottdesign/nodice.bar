"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Tiny client-side redirect to the /book landing. Used by the three
// legacy Plonk-Golf surfaces (`/book/hackney`, `/book/checkout`,
// `/book/success`) that no longer have a job on the No Dice site —
// the Golf card on /book sends users externally to plonkgolf.co.uk,
// and the Tables / Pool / Parties cards all have their own dedicated
// pages. We keep the routes alive (instead of deleting them) so any
// stale bookmark or Google index entry lands on something useful
// rather than a 404.
//
// Belt-and-braces:
//   - useRouter().replace() on mount (no back-button trap)
//   - <meta http-equiv="refresh"> in case JS is disabled / blocked
//   - Visible fallback Link in case both fail
export default function RedirectToBook() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/book");
  }, [router]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-20 text-center">
      <meta httpEquiv="refresh" content="0; url=/book" />
      <h1 className="font-display text-3xl uppercase tracking-wider">
        This page has moved
      </h1>
      <p className="mt-3 text-sm text-cream/70">
        Taking you to bookings…
      </p>
      <Link
        href="/book"
        className="mt-6 inline-block rounded-full bg-plonkPink px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90"
      >
        Go to bookings
      </Link>
    </main>
  );
}
