"use client";

import { useEffect, useState } from "react";

// Live No Dice pool league — reads the public `getLeague` action on the shared
// `tournament` edge function (same Supabase project as /ops). No auth: it's a
// read-only public standings feed. Purple-themed to match the pool page.

const FN = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tournament`;

type Row = {
  key: string; name: string; pts: number; frameDiff: number;
  nights: number; wins: number; seconds: number; thirds: number;
  rank: number; qualifies: boolean;
};
type Discipline = "singles" | "doubles";

export default function LeagueTable() {
  const [disc, setDisc] = useState<Discipline>("singles");
  const [data, setData] = useState<{ table: Row[]; nights: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(FN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getLeague", discipline: disc }),
    })
      .then((r) => r.json())
      .then((d) => { if (alive) { setData(d?.table ? d : { table: [], nights: 0 }); setLoading(false); } })
      .catch(() => { if (alive) { setData({ table: [], nights: 0 }); setLoading(false); } });
    return () => { alive = false; };
  }, [disc]);

  const rows = data?.table ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* discipline toggle — clear purple pills */}
      <div className="mb-8 flex justify-center gap-3">
        {(["singles", "doubles"] as Discipline[]).map((d) => {
          const on = disc === d;
          return (
            <button
              key={d}
              onClick={() => setDisc(d)}
              className={`rounded-full px-7 py-3 text-sm font-bold uppercase tracking-widest transition ${
                on
                  ? "bg-violet-500 text-white shadow-lg shadow-violet-500/40 ring-1 ring-violet-300/50"
                  : "bg-white/5 text-violet-100/70 ring-1 ring-violet-300/25 hover:bg-white/10 hover:text-white"
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>

      {/* the table, on a translucent purple card so the hero shows through */}
      <div className="overflow-hidden rounded-3xl border border-violet-400/25 bg-[#160e24]/80 shadow-2xl shadow-violet-950/50 backdrop-blur-md">
        {loading ? (
          <p className="px-6 py-16 text-center text-sm text-violet-100/60">Loading the league…</p>
        ) : rows.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-violet-100/60">
            No finished {disc} nights yet — the table fills in as tournaments are played.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.14em] text-violet-200/55">
                  <th className="py-4 pl-5 pr-3 text-left font-semibold">#</th>
                  <th className="py-4 pr-3 text-left font-semibold">Player</th>
                  <th className="px-2 py-4 text-right font-semibold">Played</th>
                  <th className="px-2 py-4 text-right font-semibold">🥇</th>
                  <th className="px-2 py-4 text-right font-semibold">🥈</th>
                  <th className="px-2 py-4 text-right font-semibold">🥉</th>
                  <th className="px-2 py-4 text-right font-semibold">+/−</th>
                  <th className="px-3 py-4 pr-5 text-right font-semibold">Pts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.key}
                    className={`border-t border-white/5 ${r.qualifies ? "bg-violet-500/10" : ""}`}
                  >
                    <td className={`py-3.5 pl-5 pr-3 text-left font-bold tabular-nums ${r.rank <= 8 ? "text-violet-300" : "text-white/45"}`}>
                      {r.rank}
                      {r.rank <= 8 && <span className="ml-1 text-violet-400">✦</span>}
                    </td>
                    <td className="py-3.5 pr-3 text-left font-semibold text-white">{r.name}</td>
                    <td className="px-2 py-3.5 text-right tabular-nums text-white/55">{r.nights}</td>
                    <td className="px-2 py-3.5 text-right tabular-nums text-white/80">{r.wins || ""}</td>
                    <td className="px-2 py-3.5 text-right tabular-nums text-white/80">{r.seconds || ""}</td>
                    <td className="px-2 py-3.5 text-right tabular-nums text-white/80">{r.thirds || ""}</td>
                    <td className={`px-2 py-3.5 text-right tabular-nums ${r.frameDiff > 0 ? "text-emerald-400" : r.frameDiff < 0 ? "text-rose-400" : "text-white/55"}`}>
                      {r.frameDiff > 0 ? "+" : ""}{r.frameDiff}
                    </td>
                    <td className="px-3 py-3.5 pr-5 text-right text-lg font-extrabold tabular-nums text-violet-300">{r.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* How points work — on its own legible card so it reads over the hero image */}
      <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-violet-400/30 bg-[#160e24]/90 px-5 py-5 shadow-xl shadow-violet-950/40 backdrop-blur-md">
        <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-violet-300">
          🎱 How points work
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {[
            ["🥇", "1st", "+5"],
            ["🥈", "2nd", "+4"],
            ["🥉", "3rd", "+3"],
            ["🙋", "Turn up", "+1"],
            ["📊", "Top the rounds", "+1"],
          ].map(([emoji, label, pts]) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/15 px-3 py-1.5 text-sm text-violet-50"
            >
              <span>{emoji}</span>
              <span className="text-violet-100/85">{label}</span>
              <b className="font-extrabold text-white">{pts}</b>
            </span>
          ))}
        </div>
        <p className="mt-4 text-center text-xs leading-relaxed text-violet-100/80">
          <span className="font-extrabold text-violet-300">✦ Top 8</span> go through to the grand final. Level on points?{" "}
          <b className="text-white">Best season frame difference</b> wins.
          {data && data.nights > 0 ? (
            <>
              {" · "}
              <span className="text-violet-200/70">
                🗓️ {data.nights} night{data.nights === 1 ? "" : "s"} counted so far
              </span>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}
