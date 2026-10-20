"use client";

// =============================================================
// EnquiriesClient — the CRM pipeline board (spine, slice 1)
// =============================================================
// New → Pencilled → Confirmed → Lost. Office + bar staff raise an enquiry here
// (the "quick enquiry maker"); it moves across the board; a detail drawer holds
// the contact, notes and a comms thread. Confirming is where it will tie into a
// real event/booking + the fulfilment actions (payment link, food form, brief) —
// those land in the next slice. Reads the `enquiries` table (migration
// 20261020000001); if that isn't live yet it shows a gentle "not switched on"
// note instead of crashing.
// =============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import Notice from "@/components/Notice";
import DatePickerInput from "@/components/admin/DatePickerInput";
import {
  loadEnquiries,
  createEnquiry,
  setEnquiryStatus,
  updateEnquiry,
  deleteEnquiry,
  loadEnquiryMessages,
  addEnquiryMessage,
  SOURCE_LABEL,
  STATUS_LABEL,
  STATUS_ORDER,
  type Enquiry,
  type EnquiryStatus,
  type EnquirySource,
  type EnquiryMessage,
} from "@/lib/db/enquiries";

function describe(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

const STATUS_STYLE: Record<EnquiryStatus, string> = {
  new: "border-cream/25 text-cream/80",
  pencilled: "border-plonkYellow/60 text-plonkYellow",
  confirmed: "border-plonkTeal/60 text-plonkTeal",
  lost: "border-cream/15 text-cream/40",
};

const SOURCES: EnquirySource[] = [
  "bar_staff",
  "party_form",
  "email",
  "phone",
  "instagram",
  "facebook",
  "other",
];

const EMPTY = {
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  event_type: "",
  party_size: "",
  requested_date: "",
  date_flex: "",
  budget: "",
  notes: "",
  source: "bar_staff" as EnquirySource,
};

export default function EnquiriesClient() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ ...EMPTY });
  const [openId, setOpenId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      setEnquiries(await loadEnquiries());
    } catch (e) {
      setErr(describe(e, "Couldn't load enquiries."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const byStatus = useMemo(() => {
    const m: Record<EnquiryStatus, Enquiry[]> = {
      new: [],
      pencilled: [],
      confirmed: [],
      lost: [],
    };
    for (const e of enquiries) m[e.status].push(e);
    return m;
  }, [enquiries]);

  async function saveNew() {
    if (!draft.contact_name.trim() && !draft.event_type.trim()) {
      setErr("Give the enquiry at least a name or an event type.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await createEnquiry({
        ...draft,
        party_size: draft.party_size ? Number(draft.party_size) : null,
        requested_date: draft.requested_date || null,
        status: "new",
      });
      setDraft({ ...EMPTY });
      setCreating(false);
      await reload();
    } catch (e) {
      setErr(describe(e, "Couldn't save the enquiry."));
    } finally {
      setBusy(false);
    }
  }

  async function move(id: string, status: EnquiryStatus) {
    setBusy(true);
    try {
      await setEnquiryStatus(id, status);
      await reload();
    } catch (e) {
      setErr(describe(e, "Couldn't update the enquiry."));
    } finally {
      setBusy(false);
    }
  }

  const open = enquiries.find((e) => e.id === openId) || null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Enquiries</h1>
          <p className="mt-1 max-w-2xl text-xs text-cream/55">
            The front of the funnel. Raise an enquiry (party booker, email, or a
            walk-up at the bar), pencil it in, then confirm — confirming is where
            it becomes a real event with its payment link, food form and
            kitchen/bar brief (coming next).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="rounded-full bg-plonkTeal px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink transition hover:brightness-110"
        >
          {creating ? "Close" : "+ New enquiry"}
        </button>
      </div>

      {err && <Notice variant="error">{err}</Notice>}

      {/* Quick enquiry maker */}
      {creating && (
        <div className="rounded-xl border border-plonkTeal/25 bg-ink/40 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Contact name">
              <input
                value={draft.contact_name}
                onChange={(e) =>
                  setDraft({ ...draft, contact_name: e.target.value })
                }
                className={inputCls}
                placeholder="Who's asking"
              />
            </Field>
            <Field label="Email">
              <input
                value={draft.contact_email}
                onChange={(e) =>
                  setDraft({ ...draft, contact_email: e.target.value })
                }
                className={inputCls}
                placeholder="name@email.com"
              />
            </Field>
            <Field label="Phone">
              <input
                value={draft.contact_phone}
                onChange={(e) =>
                  setDraft({ ...draft, contact_phone: e.target.value })
                }
                className={inputCls}
                placeholder="07…"
              />
            </Field>
            <Field label="What they want">
              <input
                value={draft.event_type}
                onChange={(e) =>
                  setDraft({ ...draft, event_type: e.target.value })
                }
                className={inputCls}
                placeholder="Birthday · corporate · pool comp…"
              />
            </Field>
            <Field label="Party size">
              <input
                value={draft.party_size}
                onChange={(e) =>
                  setDraft({ ...draft, party_size: e.target.value })
                }
                inputMode="numeric"
                className={inputCls}
                placeholder="e.g. 12"
              />
            </Field>
            <Field label="Date (or leave blank)">
              <DatePickerInput
                value={draft.requested_date}
                onChange={(iso) => setDraft({ ...draft, requested_date: iso })}
              />
            </Field>
            <Field label="Flexible dates">
              <input
                value={draft.date_flex}
                onChange={(e) =>
                  setDraft({ ...draft, date_flex: e.target.value })
                }
                className={inputCls}
                placeholder="any Fri in Nov…"
              />
            </Field>
            <Field label="Budget">
              <input
                value={draft.budget}
                onChange={(e) => setDraft({ ...draft, budget: e.target.value })}
                className={inputCls}
                placeholder="£…"
              />
            </Field>
            <Field label="Source">
              <select
                value={draft.source}
                onChange={(e) =>
                  setDraft({ ...draft, source: e.target.value as EnquirySource })
                }
                className={inputCls}
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Notes" className="sm:col-span-2 lg:col-span-3">
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                rows={2}
                className={inputCls}
                placeholder="Anything they said…"
              />
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={saveNew}
              disabled={busy}
              className="rounded-full bg-plonkTeal px-5 py-2 text-xs font-bold uppercase tracking-wider text-ink transition hover:brightness-110 disabled:opacity-40"
            >
              {busy ? "Saving…" : "Save enquiry"}
            </button>
          </div>
        </div>
      )}

      {/* Pipeline board */}
      {loading ? (
        <p className="text-sm text-cream/50">Loading…</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-4">
          {STATUS_ORDER.map((st) => (
            <div
              key={st}
              className="rounded-xl border border-cream/10 bg-ink/30 p-2"
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-cream/70">
                  {STATUS_LABEL[st]}
                </span>
                <span className="text-[11px] text-cream/40">
                  {byStatus[st].length}
                </span>
              </div>
              <div className="space-y-2">
                {byStatus[st].map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setOpenId(e.id)}
                    className={`block w-full rounded-lg border bg-ink/50 p-2.5 text-left transition hover:border-cream/40 ${STATUS_STYLE[e.status]}`}
                  >
                    <div className="truncate text-sm font-bold text-cream">
                      {e.contact_name || e.event_type || "Untitled enquiry"}
                    </div>
                    {e.event_type && e.contact_name && (
                      <div className="truncate text-[11px] text-cream/60">
                        {e.event_type}
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] uppercase tracking-wider text-cream/45">
                      {e.requested_date && <span>{e.requested_date}</span>}
                      {e.party_size ? <span>· {e.party_size}p</span> : null}
                      <span>· {SOURCE_LABEL[e.source]}</span>
                    </div>
                  </button>
                ))}
                {byStatus[st].length === 0 && (
                  <p className="px-1 py-2 text-[11px] text-cream/30">—</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <EnquiryDrawer
          enquiry={open}
          onClose={() => setOpenId(null)}
          onMove={move}
          onSavedField={async (patch) => {
            try {
              await updateEnquiry(open.id, patch);
              await reload();
            } catch (e) {
              setErr(describe(e, "Couldn't save."));
            }
          }}
          onDelete={async () => {
            if (!window.confirm("Delete this enquiry? This can't be undone."))
              return;
            try {
              await deleteEnquiry(open.id);
              setOpenId(null);
              await reload();
            } catch (e) {
              setErr(describe(e, "Couldn't delete."));
            }
          }}
        />
      )}
    </div>
  );
}

function EnquiryDrawer({
  enquiry,
  onClose,
  onMove,
  onSavedField,
  onDelete,
}: {
  enquiry: Enquiry;
  onClose: () => void;
  onMove: (id: string, status: EnquiryStatus) => void;
  onSavedField: (patch: Record<string, unknown>) => Promise<void>;
  onDelete: () => void;
}) {
  const [messages, setMessages] = useState<EnquiryMessage[]>([]);
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState(enquiry.notes);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setNotes(enquiry.notes);
    loadEnquiryMessages(enquiry.id)
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [enquiry.id, enquiry.notes]);

  async function addNote() {
    if (!note.trim()) return;
    setSending(true);
    try {
      await addEnquiryMessage({
        enquiry_id: enquiry.id,
        direction: "note",
        channel: "note",
        subject: "",
        body: note.trim(),
      });
      setNote("");
      setMessages(await loadEnquiryMessages(enquiry.id));
    } catch {
      /* no-op: shown empty */
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-md overflow-y-auto border-l border-cream/15 bg-ink p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2 className="font-display text-2xl">
            {enquiry.contact_name || enquiry.event_type || "Enquiry"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-cream/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-cream/70"
          >
            Close
          </button>
        </div>

        {/* Stage mover */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {STATUS_ORDER.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => onMove(enquiry.id, st)}
              className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition ${
                enquiry.status === st
                  ? "border-plonkTeal bg-plonkTeal/15 text-plonkTeal"
                  : "border-cream/15 text-cream/60 hover:border-cream/40"
              }`}
            >
              {STATUS_LABEL[st]}
            </button>
          ))}
        </div>

        <dl className="space-y-1.5 text-sm">
          <Row k="Email" v={enquiry.contact_email} />
          <Row k="Phone" v={enquiry.contact_phone} />
          <Row k="Wants" v={enquiry.event_type} />
          <Row
            k="Date"
            v={enquiry.requested_date || enquiry.date_flex || "—"}
          />
          <Row
            k="Party"
            v={enquiry.party_size ? `${enquiry.party_size}` : "—"}
          />
          <Row k="Budget" v={enquiry.budget} />
          <Row k="Source" v={SOURCE_LABEL[enquiry.source]} />
        </dl>

        <div className="mt-4">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-cream/55">
            Notes
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if (notes !== enquiry.notes) onSavedField({ notes });
            }}
            rows={3}
            className={inputCls}
          />
        </div>

        <div className="mt-4">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-cream/55">
            Thread
          </p>
          <div className="space-y-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className="rounded-lg border border-cream/10 bg-ink/40 p-2 text-xs"
              >
                <div className="mb-0.5 text-[10px] uppercase tracking-wider text-cream/40">
                  {m.direction} · {new Date(m.created_at).toLocaleString("en-GB")}
                </div>
                <div className="whitespace-pre-wrap text-cream/85">{m.body}</div>
              </div>
            ))}
            {messages.length === 0 && (
              <p className="text-[11px] text-cream/30">No notes yet.</p>
            )}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add an internal note…"
              className={inputCls}
            />
            <button
              type="button"
              onClick={addNote}
              disabled={sending}
              className="shrink-0 rounded-full bg-plonkTeal px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-ink disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onDelete}
          className="mt-6 text-[11px] font-bold uppercase tracking-wider text-red-400/70 hover:underline"
        >
          Delete enquiry
        </button>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-cream/20 bg-ink px-2.5 py-1.5 text-sm text-cream placeholder:text-cream/35";

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] text-cream/50">{label}</span>
      {children}
    </label>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return (
    <div className="flex gap-2">
      <dt className="w-16 shrink-0 text-[11px] uppercase tracking-wider text-cream/40">
        {k}
      </dt>
      <dd className="min-w-0 break-words text-cream/85">{v}</dd>
    </div>
  );
}
