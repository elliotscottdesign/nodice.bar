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
  created_at: string;
  updated_at: string;
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
  "id, source, status, contact_name, contact_email, contact_phone, event_type, party_size, requested_date, date_flex, budget, notes, assigned_to, linked_kind, linked_id, share_token, amount_pence, payment_url, paid_at, last_emailed_at, lead_bucket, enquiry_type, created_at, updated_at";

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

export async function loadEnquiries(): Promise<Enquiry[]> {
  const { data, error } = await supabase()
    .from("enquiries")
    .select(SELECT)
    .order("requested_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Enquiry[];
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

// Manually mark an enquiry paid (until the webhook auto-flip ships).
export async function markEnquiryPaid(id: string): Promise<Enquiry> {
  return updateEnquiry(id, { paid_at: new Date().toISOString() } as Partial<NewEnquiry>);
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
