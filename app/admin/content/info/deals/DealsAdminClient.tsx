"use client";

import { useEffect, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import ContentEditor from "@/components/admin/ContentEditor";
import {
  loadDeals,
  createDeal,
  updateDeal,
  deleteDeal,
  type DbSiteDeal,
} from "@/lib/db/deals";

type Draft = Omit<DbSiteDeal, "id">;
type Modal =
  | { mode: "create"; draft: Draft }
  | { mode: "edit"; id: string; draft: Draft }
  | null;

function describe(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
}

export default function DealsAdminClient() {
  const [rows, setRows] = useState<DbSiteDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<Modal>(null);

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      setRows(await loadDeals());
    } catch (e) {
      setErr(describe(e, "Failed to load deals"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  async function handleSave(draft: Draft) {
    setBusy(true);
    setErr("");
    try {
      if (modal?.mode === "create") await createDeal(draft);
      else if (modal?.mode === "edit") await updateDeal(modal.id, draft);
      setModal(null);
      await reload();
    } catch (e) {
      setErr(describe(e, "Save failed"));
    } finally {
      setBusy(false);
    }
  }
  async function handleDelete(r: DbSiteDeal) {
    if (!confirm(`Delete "${r.title}"?`)) return;
    setBusy(true);
    try {
      await deleteDeal(r.id);
      await reload();
    } catch (e) {
      setErr(describe(e, "Delete failed"));
    } finally {
      setBusy(false);
    }
  }
  async function handleToggleActive(r: DbSiteDeal) {
    setBusy(true);
    try {
      await updateDeal(r.id, { active: !r.active });
      await reload();
    } catch (e) {
      setErr(describe(e, "Toggle failed"));
    } finally {
      setBusy(false);
    }
  }

  function openCreate() {
    setModal({
      mode: "create",
      draft: {
        day: "",
        title: "",
        venue: null,
        body: "",
        sort_order: rows.length + 1,
        active: true,
      },
    });
  }
  function openEdit(r: DbSiteDeal) {
    setModal({
      mode: "edit",
      id: r.id,
      draft: {
        day: r.day,
        title: r.title,
        venue: r.venue,
        body: r.body,
        sort_order: r.sort_order,
        active: r.active,
      },
    });
  }

  return (
    <>
      <AdminPageHeader
        title="Deals"
        description="Off-peak deals shown on /deals. Each deal has a day-of-the-week badge, a title, an optional venue tag, and a body."
        action={
          <div className="flex gap-2">
            <a
              href="/deals"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
            >
              View page ↗
            </a>
            <button
              onClick={openCreate}
              className="rounded-full bg-plonkPink px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90"
            >
              + New deal
            </button>
          </div>
        }
      />

      <div className="mb-8">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-plonkYellow">
          Page hero + CTA panel copy
        </h2>
        <ContentEditor page="info.deals" />
      </div>

      <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-plonkYellow">
        Deals list
      </h2>

      {err && (
        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-cream/60">Loading…</p>
      ) : rows.length === 0 ? (
        <AdminCard>
          <p className="px-5 py-10 text-center text-sm text-cream/55">
            No deals yet — click "+ New deal".
          </p>
        </AdminCard>
      ) : (
        <AdminCard>
          <ul className="divide-y divide-cream/5">
            {rows.map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-12 items-start gap-3 px-5 py-3 text-sm"
              >
                <div className="col-span-7">
                  <p className="font-medium text-cream">{r.title}</p>
                  <p className="text-xs uppercase tracking-wider text-cream/55">
                    {r.day}
                    {r.venue ? ` · ${r.venue}` : ""}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-cream/55">
                    {r.body}
                  </p>
                </div>
                <div className="col-span-2 text-xs text-cream/50">
                  Order: {r.sort_order}
                </div>
                <div className="col-span-3 flex items-center justify-end gap-3">
                  <button
                    onClick={() => handleToggleActive(r)}
                    disabled={busy}
                    className="text-xs font-semibold uppercase tracking-wider text-cream/70 hover:text-cream"
                  >
                    {r.active ? "Visible" : "Hidden"}
                  </button>
                  <button
                    onClick={() => openEdit(r)}
                    disabled={busy}
                    className="text-xs font-semibold uppercase tracking-wider text-plonkYellow hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(r)}
                    disabled={busy}
                    className="text-xs font-semibold uppercase tracking-wider text-red-400/80 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </AdminCard>
      )}

      {modal && (
        <DealModal
          title={modal.mode === "create" ? "New deal" : "Edit deal"}
          initial={modal.draft}
          onCancel={() => setModal(null)}
          onSave={handleSave}
          busy={busy}
        />
      )}
    </>
  );
}

function DealModal({
  title,
  initial,
  onCancel,
  onSave,
  busy,
}: {
  title: string;
  initial: Draft;
  onCancel: () => void;
  onSave: (d: Draft) => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [sortStr, setSortStr] = useState(String(initial.sort_order));
  const [localErr, setLocalErr] = useState("");

  function save() {
    setLocalErr("");
    if (!draft.day.trim()) {
      setLocalErr("Day is required.");
      return;
    }
    if (!draft.title.trim()) {
      setLocalErr("Title is required.");
      return;
    }
    if (!draft.body.trim()) {
      setLocalErr("Body is required.");
      return;
    }
    const s = parseInt(sortStr, 10);
    if (!Number.isFinite(s)) {
      setLocalErr("Sort order must be a whole number.");
      return;
    }
    onSave({
      ...draft,
      day: draft.day.trim(),
      title: draft.title.trim(),
      venue: draft.venue?.trim() || null,
      body: draft.body.trim(),
      sort_order: s,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 p-3 sm:items-center sm:p-6">
      <div className="w-full max-w-xl rounded-2xl border border-cream/15 bg-ink p-6 shadow-2xl">
        <h3 className="font-display text-2xl">{title}</h3>
        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
              Day / frequency
            </span>
            <input
              type="text"
              value={draft.day}
              onChange={(e) => setDraft({ ...draft, day: e.target.value })}
              placeholder="Mondays — All day"
              className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:border-plonkPink focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
              Title
            </span>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="2-for-1 on Games"
              className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
              Venue tag (optional — e.g. "Hackney")
            </span>
            <input
              type="text"
              value={draft.venue ?? ""}
              onChange={(e) => setDraft({ ...draft, venue: e.target.value || null })}
              placeholder="Hackney"
              className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
              Body / description
            </span>
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              rows={4}
              className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
              Sort order
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={sortStr}
              onChange={(e) => setSortStr(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-cream/80">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            Visible on the public site
          </label>
          {localErr && (
            <p className="rounded-lg border border-red-400/30 bg-red-400/5 px-3 py-2 text-sm text-red-300">
              {localErr}
            </p>
          )}
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-cream/20 px-5 py-2 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-full bg-plonkPink px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90 disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
