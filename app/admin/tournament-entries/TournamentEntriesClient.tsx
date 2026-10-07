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
import AddTournamentEntryForm from "@/components/admin/AddTournamentEntryForm";

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
  // Defaults to "all" so the founder sees pending entries (which are
  // the ones that need action — chasing payment, refunds, mistakes)
  // as well as paid ones, instead of having to flip a filter on every
  // visit. Use the dropdown to narrow to "Paid only" when copying
  // team names into the tournament app.
  const [filterStatus, setFilterStatus] = useState<"paid" | "all">("all");
  // "Entries" (per-sign-up list) vs "Entrants" (one row per person, a
  // marketing mailing list across every tournament — founder 7 Oct 2026).
  const [view, setView] = useState<"entries" | "entrants">("entries");
  const [copiedEmails, setCopiedEmails] = useState(false);
  // Search + sortable columns (founder 5 Oct 2026 — parity with the
  // golf bookings list).
  const [search, setSearch] = useState("");
  type SortKey = "team" | "captain" | "tournament" | "signed" | "status";
  const [sortKey, setSortKey] = useState<SortKey>("signed");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }
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
    const q = search.trim().toLowerCase();
    const rows = entries.filter((e) => {
      if (filterTournamentId !== "all" && e.tournament_id !== filterTournamentId)
        return false;
      if (filterStatus === "paid" && e.status !== "paid") return false;
      if (q) {
        const hay = [e.team_name, e.captain_name, e.captain_email]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const val = (e: DbTournamentEntry): string => {
      const t = tournamentById.get(e.tournament_id);
      switch (sortKey) {
        case "team": return (e.team_name || "").toLowerCase();
        case "captain": return (e.captain_name || "").toLowerCase();
        case "tournament": return `${t?.event_date ?? ""} ${t?.name ?? ""}`.toLowerCase();
        case "signed": return e.created_at;
        case "status": return e.status;
      }
    };
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => val(a).localeCompare(val(b)) * dir);
  }, [entries, filterTournamentId, filterStatus, search, sortKey, sortDir, tournamentById]);

  // ── Entrants (marketing list) ──────────────────────────────────────
  // One row per unique person across EVERY tournament — captains and
  // their partners, deduped by email. The pool community mailing list.
  type Entrant = {
    name: string;
    email: string;
    phone: string;
    count: number;       // tournaments entered
    last: string;        // most recent event date (or signup date)
  };
  const entrants = useMemo(() => {
    const byEmail = new Map<string, Entrant>();
    const add = (
      name: string | null,
      email: string | null,
      phone: string | null,
      date: string,
    ) => {
      const e = (email || "").trim().toLowerCase();
      if (!e || !e.includes("@") || e === "info@nodice.bar") return;
      const existing = byEmail.get(e);
      if (existing) {
        existing.count += 1;
        if (date > existing.last) existing.last = date;
        if (!existing.name && name) existing.name = name.trim();
        if (!existing.phone && phone) existing.phone = phone.trim();
      } else {
        byEmail.set(e, {
          name: (name || "").trim(),
          email: e,
          phone: (phone || "").trim(),
          count: 1,
          last: date,
        });
      }
    };
    // Only real (paid) entrants matter for marketing — skip abandoned
    // checkouts. Apply the search box here too so you can narrow before
    // copying.
    const q = search.trim().toLowerCase();
    for (const en of entries) {
      if (en.status !== "paid") continue;
      const date =
        tournamentById.get(en.tournament_id)?.event_date ?? en.created_at.slice(0, 10);
      add(en.captain_name, en.captain_email, en.captain_phone, date);
      // Partner columns exist on the row (doubles/teams).
      const p = en as unknown as {
        partner_name?: string | null;
        partner_email?: string | null;
        partner_phone?: string | null;
      };
      add(p.partner_name ?? null, p.partner_email ?? null, p.partner_phone ?? null, date);
    }
    let list = [...byEmail.values()];
    if (q) {
      list = list.filter((e) =>
        `${e.name} ${e.email}`.toLowerCase().includes(q),
      );
    }
    // Most recently active first.
    list.sort((a, b) => b.last.localeCompare(a.last));
    return list;
  }, [entries, tournamentById, search]);

  async function copyEntrantEmails() {
    try {
      await navigator.clipboard.writeText(entrants.map((e) => e.email).join(", "));
      setCopiedEmails(true);
      setTimeout(() => setCopiedEmails(false), 1500);
    } catch {
      setErr("Couldn't copy — select the emails manually.");
    }
  }
  function downloadEntrantsCsv() {
    const header = ["Name", "Email", "Phone", "Tournaments", "Last played"];
    const rows = entrants.map((e) => [e.name, e.email, e.phone, String(e.count), e.last]);
    const csv = [header, ...rows]
      .map((r) => r.map((s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `pool-entrants-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

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
      "heard_from",
      "marketing_opt_in",
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
        e.heard_from ?? "",
        e.marketing_opt_in ? "yes" : "no",
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

      {/* Manual entry — phone / DM / walk-in sign-ups paying at the
          venue, or comp teams. Lands as a paid entry like the online
          ones. Mirrors the pool/table "+ Add booking manually" form. */}
      <AddTournamentEntryForm tournaments={tournaments} onCreated={reload} />

      {/* View toggle — the per-sign-up Entries list, or the deduped
          Entrants marketing list (founder 7 Oct 2026). */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["entries", "Entries"],
            ["entrants", "📣 All entrants"],
          ] as ["entries" | "entrants", string][]
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
              view === v
                ? "border-plonkPink bg-plonkPink text-white"
                : "border-cream/15 bg-ink/40 text-cream/75 hover:border-cream/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Action buttons — depend on the view. */}
      <div className="flex flex-wrap items-center gap-3">
        {view === "entries" ? (
          <>
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
          </>
        ) : (
          <>
            <button
              onClick={copyEntrantEmails}
              disabled={busy || loading || entrants.length === 0}
              className="rounded-full bg-plonkPink px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90 disabled:opacity-50"
            >
              {copiedEmails ? "Copied ✓" : `Copy ${entrants.length} emails`}
            </button>
            <button
              onClick={downloadEntrantsCsv}
              disabled={busy || loading || entrants.length === 0}
              className="rounded-full border border-cream/15 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5 disabled:opacity-50"
            >
              Download CSV
            </button>
          </>
        )}
      </div>

      {/* Row 1 — search */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search team, email, captain…"
          className="min-w-[220px] flex-1 rounded-full border border-cream/15 bg-ink/40 px-4 py-1.5 text-xs text-cream placeholder:text-cream/40 focus:border-plonkPink focus:outline-none"
        />
      </div>

      {/* Row 2 + 3 — status pills + tournament filter (Entries view only;
          the Entrants list is always all-paid, all-tournaments). */}
      {view === "entries" && (
        <>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "All"],
                ["paid", "Paid"],
              ] as ["all" | "paid", string][]
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setFilterStatus(v)}
                className={`rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                  filterStatus === v
                    ? "border-plonkPink bg-plonkPink text-white"
                    : "border-cream/15 bg-ink/40 text-cream/75 hover:border-cream/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterTournamentId}
              onChange={(e) => setFilterTournamentId(e.target.value)}
              className="rounded-full border border-cream/15 bg-ink/40 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-cream/85 focus:border-plonkPink focus:outline-none"
            >
              <option value="all">All tournaments</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.event_date}
                </option>
              ))}
            </select>
            <a
              href="/admin/calendar"
              className="ml-auto rounded-full border border-plonkTeal/50 bg-plonkTeal/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-plonkTeal transition hover:bg-plonkTeal/20"
            >
              📅 Calendar view
            </a>
          </div>
        </>
      )}

      {/* ENTRANTS marketing list */}
      {view === "entrants" ? (
        entrants.length === 0 ? (
          <p className="rounded-xl border border-cream/10 bg-ink/40 px-6 py-12 text-center text-sm text-cream/60">
            No paid entrants yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-cream/10">
            <table className="w-full text-sm">
              <thead className="bg-ink/40 text-[10px] uppercase tracking-widest text-cream/60">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-left">Tournaments</th>
                  <th className="px-4 py-3 text-left">Last played</th>
                </tr>
              </thead>
              <tbody>
                {entrants.map((e) => (
                  <tr key={e.email} className="border-t border-cream/5 hover:bg-cream/5">
                    <td className="px-4 py-3 font-medium">{e.name || "—"}</td>
                    <td className="px-4 py-3 text-cream/85">{e.email}</td>
                    <td className="px-4 py-3 text-cream/70">{e.phone || "—"}</td>
                    <td className="px-4 py-3 text-cream/85">{e.count}</td>
                    <td className="px-4 py-3 text-cream/70">{e.last}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : loading ? (
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
                {(
                  [
                    ["team", "Team"],
                    ["captain", "Captain"],
                    ["tournament", "Tournament"],
                    ["signed", "Signed up"],
                    ["status", "Status"],
                  ] as [SortKey, string][]
                ).map(([key, label]) => (
                  <th key={key} className="px-4 py-3 text-left">
                    <button
                      type="button"
                      onClick={() => toggleSort(key)}
                      className="flex items-center gap-1 uppercase tracking-widest transition hover:text-cream"
                    >
                      {label}
                      <span className="text-[10px] text-plonkPink">
                        {sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                ))}
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
                      {(e.heard_from || e.marketing_opt_in) && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {e.heard_from && (
                            <span className="rounded-full bg-cream/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-cream/60">
                              via {e.heard_from}
                            </span>
                          )}
                          {e.marketing_opt_in && (
                            <span className="rounded-full bg-plonkTeal/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-plonkTeal">
                              ✓ Newsletter
                            </span>
                          )}
                        </div>
                      )}
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
