"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import {
  createTournamentEntry,
  loadOpenTournaments,
  type DbTournament,
} from "@/lib/db/tournaments";

// /book/tournament — public team sign-up form for pool tournaments.
//
// Flow:
//   1. We load all `registration_open=true` tournaments on mount.
//   2. If there's exactly one, pre-select it (cleanest UX). If
//      there's more than one (e.g. league night + championship in
//      the same fortnight), show a picker.
//   3. Customer fills team + captain details, clicks "Pay £X entry".
//   4. We INSERT a `pending_payment` row in `tournament_entries`,
//      then POST to the `tournament-checkout` Edge Function which
//      creates a Stripe Checkout session and returns its URL.
//   5. Browser redirects to Stripe.
//   6. After Stripe success → /book/tournament/success?session_id=...
//   7. The stripe-webhook Edge Function flips the row to `paid` async.

// Edge Function endpoint. Same Supabase project as everything else.
const CHECKOUT_FN_URL =
  (process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://rntcujcpsozvuxvmlejv.supabase.co") +
  "/functions/v1/tournament-checkout";

const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function formatFee(pence: number): string {
  if (pence % 100 === 0) return `£${pence / 100}`;
  return `£${(pence / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  // "2026-06-14" → "Sat 14 Jun 2026"
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function TournamentBookingPage() {
  return (
    <Suspense fallback={null}>
      <TournamentBookingPageInner />
    </Suspense>
  );
}

function TournamentBookingPageInner() {
  const [tournaments, setTournaments] = useState<DbTournament[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");

  const [tournamentId, setTournamentId] = useState<string>("");
  const [teamName, setTeamName] = useState("");
  const [captainName, setCaptainName] = useState("");
  const [captainEmail, setCaptainEmail] = useState("");
  const [captainPhone, setCaptainPhone] = useState("");
  const [playerCount, setPlayerCount] = useState<number | "">("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadOpenTournaments()
      .then((t) => {
        if (cancelled) return;
        setTournaments(t);
        // Auto-select if there's exactly one — saves a click.
        if (t.length === 1) setTournamentId(t[0].id);
      })
      .catch((e) => {
        if (cancelled) return;
        setListError(
          e instanceof Error
            ? e.message
            : "Couldn't load tournaments — refresh in a sec.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTournament = useMemo(
    () => tournaments.find((t) => t.id === tournamentId) ?? null,
    [tournaments, tournamentId],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTournament) {
      setError("Pick a tournament first.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      // 1. Create the pending entry row.
      const entry = await createTournamentEntry({
        tournament_id: selectedTournament.id,
        team_name: teamName.trim(),
        captain_name: captainName.trim(),
        captain_email: captainEmail.trim(),
        captain_phone: captainPhone.trim(),
        player_count: typeof playerCount === "number" ? playerCount : null,
        notes: notes.trim() || null,
      });

      // 2. Ask the Edge Function for a Stripe Checkout session.
      // Supabase requires an `Authorization: Bearer <anon-key>` header
      // for Edge Function calls, even when the function itself disables
      // JWT verification — without it the gateway returns 401 before
      // the function ever runs.
      const res = await fetch(CHECKOUT_FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          entry_id: entry.id,
          tournament_id: selectedTournament.id,
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(
          `Couldn't start checkout (${res.status}): ${txt || "no detail"}`,
        );
      }
      const { url } = (await res.json()) as { url?: string };
      if (!url) throw new Error("Checkout returned no URL — try again");

      // 3. Hard redirect to Stripe.
      window.location.assign(url);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't send the entry — try again or email info@nodice.bar",
      );
      setSubmitting(false);
    }
  }

  // ---- Render states ----

  if (loadingList) {
    return (
      <main className="px-6 py-24 text-center">
        <p className="text-sm text-cream/60">Loading…</p>
      </main>
    );
  }

  if (listError) {
    return (
      <main className="px-6 py-24 text-center">
        <p className="text-sm text-plonkPink">{listError}</p>
      </main>
    );
  }

  if (tournaments.length === 0) {
    return (
      <main className="px-6 py-24">
        <div className="mx-auto max-w-xl rounded-2xl border border-cream/10 p-10 text-center">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
            Tournaments
          </div>
          <h1 className="mt-3 font-display text-4xl uppercase tracking-wider">
            Nothing on right now
          </h1>
          <p className="mt-4 text-base text-cream/75">
            We're not running a pool tournament at the moment. Keep an eye on{" "}
            <a className="underline" href="/events">
              the events calendar
            </a>{" "}
            — next one will land there first.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 text-center text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
          Pool Tournament · Team Entry
        </div>
        <h1 className="text-center font-display text-5xl uppercase tracking-wider sm:text-6xl">
          Sign Up Your Team
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-center text-base text-cream/75">
          Entry is paid in advance to reserve your team's spot. You'll get
          a confirmation by email once payment lands.
        </p>

        <form onSubmit={submit} className="mt-12 space-y-8">
          {tournaments.length > 1 && (
            <FormSection label="Tournament">
              <div className="space-y-2">
                {tournaments.map((t) => {
                  const active = tournamentId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTournamentId(t.id)}
                      className={`block w-full rounded-lg border px-4 py-3 text-left transition ${
                        active
                          ? "border-plonkPink bg-plonkPink/10"
                          : "border-cream/15 bg-ink/40 hover:border-cream/40"
                      }`}
                    >
                      <div className="text-sm font-bold text-cream">
                        {t.name}
                      </div>
                      <div className="mt-1 text-xs text-cream/65">
                        {formatDate(t.event_date)}
                        {t.start_time ? ` · ${t.start_time.slice(0, 5)}` : ""} ·{" "}
                        {formatFee(t.entry_fee_pence)} per team
                      </div>
                    </button>
                  );
                })}
              </div>
            </FormSection>
          )}

          {tournaments.length === 1 && selectedTournament && (
            <div className="rounded-lg border border-cream/10 bg-ink/30 px-4 py-3 text-sm text-cream/85">
              <span className="font-bold">{selectedTournament.name}</span> ·{" "}
              {formatDate(selectedTournament.event_date)}
              {selectedTournament.start_time
                ? ` · ${selectedTournament.start_time.slice(0, 5)}`
                : ""}{" "}
              ·{" "}
              <span className="text-plonkPink">
                {formatFee(selectedTournament.entry_fee_pence)} per team
              </span>
            </div>
          )}

          <FormSection label="Team name">
            <input
              type="text"
              required
              maxLength={80}
              placeholder="e.g. The Cue Tips"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none"
            />
          </FormSection>

          <div className="grid gap-6 sm:grid-cols-2">
            <FormSection label="Captain name">
              <input
                type="text"
                required
                value={captainName}
                onChange={(e) => setCaptainName(e.target.value)}
                className="w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none"
              />
            </FormSection>
            <FormSection label="Captain email">
              <input
                type="email"
                required
                value={captainEmail}
                onChange={(e) => setCaptainEmail(e.target.value)}
                className="w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none"
              />
            </FormSection>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <FormSection label="Captain phone">
              <input
                type="tel"
                required
                value={captainPhone}
                onChange={(e) => setCaptainPhone(e.target.value)}
                className="w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none"
              />
            </FormSection>
            <FormSection label="Number of players (optional)">
              <input
                type="number"
                min={1}
                max={20}
                value={playerCount}
                onChange={(e) => {
                  const v = e.target.value;
                  setPlayerCount(v === "" ? "" : parseInt(v, 10) || "");
                }}
                className="w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none"
              />
            </FormSection>
          </div>

          <FormSection label="Anything else? (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Dietary needs, accessibility, song request…"
              className="w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-base text-cream focus:border-plonkPink focus:outline-none"
            />
          </FormSection>

          {error && (
            <div className="rounded-lg border border-plonkPink/40 bg-plonkPink/10 px-4 py-3 text-sm text-plonkPink">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !selectedTournament}
            className="w-full rounded-full bg-plonkPink py-4 text-sm font-bold uppercase tracking-widest text-white shadow-lg shadow-plonkPink/20 transition hover:bg-plonkPink/90 disabled:opacity-50"
          >
            {submitting
              ? "Sending you to checkout…"
              : selectedTournament
                ? `Pay ${formatFee(selectedTournament.entry_fee_pence)} entry`
                : "Pick a tournament first"}
          </button>

          <p className="text-center text-xs text-cream/55">
            Secure payment via Stripe. Your team's spot is held the moment
            payment clears.
          </p>
        </form>
      </div>
    </main>
  );
}

function FormSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
        {label}
      </label>
      {children}
    </div>
  );
}
