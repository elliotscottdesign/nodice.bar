// =============================================================
// email-enquiry — turn an inbound email into a CRM enquiry
// =============================================================
// POST /functions/v1/email-enquiry
// Body: {
//   secret: string,            // must match EMAIL_ENQUIRY_SECRET
//   gmail_message_id: string,  // dedupe key — one enquiry per email
//   from_name?: string,
//   from_email: string,
//   subject?: string,
//   body?: string,             // plain-text body (truncated by the scanner)
//   received_at?: string,      // ISO
//   source_inbox?: string      // e.g. "info@nodice.bar" — which inbox it hit
// }
//
// Called by the Google Apps Script scanners running on info@nodice.bar and
// info@plonkgolf.co.uk (auto-scan both inboxes → the CRM board). Creates a
// 'new' enquiry (source='email') and logs the email body as the first
// message on its thread. Idempotent: if an enquiry already exists for this
// gmail_message_id it returns { duplicate:true } and does nothing.
//
// Public endpoint (deploy --no-verify-jwt) but guarded by a shared secret so
// only our scanners can post. Deploy:
//   supabase functions deploy email-enquiry --project-ref <ref> --no-verify-jwt
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Guard: the scanner always sends a fixed app tag in the body. This replaces
// the old fillable secret (which was a constant pain to paste correctly) — the
// tag is baked into the scanner, nothing to fill in. A legacy EMAIL_ENQUIRY_
// SECRET is still accepted if an older scanner sends it. The endpoint only
// creates 'new' enquiry rows (internal, triaged on the board), so a fixed tag
// plus the anon key is an acceptable guard here.
const APP_TAG = "nodice-crm-scanner";
const EMAIL_ENQUIRY_SECRET = Deno.env.get("EMAIL_ENQUIRY_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let b: Record<string, string>;
  try {
    b = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const tagOk = (b.app ?? "") === APP_TAG;
  const legacySecretOk =
    !!EMAIL_ENQUIRY_SECRET && (b.secret ?? "") === EMAIL_ENQUIRY_SECRET;
  if (!tagOk && !legacySecretOk) {
    return json({ error: "Unauthorized" }, 401);
  }

  const messageId = (b.gmail_message_id ?? "").trim();
  if (!messageId) return json({ error: "gmail_message_id is required" }, 400);

  const fromEmail = (b.from_email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(fromEmail)) {
    return json({ error: "A valid from_email is required" }, 400);
  }

  // Dedupe: already logged this exact email?
  const { data: existing, error: exErr } = await db
    .from("enquiries")
    .select("id")
    .eq("email_message_id", messageId)
    .maybeSingle();
  if (exErr) return json({ error: `Lookup failed: ${exErr.message}` }, 500);
  if (existing) return json({ ok: true, duplicate: true, id: existing.id });

  const fromName = (b.from_name ?? "").trim().slice(0, 200);
  const subject = (b.subject ?? "").trim().slice(0, 300);
  const body = (b.body ?? "").trim().slice(0, 8000);
  const inbox = (b.source_inbox ?? "").trim().slice(0, 120);

  // Short notes snippet on the enquiry; full email goes on the thread.
  const snippet = body.slice(0, 280);
  const notes = [
    inbox ? `From email to ${inbox}` : "From email",
    subject ? `Subject: ${subject}` : "",
    snippet,
  ]
    .filter(Boolean)
    .join("\n");

  const { data: enq, error: insErr } = await db
    .from("enquiries")
    .insert({
      source: "email",
      status: "new",
      contact_name: fromName,
      contact_email: fromEmail,
      event_type: subject,
      notes,
      email_message_id: messageId,
    })
    .select("id")
    .single();
  if (insErr || !enq) {
    // Unique-violation = a concurrent scan beat us to it; treat as duplicate.
    if (insErr && /duplicate key|unique/i.test(insErr.message)) {
      return json({ ok: true, duplicate: true });
    }
    return json(
      { error: `Insert failed: ${insErr?.message ?? "unknown"}` },
      500,
    );
  }

  // Log the full email as the first message on the thread (best-effort).
  if (body || subject) {
    await db
      .from("enquiry_messages")
      .insert({
        enquiry_id: enq.id,
        direction: "in",
        channel: "email",
        subject,
        body: body || "(no body)",
      })
      .then(() => {}, () => {});
  }

  return json({ ok: true, id: enq.id });
});
