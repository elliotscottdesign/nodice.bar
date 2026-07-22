"use client";

import { supabase } from "@/lib/supabase";
import { SITE } from "@/lib/site";

export type FieldKind = "text" | "textarea" | "html" | "image" | "url";

export type DbContentRow = {
  key: string;
  value: string;
  page: string;
  field_kind: FieldKind;
  label: string;
  helper: string | null;
  sort_order: number;
  updated_at: string;
};

// Load every editable slot across the marketing site in a single call.
// The public ContentProvider does this once on mount; the admin Content
// pages also reuse it and filter client-side by page.
export async function loadAllContent(): Promise<DbContentRow[]> {
  const { data, error } = await supabase()
    .from("page_content")
    .select("key, value, page, field_kind, label, helper, sort_order, updated_at")
    .eq("site", SITE)
    .order("page")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as DbContentRow[];
}

export async function loadPageContent(page: string): Promise<DbContentRow[]> {
  const { data, error } = await supabase()
    .from("page_content")
    .select("key, value, page, field_kind, label, helper, sort_order, updated_at")
    .eq("site", SITE)
    .eq("page", page)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as DbContentRow[];
}

// Best-effort mapping of a content key to the page bucket the admin
// form uses. The first segment usually matches; a handful of pages
// live in a sub-namespace (e.g. info.events, global.header). The
// table is mirrored from the explicit page values we use in the
// seed migrations, so a freshly-inserted row from a code save still
// surfaces in the right admin form.
function derivePage(key: string): string {
  const parts = key.split(".");
  if (parts.length < 2) return key;
  const first = parts[0];
  if (
    [
      "events",
      "deals",
      "vouchers",
      "about",
      "terms",
      "privacy",
      "contact",
      "faqs",
      "snackbar",
    ].includes(first)
  ) {
    return `info.${first}`;
  }
  if (first === "header" || first === "footer") return `global.${first}`;
  if (first === "home") return "home";
  // venue.hackney, venue.borough, privatehire.hackney, privatehire.borough
  return parts.slice(0, 2).join(".");
}

/**
 * Save a content value robustly: tries UPDATE first, and if no row
 * exists yet for this key (which is the silent-failure trap that
 * just bit us — a wrapped editable on a page whose key wasn't
 * pre-seeded by a migration), INSERTs a fresh row with sensible
 * defaults so the save sticks AND the field shows up in the
 * relevant admin form.
 *
 * Use this from every save path (Editable, EditableImage, admin
 * forms). Don't .update() page_content directly.
 */
export async function saveContentValue(
  key: string,
  value: string,
  fieldKind: FieldKind = "text",
): Promise<void> {
  const sb = supabase();
  // Try the update path first. .select() makes Supabase return the
  // affected rows so we can detect 0-row updates.
  const { data, error } = await sb
    .from("page_content")
    .update({ value })
    .eq("site", SITE)
    .eq("key", key)
    .select("key");
  if (error) throw error;
  if (data && data.length > 0) return;

  // Row didn't exist — insert it with derived defaults.
  const lastDot = key.lastIndexOf(".");
  const label = lastDot > 0 ? key.slice(lastDot + 1) : key;
  const { error: insertErr } = await sb.from("page_content").insert({
    site: SITE,
    key,
    value,
    page: derivePage(key),
    field_kind: fieldKind,
    label,
    helper: "",
    sort_order: 999,
  });
  // ON CONFLICT race — if another tab inserted between our update
  // and our insert, the unique-key violation surfaces as code 23505.
  // Treat that as success and re-run the update so we win.
  if (insertErr) {
    const codeStr = (insertErr as { code?: string }).code ?? "";
    if (codeStr === "23505") {
      const retry = await sb
        .from("page_content")
        .update({ value })
        .eq("site", SITE)
        .eq("key", key);
      if (retry.error) throw retry.error;
      return;
    }
    throw insertErr;
  }
}

// Legacy alias for the admin form's bulk save.
export async function updateContentValue(key: string, value: string): Promise<void> {
  return saveContentValue(key, value);
}

// Bulk save — pushes one update per dirty field. Sequential to keep error
// reporting simple (first failure short-circuits and surfaces the message).
export async function updateContentValues(
  patches: { key: string; value: string }[],
): Promise<void> {
  for (const p of patches) {
    await updateContentValue(p.key, p.value);
  }
}
