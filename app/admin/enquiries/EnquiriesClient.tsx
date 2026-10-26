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
import { confirmDialog } from "@/lib/dialog";
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
  loadEnquiryActivity,
  archiveEnquiry,
  unarchiveEnquiry,
  type EnquiryActivity,
  createEnquiry,
  setEnquiryStatus,
  updateEnquiry,
  deleteEnquiry,
  loadEnquiryMessages,
  addEnquiryMessage,
  checkDateAvailability,
  type DayAvailability,
  createEnquiryPaymentLink,
  createEnquiryBooking,
  type NewBooking,
  sendEnquiryEmail,
  sendEnquiryReply,
  draftEnquiryReply,
  loadAiKnowledge,
  saveAiKnowledge,
  markEnquiryPaid,
  SOURCE_LABEL,
  STATUS_LABEL,
  STATUS_ORDER,
  type Enquiry,
  type EnquiryStatus,
  type EnquirySource,
  type EnquiryMessage,
  type LeadBucket,
  type EnquiryType,
  ENQUIRY_TYPE_LABEL,
} from "@/lib/db/enquiries";

function describe(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

// ---- Board helpers: timing, response-state, sorting, notes ----

// When the customer last contacted us (their latest inbound, or if we have no
// messages logged, when the enquiry first landed). This is "how long it's been
// sitting with us".
function arrivalOf(e: Enquiry, act?: EnquiryActivity): Date {
  const t = act?.lastIn || e.created_at;
  return new Date(t);
}

type Flags = {
  arrival: Date;
  responded: boolean; // we've replied since their last message
  owed: boolean; // open + their ball in our court → we owe a reply
  overdue: boolean; // owed + waiting > 24h → red clock
  today: boolean; // their latest contact (or arrival) was today
};

function flagsFor(e: Enquiry, act: EnquiryActivity | undefined, now: number): Flags {
  const lastIn = act?.lastIn ? new Date(act.lastIn).getTime() : null;
  const lastOut = act?.lastOut ? new Date(act.lastOut).getTime() : null;
  const arrival = arrivalOf(e, act);
  const responded = lastOut != null && (lastIn == null || lastOut >= lastIn);
  const open = e.status === "new" || e.status === "pencilled";
  const owed = open && !responded;
  const hrs = (now - arrival.getTime()) / 3_600_000;
  const overdue = owed && hrs >= 24;
  const today = sameDay(arrival.getTime(), now);
  return { arrival, responded, owed, overdue, today };
}

function sameDay(a: number, b: number): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

// Pull a number out of a free-text budget ("£1,500", "1k", "around 800") for
// sorting. Unknown → -1 so it sorts to the bottom.
function parseBudget(s: string): number {
  if (!s) return -1;
  const m = s.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*([kK])?/);
  if (!m) return -1;
  let n = parseFloat(m[1]);
  if (m[2]) n *= 1000;
  return isFinite(n) ? n : -1;
}

type SortKey = "newest" | "oldest" | "budget" | "size";
const SORT_LABEL: Record<SortKey, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  budget: "Biggest budget",
  size: "Biggest group",
};

function sortEnquiries(
  arr: Enquiry[],
  key: SortKey,
  act: Record<string, EnquiryActivity>,
): Enquiry[] {
  const copy = [...arr];
  copy.sort((a, b) => {
    switch (key) {
      case "oldest":
        return arrivalOf(a, act[a.id]).getTime() - arrivalOf(b, act[b.id]).getTime();
      case "budget":
        return parseBudget(b.budget) - parseBudget(a.budget);
      case "size":
        return (b.party_size ?? -1) - (a.party_size ?? -1);
      case "newest":
      default:
        return arrivalOf(b, act[b.id]).getTime() - arrivalOf(a, act[a.id]).getTime();
    }
  });
  return copy;
}

// Notes → bullet points. Split on newlines; if it's one long blob, split on
// sentence ends too. Strip any existing "- "/"• " markers.
function toBullets(text: string): string[] {
  const raw = (text || "").trim();
  if (!raw) return [];
  let parts = raw.split(/\r?\n+/).map((l) => l.trim()).filter(Boolean);
  if (parts.length === 1) {
    parts = parts[0].split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((s) => s.trim()).filter(Boolean);
  }
  return parts.map((p) => p.replace(/^[-•*]\s*/, "")).filter(Boolean);
}

const STAGE_CAPTION: Record<EnquiryStatus, string> = {
  new: "Just in — not actioned",
  pencilled: "Replied / provisionally held",
  confirmed: "Booked — becoming an event",
  lost: "Didn't go ahead",
};

// Small inline icons (no icon-lib dependency). currentColor so they tint.
function ClockIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function MailIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}
function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
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
  const [bucket, setBucket] = useState<LeadBucket>("venue");
  const [typeFilter, setTypeFilter] = useState<EnquiryType | "all">("all");
  const [aiOpen, setAiOpen] = useState(false);
  const [activity, setActivity] = useState<Record<string, EnquiryActivity>>({});
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [onlyOwed, setOnlyOwed] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [undo, setUndo] = useState<{ id: string; name: string } | null>(null);
  // Re-evaluate "today / overdue" against a clock that ticks each minute.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [list, act] = await Promise.all([
        loadEnquiries({ archived: showArchived }),
        loadEnquiryActivity().catch(() => ({})),
      ]);
      setEnquiries(list);
      setActivity(act);
    } catch (e) {
      setErr(describe(e, "Couldn't load enquiries."));
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    reload();
  }, [reload]);

  const bucketCounts = useMemo(() => {
    let venue = 0;
    let wacky = 0;
    for (const e of enquiries) {
      if ((e.lead_bucket || "venue") === "wacky_works") wacky++;
      else venue++;
    }
    return { venue, wacky };
  }, [enquiries]);

  const byStatus = useMemo(() => {
    const m: Record<EnquiryStatus, Enquiry[]> = {
      new: [],
      pencilled: [],
      confirmed: [],
      lost: [],
    };
    for (const e of enquiries) {
      if ((e.lead_bucket || "venue") !== bucket) continue;
      if (typeFilter !== "all" && (e.enquiry_type || "other") !== typeFilter)
        continue;
      if (onlyOwed && !flagsFor(e, activity[e.id], nowMs).owed) continue;
      m[e.status].push(e);
    }
    // Newest-first by default; "Must respond" surfaces the longest-waiting first.
    const key: SortKey = onlyOwed ? "oldest" : sortBy;
    for (const st of STATUS_ORDER) m[st] = sortEnquiries(m[st], key, activity);
    return m;
  }, [enquiries, bucket, typeFilter, onlyOwed, sortBy, activity, nowMs]);

  // How many open enquiries we owe a reply on, in this bucket (the badge count).
  const owedCount = useMemo(() => {
    let n = 0;
    for (const e of enquiries) {
      if ((e.lead_bucket || "venue") !== bucket) continue;
      if (flagsFor(e, activity[e.id], nowMs).owed) n++;
    }
    return n;
  }, [enquiries, bucket, activity, nowMs]);

  async function archiveOne(e: Enquiry) {
    setEnquiries((prev) => prev.filter((x) => x.id !== e.id)); // optimistic
    setUndo({ id: e.id, name: e.contact_name || e.event_type || "enquiry" });
    try {
      await archiveEnquiry(e.id);
    } catch (err) {
      setErr(describe(err, "Couldn't archive."));
      await reload();
    }
  }
  async function restoreOne(id: string) {
    try {
      await unarchiveEnquiry(id);
      setUndo(null);
      await reload();
    } catch (err) {
      setErr(describe(err, "Couldn't restore."));
    }
  }

  // Type counts within the current bucket, for the filter chips.
  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of enquiries) {
      if ((e.lead_bucket || "venue") !== bucket) continue;
      const k = e.enquiry_type || "other";
      c[k] = (c[k] || 0) + 1;
    }
    return c;
  }, [enquiries, bucket]);

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
            Every lead in one place. <b className="text-cream/75">New</b> = just
            in, not actioned · <b className="text-cream/75">Pencilled</b> =
            replied / holding a date · <b className="text-cream/75">Confirmed</b>{" "}
            = booked (becomes a real event) · <b className="text-cream/75">Lost</b>{" "}
            = didn’t go ahead. The red <ClockIcon className="inline" /> clock
            means it’s been waiting over 24h for a reply.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAiOpen((v) => !v)}
            className="rounded-full border border-cream/25 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cream/70 transition hover:border-cream/50"
          >
            {aiOpen ? "Close" : "✨ AI knowledge"}
          </button>
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="rounded-full bg-plonkTeal px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink transition hover:brightness-110"
          >
            {creating ? "Close" : "+ New enquiry"}
          </button>
        </div>
      </div>

      {aiOpen && <AiKnowledgeEditor />}

      {/* Pipeline switch: normal venue enquiries vs Wacky Works course-builds */}
      <div className="flex items-center gap-2">
        {(
          [
            ["venue", "Venue enquiries", bucketCounts.venue],
            ["wacky_works", "Wacky Works (course builds)", bucketCounts.wacky],
          ] as [LeadBucket, string, number][]
        ).map(([b, label, count]) => (
          <button
            key={b}
            type="button"
            onClick={() => setBucket(b)}
            className={`rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
              bucket === b
                ? "border-plonkTeal bg-plonkTeal/15 text-plonkTeal"
                : "border-cream/15 text-cream/55 hover:border-cream/40"
            }`}
          >
            {label}{" "}
            <span className="ml-1 opacity-60">{count}</span>
          </button>
        ))}
      </div>

      {/* Type filter — only the types present in this bucket */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setTypeFilter("all")}
          className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
            typeFilter === "all"
              ? "border-cream/60 bg-cream/10 text-cream"
              : "border-cream/15 text-cream/50 hover:border-cream/40"
          }`}
        >
          All types
        </button>
        {(Object.keys(ENQUIRY_TYPE_LABEL) as EnquiryType[])
          .filter((ty) => (typeCounts[ty] || 0) > 0)
          .map((ty) => (
            <button
              key={ty}
              type="button"
              onClick={() => setTypeFilter(ty)}
              className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                typeFilter === ty
                  ? "border-cream/60 bg-cream/10 text-cream"
                  : "border-cream/15 text-cream/50 hover:border-cream/40"
              }`}
            >
              {ENQUIRY_TYPE_LABEL[ty]}{" "}
              <span className="opacity-60">{typeCounts[ty]}</span>
            </button>
          ))}
      </div>

      {/* Controls: must-respond, sort, archived view */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setOnlyOwed((v) => !v);
            setShowArchived(false);
          }}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
            onlyOwed
              ? "border-red-500 bg-red-500/15 text-red-400"
              : "border-cream/15 text-cream/55 hover:border-cream/40"
          }`}
          title="Only enquiries waiting on a reply from us"
        >
          <ClockIcon /> Must respond
          <span className={onlyOwed ? "text-red-300" : "text-cream/40"}>
            {owedCount}
          </span>
        </button>

        <label className="inline-flex items-center gap-1.5 rounded-full border border-cream/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cream/55">
          <span className="opacity-60">Sort</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            disabled={onlyOwed}
            className="bg-transparent text-cream outline-none disabled:opacity-40"
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <option key={k} value={k} className="bg-ink text-cream">
                {SORT_LABEL[k]}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => {
            setShowArchived((v) => !v);
            setOnlyOwed(false);
          }}
          className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
            showArchived
              ? "border-plonkYellow bg-plonkYellow/15 text-plonkYellow"
              : "border-cream/15 text-cream/55 hover:border-cream/40"
          }`}
        >
          {showArchived ? "← Back to live" : "Archived"}
        </button>

        {showArchived && (
          <span className="text-[10px] uppercase tracking-wider text-cream/40">
            Ignored / not-relevant — ↩ on a card to restore it
          </span>
        )}
      </div>

      {undo && !showArchived && (
        <div className="flex items-center justify-between rounded-lg border border-cream/15 bg-ink/50 px-3 py-2 text-xs text-cream/70">
          <span>Archived “{undo.name}”.</span>
          <button
            type="button"
            onClick={() => restoreOne(undo.id)}
            className="font-bold uppercase tracking-wider text-plonkTeal hover:underline"
          >
            Undo
          </button>
        </div>
      )}

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
              <div className="mb-2 px-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-cream/70">
                    {STATUS_LABEL[st]}
                  </span>
                  <span className="text-[11px] text-cream/40">
                    {byStatus[st].length}
                  </span>
                </div>
                <p className="mt-0.5 text-[9px] uppercase tracking-wider text-cream/30">
                  {STAGE_CAPTION[st]}
                </p>
              </div>
              <div className="space-y-2">
                {byStatus[st].map((e) => {
                  const f = flagsFor(e, activity[e.id], nowMs);
                  return (
                    <div
                      key={e.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setOpenId(e.id)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter" || ev.key === " ") {
                          ev.preventDefault();
                          setOpenId(e.id);
                        }
                      }}
                      className={`group relative block w-full cursor-pointer rounded-lg border bg-ink/50 p-2.5 text-left transition hover:border-cream/40 ${
                        f.overdue ? "border-red-500/60" : STATUS_STYLE[e.status]
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold text-cream">
                            {e.contact_name || e.event_type || "Untitled enquiry"}
                          </div>
                          {e.event_type && e.contact_name && (
                            <div className="truncate text-[11px] text-cream/60">
                              {e.event_type}
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {/* came in today */}
                          {f.today && !showArchived && (
                            <span
                              title="Came in today"
                              className="inline-flex items-center gap-0.5 rounded bg-plonkTeal/20 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-plonkTeal"
                            >
                              <MailIcon /> Today
                            </span>
                          )}
                          {/* >24h with no reply from us */}
                          {f.overdue && (
                            <span title="Waiting over 24h — needs a reply" className="text-red-500">
                              <ClockIcon />
                            </span>
                          )}
                          {/* we've replied */}
                          {f.responded && !f.overdue && (
                            <span title="We've replied" className="text-plonkTeal/70">
                              <CheckIcon />
                            </span>
                          )}
                          {/* archive / restore */}
                          <button
                            type="button"
                            title={showArchived ? "Restore to the board" : "Ignore / archive"}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              if (showArchived) restoreOne(e.id);
                              else archiveOne(e);
                            }}
                            className="rounded p-0.5 text-cream/30 opacity-0 transition hover:bg-cream/10 hover:text-cream/80 focus:opacity-100 group-hover:opacity-100"
                          >
                            {showArchived ? (
                              <span className="text-xs leading-none">↩</span>
                            ) : (
                              <span className="text-xs leading-none">✕</span>
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-wider text-cream/45">
                        {e.enquiry_type && e.enquiry_type !== "other" && (
                          <span className="rounded border border-cream/20 px-1.5 py-0.5 font-bold text-cream/70">
                            {ENQUIRY_TYPE_LABEL[e.enquiry_type]}
                          </span>
                        )}
                        {e.requested_date && <span>{e.requested_date}</span>}
                        {e.party_size ? <span>· {e.party_size}p</span> : null}
                        {e.budget ? <span>· {e.budget}</span> : null}
                        <span>· {SOURCE_LABEL[e.source]}</span>
                      </div>
                      {/* response state line */}
                      {!showArchived && (e.status === "new" || e.status === "pencilled") && (
                        <div className="mt-1 text-[9px] font-bold uppercase tracking-wider">
                          {f.overdue ? (
                            <span className="text-red-400">● Needs a reply</span>
                          ) : f.owed ? (
                            <span className="text-plonkYellow">● Awaiting our reply</span>
                          ) : (
                            <span className="text-plonkTeal/70">● Replied</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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
          onReload={reload}
          onSavedField={async (patch) => {
            try {
              await updateEnquiry(open.id, patch);
              await reload();
            } catch (e) {
              setErr(describe(e, "Couldn't save."));
            }
          }}
          onDelete={async () => {
            if (
              !(await confirmDialog(
                "Delete this enquiry? This can't be undone.",
              ))
            )
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

// The knowledge the "Draft with AI" button reads — venue facts, prices, golf
// FAQs, house style. Editable here so the office keeps the AI accurate.
function AiKnowledgeEditor() {
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    loadAiKnowledge()
      .then((v) => setText(v))
      .catch(() => setText(""))
      .finally(() => setLoaded(true));
  }, []);

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      await saveAiKnowledge(text);
      setMsg("Saved — the AI will use this from now on.");
    } catch (e) {
      setMsg(describe(e, "Couldn't save."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-cream/15 bg-ink/40 p-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-cream/70">
        AI knowledge
      </p>
      <p className="mt-1 max-w-2xl text-xs text-cream/55">
        What the <span className="text-plonkTeal">✨ Draft with AI</span> button
        knows when it writes a reply — venue facts, prices, golf FAQs, house
        style. Keep it accurate; the AI never invents prices or dates it isn’t
        given here (it leaves a [bracket] for you instead).
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        disabled={!loaded}
        placeholder={loaded ? "" : "Loading…"}
        className={`${inputCls} mt-3 font-mono text-xs leading-relaxed`}
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || !loaded}
          className="rounded-full bg-plonkTeal px-5 py-2 text-xs font-bold uppercase tracking-wider text-ink transition hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save knowledge"}
        </button>
        {msg && <span className="text-[10px] text-cream/50">{msg}</span>}
      </div>
    </div>
  );
}

function EnquiryDrawer({
  enquiry,
  onClose,
  onMove,
  onReload,
  onSavedField,
  onDelete,
}: {
  enquiry: Enquiry;
  onClose: () => void;
  onMove: (id: string, status: EnquiryStatus) => void;
  onReload: () => Promise<void>;
  onSavedField: (patch: Record<string, unknown>) => Promise<void>;
  onDelete: () => void;
}) {
  const [messages, setMessages] = useState<EnquiryMessage[]>([]);
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState(enquiry.notes);
  const [editNotes, setEditNotes] = useState(false);
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyMsg, setReplyMsg] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [avail, setAvail] = useState<DayAvailability | null>(null);

  useEffect(() => {
    setAvail(null);
    const iso = enquiry.requested_date;
    if (!iso) return;
    let live = true;
    checkDateAvailability(iso)
      .then((a) => live && setAvail(a))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [enquiry.requested_date]);
  const canReply = /\S+@\S+\.\S+/.test(enquiry.contact_email || "");

  async function sendReply() {
    if (!reply.trim()) return;
    setReplyBusy(true);
    setReplyMsg("");
    try {
      const r = await sendEnquiryReply(enquiry.id, reply.trim());
      setReply("");
      setReplyMsg(`Sent to ${r.sent_to}`);
      setMessages(await loadEnquiryMessages(enquiry.id));
    } catch (e) {
      setReplyMsg(describe(e, "Couldn't send the reply."));
    } finally {
      setReplyBusy(false);
    }
  }

  async function draftWithAi() {
    setAiBusy(true);
    setReplyMsg("");
    try {
      const r = await draftEnquiryReply(enquiry.id);
      setReply(r.draft);
      setReplyMsg("AI draft ready — read it over, edit, then send.");
    } catch (e) {
      setReplyMsg(describe(e, "Couldn't draft a reply."));
    } finally {
      setAiBusy(false);
    }
  }

  useEffect(() => {
    setNotes(enquiry.notes);
    setEditNotes(false);
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

        {/* Pipeline bucket — venue vs Wacky Works course-build. Lets staff
            fix a mis-routed lead. */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-cream/45">
            Pipeline
          </span>
          {(
            [
              ["venue", "Venue"],
              ["wacky_works", "Wacky Works"],
            ] as [LeadBucket, string][]
          ).map(([b, label]) => (
            <button
              key={b}
              type="button"
              onClick={() => {
                if ((enquiry.lead_bucket || "venue") !== b)
                  onSavedField({ lead_bucket: b });
              }}
              className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition ${
                (enquiry.lead_bucket || "venue") === b
                  ? "border-plonkYellow bg-plonkYellow/15 text-plonkYellow"
                  : "border-cream/15 text-cream/55 hover:border-cream/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Type tag — auto-set, overridable */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-cream/45">
            Type
          </span>
          <select
            value={enquiry.enquiry_type || "other"}
            onChange={(e) => onSavedField({ enquiry_type: e.target.value })}
            className="rounded-md border border-cream/20 bg-ink px-2 py-1 text-xs text-cream"
          >
            {(Object.keys(ENQUIRY_TYPE_LABEL) as EnquiryType[]).map((ty) => (
              <option key={ty} value={ty}>
                {ENQUIRY_TYPE_LABEL[ty]}
              </option>
            ))}
          </select>
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

        <FulfilmentSection enquiry={enquiry} onReload={onReload} />

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

        {/* Calendar availability for the requested date */}
        {enquiry.requested_date && avail && (
          <div
            className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
              avail.busy
                ? "border-plonkYellow/40 bg-plonkYellow/10"
                : "border-plonkTeal/40 bg-plonkTeal/10"
            }`}
          >
            <div className="font-bold uppercase tracking-wider">
              {avail.busy ? "⚠ That date's getting busy" : "✓ That date looks free"}
            </div>
            <div className="mt-1 text-cream/70">
              {avail.tableCount
                ? `${avail.tableCount} table booking${avail.tableCount > 1 ? "s" : ""} (${avail.tableCovers} covers)`
                : "No table bookings"}
              {avail.poolCount ? ` · ${avail.poolCount} pool` : ""}
              {avail.events.length
                ? ` · On: ${avail.events.slice(0, 3).join(", ")}`
                : ""}
            </div>
          </div>
        )}

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-widest text-cream/55">
              Notes
            </p>
            <button
              type="button"
              onClick={() => {
                if (editNotes && notes !== enquiry.notes) onSavedField({ notes });
                setEditNotes((v) => !v);
              }}
              className="text-[10px] font-bold uppercase tracking-wider text-plonkTeal/80 hover:underline"
            >
              {editNotes ? "Done" : "Edit"}
            </button>
          </div>
          {editNotes ? (
            <>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => {
                  if (notes !== enquiry.notes) onSavedField({ notes });
                }}
                rows={4}
                placeholder="One point per line…"
                className={inputCls}
              />
              <p className="mt-1 text-[9px] text-cream/35">
                One point per line — they show as bullets.
              </p>
            </>
          ) : toBullets(notes).length ? (
            <ul className="space-y-1">
              {toBullets(notes).map((b, i) => (
                <li key={i} className="flex gap-1.5 text-sm text-cream/85">
                  <span className="text-plonkTeal/70">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-cream/35">No notes yet — tap Edit to add.</p>
          )}
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
                  <span
                    className={
                      m.direction === "out"
                        ? "text-plonkTeal/80"
                        : m.direction === "in"
                          ? "text-plonkYellow"
                          : "text-cream/50"
                    }
                  >
                    {m.direction === "out"
                      ? "No Dice"
                      : m.direction === "in"
                        ? "Customer"
                        : "Note"}
                  </span>{" "}
                  · {new Date(m.created_at).toLocaleString("en-GB")}
                </div>
                <div className="whitespace-pre-wrap text-cream/85">{m.body}</div>
              </div>
            ))}
            {messages.length === 0 && (
              <p className="text-[11px] text-cream/30">No notes yet.</p>
            )}
          </div>
          {/* Reply to the client — emails them + logs on the thread */}
          <div className="mt-3 rounded-lg border border-plonkTeal/25 bg-plonkTeal/5 p-2.5">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-plonkTeal/80">
              Reply to client
            </p>
            {canReply ? (
              <>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  placeholder={`Write to ${(enquiry.contact_name || "the client").split(" ")[0]}… (emails them from info@nodice.bar)`}
                  className={inputCls}
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={draftWithAi}
                    disabled={aiBusy || replyBusy}
                    className="rounded-full border border-plonkTeal/50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-plonkTeal transition hover:bg-plonkTeal/10 disabled:opacity-40"
                  >
                    {aiBusy ? "Drafting…" : "✨ Draft with AI"}
                  </button>
                  <button
                    type="button"
                    onClick={sendReply}
                    disabled={replyBusy || aiBusy || !reply.trim()}
                    className="rounded-full bg-plonkTeal px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink transition hover:brightness-110 disabled:opacity-40"
                  >
                    {replyBusy ? "Sending…" : "Send reply"}
                  </button>
                  {replyMsg && (
                    <span className="text-[10px] text-cream/50">{replyMsg}</span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-[10px] text-cream/40">
                No email on this enquiry to reply to.
              </p>
            )}
          </div>

          {/* Internal note — team-only, never emailed */}
          <div className="mt-2 flex gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add an internal note (team only)…"
              className={inputCls}
            />
            <button
              type="button"
              onClick={addNote}
              disabled={sending}
              className="shrink-0 rounded-full border border-cream/25 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/70 disabled:opacity-40"
            >
              Note
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

// Fulfilment — the "turn a confirmed enquiry into action" block:
//  • Payment: office types the full amount → one-click Stripe payment link.
//  • Email: one-click branded email to the client (summary link + pay link).
//  • Kitchen/bar pre-event brief (copy/print).
//  • Shareable client summary link.
function FulfilmentSection({
  enquiry,
  onReload,
}: {
  enquiry: Enquiry;
  onReload: () => Promise<void>;
}) {
  const [open, setOpen] = useState(enquiry.status === "confirmed");
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [payCopied, setPayCopied] = useState(false);
  const [amountStr, setAmountStr] = useState("");
  const [payBusy, setPayBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [fMsg, setFMsg] = useState("");
  const [fErr, setFErr] = useState("");
  const [bKind, setBKind] = useState<NewBooking["kind"]>("table");
  const [bDate, setBDate] = useState(enquiry.requested_date || "");
  const [bTime, setBTime] = useState("18:00");
  const [bDuration, setBDuration] = useState("120");
  const [bParty, setBParty] = useState(
    enquiry.party_size ? String(enquiry.party_size) : "",
  );
  const [bAmount, setBAmount] = useState("");
  const [bBusy, setBBusy] = useState(false);
  const brief = useMemo(() => buildBrief(enquiry), [enquiry]);

  async function createBooking() {
    const party = Number(bParty);
    if (!bDate || !/^\d{2}:\d{2}$/.test(bTime) || !party) {
      setFErr("Booking needs a date, a time (HH:MM) and party size.");
      return;
    }
    setBBusy(true);
    setFErr("");
    setFMsg("");
    try {
      const r = await createEnquiryBooking(enquiry.id, {
        kind: bKind,
        reservation_date: bDate,
        start_time: bTime,
        duration_minutes: Number(bDuration) || 120,
        party_size: party,
        amount_pence: bAmount ? Math.round(Number(bAmount) * 100) : undefined,
      });
      setFMsg(
        r.warning
          ? r.warning
          : `Booking created${r.pay_url ? " + payment link ready" : ""}. Now send the confirmation email.`,
      );
      await onReload();
    } catch (e) {
      setFErr(describe(e, "Couldn't create the booking."));
    } finally {
      setBBusy(false);
    }
  }

  const hasEmail = /\S+@\S+\.\S+/.test(enquiry.contact_email || "");

  async function createLink() {
    const pounds = Number(amountStr);
    if (!Number.isFinite(pounds) || pounds < 1) {
      setFErr("Enter the full amount in pounds (at least £1).");
      return;
    }
    setPayBusy(true);
    setFErr("");
    setFMsg("");
    try {
      await createEnquiryPaymentLink(
        enquiry.id,
        Math.round(pounds * 100),
        enquiry.event_type || undefined,
      );
      setAmountStr("");
      await onReload();
    } catch (e) {
      setFErr(describe(e, "Couldn't create the payment link."));
    } finally {
      setPayBusy(false);
    }
  }

  async function emailClient() {
    setEmailBusy(true);
    setFErr("");
    setFMsg("");
    try {
      const r = await sendEnquiryEmail(enquiry.id);
      setFMsg(`Emailed ${r.sent_to}.`);
      await onReload();
    } catch (e) {
      setFErr(describe(e, "Couldn't send the email."));
    } finally {
      setEmailBusy(false);
    }
  }

  async function markPaid(method: "bar" | "comp") {
    setFErr("");
    setFMsg("");
    try {
      await markEnquiryPaid(enquiry, method);
      setFMsg(method === "comp" ? "Marked comped (free)." : "Marked paid.");
      await onReload();
    } catch (e) {
      setFErr(describe(e, "Couldn't update payment status."));
    }
  }

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

  async function copyPay() {
    try {
      await navigator.clipboard.writeText(enquiry.payment_url);
      setPayCopied(true);
      setTimeout(() => setPayCopied(false), 1800);
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
          {(fMsg || fErr) && (
            <p
              className={`text-[11px] ${fErr ? "text-red-400" : "text-plonkTeal"}`}
            >
              {fErr || fMsg}
            </p>
          )}

          {/* Add booking — writes a real reservation + (optional) pay link */}
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-cream/50">
              Add booking
            </p>
            {enquiry.linked_kind === "booking" && enquiry.linked_id ? (
              <a
                href="/admin/table-reservations"
                className="flex items-center justify-between rounded-lg border border-plonkTeal/40 bg-plonkTeal/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-plonkTeal hover:bg-plonkTeal/20"
              >
                <span>✓ Booking created — slot held</span>
                <span>Open bookings →</span>
              </a>
            ) : (
              <div className="space-y-2 rounded-lg border border-cream/15 bg-ink/40 p-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={bKind}
                    onChange={(e) => setBKind(e.target.value as NewBooking["kind"])}
                    className={inputCls}
                  >
                    <option value="table">Table</option>
                    <option value="pool">Pool</option>
                    <option value="golf">Golf</option>
                    <option value="private_hire">Private hire</option>
                  </select>
                  <input
                    value={bParty}
                    onChange={(e) => setBParty(e.target.value)}
                    inputMode="numeric"
                    placeholder="Party size"
                    className={inputCls}
                  />
                  <DatePickerInput value={bDate} onChange={setBDate} />
                  <input
                    value={bTime}
                    onChange={(e) => setBTime(e.target.value)}
                    placeholder="Time (18:00)"
                    className={inputCls}
                  />
                  <input
                    value={bDuration}
                    onChange={(e) => setBDuration(e.target.value)}
                    inputMode="numeric"
                    placeholder="Mins (120)"
                    className={inputCls}
                  />
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-cream/50">
                      £
                    </span>
                    <input
                      value={bAmount}
                      onChange={(e) => setBAmount(e.target.value)}
                      inputMode="decimal"
                      placeholder="Amount (opt.)"
                      className="w-full rounded-md border border-cream/20 bg-ink py-1.5 pl-6 pr-2.5 text-sm text-cream placeholder:text-cream/35"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={createBooking}
                  disabled={bBusy}
                  className="w-full rounded-full bg-plonkTeal px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink transition hover:brightness-110 disabled:opacity-40"
                >
                  {bBusy ? "Creating…" : "Create booking"}
                </button>
                <p className="text-[10px] text-cream/40">
                  Writes a real reservation (holds the slot) + a pay link if you
                  add an amount. Then send the confirmation email below.
                </p>
              </div>
            )}
          </div>

          {/* Payment — full amount, office-entered, one-click Stripe link */}
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-cream/50">
              Payment
            </p>
            {/* Paid status + manual settle (bar / comp) — always available */}
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
              {enquiry.paid_at ? (
                <span className="font-bold uppercase tracking-wider text-plonkTeal">
                  Paid ✓ {new Date(enquiry.paid_at).toLocaleDateString("en-GB")}
                </span>
              ) : (
                <>
                  <span className="text-cream/45">Not paid —</span>
                  <button
                    type="button"
                    onClick={() => markPaid("bar")}
                    className="rounded-full border border-plonkTeal/60 px-3 py-1 font-bold uppercase tracking-wider text-plonkTeal transition hover:bg-plonkTeal/15"
                  >
                    Mark paid (at bar)
                  </button>
                  <button
                    type="button"
                    onClick={() => markPaid("comp")}
                    className="rounded-full border border-cream/20 px-3 py-1 font-bold uppercase tracking-wider text-cream/55 transition hover:text-cream"
                  >
                    Comp (free)
                  </button>
                </>
              )}
            </div>
            {enquiry.payment_url ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={enquiry.payment_url}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-md border border-cream/15 bg-ink px-2.5 py-1.5 text-[11px] text-cream/75"
                  />
                  <button
                    type="button"
                    onClick={copyPay}
                    className="shrink-0 rounded-full border border-plonkTeal/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-plonkTeal transition hover:bg-plonkTeal/15"
                  >
                    {payCopied ? "Copied ✓" : "Copy"}
                  </button>
                </div>
                <div className="text-[11px] text-cream/60">
                  {enquiry.amount_pence
                    ? `£${(enquiry.amount_pence / 100).toFixed(2).replace(/\.00$/, "")} payment link`
                    : "Payment link"}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-cream/50">
                    £
                  </span>
                  <input
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    inputMode="decimal"
                    placeholder="Full amount"
                    className="w-full rounded-md border border-cream/20 bg-ink py-1.5 pl-6 pr-2.5 text-sm text-cream placeholder:text-cream/35"
                  />
                </div>
                <button
                  type="button"
                  onClick={createLink}
                  disabled={payBusy}
                  className="shrink-0 rounded-full bg-plonkTeal px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink transition hover:brightness-110 disabled:opacity-40"
                >
                  {payBusy ? "…" : "Create link"}
                </button>
              </div>
            )}
          </div>

          {/* Email the client — one-click (staff review, then fire) */}
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-cream/50">
              Email client
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={emailClient}
                disabled={emailBusy || !hasEmail}
                className="rounded-full bg-plonkTeal px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink transition hover:brightness-110 disabled:opacity-40"
              >
                {emailBusy ? "Sending…" : "Send client email"}
              </button>
              <span className="text-[10px] text-cream/40">
                {!hasEmail
                  ? "No email on this enquiry."
                  : enquiry.last_emailed_at
                    ? `Last sent ${new Date(enquiry.last_emailed_at).toLocaleDateString("en-GB")}`
                    : "Sends their summary" +
                      (enquiry.payment_url ? " + pay link." : ".")}
              </span>
            </div>
          </div>

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
