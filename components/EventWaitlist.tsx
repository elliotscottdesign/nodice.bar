"use client";

// ─── Event wait-list form (generic — any ticketed event) ─────────────────────
// Reusable across EVERY ticketed event: it kicks in when an event is sold out
// and shows in place of the booking form. All copy is driven by the event
// passed in (its own name) — nothing here is bingo-specific, so one event's
// listing text never leaks onto another (a historical bug when porting a rule
// from one event to the next). Writes to the shared `event_waitlist` table
// (anon insert-only RLS, return=minimal). We text people if a space opens for
// this event, and give them first shout for the next one.

import { useCallback, useState } from "react";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://rntcujcpsozvuxvmlejv.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const RED = "#D65139";
const UK_MOBILE = /^(?:\+?44\s?7\d{3}|07\d{3})\s?\d{3}\s?\d{3}$/;

export default function EventWaitlist({
  eventId,
  eventName,
  accent = RED,
  onClose,
}: {
  eventId?: string;
  /** The event's OWN name — drives all copy so it reads right per event. */
  eventName?: string;
  /** Lets a page match its own colourway (defaults to the site red). */
  accent?: string;
  onClose?: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [phase, setPhase] = useState<"form" | "saving" | "done">("form");
  const [error, setError] = useState("");

  const forName = eventName ? ` for ${eventName}` : "";

  const submit = useCallback(async () => {
    setError("");
    if (!name.trim()) {
      setError("Please add your name.");
      return;
    }
    const cleanedPhone = phone.replace(/\s+/g, "");
    if (!UK_MOBILE.test(cleanedPhone)) {
      setError("Please enter a UK mobile (07… or +44 7…) so we can text you if a space opens up.");
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("That email address doesn't look right.");
      return;
    }
    setPhase("saving");
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/event_waitlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          event_id: eventId ?? null,
          name: name.trim(),
          email: email.trim() || null,
          phone: cleanedPhone,
          marketing_opt_in: optIn,
        }),
      });
      if (!res.ok) throw new Error(`(${res.status})`);
      setPhase("done");
    } catch {
      setPhase("form");
      setError("Couldn't add you to the list just now — please try again.");
    }
  }, [name, email, phone, optIn, eventId]);

  const inputCls =
    "w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream placeholder:text-cream/35 focus:outline-none";
  const labelCls = "mb-2 block text-[10px] font-bold uppercase tracking-[0.28em]";

  if (phase === "done") {
    return (
      <div className="rounded-3xl border px-6 py-10 text-center" style={{ borderColor: `${accent}4d`, background: `${accent}0d` }}>
        <div className="font-display text-3xl uppercase tracking-wider text-cream">You&apos;re on the list</div>
        <p className="mx-auto mt-3 max-w-md text-sm text-cream/80">
          Thanks {name.trim().split(" ")[0]} — you&apos;re on the wait list{forName}. If a space opens up we&apos;ll text you first, and give you first shout for the next one too.
        </p>
        {onClose && (
          <button type="button" onClick={onClose} className="mt-6 rounded-full border border-cream/15 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-cream/85 hover:bg-cream/5">
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border bg-ink/40 px-6 py-8" style={{ borderColor: `${accent}4d` }}>
      <div className="text-center">
        <div className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: accent }}>Sold out</div>
        <div className="mt-2 font-display text-3xl uppercase tracking-wider text-cream">Join the wait list</div>
        <p className="mx-auto mt-2 max-w-md text-sm text-cream/70">
          This one&apos;s full. Add your details and we&apos;ll text you if a space frees up{forName} — and give you first shout for the next one.
        </p>
      </div>

      <div className="mx-auto mt-8 max-w-md space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelCls} style={{ color: accent }}>Your name</label>
            <input className={inputCls} style={{ borderColor: undefined }} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" onFocus={(e) => (e.currentTarget.style.borderColor = accent)} onBlur={(e) => (e.currentTarget.style.borderColor = "")} />
          </div>
          <div>
            <label className={labelCls} style={{ color: accent }}>Email <span className="text-cream/30">(optional)</span></label>
            <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" onFocus={(e) => (e.currentTarget.style.borderColor = accent)} onBlur={(e) => (e.currentTarget.style.borderColor = "")} />
          </div>
        </div>
        <div>
          <label className={labelCls} style={{ color: accent }}>Phone</label>
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="UK mobile (07… or +44 7…), we text you if a space opens" onFocus={(e) => (e.currentTarget.style.borderColor = accent)} onBlur={(e) => (e.currentTarget.style.borderColor = "")} />
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-cream/10 bg-ink/30 px-4 py-3">
          <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-0.5 h-4 w-4" style={{ accentColor: accent }} />
          <span className="text-sm text-cream/70">Keep me in the loop — send me No Dice news, future dates and the odd offer. Unsubscribe anytime.</span>
        </label>

        {error && <p className="text-sm text-[#ff8080]">{error}</p>}

        <div className="flex items-center justify-between gap-4 pt-1">
          {onClose ? (
            <button type="button" onClick={onClose} className="text-xs font-bold uppercase tracking-widest text-cream/50 hover:text-cream/80">Cancel</button>
          ) : <span />}
          <button
            type="button"
            onClick={submit}
            disabled={phase === "saving"}
            style={{ backgroundColor: accent }}
            className="rounded-full px-7 py-3 text-sm font-bold uppercase tracking-widest text-ink shadow-lg transition hover:opacity-90 disabled:opacity-50"
          >
            {phase === "saving" ? "Adding you…" : "Add me to the wait list"}
          </button>
        </div>
      </div>
    </div>
  );
}
