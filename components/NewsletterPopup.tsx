"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const STORAGE_KEY = "plonk_newsletter_v1";
const COOKIES_KEY = "plonk_cookie_consent_v1";
const SHOW_DELAY_MS = 4000;

type StoredState =
  | { status: "dismissed"; ts: string }
  | { status: "submitted"; email: string; optIn: boolean; ts: string; pending_sync: true };

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

  // Allow ESC to close
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
      setError("Tick the box to confirm you'd like Plonk emails.");
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
      new CustomEvent("plonk:newsletter:signup", { detail: { email: email.trim() } })
    );
    window.setTimeout(() => setVisible(false), 2200);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="newsletter-title"
      aria-modal="true"
      className="fixed inset-0 z-[110] flex items-center justify-center px-4 py-6 sm:p-6"
    >
      {/* backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={dismiss}
        className="absolute inset-0 cursor-default bg-forestDeep/85 backdrop-blur-sm"
      />

      <div className="relative grid w-full max-w-3xl overflow-hidden rounded-2xl border border-forestLine/60 bg-forest shadow-2xl md:grid-cols-2">
        {/* close */}
        <button
          type="button"
          aria-label="Close"
          onClick={dismiss}
          className="absolute right-3 top-3 z-10 rounded-full bg-forestDeep/70 p-2 text-cream/80 transition hover:bg-forestDeep hover:text-cream"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* image */}
        <div className="relative hidden aspect-[4/5] md:block">
          <Image
            src="/hackney/garden/Garden_1.jpg"
            alt=""
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-forest/30" />
        </div>

        {/* form */}
        <div className="flex flex-col justify-center p-7 sm:p-10">
          {!submitted ? (
            <>
              <p className="text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
                Join the putt list
              </p>
              <h2
                id="newsletter-title"
                className="mt-3 font-display text-3xl leading-tight sm:text-4xl"
              >
                Get in on the action.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-cream/75">
                Early bookings, secret events and the occasional free round.
                No spam, ever.
              </p>

              <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
                <label className="block">
                  <span className="sr-only">Email</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="your@email.com"
                    autoComplete="email"
                    className="w-full rounded-full border border-forestLine bg-forestRaised px-5 py-3.5 text-sm text-cream placeholder:text-cream/40 outline-none transition focus:border-plonkYellow"
                  />
                </label>

                <label className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-cream/70">
                  <input
                    type="checkbox"
                    checked={optIn}
                    onChange={(e) => {
                      setOptIn(e.target.checked);
                      if (error) setError(null);
                    }}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                      optIn
                        ? "border-plonkYellow bg-plonkYellow text-forestDeep"
                        : "border-cream/40 bg-transparent"
                    }`}
                  >
                    {optIn && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  I'd like emails from Plonk Golf — news, offers and the odd
                  free round. Unsubscribe anytime.
                </label>

                {error && (
                  <p className="text-xs text-plonkPink" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full rounded-full bg-plonkPink px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-plonkPink/20 transition hover:bg-plonkPink/90"
                >
                  I'm in
                </button>
              </form>
            </>
          ) : (
            <div className="py-6 text-center">
              <p className="text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
                You're in
              </p>
              <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
                See you on the green.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-cream/75">
                We'll be in touch. In the meantime — pick a tee time.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
