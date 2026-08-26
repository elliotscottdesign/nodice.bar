"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// =============================================================
// NewsletterPopup — join-the-list, one per visitor
// =============================================================
// Pops once per browser (localStorage key) after the visitor's seen
// the cookie banner. Plain email capture — the 20%-off WELCOME20
// incentive was retired 26 Aug 2026 (founder: "0 deals for emails").
//
// Re-open programmatically with `window.dispatchEvent(new
// CustomEvent("plonk:newsletter:open"))` — wired to the footer link.
//
// Branding follows CLAUDE.md: Bebas Neue display (`font-display`),
// DM Sans body, plonkPink accent (#DA1B33), ink background.
// =============================================================

const STORAGE_KEY = "nd_newsletter_v1";
const COOKIES_KEY = "plonk_cookie_consent_v1";
const SHOW_DELAY_MS = 4000;

// Signups insert straight into newsletter_signups with the anon key
// (RLS permits anon INSERT, blocks reads). The old send-welcome-discount
// Edge Function is no longer called — the WELCOME20 bribe was retired
// 26 Aug 2026 ("0 deals for emails", founder).
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://rntcujcpsozvuxvmlejv.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type StoredState =
  | { status: "dismissed"; ts: string }
  | {
      status: "submitted";
      email: string;
      optIn: boolean;
      ts: string;
      pending_sync: true;
    };

function load(): StoredState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function save(state: StoredState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function NewsletterPopup() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [optIn, setOptIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Suppress on admin pages — staff doing back-of-house work shouldn't
  // see the customer-facing signup prompt.
  const pathname = usePathname() ?? "";
  const isAdmin = pathname.startsWith("/admin");

  useEffect(() => {
    if (load()) return;

    const cookiesDecided = () => !!window.localStorage.getItem(COOKIES_KEY);

    let timer: number | null = null;
    let interval: number | null = null;

    const startTimer = () => {
      if (timer != null) return;
      timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    };

    if (cookiesDecided()) {
      startTimer();
    } else {
      interval = window.setInterval(() => {
        if (cookiesDecided()) {
          if (interval != null) window.clearInterval(interval);
          startTimer();
        }
      }, 500);
    }

    const reopen = () => {
      setSubmitted(false);
      setVisible(true);
    };
    window.addEventListener("plonk:newsletter:open", reopen);

    return () => {
      if (timer != null) window.clearTimeout(timer);
      if (interval != null) window.clearInterval(interval);
      window.removeEventListener("plonk:newsletter:open", reopen);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  function dismiss() {
    save({ status: "dismissed", ts: new Date().toISOString() });
    setVisible(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError("That email doesn't look right.");
      return;
    }
    if (!optIn) {
      setError("Tick the box so we can email you.");
      return;
    }
    setError(null);

    // Record the signup only — no discount email. (Founder direction
    // 26 Aug 2026: "0 deals for emails" — the WELCOME20 bribe is dead.
    // Direct insert with the anon key, same RLS-permitted pattern the
    // /minigolf capture uses; send-welcome-discount is no longer called.)
    // Best-effort — a network blip still shows the success screen, and
    // the localStorage state below ensures we won't pester them again.
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/newsletter_signups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          source: "popup",
          consent: true,
        }),
      });
    } catch {
      /* network blip — customer still sees the success screen */
    }

    save({
      status: "submitted",
      email: email.trim(),
      optIn,
      ts: new Date().toISOString(),
      pending_sync: true,
    });
    setSubmitted(true);
    window.dispatchEvent(
      new CustomEvent("plonk:newsletter:signup", {
        detail: { email: email.trim() },
      }),
    );
  }

  if (isAdmin || !visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="newsletter-title"
      aria-modal="true"
      className="fixed inset-0 z-[110] flex items-center justify-center px-4 py-6 sm:p-6"
    >
      {/* Backdrop — click to dismiss */}
      <button
        type="button"
        aria-label="Close"
        onClick={dismiss}
        className="absolute inset-0 cursor-default bg-black/85 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-cream/15 bg-ink shadow-2xl shadow-black/60">
        {/* Close button */}
        <button
          type="button"
          aria-label="Close"
          onClick={dismiss}
          className="absolute right-3 top-3 z-10 rounded-full p-2 text-cream/55 transition hover:bg-cream/10 hover:text-cream"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="px-7 pb-8 pt-9 sm:px-10 sm:pb-10 sm:pt-10">
          {/* Wordmark */}
          <div className="flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/nodice-wordmark.png`}
              alt="No Dice"
              style={{ width: 200, height: "auto", display: "block" }}
            />
          </div>

          {!submitted ? (
            <>
              <p className="mt-6 text-center text-[11px] font-bold uppercase tracking-[0.28em] text-plonkPink">
                Welcome to No Dice
              </p>
              <h2
                id="newsletter-title"
                className="mt-3 text-center font-display text-4xl uppercase leading-none tracking-wider text-cream sm:text-5xl"
              >
                Stay in<br />the loop
              </h2>
              <p className="mx-auto mt-4 max-w-xs text-center text-sm leading-relaxed text-cream/65">
                The occasional email on what's on at No Dice — pool
                tournaments, DJ nights, food residencies and golf.
                Unsubscribe anytime.
              </p>

              <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(ev) => {
                    setEmail(ev.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="you@email.com"
                  autoComplete="email"
                  className="w-full rounded-lg border border-cream/20 bg-ink/40 px-4 py-3 text-sm text-cream placeholder:text-cream/35 outline-none transition focus:border-plonkPink"
                />

                <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-cream/65">
                  <input
                    type="checkbox"
                    checked={optIn}
                    onChange={(ev) => {
                      setOptIn(ev.target.checked);
                      if (error) setError(null);
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-plonkPink"
                  />
                  <span>
                    Email me the occasional update on what's on.
                    Unsubscribe anytime.
                  </span>
                </label>

                {error && (
                  <p className="text-xs text-plonkPink" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full rounded-full bg-plonkPink py-3.5 text-xs font-bold uppercase tracking-[0.22em] text-white shadow-lg shadow-plonkPink/20 transition hover:bg-plonkPink/90"
                >
                  Join the list
                </button>

                <button
                  type="button"
                  onClick={dismiss}
                  className="block w-full text-center text-[11px] font-bold uppercase tracking-[0.22em] text-cream/45 hover:text-cream/70"
                >
                  No thanks
                </button>
              </form>
            </>
          ) : (
            <div className="mt-6 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-plonkTeal">
                You're in
              </p>
              <h2 className="mt-3 font-display text-4xl uppercase leading-none tracking-wider text-cream sm:text-5xl">
                See you soon
              </h2>
              <p className="mx-auto mt-5 max-w-xs text-sm leading-relaxed text-cream/65">
                We'll keep <strong className="text-cream">{email}</strong>{" "}
                posted on what's coming up. No spam.
              </p>
              <button
                type="button"
                onClick={() => setVisible(false)}
                className="mt-7 rounded-full border border-cream/20 px-6 py-2.5 text-xs font-bold uppercase tracking-[0.22em] text-cream/85 hover:bg-cream/5"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
