// =============================================================
// enquiry-reply — send a free-text reply to the client from the CRM
// =============================================================
// POST /functions/v1/enquiry-reply
// Body: { enquiry_id: string, subject?: string, body: string }
//
// Office-initiated from the enquiry drawer. Emails the client the typed
// message (Resend, from info@nodice.bar, reply-to info@nodice.bar so their
// reply comes back to the inbox), logs it on the enquiry thread as an 'out'
// message, and stamps last_emailed_at. This is how all client comms are
// handled inside the CRM going forward.
//
// Auth: verify_jwt ON (admin calls with the anon key as bearer). Deploy:
//   supabase functions deploy enquiry-reply --project-ref <ref>
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

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
// Option B: when set, replies send THROUGH Gmail via an Apps Script web app
// (so they land in Sent + thread natively). Until it's set, we fall back to
// Resend so replies keep working. The web app is guarded by the app tag.
const GMAIL_SEND_URL = Deno.env.get("GMAIL_SEND_URL") ?? "";
const APP_TAG = "nodice-crm-scanner";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SENDER = "No Dice <info@nodice.bar>";
const REPLY_TO = "info@nodice.bar";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Light sanitiser for office-authored rich text (the compose editor). Strips
// scripts/styles, inline event handlers and javascript: URLs. The content is
// staff-written (authenticated admin) and goes out as email, so this is a
// belt-and-braces pass, not a full XSS gauntlet.
function sanitizeHtml(h: string): string {
  return String(h ?? "")
    .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/<\s*style[\s\S]*?<\s*\/\s*style\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript:/gi, "");
}

// Turn plain text into simple paragraph HTML (the fallback when the office
// sent no formatted body).
function textToHtml(bodyText: string): string {
  return bodyText
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// Wrap already-safe inner HTML in the branded No Dice email shell.
function renderHtml(innerHtml: string): string {
  const paras = innerHtml;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#f5efe3;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000;"><tr><td align="center" style="padding:28px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
      <tr><td align="center" style="padding:12px 0 20px;">
        <img src="https://nodice.bar/nodice-wordmark.png" alt="No Dice" style="display:block;width:180px;max-width:70%;height:auto;border:0;">
      </td></tr>
      <tr><td style="background:#0c0c0c;border:1px solid rgba(245,239,227,0.1);border-radius:16px;padding:28px;font-size:15px;line-height:1.55;color:#f5efe3;">
        ${paras}
      </td></tr>
      <tr><td align="center" style="padding:20px 0 8px;font-size:11px;color:rgba(245,239,227,0.4);line-height:1.6;">
        No Dice · Arch 407, Mentmore Terrace, London Fields, Hackney, E8 3PH<br>
        <a href="https://nodice.bar" style="color:rgba(245,239,227,0.6);text-decoration:underline;">nodice.bar</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY not configured" }, 500);

  let b: { enquiry_id?: string; subject?: string; body?: string; html_body?: string };
  try {
    b = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const enquiryId = (b.enquiry_id ?? "").trim();
  const bodyText = (b.body ?? "").trim();
  if (!enquiryId) return json({ error: "enquiry_id is required" }, 400);
  if (!bodyText) return json({ error: "Message body is required" }, 400);

  // The formatted (rich-text) version from the compose editor, if any. Used for
  // the actual email; bodyText is kept for the thread log + plain-text fallback.
  const innerHtml = b.html_body && b.html_body.trim()
    ? sanitizeHtml(b.html_body)
    : textToHtml(bodyText);
  const emailHtml = renderHtml(innerHtml);

  const { data: e, error } = await db
    .from("enquiries")
    .select("contact_name, contact_email, event_type, email_message_id")
    .eq("id", enquiryId)
    .maybeSingle();
  if (error) return json({ error: `DB error: ${error.message}` }, 500);
  if (!e) return json({ error: "Enquiry not found" }, 404);
  const email = (e.contact_email ?? "").trim();
  if (!EMAIL_RE.test(email)) {
    return json({ error: "This enquiry has no valid email to reply to." }, 400);
  }

  const subject =
    (b.subject ?? "").trim() ||
    `Re: ${e.event_type || "your No Dice enquiry"}`.slice(0, 180);

  let via = "resend";
  if (GMAIL_SEND_URL) {
    // Send through Gmail — appears in Sent, threads into the conversation.
    via = "gmail";
    const r = await fetch(GMAIL_SEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app: APP_TAG,
        to: email,
        subject,
        body: bodyText,
        html: emailHtml,
        reply_to_message_id: (e as { email_message_id?: string }).email_message_id || "",
      }),
    });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok || j.error) {
      return json({ error: `Gmail send failed: ${j.error || r.status}` }, 502);
    }
  } else {
    if (!RESEND_API_KEY) return json({ error: "No sender configured" }, 500);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: SENDER,
        to: email,
        reply_to: REPLY_TO,
        subject,
        html: emailHtml,
        text: bodyText,
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return json({ error: `Send failed: HTTP ${res.status} ${txt}` }, 502);
    }
  }

  // Log it on the thread as an outbound message + stamp last_emailed_at.
  await db.from("enquiry_messages").insert({
    enquiry_id: enquiryId,
    direction: "out",
    channel: "email",
    subject,
    body: bodyText,
  }).then(() => {}, () => {});
  await db.from("enquiries").update({ last_emailed_at: new Date().toISOString() })
    .eq("id", enquiryId).then(() => {}, () => {});

  return json({ ok: true, sent_to: email, subject, via });
});
