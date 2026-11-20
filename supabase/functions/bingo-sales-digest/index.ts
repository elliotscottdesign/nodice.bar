// =============================================================
// bingo-sales-digest — daily Comedy & Bingo ticket-sales email
// =============================================================
// Emails elliot@nodice.bar + billyj13@proton.me once a day with:
//   • tickets sold TODAY (count + £)
//   • the running TOTAL tickets sold (count + £, vs the room cap)
// per bingo night, plus a grand total.
//
// Fired by a pg_cron job (net.http_post) with a shared secret. Reads
// paid `tournament_entries` for every events-row with category='bingo'
// (the bingo booking model — see bingo-checkout). £ = player_count ×
// the event's £10 ticket price. "Today" is the Europe/London calendar day.
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "https://rntcujcpsozvuxvmlejv.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const DIGEST_SECRET = Deno.env.get("BINGO_SALES_DIGEST_SECRET") ?? "";

const SENDER = "No Dice <info@nodice.bar>";
const REPLY_TO = "info@nodice.bar";
const RECIPIENTS = ["elliot@nodice.bar", "billyj13@proton.me"];

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

function gbp(pence: number): string {
  return pence % 100 === 0
    ? `£${pence / 100}`
    : `£${(pence / 100).toFixed(2)}`;
}

// Europe/London calendar date (YYYY-MM-DD) for a timestamp.
function londonDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
function prettyDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  });
}

type EventRow = {
  id: string;
  name: string;
  event_date: string | null;
  max_attendees: number | null;
};
type EntryRow = {
  tournament_id: string;
  player_count: number | null;
  status: string;
  paid_at: string | null;
};

Deno.serve(async (req) => {
  if (req.method !== "POST")
    return jsonResponse({ error: "POST only" }, { status: 405 });
  if (!RESEND_API_KEY)
    return jsonResponse({ error: "RESEND_API_KEY not set" }, { status: 500 });

  // Auth: shared cron secret (body.secret or x-cron-secret header).
  let body: { secret?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body ok if header carries the secret */
  }
  const provided = body.secret || req.headers.get("x-cron-secret") || "";
  if (!DIGEST_SECRET || provided !== DIGEST_SECRET)
    return jsonResponse({ error: "unauthorized" }, { status: 401 });

  // All bingo events.
  const { data: events, error: evErr } = await db
    .from("events")
    .select("id, name, event_date, max_attendees")
    .eq("category", "bingo");
  if (evErr)
    return jsonResponse({ error: `events: ${evErr.message}` }, { status: 500 });
  const bingoEvents = (events ?? []) as EventRow[];
  if (bingoEvents.length === 0)
    return jsonResponse({ ok: true, note: "no bingo events" });

  const ids = bingoEvents.map((e) => e.id);

  // Ticket price per event (active ticket_type), default £10.
  const { data: tts } = await db
    .from("ticket_types")
    .select("event_id, price_pence, active")
    .in("event_id", ids)
    .eq("active", true);
  const feeByEvent = new Map<string, number>();
  for (const t of tts ?? []) {
    const e = t as { event_id: string; price_pence: number };
    if (!feeByEvent.has(e.event_id)) feeByEvent.set(e.event_id, e.price_pence);
  }

  // Paid entries for those events.
  const { data: entries, error: enErr } = await db
    .from("tournament_entries")
    .select("tournament_id, player_count, status, paid_at")
    .in("tournament_id", ids)
    .eq("status", "paid");
  if (enErr)
    return jsonResponse({ error: `entries: ${enErr.message}` }, { status: 500 });

  const today = londonDate(new Date());

  const perEvent = bingoEvents
    .map((ev) => {
      const fee = feeByEvent.get(ev.id) ?? 1000;
      let todayTickets = 0;
      let totalTickets = 0;
      for (const row of (entries ?? []) as EntryRow[]) {
        if (row.tournament_id !== ev.id) continue;
        const qty = Math.max(1, Number(row.player_count) || 1);
        totalTickets += qty;
        if (row.paid_at && londonDate(new Date(row.paid_at)) === today)
          todayTickets += qty;
      }
      return {
        name: ev.name,
        date: ev.event_date ? prettyDate(ev.event_date) : "",
        cap: ev.max_attendees ?? 60,
        fee,
        todayTickets,
        todayPence: todayTickets * fee,
        totalTickets,
        totalPence: totalTickets * fee,
      };
    })
    // Show the soonest/active nights first.
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  const grandTodayTickets = perEvent.reduce((n, e) => n + e.todayTickets, 0);
  const grandTodayPence = perEvent.reduce((n, e) => n + e.todayPence, 0);
  const grandTotalTickets = perEvent.reduce((n, e) => n + e.totalTickets, 0);
  const grandTotalPence = perEvent.reduce((n, e) => n + e.totalPence, 0);

  const todayPretty = prettyDate(today);

  // ---- Email bodies ----
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 16px 6px 0;font-size:13px;color:rgba(245,239,227,0.6);white-space:nowrap;">${label}</td><td style="padding:6px 0;font-size:15px;color:#f5efe3;font-weight:600;">${value}</td></tr>`;
  const eventBlocks = perEvent
    .map(
      (e) => `
    <div style="margin:0 0 20px;padding:16px 18px;border:1px solid rgba(245,239,227,0.12);border-radius:12px;">
      <div style="font-size:16px;font-weight:700;color:#f5efe3;">${e.name}${e.date ? ` · ${e.date}` : ""}</div>
      <table style="margin-top:8px;border-collapse:collapse;">
        ${row("Sold today", `${e.todayTickets} ticket${e.todayTickets === 1 ? "" : "s"} · ${gbp(e.todayPence)}`)}
        ${row("Total sold", `${e.totalTickets} ticket${e.totalTickets === 1 ? "" : "s"} · ${gbp(e.totalPence)}  <span style="color:rgba(245,239,227,0.5);font-weight:400;">(of ${e.cap})</span>`)}
      </table>
    </div>`,
    )
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#0c0c0c;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c0c0c;padding:28px 0;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#141414;border-radius:16px;overflow:hidden;">
  <tr><td style="padding:26px 28px 6px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#D65139;">Comedy &amp; Bingo — ticket sales</div>
    <div style="font-size:13px;color:rgba(245,239,227,0.6);margin-top:4px;">${todayPretty}</div>
  </td></tr>
  <tr><td style="padding:14px 28px 4px;">${eventBlocks}</td></tr>
  <tr><td style="padding:4px 28px 26px;">
    <div style="padding:16px 18px;border:1px solid #D65139;border-radius:12px;background:rgba(214,81,57,0.06);">
      <table style="border-collapse:collapse;">
        ${row("<strong style='color:#f5efe3'>Today — all nights</strong>", `<strong>${grandTodayTickets} · ${gbp(grandTodayPence)}</strong>`)}
        ${row("<strong style='color:#f5efe3'>Total — all nights</strong>", `<strong>${grandTotalTickets} · ${gbp(grandTotalPence)}</strong>`)}
      </table>
    </div>
  </td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    `COMEDY & BINGO — TICKET SALES`,
    todayPretty,
    "",
    ...perEvent.flatMap((e) => [
      `${e.name}${e.date ? ` · ${e.date}` : ""}`,
      `  Sold today: ${e.todayTickets} ticket${e.todayTickets === 1 ? "" : "s"} · ${gbp(e.todayPence)}`,
      `  Total sold: ${e.totalTickets} ticket${e.totalTickets === 1 ? "" : "s"} · ${gbp(e.totalPence)} (of ${e.cap})`,
      "",
    ]),
    `TODAY — all nights: ${grandTodayTickets} · ${gbp(grandTodayPence)}`,
    `TOTAL — all nights: ${grandTotalTickets} · ${gbp(grandTotalPence)}`,
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: SENDER,
      to: RECIPIENTS,
      reply_to: REPLY_TO,
      subject: `Comedy & Bingo sales — ${grandTodayTickets} today, ${grandTotalTickets} total (${gbp(grandTotalPence)})`,
      html,
      text,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return jsonResponse(
      { error: `Resend failed (${res.status}): ${t}` },
      { status: 502 },
    );
  }
  const rj = await res.json().catch(() => ({}));
  return jsonResponse({
    ok: true,
    sent_to: RECIPIENTS,
    resend_id: rj?.id ?? null,
    today: { tickets: grandTodayTickets, pence: grandTodayPence },
    total: { tickets: grandTotalTickets, pence: grandTotalPence },
  });
});
