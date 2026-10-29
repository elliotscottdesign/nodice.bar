// =============================================================
// enquiry-email — one-click client email for a CRM enquiry
// =============================================================
// POST /functions/v1/enquiry-email
// Body: { enquiry_id: string }
//
// Office-initiated (staff review, then fire — the founder's choice; not auto).
// Emails the client a No Dice-branded summary of their event with their
// shareable summary link, and — if a payment link has been created on the
// enquiry — a "Pay now" button for the full amount. Sends via Resend from
// info@nodice.bar, reply-to info@nodice.bar. Stamps last_emailed_at.
//
// Auth: verify_jwt ON (admin calls with the anon key as bearer, same as the
// other admin edge calls). Deploy (NOT --no-verify-jwt):
//   supabase functions deploy enquiry-email --project-ref <ref>
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SENDER = "No Dice <info@nodice.bar>";
const REPLY_TO = "info@nodice.bar";
const VENUE_NAME = "No Dice";
const VENUE_ADDRESS =
  "Arch 407, Mentmore Terrace, London Fields, Hackney, E8 3PH";
const SITE = "https://nodice.bar";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function formatPounds(pence: number): string {
  if (pence % 100 === 0) return `£${pence / 100}`;
  return `£${(pence / 100).toFixed(2)}`;
}
function formatDate(iso: string | null, flex: string): string {
  if (!iso) return flex || "Date to confirm";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type Enq = {
  contact_name: string;
  contact_email: string;
  event_type: string;
  status: string;
  requested_date: string | null;
  date_flex: string;
  party_size: number | null;
  share_token: string;
  payment_url: string;
  amount_pence: number | null;
};

function renderHtml(e: Enq): string {
  const first = (e.contact_name || "").split(" ")[0] || "there";
  const confirmed = e.status === "confirmed";
  const kicker = confirmed ? "You're booked in" : "We're holding this for you";
  const summaryUrl = `${SITE}/my-event?t=${encodeURIComponent(e.share_token)}`;
  const dateStr = formatDate(e.requested_date, e.date_flex);
  const row = (k: string, v: string) =>
    `<tr>
      <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(245,239,227,0.55);width:130px;vertical-align:top;">${k}</td>
      <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:15px;color:#f5efe3;">${v}</td>
    </tr>`;
  const payBlock =
    e.payment_url && e.amount_pence
      ? `<div style="margin-top:24px;padding:20px;border:1px solid rgba(218,27,51,0.35);border-radius:12px;background:rgba(218,27,51,0.06);">
          <div style="font-size:10px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#DA1B33;margin-bottom:10px;">Payment</div>
          <div style="font-size:15px;color:#f5efe3;">Amount due: <strong>${formatPounds(e.amount_pence)}</strong></div>
          <div style="margin-top:16px;">
            <a href="${esc(e.payment_url)}" style="display:inline-block;background:#DA1B33;color:#fff;text-decoration:none;font-weight:800;font-size:15px;letter-spacing:0.02em;padding:14px 28px;border-radius:999px;">Pay now →</a>
          </div>
        </div>`
      : "";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(kicker)}</title></head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#f5efe3;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000;"><tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#000;">
      <tr><td align="center" style="padding:24px 0 8px;">
        <img src="https://nodice.bar/nodice-wordmark.png" alt="No Dice" style="display:block;width:220px;max-width:80%;height:auto;border:0;">
      </td></tr>
      <tr><td align="center" style="padding:0 0 32px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.32em;text-transform:uppercase;color:#DA1B33;">London Fields · Hackney</div>
      </td></tr>
      <tr><td style="background:#0c0c0c;border:1px solid rgba(245,239,227,0.1);border-radius:16px;padding:32px;">
        <div style="font-size:10px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#DA1B33;margin-bottom:12px;">${esc(kicker)}</div>
        <h1 style="margin:0 0 16px;font-size:28px;line-height:1.1;letter-spacing:0.02em;font-weight:900;color:#f5efe3;">${esc(first)}, here's your event with us.</h1>
        <p style="margin:0 0 8px;font-size:15px;line-height:1.55;color:rgba(245,239,227,0.85);">
          ${confirmed ? "You're all set — here are the details." : "We've got your date held. Here's where things stand."}
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
          ${row("Event", esc(e.event_type || "Your event"))}
          ${row("Date", esc(dateStr))}
          ${e.party_size ? row("Party", `${e.party_size} guests`) : ""}
          ${row("Status", confirmed ? "Confirmed" : "Pencilled in")}
        </table>
        ${payBlock}
        <div style="margin-top:24px;">
          <a href="${esc(summaryUrl)}" style="display:inline-block;border:1px solid rgba(245,239,227,0.3);color:#f5efe3;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:999px;">View your event page →</a>
        </div>
        <div style="margin-top:28px;padding-top:24px;border-top:1px solid rgba(245,239,227,0.12);font-size:13px;color:rgba(245,239,227,0.7);line-height:1.55;">
          Questions, or want to change anything? Just reply to this email — it comes straight to us.
        </div>
      </td></tr>
      <tr><td align="center" style="padding:32px 0 16px;">
        <div style="font-size:11px;color:rgba(245,239,227,0.4);line-height:1.6;">
          ${VENUE_NAME} · ${VENUE_ADDRESS}<br>
          <a href="${SITE}" style="color:rgba(245,239,227,0.6);text-decoration:underline;">nodice.bar</a>
        </div>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function renderText(e: Enq): string {
  const first = (e.contact_name || "").split(" ")[0] || "there";
  const confirmed = e.status === "confirmed";
  const summaryUrl = `${SITE}/my-event?t=${encodeURIComponent(e.share_token)}`;
  return [
    `NO DICE — LONDON FIELDS, HACKNEY`,
    ``,
    confirmed ? "YOU'RE BOOKED IN" : "WE'RE HOLDING THIS FOR YOU",
    ``,
    `${first}, here's your event with us.`,
    ``,
    `Event:  ${e.event_type || "Your event"}`,
    `Date:   ${formatDate(e.requested_date, e.date_flex)}`,
    e.party_size ? `Party:  ${e.party_size} guests` : "",
    `Status: ${confirmed ? "Confirmed" : "Pencilled in"}`,
    ``,
    e.payment_url && e.amount_pence
      ? `Amount due: ${formatPounds(e.amount_pence)}\nPay now: ${e.payment_url}\n`
      : "",
    `Your event page: ${summaryUrl}`,
    ``,
    `Questions, or want to change anything? Just reply to this email.`,
    ``,
    `${VENUE_NAME} · ${VENUE_ADDRESS}`,
    `${SITE}`,
  ]
    .filter(Boolean)
    .join("\n");
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return jsonResponse({ error: "POST only" }, { status: 405 });
  }
  if (!RESEND_API_KEY) {
    return jsonResponse(
      { error: "RESEND_API_KEY not configured" },
      { status: 500 },
    );
  }

  let body: { enquiry_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }
  const enquiryId = (body.enquiry_id ?? "").trim();
  if (!enquiryId) {
    return jsonResponse({ error: "enquiry_id is required" }, { status: 400 });
  }

  const { data: e, error } = await db
    .from("enquiries")
    .select(
      "contact_name, contact_email, event_type, status, requested_date, date_flex, party_size, share_token, payment_url, amount_pence",
    )
    .eq("id", enquiryId)
    .maybeSingle();
  if (error) {
    return jsonResponse({ error: `DB error: ${error.message}` }, { status: 500 });
  }
  if (!e) {
    return jsonResponse({ error: "Enquiry not found" }, { status: 404 });
  }
  const enq = e as Enq;
  if (!enq.contact_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enq.contact_email)) {
    return jsonResponse(
      { error: "This enquiry has no valid email address to send to." },
      { status: 400 },
    );
  }

  const subject =
    enq.status === "confirmed"
      ? `Your No Dice event — confirmed`
      : `Your No Dice event — we're holding your date`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: SENDER,
      to: enq.contact_email,
      reply_to: REPLY_TO,
      subject,
      html: renderHtml(enq),
      text: renderText(enq),
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return jsonResponse(
      { error: `Resend send failed: HTTP ${res.status} ${txt}` },
      { status: 502 },
    );
  }

  await db
    .from("enquiries")
    .update({ last_emailed_at: new Date().toISOString() })
    .eq("id", enquiryId)
    .then(() => {}, () => {});

  return jsonResponse({ ok: true, sent_to: enq.contact_email });
});
