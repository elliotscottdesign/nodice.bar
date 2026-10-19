"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { COLUMNS, ballLabel } from "@/lib/bingo/live";

// =============================================================
// /bingo-live — public big-screen caller board
// =============================================================
// The display the room watches: the last ball called (huge) + the full 1–75
// board with called numbers lit. Reads the single shared `bingo_live` row and
// polls every 2s (same slow-poll idea as the tournament live board — a bingo
// call is seconds apart, no realtime subscription needed). The caller drives it
// from the team hub (team.nodice.bar → Ops → Events → Bingo → Live caller).
// =============================================================

const PINK = "#e878f0";

export default function BingoLivePage() {
  const [called, setCalled] = useState<number[]>([]);
  const [last, setLast] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const prevLast = useRef<number | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const { data, error } = await supabase()
          .from("bingo_live")
          .select("called, last_number")
          .eq("id", "live")
          .maybeSingle();
        if (cancelled || error || !data) return;
        setConnected(true);
        setCalled((data.called as number[]) ?? []);
        const ln = (data.last_number as number | null) ?? null;
        setLast(ln);
        if (ln != null && ln !== prevLast.current) {
          prevLast.current = ln;
          setFlash(true);
          setTimeout(() => setFlash(false), 600);
        }
      } catch {
        /* keep last state on a blip */
      }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const calledSet = new Set(called);

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-cream sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <div
              className="font-display text-3xl uppercase leading-none tracking-wider sm:text-5xl"
              style={{ color: PINK }}
            >
              No Dice Bingo
            </div>
            <div className="mt-1 text-xs font-bold uppercase tracking-[0.35em] text-cream/55">
              Comedy &amp; Bingo
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-cream/55">
              Balls called
            </div>
            <div className="font-display text-4xl sm:text-5xl" style={{ color: PINK }}>
              {called.length}
              <span className="text-cream/40">/75</span>
            </div>
          </div>
        </div>

        {/* Last ball — huge */}
        <div className="my-6 flex flex-col items-center justify-center sm:my-10">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-cream/55">
            Last called
          </div>
          <div
            className="mt-3 flex items-center justify-center rounded-full font-display leading-none transition-transform"
            style={{
              width: "min(44vw, 300px)",
              height: "min(44vw, 300px)",
              border: `6px solid ${PINK}`,
              background: flash ? PINK : "transparent",
              color: flash ? "#000" : PINK,
              fontSize: "min(20vw, 140px)",
              transform: flash ? "scale(1.04)" : "scale(1)",
            }}
          >
            {last != null ? ballLabel(last) : "–"}
          </div>
          {!connected && (
            <div className="mt-4 text-sm text-cream/40">Waiting for the caller…</div>
          )}
        </div>

        {/* Full board 1–75, grouped by column */}
        <div className="space-y-2">
          {COLUMNS.map((col) => {
            const nums: number[] = [];
            for (let n = col.lo; n <= col.hi; n++) nums.push(n);
            return (
              <div key={col.letter} className="flex items-center gap-2 sm:gap-3">
                <div
                  className="flex w-9 shrink-0 justify-center font-display text-2xl sm:w-14 sm:text-4xl"
                  style={{ color: PINK }}
                >
                  {col.letter}
                </div>
                <div
                  className="flex-1 gap-1 sm:gap-2"
                  style={{ display: "grid", gridTemplateColumns: "repeat(15, minmax(0, 1fr))" }}
                >
                  {nums.map((n) => {
                    const on = calledSet.has(n);
                    return (
                      <div
                        key={n}
                        className="flex aspect-square items-center justify-center rounded-md text-xs font-bold tabular-nums sm:text-xl"
                        style={{
                          background: on ? PINK : "rgba(255,255,255,0.05)",
                          color: on ? "#000" : "rgba(242,235,217,0.35)",
                          border: on ? `1px solid ${PINK}` : "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        {n}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
