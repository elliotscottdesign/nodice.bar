"use client";

import Link from "next/link";
import { useState } from "react";
import PageHero from "@/components/PageHero";
import { useContent } from "@/lib/content";
import { supabase } from "@/lib/supabase";

// =============================================================
// /minigolf — landing page for Plonk Hackney mini golf
// =============================================================
// 2026-07-19: switched from "coming soon" email capture to a live
// booking CTA now that the interim /book/hackney flow is running on
// nodice.bar. The standalone plonkgolf.co.uk site is still being
// built; until then this page routes customers into the in-tree
// BookingFlow (venue = hackney, catalogue.category = 'golf').
//
// The newsletter signup is kept as a secondary "Not ready to book?"
// option so we still capture interest from browsers who aren't
// converting today — same public.newsletter_signups table, still
// tagged source='minigolf' so the founder can pull that list.
//
// CMS-editable copy (every line below uses a useContent fallback):
//   minigolf.eyebrow · minigolf.title · minigolf.intro
//   minigolf.cta_label · minigolf.newsletter_prompt
//   minigolf.signup_label · minigolf.signup_button
//   minigolf.signup_success · hero.minigolf (gallery)
// =============================================================

const FALLBACK_HERO = [
  "https://rntcujcpsozvuxvmlejv.supabase.co/storage/v1/object/public/media/page/1781610983789-golf-rsaterized-300x-colour.png",
];

export default function MiniGolfPage() {
  const eyebrow = useContent("minigolf.eyebrow", "Hackney · London Fields");
  const title = useContent("minigolf.title", "Mini Golf at No Dice");
  const intro = useContent(
    "minigolf.intro",
    "Nine holes of Polynesian-themed crazy golf, drinks in hand, tacos on the side. Book a tee time below.",
  );
  const ctaLabel = useContent("minigolf.cta_label", "Book a tee time");
  const newsletterPrompt = useContent(
    "minigolf.newsletter_prompt",
    "Not ready to book? Drop your email — we'll send openings, deals and event nights.",
  );
  const signupLabel = useContent(
    "minigolf.signup_label",
    "Get updates + offers",
  );
  const signupButton = useContent("minigolf.signup_button", "Notify me");
  const signupSuccess = useContent(
    "minigolf.signup_success",
    "You're on the list — we'll be in touch with openings and offers.",
  );

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    setErr("");
    try {
      const { error } = await supabase()
        .from("newsletter_signups")
        .insert({
          email: trimmed,
          source: "minigolf",
          consent: true,
        });
      if (error && !/duplicate|unique/i.test(error.message)) {
        throw error;
      }
      setDone(true);
    } catch (e2) {
      setErr(
        e2 instanceof Error
          ? e2.message
          : "Couldn't add you to the list — try again or email info@nodice.bar",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <PageHero
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        image={FALLBACK_HERO}
        eyebrowKey="minigolf.eyebrow"
        titleKey="minigolf.title"
        introKey="minigolf.intro"
        sliderKey="hero.minigolf"
      />

      <section className="px-6 pb-10 pt-4">
        <div className="mx-auto max-w-xl text-center">
          <Link
            href="/book/hackney"
            className="inline-block rounded-full bg-plonkPink px-10 py-4 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-plonkPink/90"
          >
            {ctaLabel}
          </Link>
          <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-cream/50">
            Pick date · time · party size · pay by card
          </p>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="mx-auto max-w-xl border-t border-cream/10 pt-10">
          {done ? (
            <div className="rounded-2xl border border-plonkTeal/40 bg-plonkTeal/10 px-6 py-7 text-center">
              <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-plonkTeal">
                You're on the list
              </div>
              <p className="mt-3 text-sm text-cream/85">{signupSuccess}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4 text-center">
              <p className="mx-auto max-w-md text-sm text-cream/70">
                {newsletterPrompt}
              </p>
              <label className="block">
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.28em] text-plonkPink">
                  {signupLabel}
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  placeholder="you@email.com"
                  className="w-full rounded-full border border-cream/15 bg-ink/40 px-5 py-3 text-center text-base text-cream placeholder-cream/40 focus:border-plonkPink focus:outline-none"
                  autoComplete="email"
                />
              </label>
              <button
                type="submit"
                disabled={busy || !email.trim()}
                className="rounded-full border border-cream/25 bg-transparent px-8 py-3 text-xs font-bold uppercase tracking-widest text-cream transition hover:bg-cream/10 disabled:opacity-50"
              >
                {busy ? "Adding you…" : signupButton}
              </button>
              {err && (
                <p className="text-xs text-plonkPink">{err}</p>
              )}
              <p className="pt-2 text-[10px] uppercase tracking-[0.2em] text-cream/45">
                One email. No spam.
              </p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
