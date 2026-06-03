"use client";

import { useEffect, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import {
  loadFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
  groupFaqs,
  type DbFaq,
} from "@/lib/db/faqs";

type Draft = Omit<DbFaq, "id">;
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

export default function FaqsAdminClient() {
  const [rows, setRows] = useState<DbFaq[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<Modal>(null);

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      setRows(await loadFaqs());
    } catch (e) {
      setErr(describe(e, "Failed to load FAQs"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  const sections = groupFaqs(rows);

  async function handleToggleActive(r: DbFaq) {
    setBusy(true);
    try {
      await updateFaq(r.id, { active: !r.active });
      await reload();
    } catch (e) {
      setErr(describe(e, "Toggle failed"));
    } finally {
      setBusy(false);
    }
  }
  async function handleDelete(r: DbFaq) {
    if (!confirm(`Delete "${r.question}"?`)) return;
    setBusy(true);
    try {
      await deleteFaq(r.id);
      await reload();
    } catch (e) {
      setErr(describe(e, "Delete failed"));
    } finally {
      setBusy(false);
    }
  }
  async function handleSave(draft: Draft) {
    setBusy(true);
    setErr("");
    try {
      if (modal?.mode === "create") await createFaq(draft);
      else if (modal?.mode === "edit") await updateFaq(modal.id, draft);
      setModal(null);
      await reload();
    } catch (e) {
      setErr(describe(e, "Save failed"));
    } finally {
      setBusy(false);
    }
  }
  function openCreate(prefillSection = "") {
    const nextSectionOrder = sections.length + 1;
    setModal({
      mode: "create",
      draft: {
        section: prefillSection,
        question: "",
        answer: "",
        section_order: prefillSection
          ? sections.find((s) => s.section === prefillSection)?.section_order ??
            nextSectionOrder
          : nextSectionOrder,
        faq_order:
          (rows.filter((r) => r.section === prefillSection).length || 0) + 1,
        active: true,
      },
    });
  }
  function openEdit(r: DbFaq) {
    setModal({
      mode: "edit",
      id: r.id,
      draft: {
        section: r.section,
        question: r.question,
        answer: r.answer,
        section_order: r.section_order,
        faq_order: r.faq_order,
        active: r.active,
      },
    });
  }

  return (
    <>
      <AdminPageHeader
        title="FAQs"
        description="Questions and answers shown on /faqs. Grouped by section in the order you set them."
        action={
          <div className="flex gap-2">
            <a
              href="/faqs"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
            >
              View page ↗
            </a>
            <button
              onClick={() => openCreate()}
              className="rounded-full bg-plonkPink px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90"
            >
              + New Q&amp;A
            </button>
          </div>
        }
      />

      {err && (
        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-cream/60">Loading…</p>
      ) : sections.length === 0 ? (
        <AdminCard>
          <p className="px-5 py-10 text-center text-sm text-cream/55">
            No FAQs yet — click "+ New Q&amp;A".
          </p>
        </AdminCard>
      ) : (
        <div className="space-y-6">
          {sections.map((s) => (
            <AdminCard
              key={s.section}
              title={s.section}
              action={
                <button
                  onClick={() => openCreate(s.section)}
                  className="text-xs font-semibold uppercase tracking-wider text-plonkYellow hover:underline"
                >
                  + Add to this section
                </button>
              }
            >
              <ul className="divide-y divide-cream/5">
                {s.items.map((r) => (
                  <li
                    key={r.id}
                    className="grid grid-cols-12 items-start gap-3 px-5 py-3 text-sm"
                  >
                    <div className="col-span-7">
                      <p className="font-medium text-cream">{r.question}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-cream/55">
                        {r.answer}
                      </p>
                    </div>
                    <div className="col-span-2 text-xs text-cream/50">
                      Order: {r.faq_order}
                    </div>
                    <div className="col-span-3 flex items-center justify-end gap-3">
                      <button
                        onClick={() => handleToggleActive(r)}
                        disabled={busy}
                        className="text-xs font-semibold uppercase tracking-wider text-cream/70 hover:text-cream"
                        title={r.active ? "Hide from public site" : "Show on public site"}
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
          ))}
        </div>
      )}

      {modal && (
        <FaqModal
          title={modal.mode === "create" ? "New Q&A" : "Edit Q&A"}
          initial={modal.draft}
          knownSections={sections.map((s) => s.section)}
          onCancel={() => setModal(null)}
          onSave={handleSave}
          busy={busy}
        />
      )}
    </>
  );
}

function FaqModal({
  title,
  initial,
  knownSections,
  onCancel,
  onSave,
  busy,
}: {
  title: string;
  initial: Draft;
  knownSections: string[];
  onCancel: () => void;
  onSave: (d: Draft) => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [secOrderStr, setSecOrderStr] = useState(String(initial.section_order));
  const [faqOrderStr, setFaqOrderStr] = useState(String(initial.faq_order));
  const [localErr, setLocalErr] = useState("");

  function save() {
    setLocalErr("");
    if (!draft.section.trim()) {
      setLocalErr("Section name is required.");
      return;
    }
    if (!draft.question.trim()) {
      setLocalErr("Question is required.");
      return;
    }
    if (!draft.answer.trim()) {
      setLocalErr("Answer is required.");
      return;
    }
    const sec = parseInt(secOrderStr, 10);
    const faq = parseInt(faqOrderStr, 10);
    if (!Number.isFinite(sec) || !Number.isFinite(faq)) {
      setLocalErr("Section and FAQ order must be whole numbers.");
      return;
    }
    onSave({
      ...draft,
      section: draft.section.trim(),
      question: draft.question.trim(),
      answer: draft.answer.trim(),
      section_order: sec,
      faq_order: faq,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 p-3 sm:items-center sm:p-6">
      <div className="w-full max-w-xl rounded-2xl border border-cream/15 bg-ink p-6 shadow-2xl">
        <h3 className="font-display text-2xl">{title}</h3>
        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
              Section
            </span>
            <input
              type="text"
              list="faq-sections"
              value={draft.section}
              onChange={(e) => setDraft({ ...draft, section: e.target.value })}
              placeholder="e.g. Booking"
              className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:border-plonkPink focus:outline-none"
            />
            <datalist id="faq-sections">
              {knownSections.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
              Question
            </span>
            <input
              type="text"
              value={draft.question}
              onChange={(e) => setDraft({ ...draft, question: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
              Answer
            </span>
            <textarea
              value={draft.answer}
              onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
              rows={6}
              className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
                Section order
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={secOrderStr}
                onChange={(e) => setSecOrderStr(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
                Order in section
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={faqOrderStr}
                onChange={(e) => setFaqOrderStr(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-cream/80">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            Show on the public FAQs page
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
