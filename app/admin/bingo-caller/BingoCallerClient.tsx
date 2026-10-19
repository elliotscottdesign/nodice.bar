"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import { supabase } from "@/lib/supabase";
import { COLUMNS, ballLabel } from "@/lib/bingo/live";

const PINK = "#e878f0";

export default function BingoCallerClient() {
  const [called, setCalled] = useState<number[]>([]);
  const [last, setLast] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [typed, setTyped] = useState("");
  const saveSeq = useRef(0);

  // Load current shared game state once.
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase()
          .from("bingo_live")
          .select("called, last_number")
          .eq("id", "live")
          .maybeSingle();
        if (data) {
          setCalled((data.called as number[]) ?? []);
          setLast((data.last_number as number | null) ?? null);
        }
      } catch {
        /* start empty */
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Persist the whole game state (last-write-wins; a single caller drives it).
  const persist = useCallback(async (next: number[], lastNum: number | null) => {
    const seq = ++saveSeq.current;
    setSaving(true);
    setErr("");
    try {
      const { error } = await supabase()
        .from("bingo_live")
        .update({ called: next, last_number: lastNum, updated_at: new Date().toISOString() })
        .eq("id", "live");
      if (error) throw error;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save — check your connection.");
    } finally {
      if (seq === saveSeq.current) setSaving(false);
    }
  }, []);

  const toggle = useCallback(
    (n: number) => {
      setCalled((prev) => {
        const has = prev.includes(n);
        const next = has ? prev.filter((x) => x !== n) : [...prev, n];
        const lastNum = has ? (next.length ? next[next.length - 1] : null) : n;
        setLast(lastNum);
        persist(next, lastNum);
        return next;
      });
    },
    [persist],
  );

  const callTyped = () => {
    const n = parseInt(typed, 10);
    if (!Number.isFinite(n) || n < 1 || n > 75) {
      setErr("Enter a number 1–75.");
      return;
    }
    setTyped("");
    if (!called.includes(n)) toggle(n);
    else {
      setLast(n);
      persist(called, n);
    }
  };

  const drawRandom = () => {
    const remaining: number[] = [];
    for (let n = 1; n <= 75; n++) if (!called.includes(n)) remaining.push(n);
    if (!remaining.length) return;
    toggle(remaining[Math.floor(Math.random() * remaining.length)]);
  };

  const reset = () => {
    if (!window.confirm("Clear the board and start a new game?")) return;
    setCalled([]);
    setLast(null);
    persist([], null);
  };

  const calledSet = new Set(called);

  return (
    <div className="space-y-6">
      <AdminCard>
        <div className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-cream/55">
                Last called
              </div>
              <div className="font-display text-5xl" style={{ color: PINK }}>
                {last != null ? ballLabel(last) : "–"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-cream/55">
                Called
              </div>
              <div className="font-display text-3xl text-cream">
                {called.length}
                <span className="text-cream/40">/75</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              max={75}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && callTyped()}
              placeholder="No."
              className="w-20 rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-base text-cream focus:border-[#e878f0] focus:outline-none"
            />
            <button
              type="button"
              onClick={callTyped}
              className="rounded-full bg-[#e878f0] px-5 py-2 text-xs font-bold uppercase tracking-widest text-ink hover:bg-[#e878f0]/90"
            >
              Call
            </button>
            <button
              type="button"
              onClick={drawRandom}
              className="rounded-full border border-[#e878f0]/50 bg-[#e878f0]/10 px-5 py-2 text-xs font-bold uppercase tracking-widest text-[#e878f0] hover:bg-[#e878f0]/20"
            >
              Draw random
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-cream/20 px-5 py-2 text-xs font-bold uppercase tracking-widest text-cream/70 hover:bg-cream/5"
            >
              New game
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-cream/10 px-5 py-2 text-xs text-cream/45">
          <span>Tap a number to mark it called; tap again to undo.</span>
          <span>{saving ? "Saving…" : err ? <span className="text-plonkPink">{err}</span> : "Saved ✓"}</span>
        </div>
      </AdminCard>

      {loaded &&
        COLUMNS.map((col) => {
          const nums: number[] = [];
          for (let n = col.lo; n <= col.hi; n++) nums.push(n);
          return (
            <div key={col.letter} className="flex items-center gap-3">
              <div className="flex w-8 shrink-0 justify-center font-display text-2xl" style={{ color: PINK }}>
                {col.letter}
              </div>
              <div
                className="flex-1 gap-1.5"
                style={{ display: "grid", gridTemplateColumns: "repeat(15, minmax(0, 1fr))" }}
              >
                {nums.map((n) => {
                  const on = calledSet.has(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => toggle(n)}
                      className="flex aspect-square items-center justify-center rounded-md text-sm font-bold tabular-nums transition"
                      style={{
                        background: on ? PINK : "rgba(255,255,255,0.05)",
                        color: on ? "#000" : "rgba(242,235,217,0.6)",
                        border: on ? `1px solid ${PINK}` : "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
    </div>
  );
}
