"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Shared in-app dialog system  (founder, 22 Oct 2026: "that grey browser box
// is jarring — pop ups should be No Dice style, centred on the page").
//
// Replaces the native browser window.confirm() / window.alert() — the grey
// "nodice.bar says…" box — with ONE styled dialog that matches the site: a dark
// card on `ink`, cream text, Bebas Neue (`font-display`) heading, plonkPink CTA.
// Mounted ONCE as <DialogHost /> at the app root (app/layout.tsx), so it covers
// every public page AND the whole admin.
//
// Mirrors the team-hub helper (team.nodice.bar → src/lib/dialog.jsx) so the two
// sites behave identically. Promise-based, so it works from any plain function,
// not just React components:
//   if (await confirmDialog('Delete this?')) { … }   // near drop-in for confirm()
//   await alertDialog('Saved.')                       // replaces alert() → toast
//
// confirmDialog(message, opts?) → Promise<boolean>   true = confirmed
//   opts: { title?, confirmLabel?, cancelLabel?, danger? }
//   `danger` (deeper-red button) is auto-inferred from the wording (delete,
//   remove, clear, discard, reset, …) so call-sites rarely need the flag — pass
//   danger:false / danger:true to override.
//
// The enclosing handler must be `async` (because of `await confirmDialog`).
// alertDialog is a fire-and-forget toast; `await` it when you need the old
// blocking behaviour before a reload/navigation.
// ─────────────────────────────────────────────────────────────────────────────

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

type ConfirmOpts = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type Entry = {
  id: number;
  kind: "confirm" | "alert";
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (value: boolean) => void;
};

// Module-level queue + a single subscriber (the mounted <DialogHost />). Kept
// outside React so the helpers can be called from anywhere, including non-React
// modules, before or without a component on the stack.
let subscriber: ((entries: Entry[]) => void) | null = null;
const queue: Entry[] = [];
let seq = 0;

function push(entry: Omit<Entry, "id">): Entry {
  const full = { ...entry, id: ++seq } as Entry;
  queue.push(full);
  subscriber?.([...queue]);
  return full;
}

function settle(id: number, value: boolean) {
  const i = queue.findIndex((e) => e.id === id);
  if (i === -1) return;
  const [e] = queue.splice(i, 1);
  subscriber?.([...queue]);
  e.resolve(value);
}

// Words that make a confirm destructive → deeper-red button by default.
const DANGER_RE =
  /\b(delete|deletes|remove|removes|removing|discard|clear|clears|wipe|reset|undo|un-?redeem|restart|revert|sign out|sign-out|log out|erase|cancel\b|refund|void|take .* off|hide\b|forget)\b/i;

export function confirmDialog(
  message: string,
  opts: ConfirmOpts = {},
): Promise<boolean> {
  const msg = message == null ? "" : String(message);
  return new Promise<boolean>((resolve) => {
    push({
      kind: "confirm",
      message: msg,
      title: opts.title,
      confirmLabel: opts.confirmLabel,
      cancelLabel: opts.cancelLabel,
      danger: opts.danger != null ? !!opts.danger : DANGER_RE.test(msg),
      resolve,
    });
  });
}

export function alertDialog(
  message: string,
  opts: { title?: string } = {},
): Promise<void> {
  const msg = message == null ? "" : String(message);
  return new Promise<void>((resolve) => {
    push({
      kind: "alert",
      message: msg,
      title: opts.title,
      resolve: () => resolve(),
    });
  });
}

const Z = 2147483000; // above everything in the app

// ── Confirm modal ────────────────────────────────────────────────────────────
function ConfirmModal({
  entry,
  onConfirm,
  onCancel,
}: {
  entry: Entry;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmBtn = useRef<HTMLButtonElement | null>(null);
  const cancelBtn = useRef<HTMLButtonElement | null>(null);
  const danger = entry.danger;

  useEffect(() => {
    const t = setTimeout(() => confirmBtn.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      } else if (e.key === "Tab") {
        // Focus trap between the two buttons.
        e.preventDefault();
        const next =
          document.activeElement === confirmBtn.current
            ? cancelBtn.current
            : confirmBtn.current;
        next?.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onConfirm, onCancel]);

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      className="fixed inset-0 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      style={{ zIndex: Z, animation: "ndDlgFade .12s ease-out" }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={entry.title || "Please confirm"}
        onMouseDown={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl border border-cream/15 bg-ink p-6 text-cream shadow-2xl ${
          danger ? "border-t-4 border-t-red-600" : "border-t-4 border-t-plonkPink"
        }`}
        style={{ animation: "ndDlgPop .14s cubic-bezier(.2,.8,.3,1)" }}
      >
        <div className="mb-2 font-display text-2xl uppercase tracking-wider text-cream">
          {entry.title || (danger ? "Just checking" : "Confirm")}
        </div>
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-cream/70">
          {entry.message}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelBtn}
            type="button"
            onClick={onCancel}
            className="min-h-[44px] rounded-full border border-cream/20 px-5 py-2.5 text-sm font-semibold text-cream/75 transition hover:bg-cream/5"
          >
            {entry.cancelLabel || "Cancel"}
          </button>
          <button
            ref={confirmBtn}
            type="button"
            onClick={onConfirm}
            className={`min-h-[44px] rounded-full px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-white transition ${
              danger
                ? "bg-red-700 hover:bg-red-600"
                : "bg-plonkPink hover:bg-plonkPink/90"
            }`}
          >
            {entry.confirmLabel || "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Toast (replaces alert) ─────────────────────────────────────────────────────
function Toast({ entry, onDone }: { entry: Entry; onDone: () => void }) {
  useEffect(() => {
    const len = (entry.title ? entry.title.length : 0) + entry.message.length;
    const ms = Math.min(10000, Math.max(4000, len * 55));
    const t = setTimeout(onDone, ms);
    return () => clearTimeout(t);
  }, [entry, onDone]);

  return (
    <div
      role="status"
      onClick={onDone}
      className="max-w-sm cursor-pointer rounded-xl border border-cream/15 border-l-4 border-l-plonkPink bg-ink px-4 py-3 text-sm leading-relaxed text-cream shadow-2xl"
      style={{ pointerEvents: "auto", animation: "ndDlgSlide .16s ease-out" }}
    >
      {entry.title && (
        <div className="mb-0.5 font-display text-base uppercase tracking-wide text-cream">
          {entry.title}
        </div>
      )}
      <div className={entry.title ? "text-cream/70" : "text-cream"}>
        {entry.message}
      </div>
    </div>
  );
}

// ── Host — mount ONCE at the app root ──────────────────────────────────────────
export function DialogHost() {
  const [entries, setEntries] = useState<Entry[]>([]);
  // Gate the portal behind a post-mount flag so the server render and the
  // first client (hydration) render both produce nothing — otherwise the
  // portal into document.body wouldn't match the SSR HTML and React throws a
  // hydration mismatch. The dialogs only ever appear after a user action, so
  // rendering nothing until mounted costs us nothing.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    subscriber = setEntries;
    setEntries([...queue]);
    return () => {
      if (subscriber === setEntries) subscriber = null;
    };
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  // One confirm at a time (blocking by nature); toasts stack.
  const confirmEntry = entries.find((e) => e.kind === "confirm");
  const toasts = entries.filter((e) => e.kind === "alert");

  const toastWrap: CSSProperties = {
    position: "fixed",
    top: "max(16px, env(safe-area-inset-top))",
    right: 16,
    zIndex: Z + 1,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    pointerEvents: "none",
    maxWidth: "calc(100vw - 32px)",
  };

  return createPortal(
    <>
      {toasts.length > 0 && (
        <div style={toastWrap}>
          {toasts.map((t) => (
            <Toast key={t.id} entry={t} onDone={() => settle(t.id, true)} />
          ))}
        </div>
      )}
      {confirmEntry && (
        <ConfirmModal
          key={confirmEntry.id}
          entry={confirmEntry}
          onConfirm={() => settle(confirmEntry.id, true)}
          onCancel={() => settle(confirmEntry.id, false)}
        />
      )}
    </>,
    document.body,
  );
}
