"use client";

import { useEffect, useRef, useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import MediaPicker from "@/components/admin/MediaPicker";
import BlockEditor from "@/components/admin/BlockEditor";
import LivePreview from "@/components/admin/LivePreview";
import {
  loadPageContent,
  updateContentValues,
  type DbContentRow,
  type FieldKind,
} from "@/lib/db/content";
import { uploadImage } from "@/lib/db/media";
import { getImageSpec, specCaption } from "@/lib/imageSpecs";
import { serialiseImageValue, type ImageDisplay } from "@/lib/content";

function describe(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
}

// Renders an admin edit form for every page_content row whose `page`
// matches the prop. One generic component for every editable page — each
// route under /admin/content/* is a thin wrapper that calls this with a
// different `page` string.
export default function ContentEditor({
  page,
  fallbacks,
  previewPath,
}: {
  page: string;
  // Optional map of fallback values (the hardcoded defaults from the
  // public page) so the admin form shows current copy as placeholder
  // text rather than just an empty field. Saved value still wins.
  fallbacks?: Record<string, string>;
  // Optional public-site path to render in the side-by-side live
  // preview pane (e.g. "/", "/venue/hackney"). When set, the editor
  // mounts an iframe of the page and pipes drafts to it as you type.
  previewPath?: string;
}) {
  const [rows, setRows] = useState<DbContentRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      const list = await loadPageContent(page);
      setRows(list);
      const next: Record<string, string> = {};
      for (const r of list) next[r.key] = r.value;
      setDrafts(next);
    } catch (e) {
      setErr(describe(e, "Failed to load page content"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, [page]);

  function setDraft(key: string, value: string) {
    setDrafts((d) => ({ ...d, [key]: value }));
  }

  function isDirty(): boolean {
    return rows.some((r) => (drafts[r.key] ?? "") !== r.value);
  }

  async function save() {
    setSaving(true);
    setErr("");
    setSavedFlash(false);
    try {
      const patches = rows
        .filter((r) => (drafts[r.key] ?? "") !== r.value)
        .map((r) => ({ key: r.key, value: drafts[r.key] ?? "" }));
      if (patches.length === 0) return;
      await updateContentValues(patches);
      await reload();
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (e) {
      setErr(describe(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-cream/60">Loading…</p>;

  if (rows.length === 0) {
    return (
      <AdminCard>
        <p className="px-5 py-8 text-sm text-cream/60">
          No editable fields registered for <code>{page}</code>. (Re-run{" "}
          <code>supabase/migrations/004-page-content.sql</code> in the SQL Editor
          to seed them.)
        </p>
      </AdminCard>
    );
  }

  // The drafts map we hand to the preview is the current row values
  // (saved value or draft, whichever's freshest). Pre-fill with saved
  // values so the iframe shows them even before the editor is dirty.
  const previewDrafts: Record<string, string> = {};
  for (const r of rows) previewDrafts[r.key] = drafts[r.key] ?? r.value;

  return (
    // When previewPath is set on a desktop viewport, the LivePreview
    // pane occupies the right 44vw — we reserve that space here so
    // the form doesn't sit underneath it.
    <div className={previewPath ? "md:pr-[50vw]" : ""}>
      <div className="space-y-5">
        {err && (
          <div className="rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
            {err}
          </div>
        )}

        {rows.map((row) => (
          <FieldEditor
            key={row.key}
            row={row}
            fallback={fallbacks?.[row.key]}
            value={drafts[row.key] ?? ""}
            onChange={(v) => setDraft(row.key, v)}
          />
        ))}

        <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-2xl border border-cream/15 bg-ink/95 px-5 py-3 shadow-2xl backdrop-blur">
          {savedFlash && (
            <span className="text-sm text-plonkTeal">Saved.</span>
          )}
          <button
            onClick={save}
            disabled={!isDirty() || saving}
            className="rounded-full bg-plonkPink px-6 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {previewPath && (
        <LivePreview path={previewPath} drafts={previewDrafts} />
      )}
    </div>
  );
}

// One row of the form — picks the right input based on field_kind.
function FieldEditor({
  row,
  value,
  onChange,
  fallback,
}: {
  row: DbContentRow;
  value: string;
  onChange: (v: string) => void;
  fallback?: string;
}) {
  return (
    <AdminCard>
      <div className="px-5 py-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-sm font-bold text-cream">{row.label}</h3>
          <code className="text-[10px] text-cream/35">{row.key}</code>
        </div>
        {row.helper && (
          <p className="mb-3 text-xs text-cream/55">{row.helper}</p>
        )}
        <KindInput
          kind={row.field_kind}
          contentKey={row.key}
          value={value}
          onChange={onChange}
          fallback={fallback}
        />
        {value === "" && fallback && (
          <p className="mt-2 text-xs text-cream/45">
            Currently showing default: <span className="text-cream/70">{fallback.slice(0, 90)}{fallback.length > 90 ? "…" : ""}</span>
          </p>
        )}
      </div>
    </AdminCard>
  );
}

// Pick the typography that mirrors how this field actually renders on
// the live site, based on the content key. Keeps the admin editor
// reading like a stripped-down version of the page — headlines look
// like headlines, eyebrows like eyebrows, body copy like body copy.
function liveTypography(contentKey: string, kind: FieldKind): string {
  const k = contentKey.toLowerCase();
  if (k.includes("eyebrow")) {
    return "font-bold uppercase tracking-widest text-xs text-plonkYellow";
  }
  if (k.includes("headline") || k.includes("title")) {
    return "font-display text-3xl leading-tight text-cream sm:text-4xl";
  }
  if (k.includes("heading")) {
    return "font-display text-2xl leading-tight text-cream sm:text-3xl";
  }
  if (k.includes("tagline") || k.includes("subcopy") || k.includes("intro")) {
    return "text-base leading-relaxed text-cream";
  }
  if (kind === "textarea") return "text-sm leading-relaxed text-cream";
  return "text-sm text-cream";
}

function KindInput({
  kind,
  contentKey,
  value,
  onChange,
  fallback,
}: {
  kind: FieldKind;
  contentKey: string;
  value: string;
  onChange: (v: string) => void;
  fallback?: string;
}) {
  const placeholder = fallback ? `Default: ${fallback.slice(0, 60)}${fallback.length > 60 ? "…" : ""}` : "";
  const typoClass = liveTypography(contentKey, kind);

  if (kind === "image") {
    return (
      <ImageInput
        contentKey={contentKey}
        value={value}
        onChange={onChange}
        fallback={fallback}
      />
    );
  }
  if (kind === "html") {
    // HTML body fields use the structured BlockEditor — one input per
    // heading / paragraph / image, drag handles to re-order. We still
    // store the result as HTML so the public site keeps reading it
    // exactly as before.
    return <BlockEditor value={value} onChange={onChange} />;
  }
  if (kind === "textarea") {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={5}
        className={`w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 placeholder:text-cream/30 focus:border-plonkPink focus:outline-none ${typoClass}`}
      />
    );
  }
  return (
    <input
      type={kind === "url" ? "url" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-2.5 placeholder:text-cream/30 focus:border-plonkPink focus:outline-none ${typoClass}`}
    />
  );
}

function ImageInput({
  contentKey,
  value,
  onChange,
  fallback,
}: {
  contentKey: string;
  value: string;
  onChange: (v: string) => void;
  fallback?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const preview = value || fallback || "";
  const spec = getImageSpec(contentKey);

  async function handleFile(file: File) {
    setBusy(true);
    setErr("");
    try {
      const { public_url } = await uploadImage(file);
      onChange(public_url);
    } catch (e) {
      setErr(describe(e, "Upload failed"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <SpecCaption spec={spec} />
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt=""
          className={`${spec.aspectClass} w-full max-w-md rounded-lg border border-cream/10 bg-ink/30 object-cover`}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label
          className={`cursor-pointer rounded-full border border-cream/20 bg-cream/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cream hover:bg-cream/10 ${
            busy ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {busy ? "Uploading…" : preview ? "Replace image" : "Upload image"}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="rounded-full border border-cream/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cream hover:bg-cream/5"
        >
          Pick from library
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="rounded-full border border-cream/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cream/70 hover:bg-cream/5"
          >
            Revert to default
          </button>
        )}
      </div>
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…or paste a direct image URL"
        className="w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-xs text-cream/85 placeholder:text-cream/30 focus:border-plonkPink focus:outline-none"
      />
      {err && (
        <p className="text-xs text-red-300">{err}</p>
      )}
      {pickerOpen && (
        <MediaPicker
          // Derive ratio from the spec's pixel dimensions — robust to
          // labels that aren't a tidy "X:Y" (e.g. "wide").
          aspect={`${spec.width}/${spec.height}`}
          onPick={(picked: string | ImageDisplay) => {
            // MediaPicker hands back either a plain path (legacy) or
            // the full positioned record. Store the serialised form
            // so DisplayImage on the public page can apply crop/zoom.
            const stored =
              typeof picked === "string" ? picked : serialiseImageValue(picked);
            onChange(stored);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

// Small banner shown above every image upload field, telling the
// admin user what shape and size of file fits the slot best. Reads
// straight from lib/imageSpecs so docs and UI stay in lock-step.
export function SpecCaption({ spec }: { spec: ReturnType<typeof getImageSpec> }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-xs ${
        spec.inferred
          ? "border-plonkYellow/30 bg-plonkYellow/5 text-plonkYellow"
          : "border-cream/15 bg-ink/30 text-cream/70"
      }`}
    >
      <span className="font-semibold text-cream/90">
        Recommended:&nbsp;
      </span>
      <span>
        {spec.width.toLocaleString()}×{spec.height.toLocaleString()}px,{" "}
        {spec.orientation} ({spec.aspectLabel}), JPEG under {spec.maxKb}KB.
      </span>
      {spec.notes && (
        <p className="mt-1 text-[11px] italic opacity-80">{spec.notes}</p>
      )}
    </div>
  );
}
