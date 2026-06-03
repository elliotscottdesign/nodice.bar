// =============================================================
// Plonk Golf — send-booking-confirmation
// =============================================================
// POST /functions/v1/send-booking-confirmation
// Body: { booking_id: string }
//
// Sends the customer's booking-confirmation email via Gmail SMTP
// (using a Google App Password for bookings@plonkgolf.co.uk).
//
// Called from `stripe-webhook` the moment a booking transitions
// to `confirmed`. Can also be re-invoked from an admin "resend"
// button in the future — the function is idempotent in spirit
// (the customer just gets another copy).
//
// Auth: this function leaves JWT verification ON. Callers must
// present a valid Supabase JWT. The webhook calls us with
// SUPABASE_SERVICE_ROLE_KEY in the Authorization header — that
// counts as a valid JWT and gives us a simple internal-only
// gate without inventing yet another shared secret.
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

// ---------- inlined CORS helpers (kept here so the function is self-
//            contained for the Supabase Dashboard paste-and-deploy flow) ----
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
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SMTP_USERNAME = Deno.env.get("SMTP_USERNAME") ?? "";
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD") ?? "";

// Gmail App Passwords must send `From:` matching the authenticated user,
// so FROM_EMAIL is always SMTP_USERNAME — no override.
const FROM_NAME = "Plonk Golf";
const REPLY_TO = "bookings@plonkgolf.co.uk";

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------- formatting helpers ----------
function formatGBP(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  // iso = "YYYY-MM-DD" — render as "Saturday 12 July 2025"
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatTime(t: string): string {
  // Postgres `time` comes back as "HH:MM:SS" — trim to HH:MM
  return t.slice(0, 5);
}

// ---------- email composition ----------
type Booking = {
  id: string;
  reference: string;
  status: string;
  customer_name: string;
  customer_email: string;
  party_size: number;
  subtotal_pence: number;
  discount_pence: number;
  total_pence: number;
  venue: { name: string; slug: string };
  slots: Array<{ slot_date: string; slot_time: string; count: number }>;
  tickets: Array<{
    quantity: number;
    unit_price_pence: number;
    ticket: { name: string };
  }>;
  addons: Array<{
    quantity: number;
    unit_price_pence: number;
    addon: { name: string };
  }>;
};

function composeEmail(booking: Booking): {
  subject: string;
  text: string;
  html: string;
} {
  const venueName = booking.venue.name;
  const slots = [...booking.slots].sort((a, b) =>
    a.slot_time < b.slot_time ? -1 : 1,
  );
  const date = formatDate(slots[0].slot_date);
  const timesLine = slots.map((s) => formatTime(s.slot_time)).join(", ");
  const firstName = booking.customer_name.split(" ")[0] || booking.customer_name;

  const ticketLines = booking.tickets.map(
    (t) =>
      `${t.quantity} × ${t.ticket.name} — ${formatGBP(
        t.unit_price_pence * t.quantity,
      )}`,
  );
  const addonLines = (booking.addons ?? []).map(
    (a) =>
      `${a.quantity} × ${a.addon.name} — ${formatGBP(
        a.unit_price_pence * a.quantity,
      )}`,
  );

  // Subject is kept pure-ASCII on purpose. The em dash (—) used in the body
  // looks fine there because the body is properly Quoted-Printable encoded,
  // but in the subject line denomailer's encoded-word splitter produces an
  // RFC 2047-invalid line break inside the encoded-word for any non-ASCII
  // character. Gmail then mis-parses the headers and shows the raw MIME
  // source as the message body. Plain dash → none of that happens.
  const subject =
    `Booking confirmed - ${venueName} on ${date} (${booking.reference})`;

  // ---------- plain text ----------
  const totalsLines = booking.discount_pence > 0
    ? [
      `Subtotal: ${formatGBP(booking.subtotal_pence)}`,
      `Discount: -${formatGBP(booking.discount_pence)}`,
      `Total paid: ${formatGBP(booking.total_pence)}`,
    ]
    : [`Total paid: ${formatGBP(booking.total_pence)}`];

  const text = [
    `Hi ${firstName},`,
    ``,
    `Your booking at Plonk Golf — ${venueName} is confirmed.`,
    ``,
    `Date: ${date}`,
    `Time${slots.length > 1 ? "s" : ""}: ${timesLine}`,
    `Party size: ${booking.party_size}`,
    `Reference: ${booking.reference}`,
    ``,
    `What you booked:`,
    ...ticketLines.map((l) => `  • ${l}`),
    ...(addonLines.length
      ? [``, `Extras:`, ...addonLines.map((l) => `  • ${l}`)]
      : []),
    ``,
    ...totalsLines,
    ``,
    `Before you arrive:`,
    `  • Please get there 10 minutes before your first tee time.`,
    `  • Your reference is ${booking.reference} — keep this handy.`,
    `  • Need to change something? Just reply to this email.`,
    ``,
    `See you soon,`,
    `The Plonk Golf team`,
  ].join("\n");

  // ---------- HTML ----------
  const totalsHtml = booking.discount_pence > 0
    ? `Subtotal: ${formatGBP(booking.subtotal_pence)}<br>
       Discount: -${formatGBP(booking.discount_pence)}<br>
       <strong>Total paid: ${formatGBP(booking.total_pence)}</strong>`
    : `<strong>Total paid: ${formatGBP(booking.total_pence)}</strong>`;

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#F2EBD9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0E2A21;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <h1 style="font-family:'DM Serif Display',Georgia,serif;font-size:32px;line-height:1.1;margin:0 0 4px;color:#0E2A21;">Booking confirmed</h1>
    <p style="color:#4a5d52;margin:0 0 28px;font-size:14px;letter-spacing:0.02em;">Reference <strong>${booking.reference}</strong></p>

    <p style="margin:0 0 12px;">Hi ${firstName},</p>
    <p style="margin:0 0 20px;">Your booking at <strong>Plonk Golf — ${venueName}</strong> is confirmed.</p>

    <div style="background:#ffffff;border-left:4px solid #E8C547;padding:16px 20px;margin:20px 0;border-radius:2px;">
      <p style="margin:0 0 6px;"><strong>Date:</strong> ${date}</p>
      <p style="margin:0 0 6px;"><strong>Time${slots.length > 1 ? "s" : ""}:</strong> ${timesLine}</p>
      <p style="margin:0;"><strong>Party size:</strong> ${booking.party_size}</p>
    </div>

    <h3 style="margin:28px 0 8px;font-size:16px;">What you booked</h3>
    <ul style="padding-left:20px;margin:0 0 8px;">
      ${ticketLines.map((l) => `<li style="margin:4px 0;">${l}</li>`).join("")}
    </ul>

    ${
    addonLines.length
      ? `<h3 style="margin:24px 0 8px;font-size:16px;">Extras</h3>
    <ul style="padding-left:20px;margin:0 0 8px;">
      ${addonLines.map((l) => `<li style="margin:4px 0;">${l}</li>`).join("")}
    </ul>`
      : ""
  }

    <p style="margin:24px 0 4px;">${totalsHtml}</p>

    <hr style="border:none;border-top:1px solid #C7BFA9;margin:32px 0 20px;">

    <p style="margin:0 0 8px;"><strong>Before you arrive</strong></p>
    <ul style="padding-left:20px;margin:0 0 16px;">
      <li style="margin:4px 0;">Please get there 10 minutes before your first tee time.</li>
      <li style="margin:4px 0;">Your reference is <strong>${booking.reference}</strong> — keep this handy.</li>
      <li style="margin:4px 0;">Need to change something? Just reply to this email.</li>
    </ul>

    <p style="margin-top:32px;">See you soon,<br><strong>The Plonk Golf team</strong></p>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

// ---------- handler ----------
Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") {
    return jsonResponse({ error: "POST only" }, { status: 405 });
  }

  if (!SMTP_USERNAME || !SMTP_PASSWORD) {
    return jsonResponse(
      { error: "SMTP_USERNAME / SMTP_PASSWORD not configured" },
      { status: 500 },
    );
  }

  let body: { booking_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, { status: 400 });
  }

  const bookingId = (body.booking_id ?? "").trim();
  if (!bookingId) {
    return jsonResponse({ error: "booking_id is required" }, { status: 400 });
  }

  const { data: booking, error } = await db
    .from("bookings")
    .select(`
      id, reference, status,
      customer_name, customer_email, party_size,
      subtotal_pence, discount_pence, total_pence,
      venue:venues!inner(name, slug),
      slots:booking_slots(slot_date, slot_time, count),
      tickets:booking_tickets(quantity, unit_price_pence, ticket:tickets(name)),
      addons:booking_addons(quantity, unit_price_pence, addon:addons(name))
    `)
    .eq("id", bookingId)
    .maybeSingle();

  if (error) return jsonResponse({ error: error.message }, { status: 500 });
  if (!booking) {
    return jsonResponse({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.status !== "confirmed") {
    return jsonResponse(
      {
        error: `Booking is "${booking.status}", not confirmed — not sending email`,
      },
      { status: 409 },
    );
  }

  const { subject, text, html } = composeEmail(booking as unknown as Booking);

  // Strip trailing whitespace from every line. Without this, blank lines that
  // contain only indentation spaces get quoted-printable-encoded as `=20` and
  // some mail clients (Gmail, Outlook) render the `=20` literally instead of
  // decoding it back to a space.
  const stripTrailingWs = (s: string) =>
    s.split("\n").map((line) => line.replace(/[ \t]+$/g, "")).join("\n");
  const cleanText = stripTrailingWs(text);
  const cleanHtml = stripTrailingWs(html);

  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: SMTP_USERNAME, password: SMTP_PASSWORD },
    },
  });

  try {
    await client.send({
      from: `${FROM_NAME} <${SMTP_USERNAME}>`,
      to: booking.customer_email,
      replyTo: REPLY_TO,
      subject,
      content: cleanText,
      html: cleanHtml,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      await client.close();
    } catch { /* ignore */ }
    console.error(`SMTP send failed for booking ${bookingId}: ${msg}`);
    return jsonResponse({ error: `SMTP send failed: ${msg}` }, { status: 502 });
  }

  await client.close();

  console.log(
    `Confirmation email sent for booking ${booking.reference} → ${booking.customer_email}`,
  );

  return jsonResponse({
    ok: true,
    sent_to: booking.customer_email,
    reference: booking.reference,
  });
});
