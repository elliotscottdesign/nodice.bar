"use client";

// =============================================================
// /promoter — the promoter portal
// =============================================================
// Whoever is promoting an event (a DJ selling their own-ticket night, Billy
// running Comedy & Bingo, a chef pop-up) logs in with the email + password the
// venue set in the events builder and sees, for THEIR events only:
//   • live ticket sales (count, pending, revenue, capacity) — polled
//   • a copy-paste public ticket link for the poster
//   • the list of who's booked (name, qty, time)
//   • a notes thread to the venue (promoters don't edit the live event — they
//     ask here and the office actions it in the builder)
//
// Static export: ?k=<token> magic-link auto-login; otherwise email+password.
// Brand: Bebas (font-display) + Inter, dark No Dice template, mobile-first.
// =============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import {
  promoterLogin,
  promoterLoad,
  promoterAddNote,
  type PromoterSession,
  type PromoterEvent,
} from "@/lib/db/promoter";

const TOKEN_KEY = "nd_promoter_token";
const POLL_MS = 20000;

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function fmtTime(hhmmss: string | null): string {
  if (!hhmmss) return "";
  const [h, m] = hhmmss.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${ampm}` : `${h12}${ampm}`;
}
function fmtWhen(at: string): string {
  const d = new Date(at);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
function pounds(pence: number | null): string {
  if (pence == null) return "—";
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}

export default function PromoterPortalPage() {
  const [session, setSession] = useState<PromoterSession | null>(null);
  const [booting, setBooting] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep events fresh without disturbing the login shell.
  const refresh = useCallback(async (token: string) => {
    try {
      const s = await promoterLoad(token);
      setSession(s);
    } catch {
      // token no longer valid → drop to the login screen
      localStorage.removeItem(TOKEN_KEY);
      setSession(null);
    }
  }, []);

  // Boot: magic-link ?k= wins, else a stored token.
  useEffect(() => {
    const url = new URL(window.location.href);
    const magic = url.searchParams.get("k");
    const stored = localStorage.getItem(TOKEN_KEY);
    const token = magic || stored;
    if (magic) {
      // Tidy the URL so the token isn't left in the address bar / history.
      url.searchParams.delete("k");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
    if (!token) {
      setBooting(false);
      return;
    }
    promoterLoad(token)
      .then((s) => {
        localStorage.setItem(TOKEN_KEY, s.token);
        setSession(s);
      })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setBooting(false));
  }, []);

  // Live polling while signed in.
  useEffect(() => {
    if (!session) return;
    pollRef.current = setInterval(() => refresh(session.token), POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [session?.token, refresh]);

  function onLoggedIn(s: PromoterSession) {
    localStorage.setItem(TOKEN_KEY, s.token);
    setSession(s);
  }
  function signOut() {
    localStorage.removeItem(TOKEN_KEY);
    setSession(null);
  }

  if (booting) {
    return (
      <main className="min-h-screen bg-ink">
        <div className="mx-auto max-w-md px-6 py-28 text-center">
          <p className="text-sm text-cream/50">Loading…</p>
        </div>
      </main>
    );
  }

  if (!session) return <LoginScreen onLoggedIn={onLoggedIn} />;

  return (
    <Dashboard
      session={session}
      onSignOut={signOut}
      onRefresh={() => refresh(session.token)}
    />
  );
}

// ── Login ────────────────────────────────────────────────────────────────────
function LoginScreen({ onLoggedIn }: { onLoggedIn: (s: PromoterSession) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const s = await promoterLogin(email, password);
      onLoggedIn(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't sign you in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-ink text-cream">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">Promoter portal</p>
        <h1 className="mt-3 font-display text-5xl uppercase leading-none tracking-wide">No Dice</h1>
        <p className="mt-3 text-sm text-cream/60">
          Sign in to watch your ticket sales, grab your ticket link and send us your event details.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-cream/50">Email</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-cream/20 bg-ink/60 px-4 py-3 text-base text-cream outline-none focus:border-plonkPink"
              placeholder="you@email.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-cream/50">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-cream/20 bg-ink/60 px-4 py-3 text-base text-cream outline-none focus:border-plonkPink"
              placeholder="••••••••"
            />
          </div>
          {err && <p className="text-sm text-plonkPink">{err}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-plonkPink px-8 py-4 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-plonkPink/90 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-xs leading-relaxed text-cream/40">
          Your login was emailed to you when your event went on. Lost it? Ask the No Dice team to resend it.
        </p>
      </div>
    </main>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({
  session,
  onSignOut,
  onRefresh,
}: {
  session: PromoterSession;
  onSignOut: () => void;
  onRefresh: () => void;
}) {
  const name = session.promoter.name || "there";
  return (
    <main className="min-h-screen bg-ink text-cream">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">Promoter portal</p>
            <h1 className="mt-2 font-display text-4xl uppercase leading-none tracking-wide sm:text-5xl">
              Hi {name.split(" ")[0]}
            </h1>
          </div>
          <button
            onClick={onSignOut}
            className="shrink-0 rounded-full border border-cream/25 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-cream/70 transition hover:border-cream/50"
          >
            Sign out
          </button>
        </div>

        {session.events.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-cream/15 bg-ink/40 px-6 py-12 text-center">
            <p className="text-sm text-cream/60">
              No events are linked to your account yet. The No Dice team sets these up — give them a shout.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {session.events.map((ev) => (
              <EventCard key={ev.id} ev={ev} token={session.token} onRefresh={onRefresh} />
            ))}
          </div>
        )}

        <p className="mt-10 text-center text-[11px] uppercase tracking-widest text-cream/30">
          Sales update automatically · No Dice · London Fields
        </p>
      </div>
    </main>
  );
}

function EventCard({ ev, token, onRefresh }: { ev: PromoterEvent; token: string; onRefresh: () => void }) {
  const [copied, setCopied] = useState(false);
  const [showBuyers, setShowBuyers] = useState(false);
  const [note, setNote] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteErr, setNoteErr] = useState<string | null>(null);

  const past = ev.event_date < new Date().toISOString().slice(0, 10);
  const capPct =
    ev.maxAttendees && ev.maxAttendees > 0
      ? Math.min(100, Math.round((ev.soldTickets / ev.maxAttendees) * 100))
      : null;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(ev.shareUrl);
    } catch {
      // Fallback for older mobile browsers.
      const t = document.createElement("textarea");
      t.value = ev.shareUrl;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      document.body.removeChild(t);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function sendNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setNoteBusy(true);
    setNoteErr(null);
    try {
      await promoterAddNote(token, ev.id, note.trim());
      setNote("");
      onRefresh();
    } catch (e) {
      setNoteErr(e instanceof Error ? e.message : "Couldn't send that.");
    } finally {
      setNoteBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-cream/15 bg-ink/40">
      {/* Header */}
      <div className="flex gap-4 p-5">
        {ev.poster_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ev.poster_url}
            alt={ev.name}
            className="h-20 w-20 shrink-0 rounded-lg object-cover sm:h-24 sm:w-24"
          />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl uppercase leading-tight tracking-wide sm:text-3xl">{ev.name}</h2>
          <p className="mt-1 text-sm text-cream/60">
            {fmtDate(ev.event_date)}
            {ev.start_time ? ` · ${fmtTime(ev.start_time)}` : ""}
            {past ? " · past" : ""}
          </p>
          {ev.pricePence != null && (
            <p className="mt-0.5 text-xs font-bold uppercase tracking-widest text-cream/45">
              {ev.pricePence === 0 ? "Free entry" : `${pounds(ev.pricePence)} a ticket`}
            </p>
          )}
        </div>
      </div>

      {/* Live stats */}
      <div className="grid grid-cols-3 gap-px bg-cream/10">
        <Stat label="Sold" value={String(ev.soldTickets)} big />
        <Stat
          label={ev.maxAttendees ? `of ${ev.maxAttendees}` : "In progress"}
          value={ev.maxAttendees ? `${capPct}%` : String(ev.pendingTickets)}
        />
        <Stat label="Taken" value={pounds(ev.revenuePence)} />
      </div>
      {capPct != null && (
        <div className="h-1 w-full bg-cream/10">
          <div className="h-full bg-plonkPink" style={{ width: `${capPct}%` }} />
        </div>
      )}

      <div className="space-y-4 p-5">
        {/* Copy ticket link */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-cream/45">Your ticket link</p>
          <div className="flex items-stretch gap-2">
            <div className="min-w-0 flex-1 truncate rounded-lg border border-cream/15 bg-ink/60 px-3 py-2.5 text-xs text-cream/70">
              {ev.shareUrl}
            </div>
            <button
              onClick={copyLink}
              className="shrink-0 rounded-lg bg-plonkPink px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-plonkPink/90"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-cream/35">Share this on your poster and socials — it opens the ticket page.</p>
        </div>

        {/* Who's booked */}
        <div>
          <button
            onClick={() => setShowBuyers((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-cream/15 bg-ink/40 px-3 py-2.5 text-left"
          >
            <span className="text-[11px] font-bold uppercase tracking-widest text-cream/60">
              Who&apos;s booked ({ev.buyers.length})
            </span>
            <span className="text-cream/40">{showBuyers ? "▲" : "▼"}</span>
          </button>
          {showBuyers && (
            <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
              {ev.buyers.length === 0 ? (
                <p className="px-1 py-3 text-sm text-cream/40">No bookings yet.</p>
              ) : (
                ev.buyers.map((b, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-lg bg-ink/50 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1 truncate">
                      <span className="text-cream/90">{b.name}</span>
                      {b.qty > 1 && <span className="text-cream/45"> ×{b.qty}</span>}
                    </div>
                    <span className="shrink-0 text-xs text-cream/40">{fmtWhen(b.at)}</span>
                    {b.status !== "paid" && (
                      <span className="shrink-0 rounded-full bg-cream/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-cream/50">
                        pending
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Notes to the venue */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-cream/45">Notes to No Dice</p>
          {ev.notes.length > 0 && (
            <div className="mb-2 space-y-2">
              {ev.notes.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    n.author === "office"
                      ? "bg-plonkPink/10 text-cream/90"
                      : "bg-ink/50 text-cream/80"
                  }`}
                >
                  <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-cream/40">
                    {n.author === "office" ? "No Dice" : "You"} · {fmtWhen(n.at)}
                  </p>
                  <p className="whitespace-pre-wrap">{n.body}</p>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={sendNote} className="space-y-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Send details or a request to the team — guest list, timings, tech, anything…"
              className="w-full resize-none rounded-lg border border-cream/15 bg-ink/60 px-3 py-2.5 text-base text-cream outline-none focus:border-plonkPink"
            />
            {noteErr && <p className="text-xs text-plonkPink">{noteErr}</p>}
            <button
              type="submit"
              disabled={noteBusy || !note.trim()}
              className="rounded-full border border-cream/25 px-5 py-2 text-[11px] font-bold uppercase tracking-widest text-cream/80 transition hover:border-cream/50 disabled:opacity-40"
            >
              {noteBusy ? "Sending…" : "Send to No Dice"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="bg-ink/60 px-3 py-4 text-center">
      <div className={`font-display tracking-wide text-cream ${big ? "text-4xl" : "text-3xl"}`}>{value}</div>
      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-cream/45">{label}</div>
    </div>
  );
}
