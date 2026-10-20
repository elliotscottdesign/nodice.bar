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
import { createEvent } from "@/lib/db/eventsPlatform";

// Build a real calendar event from a confirmed enquiry and return its id. The
// event is created HIDDEN (not on the public calendar / bar page) with no
// bookings — the founder opens it in the Events admin to add artwork, tickets
// and flip it live. Category defaults to special_event (a party/one-off).
async function createEventFromEnquiry(e: Enquiry): Promise<string> {
  const ev = await createEvent({
    name: (e.event_type || e.contact_name || "Event").slice(0, 120),
    description: e.notes || null,
    external_link: null,
    poster_url: null,
    category: "special_event",
    subcategory: null,
    event_date: e.requested_date as string,
    start_time: null,
    end_time: null,
    recurrence_type: "none",
    recurrence_parent_id: null,
    recurrence_nth: null,
    recurrence_weekday: null,
    show_on_pool_schedule: false,
    show_on_events_calendar: false,
    show_on_bar_page: false,
    requires_ticket: false,
    bookable: false,
    max_attendees: e.party_size,
    registration_open: false,
    blocks_table_bookings: false,
  });
  return ev.id;
}
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

// A kitchen + bar pre-event brief, generated from what we know about the
// enquiry. Pure text so the office can read it, copy it to a staff WhatsApp,
// or print it. Lines we don't have yet (menu, allergens) are flagged as TO
// CONFIRM so nobody assumes they're sorted — the hub slice fills them in.
function buildBrief(e: Enquiry): string {
  const dateLine = e.requested_date
    ? new Date(e.requested_date + "T00:00:00").toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : e.date_flex || "TO CONFIRM";
  const head = e.party_size ? `${e.party_size} guests` : "TO CONFIRM";
  const L = (label: string, val: string) => `${label}: ${val || "—"}`;
  return [
    `NO DICE — PRE-EVENT BRIEF`,
    `${(e.event_type || "Private event").toUpperCase()}`,
    ``,
    L("Date", dateLine),
    L("Head count", head),
    L("Occasion", e.event_type),
    L("Lead contact", [e.contact_name, e.contact_phone].filter(Boolean).join(" · ")),
    L("Email", e.contact_email),
    L("Budget guide", e.budget),
    ``,
    `— KITCHEN —`,
    `Food order: TO CONFIRM (send the food-order form / attach the menu)`,
    `Allergens / dietary: TO CONFIRM`,
    `Service time: TO CONFIRM`,
    ``,
    `— BAR —`,
    `Drinks package / tab: TO CONFIRM`,
    `Arrival / setup: TO CONFIRM`,
    ``,
    `— NOTES —`,
    e.notes?.trim() || "(none)",
  ].join("\n");
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
    setErr("");
    try {
      const enq = enquiries.find((e) => e.id === id);
      // Confirming with a date + no event yet → auto-create the linked event
      // (founder: enquiries should flow into confirmed events automatically).
      if (
        status === "confirmed" &&
        enq &&
        enq.linked_kind !== "event" &&
        enq.requested_date
      ) {
        const eventId = await createEventFromEnquiry(enq);
        await updateEnquiry(id, {
          status,
          linked_kind: "event",
          linked_id: eventId,
        });
      } else {
        await setEnquiryStatus(id, status);
        if (status === "confirmed" && enq && !enq.requested_date) {
          setErr(
            "Confirmed — add a date in the enquiry to auto-create its event.",
          );
        }
      }
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

        {enquiry.linked_kind === "event" && enquiry.linked_id && (
          <a
            href="/admin/events"
            className="mb-4 flex items-center justify-between rounded-lg border border-plonkTeal/40 bg-plonkTeal/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-plonkTeal hover:bg-plonkTeal/20"
          >
            <span>✓ Linked event created</span>
            <span>Open in Events →</span>
          </a>
        )}

        <FulfilmentSection enquiry={enquiry} />

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

// Fulfilment — the "turn a confirmed enquiry into action" block. Slice 2
// starts with the kitchen/bar pre-event brief (self-contained, no external
// service). Payment link + food-order form email land here next.
function FulfilmentSection({ enquiry }: { enquiry: Enquiry }) {
  const [open, setOpen] = useState(enquiry.status === "confirmed");
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const brief = useMemo(() => buildBrief(enquiry), [enquiry]);

  // Client-facing summary link — only works once the enquiry is pencilled /
  // confirmed (the RPC won't return a 'new' or 'lost' one).
  const shareable =
    enquiry.status === "pencilled" || enquiry.status === "confirmed";
  const shareUrl =
    enquiry.share_token && typeof window !== "undefined"
      ? `${window.location.origin}/my-event?t=${encodeURIComponent(enquiry.share_token)}`
      : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(brief);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the textarea below is selectable as a fallback */
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-cream/15 bg-ink/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-cream/70"
      >
        <span>Fulfilment · kitchen + bar brief</span>
        <span className="text-cream/40">{open ? "–" : "+"}</span>
      </button>
      {open && (
        <div className="space-y-3 px-3 pb-3">
          {/* Shareable client summary link */}
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-cream/50">
              Client link
            </p>
            {shareable ? (
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-md border border-cream/15 bg-ink px-2.5 py-1.5 text-[11px] text-cream/75"
                />
                <button
                  type="button"
                  onClick={copyLink}
                  className="shrink-0 rounded-full border border-plonkTeal/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-plonkTeal transition hover:bg-plonkTeal/15"
                >
                  {linkCopied ? "Copied ✓" : "Copy link"}
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-cream/40">
                Pencil or confirm the enquiry to share a summary with the client.
              </p>
            )}
          </div>

          <p className="text-[10px] font-bold uppercase tracking-widest text-cream/50">
            Kitchen + bar brief
          </p>
          <textarea
            readOnly
            value={brief}
            rows={14}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full resize-y rounded-md border border-cream/15 bg-ink px-2.5 py-2 font-mono text-[11px] leading-relaxed text-cream/85"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copy}
              className="rounded-full bg-plonkTeal px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink transition hover:brightness-110"
            >
              {copied ? "Copied ✓" : "Copy brief"}
            </button>
            <span className="text-[10px] text-cream/40">
              Paste to the staff chat, or print for the pass.
            </span>
          </div>
        </div>
      )}
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
