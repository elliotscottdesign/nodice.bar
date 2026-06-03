"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BookingFlow from "./BookingFlow";
import { loadCatalogue, type Catalogue } from "@/lib/db/catalogue";

// Loads the live venue + tickets + addons from Supabase on mount, then
// hands them to the existing BookingFlow component unchanged.
export default function CatalogueLoader({ venueSlug }: { venueSlug: string }) {
  const [data, setData] = useState<Catalogue | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setNotFound(false);
    setData(null);
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
