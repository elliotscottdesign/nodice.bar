// =============================================================
// send-welcome-discount — newsletter signup + welcome email
// =============================================================
// POST /functions/v1/send-welcome-discount
// Body: { email: string, source?: string }
//
// Two side-effects:
//   1. Insert a row in newsletter_signups (keeps a record of every
//      address that signed up, what surface they came from, and
//      whether the welcome email actually went out).
//   2. Email them the WELCOME20 code via Gmail SMTP.
//
// Auth: this function leaves JWT verification ON. The browser-side
// NewsletterPopup calls it with the public anon key, which Supabase
// counts as a valid JWT. That gives a simple gate without a shared
// secret.
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};
function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
}
function handlePreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return null;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SMTP_USERNAME = Deno.env.get("SMTP_USERNAME") ?? "";
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD") ?? "";

const FROM_NAME = "No Dice";
const REPLY_TO = "info@nodice.bar";

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function composeEmail(): { subject: string; text: string; html: string } {
  const subject = "Your No Dice 20% off code · WELCOME20";

  const text = `Welcome to No Dice.

Use WELCOME20 at checkout for 20% off your first event ticket — pool sessions, tournament nights, World Cup matches, DJ sessions, or golf.

Book here: https://nodice.bar

See you in Hackney,
The No Dice team

407 Mentmore Terrace, London Fields, E8 3PH

(You signed up for the No Dice mailing list. Unsubscribe by replying STOP.)
`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#000000;font-family:'DM Sans',-apple-system,Helvetica,Arial,sans-serif;color:#F5EFE3;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 20px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0c0c0c;border:1px solid rgba(245,239,227,0.12);border-radius:16px;padding:36px 28px;">
            <tr>
              <td align="center" style="padding-bottom:8px;">
                <img src="https://dev.nodice.bar/nodice-wordmark.png" alt="No Dice" style="display:block;margin:0 auto;width:220px;max-width:80%;height:auto;border:0;outline:none;text-decoration:none;">
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 0 20px;">
                <div style="font-size:11px;font-weight:700;letter-spacing:0.28em;color:#DA1B33;text-transform:uppercase;">Welcome to No Dice</div>
              </td>
            </tr>
            <tr>
              <td align="center">
                <h1 style="margin:0;font-family:'Bebas Neue',Impact,sans-serif;font-size:42px;line-height:1;letter-spacing:0.06em;text-transform:uppercase;color:#F5EFE3;">20% off your<br />first event</h1>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px 0 12px;">
                <p style="margin:0;font-size:14px;line-height:1.55;color:rgba(245,239,227,0.7);">
                  Use the code below at checkout for 20% off your first event ticket — pool sessions, tournament nights, World Cup matches, DJ sessions, or even a round of golf.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 0 24px;">
                <div style="display:inline-block;border:1px dashed rgba(218,27,51,0.6);background:rgba(218,27,51,0.08);padding:14px 26px;border-radius:10px;">
                  <span style="font-family:'Bebas Neue',Impact,sans-serif;font-size:32px;letter-spacing:0.18em;color:#DA1B33;">WELCOME20</span>
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:8px;">
                <a href="https://nodice.bar" style="display:inline-block;background:#DA1B33;color:#FFFFFF;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;padding:14px 28px;border-radius:999px;">Book a session</a>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:36px;border-top:1px solid rgba(245,239,227,0.08);">
                <p style="margin:24px 0 0;font-size:11px;line-height:1.6;color:rgba(245,239,227,0.4);">
                  407 Mentmore Terrace · London Fields · E8 3PH
                </p>
                <p style="margin:8px 0 0;font-size:10px;line-height:1.6;color:rgba(245,239,227,0.3);">
                  You signed up for the No Dice mailing list. Reply STOP to unsubscribe.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return jsonResponse({ error: "POST only" }, { status: 405 });
  }

  let body: { email?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const source = (body.source ?? "popup").trim() || "popup";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse(
      { error: "Email looks invalid" },
      { status: 400 },
    );
  }

  // 1) Record the signup. Duplicate (email+source) is allowed to
  //    silently no-op via on conflict — we still send the email
  //    below so a returning visitor who lost the code gets it
  //    again.
  const { error: insertErr } = await db
    .from("newsletter_signups")
    .upsert(
      { email, source, consent: true },
      { onConflict: "email,source", ignoreDuplicates: false },
    );
  if (insertErr) {
    console.error("newsletter_signups upsert error:", insertErr.message);
    // Continue — losing the DB log is bad but not customer-fatal.
  }

  // 2) Send the email. Failures are returned so the popup can
  //    surface a polite error if needed.
  if (!SMTP_USERNAME || !SMTP_PASSWORD) {
    return jsonResponse(
      { error: "SMTP credentials not configured" },
      { status: 500 },
    );
  }

  const { subject, text, html } = composeEmail();

  let client: SMTPClient | null = null;
  try {
    client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: SMTP_USERNAME, password: SMTP_PASSWORD },
      },
    });
    await client.send({
      from: `${FROM_NAME} <${SMTP_USERNAME}>`,
      to: email,
      replyTo: REPLY_TO,
      subject,
      content: text,
      html,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("SMTP send error:", msg);
    return jsonResponse(
      { error: `Email send failed: ${msg}` },
      { status: 502 },
    );
  } finally {
    try {
      await client?.close();
    } catch {
      /* ignore */
    }
  }

  // 3) Stamp welcome_sent_at so we know who's been sent.
  await db
    .from("newsletter_signups")
    .update({ welcome_sent_at: new Date().toISOString() })
    .eq("email", email)
    .eq("source", source);

  return jsonResponse({ ok: true });
});
