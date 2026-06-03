"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "plonk_cookie_consent_v1";

type Consent = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
};

function loadConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Consent;
  } catch {
    return null;
  }
}

function saveConsent(c: Consent) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    window.dispatchEvent(new CustomEvent("plonk:cookies:changed", { detail: c }));
  } catch {
    /* ignore */
  }
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [customise, setCustomise] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(true);

  useEffect(() => {
    const existing = loadConsent();
    if (!existing) setVisible(true);
    else {
      setAnalytics(existing.analytics);
      setMarketing(existing.marketing);
    }

    const reopen = () => {
      const c = loadConsent();
      if (c) {
        setAnalytics(c.analytics);
        setMarketing(c.marketing);
      }
      setCustomise(true);
      setVisible(true);
    };
    window.addEventListener("plonk:cookies:open", reopen);
    return () => window.removeEventListener("plonk:cookies:open", reopen);
  }, []);

  function commit(a: boolean, m: boolean) {
    saveConsent({
      necessary: true,
      analytics: a,
      marketing: m,
      decidedAt: new Date().toISOString(),
    });
    setAnalytics(a);
    setMarketing(m);
    setVisible(false);
    setCustomise(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cookies-title"
      aria-modal="true"
      className="fixed inset-x-0 bottom-0 z-[100] px-4 pb-4 sm:px-6 sm:pb-6"
    >
      <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-forestLine/60 bg-forestDeep/95 shadow-2xl backdrop-blur">
        {!customise ? (
          <div className="grid gap-5 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-8 sm:p-7">
            <div>
              <h2 id="cookies-title" className="font-display text-2xl">
                Cookies on plonkgolf.co.uk
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-cream/75">
                We use cookies to make the site work, understand how it's used,
                and improve our ads. You can accept all, reject non-essential,
                or pick what you're happy with.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => commit(false, false)}
                className="rounded-full border border-cream/30 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-cream/80 transition hover:border-cream hover:text-cream"
              >
                Reject all
              </button>
              <button
                type="button"
                onClick={() => setCustomise(true)}
                className="rounded-full border border-cream/30 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-cream/80 transition hover:border-cream hover:text-cream"
              >
                Customise
              </button>
              <button
                type="button"
                onClick={() => commit(true, true)}
                className="rounded-full bg-plonkPink px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90"
              >
                Accept all
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <h2 id="cookies-title" className="font-display text-2xl">
                Cookie preferences
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setVisible(false)}
                className="rounded-full p-1 text-cream/60 transition hover:text-cream"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-cream/70">
              Choose which cookies you're happy for us to use. You can change
              your mind any time via the "Cookie settings" link in the footer.
            </p>

            <ul className="mt-6 space-y-3">
              <ConsentRow
                title="Strictly necessary"
                body="Required to make the site and booking flow work. Can't be turned off."
                checked
                disabled
                onChange={() => {}}
              />
              <ConsentRow
                title="Analytics"
                body="Helps us understand which pages people use, so we can make the site better. No personal data sold or shared."
                checked={analytics}
                onChange={setAnalytics}
              />
              <ConsentRow
                title="Marketing"
                body="Lets us measure our ads on Meta, Google and TikTok, and show you more relevant Plonk content elsewhere on the web."
                checked={marketing}
                onChange={setMarketing}
              />
            </ul>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => commit(false, false)}
                className="rounded-full border border-cream/30 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-cream/80 transition hover:border-cream hover:text-cream"
              >
                Reject all
              </button>
              <button
                type="button"
                onClick={() => commit(analytics, marketing)}
                className="rounded-full bg-plonkPink px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90"
              >
                Save preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConsentRow({
  title,
  body,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  body: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <li className="flex items-start justify-between gap-4 rounded-xl border border-forestLine/50 bg-forest/40 p-4">
      <div>
        <p className="text-sm font-semibold text-cream">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-cream/65">{body}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          disabled
            ? "cursor-not-allowed bg-forestLine/80"
            : checked
            ? "bg-plonkYellow"
            : "bg-forestLine"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-cream transition ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </li>
  );
}
