"use client";

import { useEffect, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import {
  loadMenu,
  createMenuSection,
  updateMenuSection,
  deleteMenuSection,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  type DbMenuSection,
  type DbMenuItem,
} from "@/lib/db/menu";

type ItemDraft = Omit<DbMenuItem, "id">;
type SectionDraft = Omit<DbMenuSection, "id">;
type Modal =
  | { kind: "section-create"; draft: SectionDraft }
  | { kind: "section-edit"; id: string; draft: SectionDraft }
  | { kind: "item-create"; draft: ItemDraft }
  | { kind: "item-edit"; id: string; draft: ItemDraft }
  | null;

function describe(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
}

export default function SnackBarAdminClient() {
  const [sections, setSections] = useState<DbMenuSection[]>([]);
  const [items, setItems] = useState<DbMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<Modal>(null);

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      const { sections, items } = await loadMenu();
      setSections(sections);
      setItems(items);
    } catch (e) {
      setErr(describe(e, "Failed to load menu"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  async function handleDeleteSection(s: DbMenuSection) {
    if (!confirm(`Delete section "${s.title}" and all its items?`)) return;
    setBusy(true);
    try {
      await deleteMenuSection(s.id);
      await reload();
    } catch (e) {
      setErr(describe(e, "Delete failed"));
    } finally {
      setBusy(false);
    }
  }
  async function handleDeleteItem(i: DbMenuItem) {
    if (!confirm(`Delete "${i.title}"?`)) return;
    setBusy(true);
    try {
      await deleteMenuItem(i.id);
      await reload();
    } catch (e) {
      setErr(describe(e, "Delete failed"));
    } finally {
      setBusy(false);
    }
  }
  async function handleSave() {
    if (!modal) return;
    setBusy(true);
    setErr("");
    try {
      if (modal.kind === "section-create") await createMenuSection(modal.draft);
      else if (modal.kind === "section-edit")
        await updateMenuSection(modal.id, modal.draft);
      else if (modal.kind === "item-create") await createMenuItem(modal.draft);
      else if (modal.kind === "item-edit")
        await updateMenuItem(modal.id, modal.draft);
      setModal(null);
      await reload();
    } catch (e) {
      setErr(describe(e, "Save failed"));
    } finally {
      setBusy(false);
    }
  }

  function openCreateSection() {
    setModal({
      kind: "section-create",
      draft: {
        title: "",
        intro: null,
        sort_order: sections.length + 1,
        active: true,
      },
    });
  }
  function openEditSection(s: DbMenuSection) {
    setModal({
      kind: "section-edit",
      id: s.id,
      draft: {
        title: s.title,
        intro: s.intro,
        sort_order: s.sort_order,
        active: s.active,
      },
    });
  }
  function openCreateItem(sectionId: string) {
    setModal({
      kind: "item-create",
      draft: {
        section_id: sectionId,
        title: "",
        body: null,
        price: null,
        sort_order: items.filter((i) => i.section_id === sectionId).length + 1,
        active: true,
      },
    });
  }
  function openEditItem(i: DbMenuItem) {
    setModal({
      kind: "item-edit",
      id: i.id,
      draft: {
        section_id: i.section_id,
        title: i.title,
        body: i.body,
        price: i.price,
        sort_order: i.sort_order,
        active: i.active,
      },
    });
  }

  return (
    <>
      <AdminPageHeader
        title="Snack Bar"
        description="Menu shown on /snack-bar. Group items into sections (Burgers, Sides…); each item can have a price and description."
        action={
          <div className="flex gap-2">
            <a
              href="/snack-bar"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
            >
              View page ↗
            </a>
            <button
              onClick={openCreateSection}
              className="rounded-full bg-plonkPink px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90"
            >
              + New section
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
            No menu sections yet — click "+ New section".
          </p>
        </AdminCard>
      ) : (
        <div className="space-y-6">
          {sections.map((sec) => {
            const sectionItems = items
              .filter((i) => i.section_id === sec.id)
              .sort((a, b) => a.sort_order - b.sort_order);
            return (
              <AdminCard
                key={sec.id}
                title={sec.title}
                action={
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openEditSection(sec)}
                      className="text-xs font-semibold uppercase tracking-wider text-plonkYellow hover:underline"
                    >
                      Edit section
                    </button>
                    <button
                      onClick={() => handleDeleteSection(sec)}
                      className="text-xs font-semibold uppercase tracking-wider text-red-400/80 hover:underline"
                    >
                      Delete section
                    </button>
                    <button
                      onClick={() => openCreateItem(sec.id)}
                      className="rounded-full bg-plonkPink px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90"
                    >
                      + Add item
                    </button>
                  </div>
                }
              >
                {sectionItems.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-cream/55">
                    No items in this section yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-cream/5">
                    {sectionItems.map((i) => (
                      <li
                        key={i.id}
                        className="grid grid-cols-12 items-start gap-3 px-5 py-3 text-sm"
                      >
                        <div className="col-span-6">
                          <p className="font-medium text-cream">{i.title}</p>
                          {i.body && (
                            <p className="mt-0.5 text-xs text-cream/55">
                              {i.body}
                            </p>
                          )}
                        </div>
                        <div className="col-span-2 text-cream/85">
                          {i.price ? `£${i.price}` : "—"}
                        </div>
                        <div className="col-span-1 text-xs text-cream/50">
                          {i.sort_order}
                        </div>
                        <div className="col-span-3 flex items-center justify-end gap-3">
                          <button
                            onClick={() => openEditItem(i)}
                            disabled={busy}
                            className="text-xs font-semibold uppercase tracking-wider text-plonkYellow hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteItem(i)}
                            disabled={busy}
                            className="text-xs font-semibold uppercase tracking-wider text-red-400/80 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </AdminCard>
            );
          })}
        </div>
      )}

      {modal && (
        <Modal
          modal={modal}
          onClose={() => setModal(null)}
          onChange={setModal}
          onSave={handleSave}
          busy={busy}
        />
      )}
    </>
  );
}

function Modal({
  modal,
  onClose,
  onChange,
  onSave,
  busy,
}: {
  modal: NonNullable<Modal>;
  onClose: () => void;
  onChange: (m: NonNullable<Modal>) => void;
  onSave: () => void;
  busy: boolean;
}) {
  const isSection =
    modal.kind === "section-create" || modal.kind === "section-edit";
  const isCreate =
    modal.kind === "section-create" || modal.kind === "item-create";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 p-3 sm:items-center sm:p-6">
      <div className="w-full max-w-xl rounded-2xl border border-cream/15 bg-ink p-6 shadow-2xl">
        <h3 className="font-display text-2xl">
          {isSection
            ? isCreate
              ? "New section"
              : "Edit section"
            : isCreate
              ? "New menu item"
              : "Edit menu item"}
        </h3>
        <div className="mt-5 space-y-3">
          {isSection ? (
            <SectionFields modal={modal} onChange={onChange} />
          ) : (
            <ItemFields modal={modal} onChange={onChange} />
          )}
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-cream/20 px-5 py-2 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
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

function SectionFields({
  modal,
  onChange,
}: {
  modal: NonNullable<Modal>;
  onChange: (m: NonNullable<Modal>) => void;
}) {
  if (modal.kind !== "section-create" && modal.kind !== "section-edit") return null;
  const d = modal.draft;
  function patch(p: Partial<typeof d>) {
    onChange({ ...modal, draft: { ...d, ...p } } as NonNullable<Modal>);
  }
  return (
    <>
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
          Title
        </span>
        <input
          type="text"
          value={d.title}
          onChange={(e) => patch({ title: e.target.value })}
          className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
          Intro (optional)
        </span>
        <input
          type="text"
          value={d.intro ?? ""}
          onChange={(e) => patch({ intro: e.target.value || null })}
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
          value={String(d.sort_order)}
          onChange={(e) => patch({ sort_order: parseInt(e.target.value, 10) || 0 })}
          className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-cream/80">
        <input
          type="checkbox"
          checked={d.active}
          onChange={(e) => patch({ active: e.target.checked })}
        />
        Active
      </label>
    </>
  );
}

function ItemFields({
  modal,
  onChange,
}: {
  modal: NonNullable<Modal>;
  onChange: (m: NonNullable<Modal>) => void;
}) {
  if (modal.kind !== "item-create" && modal.kind !== "item-edit") return null;
  const d = modal.draft;
  function patch(p: Partial<typeof d>) {
    onChange({ ...modal, draft: { ...d, ...p } } as NonNullable<Modal>);
  }
  return (
    <>
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
          Title
        </span>
        <input
          type="text"
          value={d.title}
          onChange={(e) => patch({ title: e.target.value })}
          className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
          Description
        </span>
        <textarea
          value={d.body ?? ""}
          onChange={(e) => patch({ body: e.target.value || null })}
          rows={3}
          className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-widest text-cream/55">
            Price (e.g. 12)
          </span>
          <input
            type="text"
            value={d.price ?? ""}
            onChange={(e) => patch({ price: e.target.value || null })}
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
            value={String(d.sort_order)}
            onChange={(e) => patch({ sort_order: parseInt(e.target.value, 10) || 0 })}
            className="mt-1.5 w-full rounded-lg border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream focus:border-plonkPink focus:outline-none"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-cream/80">
        <input
          type="checkbox"
          checked={d.active}
          onChange={(e) => patch({ active: e.target.checked })}
        />
        Active
      </label>
    </>
  );
}
