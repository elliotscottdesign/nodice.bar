"use client";

// =============================================================
// Plonk Golf admin — live preview pane
// =============================================================
// Renders the matching public page inside an iframe and forwards
// the current draft values to it via postMessage so the editor
// sees its changes as it types — no save required to preview.
//
// Co-operates with ContentProvider in lib/content.tsx, which
// listens for `{ type: 'plonk:preview', drafts: {...} }` messages
// and overlays drafts on top of the saved values.
//
// Layout: fixed side panel that slides in from the right on
// desktop; on phones/tablets it stacks under the form when the
// editor turns it on.
// =============================================================

import { useEffect, useRef, useState } from "react";

export type LivePreviewProps = {
  // Path on the public site to load (e.g. "/venue/hackney").
  path: string;
  // Current draft values keyed by content key — pushed to the iframe
  // every time they change.
  drafts: Record<string, string>;
};

export default function LivePreview({ path, drafts }: LivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  // Once the iframe announces it's ready, flag so we can start
  // forwarding drafts.
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (ev.origin !== window.location.origin) return;
      if (ev.data?.type === "plonk:preview-ready") setReady(true);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Push current drafts to the iframe on every change.
  useEffect(() => {
    if (!ready) return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage(
        { type: "plonk:preview", drafts },
        window.location.origin,
      );
    } catch {
      /* ignore */
    }
  }, [drafts, ready]);

  const src = `${path}${path.includes("?") ? "&" : "?"}preview=1`;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed right-3 top-24 z-40 rounded-full border border-cream/20 bg-ink/95 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-cream shadow-2xl backdrop-blur hover:bg-ink"
      >
        Show preview →
      </button>
    );
  }

  return (
    <aside
      className="fixed right-0 top-0 z-40 hidden h-screen w-[48vw] max-w-[720px] flex-col border-l border-cream/10 bg-ink shadow-2xl md:flex"
      aria-label="Live preview"
    >
      <div className="flex items-center justify-between border-b border-cream/10 px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-plonkYellow">
            Live preview
          </p>
          <p className="truncate text-xs text-cream/55">{path}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={path}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
            title="Open in a new tab"
          >
            Open ↗
          </a>
          <button
            type="button"
            onClick={() => {
              const f = iframeRef.current;
              if (!f) return;
              setReady(false);
              f.src = f.src;
            }}
            className="rounded-full border border-cream/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
            title="Reload preview"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="rounded-full border border-cream/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
            title="Hide preview"
          >
            Hide
          </button>
        </div>
      </div>
      <iframe
        ref={iframeRef}
        src={src}
        title={`Preview of ${path}`}
        className="flex-1 w-full border-0 bg-ink"
      />
    </aside>
  );
}
