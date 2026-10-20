"use client";

import { useEffect, useMemo, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import Notice from "@/components/Notice";
import { AdminCard } from "@/components/admin/AdminCard";
import {
  loadLeadOrder,
  saveLeadOrder,
  LEAD_BUCKETS,
  DEFAULT_LEAD_ORDER,
  type LeadBucket,
} from "@/lib/db/leadPriority";

// =============================================================
// Event priority — admin editor
// =============================================================
// Drag (or use the ↑/↓ arrows) to set the order in which event KINDS
// take the day's lead poster on the public /events calendar. The one
// at the top wins a busy night. Happy Hour is pinned dead last and
// can't be moved (founder rule).
// =============================================================

function describe(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  return fallback;
}

const META = Object.fromEntries(
  LEAD_BUCKETS.map((b) => [b.key, b]),
) as Record<LeadBucket, (typeof LEAD_BUCKETS)[number]>;

export default function EventPriorityClient() {
  const [order, setOrder] = useState<LeadBucket[]>(DEFAULT_LEAD_ORDER);
  const [saved, setSaved] = useState<LeadBucket[]>(DEFAULT_LEAD_ORDER);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [dragKey, setDragKey] = useState<LeadBucket | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLeadOrder()
      .then((o) => {
        if (cancelled) return;
        setOrder(o);
        setSaved(o);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(
    () => order.join("|") !== saved.join("|"),
    [order, saved],
  );

  // Move `key` so it lands where `targetKey` currently is.
  function moveTo(key: LeadBucket, targetKey: LeadBucket) {
    if (key === targetKey) return;
    setOk(false);
    setOrder((prev) => {
      const next = prev.filter((k) => k !== key);
      const at = next.indexOf(targetKey);
      next.splice(at, 0, key);
      return next;
    });
  }

  function nudge(key: LeadBucket, dir: -1 | 1) {
    setOk(false);
    setOrder((prev) => {
      const i = prev.indexOf(key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function handleSave() {
    setBusy(true);
    setErr("");
    setOk(false);
    try {
      await saveLeadOrder(order);
      setSaved(order);
      setOk(true);
    } catch (e) {
      setErr(describe(e, "Save failed"));
    } finally {
      setBusy(false);
    }
  }

  function resetToDefault() {
    setOk(false);
    setOrder([...DEFAULT_LEAD_ORDER]);
  }

  return (
    <>
      <AdminPageHeader
        title="Event priority"
        description="When several things are on the same night, the one highest in this list is the poster that leads the day on the /events calendar. Drag to reorder, or use the ↑ / ↓ arrows. Happy Hour always sits last."
      />

      {err && (
        <Notice variant="error" className="mb-6">
          {err}
        </Notice>
      )}
      {ok && !dirty && (
        <Notice variant="success" className="mb-6">
          Saved — the /events calendar now leads with this order.
        </Notice>
      )}

      {loading ? (
        <p className="text-sm text-cream/60">Loading…</p>
      ) : (
        <>
          <ol className="space-y-3">
            {order.map((key, i) => {
              const meta = META[key];
              const isDragging = dragKey === key;
              return (
                <li
                  key={key}
                  draggable
                  onDragStart={(e) => {
                    setDragKey(key);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/lead-bucket", key);
                  }}
                  onDragEnd={() => setDragKey(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = e.dataTransfer.getData(
                      "text/lead-bucket",
                    ) as LeadBucket;
                    if (from) moveTo(from, key);
                    setDragKey(null);
                  }}
                  className={`transition ${isDragging ? "opacity-50" : ""}`}
                >
                  <AdminCard>
                    <div className="flex items-center gap-3 p-4">
                      <span
                        className="cursor-grab select-none rounded p-1 text-cream/40 hover:bg-cream/5 hover:text-cream/85 active:cursor-grabbing"
                        title="Drag to reorder"
                        aria-hidden
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <circle cx="9" cy="6" r="1.4" />
                          <circle cx="15" cy="6" r="1.4" />
                          <circle cx="9" cy="12" r="1.4" />
                          <circle cx="15" cy="12" r="1.4" />
                          <circle cx="9" cy="18" r="1.4" />
                          <circle cx="15" cy="18" r="1.4" />
                        </svg>
                      </span>
                      <span className="w-6 shrink-0 text-center font-display text-lg text-plonkTeal">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-lg leading-tight">
                          {meta.label}
                        </h3>
                        <p className="mt-0.5 text-sm text-cream/60">
                          {meta.description}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => nudge(key, -1)}
                          disabled={i === 0}
                          aria-label={`Move ${meta.label} up`}
                          className="rounded border border-cream/15 px-2 py-0.5 text-xs text-cream/70 hover:bg-cream/5 disabled:opacity-25"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => nudge(key, 1)}
                          disabled={i === order.length - 1}
                          aria-label={`Move ${meta.label} down`}
                          className="rounded border border-cream/15 px-2 py-0.5 text-xs text-cream/70 hover:bg-cream/5 disabled:opacity-25"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  </AdminCard>
                </li>
              );
            })}
          </ol>

          {/* Happy Hour — pinned, always last, not reorderable. */}
          <div className="mt-3">
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-cream/15 bg-ink/30 p-4">
              <span className="w-6 shrink-0 text-center text-cream/40">🔒</span>
              <span className="w-6 shrink-0 text-center font-display text-lg text-cream/40">
                {order.length + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg leading-tight text-cream/70">
                  Happy Hour
                </h3>
                <p className="mt-0.5 text-sm text-cream/45">
                  Always loads last, after every other event and deal. Can't be
                  moved (founder rule).
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || busy}
              className="rounded-full bg-plonkTeal px-5 py-2 text-xs font-bold uppercase tracking-wider text-ink disabled:opacity-30"
            >
              {busy ? "Saving…" : "Save order"}
            </button>
            {dirty && (
              <button
                type="button"
                onClick={() => setOrder(saved)}
                disabled={busy}
                className="rounded-full border border-cream/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cream/70 hover:bg-cream/5 disabled:opacity-30"
              >
                Undo changes
              </button>
            )}
            <button
              type="button"
              onClick={resetToDefault}
              disabled={busy || order.join("|") === DEFAULT_LEAD_ORDER.join("|")}
              className="rounded-full border border-cream/15 px-4 py-2 text-[11px] uppercase tracking-wider text-cream/50 hover:bg-cream/5 disabled:opacity-25"
            >
              Reset to default
            </button>
          </div>
        </>
      )}
    </>
  );
}
