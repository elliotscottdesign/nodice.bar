// =============================================================
// No Dice — send-pool-confirmation
// =============================================================
// POST /functions/v1/send-pool-confirmation
// Body: { reservation_id: string, include_notes?: boolean }
//
// Sends the customer a No Dice-branded confirmation email after
// a bar_reservations row (kind = 'pool' OR 'table') is confirmed.
//
// Called from two paths:
//  1. stripe-webhook — customer-side paid pool booking → include_notes
//     defaults to true so any notes the customer typed in themselves
//     come back to them.
//  2. AddReservationForm (admin manual entry) — staff types in a phone
//     booking; if the "Send confirmation email" box is ticked, this
//     function fires. include_notes is only true if the admin also
//     ticks the "Include staff notes in email" box (default off), so
//     internal notes stay internal by default.
//
// Kept the historic function name send-pool-confirmation for
// backwards compatibility with the existing stripe-webhook wiring.
// It also handles table reservations now — the copy branches on
// bar_reservations.kind.
//
// Sender: info@nodice.bar via Resend HTTP API.
// Auth:   JWT verification ON. The webhook calls with the service-
//         role key, admin calls with the admin's own JWT.
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

type PoolAddon = {
  date: string;
  startTime: string;
  duration: string;
  amount: string;
  paid: boolean;
  payUrl: string | null;
};

function renderEmailHtml(o: {
  kind: "pool" | "table";
  firstName: string;
  bookingDate: string;
  startTime: string;
  duration: string;
  partySize: number;
  amountPaid: string;
  notes: string | null;
  officeReview?: boolean;
  poolAddon?: PoolAddon | null;
}): string {
  const isPool = o.kind === "pool";
  // Office-review variant (busy-day hold): a warm "with our team" message,
  // NOT a confirmation — nothing's guaranteed until staff come back.
  const kicker = o.officeReview
    ? "Request received"
    : isPool
    ? "Pool table confirmed"
    : "Table confirmed";
  const headline = o.officeReview
    ? `${o.firstName}, your request is with our team.`
    : isPool
    ? `${o.firstName}, your pool table's locked in.`
    : `${o.firstName}, your table's locked in.`;
  const introLine = o.officeReview
    ? "Thanks for booking with us. It's a busy day, so to make sure we can look after you properly a member of our team will be in touch shortly to confirm the details. Nothing's held just yet — we'll sort it out with you first."
    : o.amountPaid && o.amountPaid !== "£0"
    ? "Payment landed — see you on the night. Bring this email or just show up with your name at the door."
    : "See you on the night. Bring this email or just show up with your name at the door.";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${kicker}</title></head>
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
            <div style="font-size:10px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#DA1B33;margin-bottom:12px;">${kicker}</div>
            <h1 style="margin:0 0 16px;font-size:28px;line-height:1.1;letter-spacing:0.02em;font-weight:900;color:#f5efe3;">${headline}</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:rgba(245,239,227,0.85);">
              ${introLine}
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
              ${
                o.amountPaid && o.amountPaid !== "£0"
                  ? `<tr>
                <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(245,239,227,0.55);vertical-align:top;">Paid</td>
                <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:15px;color:#f5efe3;">${o.amountPaid}</td>
              </tr>`
                  : ""
              }
              ${
                o.notes
                  ? `<tr>
                <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(245,239,227,0.55);vertical-align:top;">Your notes</td>
                <td style="padding:14px 0;border-top:1px solid rgba(245,239,227,0.12);font-size:15px;color:#f5efe3;">${o.notes}</td>
              </tr>`
                  : ""
              }
            </table>
            ${
              o.poolAddon
                ? `<div style="margin-top:8px;padding:20px;border:1px solid rgba(218,27,51,0.35);border-radius:12px;background:rgba(218,27,51,0.06);">
              <div style="font-size:10px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#DA1B33;margin-bottom:10px;">🎱 Pool table added</div>
              <div style="font-size:15px;color:#f5efe3;line-height:1.6;">
                We've added a pool table to your booking: <strong>${o.poolAddon.duration}</strong> from <strong>${o.poolAddon.startTime}</strong>${o.poolAddon.date && o.poolAddon.date !== o.bookingDate ? ` on <strong>${o.poolAddon.date}</strong>` : ""}.
              </div>
              <div style="margin-top:10px;font-size:15px;color:#f5efe3;">Pool fee: <strong>${o.poolAddon.amount}</strong>${o.poolAddon.paid ? ` <span style="color:#3ba55d;font-weight:700;">— paid, thank you!</span>` : ""}</div>
              ${
                !o.poolAddon.paid && o.poolAddon.payUrl
                  ? `<div style="margin-top:16px;">
                <a href="${o.poolAddon.payUrl}" style="display:inline-block;background:#DA1B33;color:#fff;text-decoration:none;font-weight:800;font-size:15px;letter-spacing:0.02em;padding:14px 28px;border-radius:999px;">Pay for pool →</a>
              </div>
              <div style="margin-top:10px;font-size:13px;color:rgba(245,239,227,0.6);">Pay whenever suits — the link stays live. You're all set either way; it just saves time on the night.</div>`
                  : ""
              }
            </div>`
                : ""
            }
            <div style="margin-top:32px;padding-top:24px;border-top:1px solid rgba(245,239,227,0.12);">
              <div style="font-size:10px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#DA1B33;margin-bottom:8px;">Where</div>
              <div style="font-size:15px;color:#f5efe3;line-height:1.55;">${VENUE_NAME}<br>${VENUE_ADDRESS}</div>
            </div>
            <div style="margin-top:24px;padding-top:24px;border-top:1px solid rgba(245,239,227,0.12);">
              <div style="font-size:10px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#DA1B33;margin-bottom:8px;">${o.officeReview ? "What happens next" : "On the night"}</div>
              <div style="font-size:14px;color:rgba(245,239,227,0.85);line-height:1.6;">
                ${
                  o.officeReview
                    ? "We'll be in touch at this email (or by phone if you left a number) to confirm we can seat your group and sort any details. If you'd rather talk it through now, just reply to this email."
                    : isPool
                    ? "We hold the table for 15 minutes past your slot. After that we may give it to walk-ins, so please arrive on time. The table's set up and chalked when you get there — just say your name at the bar."
                    : "We hold your table for 15 minutes past your slot. After that we may give it to walk-ins, so please arrive on time. Just say your name at the door and the team will bring you over."
                }
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
  kind: "pool" | "table";
  firstName: string;
  bookingDate: string;
  startTime: string;
  duration: string;
  partySize: number;
  amountPaid: string;
  notes: string | null;
  officeReview?: boolean;
  poolAddon?: PoolAddon | null;
}): string {
  const isPool = o.kind === "pool";
  const kicker = o.officeReview
    ? "REQUEST RECEIVED"
    : isPool
    ? "POOL TABLE CONFIRMED"
    : "TABLE CONFIRMED";
  const headline = o.officeReview
    ? `${o.firstName}, your request is with our team.`
    : isPool
    ? `${o.firstName}, your pool table's locked in.`
    : `${o.firstName}, your table's locked in.`;
  const paid = o.amountPaid && o.amountPaid !== "£0";
  const introLine = o.officeReview
    ? "Thanks for booking with us. It's a busy day, so to make sure we can look after you properly a member of our team will be in touch shortly to confirm the details. Nothing's held just yet — we'll sort it out with you first."
    : paid
    ? "Payment landed — see you on the night. Bring this email or just show up with your name at the door."
    : "See you on the night. Bring this email or just show up with your name at the door.";
  const onTheNight = o.officeReview
    ? "We'll be in touch at this email (or by phone if you left a number) to confirm we can seat your group and sort any details. If you'd rather talk it through now, just reply to this email."
    : isPool
    ? "We hold the table for 15 minutes past your slot. After that we may give it to walk-ins, so please arrive on time. The table's set up and chalked when you get there — just say your name at the bar."
    : "We hold your table for 15 minutes past your slot. After that we may give it to walk-ins, so please arrive on time. Just say your name at the door and the team will bring you over.";
  return [
    `NO DICE — LONDON FIELDS, HACKNEY`,
    ``,
    kicker,
    ``,
    headline,
    ``,
    introLine,
    ``,
    `Date:       ${o.bookingDate}`,
    `Start time: ${o.startTime}`,
    `Length:     ${o.duration}`,
    `Party size: ${o.partySize}`,
    paid ? `Paid:       ${o.amountPaid}` : "",
    o.notes ? `Your notes: ${o.notes}` : "",
    ``,
    ...(o.poolAddon
      ? [
          `POOL TABLE ADDED`,
          `We've added a pool table: ${o.poolAddon.duration} from ${o.poolAddon.startTime}${o.poolAddon.date && o.poolAddon.date !== o.bookingDate ? ` on ${o.poolAddon.date}` : ""}.`,
          `Pool fee: ${o.poolAddon.amount}${o.poolAddon.paid ? " (paid, thank you!)" : ""}`,
          ...(!o.poolAddon.paid && o.poolAddon.payUrl
            ? [`Pay for pool: ${o.poolAddon.payUrl}`, `Pay whenever suits — the link stays live.`]
            : []),
          ``,
        ]
      : []),
    `WHERE`,
    `${VENUE_NAME}`,
    `${VENUE_ADDRESS}`,
    ``,
    o.officeReview ? `WHAT HAPPENS NEXT` : `ON THE NIGHT`,
    onTheNight,
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

  let body: {
    reservation_id?: string;
    include_notes?: boolean;
    office_review?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { reservation_id } = body;
  // include_notes defaults to true for backwards compatibility with the
  // existing stripe-webhook call — customer-side "notes" are the
  // customer's own instructions (e.g. wheelchair access) that they
  // expect to see in their confirmation. Admin manual entry passes
  // include_notes: false unless the staff ticks "Include staff notes
  // in email" (default off) — internal notes stay internal.
  const includeNotes = body.include_notes !== false;
  // Busy-day hold: send the "with our team, we'll be in touch" variant
  // instead of a confirmation. Caller (create-table-reservation) sets this
  // when the day is over DAILY_CAPACITY.
  const officeReview = body.office_review === true;
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
  if (r.kind !== "pool" && r.kind !== "table") {
    return jsonResponse(
      { error: `Unsupported reservation kind: ${r.kind}` },
      { status: 400 },
    );
  }

  const kind = r.kind as "pool" | "table";
  const firstName = (r.name ?? "").split(" ")[0] || r.name || "there";

  // Pool add-on — office may have added pool time to this TABLE booking
  // (a linked kind='pool' row). If so, surface it IN this one email with
  // its pay link, rather than a separate pool confirmation. Only the most
  // recent non-cancelled add-on is shown. Never for pool rows themselves.
  let poolAddon:
    | {
        date: string;
        startTime: string;
        duration: string;
        amount: string;
        paid: boolean;
        payUrl: string | null;
      }
    | null = null;
  if (kind === "table") {
    const { data: addon } = await db
      .from("bar_reservations")
      .select(
        "reservation_date, start_time, duration_minutes, amount_pence, status, pool_pay_url",
      )
      .eq("parent_reservation_id", r.id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (addon) {
      poolAddon = {
        date: formatDate(addon.reservation_date),
        startTime: formatTime(addon.start_time),
        duration: formatDuration(addon.duration_minutes),
        amount: formatPounds(addon.amount_pence ?? 0),
        paid: addon.status === "paid",
        payUrl: addon.pool_pay_url ?? null,
      };
    }
  }

  const opts = {
    kind,
    firstName,
    bookingDate: formatDate(r.reservation_date),
    startTime: formatTime(r.start_time),
    duration: formatDuration(r.duration_minutes),
    partySize: r.party_size,
    amountPaid: formatPounds(r.amount_pence ?? 0),
    notes: includeNotes ? r.notes : null,
    officeReview,
    poolAddon,
  };

  const subject = officeReview
    ? `Request received — we'll be in touch · ${opts.bookingDate}`
    : kind === "pool"
    ? `Pool table confirmed — ${opts.bookingDate} ${opts.startTime}`
    : `Table confirmed — ${opts.bookingDate} ${opts.startTime}`;

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
      subject,
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
