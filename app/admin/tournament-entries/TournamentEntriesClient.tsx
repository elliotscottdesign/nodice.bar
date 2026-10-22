"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadAllTournaments,
  type DbTournament,
} from "@/lib/db/tournaments";
import {
  loadTrackerEvents,
  loadAllTrackerEntries,
  setTrackerEntryStatus,
  type TrackerEvent,
  type TrackerTypeGroup,
  type TrackerEntryStatus,
  type TrackerEntryRow,
} from "@/lib/db/specialEvents";
import { buildMonthGrid, ymd } from "@/lib/calendarGrid";
import AddTournamentEntryForm from "@/components/admin/AddTournamentEntryForm";
import Notice from "@/components/Notice";
import BookingLockedTag from "@/components/admin/BookingLockedTag";

// Unified "Special events & tournaments" bookings tracker. Browses
// every tournament (legacy `tournaments` table) AND the relevant
// events-platform rows (food nights, pool specials, World Cup match
// days) in one place — as a card browser or a month calendar — then
// lists and manages the sign-ups for whichever event is in focus.
//
// Preserves the original tournament-entries jobs:
//   • See who's paid, and copy paid team names into the tournament app.
//   • CSV export + a deduped "all entrants" marketing list.

function describe(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  return fallback;
}

const STATUS_LABEL: Record<TrackerEntryStatus, string> = {
  pending_payment: "Pending",
  paid: "Paid",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

const STATUS_COLOR: Record<TrackerEntryStatus, string> = {
  pending_payment: "bg-cream/10 text-cream/70",
  paid: "bg-plonkTeal/15 text-plonkTeal",
  refunded: "bg-plonkYellow/15 text-plonkYellow",
  cancelled: "bg-plonkPink/15 text-plonkPink",
};

// ── Type-group presentation (pills, card badges, calendar chips) ──────
type TypeMeta = {
  label: string;
  short: string;
  badge: string; // card badge + calendar chip classes
};
const TYPE_META: Record<TrackerTypeGroup, TypeMeta> = {
  special: {
    label: "Special events",
    short: "Special",
    badge: "bg-plonkPink/20 text-plonkPink border-plonkPink/40",
  },
  food: {
    label: "Food nights",
    short: "Food",
    badge: "bg-amber-400/20 text-amber-300 border-amber-400/40",
  },
  tournament: {
    label: "Tournaments",
    short: "Tournament",
    badge: "bg-plonkTeal/20 text-plonkTeal border-plonkTeal/40",
  },
};
const TYPE_ORDER: TrackerTypeGroup[] = ["special", "food", "tournament"];

function keyOfEvent(ev: TrackerEvent): string {
  return `${ev.source}:${ev.id}`;
}
function keyOfRow(r: TrackerEntryRow): string {
  return `${r.eventSource}:${r.eventId}`;
}

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

// "Sat 24 Oct" from a YYYY-MM-DD.
function formatEventDate(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function TournamentEntriesClient() {
  const [events, setEvents] = useState<TrackerEvent[]>([]);
  const [rows, setRows] = useState<TrackerEntryRow[]>([]);
  const [tournaments, setTournaments] = useState<DbTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Event browser.
  const [typeFilter, setTypeFilter] = useState<"all" | TrackerTypeGroup>("all");
  // Date filter — the SAME pills as the Bookings view (founder 20 Oct 2026,
  // prep for merging into one booking system + CRM). Defaults to "upcoming".
  const [dateFilter, setDateFilter] = useState<
    "upcoming" | "today" | "week" | "past" | "all"
  >("upcoming");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "calendar">("list");

  // Calendar nav.
  const now = useMemo(() => new Date(), []);
  const [cal, setCal] = useState<{ year: number; month: number }>({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [calDay, setCalDay] = useState<string | null>(null);

  // Entries vs the deduped Entrants marketing list.
  const [view, setView] = useState<"entries" | "entrants">("entries");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "paid" | "pending_payment" | "cancelled" | "refunded"
  >("all");
  const [search, setSearch] = useState("");
  type SortKey = "team" | "captain" | "event" | "signed" | "status";
  const [sortKey, setSortKey] = useState<SortKey>("signed");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }
  const [copied, setCopied] = useState(false);
  const [copiedEmails, setCopiedEmails] = useState(false);

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      const [evs, allRows, tourneys] = await Promise.all([
        loadTrackerEvents(),
        loadAllTrackerEntries(),
        loadAllTournaments(),
      ]);
      setEvents(evs);
      setRows(allRows);
      setTournaments(tourneys);
    } catch (e) {
      setErr(describe(e, "Failed to load bookings"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  const eventByKey = useMemo(() => {
    const m = new Map<string, TrackerEvent>();
    for (const ev of events) m.set(keyOfEvent(ev), ev);
    return m;
  }, [events]);

  // Events in the active type + date filter (drives the card grid + calendar
  // + the combined "all events" entries scope). Date logic mirrors the Bookings
  // view exactly (ISO string compare) so the two read the same.
  const visibleEvents = useMemo(() => {
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const todayIso = iso(now);
    const weekIso = iso(new Date(now.getTime() + 7 * 86400_000));
    return events.filter((e) => {
      if (typeFilter !== "all" && e.typeGroup !== typeFilter) return false;
      const sd = e.event_date;
      if (dateFilter === "today") return sd === todayIso;
      if (dateFilter === "upcoming") return sd >= todayIso;
      if (dateFilter === "week") return sd >= todayIso && sd <= weekIso;
      if (dateFilter === "past") return sd < todayIso;
      return true; // "all"
    });
  }, [events, typeFilter, dateFilter, now]);

  const typeCounts = useMemo(() => {
    const c: Record<TrackerTypeGroup, number> = {
      special: 0,
      food: 0,
      tournament: 0,
    };
    for (const e of events) c[e.typeGroup] += 1;
    return c;
  }, [events]);

  const selectedEvent = selectedKey
    ? eventByKey.get(selectedKey) ?? null
    : null;

  // ── Entries table rows (status/search/sort applied) ────────────────
  const filtered = useMemo(() => {
    const allowed = new Set(visibleEvents.map(keyOfEvent));
    const q = search.trim().toLowerCase();
    const scoped = rows.filter((r) => {
      const k = keyOfRow(r);
      if (selectedKey) {
        if (k !== selectedKey) return false;
      } else if (!allowed.has(k)) {
        return false;
      }
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (q) {
        const hay = [r.team_name, r.captain_name, r.captain_email]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const val = (r: TrackerEntryRow): string => {
      const ev = eventByKey.get(keyOfRow(r));
      switch (sortKey) {
        case "team":
          return (r.team_name || "").toLowerCase();
        case "captain":
          return (r.captain_name || "").toLowerCase();
        case "event":
          return `${ev?.event_date ?? ""} ${ev?.name ?? ""}`.toLowerCase();
        case "signed":
          return r.created_at;
        case "status":
          return r.status;
      }
    };
    const dir = sortDir === "asc" ? 1 : -1;
    return [...scoped].sort((a, b) => val(a).localeCompare(val(b)) * dir);
  }, [
    rows,
    visibleEvents,
    selectedKey,
    filterStatus,
    search,
    sortKey,
    sortDir,
    eventByKey,
  ]);

  // ── Entrants marketing list — one row per unique paid person across
  //    every event (captains + partners), deduped by email. ───────────
  type Entrant = {
    name: string;
    email: string;
    phone: string;
    count: number;
    last: string;
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
    const q = search.trim().toLowerCase();
    for (const r of rows) {
      if (r.status !== "paid") continue;
      const date =
        eventByKey.get(keyOfRow(r))?.event_date ?? r.created_at.slice(0, 10);
      add(r.captain_name, r.captain_email, r.captain_phone, date);
      add(
        r.partner_name ?? null,
        r.partner_email ?? null,
        r.partner_phone ?? null,
        date,
      );
    }
    let list = [...byEmail.values()];
    if (q) {
      list = list.filter((e) =>
        `${e.name} ${e.email}`.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => b.last.localeCompare(a.last));
    return list;
  }, [rows, eventByKey, search]);

  async function copyEntrantEmails() {
    try {
      await navigator.clipboard.writeText(
        entrants.map((e) => e.email).join(", "),
      );
      setCopiedEmails(true);
      setTimeout(() => setCopiedEmails(false), 1500);
    } catch {
      setErr("Couldn't copy — select the emails manually.");
    }
  }
  function downloadEntrantsCsv() {
    const header = ["Name", "Email", "Phone", "Events", "Last played"];
    const data = entrants.map((e) => [
      e.name,
      e.email,
      e.phone,
      String(e.count),
      e.last,
    ]);
    const csv = [header, ...data]
      .map((r) =>
        r
          .map((s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s))
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `entrants-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleSetStatus(
    row: TrackerEntryRow,
    status: TrackerEntryStatus,
  ) {
    const ev = eventByKey.get(keyOfRow(row));
    if (!ev) {
      setErr("Couldn't find the event for this sign-up.");
      return;
    }
    setBusy(true);
    try {
      await setTrackerEntryStatus(ev, row.id, status);
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
      "event_name",
      "event_date",
      "event_type",
      "status",
      "paid_at",
      "heard_from",
      "marketing_opt_in",
      "notes",
    ];
    const data = filtered.map((e) => {
      const ev = eventByKey.get(keyOfRow(e));
      return [
        e.team_name,
        e.captain_name,
        e.captain_email,
        e.captain_phone,
        e.player_count ?? "",
        ev?.name ?? "",
        ev?.event_date ?? "",
        ev?.category ?? "",
        e.status,
        e.paid_at ?? "",
        e.heard_from ?? "",
        e.marketing_opt_in ? "yes" : "no",
        e.notes ?? "",
      ];
    });
    const csv = [header, ...data]
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
    a.download = `special-events-entries-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Calendar: events keyed by date, within the active type filter ──
  const eventsByDate = useMemo(() => {
    const m = new Map<string, TrackerEvent[]>();
    for (const ev of visibleEvents) {
      const arr = m.get(ev.event_date);
      if (arr) arr.push(ev);
      else m.set(ev.event_date, [ev]);
    }
    return m;
  }, [visibleEvents]);

  const grid = useMemo(
    () => buildMonthGrid(cal.year, cal.month),
    [cal.year, cal.month],
  );
  function stepMonth(delta: number) {
    setCalDay(null);
    setCal((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  // Small presentational card used in the browser grid + the calendar
  // day panel.
  function EventCard({ ev }: { ev: TrackerEvent }) {
    const meta = TYPE_META[ev.typeGroup];
    const active = keyOfEvent(ev) === selectedKey;
    return (
      <button
        type="button"
        onClick={() => setSelectedKey(active ? null : keyOfEvent(ev))}
        className={`flex flex-col gap-2 rounded-2xl border p-4 text-left transition ${
          active
            ? "border-plonkPink bg-plonkPink/10"
            : "border-cream/10 bg-ink/40 hover:border-cream/30"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-cream/60">
            {formatEventDate(ev.event_date)}
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${meta.badge}`}
          >
            {meta.short}
          </span>
        </div>
        <div className="font-display text-base leading-tight text-cream">
          {ev.name}
        </div>
        <div className="text-xs text-cream/60">
          {ev.count > 0
            ? `${ev.count} signed up`
            : "No sign-ups"}
        </div>
      </button>
    );
  }

  return (
    <div className="space-y-6">
      {err && <Notice variant="error">{err}</Notice>}

      {/* Manual entry — phone / DM / walk-in sign-ups paying at the
          venue, or comp teams (tournaments only). */}
      <AddTournamentEntryForm tournaments={tournaments} onCreated={reload} />

      {/* ── Event browser header: type pills + list/calendar toggle ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setTypeFilter("all");
              setSelectedKey(null);
            }}
            className={`rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
              typeFilter === "all"
                ? "border-plonkPink bg-plonkPink text-white"
                : "border-cream/15 bg-ink/40 text-cream/75 hover:border-cream/40"
            }`}
          >
            All ({events.length})
          </button>
          {TYPE_ORDER.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => {
                setTypeFilter(g);
                setSelectedKey(null);
              }}
              className={`rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                typeFilter === g
                  ? "border-plonkPink bg-plonkPink text-white"
                  : "border-cream/15 bg-ink/40 text-cream/75 hover:border-cream/40"
              }`}
            >
              {TYPE_META[g].label} ({typeCounts[g]})
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          {(["list", "calendar"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                mode === m
                  ? "border-plonkTeal bg-plonkTeal/15 text-plonkTeal"
                  : "border-cream/15 bg-ink/40 text-cream/75 hover:border-cream/40"
              }`}
            >
              {m === "list" ? "▦ List" : "📅 Calendar"}
            </button>
          ))}
        </div>
      </div>

      {/* Date filter — the SAME pills as the Bookings view (prep for the merged
          booking system + CRM, founder 20 Oct 2026). */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: "upcoming" as const, label: "Upcoming" },
            { id: "today" as const, label: "Today" },
            { id: "week" as const, label: "Next 7 days" },
            { id: "past" as const, label: "Past" },
            { id: "all" as const, label: "All dates" },
          ]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setDateFilter(t.id)}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
              dateFilter === t.id
                ? "border-plonkYellow bg-plonkYellow/15 text-plonkYellow"
                : "border-cream/15 bg-ink/40 text-cream/60 hover:border-cream/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Focus / deselect chip. */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setSelectedKey(null)}
          className={`rounded-full border px-4 py-1.5 font-bold uppercase tracking-wider transition ${
            selectedKey === null
              ? "border-plonkPink bg-plonkPink text-white"
              : "border-cream/15 bg-ink/40 text-cream/75 hover:border-cream/40"
          }`}
        >
          All events
        </button>
        {selectedEvent && (
          <span className="text-cream/70">
            Showing sign-ups for{" "}
            <strong className="text-cream">{selectedEvent.name}</strong> ·{" "}
            {formatEventDate(selectedEvent.event_date)}
          </span>
        )}
      </div>

      {/* ── LIST (card browser) ── */}
      {mode === "list" &&
        (loading ? (
          <p className="text-sm text-cream/60">Loading…</p>
        ) : visibleEvents.length === 0 ? (
          <p className="rounded-xl border border-cream/10 bg-ink/40 px-6 py-10 text-center text-sm text-cream/60">
            No events in this filter yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleEvents.map((ev) => (
              <EventCard key={keyOfEvent(ev)} ev={ev} />
            ))}
          </div>
        ))}

      {/* ── CALENDAR ── */}
      {mode === "calendar" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => stepMonth(-1)}
              className="rounded-full border border-cream/15 bg-ink/40 px-3 py-1.5 text-xs font-bold text-cream/80 hover:border-cream/40"
            >
              ‹ Prev
            </button>
            <div className="font-display text-lg text-cream">
              {monthLabel(cal.year, cal.month)}
            </div>
            <button
              type="button"
              onClick={() => stepMonth(1)}
              className="rounded-full border border-cream/15 bg-ink/40 px-3 py-1.5 text-xs font-bold text-cream/80 hover:border-cream/40"
            >
              Next ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-widest text-cream/50">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((day, i) => {
              if (day === null)
                return <div key={`x${i}`} className="min-h-[72px]" />;
              const dateIso = ymd(cal.year, cal.month, day);
              const dayEvents = eventsByDate.get(dateIso) ?? [];
              const isSel = calDay === dateIso;
              return (
                <button
                  type="button"
                  key={dateIso}
                  onClick={() =>
                    setCalDay(dayEvents.length ? (isSel ? null : dateIso) : null)
                  }
                  className={`min-h-[72px] rounded-lg border p-1 text-left align-top transition ${
                    isSel
                      ? "border-plonkPink bg-plonkPink/10"
                      : dayEvents.length
                        ? "border-cream/15 bg-ink/40 hover:border-cream/40"
                        : "border-cream/5 bg-ink/20"
                  }`}
                >
                  <div className="px-1 text-[11px] font-bold text-cream/70">
                    {day}
                  </div>
                  <div className="mt-1 flex flex-col gap-1">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <span
                        key={keyOfEvent(ev)}
                        className={`truncate rounded border px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide ${TYPE_META[ev.typeGroup].badge}`}
                        title={`${ev.name} — ${ev.count} signed up`}
                      >
                        {ev.count}· {ev.name}
                      </span>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="px-1 text-[9px] text-cream/50">
                        +{dayEvents.length - 3} more
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {calDay && (eventsByDate.get(calDay)?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-widest text-cream/60">
                {formatEventDate(calDay)}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(eventsByDate.get(calDay) ?? []).map((ev) => (
                  <EventCard key={keyOfEvent(ev)} ev={ev} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Entries / Entrants section ── */}
      <div className="h-px bg-cream/10" />

      {/* View toggle — per-sign-up Entries vs deduped Entrants list. */}
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

      {/* Search */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search team, email, captain…"
          className="min-w-[220px] flex-1 rounded-full border border-cream/15 bg-ink/40 px-4 py-1.5 text-xs text-cream placeholder:text-cream/40 focus:border-plonkPink focus:outline-none"
        />
      </div>

      {/* Status pills (Entries view only). */}
      {view === "entries" && (
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["paid", "Confirmed"],
              ["pending_payment", "Pending"],
              ["cancelled", "Cancelled"],
              ["refunded", "Refunded"],
            ] as [
              "all" | "paid" | "pending_payment" | "cancelled" | "refunded",
              string,
            ][]
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
                  <th className="px-4 py-3 text-left">Events</th>
                  <th className="px-4 py-3 text-left">Last played</th>
                </tr>
              </thead>
              <tbody>
                {entrants.map((e) => (
                  <tr
                    key={e.email}
                    className="border-t border-cream/5 hover:bg-cream/5"
                  >
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
                    ["event", "Event"],
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
                        {sortKey === key
                          ? sortDir === "asc"
                            ? "▲"
                            : "▼"
                          : "↕"}
                      </span>
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const ev = eventByKey.get(keyOfRow(e));
                return (
                  <tr
                    key={`${keyOfRow(e)}:${e.id}`}
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
                      <div className="text-cream/90">{ev?.name ?? "—"}</div>
                      <div className="flex items-center gap-1.5 text-xs text-cream/55">
                        {ev && (
                          <span
                            className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${TYPE_META[ev.typeGroup].badge}`}
                          >
                            {TYPE_META[ev.typeGroup].short}
                          </span>
                        )}
                        {ev?.event_date ?? ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-cream/65">
                      {formatDateTime(e.created_at)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {e.status === "paid" ? (
                        <BookingLockedTag name={e.team_name} />
                      ) : (
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${STATUS_COLOR[e.status]}`}
                        >
                          {STATUS_LABEL[e.status]}
                        </span>
                      )}
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
