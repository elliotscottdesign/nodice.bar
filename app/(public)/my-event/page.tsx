"use client";

// Client-facing event summary. The office shares /my-event?t=<share_token>;
// this reads the token client-side (the site is a static export, so we use a
// query param, not a dynamic [token] route — unknown dynamic ids 404) and
// pulls the SAFE summary via the enquiry_client_summary RPC. No contact /
// budget / internal notes are ever exposed.

import { useEffect, useState } from "react";
import PageHero from "@/components/PageHero";
import { useImage } from "@/lib/content";
import {
  loadEnquiryClientSummary,
  type EnquiryClientSummary,
} from "@/lib/db/enquiries";

function prettyDate(iso: string | null, flex: string): string {
  if (iso) {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  return flex || "Date to confirm";
}

export default function MyEventPage() {
  const heroImage = useImage("privatehire.hackney.hero_image", "");
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "found"; s: EnquiryClientSummary }
    | { kind: "missing" }
  >({ kind: "loading" });

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("t") || "";
    if (!token) {
      setState({ kind: "missing" });
      return;
    }
    loadEnquiryClientSummary(token)
      .then((s) => setState(s ? { kind: "found", s } : { kind: "missing" }))
      .catch(() => setState({ kind: "missing" }));
  }, []);

  return (
    <main>
      <PageHero
        eyebrow="Your event"
        title="No Dice"
        intro="Here's where your plans with us stand."
        image={heroImage}
      />
      <section className="mx-auto max-w-xl px-4 pb-24">
        {state.kind === "loading" && (
          <p className="text-sm text-cream/50">Loading…</p>
        )}

        {state.kind === "missing" && (
          <div className="rounded-2xl border border-cream/15 bg-ink/40 p-8 text-center">
            <h2 className="font-display text-2xl text-cream">
              This link isn&apos;t active
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-cream/70">
              It may have expired or not be ready yet. Drop us a line at{" "}
              <a className="text-plonkTeal underline" href="mailto:info@nodice.bar">
                info@nodice.bar
              </a>{" "}
              and we&apos;ll sort you out.
            </p>
          </div>
        )}

        {state.kind === "found" && (
          <div className="space-y-5">
            <div
              className={`rounded-2xl border p-6 ${
                state.s.status === "confirmed"
                  ? "border-plonkTeal/40 bg-plonkTeal/10"
                  : "border-plonkYellow/40 bg-plonkYellow/10"
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-widest text-cream/60">
                {state.s.status === "confirmed"
                  ? "You're booked in"
                  : "We're holding this for you"}
              </span>
              <h2 className="mt-1 font-display text-3xl text-cream">
                {state.s.event_type || "Your event"}
              </h2>
              {state.s.contact_name && (
                <p className="mt-1 text-sm text-cream/70">
                  For {state.s.contact_name}
                </p>
              )}
            </div>

            <dl className="divide-y divide-cream/10 rounded-2xl border border-cream/15 bg-ink/40">
              <SummaryRow
                k="Date"
                v={prettyDate(state.s.requested_date, state.s.date_flex)}
              />
              {state.s.party_size ? (
                <SummaryRow k="Party" v={`${state.s.party_size} guests`} />
              ) : null}
              <SummaryRow
                k="Status"
                v={
                  state.s.status === "confirmed"
                    ? "Confirmed"
                    : "Pencilled in"
                }
              />
            </dl>

            <p className="text-sm leading-relaxed text-cream/70">
              {state.s.status === "confirmed"
                ? "You're all set. We'll be in touch with the final details — food, drinks and timings — closer to the day."
                : "We've got your date held. We'll confirm shortly once the details are locked in."}
            </p>
            <p className="text-xs text-cream/45">
              Questions? Email{" "}
              <a className="text-plonkTeal underline" href="mailto:info@nodice.bar">
                info@nodice.bar
              </a>
              .
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function SummaryRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <dt className="text-[11px] font-bold uppercase tracking-widest text-cream/45">
        {k}
      </dt>
      <dd className="text-sm text-cream">{v}</dd>
    </div>
  );
}
