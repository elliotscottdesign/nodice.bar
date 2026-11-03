// =============================================================
// No Dice — send-tournament-confirmation
// =============================================================
// POST /functions/v1/send-tournament-confirmation
// Body: { entry_id: string }
//
// Sends the captain a No Dice-branded confirmation email after their
// team's tournament entry is paid. Called by the stripe-webhook
// function the moment an entry transitions to status='paid'.
// Also re-invokable from an admin "resend" button (idempotent in
// spirit — sending again just delivers another copy).
//
// Sender: info@nodice.bar via Resend HTTP API.
// Auth:   function keeps JWT verification ON. Callers must present
//         a valid Supabase JWT — webhooks pass the service-role key.
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// ---------- inlined CORS helpers ----------
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

// Sender + venue details. Hardcoded because they don't change per
// email; the values that DO vary (team name, tournament date, etc.)
// come from the DB.
const SENDER = "No Dice <info@nodice.bar>";
const REPLY_TO = "info@nodice.bar";
const VENUE_NAME = "No Dice";
const VENUE_ADDRESS = "Arch 407, Mentmore Terrace, London Fields, Hackney, E8 3PH";
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
  return hhmmss.slice(0, 5); // "19:00:00" → "19:00"
}

// HTML email. Built for max compatibility — inline styles, tables,
// no external CSS. Email clients (especially Outlook) are decades
// behind the web platform; we use only the lowest-common-denominator.
function renderEmailHtml(opts: {
  teamName: string;
  captainName: string;
  tournamentName: string;
  tournamentDate: string;
  tournamentTime: string;
  entryFeeLabel: string;
  notes: string | null;
}): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${opts.tournamentName} — team confirmed</title>
  </head>
  <body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#f5efe3;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#000;">
            <!-- Header -->
            <tr>
              <td align="center" style="padding:24px 0 8px;">
                <img src="https://nodice.bar/nodice-wordmark.png" alt="No Dice" style="display:block;margin:0 auto;width:220px;max-width:80%;height:auto;border:0;outline:none;text-decoration:none;">
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 0 32px;">
                <div style="font-size:11px;font-weight:700;letter-spacing:0.32em;text-transform:uppercase;color:#DA1B33;">London Fields · Hackney</div>
              </td>
            </tr>

            <!-- Confirmation block -->
            <tr>
              <td style="background:#0c0c0c;border:1px solid rgba(245,239,227,0.1);border-radius:16px;padding:32px;">
                <div style="font-size:10px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#DA1B33;margin-bottom:12px;">Team confirmed</div>
                <h1 style="margin:0 0 16px;font-size:28px;line-height:1.1;letter-spacing:0.02em;font-weight:900;color:#f5efe3;">${opts.teamName}, you're in.</h1>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:rgba(245,239,227,0.85);">
                  ${opts.captainName}, payment landed — your team's spot at <strong>${opts.tournamentName}</strong> is locked in. Below are the details, save this email.
                </p>

                <!-- Details table -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
                  <tr>
                    <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(245,239,227,0.55);width:130px;vertical-align:top;">Tournament</td>
                    <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:15px;color:#f5efe3;">${opts.tournamentName}</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(245,239,227,0.55);vertical-align:top;">Date</td>
                    <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:15px;color:#f5efe3;">${opts.tournamentDate}</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(245,239,227,0.55);vertical-align:top;">Start time</td>
                    <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:15px;color:#f5efe3;">${opts.tournamentTime}</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(245,239,227,0.55);vertical-align:top;">Team name</td>
                    <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:15px;color:#f5efe3;">${opts.teamName}</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(245,239,227,0.55);vertical-align:top;">Entry paid</td>
                    <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:15px;color:#f5efe3;">${opts.entryFeeLabel}</td>
                  </tr>
                  ${
                    opts.notes
                      ? `<tr>
                    <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(245,239,227,0.55);vertical-align:top;">Your notes</td>
                    <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:15px;color:#f5efe3;">${opts.notes}</td>
                  </tr>`
                      : ""
                  }
                </table>

                <!-- Venue block -->
                <div style="margin-top:32px;padding-top:24px;border-top:1px solid rgba(245,239,227,0.12);">
                  <div style="font-size:10px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#DA1B33;margin-bottom:8px;">Where</div>
                  <div style="font-size:15px;color:#f5efe3;line-height:1.55;">
                    ${VENUE_NAME}<br>
                    ${VENUE_ADDRESS}
                  </div>
                </div>

                <!-- What to bring -->
                <div style="margin-top:24px;padding-top:24px;border-top:1px solid rgba(245,239,227,0.12);">
                  <div style="font-size:10px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#DA1B33;margin-bottom:8px;">On the night</div>
                  <div style="font-size:14px;color:rgba(245,239,227,0.85);line-height:1.6;">
                    From 18:30 we offer free warm-up sessions on the tables. The tournament starts at <strong>19:15 sharp</strong> — if you're late, you won't be able to play. Make sure your team name is correct and your phone number is accurate, we'll text you regarding any updates for the event.
                  </div>
                </div>

                <!-- Reply CTA -->
                <div style="margin-top:24px;padding-top:24px;border-top:1px solid rgba(245,239,227,0.12);font-size:13px;color:rgba(245,239,227,0.7);line-height:1.55;">
                  Questions, can't make it, or need to swap a player? Just reply to this email — it goes straight to the team.
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="padding:32px 0 16px;">
                <div style="font-size:11px;color:rgba(245,239,227,0.4);line-height:1.6;">
                  ${VENUE_NAME} · ${VENUE_ADDRESS}<br>
                  <a href="${VENUE_URL}" style="color:rgba(245,239,227,0.6);text-decoration:underline;">nodice.bar</a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Plain-text fallback for clients that block HTML. Same info,
// stripped of styling — always include both per RFC.
function renderEmailText(opts: {
  teamName: string;
  captainName: string;
  tournamentName: string;
  tournamentDate: string;
  tournamentTime: string;
  entryFeeLabel: string;
  notes: string | null;
}): string {
  return [
    `NO DICE — LONDON FIELDS, HACKNEY`,
    ``,
    `TEAM CONFIRMED`,
    ``,
    `${opts.teamName}, you're in.`,
    ``,
    `${opts.captainName}, payment landed — your team's spot at ${opts.tournamentName} is locked in. Save this email; details below.`,
    ``,
    `Tournament: ${opts.tournamentName}`,
    `Date:       ${opts.tournamentDate}`,
    `Start time: ${opts.tournamentTime}`,
    `Team name:  ${opts.teamName}`,
    `Entry paid: ${opts.entryFeeLabel}`,
    opts.notes ? `Your notes: ${opts.notes}` : "",
    ``,
    `WHERE`,
    `${VENUE_NAME}`,
    `${VENUE_ADDRESS}`,
    ``,
    `ON THE NIGHT`,
    `From 18:30 we offer free warm-up sessions on the tables. The tournament starts at 19:15 sharp — if you're late, you won't be able to play. Make sure your team name is correct and your phone number is accurate, we'll text you regarding any updates for the event.`,
    ``,
    `Questions, can't make it, or need to swap a player? Reply to this email — it goes to the team.`,
    ``,
    `${VENUE_URL}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// --- Comedy & Bingo confirmation (bingo nights ride tournament_entries) ---
// Copy drawn from the /comedybingo listing: £10 a ticket, includes 5 bingo
// cards + comedy, free-to-play with bar-sponsored prizes, doors 7pm /
// show 7:30pm. Accent red #D65139 to match the page.
const BINGO_RED = "#D65139";
type BingoEmailOpts = {
  name: string;
  eventName: string;
  eventDate: string;
  quantity: number;
  totalLabel: string;
};
function renderBingoHtml(o: BingoEmailOpts): string {
  const ticketWord = o.quantity === 1 ? "ticket" : "tickets";
  const row = (label: string, value: string) =>
    `<tr><td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(245,239,227,0.55);width:140px;vertical-align:top;">${label}</td><td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:15px;color:#f5efe3;">${value}</td></tr>`;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Comedy &amp; Bingo — you're in</title></head>
<body style="margin:0;background:#0c0c0c;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c0c0c;padding:32px 0;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#141414;border-radius:16px;overflow:hidden;">
  <tr><td style="padding:28px 32px 8px;text-align:center;">
    <img src="https://nodice.bar/nodice-wordmark.png" alt="No Dice" style="display:block;margin:0 auto;width:200px;max-width:70%;height:auto;border:0;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.32em;text-transform:uppercase;color:${BINGO_RED};margin-top:12px;">Comedy &amp; Bingo · London Fields</div>
  </td></tr>
  <tr><td style="padding:16px 32px 4px;">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:${BINGO_RED};margin-bottom:12px;">You're in — eyes down!</div>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#f5efe3;">${o.name}, payment landed — your ${o.quantity} ${ticketWord} for <strong>${o.eventName}</strong> ${o.quantity === 1 ? "is" : "are"} booked. Save this email.</p>
  </td></tr>
  <tr><td style="padding:12px 32px 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${row("Date", o.eventDate)}
    ${row("Doors / show", "Doors 7pm · Show 7:30pm")}
    ${row("Tickets", `${o.quantity} × £10`)}
    ${row("Paid", o.totalLabel)}
    ${row("What's included", "Entry + a drink, 5 bingo cards &amp; the comedy. Bingo's free to play — the bar puts up the prizes.")}
  </table></td></tr>
  <tr><td style="padding:16px 32px 4px;">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:${BINGO_RED};margin-bottom:8px;">Where</div>
    <p style="margin:0;font-size:14px;line-height:1.6;color:rgba(245,239,227,0.85);">${VENUE_ADDRESS}</p>
  </td></tr>
  <tr><td style="padding:14px 32px 28px;">
    <p style="margin:0;font-size:13px;line-height:1.6;color:rgba(245,239,227,0.6);">We'll text you any updates before the night, so keep an eye on your phone. Questions? Just reply to this email. See you there — <a href="${VENUE_URL}" style="color:rgba(245,239,227,0.6);text-decoration:underline;">nodice.bar</a></p>
  </td></tr>
</table></td></tr></table></body></html>`;
}
function renderBingoText(o: BingoEmailOpts): string {
  const ticketWord = o.quantity === 1 ? "ticket" : "tickets";
  return [
    `COMEDY & BINGO — YOU'RE IN`,
    ``,
    `${o.name}, payment landed — your ${o.quantity} ${ticketWord} for ${o.eventName} ${o.quantity === 1 ? "is" : "are"} booked. Save this email.`,
    ``,
    `Date:         ${o.eventDate}`,
    `Doors / show: Doors 7pm · Show 7:30pm`,
    `Tickets:      ${o.quantity} x £10`,
    `Paid:         ${o.totalLabel}`,
    `Included:     Entry + a drink, 5 bingo cards & the comedy. Bingo's free to play — the bar puts up the prizes.`,
    ``,
    `Where: ${VENUE_ADDRESS}`,
    ``,
    `We'll text you any updates before the night. Questions? Just reply to this email.`,
    `${VENUE_URL}`,
  ].join("\n");
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

  // Parse body.
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

  // Load the entry + parent tournament. Service-role bypasses RLS.
  const { data: entry, error: entryErr } = await db
    .from("tournament_entries")
    .select(
      "id, team_name, captain_name, captain_email, notes, tournament_id, status, player_count",
    )
    .eq("id", entry_id)
    .maybeSingle();
  if (entryErr || !entry) {
    return jsonResponse(
      {
        error: entryErr
          ? `DB error: ${entryErr.message}`
          : "Entry not found",
      },
      { status: entryErr ? 500 : 404 },
    );
  }

  const { data: tournament, error: tournErr } = await db
    .from("tournaments")
    .select("id, name, event_date, start_time, entry_fee_pence")
    .eq("id", entry.tournament_id)
    .maybeSingle();
  if (tournErr || !tournament) {
    return jsonResponse(
      {
        error: tournErr
          ? `DB error: ${tournErr.message}`
          : "Tournament not found",
      },
      { status: tournErr ? 500 : 404 },
    );
  }

  // Is this a BINGO night? Bingo entries ride the same tournament_entries
  // table (kind='tournament_entry'), so they land here — but they must get
  // bingo copy, NOT the pool/ping-pong tournament email. Detect via the
  // events row's category (same id as the tournament mirror).
  const { data: ev } = await db
    .from("events")
    .select("category, name, event_date, start_time")
    .eq("id", entry.tournament_id)
    .maybeSingle();
  const isBingo = ev?.category === "bingo";

  // Build email content — bingo or tournament.
  let subject: string;
  let html: string;
  let text: string;
  if (isBingo) {
    const qty = Math.max(1, Number(entry.player_count) || 1);
    const bopts = {
      name: entry.captain_name,
      eventName: ev?.name || tournament.name,
      eventDate: formatDate(ev?.event_date || tournament.event_date),
      quantity: qty,
      totalLabel: formatPounds(tournament.entry_fee_pence * qty),
    };
    subject = `Comedy & Bingo — you're in${qty > 1 ? ` (${qty} tickets)` : ""}`;
    html = renderBingoHtml(bopts);
    text = renderBingoText(bopts);
  } else {
    const opts = {
      teamName: entry.team_name,
      captainName: entry.captain_name,
      tournamentName: tournament.name,
      tournamentDate: formatDate(tournament.event_date),
      tournamentTime: formatTime(tournament.start_time),
      entryFeeLabel: formatPounds(tournament.entry_fee_pence),
      notes: entry.notes,
    };
    subject = `${tournament.name} — your team's in`;
    html = renderEmailHtml(opts);
    text = renderEmailText(opts);
  }

  // Send via Resend.
  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: SENDER,
      to: [entry.captain_email],
      reply_to: REPLY_TO,
      subject,
      html,
      text,
    }),
  });

  if (!resendRes.ok) {
    const errBody = await resendRes.text().catch(() => "");
    return jsonResponse(
      {
        error: `Resend send failed (${resendRes.status}): ${errBody}`,
      },
      { status: 502 },
    );
  }

  const resendJson = await resendRes.json().catch(() => ({}));
  return jsonResponse({ ok: true, resend_id: resendJson?.id ?? null });
});
