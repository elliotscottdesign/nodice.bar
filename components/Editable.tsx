"use client";

// =============================================================
// Plonk Golf — in-place content editor
// =============================================================
// Wraps a piece of content on the public site so that, when an
// admin toggles Edit mode on (via AdminBar), the element becomes
// directly editable: hover outline, click to type, click-away to
// save straight to Supabase.
//
// Usage:
//   const title = useContent("venue.hackney.title", "Default");
//   <h2><Editable k="venue.hackney.title">{title}</Editable></h2>
//
// For images:
//   <EditableImage k="venue.hackney.body_image" value={bodyImage}>
//     {(src) => <Image src={src} ... />}
//   </EditableImage>
// =============================================================

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditMode } from "@/lib/editMode";
import {
  useApplyContentEdit,
  useContent,
  useImageDisplay,
  serialiseImageValue,
  parseImageValue,
  type ImageDisplay,
} from "@/lib/content";
import { saveContentValue } from "@/lib/db/content";

export function Editable({
  k,
  multiline,
  children,
}: {
  k: string;
  // Multi-line fields use contenteditable in block mode so newlines
  // work; short text uses single-line where Enter blurs / saves.
  multiline?: boolean;
  children: React.ReactNode;
}) {
  const editing = useEditMode();
  const applyEdit = useApplyContentEdit();
  const ref = useRef<HTMLSpanElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Initial text captured the first time we go editable — used to
  // diff and decide whether to bother saving on blur.
  const initialRef = useRef<string>("");

  // When children change from outside (a save reload, or another
  // admin tab pushed an update), make sure the contenteditable text
  // matches. Skip while the user is actively focused on the field
  // so we don't yank their cursor mid-typing.
  useEffect(() => {
    if (!ref.current) return;
    if (document.activeElement === ref.current) return;
    const incoming = renderChildrenToText(children);
    if (ref.current.innerText !== incoming) {
      ref.current.innerText = incoming;
    }
  }, [children]);

  if (!editing) {
    return <>{children}</>;
  }

  async function commit() {
    const next = (ref.current?.innerText ?? "").trim();
    if (next === initialRef.current.trim()) return;
    setSaving(true);
    try {
      // saveContentValue is upsert-shaped: it inserts a row with
      // sensible defaults if no migration has pre-seeded this key.
      // That stops the silent-no-op behaviour where update().eq()
      // would match 0 rows and lose the user's edit forever.
      await saveContentValue(k, next, multiline ? "textarea" : "text");
      // Patch the in-memory content map so the page re-renders with
      // the new value immediately, without waiting for a reload.
      applyEdit(k, next);
      // Fallback safety net: ask ContentProvider to refetch from
      // Supabase so we converge on the source of truth even if the
      // optimistic patch missed something.
      try {
        window.dispatchEvent(new CustomEvent("plonk:content-changed"));
      } catch {
        /* ignore */
      }
      setSaved(true);
      // Notify parent admin (if we're inside the preview iframe)
      // so it can update its drafts map without a full reload.
      try {
        if (window.parent !== window) {
          window.parent.postMessage(
            { type: "plonk:edited", key: k, value: next },
            window.location.origin,
          );
        }
      } catch {
        /* ignore */
      }
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to save", k, e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-editable={k}
      onFocus={() => {
        initialRef.current = ref.current?.innerText ?? "";
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (!multiline && e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
        if (e.key === "Escape") {
          if (ref.current) ref.current.innerText = initialRef.current;
          (e.target as HTMLElement).blur();
        }
      }}
      className={`relative cursor-text rounded outline outline-1 outline-dashed outline-transparent transition hover:outline-plonkYellow/60 focus:outline-plonkYellow focus:bg-plonkYellow/5 ${
        saved ? "outline-plonkTeal" : ""
      } ${saving ? "opacity-70" : ""}`}
      title={`Edit ${k}`}
    >
      {children}
    </span>
  );
}

// Stringify a children prop made of text + simple nodes so we can
// keep contenteditable in sync.
function renderChildrenToText(children: React.ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(renderChildrenToText).join("");
  }
  return "";
}

// ----------------------------------------------------------------
// EditableImage — click an image, pick a new one from the library
// ----------------------------------------------------------------
export function EditableImage({
  k,
  aspect,
  currentValue,
  children,
}: {
  k: string;
  // Aspect ratio of the destination slot (e.g. "4/5"). When passed,
  // the media picker shows the positioner step so the admin can
  // crop / zoom / reposition before saving.
  aspect?: string;
  // The currently-stored raw value (may be JSON with crop info).
  // Used to seed the positioner with the existing transform.
  currentValue?: string;
  // Render-prop so the caller controls how the resolved src is
  // displayed (e.g. inside a next/image, a div bg, etc.). We just
  // need to know the current src in case we want to highlight it.
  children: React.ReactNode;
}) {
  const editing = useEditMode();
  const applyEdit = useApplyContentEdit();
  // Three states for the editor flow:
  //   "closed"     — no modal
  //   "chooser"    — small dialog asking Reposition vs Replace
  //   "replace"    — full MediaPicker (browse / upload + positioner)
  //   "reposition" — positioner-only, pre-loaded with the current image
  type Mode = "closed" | "chooser" | "replace" | "reposition";
  const [mode, setMode] = useState<Mode>("closed");
  const [saving, setSaving] = useState(false);

  async function pick(value: string | ImageDisplay) {
    setSaving(true);
    try {
      // Accept either a plain path (legacy callers) or the full
      // positioned ImageDisplay record from the positioner.
      const stored = typeof value === "string" ? value : serialiseImageValue(value);
      await saveContentValue(k, stored, "image");
      applyEdit(k, stored);
      try {
        window.dispatchEvent(new CustomEvent("plonk:content-changed"));
      } catch {
        /* ignore */
      }
      try {
        if (window.parent !== window) {
          window.parent.postMessage(
            { type: "plonk:edited", key: k, value: stored },
            window.location.origin,
          );
        }
      } catch {
        /* ignore */
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to save image", k, e);
    } finally {
      setSaving(false);
      setMode("closed");
    }
  }

  const initialTransform: Partial<ImageDisplay> | undefined = currentValue
    ? parseImageValue(currentValue)
    : undefined;
  // Reposition only makes sense when there's actually an image to
  // reposition. The transform may be a JSON record OR a plain URL —
  // parseImageValue handles both and always gives us a .src.
  const currentSrc = initialTransform?.src ?? "";

  if (!editing) return <>{children}</>;

  return (
    <span
      onClick={(e) => {
        // Only open the chooser from the resting state — if a modal
        // is already up, ignore bubbled clicks from inside it. (React
        // events propagate through portals along the component tree.)
        if (mode !== "closed") return;
        e.preventDefault();
        e.stopPropagation();
        setMode("chooser");
      }}
      className={`group relative block cursor-pointer rounded outline outline-2 outline-dashed outline-plonkYellow/40 transition hover:outline-plonkYellow ${
        saving ? "opacity-70" : ""
      }`}
      title={`Edit ${k}`}
    >
      {children}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-ink/85 px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-cream opacity-0 transition group-hover:opacity-100">
        Click to edit image
      </span>
      {mode === "chooser" && (
        <EditChooserModal
          canReposition={!!currentSrc}
          onReposition={() => setMode("reposition")}
          onReplace={() => setMode("replace")}
          onClose={() => setMode("closed")}
        />
      )}
      {mode === "replace" && (
        // Lazy-load MediaPicker so non-admins don't pay the cost.
        <EditableImagePicker
          onPick={pick}
          onClose={() => setMode("closed")}
          aspect={aspect}
          initial={initialTransform}
        />
      )}
      {mode === "reposition" && currentSrc && (
        <RepositionModal
          src={currentSrc}
          aspect={aspect ?? "1/1"}
          initial={initialTransform}
          onSave={(d) => pick(d)}
          onCancel={() => setMode("closed")}
        />
      )}
    </span>
  );
}

// Two-button chooser that appears on first click of an editable image.
// Portal'd to document.body so it always anchors to the viewport.
function EditChooserModal({
  canReposition,
  onReposition,
  onReplace,
  onClose,
}: {
  canReposition: boolean;
  onReposition: () => void;
  onReplace: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/85 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-cream/15 bg-ink shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-cream/10 px-5 py-4">
          <h3 className="font-display text-xl text-cream">Edit image</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-cream/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            Close
          </button>
        </div>
        <div className="space-y-2 px-5 py-5">
          <button
            type="button"
            onClick={onReposition}
            disabled={!canReposition}
            className="block w-full rounded-xl border border-cream/15 bg-ink/40 px-4 py-4 text-left text-sm transition hover:border-plonkYellow hover:bg-plonkYellow/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="block text-xs font-bold uppercase tracking-wider text-plonkYellow">
              Reposition this image
            </span>
            <span className="mt-1 block text-cream/75">
              Crop, zoom or slide the image you already have.
            </span>
          </button>
          <button
            type="button"
            onClick={onReplace}
            className="block w-full rounded-xl border border-cream/15 bg-ink/40 px-4 py-4 text-left text-sm transition hover:border-plonkPink hover:bg-plonkPink/5"
          >
            <span className="block text-xs font-bold uppercase tracking-wider text-plonkPink">
              Replace with a different image
            </span>
            <span className="mt-1 block text-cream/75">
              Open the media library to pick or upload a new file.
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Reposition-only modal — wraps ImagePositioner in the same chrome
// MediaPicker uses, but skips the library/upload entirely. Lazy-loads
// the positioner so non-admins don't pay the cost.
function RepositionModal({
  src,
  aspect,
  initial,
  onSave,
  onCancel,
}: {
  src: string;
  aspect: string;
  initial?: Partial<ImageDisplay>;
  onSave: (d: ImageDisplay) => void;
  onCancel: () => void;
}) {
  const [Positioner, setPositioner] = useState<React.ComponentType<{
    src: string;
    aspect: string;
    initial?: Partial<ImageDisplay>;
    onSave: (d: ImageDisplay) => void;
    onCancel: () => void;
  }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("@/components/admin/ImagePositioner").then((mod) => {
      if (!cancelled) setPositioner(() => mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-stretch justify-center bg-ink/90 p-2 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-cream/15 bg-ink shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-cream/10 px-5 py-4">
          <div className="min-w-0">
            <h3 className="font-display text-2xl">Position image</h3>
            <p className="truncate text-xs text-cream/55">
              Drag to reposition · zoom to enlarge · save when happy.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-cream/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {Positioner ? (
            <Positioner
              src={src}
              aspect={aspect}
              initial={initial}
              onSave={onSave}
              onCancel={onCancel}
            />
          ) : (
            <p className="px-5 py-8 text-sm text-cream/60">Loading positioner…</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Wrapper that lazy-imports MediaPicker on first use.
function EditableImagePicker({
  onPick,
  onClose,
  aspect,
  initial,
}: {
  onPick: (value: string | ImageDisplay) => void;
  onClose: () => void;
  aspect?: string;
  initial?: Partial<ImageDisplay>;
}) {
  const [Picker, setPicker] = useState<React.ComponentType<{
    onPick: (value: string | ImageDisplay) => void;
    onClose: () => void;
    aspect?: string;
    initial?: Partial<ImageDisplay>;
  }> | null>(null);
  useEffect(() => {
    let cancelled = false;
    import("@/components/admin/MediaPicker").then((mod) => {
      if (!cancelled) setPicker(() => mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!Picker) return null;
  return (
    <Picker onPick={onPick} onClose={onClose} aspect={aspect} initial={initial} />
  );
}

// ----------------------------------------------------------------
// DisplayImage — convenience wrapper that:
//   1. Reads the saved image record for a key (URL + crop/position).
//   2. Renders it at the supplied aspect ratio with object-fit /
//      object-position / scale applied from the saved record.
//   3. Lights it up as editable when the admin toggles edit mode,
//      passing aspect through to the positioner.
//
// Use this on public pages so every image slot picks up positioner
// edits automatically:
//
//   <DisplayImage
//     k="venue.hackney.body_image"
//     fallback="/hackney/course/Course_3.jpg"
//     aspect="4/5"
//     alt="Polynesian course detail"
//     rounded
//   />
// ----------------------------------------------------------------
export function DisplayImage({
  k,
  fallback,
  aspect,
  alt,
  rounded,
  className,
}: {
  k: string;
  fallback: string;
  aspect: string;
  alt?: string;
  rounded?: boolean;
  className?: string;
}) {
  const display = useImageDisplay(k, fallback);
  // We also need the raw stored value so the positioner can pre-seed
  // itself with the current transform when the admin re-opens it.
  const raw = useContent(k, fallback);

  return (
    <EditableImage k={k} aspect={aspect} currentValue={raw}>
      <div
        className={`relative w-full overflow-hidden ${
          rounded ? "rounded-2xl" : ""
        } ${className ?? ""}`}
        style={{ aspectRatio: aspect }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={display.src}
          alt={alt ?? ""}
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: display.fit,
            objectPosition: `${display.x}% ${display.y}%`,
            transform: display.zoom !== 1 ? `scale(${display.zoom})` : undefined,
            transformOrigin: `${display.x}% ${display.y}%`,
          }}
        />
      </div>
    </EditableImage>
  );
}
