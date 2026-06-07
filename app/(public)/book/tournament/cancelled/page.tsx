"use client";

import Link from "next/link";

// Stripe redirects here if the customer hits "back" or closes the
// Stripe Checkout tab without paying. The pending entry in
// tournament_entries stays as status='pending_payment' — a daily
// cron in admin (or a quick manual sweep before the tournament)
// can prune anything still pending after the event date.

export default function TournamentCancelledPage() {
  return (
    <main className="px-6 py-24">
      <div className="mx-auto max-w-xl rounded-2xl border border-cream/10 p-10 text-center">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
          Payment not completed
        </div>
        <h1 className="mt-3 font-display text-4xl uppercase tracking-wider">
          No charge taken
        </h1>
        <p className="mt-4 text-base text-cream/75">
          You backed out of payment, so your team's spot isn't held yet.
          You can try again any time — entries usually fill up close to
          the event.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/book/tournament"
            className="rounded-full bg-plonkPink px-6 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90"
          >
            Try again
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
