"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BookingFlow from "./BookingFlow";
import { loadCatalogue, type Catalogue } from "@/lib/db/catalogue";
import { supabase } from "@/lib/supabase";

// Loads the live venue + tickets + addons from Supabase on mount, then
// hands them to the existing BookingFlow component unchanged.
//
// 2026-08-26 — also reads the 'golf' row of bookable_products so the
// founder has the same master kill switch pool + table bookings already
// have: flip it to Paused at /admin/products/golf and this page swaps
// the whole flow for the closed_message panel. Missing row / fetch
// error fails OPEN (bookings continue) so an infra blip can't strand
// the page closed.
export default function CatalogueLoader({ venueSlug }: { venueSlug: string }) {
  const [data, setData] = useState<Catalogue | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState<{ message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setNotFound(false);
    setData(null);
    setPaused(null);
    // Master switch check runs in parallel with the catalogue load.
    supabase()
      .from("bookable_products")
      .select("enabled, closed_message")
      .eq("id", "golf")
      .maybeSingle()
      .then(({ data: p }) => {
        if (cancelled || !p || p.enabled !== false) return;
        setPaused({
          message:
            p.closed_message ||
            "Golf bookings are temporarily paused — check back soon or DM us on Instagram.",
        });
      });
    loadCatalogue(venueSlug)
      .then((c) => {
        if (cancelled) return;
        if (!c) {
          setNotFound(true);
          return;
        }
        // Only golf tickets are bookable through the main flow.
        const filtered: Catalogue = {
          ...c,
          tickets: c.tickets.filter((t) => t.category === "golf"),
        };
        setData(filtered);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [venueSlug]);

  if (paused) {
    return (
      <main className="min-h-screen px-6 py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-plonkPink/40 bg-plonkPink/10 p-8 text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-plonkPink">
            Bookings paused
          </div>
          <p className="mt-4 text-base text-cream/85">{paused.message}</p>
          <a
            href="https://instagram.com/nodice.bar"
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-block rounded-full bg-plonkPink px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-plonkPink/90"
          >
            DM us on Instagram
          </a>
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen px-6 py-20 text-center">
        <h1 className="font-display text-3xl">Venue not found</h1>
        <Link
          href="/book"
          className="mt-6 inline-block rounded-full bg-plonkPink px-6 py-3 text-sm font-bold uppercase tracking-wider text-white"
        >
          Pick a venue
        </Link>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen px-6 py-20 text-center">
        <h1 className="font-display text-3xl">Could not load booking page</h1>
        <p className="mt-3 text-sm text-cream/70">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-cream/20 border-t-plonkYellow" />
          <p className="mt-6 text-sm text-cream/70">Loading availability…</p>
        </div>
      </main>
    );
  }

  return (
    <BookingFlow
      venue={data.venue}
      tickets={data.tickets}
      addons={data.addons}
    />
  );
}
