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
// "14:00:00" → "2pm", "18:30" → "6:30pm".
function formatTime(t: string | null | undefined): string {
  const m = (t || "").match(/^(\d{2}):(\d{2})/);
  if (!m) return "";
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ap = h >= 12 ? "pm" : "am";
  h = h % 12;
  if (h === 0) h = 12;
  return min === "00" ? `${h}${ap}` : `${h}:${min}${ap}`;
}
// What they've booked, as a customer-facing label.
const KIND_LABEL: Record<string, string> = {
  table: "Table booking",
  pool: "Pool",
  golf: "Crazy golf",
  private_hire: "Private hire",
};
const ENQUIRY_TYPE_LABEL: Record<string, string> = {
  party: "Party", pool: "Pool", golf: "Crazy golf", ping_pong: "Ping pong",
  table: "Table booking", private_hire: "Private hire", corporate: "Corporate",
  kids: "Kids party", dj: "DJ", tournament: "Tournament", fundraiser: "Fundraiser",
};
// "Golf — Christmas party", "Pool", or the free-text event name.
function activityLine(e: Enq): string {
  const typeLabel = e.booking_kind
    ? (KIND_LABEL[e.booking_kind] || "")
    : (e.enquiry_type && e.enquiry_type !== "other" ? (ENQUIRY_TYPE_LABEL[e.enquiry_type] || "") : "");
  const evt = (e.event_type || "").trim();
  if (typeLabel && evt && evt.toLowerCase() !== typeLabel.toLowerCase()) return `${typeLabel} — ${evt}`;
  return typeLabel || evt || "Your event";
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
  enquiry_type: string | null;
  paid_at: string | null;
  linked_kind: string | null;
  linked_id: string | null;
  // Filled from the linked bar_reservations booking (if any):
  booking_kind?: string;
  start_time?: string;
};

// Decide the kicker / status line / intro from the pipeline + payment state.
// Key fix: an unpaid booking must NOT read as fully "Confirmed" — it's held and
// needs payment to lock in.
function statusInfo(e: Enq): { kicker: string; status: string; intro: string; needsPayment: boolean } {
  const needsPayment = !!e.payment_url && !!e.amount_pence && !e.paid_at;
  const paid = !!e.paid_at;
  const confirmed = e.status === "confirmed";
  if (needsPayment) {
    return {
      kicker: "Please confirm your booking",
      status: "Reserved — payment needed to confirm",
      intro: "We've reserved this for you. To lock it in, please pay below — your booking is only confirmed once payment is received.",
      needsPayment: true,
    };
  }
  if (confirmed && paid) {
    return { kicker: "You're booked in", status: "Confirmed & paid", intro: "You're all set — here are the details.", needsPayment: false };
  }
  if (confirmed) {
    return { kicker: "You're booked in", status: "Confirmed", intro: "You're all set — here are the details.", needsPayment: false };
  }
  return { kicker: "We're holding this for you", status: "Pencilled in", intro: "We've got your date held. Here's where things stand.", needsPayment: false };
}

function renderHtml(e: Enq): string {
  const first = (e.contact_name || "").split(" ")[0] || "there";
  const si = statusInfo(e);
  const kicker = si.kicker;
  const summaryUrl = `${SITE}/my-event?t=${encodeURIComponent(e.share_token)}`;
  const timeStr = formatTime(e.start_time);
  const dateStr = formatDate(e.requested_date, e.date_flex);
  const dateTimeStr = timeStr ? `${dateStr}, ${timeStr}` : dateStr;
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
          ${esc(si.intro)}
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
          ${row("Event", esc(activityLine(e)))}
          ${row("Date &amp; time", esc(dateTimeStr))}
          ${e.party_size ? row("Party", `${e.party_size} guests`) : ""}
          ${row("Status", esc(si.status))}
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
  const si = statusInfo(e);
  const summaryUrl = `${SITE}/my-event?t=${encodeURIComponent(e.share_token)}`;
  const timeStr = formatTime(e.start_time);
  const dateStr = formatDate(e.requested_date, e.date_flex);
  return [
    `NO DICE — LONDON FIELDS, HACKNEY`,
    ``,
    si.kicker.toUpperCase(),
    ``,
    `${first}, here's your event with us.`,
    ``,
    si.intro,
    ``,
    `Event:        ${activityLine(e)}`,
    `Date & time:  ${timeStr ? `${dateStr}, ${timeStr}` : dateStr}`,
    e.party_size ? `Party:        ${e.party_size} guests` : "",
    `Status:       ${si.status}`,
    ``,
    e.payment_url && e.amount_pence
      ? `${si.needsPayment ? "Pay to confirm your booking" : "Amount due"}: ${formatPounds(e.amount_pence)}\nPay now: ${e.payment_url}\n`
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
      "contact_name, contact_email, event_type, status, requested_date, date_flex, party_size, share_token, payment_url, amount_pence, enquiry_type, paid_at, linked_kind, linked_id",
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

  // If this enquiry became a real booking, pull its time + activity kind so the
  // email can show "Date & time" and what they booked (Golf, Pool, …).
  if (enq.linked_kind === "booking" && enq.linked_id) {
    const { data: bk } = await db
      .from("bar_reservations")
      .select("kind, start_time")
      .eq("id", enq.linked_id)
      .maybeSingle();
    if (bk) {
      enq.booking_kind = (bk as { kind?: string }).kind;
      enq.start_time = (bk as { start_time?: string }).start_time;
    }
  }
  if (!enq.contact_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enq.contact_email)) {
    return jsonResponse(
      { error: "This enquiry has no valid email address to send to." },
      { status: 400 },
    );
  }

  const subject = statusInfo(enq).needsPayment
    ? `Your No Dice booking — payment needed to confirm`
    : enq.status === "confirmed"
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
