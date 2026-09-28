"use client";

import { useMemo, useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import {
  createManualTournamentEntry,
  type DbTournament,
} from "@/lib/db/tournaments";

// =============================================================
// AddTournamentEntryForm — manual admin tournament sign-up
// =============================================================
// The tournament equivalent of the pool/table "+ Add booking
// manually" form. For a sign-up that came in by phone / DM / in
// person (paying at the venue), or a comp / guest team. Lands the
// entry straight as `paid` so it counts as a real team and shows in
// Copy-team-names — no Stripe, no card. Mirrors the fields a customer
// fills on /book/tournament: team name, captain + (for doubles/teams)
// partner contact, notes. Settlement (Paid at venue / Comp) is
// recorded in the notes so it's distinguishable from a card payment.
// =============================================================

const inputCls =
  "w-full rounded-lg border border-cream/15 bg-ink/30 px-3 py-2 text-sm text-cream " +
  "placeholder:text-cream/40 focus:border-plonkPink focus:outline-none";

function formatEventDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function typeLabel(t: DbTournament["tournament_type"]): string {
  if (t === "singles") return "Singles";
  if (t === "doubles") return "Doubles";
  if (t === "teams") return "Teams";
  return "Special";
}

export default function AddTournamentEntryForm({
  tournaments,
  onCreated,
}: {
  tournaments: DbTournament[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // Upcoming first (today onward), then past — so the event you're
  // signing someone up for is at the top.
  const sortedTournaments = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = tournaments
      .filter((t) => t.event_date >= today)
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
    const past = tournaments
      .filter((t) => t.event_date < today)
      .sort((a, b) => b.event_date.localeCompare(a.event_date));
    return [...upcoming, ...past];
  }, [tournaments]);

  const [tournamentId, setTournamentId] = useState<string>(
    () => sortedTournaments[0]?.id ?? "",
  );
  const [teamName, setTeamName] = useState("");
  const [captainName, setCaptainName] = useState("");
  const [captainEmail, setCaptainEmail] = useState("");
  const [captainPhone, setCaptainPhone] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [partnerPhone, setPartnerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [settlement, setSettlement] = useState<"paid" | "comp">("paid");

  const selected = tournaments.find((t) => t.id === tournamentId);
  const isSingles = selected?.tournament_type === "singles";
  const isSpecial = selected?.tournament_type === "special";
  // Doubles + ping pong "teams" both take a partner. Singles / special
  // are one person.
  const isPair =
    selected?.tournament_type === "doubles" ||
    selected?.tournament_type === "teams";

  function reset() {
    setTeamName("");
    setCaptainName("");
    setCaptainEmail("");
    setCaptainPhone("");
    setPartnerName("");
    setPartnerEmail("");
    setPartnerPhone("");
    setNotes("");
    setSettlement("paid");
    setErr("");
    setOk("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setOk("");
    if (!tournamentId) {
      setErr("Pick a tournament.");
      return;
    }
    if (!captainName.trim()) {
      setErr(isSingles ? "Player name is required." : "Captain name is required.");
      return;
    }
    if (isPair && !teamName.trim()) {
      setErr("Team name is required for doubles / teams.");
      return;
    }

    // Singles: the player's name doubles as the team name (matches the
    // public flow). Pairs use the entered team name.
    const finalTeamName = isSingles || isSpecial
      ? captainName.trim()
      : teamName.trim();

    // Fold the settlement method into the note so it's visible in the
    // entries list and distinguishable from a Stripe payment.
    const settlementNote =
      settlement === "comp"
        ? "Manual entry · Comp (free)"
        : "Manual entry · Paid at venue";
    const finalNotes = notes.trim()
      ? `${settlementNote} — ${notes.trim()}`
      : settlementNote;

    setBusy(true);
    try {
      await createManualTournamentEntry({
        tournament_id: tournamentId,
        team_name: finalTeamName,
        captain_name: captainName.trim(),
        captain_email: captainEmail.trim(),
        captain_phone: captainPhone.trim(),
        partner_name: isPair ? partnerName.trim() || null : null,
        partner_email: isPair ? partnerEmail.trim() || null : null,
        partner_phone: isPair ? partnerPhone.trim() || null : null,
        player_count: isPair ? 2 : 1,
        notes: finalNotes,
      });
      setOk(
        `Entry added for ${finalTeamName} (${
          settlement === "comp" ? "comp" : "paid at venue"
        }).`,
      );
      reset();
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add entry.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={sortedTournaments.length === 0}
          className="rounded-full bg-plonkPink px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90 disabled:opacity-50"
        >
          + Add entry manually
        </button>
      </div>
    );
  }

  return (
    <AdminCard title="Add tournament entry">
      <form onSubmit={submit} className="space-y-4 px-5 py-5">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
            Tournament
          </label>
          <select
            value={tournamentId}
            onChange={(e) => setTournamentId(e.target.value)}
            className={inputCls + " mt-1"}
          >
            {sortedTournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {formatEventDate(t.event_date)} · {typeLabel(t.tournament_type)}
              </option>
            ))}
          </select>
        </div>

        {isPair && (
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
              Team name
            </label>
            <input
              type="text"
              required
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. The Cue Tips"
              className={inputCls + " mt-1"}
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
              {isPair ? "Captain name" : "Player name"}
            </label>
            <input
              type="text"
              required
              value={captainName}
              onChange={(e) => setCaptainName(e.target.value)}
              placeholder="Their name"
              className={inputCls + " mt-1"}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
              Email
            </label>
            <input
              type="email"
              value={captainEmail}
              onChange={(e) => setCaptainEmail(e.target.value)}
              placeholder="For confirmations / updates"
              className={inputCls + " mt-1"}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
              Phone
            </label>
            <input
              type="tel"
              value={captainPhone}
              onChange={(e) => setCaptainPhone(e.target.value)}
              placeholder="We text when they're up"
              className={inputCls + " mt-1"}
            />
          </div>
        </div>

        {isPair && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
                Partner name
              </label>
              <input
                type="text"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                placeholder="Second player"
                className={inputCls + " mt-1"}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
                Partner email
              </label>
              <input
                type="email"
                value={partnerEmail}
                onChange={(e) => setPartnerEmail(e.target.value)}
                placeholder="Optional"
                className={inputCls + " mt-1"}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
                Partner phone
              </label>
              <input
                type="tel"
                value={partnerPhone}
                onChange={(e) => setPartnerPhone(e.target.value)}
                placeholder="Optional"
                className={inputCls + " mt-1"}
              />
            </div>
          </div>
        )}

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
            Notes (optional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything staff should know"
            className={inputCls + " mt-1"}
          />
        </div>

        {/* Settlement — how the entry was paid for. Both count as a real
            paid team; the choice is recorded in the notes. */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
            Settlement
          </label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSettlement("paid")}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                settlement === "paid"
                  ? "border-plonkTeal/60 bg-plonkTeal/10 text-plonkTeal"
                  : "border-cream/15 bg-ink/30 text-cream/60 hover:bg-cream/5"
              }`}
            >
              <span className="block font-semibold">Paid at venue</span>
              <span className="mt-0.5 block text-[11px] text-cream/55">
                Cash or card on the till
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSettlement("comp")}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                settlement === "comp"
                  ? "border-plonkYellow/60 bg-plonkYellow/10 text-plonkYellow"
                  : "border-cream/15 bg-ink/30 text-cream/60 hover:bg-cream/5"
              }`}
            >
              <span className="block font-semibold">Comp (free)</span>
              <span className="mt-0.5 block text-[11px] text-cream/55">
                Guest / staff / free entry
              </span>
            </button>
          </div>
        </div>

        {err && (
          <div className="rounded-lg border border-plonkPink/40 bg-plonkPink/10 px-3 py-2 text-sm text-plonkPink">
            {err}
          </div>
        )}
        {ok && (
          <div className="rounded-lg border border-plonkTeal/40 bg-plonkTeal/10 px-3 py-2 text-sm text-plonkTeal">
            {ok}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            disabled={busy}
            className="rounded-full border border-cream/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cream/75 transition hover:bg-cream/5 disabled:opacity-50"
          >
            Close
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-plonkPink px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add entry"}
          </button>
        </div>
      </form>
    </AdminCard>
  );
}
