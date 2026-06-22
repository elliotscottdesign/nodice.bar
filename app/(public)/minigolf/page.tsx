"use client";

import { useState } from "react";
import PageHero from "@/components/PageHero";
import { useContent } from "@/lib/content";
import { supabase } from "@/lib/supabase";

// =============================================================
// /minigolf — coming-soon landing
// =============================================================
// Took over from the old external "Plonk Golf" link in the header
// when we decided the mini-golf course wouldn't be ready for launch.
// Single screen: hero + heading + body copy + email capture form.
//
// Newsletter signups land in the public.newsletter_signups table
// with source='minigolf' so the founder can pull a list when the
// course is ready to announce. RLS already allows anon inserts (see
// migration 20260608000001_newsletter-and-welcome-promo.sql) — no
// new Edge Function needed, no welcome email fires.
//
// CMS-editable copy (every line below uses a useContent fallback):
//   minigolf.eyebrow
//   minigolf.title
//   minigolf.intro
//   minigolf.signup_label
//   minigolf.signup_button
//   minigolf.signup_success
//   hero.minigolf — gallery key for the hero slider artwork
// =============================================================

// Default hero artwork — the golf bitmap already in storage. Renders
// until the founder uploads a slider via /admin/content/galleries
// with gallery key "hero.minigolf". An empty string here would break
// next/image; a real URL keeps the hero on screen even on a fresh DB.
const FALLBACK_HERO = [
  "https://rntcujcpsozvuxvmlejv.supabase.co/storage/v1/object/public/media/page/1781610983789-golf-rsaterized-300x-colour.png",
];

export default function MiniGolfPage() {
  const eyebrow = useContent(
    "minigolf.eyebrow",
    "Coming soon · Hackney",
  );
  const title = useContent("minigolf.title", "Mini Golf — Coming Soon");
  const intro = useContent(
    "minigolf.intro",
    "Our crazy-golf course at No Dice isn't open yet — but it's on the way. Drop your email and we'll let you know the moment doors swing open.",
  );
  const signupLabel = useContent(
    "minigolf.signup_label",
    "Get the opening night details",
  );
  const signupButton = useContent("minigolf.signup_button", "Notify me");
  const signupSuccess = useContent(
    "minigolf.signup_success",
    "You're on the list — we'll be in touch the moment the course is ready.",
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
      // Direct INSERT via the anon key. RLS on newsletter_signups
      // permits inserts from `anon` (the policy in the
      // 20260608000001 migration) but blocks reads, so the list can
      // never be scraped by the public. Source='minigolf' tags this
      // capture surface so the founder can pull a list separately
      // from the homepage popup signups when the course opens.
      const { error } = await supabase()
        .from("newsletter_signups")
        .insert({
          email: trimmed,
          source: "minigolf",
          consent: true,
        });
      // Duplicate (already signed up with same source) — treat as
      // success so the customer doesn't get re-prompted.
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

      <section className="px-6 pb-24 pt-4">
        <div className="mx-auto max-w-xl">
          {done ? (
            <div className="rounded-2xl border border-plonkTeal/40 bg-plonkTeal/10 px-6 py-7 text-center">
              <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-plonkTeal">
                You're on the list
              </div>
              <p className="mt-3 text-sm text-cream/85">{signupSuccess}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4 text-center">
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
                className="rounded-full bg-plonkPink px-8 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-plonkPink/90 disabled:opacity-50"
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
