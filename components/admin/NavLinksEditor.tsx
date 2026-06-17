"use client";

import { useEffect, useMemo, useState } from "react";
import { loadAllContent, saveContentValue } from "@/lib/db/content";

// =============================================================
// NavLinksEditor — purpose-built header nav editor
// =============================================================
// Backs the same `header.nav` content key that Header.tsx parses,
// but exposes one row per link with separate Label / URL inputs,
// up/down reorder buttons, and add/delete affordances — so the
// founder doesn't have to hand-format "Label | URL" lines in a
// raw textarea.
//
// On save, rows are re-serialised back to the original
// newline-separated "Label | URL" shape that Header.tsx already
// knows how to parse. Empty rows are dropped silently.
//
// Pre-fills with the in-code fallback if no DB row exists, so the
// admin sees the current live nav the first time they open the
// editor rather than an empty list.
// =============================================================

const FALLBACK_NAV: NavRow[] = [
  { label: "Bar", href: "/bar" },
  { label: "Pool", href: "/pool" },
  { label: "World Cup", href: "/worldcup" },
  { label: "Deals", href: "/deals" },
  { label: "DJs & Events", href: "/events" },
  { label: "Mini Golf", href: "/minigolf" },
  { label: "Parties", href: "/privatehire" },
  { label: "Contact", href: "/contact" },
];

type NavRow = { label: string; href: string };

function parseSerialised(s: string): NavRow[] {
  return s
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf("|");
      if (idx < 0) return null;
      const label = line.slice(0, idx).trim();
      const href = line.slice(idx + 1).trim();
      if (!label || !href) return null;
      return { label, href };
    })
    .filter((x): x is NavRow => x !== null);
}

function serialise(rows: NavRow[]): string {
  return rows
    .filter((r) => r.label.trim() && r.href.trim())
    .map((r) => `${r.label.trim()} | ${r.href.trim()}`)
    .join("\n");
}

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

export default function NavLinksEditor() {
  const [rows, setRows] = useState<NavRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadAllContent()
      .then((all) => {
        if (cancelled) return;
        const navRow = all.find((r) => r.key === "header.nav");
        if (navRow?.value) {
          setRows(parseSerialised(navRow.value));
        } else {
          // No DB row yet — fall back to the in-code default so the
          // editor pre-populates with what the customer is currently
          // seeing. Saving any change will create the row.
          setRows([...FALLBACK_NAV]);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setRows([...FALLBACK_NAV]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function patchRow(i: number, patch: Partial<NavRow>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
    setSaved(false);
  }

  function addRow() {
    setRows((r) => [...r, { label: "", href: "" }]);
    setSaved(false);
  }

  function deleteRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
    setSaved(false);
  }

  function moveRow(i: number, dir: -1 | 1) {
    const j = i + dir;
    setRows((r) => {
      if (j < 0 || j >= r.length) return r;
      const next = [...r];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setErr("");
    try {
      const cleaned = rows.filter((r) => r.label.trim() && r.href.trim());
      await saveContentValue("header.nav", serialise(cleaned), "textarea");
      setRows(cleaned);
      setSaved(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  // Preview = the cleaned list. Empty rows hidden so the founder
  // sees exactly what customers will see after saving.
  const preview = useMemo(
    () => rows.filter((r) => r.label.trim() && r.href.trim()),
    [rows],
  );

  if (loading) {
    return (
      <section className="rounded-2xl border border-cream/10 bg-ink/40 p-6 text-sm text-cream/55">
        Loading nav links…
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-cream/10 bg-ink/40 p-6 text-cream">
      {/* ----- Header ----- */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl uppercase tracking-wider">
            Top nav links
          </h2>
          <p className="mt-1 max-w-prose text-sm text-cream/65">
            The links across the top of every public page. Use a path
            like <code className="text-plonkTeal">/pool</code> for
            internal pages, or a full URL like{" "}
            <code className="text-plonkTeal">https://instagram.com/…</code>{" "}
            for external links (those open in a new tab).
          </p>
        </div>
      </div>

      {/* ----- Rows ----- */}
      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="rounded-lg border border-dashed border-cream/15 bg-ink/20 px-4 py-6 text-center text-sm text-cream/55">
            No nav links yet. Click <span className="text-plonkPink">+ Add link</span>{" "}
            to add one.
          </p>
        )}

        {rows.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2 rounded-lg border border-cream/10 bg-ink/30 p-2"
          >
            {/* Reorder controls */}
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => moveRow(i, -1)}
                disabled={i === 0}
                aria-label="Move up"
                className="rounded-md px-2 py-0.5 text-cream/70 hover:bg-cream/5 disabled:opacity-25"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveRow(i, 1)}
                disabled={i === rows.length - 1}
                aria-label="Move down"
                className="rounded-md px-2 py-0.5 text-cream/70 hover:bg-cream/5 disabled:opacity-25"
              >
                ↓
              </button>
            </div>

            {/* Label input */}
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-cream/50">
                Label
              </label>
              <input
                type="text"
                value={row.label}
                onChange={(e) => patchRow(i, { label: e.target.value })}
                placeholder="e.g. Bar"
                className="w-full rounded-md border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
              />
            </div>

            {/* URL input */}
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-cream/50">
                URL
                {row.href && isExternal(row.href) && (
                  <span className="ml-2 rounded-full bg-plonkTeal/15 px-1.5 py-0.5 text-[9px] tracking-wider text-plonkTeal">
                    EXTERNAL
                  </span>
                )}
              </label>
              <input
                type="text"
                value={row.href}
                onChange={(e) => patchRow(i, { href: e.target.value })}
                placeholder="/bar or https://…"
                className="w-full rounded-md border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
              />
            </div>

            {/* Delete */}
            <button
              type="button"
              onClick={() => deleteRow(i)}
              aria-label={`Delete ${row.label || "link"}`}
              className="self-end rounded-md border border-plonkPink/30 px-3 py-2 text-sm text-plonkPink/85 transition hover:border-plonkPink hover:bg-plonkPink/10"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* ----- Add / save buttons ----- */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className="rounded-full border border-cream/20 px-4 py-2 text-xs font-bold uppercase tracking-widest text-cream/85 transition hover:border-cream/45"
        >
          + Add link
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-plonkPink px-5 py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-plonkPink/90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {saved && (
          <span className="text-xs font-bold uppercase tracking-widest text-plonkTeal">
            ✓ Saved — refresh the public site to see it
          </span>
        )}
        {err && <span className="text-xs text-plonkPink">{err}</span>}
      </div>

      {/* ----- Live preview ----- */}
      <div className="mt-6 rounded-lg border border-cream/10 bg-black px-4 py-4">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-cream/50">
          Live preview
        </div>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {preview.map((r, i) => (
            <span
              key={`${r.href}-${i}`}
              className="text-[13px] font-semibold uppercase tracking-wider text-cream/85"
            >
              {r.label}
              {isExternal(r.href) && (
                <span className="ml-1 text-cream/45">↗</span>
              )}
            </span>
          ))}
          {preview.length === 0 && (
            <span className="text-xs text-cream/40">
              (Nothing to show — add at least one link.)
            </span>
          )}
        </nav>
      </div>
    </section>
  );
}
