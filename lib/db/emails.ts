"use client";

import { supabase } from "@/lib/supabase";

export type EmailTemplateKey =
  | "booking_confirmation"
  | "voucher_delivery"
  | "refund_confirmation";

export type DbEmailTemplate = {
  id: string;
  key: EmailTemplateKey;
  label: string;
  subject: string;
  body: string;
};

const DEFAULTS: Omit<DbEmailTemplate, "id">[] = [
  {
    key: "booking_confirmation",
    label: "Booking confirmation",
    subject: "Your Plonk booking is confirmed",
    body:
      "Hey {{first_name}},\n\nYour Plonk booking is confirmed.\n\nWhen: {{slot_time}}\nWhere: {{venue_name}}\nParty: {{party_size}} people\nReference: {{reference}}\n\nShow this email at the bar when you arrive. See you on the greens!\n\n— The Plonk team",
  },
  {
    key: "voucher_delivery",
    label: "Gift voucher delivery",
    subject: "Your Plonk gift voucher",
    body:
      "Hi {{recipient_name}},\n\n{{sender_name}} has sent you a Plonk gift voucher worth £{{value}}.\n\nVoucher code: {{voucher_code}}\nExpires: {{expires_at}}\n\nRedeem it at plonkgolf.co.uk against any ticket at either venue.\n\n— The Plonk team",
  },
  {
    key: "refund_confirmation",
    label: "Refund confirmation",
    subject: "Your Plonk refund has been processed",
    body:
      "Hi {{first_name}},\n\nWe've processed a refund of £{{amount}} against your booking {{reference}}. It should land back on your card within 5–10 working days.\n\nIf you have any questions, just reply to this email.\n\n— The Plonk team",
  },
];

// Load every template; if any are missing in the DB, seed the defaults on
// the fly so the admin page always has all three rows to edit.
export async function loadEmailTemplates(): Promise<DbEmailTemplate[]> {
  const client = supabase();
  const { data, error } = await client
    .from("email_templates")
    .select("id, key, label, subject, body");
  if (error) throw error;

  const existing = (data ?? []) as DbEmailTemplate[];
  const missing = DEFAULTS.filter(
    (d) => !existing.some((e) => e.key === d.key),
  );
  if (missing.length > 0) {
    const { data: inserted, error: insertErr } = await client
      .from("email_templates")
      .insert(missing)
      .select("id, key, label, subject, body");
    if (insertErr) throw insertErr;
    existing.push(...((inserted ?? []) as DbEmailTemplate[]));
  }
  // Stable order matching DEFAULTS so the UI doesn't shuffle on save.
  return DEFAULTS.map((d) => existing.find((e) => e.key === d.key)!).filter(
    Boolean,
  );
}

export async function updateEmailTemplate(
  id: string,
  patch: Partial<Pick<DbEmailTemplate, "subject" | "body" | "label">>,
): Promise<DbEmailTemplate> {
  const { data, error } = await supabase()
    .from("email_templates")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbEmailTemplate;
}
