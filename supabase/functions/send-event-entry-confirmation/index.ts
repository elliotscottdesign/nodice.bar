// =============================================================
// No Dice — send-event-entry-confirmation
// =============================================================
// POST /functions/v1/send-event-entry-confirmation
// Body: { entry_id: string }
//
// Sends a No Dice-branded confirmation after a ticketed-event
// purchase clears Stripe (currently: World Cup match-night
// reservations, future: any other event with a paid ticket type).
// Called by the stripe-webhook when event_entries.status flips to
// 'paid'.
//
// Sender: bookings@nodice.bar via Resend HTTP API.
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

// Friendly on-the-night blurb that varies by category. Keeps the
// World Cup voice distinct from any future ticketed event without
// us pushing a new function.
function blurbFor(category: string): string {
  if (category === "world_cup") {
    return "Doors open early on match nights — get there in good time. Tables are held for 30 min past kickoff. After that we may release them to walk-ins, so don't be the team that loses their seats.";
  }
  return "Doors open early — please arrive in good time. We hold your spot for 30 min past start.";
}

function renderEmailHtml(o: {
  firstName: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  ticketLabel: string;
  quantity: number;
  amountPaid: string;
  category: string;
  notes: string | null;
}): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${o.eventName} — confirmed</title></head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#f5efe3;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#000;">
          <tr><td align="center" style="padding:24px 0 8px;">
            <img src="https://nodice.bar/nodice-wordmark.png" alt="No Dice" style="display:block;width:220px;max-width:80%;height:auto;border:0;outline:none;text-decoration:none;">
          </td></tr>
          <tr><td align="center" style="padding:0 0 32px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.32em;text-transform:uppercase;color:#DA1B33;">London Fields · Hackney</div>
          </td></tr>
          <tr><td style="background:#0c0c0c;border:1px solid rgba(245,239,227,0.1);border-radius:16px;padding:32px;">
            <div style="font-size:10px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#DA1B33;margin-bottom:12px;">You're in</div>
            <h1 style="margin:0 0 16px;font-size:28px;line-height:1.1;letter-spacing:0.02em;font-weight:900;color:#f5efe3;">${o.firstName}, see you at ${o.eventName}.</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:rgba(245,239,227,0.85);">
              Payment landed — your spot is locked in. Show this email at the door (or just give us your name).
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
              <tr>
                <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(245,239,227,0.55);width:130px;vertical-align:top;">Event</td>
                <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:15px;color:#f5efe3;">${o.eventName}</td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(245,239,227,0.55);vertical-align:top;">Date</td>
                <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:15px;color:#f5efe3;">${o.eventDate}</td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(245,239,227,0.55);vertical-align:top;">Kickoff</td>
                <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:15px;color:#f5efe3;">${o.eventTime}</td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(245,239,227,0.55);vertical-align:top;">Ticket</td>
                <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:15px;color:#f5efe3;">${o.quantity} × ${o.ticketLabel}</td>
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
                ${blurbFor(o.category)}
              </div>
            </div>
            <div style="margin-top:24px;padding-top:24px;border-top:1px solid rgba(245,239,227,0.12);font-size:13px;color:rgba(245,239,227,0.7);line-height:1.55;">
              Questions or need to change anything? Just reply to this email — it goes straight to us.
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
  eventName: string;
  eventDate: string;
  eventTime: string;
  ticketLabel: string;
  quantity: number;
  amountPaid: string;
  category: string;
  notes: string | null;
}): string {
  return [
    `NO DICE — LONDON FIELDS, HACKNEY`,
    ``,
    `YOU'RE IN`,
    ``,
    `${o.firstName}, see you at ${o.eventName}.`,
    ``,
    `Payment landed — your spot is locked in. Show this email at the door (or just give us your name).`,
    ``,
    `Event:    ${o.eventName}`,
    `Date:     ${o.eventDate}`,
    `Kickoff:  ${o.eventTime}`,
    `Ticket:   ${o.quantity} × ${o.ticketLabel}`,
    `Paid:     ${o.amountPaid}`,
    o.notes ? `Your notes: ${o.notes}` : "",
    ``,
    `WHERE`,
    `${VENUE_NAME}`,
    `${VENUE_ADDRESS}`,
    ``,
    `ON THE NIGHT`,
    blurbFor(o.category),
    ``,
    `Questions or need to change anything? Reply to this email.`,
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

  let body: { entry_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { entry_id } = body;
  if (!entry_id) {
    return jsonResponse({ error: "Missing entry_id" }, { status: 400 });
  }

  // Pull the entry + its event + its ticket type in one go.
  const { data: entry, error: entryErr } = await db
    .from("event_entries")
    .select(
      "id, attendee_name, attendee_email, quantity, amount_paid_pence, notes, event_id, ticket_type_id",
    )
    .eq("id", entry_id)
    .maybeSingle();
  if (entryErr) {
    return jsonResponse(
      { error: `DB error on entry lookup: ${entryErr.message}` },
      { status: 500 },
    );
  }
  if (!entry) {
    return jsonResponse({ error: "Entry not found" }, { status: 404 });
  }

  const { data: ev, error: evErr } = await db
    .from("events")
    .select("name, event_date, start_time, category")
    .eq("id", entry.event_id)
    .maybeSingle();
  if (evErr || !ev) {
    return jsonResponse(
      { error: `Event lookup failed: ${evErr?.message ?? "not found"}` },
      { status: 500 },
    );
  }

  const { data: tt, error: ttErr } = await db
    .from("ticket_types")
    .select("name")
    .eq("id", entry.ticket_type_id)
    .maybeSingle();
  if (ttErr || !tt) {
    return jsonResponse(
      { error: `Ticket lookup failed: ${ttErr?.message ?? "not found"}` },
      { status: 500 },
    );
  }

  const firstName =
    (entry.attendee_name ?? "").split(" ")[0] || entry.attendee_name || "there";
  const opts = {
    firstName,
    eventName: ev.name,
    eventDate: formatDate(ev.event_date),
    eventTime: formatTime(ev.start_time),
    ticketLabel: tt.name,
    quantity: entry.quantity,
    amountPaid: formatPounds(entry.amount_paid_pence ?? 0),
    category: ev.category,
    notes: entry.notes,
  };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: SENDER,
      to: entry.attendee_email,
      reply_to: REPLY_TO,
      subject: `${ev.name} — confirmed`,
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
