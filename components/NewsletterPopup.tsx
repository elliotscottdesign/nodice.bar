"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// =============================================================
// NewsletterPopup — 20% off first booking, one per visitor
// =============================================================
// Pops once per browser (localStorage key) after the visitor's seen
// the cookie banner. Offers a 20% discount code for any No Dice
// event ticket. The code itself (WELCOME20 by default) is created
// in /admin/promos so the founder can swap, disable, or expire it
// without us pushing.
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
const DISCOUNT_CODE = "WELCOME20";

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
  const [copied, setCopied] = useState(false);

  // Suppress on admin pages — staff doing back-of-house work shouldn't
  // see the customer-facing 10%-off prompt.
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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError("That email doesn't look right.");
      return;
    }
    if (!optIn) {
      setError("Tick the box so we can email you the code.");
      return;
    }
    setError(null);
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

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(DISCOUNT_CODE);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be blocked — visitor can still read the code */
    }
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
                20% off your<br />first event
              </h2>
              <p className="mx-auto mt-4 max-w-xs text-center text-sm leading-relaxed text-cream/65">
                Drop your email and we'll send the code for 20% off your first
                event ticket at No Dice! Pool sessions, tournament nights,
                World Cup matches, DJ sessions or even golf!
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
                    Email me the code, plus the occasional update on what's
                    on. Unsubscribe anytime.
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
                  Send me the code
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
                Here's your code
              </h2>
              <button
                type="button"
                onClick={copyCode}
                className="mx-auto mt-6 flex w-full max-w-[260px] items-center justify-between gap-3 rounded-lg border border-dashed border-plonkPink/60 bg-plonkPink/10 px-4 py-3 text-left transition hover:bg-plonkPink/15"
              >
                <span className="font-display text-2xl tracking-[0.18em] text-plonkPink">
                  {DISCOUNT_CODE}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
                  {copied ? "Copied" : "Tap to copy"}
                </span>
              </button>
              <p className="mx-auto mt-5 max-w-xs text-sm leading-relaxed text-cream/65">
                20% off your first event ticket — applies at checkout. We've
                also sent it to <strong className="text-cream">{email}</strong>{" "}
                so you don't lose it.
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
