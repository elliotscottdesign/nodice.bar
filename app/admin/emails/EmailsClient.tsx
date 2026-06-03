"use client";

import { useEffect, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import {
  loadEmailTemplates,
  updateEmailTemplate,
  type DbEmailTemplate,
} from "@/lib/db/emails";

function describe(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
}

type Draft = { subject: string; body: string };

export default function EmailsClient() {
  const [templates, setTemplates] = useState<DbEmailTemplate[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      const t = await loadEmailTemplates();
      setTemplates(t);
      const d: Record<string, Draft> = {};
      for (const row of t) d[row.id] = { subject: row.subject, body: row.body };
      setDrafts(d);
    } catch (e) {
      setErr(describe(e, "Failed to load templates"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  function setDraft(id: string, patch: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  async function save(t: DbEmailTemplate) {
    setSavingId(t.id);
    setSavedId(null);
    setErr("");
    try {
      const d = drafts[t.id];
      await updateEmailTemplate(t.id, { subject: d.subject, body: d.body });
      setSavedId(t.id);
      // Pull fresh row but don't lose the user's draft fields while doing so.
      const fresh = await loadEmailTemplates();
      setTemplates(fresh);
    } catch (e) {
      setErr(describe(e, "Save failed"));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Email Templates"
        description="Wording of the emails Plonk sends to customers. Tags like {{first_name}} or {{slot_time}} get filled in automatically."
      />

      {err && (
        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-cream/60">Loading…</p>
      ) : (
        <div className="space-y-6">
          {templates.map((t) => {
            const d = drafts[t.id] ?? { subject: t.subject, body: t.body };
            const dirty = d.subject !== t.subject || d.body !== t.body;
            return (
              <AdminCard
                key={t.id}
                title={t.label}
                action={
                  <div className="flex items-center gap-3">
                    {savedId === t.id && !dirty && (
                      <span className="text-xs text-plonkTeal">Saved.</span>
                    )}
                    <button
                      onClick={() => save(t)}
                      disabled={!dirty || savingId === t.id}
                      className="rounded-full bg-plonkPink px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90 disabled:opacity-40"
                    >
                      {savingId === t.id ? "Saving…" : "Save"}
                    </button>
                  </div>
                }
              >
                <div className="space-y-4 px-5 py-5">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-cream/50">
                      Subject line
                    </label>
                    <input
                      type="text"
                      value={d.subject}
                      onChange={(e) => setDraft(t.id, { subject: e.target.value })}
                      className="mt-2 w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-2.5 text-sm text-cream focus:border-plonkPink focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-cream/50">
                      Body
                    </label>
                    <textarea
                      value={d.body}
                      onChange={(e) => setDraft(t.id, { body: e.target.value })}
                      rows={10}
                      className="mt-2 w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 font-mono text-xs leading-relaxed text-cream focus:border-plonkPink focus:outline-none"
                    />
                  </div>
                </div>
              </AdminCard>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-xs text-cream/50">
        Available tags depend on the email type — booking confirmations get{" "}
        <code className="text-cream/85">{"{{first_name}}"}</code>,{" "}
        <code className="text-cream/85">{"{{slot_time}}"}</code>,{" "}
        <code className="text-cream/85">{"{{venue_name}}"}</code>,{" "}
        <code className="text-cream/85">{"{{party_size}}"}</code>,{" "}
        <code className="text-cream/85">{"{{reference}}"}</code>.
      </p>
    </>
  );
}
