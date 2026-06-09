// =============================================================
// No Dice — send-welcome-discount
// =============================================================
// POST /functions/v1/send-welcome-discount
// Body: { email: string, source?: string }
//
// Records the signup in newsletter_signups and emails the
// WELCOME20 code via Resend HTTP API.
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};
function jsonResponse(b: unknown, i: ResponseInit = {}) {
  return new Response(JSON.stringify(b), { ...i, headers: { ...corsHeaders, "content-type": "application/json", ...(i.headers || {}) } });
}
function handlePreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  return null;
}

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const SENDER = "No Dice <hello@nodice.bar>";
const REPLY_TO = "info@nodice.bar";

function renderHtml(): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Welcome to No Dice — 20% off your first event</title></head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#f5efe3;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#000;">
<tr><td align="center" style="padding:8px 0 24px;">
<img src="https://dev.nodice.bar/nodice-wordmark.png" alt="No Dice" style="display:block;margin:0 auto;width:220px;max-width:80%;height:auto;border:0;outline:none;text-decoration:none;">
</td></tr>
<tr><td align="center" style="padding:0 0 24px;"><div style="font-size:11px;font-weight:700;letter-spacing:0.32em;text-transform:uppercase;color:#DA1B33;">London Fields · Hackney</div></td></tr>
<tr><td style="background:#0c0c0c;border:1px solid rgba(245,239,227,0.1);border-radius:16px;padding:36px 28px;">
<div style="font-size:11px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:#DA1B33;margin-bottom:12px;text-align:center;">Welcome to No Dice</div>
<h1 style="margin:0 0 8px;text-align:center;font-size:38px;line-height:1;letter-spacing:0.06em;text-transform:uppercase;color:#f5efe3;font-weight:900;">20% off your<br>first event</h1>
<p style="margin:24px 0 0;text-align:center;font-size:14px;line-height:1.55;color:rgba(245,239,227,0.7);">Use the code below at checkout for 20% off your first event ticket — pool sessions, tournament nights, World Cup matches, DJ sessions, or even a round of golf.</p>
<div style="margin:28px auto 0;text-align:center;">
<div style="display:inline-block;border:1px dashed rgba(218,27,51,0.6);background:rgba(218,27,51,0.08);padding:14px 26px;border-radius:10px;"><span style="font-size:32px;letter-spacing:0.18em;color:#DA1B33;font-weight:900;font-style:italic;">WELCOME20</span></div>
</div>
<div style="margin-top:28px;text-align:center;"><a href="https://nodice.bar" style="display:inline-block;background:#DA1B33;color:#FFFFFF;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;padding:14px 28px;border-radius:999px;">Book a session</a></div>
<div style="margin-top:36px;padding-top:24px;border-top:1px solid rgba(245,239,227,0.08);text-align:center;">
<p style="margin:0;font-size:11px;line-height:1.6;color:rgba(245,239,227,0.4);">407 Mentmore Terrace · London Fields · E8 3PH</p>
<p style="margin:8px 0 0;font-size:10px;line-height:1.6;color:rgba(245,239,227,0.3);">You signed up for the No Dice mailing list. Reply STOP to unsubscribe.</p>
</div>
</td></tr></table></td></tr></table></body></html>`;
}

function renderText(): string {
  return `WELCOME TO NO DICE

20% OFF YOUR FIRST EVENT

Use WELCOME20 at checkout for 20% off your first event ticket — pool sessions, tournament nights, World Cup matches, DJ sessions, or even a round of golf.

Book here: https://nodice.bar

See you in Hackney,
The No Dice team

407 Mentmore Terrace, London Fields, E8 3PH

(You signed up for the No Dice mailing list. Reply STOP to unsubscribe.)`;
}

Deno.serve(async (req) => {
  const pf = handlePreflight(req); if (pf) return pf;
  if (req.method !== "POST") return jsonResponse({ error: "POST only" }, { status: 405 });

  let body: { email?: string; source?: string };
  try { body = await req.json(); } catch { return jsonResponse({ error: "Invalid JSON body" }, { status: 400 }); }
  const email = (body.email ?? "").trim().toLowerCase();
  const source = (body.source ?? "popup").trim() || "popup";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse({ error: "Email looks invalid" }, { status: 400 });

  const { error: insErr } = await db.from("newsletter_signups").upsert(
    { email, source, consent: true },
    { onConflict: "email,source", ignoreDuplicates: false }
  );
  if (insErr) console.error("newsletter_signups upsert:", insErr.message);

  if (!RESEND_API_KEY) return jsonResponse({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: SENDER, to: email, reply_to: REPLY_TO,
      subject: "Your No Dice 20% off code · WELCOME20",
      html: renderHtml(), text: renderText(),
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("Resend send:", res.status, txt);
    return jsonResponse({ error: `Email send failed: HTTP ${res.status}` }, { status: 502 });
  }

  await db.from("newsletter_signups").update({ welcome_sent_at: new Date().toISOString() }).eq("email", email).eq("source", source);

  return jsonResponse({ ok: true });
});
