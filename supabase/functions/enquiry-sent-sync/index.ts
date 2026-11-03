// =============================================================
// enquiry-sent-sync — log staff's direct Gmail replies into the CRM thread
// =============================================================
// POST /functions/v1/enquiry-sent-sync
// Body: { app: "nodice-crm-scanner", items: [
//   { to_email, gmail_message_id, sent_at (ISO), subject, body }
// ] }
//
// The Gmail scanner reads the Sent folder and posts recent outbound messages
// here. For each, we find the matching enquiry (by the recipient's email) and
// append it to the thread as an outbound 'email' message — so a reply typed
// straight into Gmail shows up in the CRM, and "Needs a reply" clears.
//
// Dedupe:
//  - gmail_message_id is unique per enquiry → the same Sent message is never
//    logged twice across scan runs.
//  - If the CRM already logged an 'out' via='crm' within ±15 min (the reply was
//    sent FROM the CRM, which also lands in Sent), we skip to avoid a double.
//
// Guard: the fixed app tag (same as the scanner). Deploy --no-verify-jwt.
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
}

const APP_TAG = "nodice-crm-scanner";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Item = {
  to_email?: string;
  gmail_message_id?: string;
  sent_at?: string;
  subject?: string;
  body?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let b: { app?: string; items?: Item[] };
  try { b = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  if (b.app !== APP_TAG) return json({ error: "unauthorized" }, 401);
  const items = Array.isArray(b.items) ? b.items : [];

  let logged = 0, skipped = 0;
  for (const it of items) {
    const to = (it.to_email ?? "").trim().toLowerCase();
    const gid = (it.gmail_message_id ?? "").trim();
    const sentAt = (it.sent_at ?? "").trim();
    if (!EMAIL_RE.test(to) || !gid || !sentAt) { skipped++; continue; }

    // Most recent enquiry for this customer email.
    const { data: enq } = await db
      .from("enquiries")
      .select("id")
      .ilike("contact_email", to)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!enq) { skipped++; continue; }

    // Already captured this exact Sent message?
    const { data: dupe } = await db
      .from("enquiry_messages")
      .select("id")
      .eq("enquiry_id", enq.id)
      .eq("gmail_message_id", gid)
      .limit(1)
      .maybeSingle();
    if (dupe) { skipped++; continue; }

    // Is this the CRM-sent reply landing in Sent? Skip if a via='crm' out exists
    // within ±15 min of this send.
    const t = new Date(sentAt).getTime();
    const lo = new Date(t - 15 * 60 * 1000).toISOString();
    const hi = new Date(t + 15 * 60 * 1000).toISOString();
    const { data: crmOut } = await db
      .from("enquiry_messages")
      .select("id")
      .eq("enquiry_id", enq.id)
      .eq("direction", "out")
      .eq("via", "crm")
      .gte("created_at", lo)
      .lte("created_at", hi)
      .limit(1)
      .maybeSingle();
    if (crmOut) {
      // Stamp the gmail id on the CRM row so we don't re-evaluate it next run.
      await db.from("enquiry_messages").update({ gmail_message_id: gid }).eq("id", crmOut.id).then(() => {}, () => {});
      skipped++;
      continue;
    }

    const { error: insErr } = await db.from("enquiry_messages").insert({
      enquiry_id: enq.id,
      direction: "out",
      channel: "email",
      via: "email",
      gmail_message_id: gid,
      subject: (it.subject ?? "").slice(0, 300),
      body: (it.body ?? "").slice(0, 8000),
      created_at: sentAt,
    });
    if (insErr) { skipped++; continue; }
    logged++;
  }

  return json({ ok: true, logged, skipped });
});
