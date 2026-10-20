"use client";

import { supabase } from "@/lib/supabase";

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
  created_at: string;
  updated_at: string;
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
  "id, source, status, contact_name, contact_email, contact_phone, event_type, party_size, requested_date, date_flex, budget, notes, assigned_to, linked_kind, linked_id, created_at, updated_at";

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
  const { data, error } = await supabase()
    .from("enquiries")
    .insert(row)
    .select(SELECT)
    .single();
  if (error) throw error;
  return data as Enquiry;
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
