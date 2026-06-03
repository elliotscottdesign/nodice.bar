"use client";

// =============================================================
// Plonk Golf admin — block editor for HTML body fields
// =============================================================
// Replaces the raw HTML textarea with a structured, draggable list
// of blocks (Heading, Sub-heading, Paragraph, Image, Raw HTML).
// Editors get one input per block, can re-order with drag handles
// or move-up/-down buttons, and add/remove blocks via toolbars.
//
// Storage is unchanged: we still hand back an HTML string via
// onChange so the existing rendering on the public pages keeps
// working. Headings, paragraphs and <img> tags are recognised on
// load; anything else lands in a Raw HTML block so we never lose
// content the editor doesn't understand.
// =============================================================

import { useEffect, useRef, useState } from "react";
import MediaPicker from "@/components/admin/MediaPicker";

type BlockKind = "h2" | "h3" | "p" | "img" | "raw";

type Block = {
  // Stable client-side id so React keeps inputs focused as blocks
  // are reordered or inserted.
  id: string;
  kind: BlockKind;
  // For h2/h3/p: the text content.
  // For img: the src URL.
  // For raw: the raw HTML snippet.
  value: string;
  // Optional alt text for image blocks.
  alt?: string;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ---------- parse HTML string -> Block[] ----------
function parseHtml(html: string): Block[] {
  if (!html.trim()) return [];
  if (typeof window === "undefined") return [];

  const container = document.createElement("div");
  container.innerHTML = html;

  const blocks: Block[] = [];
  // Walk the top-level children. Anything we don't recognise becomes
  // a "raw" block so we round-trip content without dropping it.
  for (const node of Array.from(container.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? "").trim();
      if (text) blocks.push({ id: uid(), kind: "p", value: text });
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === "h2" || tag === "h3") {
      blocks.push({ id: uid(), kind: tag as BlockKind, value: el.textContent ?? "" });
      continue;
    }
    if (tag === "p") {
      // Preserve inline HTML inside paragraphs (links, em, strong).
      blocks.push({ id: uid(), kind: "p", value: el.innerHTML });
      continue;
    }
    if (tag === "img") {
      const img = el as HTMLImageElement;
      blocks.push({
        id: uid(),
        kind: "img",
        value: img.getAttribute("src") ?? "",
        alt: img.getAttribute("alt") ?? "",
      });
      continue;
    }
    blocks.push({ id: uid(), kind: "raw", value: el.outerHTML });
  }
  return blocks;
}

// ---------- serialise Block[] -> HTML string ----------
function serialiseBlocks(blocks: Block[]): string {
  return blocks
    .map((b) => {
      if (b.kind === "h2") return `<h2>${b.value}</h2>`;
      if (b.kind === "h3") return `<h3>${b.value}</h3>`;
      if (b.kind === "p") return `<p>${b.value}</p>`;
      if (b.kind === "img") {
        const alt = (b.alt ?? "").replace(/"/g, "&quot;");
        return `<img src="${b.value}" alt="${alt}" />`;
      }
      return b.value; // raw HTML
    })
    .join("\n");
}

// ---------- friendly labels for the toolbar / block header ----------
const BLOCK_LABELS: Record<BlockKind, string> = {
  h2: "Heading",
  h3: "Sub-heading",
  p: "Paragraph",
  img: "Image",
  raw: "Raw HTML",
};

export default function BlockEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [hydrated, setHydrated] = useState(false);
  // Ref to remember the HTML we last *output* so we know to ignore
  // an incoming `value` that is just the echo of our own save.
  const lastOutgoing = useRef<string>("");

  // Hydrate from the incoming HTML on mount (and whenever the parent
  // pushes a value that didn't originate from us — e.g. after a
  // server-side reload).
  useEffect(() => {
    if (!hydrated || value !== lastOutgoing.current) {
      setBlocks(parseHtml(value));
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Push HTML back up whenever blocks change (skip the very first
  // hydration tick — no point re-emitting what we just parsed).
  const dirty = useRef(false);
  useEffect(() => {
    if (!hydrated) return;
    if (!dirty.current) return;
    const html = serialiseBlocks(blocks);
    lastOutgoing.current = html;
    onChange(html);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  function update(id: string, patch: Partial<Block>) {
    dirty.current = true;
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }
  function remove(id: string) {
    dirty.current = true;
    setBlocks((bs) => bs.filter((b) => b.id !== id));
  }
  function add(kind: BlockKind, after?: number) {
    dirty.current = true;
    const block: Block = { id: uid(), kind, value: "", alt: kind === "img" ? "" : undefined };
    setBlocks((bs) => {
      if (after === undefined) return [...bs, block];
      const copy = bs.slice();
      copy.splice(after + 1, 0, block);
      return copy;
    });
  }
  function move(id: string, dir: -1 | 1) {
    dirty.current = true;
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      if (i < 0) return bs;
      const j = i + dir;
      if (j < 0 || j >= bs.length) return bs;
      const copy = bs.slice();
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }
  function reorder(fromId: string, toId: string) {
    if (fromId === toId) return;
    dirty.current = true;
    setBlocks((bs) => {
      const from = bs.findIndex((b) => b.id === fromId);
      const to = bs.findIndex((b) => b.id === toId);
      if (from < 0 || to < 0) return bs;
      const copy = bs.slice();
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  }

  return (
    <div className="space-y-3">
      {blocks.length === 0 && (
        <p className="rounded-lg border border-cream/10 bg-ink/30 px-4 py-3 text-xs text-cream/55">
          No blocks yet. Use the buttons below to add a heading, paragraph or
          image.
        </p>
      )}
      {blocks.map((b, i) => (
        <BlockCard
          key={b.id}
          block={b}
          index={i}
          isFirst={i === 0}
          isLast={i === blocks.length - 1}
          onUpdate={(patch) => update(b.id, patch)}
          onRemove={() => remove(b.id)}
          onMoveUp={() => move(b.id, -1)}
          onMoveDown={() => move(b.id, 1)}
          onChangeKind={(kind) => update(b.id, { kind })}
          onReorderDrop={(otherId) => reorder(otherId, b.id)}
          onAddBelow={(kind) => add(kind, i)}
        />
      ))}

      <AddBlockToolbar onAdd={(kind) => add(kind)} />
    </div>
  );
}

// ---------- one block ----------
function BlockCard({
  block,
  index,
  isFirst,
  isLast,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onChangeKind,
  onReorderDrop,
  onAddBelow,
}: {
  block: Block;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (patch: Partial<Block>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChangeKind: (kind: BlockKind) => void;
  onReorderDrop: (otherId: string) => void;
  onAddBelow: (kind: BlockKind) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div
      className={`rounded-xl border bg-ink/40 transition ${
        dragOver
          ? "border-plonkPink shadow-[0_0_0_2px_rgba(255,61,138,0.25)]"
          : "border-cream/10"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const otherId = e.dataTransfer.getData("text/block-id");
        if (otherId) onReorderDrop(otherId);
      }}
    >
      {/* Header: drag handle, kind label, kind dropdown, controls */}
      <div className="flex items-center justify-between gap-2 border-b border-cream/5 px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Drag to reorder"
            draggable
            onDragStart={(e) =>
              e.dataTransfer.setData("text/block-id", block.id)
            }
            className="cursor-grab rounded p-1 text-cream/40 hover:bg-cream/5 hover:text-cream/85 active:cursor-grabbing"
            aria-label="Drag handle"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="6" r="1.4" />
              <circle cx="15" cy="6" r="1.4" />
              <circle cx="9" cy="12" r="1.4" />
              <circle cx="15" cy="12" r="1.4" />
              <circle cx="9" cy="18" r="1.4" />
              <circle cx="15" cy="18" r="1.4" />
            </svg>
          </button>
          <span className="text-[10px] font-bold uppercase tracking-widest text-cream/55">
            {index + 1}.
          </span>
          <select
            value={block.kind}
            onChange={(e) => onChangeKind(e.target.value as BlockKind)}
            className="rounded border border-cream/15 bg-ink/40 px-2 py-1 text-[11px] uppercase tracking-wider text-cream/85 focus:border-plonkPink focus:outline-none"
          >
            <option value="h2">Heading</option>
            <option value="h3">Sub-heading</option>
            <option value="p">Paragraph</option>
            <option value="img">Image</option>
            <option value="raw">Raw HTML</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            title="Move up"
            className="rounded p-1 text-cream/55 hover:bg-cream/5 hover:text-cream disabled:opacity-30"
            aria-label="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            title="Move down"
            className="rounded p-1 text-cream/55 hover:bg-cream/5 hover:text-cream disabled:opacity-30"
            aria-label="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            title="Delete block"
            className="rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-red-300 hover:bg-red-400/10"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Body input depends on kind */}
      <div className="space-y-2 px-3 py-3">
        {block.kind === "h2" || block.kind === "h3" ? (
          <input
            type="text"
            value={block.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder={
              block.kind === "h2" ? "Section heading" : "Sub-heading"
            }
            className={`w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 leading-tight text-cream placeholder:text-cream/30 focus:border-plonkPink focus:outline-none ${
              block.kind === "h2"
                ? "font-display text-3xl sm:text-4xl"
                : "font-display text-xl sm:text-2xl"
            }`}
          />
        ) : block.kind === "p" ? (
          <textarea
            value={block.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder="Paragraph text. Basic inline HTML allowed (links, em, strong)."
            rows={3}
            className="w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-base leading-relaxed text-cream placeholder:text-cream/30 focus:border-plonkPink focus:outline-none"
          />
        ) : block.kind === "img" ? (
          <div className="space-y-2">
            {block.value && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={block.value}
                alt=""
                className="aspect-[3/2] w-full max-w-sm rounded-lg border border-cream/10 object-cover"
              />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="url"
                value={block.value}
                onChange={(e) => onUpdate({ value: e.target.value })}
                placeholder="Image URL or pick from library"
                className="min-w-[200px] flex-1 rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-xs text-cream/85 placeholder:text-cream/30 focus:border-plonkPink focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="rounded-full border border-cream/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cream hover:bg-cream/5"
              >
                Pick from library
              </button>
            </div>
            <input
              type="text"
              value={block.alt ?? ""}
              onChange={(e) => onUpdate({ alt: e.target.value })}
              placeholder="Alt text (describe the image for screen readers)"
              className="w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-xs text-cream/85 placeholder:text-cream/30 focus:border-plonkPink focus:outline-none"
            />
            {pickerOpen && (
              <MediaPicker
                onPick={(picked) => {
                  // MediaPicker now returns either a plain path or
                  // the full positioned ImageDisplay record. Block
                  // images store just the URL — extract .src when we
                  // get the structured form.
                  const path =
                    typeof picked === "string" ? picked : picked.src;
                  onUpdate({ value: path });
                  setPickerOpen(false);
                }}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>
        ) : (
          <textarea
            value={block.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder="Raw HTML"
            rows={4}
            className="w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 font-mono text-xs leading-relaxed text-cream placeholder:text-cream/30 focus:border-plonkPink focus:outline-none"
          />
        )}
      </div>

      {/* Inline add-below toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-t border-cream/5 px-3 py-2">
        <span className="text-[10px] uppercase tracking-widest text-cream/40">
          Add below:
        </span>
        {(["h2", "h3", "p", "img"] as BlockKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onAddBelow(k)}
            className="rounded-full border border-cream/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-cream/75 hover:bg-cream/5"
          >
            + {BLOCK_LABELS[k]}
          </button>
        ))}
      </div>
    </div>
  );
}

function AddBlockToolbar({ onAdd }: { onAdd: (kind: BlockKind) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-cream/15 px-4 py-3">
      <span className="text-[10px] uppercase tracking-widest text-cream/55">
        Add block:
      </span>
      {(["h2", "h3", "p", "img"] as BlockKind[]).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onAdd(k)}
          className="rounded-full border border-cream/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-cream hover:bg-cream/5"
        >
          + {BLOCK_LABELS[k]}
        </button>
      ))}
    </div>
  );
}
