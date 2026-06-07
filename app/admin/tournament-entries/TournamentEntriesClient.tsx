"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadAllTournaments,
  loadTournamentEntries,
  setTournamentEntryStatus,
  type DbTournament,
  type DbTournamentEntry,
  type TournamentEntryStatus,
} from "@/lib/db/tournaments";

// Admin view of all tournament_entries. Two main jobs:
//   1. See who's paid — paid teams are the only thing that matters for
//      the tournament itself.
//   2. Get the team names into the tournament app fast: a big "Copy
//      team names" button copies just the paid teams' names (one per
//      line) to the clipboard so the founder can paste straight in.
// CSV export is on top for record-keeping.

function describe(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  return fallback;
}

const STATUS_LABEL: Record<TournamentEntryStatus, string> = {
  pending_payment: "Pending",
  paid: "Paid",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

const STATUS_COLOR: Record<TournamentEntryStatus, string> = {
  pending_payment: "bg-cream/10 text-cream/70",
  paid: "bg-plonkTeal/15 text-plonkTeal",
  refunded: "bg-plonkYellow/15 text-plonkYellow",
  cancelled: "bg-plonkPink/15 text-plonkPink",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPence(p: number): string {
  if (p % 100 === 0) return `£${p / 100}`;
  return `£${(p / 100).toFixed(2)}`;
}

export default function TournamentEntriesClient() {
  const [tournaments, setTournaments] = useState<DbTournament[]>([]);
  const [entries, setEntries] = useState<DbTournamentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [filterTournamentId, setFilterTournamentId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"paid" | "all">("paid");
  const [copied, setCopied] = useState(false);

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      const [t, e] = await Promise.all([
        loadAllTournaments(),
        loadTournamentEntries(),
      ]);
      setTournaments(t);
      setEntries(e);
    } catch (e) {
      setErr(describe(e, "Failed to load tournament data"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  const tournamentById = useMemo(() => {
    const m = new Map<string, DbTournament>();
    for (const t of tournaments) m.set(t.id, t);
    return m;
  }, [tournaments]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filterTournamentId !== "all" && e.tournament_id !== filterTournamentId)
        return false;
      if (filterStatus === "paid" && e.status !== "paid") return false;
      return true;
    });
  }, [entries, filterTournamentId, filterStatus]);

  async function handleSetStatus(
    entry: DbTournamentEntry,
    status: TournamentEntryStatus,
  ) {
    setBusy(true);
    try {
      await setTournamentEntryStatus(entry.id, status);
      await reload();
    } catch (e) {
      setErr(describe(e, "Status update failed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyTeamNames() {
    const names = filtered
      .filter((e) => e.status === "paid")
      .map((e) => e.team_name);
    if (names.length === 0) {
      setErr("No paid teams in the current filter to copy.");
      return;
    }
    try {
      await navigator.clipboard.writeText(names.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      setErr(describe(e, "Copy failed — your browser blocked clipboard"));
    }
  }

  function handleDownloadCsv() {
    const header = [
      "team_name",
      "captain_name",
      "captain_email",
      "captain_phone",
      "player_count",
      "tournament_name",
      "tournament_date",
      "status",
      "paid_at",
      "notes",
    ];
    const rows = filtered.map((e) => {
      const t = tournamentById.get(e.tournament_id);
      return [
        e.team_name,
        e.captain_name,
        e.captain_email,
        e.captain_phone,
        e.player_count ?? "",
        t?.name ?? "",
        t?.event_date ?? "",
        e.status,
        e.paid_at ?? "",
        e.notes ?? "",
      ];
    });
    const csv = [header, ...rows]
      .map((r) =>
        r
          .map((cell) => {
            const s = String(cell);
            if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
            return s;
          })
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tournament-entries-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {err && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      )}

      {/* Top action bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleCopyTeamNames}
          disabled={busy || loading}
          className="rounded-full bg-plonkPink px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90 disabled:opacity-50"
        >
          {copied ? "Copied ✓" : "Copy team names"}
        </button>
        <button
          onClick={handleDownloadCsv}
          disabled={busy || loading}
          className="rounded-full border border-cream/15 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5 disabled:opacity-50"
        >
          Download CSV
        </button>
        <div className="flex-1" />
        <select
          value={filterTournamentId}
          onChange={(e) => setFilterTournamentId(e.target.value)}
          className="rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream"
        >
          <option value="all">All tournaments</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} · {t.event_date}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) =>
            setFilterStatus(e.target.value as "paid" | "all")
          }
          className="rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream"
        >
          <option value="paid">Paid only</option>
          <option value="all">All statuses</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-cream/60">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-cream/10 bg-ink/40 px-6 py-12 text-center text-sm text-cream/60">
          No entries match the current filter.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-cream/10">
          <table className="w-full text-sm">
            <thead className="bg-ink/40 text-[10px] uppercase tracking-widest text-cream/60">
              <tr>
                <th className="px-4 py-3 text-left">Team</th>
                <th className="px-4 py-3 text-left">Captain</th>
                <th className="px-4 py-3 text-left">Tournament</th>
                <th className="px-4 py-3 text-left">Signed up</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const t = tournamentById.get(e.tournament_id);
                return (
                  <tr
                    key={e.id}
                    className="border-t border-cream/5 hover:bg-cream/5"
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="font-bold text-cream">{e.team_name}</div>
                      {e.player_count != null && (
                        <div className="text-xs text-cream/55">
                          {e.player_count} player
                          {e.player_count === 1 ? "" : "s"}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-cream/90">{e.captain_name}</div>
                      <div className="text-xs text-cream/55">
                        {e.captain_email}
                      </div>
                      <div className="text-xs text-cream/55">
                        {e.captain_phone}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-cream/90">{t?.name ?? "—"}</div>
                      <div className="text-xs text-cream/55">
                        {t?.event_date ?? ""}
                        {t?.entry_fee_pence
                          ? ` · ${formatPence(t.entry_fee_pence)}`
                          : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-cream/65">
                      {formatDateTime(e.created_at)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${STATUS_COLOR[e.status]}`}
                      >
                        {STATUS_LABEL[e.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      {e.status === "paid" && (
                        <button
                          onClick={() => handleSetStatus(e, "refunded")}
                          disabled={busy}
                          className="text-xs uppercase tracking-wider text-plonkYellow hover:underline disabled:opacity-30"
                          title="Mark as refunded (do the actual refund in Stripe first)"
                        >
                          Mark refunded
                        </button>
                      )}
                      {e.status === "pending_payment" && (
                        <button
                          onClick={() => handleSetStatus(e, "cancelled")}
                          disabled={busy}
                          className="text-xs uppercase tracking-wider text-plonkPink hover:underline disabled:opacity-30"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
