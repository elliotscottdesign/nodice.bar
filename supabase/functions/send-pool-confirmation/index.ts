// =============================================================
// No Dice — send-pool-confirmation
// =============================================================
// POST /functions/v1/send-pool-confirmation
// Body: { reservation_id: string }
//
// Sends the customer a No Dice-branded confirmation email after
// their pool table reservation is paid. Called by the stripe-webhook
// the moment a bar_reservations row transitions to status='paid'.
// Idempotent in spirit — calling again just sends another copy.
//
// Sender: bookings@nodice.bar via Resend HTTP API.
// Auth:   JWT verification ON. The webhook calls us with the
//         service-role key, which Supabase accepts as a JWT.
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

const SENDER = "No Dice <bookings@nodice.bar>";
const REPLY_TO = "info@nodice.bar";
const VENUE_NAME = "No Dice";
const VENUE_ADDRESS =
  "Arch 407, Mentmore Terrace, London Fields, Hackney, E8 3PH";
const VENUE_URL = "https://nodice.bar";

function formatPounds(pence: number): string {
  if (pence % 100 === 0) return `£${pence / 100}`;
  return `£${(pence / 100).toFixed(2)}`;
}
function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
function formatTime(hhmmss: string | null): string {
  if (!hhmmss) return "TBC";
  return hhmmss.slice(0, 5);
}
function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  if (min % 60 === 0) return `${min / 60} hr${min === 60 ? "" : "s"}`;
  return `${(min / 60).toFixed(1)} hrs`;
}

function renderEmailHtml(o: {
  firstName: string;
  bookingDate: string;
  startTime: string;
  duration: string;
  partySize: number;
  amountPaid: string;
  notes: string | null;
}): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Pool table confirmed</title></head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#f5efe3;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#000;">
          <tr><td align="center" style="padding:24px 0 8px;">
            <img src="https://dev.nodice.bar/nodice-wordmark.png" alt="No Dice" style="display:block;width:220px;max-width:80%;height:auto;border:0;outline:none;text-decoration:none;">
          </td></tr>
          <tr><td align="center" style="padding:0 0 32px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.32em;text-transform:uppercase;color:#DA1B33;">London Fields · Hackney</div>
          </td></tr>
          <tr><td style="background:#0c0c0c;border:1px solid rgba(245,239,227,0.1);border-radius:16px;padding:32px;">
            <div style="font-size:10px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#DA1B33;margin-bottom:12px;">Table confirmed</div>
            <h1 style="margin:0 0 16px;font-size:28px;line-height:1.1;letter-spacing:0.02em;font-weight:900;color:#f5efe3;">${o.firstName}, your pool table's locked in.</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:rgba(245,239,227,0.85);">
              Payment landed — see you on the night. Bring this email or just show up with your name at the door.
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
              <tr>
                <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(245,239,227,0.55);width:130px;vertical-align:top;">Date</td>
                <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:15px;color:#f5efe3;">${o.bookingDate}</td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(245,239,227,0.55);vertical-align:top;">Start time</td>
                <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:15px;color:#f5efe3;">${o.startTime}</td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(245,239,227,0.55);vertical-align:top;">Length</td>
                <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:15px;color:#f5efe3;">${o.duration}</td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(245,239,227,0.55);vertical-align:top;">Party size</td>
                <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:15px;color:#f5efe3;">${o.partySize}</td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(245,239,227,0.55);vertical-align:top;">Paid</td>
                <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:15px;color:#f5efe3;">${o.amountPaid}</td>
              </tr>
              ${
                o.notes
                  ? `<tr>
                <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(245,239,227,0.55);vertical-align:top;">Your notes</td>
                <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:15px;color:#f5efe3;">${o.notes}</td>
              </tr>`
                  : ""
              }
            </table>
            <div style="margin-top:32px;padding-top:24px;border-top:1px solid rgba(245,239,227,0.12);">
              <div style="font-size:10px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#DA1B33;margin-bottom:8px;">Where</div>
              <div style="font-size:15px;color:#f5efe3;line-height:1.55;">${VENUE_NAME}<br>${VENUE_ADDRESS}</div>
            </div>
            <div style="margin-top:24px;padding-top:24px;border-top:1px solid rgba(245,239,227,0.12);">
              <div style="font-size:10px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#DA1B33;margin-bottom:8px;">On the night</div>
              <div style="font-size:14px;color:rgba(245,239,227,0.85);line-height:1.6;">
                We hold the table for 15 minutes past your slot. After that we may give it to walk-ins, so please arrive on time. The table's set up and chalked when you get there — just say your name at the bar.
              </div>
            </div>
            <div style="margin-top:24px;padding-top:24px;border-top:1px solid rgba(245,239,227,0.12);font-size:13px;color:rgba(245,239,227,0.7);line-height:1.55;">
              Need to change or cancel? Just reply to this email — it goes straight to us.
            </div>
          </td></tr>
          <tr><td align="center" style="padding:32px 0 16px;">
            <div style="font-size:11px;color:rgba(245,239,227,0.4);line-height:1.6;">
              ${VENUE_NAME} · ${VENUE_ADDRESS}<br>
              <a href="${VENUE_URL}" style="color:rgba(245,239,227,0.6);text-decoration:underline;">nodice.bar</a>
            </div>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body></html>`;
}

function renderEmailText(o: {
  firstName: string;
  bookingDate: string;
  startTime: string;
  duration: string;
  partySize: number;
  amountPaid: string;
  notes: string | null;
}): string {
  return [
    `NO DICE — LONDON FIELDS, HACKNEY`,
    ``,
    `TABLE CONFIRMED`,
    ``,
    `${o.firstName}, your pool table's locked in.`,
    ``,
    `Payment landed — see you on the night. Bring this email or just show up with your name at the door.`,
    ``,
    `Date:       ${o.bookingDate}`,
    `Start time: ${o.startTime}`,
    `Length:     ${o.duration}`,
    `Party size: ${o.partySize}`,
    `Paid:       ${o.amountPaid}`,
    o.notes ? `Your notes: ${o.notes}` : "",
    ``,
    `WHERE`,
    `${VENUE_NAME}`,
    `${VENUE_ADDRESS}`,
    ``,
    `ON THE NIGHT`,
    `We hold the table for 15 minutes past your slot. After that we may give it to walk-ins, so please arrive on time. The table's set up and chalked when you get there — just say your name at the bar.`,
    ``,
    `Need to change or cancel? Reply to this email.`,
    ``,
    `${VENUE_URL}`,
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

  let body: { reservation_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { reservation_id } = body;
  if (!reservation_id) {
    return jsonResponse(
      { error: "Missing reservation_id" },
      { status: 400 },
    );
  }

  const { data: r, error } = await db
    .from("bar_reservations")
    .select(
      "id, kind, name, email, reservation_date, start_time, duration_minutes, party_size, notes, amount_pence",
    )
    .eq("id", reservation_id)
    .maybeSingle();
  if (error) {
    return jsonResponse(
      { error: `DB error: ${error.message}` },
      { status: 500 },
    );
  }
  if (!r) {
    return jsonResponse({ error: "Reservation not found" }, { status: 404 });
  }
  if (r.kind !== "pool") {
    return jsonResponse(
      { error: "Not a pool reservation" },
      { status: 400 },
    );
  }

  const firstName = (r.name ?? "").split(" ")[0] || r.name || "there";
  const opts = {
    firstName,
    bookingDate: formatDate(r.reservation_date),
    startTime: formatTime(r.start_time),
    duration: formatDuration(r.duration_minutes),
    partySize: r.party_size,
    amountPaid: formatPounds(r.amount_pence ?? 0),
    notes: r.notes,
  };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: SENDER,
      to: r.email,
      reply_to: REPLY_TO,
      subject: `Pool table confirmed — ${opts.bookingDate} ${opts.startTime}`,
      html: renderEmailHtml(opts),
      text: renderEmailText(opts),
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return jsonResponse(
      { error: `Resend send failed: HTTP ${res.status} ${txt}` },
      { status: 502 },
    );
  }

  return jsonResponse({ ok: true });
});
