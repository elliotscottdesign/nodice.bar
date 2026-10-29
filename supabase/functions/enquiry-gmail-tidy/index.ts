// =============================================================
// enquiry-gmail-tidy — clear an enquiry's email out of the Gmail inbox
// =============================================================
// POST /functions/v1/enquiry-gmail-tidy   Body: { enquiry_id: string }
//
// Called when the office archives or deletes an enquiry in the CRM. Looks up the
// enquiry's Gmail message id and asks the Apps Script web app (GMAIL_SEND_URL,
// on info@nodice.bar) to mark that thread read + archive it OUT of the inbox.
// NEVER trashes — the email stays in All Mail. Best-effort: if there's no Gmail
// origin or the web app isn't set, it just returns ok+skipped.
//
// Auth: verify_jwt on (anon-key bearer, like the other admin calls).
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const GMAIL_SEND_URL = Deno.env.get("GMAIL_SEND_URL") ?? "";
const APP_TAG = "nodice-crm-scanner";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let b: { enquiry_id?: string };
  try { b = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const enquiryId = (b.enquiry_id ?? "").trim();
  if (!enquiryId) return json({ error: "enquiry_id is required" }, 400);
  if (!GMAIL_SEND_URL) return json({ ok: true, skipped: "gmail not configured" });

  const { data: e } = await db
    .from("enquiries")
    .select("email_message_id")
    .eq("id", enquiryId)
    .maybeSingle();
  const mid = (e?.email_message_id ?? "").trim();
  if (!mid) return json({ ok: true, skipped: "no gmail origin" });

  try {
    const r = await fetch(GMAIL_SEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app: APP_TAG, action: "tidy", message_id: mid }),
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; skipped?: string };
    if (!r.ok || j.error) return json({ error: `Gmail tidy failed: ${j.error || r.status}` }, 502);
    return json({ ok: true, result: j });
  } catch (err) {
    return json({ error: `Gmail tidy request failed: ${err instanceof Error ? err.message : String(err)}` }, 502);
  }
});
