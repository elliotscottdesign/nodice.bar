// =============================================================
// No Dice — notify-big-booking
// =============================================================
// POST /functions/v1/notify-big-booking
// Body: { reservation_id: string }
//
// Fires an internal alert email to elliot@nodice.bar for a bar_reservations
// row. Since 2026-08-26 (founder: "any reservations that come into the
// website should automatically email elliot@") this fires for EVERY web
// reservation, not just big ones — parties >= BIG_THRESHOLD (12) keep the
// louder "action recommended" styling; smaller ones get a calmer
// "new booking" alert. Called fire-and-forget from:
//   1. stripe-webhook — a customer just paid for a table / pool booking
//   2. create-table-reservation — a free web table reservation landed
//   3. AddReservationForm.tsx (admin manual entry) — still only calls for
//      12+ parties, so the founder isn't emailed about his own typing
//
// WhatsApp is a planned second channel (see memory: project_whatsapp_api.md)
// but Twilio isn't wired yet — email only for now.
//
// Idempotent in spirit: re-calling with the same reservation_id sends another
// copy. Callers guard against that by only invoking when a booking first
// crosses the confirmed threshold, but there's no server-side dedupe here
// because a second alert is preferable to a missed one.
//
// Sender: info@nodice.bar via Resend HTTP API (matches the other confirmation
// emails in this project). RESEND_API_KEY lives in Edge Function env.
//
// Auth: JWT verification stays ON. Callers must present a valid Supabase JWT.
// The webhook + admin both authenticate; anonymous browsers cannot fire this.
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const BIG_THRESHOLD = 12;   // covers at or above this get the louder BIG styling
const ALERT_RECIPIENT = "elliot@nodice.bar";

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

const SENDER = "No Dice bookings <info@nodice.bar>";
const REPLY_TO = "info@nodice.bar";

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
  return hhmmss ? hhmmss.slice(0, 5) : "TBC";
}
function esc(s: unknown): string {
  return String(s ?? "").replace(/[<>&]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" } as Record<string, string>)[c]
  );
}

function renderAlertHtml(r: {
  kind: string;
  name: string;
  email: string | null;
  phone: string | null;
  party_size: number;
  reservation_date: string;
  start_time: string | null;
  duration_minutes: number | null;
  notes: string | null;
  heard_from: string | null;
}): string {
  const big = (r.party_size ?? 0) >= BIG_THRESHOLD;
  const kindLabel = r.kind === "pool" ? "Pool table" : "Table";
  const kindEmoji = r.kind === "pool" ? "🎱" : "🍽";
  const durationLine = r.duration_minutes ? `${r.duration_minutes} minutes` : "—";
  const banner = big
    ? `<p style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#DA1B33;margin:0 0 12px;font-weight:700">Big booking · action recommended</p>`
    : `<p style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#2DD4BF;margin:0 0 12px;font-weight:700">New booking from the website</p>`;
  const intro = big
    ? `A ${r.party_size}-cover ${esc(kindLabel)} booking just landed. Kitchen + management heads-up.`
    : `A ${esc(kindLabel)} booking just came in through the website.`;
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#0c0c0c;color:#f5efe3;padding:28px;border-radius:14px;max-width:560px;margin:auto;border:1px solid rgba(245,239,227,0.12)">
    ${banner}
    <h1 style="font-size:26px;line-height:1.15;margin:0 0 8px;font-weight:800">${kindEmoji} ${esc(r.name)} · ${r.party_size} covers</h1>
    <p style="font-size:14px;line-height:1.55;color:rgba(245,239,227,0.85);margin:0 0 20px">${intro}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;font-size:14px">
      <tr><td style="padding:8px 0;border-top:1px solid rgba(245,239,227,0.12);color:rgba(245,239,227,0.55);font-size:11px;text-transform:uppercase;letter-spacing:0.18em;width:130px">When</td><td style="padding:8px 0;border-top:1px solid rgba(245,239,227,0.12)">${esc(formatDate(r.reservation_date))} · ${esc(formatTime(r.start_time))}</td></tr>
      <tr><td style="padding:8px 0;border-top:1px solid rgba(245,239,227,0.12);color:rgba(245,239,227,0.55);font-size:11px;text-transform:uppercase;letter-spacing:0.18em">Party size</td><td style="padding:8px 0;border-top:1px solid rgba(245,239,227,0.12);font-weight:700;color:#F59E0B">${r.party_size}</td></tr>
      <tr><td style="padding:8px 0;border-top:1px solid rgba(245,239,227,0.12);color:rgba(245,239,227,0.55);font-size:11px;text-transform:uppercase;letter-spacing:0.18em">Duration</td><td style="padding:8px 0;border-top:1px solid rgba(245,239,227,0.12)">${esc(durationLine)}</td></tr>
      <tr><td style="padding:8px 0;border-top:1px solid rgba(245,239,227,0.12);color:rgba(245,239,227,0.55);font-size:11px;text-transform:uppercase;letter-spacing:0.18em">Kind</td><td style="padding:8px 0;border-top:1px solid rgba(245,239,227,0.12)">${esc(kindLabel)}</td></tr>
      ${r.phone ? `<tr><td style="padding:8px 0;border-top:1px solid rgba(245,239,227,0.12);color:rgba(245,239,227,0.55);font-size:11px;text-transform:uppercase;letter-spacing:0.18em">Phone</td><td style="padding:8px 0;border-top:1px solid rgba(245,239,227,0.12)"><a href="tel:${esc(r.phone)}" style="color:#f5efe3">${esc(r.phone)}</a></td></tr>` : ""}
      ${r.email ? `<tr><td style="padding:8px 0;border-top:1px solid rgba(245,239,227,0.12);color:rgba(245,239,227,0.55);font-size:11px;text-transform:uppercase;letter-spacing:0.18em">Email</td><td style="padding:8px 0;border-top:1px solid rgba(245,239,227,0.12)"><a href="mailto:${esc(r.email)}" style="color:#f5efe3">${esc(r.email)}</a></td></tr>` : ""}
      ${r.notes ? `<tr><td style="padding:8px 0;border-top:1px solid rgba(245,239,227,0.12);color:rgba(245,239,227,0.55);font-size:11px;text-transform:uppercase;letter-spacing:0.18em">Notes</td><td style="padding:8px 0;border-top:1px solid rgba(245,239,227,0.12)">${esc(r.notes)}</td></tr>` : ""}
      ${r.heard_from ? `<tr><td style="padding:8px 0;border-top:1px solid rgba(245,239,227,0.12);color:rgba(245,239,227,0.55);font-size:11px;text-transform:uppercase;letter-spacing:0.18em">Source</td><td style="padding:8px 0;border-top:1px solid rgba(245,239,227,0.12);color:rgba(245,239,227,0.65)">${esc(r.heard_from)}</td></tr>` : ""}
    </table>
    ${big ? `<div style="margin-top:22px;padding:14px 16px;background:rgba(245,158,11,0.10);border:1px solid rgba(245,158,11,0.35);border-radius:10px;font-size:13px;line-height:1.55">
      <strong style="color:#F59E0B">Suggested next steps:</strong>
      <ul style="margin:6px 0 0;padding-left:20px;color:rgba(245,239,227,0.85)">
        <li>Kitchen: check if extra stock or an early prep is needed</li>
        <li>Front of house: pre-set the table area if it's a fixed seating group</li>
        <li>Manager: reply to the customer if they might want pre-order options</li>
      </ul>
    </div>` : ""}
    <p style="margin-top:22px;font-size:12px;line-height:1.5;color:rgba(245,239,227,0.6)">Manage it at <a href="https://nodice.bar/admin/${r.kind === "pool" ? "pool" : "table"}-reservations" style="color:#2DD4BF">nodice.bar/admin/${r.kind === "pool" ? "pool" : "table"}-reservations</a></p>
    <p style="margin-top:10px;font-size:11px;color:rgba(245,239,227,0.4)">Reply to this email to reach the customer directly — Reply-To is set to their address.</p>
  </div>`;
}
function renderAlertText(r: {
  kind: string;
  name: string;
  email: string | null;
  phone: string | null;
  party_size: number;
  reservation_date: string;
  start_time: string | null;
  duration_minutes: number | null;
  notes: string | null;
  heard_from: string | null;
}): string {
  const kindLabel = r.kind === "pool" ? "Pool table" : "Table";
  return [
    (r.party_size ?? 0) >= BIG_THRESHOLD
      ? `BIG BOOKING · ACTION RECOMMENDED`
      : `NEW BOOKING FROM THE WEBSITE`,
    ``,
    `${r.name} — ${r.party_size} covers on ${formatDate(r.reservation_date)} at ${formatTime(r.start_time)}`,
    ``,
    `Kind:       ${kindLabel}`,
    `Party size: ${r.party_size}`,
    r.duration_minutes ? `Duration:   ${r.duration_minutes} min` : "",
    r.phone ? `Phone:      ${r.phone}` : "",
    r.email ? `Email:      ${r.email}` : "",
    r.notes ? `Notes:      ${r.notes}` : "",
    r.heard_from ? `Source:     ${r.heard_from}` : "",
    ``,
    `Suggested next steps:`,
    `  • Kitchen: check if extra stock or early prep is needed`,
    `  • Front of house: pre-set the table area for the group`,
    `  • Manager: reply to the customer for pre-order options`,
  ].filter(Boolean).join("\n");
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
  const reservationId = (body.reservation_id ?? "").trim();
  if (!reservationId) {
    return jsonResponse(
      { error: "Missing reservation_id" },
      { status: 400 },
    );
  }

  const { data: r, error } = await db
    .from("bar_reservations")
    .select(
      "id, kind, name, email, phone, party_size, reservation_date, start_time, duration_minutes, notes, heard_from, status",
    )
    .eq("id", reservationId)
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
  // Every web reservation alerts the founder (2026-08-26 request) —
  // 12+ parties get the louder BIG subject + styling.
  const big = (r.party_size ?? 0) >= BIG_THRESHOLD;
  const kindLabel = r.kind === "pool" ? "Pool" : "Table";
  const subject = big
    ? `🔔 BIG booking · ${r.party_size}-cover ${kindLabel} · ${formatDate(r.reservation_date)}`
    : `🔔 New ${kindLabel.toLowerCase()} booking · ${r.party_size} covers · ${formatDate(r.reservation_date)}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: SENDER,
      to: ALERT_RECIPIENT,
      // Reply-To goes to the customer so the founder can hit reply on the
      // alert and be talking to the customer directly.
      reply_to: r.email || REPLY_TO,
      subject,
      html: renderAlertHtml(r as any),
      text: renderAlertText(r as any),
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return jsonResponse(
      { error: `Resend send failed: HTTP ${res.status} ${txt}` },
      { status: 502 },
    );
  }

  console.log(
    `Booking alert${big ? " (BIG)" : ""} sent for reservation ${r.id} (${r.party_size} covers) → ${ALERT_RECIPIENT}`,
  );

  return jsonResponse({
    ok: true,
    sent_to: ALERT_RECIPIENT,
    party_size: r.party_size,
  });
});
