// =============================================================
// No Dice — send-booking-reminders
// =============================================================
// POST /functions/v1/send-booking-reminders
// Body: {} (no input — runs against the entire booking set)
//
// Called by a Supabase cron schedule every hour. Finds paid
// bookings whose start is 22–26 hours away (so we catch them
// once even if the cron drifts ±2h) and haven't been reminded
// yet, then emails each customer a friendly "see you tomorrow"
// nudge. Stamps reminder_sent_at so they're never reminded twice.
//
// Three booking surfaces handled in one function so we don't
// fan out to N tiny functions:
//   1. bar_reservations    — pool table + future bar tables
//   2. event_entries       — World Cup match tickets
//   3. tournament_entries  — pool tournament team sign-ups
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
function jsonResponse(b: unknown, i: ResponseInit = {}) {
  return new Response(JSON.stringify(b), {
    ...i,
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
      ...(i.headers || {}),
    },
  });
}
function handlePreflight(req: Request): Response | null {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders });
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

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
function formatTime(h: string | null): string {
  return h ? h.slice(0, 5) : "TBC";
}

// 22–26h windows in ISO date+time. The cron runs hourly, so a
// 4h window guarantees every paid booking gets exactly one
// reminder regardless of when the cron actually fires within
// the hour.
function reminderWindow(): { startIso: string; endIso: string; startTime: string; endTime: string } {
  const now = new Date();
  const start = new Date(now.getTime() + 22 * 3600 * 1000);
  const end = new Date(now.getTime() + 26 * 3600 * 1000);
  return {
    startIso: start.toISOString().slice(0, 10),
    endIso: end.toISOString().slice(0, 10),
    startTime: start.toISOString().slice(11, 19),
    endTime: end.toISOString().slice(11, 19),
  };
}

// =============================================================
// Email templates — one per booking type. Kept short on purpose
// — the customer already has the full confirmation in their
// inbox; the reminder is a friendly nudge with the essentials.
// =============================================================

function reminderHtml(o: {
  firstName: string;
  bigLine: string;
  detailLines: [string, string][];
  closingLine: string;
}): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reminder — see you tomorrow</title></head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#f5efe3;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#000;">
<tr><td align="center" style="padding:24px 0 8px;"><div style="font-size:32px;font-weight:900;letter-spacing:0.06em;text-transform:uppercase;color:#f5efe3;font-style:italic;">No Dice</div></td></tr>
<tr><td align="center" style="padding:0 0 32px;"><div style="font-size:11px;font-weight:700;letter-spacing:0.32em;text-transform:uppercase;color:#DA1B33;">London Fields · Hackney</div></td></tr>
<tr><td style="background:#0c0c0c;border:1px solid rgba(245,239,227,0.1);border-radius:16px;padding:32px;">
<div style="font-size:10px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#DA1B33;margin-bottom:12px;">See you tomorrow</div>
<h1 style="margin:0 0 16px;font-size:26px;line-height:1.15;letter-spacing:0.02em;font-weight:900;color:#f5efe3;">${o.firstName}, ${o.bigLine}</h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
${o.detailLines.map(([k, v]) => `<tr><td style="padding:12px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(245,239,227,0.55);width:110px;vertical-align:top;">${k}</td><td style="padding:12px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:15px;color:#f5efe3;">${v}</td></tr>`).join("")}
</table>
<p style="margin:20px 0 0;font-size:14px;line-height:1.55;color:rgba(245,239,227,0.7);">${o.closingLine}</p>
<div style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(245,239,227,0.12);font-size:13px;color:rgba(245,239,227,0.65);">Can't make it? Reply to this email and we'll sort it.</div>
</td></tr>
<tr><td align="center" style="padding:32px 0 16px;"><div style="font-size:11px;color:rgba(245,239,227,0.4);line-height:1.6;">${VENUE_NAME} · ${VENUE_ADDRESS}<br><a href="https://nodice.bar" style="color:rgba(245,239,227,0.6);text-decoration:underline;">nodice.bar</a></div></td></tr>
</table></td></tr></table></body></html>`;
}

function reminderText(o: {
  firstName: string;
  bigLine: string;
  detailLines: [string, string][];
  closingLine: string;
}): string {
  return [
    `NO DICE — LONDON FIELDS, HACKNEY`,
    ``,
    `SEE YOU TOMORROW`,
    ``,
    `${o.firstName}, ${o.bigLine}`,
    ``,
    ...o.detailLines.map(([k, v]) => `${k.padEnd(12)}${v}`),
    ``,
    o.closingLine,
    ``,
    `Can't make it? Reply to this email and we'll sort it.`,
    ``,
    `${VENUE_NAME}`,
    `${VENUE_ADDRESS}`,
    ``,
    `https://nodice.bar`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendEmail(to: string, subject: string, html: string, text: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: SENDER, to, reply_to: REPLY_TO, subject, html, text }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${txt}`);
  }
}

// =============================================================
// Per-table processing
// =============================================================

async function remindBarReservations(
  windowStartDate: string,
  windowEndDate: string,
): Promise<{ sent: number; failed: number }> {
  // Bookings in window. Date column makes the SQL simple — the
  // SELECT range is widened slightly to cover the time-of-day too.
  const { data, error } = await db
    .from("bar_reservations")
    .select("id, kind, name, email, reservation_date, start_time")
    .eq("status", "paid")
    .is("reminder_sent_at", null)
    .gte("reservation_date", windowStartDate)
    .lte("reservation_date", windowEndDate);
  if (error) {
    console.error("bar_reservations select:", error.message);
    return { sent: 0, failed: 0 };
  }
  let sent = 0,
    failed = 0;
  for (const r of data ?? []) {
    try {
      const firstName = (r.name ?? "").split(" ")[0] || r.name || "there";
      const isPool = r.kind === "pool";
      const subject = isPool
        ? `Pool table tomorrow — ${formatTime(r.start_time)}`
        : `Your table tomorrow — ${formatTime(r.start_time)}`;
      const html = reminderHtml({
        firstName,
        bigLine: isPool
          ? "see you tomorrow at the pool tables."
          : "see you tomorrow.",
        detailLines: [
          ["Date", formatDate(r.reservation_date)],
          ["Time", formatTime(r.start_time)],
          ["Where", `${VENUE_NAME}, ${VENUE_ADDRESS}`],
        ],
        closingLine: isPool
          ? "We hold the table for 15 minutes past your slot — try not to be late, the room's set up for you."
          : "We hold the table for 15 minutes past your slot.",
      });
      const text = reminderText({
        firstName,
        bigLine: isPool
          ? "see you tomorrow at the pool tables."
          : "see you tomorrow.",
        detailLines: [
          ["Date", formatDate(r.reservation_date)],
          ["Time", formatTime(r.start_time)],
          ["Where", `${VENUE_NAME}, ${VENUE_ADDRESS}`],
        ],
        closingLine: isPool
          ? "We hold the table for 15 minutes past your slot — try not to be late, the room's set up for you."
          : "We hold the table for 15 minutes past your slot.",
      });
      await sendEmail(r.email, subject, html, text);
      await db
        .from("bar_reservations")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", r.id);
      sent++;
    } catch (e) {
      console.error(`bar_reservation ${r.id}:`, e instanceof Error ? e.message : e);
      failed++;
    }
  }
  return { sent, failed };
}

async function remindEventEntries(
  windowStartDate: string,
  windowEndDate: string,
): Promise<{ sent: number; failed: number }> {
  // event_entries don't carry the date themselves — we join the
  // event for date/time.
  const { data, error } = await db
    .from("event_entries")
    .select(
      "id, attendee_name, attendee_email, quantity, event_id, events:event_id(name, event_date, start_time, category)",
    )
    .eq("status", "paid")
    .is("reminder_sent_at", null);
  if (error) {
    console.error("event_entries select:", error.message);
    return { sent: 0, failed: 0 };
  }
  let sent = 0,
    failed = 0;
  for (const e of (data ?? []) as Array<{
    id: string;
    attendee_name: string;
    attendee_email: string;
    quantity: number;
    events: { name: string; event_date: string; start_time: string | null; category: string } | null;
  }>) {
    if (!e.events) continue;
    const evDate = e.events.event_date;
    if (evDate < windowStartDate || evDate > windowEndDate) continue;
    try {
      const firstName =
        (e.attendee_name ?? "").split(" ")[0] || e.attendee_name || "there";
      const subject = `${e.events.name} — tomorrow at ${formatTime(e.events.start_time)}`;
      const html = reminderHtml({
        firstName,
        bigLine: `see you tomorrow at ${e.events.name}.`,
        detailLines: [
          ["Date", formatDate(evDate)],
          ["Kickoff", formatTime(e.events.start_time)],
          ["Ticket", `${e.quantity} × table`],
          ["Where", `${VENUE_NAME}, ${VENUE_ADDRESS}`],
        ],
        closingLine:
          "Doors open early — get there in good time. Tables are held for 30 min past kickoff.",
      });
      const text = reminderText({
        firstName,
        bigLine: `see you tomorrow at ${e.events.name}.`,
        detailLines: [
          ["Date", formatDate(evDate)],
          ["Kickoff", formatTime(e.events.start_time)],
          ["Ticket", `${e.quantity} × table`],
          ["Where", `${VENUE_NAME}, ${VENUE_ADDRESS}`],
        ],
        closingLine:
          "Doors open early — get there in good time. Tables are held for 30 min past kickoff.",
      });
      await sendEmail(e.attendee_email, subject, html, text);
      await db
        .from("event_entries")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", e.id);
      sent++;
    } catch (err) {
      console.error(
        `event_entry ${e.id}:`,
        err instanceof Error ? err.message : err,
      );
      failed++;
    }
  }
  return { sent, failed };
}

async function remindTournamentEntries(
  windowStartDate: string,
  windowEndDate: string,
): Promise<{ sent: number; failed: number }> {
  const { data, error } = await db
    .from("tournament_entries")
    .select(
      "id, team_name, captain_name, captain_email, tournament_id, tournaments:tournament_id(name, event_date, start_time)",
    )
    .eq("status", "paid")
    .is("reminder_sent_at", null);
  if (error) {
    console.error("tournament_entries select:", error.message);
    return { sent: 0, failed: 0 };
  }
  let sent = 0,
    failed = 0;
  for (const t of (data ?? []) as Array<{
    id: string;
    team_name: string;
    captain_name: string;
    captain_email: string;
    tournaments: { name: string; event_date: string; start_time: string | null } | null;
  }>) {
    if (!t.tournaments) continue;
    const evDate = t.tournaments.event_date;
    if (evDate < windowStartDate || evDate > windowEndDate) continue;
    try {
      const firstName =
        (t.captain_name ?? "").split(" ")[0] || t.captain_name || "there";
      const subject = `${t.tournaments.name} — tomorrow at ${formatTime(t.tournaments.start_time)}`;
      const html = reminderHtml({
        firstName,
        bigLine: `${t.team_name} is on tomorrow.`,
        detailLines: [
          ["Date", formatDate(evDate)],
          ["Start", formatTime(t.tournaments.start_time)],
          ["Team", t.team_name],
          ["Where", `${VENUE_NAME}, ${VENUE_ADDRESS}`],
        ],
        closingLine:
          "Warm-up from 18:30 — tournament starts 19:15 sharp. If you're late you don't play.",
      });
      const text = reminderText({
        firstName,
        bigLine: `${t.team_name} is on tomorrow.`,
        detailLines: [
          ["Date", formatDate(evDate)],
          ["Start", formatTime(t.tournaments.start_time)],
          ["Team", t.team_name],
          ["Where", `${VENUE_NAME}, ${VENUE_ADDRESS}`],
        ],
        closingLine:
          "Warm-up from 18:30 — tournament starts 19:15 sharp. If you're late you don't play.",
      });
      await sendEmail(t.captain_email, subject, html, text);
      await db
        .from("tournament_entries")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", t.id);
      sent++;
    } catch (err) {
      console.error(
        `tournament_entry ${t.id}:`,
        err instanceof Error ? err.message : err,
      );
      failed++;
    }
  }
  return { sent, failed };
}

Deno.serve(async (req) => {
  const pf = handlePreflight(req);
  if (pf) return pf;
  if (req.method !== "POST")
    return jsonResponse({ error: "POST only" }, { status: 405 });
  if (!RESEND_API_KEY)
    return jsonResponse(
      { error: "RESEND_API_KEY not configured" },
      { status: 500 },
    );

  const { startIso, endIso } = reminderWindow();

  const bar = await remindBarReservations(startIso, endIso);
  const ev = await remindEventEntries(startIso, endIso);
  const t = await remindTournamentEntries(startIso, endIso);

  return jsonResponse({
    ok: true,
    window: { from: startIso, to: endIso },
    bar_reservations: bar,
    event_entries: ev,
    tournament_entries: t,
  });
});
