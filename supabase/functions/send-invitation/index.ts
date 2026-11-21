// =============================================================
// send-invitation — email a booking's party invitation to the customer
// =============================================================
// POST { reservation_id, to_email? }
//
// The office builds a party invitation on a booking (the 🎟 Invitation maker on
// /admin/table-reservations) and can then email it to the customer straight
// from the booking card. Sends the saved invitation (the portrait poster) via
// Resend from info@nodice.bar — the same channel as booking confirmations and
// voucher sends — embedded in the email AND attached as a PNG the customer can
// save/forward to their guests. Deploy --no-verify-jwt (the admin calls it with
// the anon key, like the other table-reservation edge calls).
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SENDER = "No Dice <info@nodice.bar>";
const REPLY_TO = "info@nodice.bar";
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

function prettyDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

async function fetchBase64(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return btoa(bin);
  } catch {
    return null;
  }
}

function emailHtml(v: { name: string | null; when: string; posterUrl: string }): string {
  const greeting = v.name ? `Hi ${esc(v.name.split(" ")[0])},` : "Hello,";
  const whenLine = v.when ? ` on <strong>${esc(v.when)}</strong>` : "";
  return `<!doctype html><html><body style="margin:0;background:#f5f2ea;font-family:Helvetica,Arial,sans-serif;color:#1d1a16">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ea;padding:24px 0">
   <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;padding:28px;max-width:480px">
     <tr><td style="font-size:22px;font-weight:800;letter-spacing:.04em;text-transform:uppercase">Your No Dice invitation</td></tr>
     <tr><td style="padding:12px 0;font-size:15px;line-height:1.5">${greeting}<br/>We can't wait to have you${whenLine}! Here's your party invitation — feel free to share it with your guests.</td></tr>
     <tr><td style="padding:8px 0 16px"><img src="${esc(v.posterUrl)}" alt="No Dice party invitation" style="width:100%;max-width:420px;border-radius:12px;border:1px solid #e5e0d5"/></td></tr>
     <tr><td style="padding-top:8px;font-size:13px;color:#8a8275">No Dice · London Fields · 407 Mentmore Terrace · E8 3PH · nodice.bar</td></tr>
     <tr><td style="padding-top:14px;font-size:14px;line-height:1.5">See you soon,<br/>The No Dice Team</td></tr>
    </table>
   </td></tr>
  </table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!RESEND_API_KEY) return json({ error: "Email is not configured." }, 500);

  let b: { reservation_id?: string; to_email?: string };
  try {
    b = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!b.reservation_id) return json({ error: "No booking given." }, 400);

  const { data: r, error } = await db
    .from("bar_reservations")
    .select("id, name, email, reservation_date, start_time, poster_url")
    .eq("id", b.reservation_id)
    .maybeSingle();
  if (error || !r) return json({ error: "Booking not found." }, 404);
  if (!r.poster_url) return json({ error: "There's no invitation saved on this booking yet." }, 400);

  const to = (b.to_email ?? r.email ?? "").trim();
  if (!EMAIL_RE.test(to)) {
    return json({ error: "This booking has no valid customer email to send to." }, 400);
  }

  const attachments: { filename: string; content: string }[] = [];
  const b64 = await fetchBase64(r.poster_url);
  if (b64) attachments.push({ filename: "no-dice-invitation.png", content: b64 });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: SENDER,
      to,
      reply_to: REPLY_TO,
      subject: "Your No Dice party invitation 🎟",
      html: emailHtml({ name: r.name, when: prettyDate(r.reservation_date), posterUrl: r.poster_url }),
      attachments: attachments.length ? attachments : undefined,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return json({ error: `Send failed: HTTP ${res.status} ${txt}` }, 502);
  }

  return json({ ok: true, sent_to: to });
});
