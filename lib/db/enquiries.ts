"use client";

import { supabase } from "@/lib/supabase";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/stripe";

// =============================================================
// enquiries — the CRM pipeline spine
// =============================================================
// An enquiry (party booker form, email, bar staff, later IG/FB) moves through
// new → pencilled → confirmed → lost. On confirm it links to the real thing it
// became (an event / tournament / booking). A comms thread hangs off each one.
// Reads/writes the `enquiries` + `enquiry_messages` tables (migration
// 20261020000001). The rest of the CRM READS existing event/booking sources —
// this is the only new store.
// =============================================================

export type EnquirySource =
  | "party_form"
  | "email"
  | "bar_staff"
  | "phone"
  | "instagram"
  | "facebook"
  | "other";

export type EnquiryStatus = "new" | "pencilled" | "confirmed" | "lost";
export type LinkedKind = "event" | "tournament" | "booking" | "";
// Which pipeline a lead belongs to. 'venue' = normal party/booking enquiries;
// 'wacky_works' = B2B mini-golf course-build leads (the founder's separate
// design/build company) — kept separable so they can be lifted out later.
export type LeadBucket = "venue" | "wacky_works";

// A single "what is it" tag for filtering the board.
export type EnquiryType =
  | "party" | "pool" | "golf" | "ping_pong" | "table" | "private_hire"
  | "corporate" | "kids" | "dj" | "tournament" | "fundraiser" | "other";

export const ENQUIRY_TYPE_LABEL: Record<EnquiryType, string> = {
  party: "Party",
  pool: "Pool",
  golf: "Golf",
  ping_pong: "Ping Pong",
  table: "Table",
  private_hire: "Private hire",
  corporate: "Corporate",
  kids: "Kids",
  dj: "DJ",
  tournament: "Tournament",
  fundraiser: "Fundraiser",
  other: "Other",
};

// Activity-first auto-tag. Mirrors classifyType() in the email-enquiry fn.
export function classifyEnquiryType(text: string): EnquiryType {
  const t = (text || "").toLowerCase();
  if (/ping[\s-]?pong|table tennis/.test(t)) return "ping_pong";
  if (/\bpool\b|pool table|pool comp/.test(t)) return "pool";
  if (/crazy golf|mini[\s-]?golf|\bgolf\b|golf course/.test(t)) return "golf";
  if (/tournament|competition|\bcomp\b|\bleague\b/.test(t)) return "tournament";
  if (/\bdj\b|dj set|decks|djing/.test(t)) return "dj";
  if (/fundrais|charity|raffle|donation/.test(t)) return "fundraiser";
  if (/\bkids?\b|children|\bchild\b/.test(t)) return "kids";
  if (/corporate|work do|work social|team building|team-building|office party|colleagues/.test(t)) return "corporate";
  if (/private hire|exclusive hire|whole venue|venue hire|private event|exclusive use/.test(t)) return "private_hire";
  if (/\bparty\b|birthday|celebrat|hen do|stag do|\bhen\b|\bstag\b|anniversary|leaving do/.test(t)) return "party";
  if (/\btable\b|dinner|drinks|reservation|book a table|group booking/.test(t)) return "table";
  return "other";
}

export type Enquiry = {
  id: string;
  source: EnquirySource;
  status: EnquiryStatus;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  event_type: string;
  party_size: number | null;
  requested_date: string | null;
  date_flex: string;
  budget: string;
  notes: string;
  assigned_to: string;
  linked_kind: LinkedKind;
  linked_id: string;
  share_token: string;
  amount_pence: number | null;
  payment_url: string;
  paid_at: string | null;
  last_emailed_at: string | null;
  lead_bucket: LeadBucket;
  enquiry_type: EnquiryType | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

// Per-enquiry comms activity (from the enquiry_activity() RPC, aggregated
// server-side). Used by the board to show replied / overdue / came-in-today
// without loading every message. Keyed by enquiry id.
export type EnquiryActivity = {
  lastIn: string | null;
  lastOut: string | null;
  msgCount: number;
};

// The safe, client-facing projection returned by the share link (no email,
// phone, budget or internal notes — see the enquiry_client_summary RPC).
export type EnquiryClientSummary = {
  contact_name: string;
  event_type: string;
  status: EnquiryStatus;
  requested_date: string | null;
  date_flex: string;
  party_size: number | null;
};

export type NewEnquiry = Partial<
  Omit<Enquiry, "id" | "created_at" | "updated_at">
>;

export type EnquiryMessage = {
  id: string;
  enquiry_id: string;
  direction: "in" | "out" | "note";
  channel: "email" | "sms" | "note" | "phone";
  subject: string;
  body: string;
  created_at: string;
};

const SELECT =
  "id, source, status, contact_name, contact_email, contact_phone, event_type, party_size, requested_date, date_flex, budget, notes, assigned_to, linked_kind, linked_id, share_token, amount_pence, payment_url, paid_at, last_emailed_at, lead_bucket, enquiry_type, archived_at, created_at, updated_at";

export const SOURCE_LABEL: Record<EnquirySource, string> = {
  party_form: "Party form",
  email: "Email",
  bar_staff: "Bar / staff",
  phone: "Phone",
  instagram: "Instagram",
  facebook: "Facebook",
  other: "Other",
};

export const STATUS_LABEL: Record<EnquiryStatus, string> = {
  new: "New",
  pencilled: "Pencilled",
  confirmed: "Confirmed",
  lost: "Lost",
};

// Pipeline order for the board columns.
export const STATUS_ORDER: EnquiryStatus[] = [
  "new",
  "pencilled",
  "confirmed",
  "lost",
];

// ---- Calendar availability check ----
// What's already on a given date, so the office (and later the AI) can answer
// "is that date free?" at a glance. Reads table/pool reservations + events.
export type DayAvailability = {
  date: string;
  tableCount: number;
  tableCovers: number;
  poolCount: number;
  events: string[];
  busy: boolean;
};

export async function checkDateAvailability(
  iso: string,
): Promise<DayAvailability> {
  const db = supabase();
  const next = new Date(iso + "T00:00:00");
  next.setDate(next.getDate() + 1);
  const nextIso = next.toISOString().slice(0, 10);
  const [res, ev] = await Promise.all([
    db
      .from("bar_reservations")
      .select("kind,party_size,status")
      .gte("reservation_date", iso)
      .lt("reservation_date", nextIso),
    db
      .from("events")
      .select("name")
      .gte("event_date", iso)
      .lt("event_date", nextIso),
  ]);
  const rows = (res.data ?? []).filter(
    (r: { status?: string }) => r.status !== "cancelled",
  );
  let tableCount = 0,
    tableCovers = 0,
    poolCount = 0;
  for (const r of rows as { kind?: string; party_size?: number }[]) {
    if (r.kind === "pool") poolCount++;
    else {
      tableCount++;
      tableCovers += r.party_size || 0;
    }
  }
  const events = (ev.data ?? [])
    .map((e: { name?: string }) => e.name || "")
    .filter(Boolean);
  // Rough load flag: a chunky table count/covers or a listed event = getting busy.
  const busy = tableCovers >= 40 || tableCount >= 6 || events.length > 0;
  return { date: iso, tableCount, tableCovers, poolCount, events, busy };
}

export async function loadEnquiries(
  opts: { archived?: boolean } = {},
): Promise<Enquiry[]> {
  // Default: live enquiries only (archived ones are hidden). Pass
  // {archived:true} to load the archived/ignored ones for the Archived view.
  let q = supabase().from("enquiries").select(SELECT);
  q = opts.archived ? q.not("archived_at", "is", null) : q.is("archived_at", null);
  const { data, error } = await q
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Enquiry[];
}

// Archive = "not relevant, get it off the board" (spam, duplicate, wrong
// place). Reversible — different from "Lost" (a real deal we didn't win).
export async function archiveEnquiry(id: string): Promise<void> {
  const { error } = await supabase()
    .from("enquiries")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
export async function unarchiveEnquiry(id: string): Promise<void> {
  const { error } = await supabase()
    .from("enquiries")
    .update({ archived_at: null })
    .eq("id", id);
  if (error) throw error;
}

// Comms activity for every enquiry, in one aggregated call (enquiry_activity
// RPC). Returns a map id → {lastIn,lastOut,msgCount}; enquiries with no
// messages simply aren't in the map (treat created_at as their arrival).
export async function loadEnquiryActivity(): Promise<
  Record<string, EnquiryActivity>
> {
  const { data, error } = await supabase().rpc("enquiry_activity");
  if (error) throw error;
  const map: Record<string, EnquiryActivity> = {};
  for (const r of (data ?? []) as {
    enquiry_id: string;
    last_in: string | null;
    last_out: string | null;
    msg_count: number;
  }[]) {
    map[r.enquiry_id] = {
      lastIn: r.last_in,
      lastOut: r.last_out,
      msgCount: r.msg_count,
    };
  }
  return map;
}

export async function createEnquiry(row: NewEnquiry): Promise<Enquiry> {
  const withType = {
    ...row,
    enquiry_type:
      row.enquiry_type ??
      classifyEnquiryType([row.event_type, row.notes].filter(Boolean).join(" ")),
  };
  const { data, error } = await supabase()
    .from("enquiries")
    .insert(withType)
    .select(SELECT)
    .single();
  if (error) throw error;
  return data as Enquiry;
}

// Public, anonymous intake (the party-enquiry form). The anon RLS policy is
// INSERT-only where status='new' — anon has NO SELECT on enquiries (client
// data, GDPR). So this must NOT request the row back: `.select()` would make
// PostgREST return the representation, which needs a SELECT policy anon lacks,
// and the insert 401s. Force status 'new', insert, return nothing.
// (Same return=minimal gotcha as the newsletter signup.)
export async function submitPublicEnquiry(row: NewEnquiry): Promise<void> {
  const { error } = await supabase()
    .from("enquiries")
    .insert({
      ...row,
      status: "new",
      enquiry_type:
        row.enquiry_type ??
        classifyEnquiryType(
          [row.event_type, row.notes].filter(Boolean).join(" "),
        ),
    });
  if (error) throw error;
}

export async function updateEnquiry(
  id: string,
  patch: Partial<NewEnquiry>,
): Promise<Enquiry> {
  const { data, error } = await supabase()
    .from("enquiries")
    .update(patch)
    .eq("id", id)
    .select(SELECT)
    .single();
  if (error) throw error;
  return data as Enquiry;
}

export async function setEnquiryStatus(
  id: string,
  status: EnquiryStatus,
): Promise<Enquiry> {
  return updateEnquiry(id, { status });
}

export async function deleteEnquiry(id: string): Promise<void> {
  const { error } = await supabase().from("enquiries").delete().eq("id", id);
  if (error) throw error;
}

export async function loadEnquiryMessages(
  enquiryId: string,
): Promise<EnquiryMessage[]> {
  const { data, error } = await supabase()
    .from("enquiry_messages")
    .select("id, enquiry_id, direction, channel, subject, body, created_at")
    .eq("enquiry_id", enquiryId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EnquiryMessage[];
}

// Public: fetch the client-facing summary for a share token. Uses the
// SECURITY DEFINER RPC (returns safe fields only, and only while the enquiry
// is pencilled/confirmed). Returns null if the token is unknown or not shared.
export async function loadEnquiryClientSummary(
  token: string,
): Promise<EnquiryClientSummary | null> {
  const { data, error } = await supabase().rpc("enquiry_client_summary", {
    p_token: token,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as EnquiryClientSummary) ?? null;
}

// ---- Fulfilment (edge-function calls, one-click from the admin) ----
// Admin edge calls go with the anon key as bearer (a valid anon JWT), same as
// the other admin calls (pool-addon, send-pool-confirmation).

async function callEdge<T>(fn: string, body: unknown): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((data.error as string) || `Request failed (${res.status})`);
  }
  return data as T;
}

// Create a full-payment Stripe Payment Link for the amount the office types in.
// Stamps payment_url + amount_pence on the enquiry (done server-side).
export async function createEnquiryPaymentLink(
  enquiryId: string,
  amountPence: number,
  description?: string,
): Promise<{ pay_url: string; amount_pence: number }> {
  return callEdge("enquiry-payment", {
    enquiry_id: enquiryId,
    amount_pence: amountPence,
    description,
  });
}

// Email the client their summary (+ pay link if one exists). Office-initiated.
export async function sendEnquiryEmail(
  enquiryId: string,
): Promise<{ ok: boolean; sent_to: string }> {
  return callEdge("enquiry-email", { enquiry_id: enquiryId });
}

// Turn the enquiry into a real venue booking (table/pool/golf/private_hire).
// Creates the reservation (blocks the slot), links + confirms the enquiry, and
// optionally makes a Stripe pay link stamped on the enquiry.
export type NewBooking = {
  kind: "table" | "pool" | "golf" | "private_hire";
  reservation_date: string;
  start_time: string;
  duration_minutes?: number;
  party_size: number;
  amount_pence?: number;
};
export async function createEnquiryBooking(
  enquiryId: string,
  b: NewBooking,
): Promise<{ reservation_id: string; pay_url: string; amount_pence: number; warning?: string }> {
  return callEdge("enquiry-booking", { enquiry_id: enquiryId, ...b });
}

// Send a free-text reply to the client from the CRM. Emails them (from
// info@nodice.bar) and logs it on the thread as an 'out' message.
export async function sendEnquiryReply(
  enquiryId: string,
  body: string,
  subject?: string,
): Promise<{ ok: boolean; sent_to: string; subject: string }> {
  return callEdge("enquiry-reply", {
    enquiry_id: enquiryId,
    body,
    subject,
  });
}

// Ask Claude to draft the next reply from the conversation so far + the AI
// knowledge/FAQ. Returns the draft text — office reviews/edits before sending.
export async function draftEnquiryReply(
  enquiryId: string,
): Promise<{ draft: string }> {
  return callEdge("enquiry-ai-draft", { enquiry_id: enquiryId });
}

// The editable AI knowledge/FAQ the draft function reads. Stored in crm_settings
// (key/value). Office can edit it in the CRM so the AI's answers stay accurate.
export async function loadAiKnowledge(): Promise<string> {
  const db = supabase();
  const { data } = await db
    .from("crm_settings")
    .select("value")
    .eq("key", "ai_faq")
    .maybeSingle();
  return (data?.value as string) ?? "";
}
export async function saveAiKnowledge(value: string): Promise<void> {
  const db = supabase();
  const { error } = await db
    .from("crm_settings")
    .upsert({ key: "ai_faq", value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

// Manually settle an enquiry — "bar" = paid in person, "comp" = free. Stamps
// paid_at, settles the linked booking (paid for bar, stays confirmed for comp),
// and logs a note so there's a record of how it was settled.
export async function markEnquiryPaid(
  enquiry: Enquiry,
  method: "bar" | "comp" = "bar",
): Promise<void> {
  const db = supabase();
  const now = new Date().toISOString();
  const { error } = await db
    .from("enquiries")
    .update({ paid_at: now })
    .eq("id", enquiry.id);
  if (error) throw error;
  if (enquiry.linked_kind === "booking" && enquiry.linked_id) {
    await db
      .from("bar_reservations")
      .update(
        method === "comp"
          ? { notes: "Comped (free) via CRM" }
          : { status: "paid", paid_at: now },
      )
      .eq("id", enquiry.linked_id)
      .then(() => {}, () => {});
  }
  await db
    .from("enquiry_messages")
    .insert({
      enquiry_id: enquiry.id,
      direction: "note",
      channel: "note",
      subject: "",
      body: method === "comp" ? "Comped — free (no payment)" : "Marked paid — at bar / in person",
    })
    .then(() => {}, () => {});
}

export async function addEnquiryMessage(
  m: Omit<EnquiryMessage, "id" | "created_at">,
): Promise<EnquiryMessage> {
  const { data, error } = await supabase()
    .from("enquiry_messages")
    .insert(m)
    .select("id, enquiry_id, direction, channel, subject, body, created_at")
    .single();
  if (error) throw error;
  return data as EnquiryMessage;
}
