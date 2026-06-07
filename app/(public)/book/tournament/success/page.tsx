"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// Stripe redirects here after a successful Checkout. We don't have
// to do anything — the stripe-webhook Edge Function handles the
// DB update server-side, and it's typically already landed by the
// time the customer sees this page. We just say thanks.
//
// session_id is in the query string but we don't display it.
// Customers don't need to remember it; admin can look the entry
// up by team name + captain email.

export default function TournamentSuccessPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _params = useSearchParams();

  return (
    <main className="px-6 py-24">
      <div className="mx-auto max-w-xl rounded-2xl border border-cream/10 p-10 text-center">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
          Payment received
        </div>
        <h1 className="mt-3 font-display text-4xl uppercase tracking-wider">
          Your team's in
        </h1>
        <p className="mt-4 text-base text-cream/75">
          We've got your entry. A confirmation email is on its way to the
          captain's address. See you on the night — bring your best stick.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/events"
            className="rounded-full border border-cream/20 px-6 py-3 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            See what else is on ↗
          </Link>
          <Link
            href="/"
            className="text-xs uppercase tracking-wider text-cream/55 hover:text-cream"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
