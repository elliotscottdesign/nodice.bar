"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

// =============================================================
// ComingSoonGate — public splash + preview unlock
// =============================================================
// While we keep the customer site hidden until 17 June, every public
// page renders this splash instead of the real content. It mirrors
// the existing nodice.bar landing on the investor deck ("OPENS 17
// JUNE") so visitors see a single, consistent message no matter
// which repo serves the domain.
//
// To preview the real site, append `?preview=NODICE17` to any URL
// (e.g. nodice.bar/?preview=NODICE17 or nodice.bar/world-cup?
// preview=NODICE17). That flips a sessionStorage flag and unlocks
// the whole session. Closing the tab re-locks.
//
// The /admin tree is NEVER gated — staff can keep working without
// the preview code. Routes that start with /admin are passed through
// untouched.
// =============================================================

const STORAGE_KEY = "nd_preview_unlocked";
const PREVIEW_CODE = "NODICE17";
const FOUNDER_EMAIL = "info@nodice.bar";

function hasUnlock(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(STORAGE_KEY) === "1";
}

export default function ComingSoonGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useSearchParams();
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    // 1) Accept the unlock code from the URL — set the session flag
    //    so subsequent navigation stays unlocked without keeping the
    //    `?preview=…` in the URL.
    const code = params.get("preview");
    if (code && code === PREVIEW_CODE) {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    }
    // 2) Admin tree is always unlocked.
    const onAdmin =
      typeof window !== "undefined" &&
      /^\/(nodice\.bar\/)?admin(\/|$)/.test(window.location.pathname);
    setUnlocked(hasUnlock() || onAdmin);
    setReady(true);
  }, [params]);

  // First render: don't flash the splash before we know if the
  // visitor already has a session unlock cookie.
  if (!ready) return null;

  if (unlocked) return <>{children}</>;

  return <Splash />;
}

function Splash() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    // Mailto fallback — keeps the signup working without an Apps
    // Script endpoint. Same pattern as the investor-deck landing.
    const subject = encodeURIComponent("No Dice · waitlist signup");
    const body = encodeURIComponent(
      `Add me to the No Dice waitlist for the 17 June opening.\n\nEmail: ${email.trim()}`,
    );
    window.location.href = `mailto:${FOUNDER_EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 py-10 text-cream">
      {/* Wordmark — same image the investor deck uses so the brand is
          identical across both surfaces. Prepend NEXT_PUBLIC_BASE_PATH
          because GitHub Pages serves this site under /nodice.bar/. */}
      <div className="mb-9 flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/nodice-wordmark.png`}
          alt="No Dice"
          style={{ width: "min(560px, 88vw)", height: "auto" }}
        />
      </div>

      <h1
        className="serif text-center uppercase"
        style={{
          fontFamily: "'Bebas Neue', 'Impact', sans-serif",
          fontSize: "clamp(1.4rem, 4vw, 2.6rem)",
          lineHeight: 1,
          letterSpacing: "0.08em",
          color: "#DA1B33",
          margin: "0 0 10px 0",
          fontWeight: 400,
        }}
      >
        Opens 17 June
      </h1>

      <div
        className="text-center uppercase"
        style={{
          fontSize: "clamp(0.65rem, 1.1vw, 0.78rem)",
          letterSpacing: "0.34em",
          color: "rgba(245,239,227,0.7)",
          marginBottom: 56,
          fontWeight: 600,
        }}
      >
        407 Mentmore Terrace, Hackney, E8 3PH
      </div>

      {sent ? (
        <div
          style={{
            maxWidth: 480,
            width: "100%",
            textAlign: "center",
            padding: "20px 24px",
            border: "1px solid rgba(218,27,51,0.45)",
            borderRadius: 10,
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#DA1B33",
              marginBottom: 8,
              fontWeight: 700,
            }}
          >
            You're on the list
          </div>
          <div style={{ fontSize: 14, color: "rgba(245,239,227,0.85)" }}>
            We'll let you know the moment doors open. 17 June.
          </div>
        </div>
      ) : (
        <form
          onSubmit={submit}
          style={{ width: "100%", maxWidth: 480, textAlign: "center" }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(245,239,227,0.6)",
              marginBottom: 14,
              fontWeight: 600,
            }}
          >
            Get the opening night details
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              style={{
                flex: 1,
                background: "rgba(218,27,51,0.08)",
                border: "1px solid rgba(218,27,51,0.4)",
                borderRadius: 8,
                padding: "12px 14px",
                color: "#F5EFE3",
                fontSize: 14,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            <button
              type="submit"
              style={{
                background: "rgba(218,27,51,0.7)",
                border: "1px solid rgba(218,27,51,0.7)",
                borderRadius: 8,
                color: "#FFFFFF",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                padding: "0 18px",
                cursor: "pointer",
              }}
            >
              Notify me
            </button>
          </div>
          <div
            style={{
              fontSize: 10,
              color: "rgba(245,239,227,0.4)",
              marginTop: 10,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            One email. No spam.
          </div>
        </form>
      )}
    </div>
  );
}
