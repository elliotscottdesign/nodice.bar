// =============================================================
// voucher-send — email a voucher to its recipient
// =============================================================
// POST { voucher_id, to_email? }
//
// Sends the voucher artwork (embedded in the email AND attached as a PNG the
// recipient can save/print), with the code, value, expiry and terms. Stamps
// sent_at on the row. Deploy --no-verify-jwt.
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

function money(pence: number): string {
  const p = Math.max(0, Math.round(pence));
  return p % 100 === 0 ? `£${p / 100}` : `£${(p / 100).toFixed(2)}`;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
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

function emailHtml(v: {
  code: string;
  value_pence: number;
  expires_at: string;
  poster_url: string | null;
  issued_to_name: string | null;
  prize_description?: string | null;
}): string {
  const prize = (v.prize_description || "").trim();
  const expiry = new Date(v.expires_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const greeting = v.issued_to_name ? `Hi ${esc(v.issued_to_name)},` : "Hello,";
  const poster = v.poster_url
    ? `<tr><td style="padding:8px 0 20px"><img src="${esc(v.poster_url)}" alt="No Dice voucher" style="width:100%;max-width:420px;border-radius:12px;border:1px solid #e5e0d5"/></td></tr>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f5f2ea;font-family:Helvetica,Arial,sans-serif;color:#1d1a16">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ea;padding:24px 0">
   <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;padding:28px;max-width:480px">
     <tr><td style="font-size:22px;font-weight:800;letter-spacing:.04em;text-transform:uppercase">No Dice Voucher</td></tr>
     <tr><td style="padding:12px 0;font-size:15px;line-height:1.5">${greeting}<br/>Here's your No Dice voucher.</td></tr>
     ${poster}
     <tr><td style="padding:4px 0">
       <table role="presentation" width="100%" style="background:#faf7f0;border:1px solid #e5e0d5;border-radius:12px">
        <tr><td style="padding:16px">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#8a8275">${prize ? "Prize" : "Value"}</div>
          <div style="font-size:${prize ? "20" : "30"}px;font-weight:800">${prize ? esc(prize) : money(v.value_pence)}</div>
          <div style="margin-top:12px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#8a8275">Voucher code</div>
          <div style="font-size:20px;font-weight:700;letter-spacing:.06em;font-family:'Courier New',monospace">${esc(v.code)}</div>
        </td></tr>
       </table>
     </td></tr>
     <tr><td style="padding:16px 0 4px;font-size:13px;line-height:1.6;color:#5a554c">
       <strong>How to use it:</strong> show this email (or the attached picture) at the bar — we'll scan the code.<br/>
       Valid until <strong>${expiry}</strong>. To be used in store, in person — not for future bookings.<br/>
       ${prize ? "Redeemable once for the experience above." : "On the day you first use it the whole value must be spent — no change is carried to another day."}
     </td></tr>
     <tr><td style="padding-top:18px;font-size:13px;color:#8a8275">No Dice · London Fields · 407 Mentmore Terrace · E8 3PH</td></tr>
    </table>
   </td></tr>
  </table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!RESEND_API_KEY) return json({ error: "Email is not configured." }, 500);

  let b: { voucher_id?: string; to_email?: string };
  try {
    b = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!b.voucher_id) return json({ error: "No voucher given." }, 400);

  const { data: v, error } = await db
    .from("vouchers")
    .select(
      "id, code, value_pence, expires_at, poster_url, issued_to_name, issued_to_email, prize_description",
    )
    .eq("id", b.voucher_id)
    .maybeSingle();
  if (error || !v) return json({ error: "Voucher not found." }, 404);

  const to = (b.to_email ?? v.issued_to_email ?? "").trim();
  if (!EMAIL_RE.test(to)) return json({ error: "No valid email to send to." }, 400);

  const attachments: { filename: string; content: string }[] = [];
  if (v.poster_url) {
    const b64 = await fetchBase64(v.poster_url);
    if (b64) attachments.push({ filename: `no-dice-voucher-${v.code}.png`, content: b64 });
  }

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
      subject: v.prize_description
        ? "Your No Dice voucher"
        : `Your No Dice voucher — ${money(v.value_pence)}`,
      html: emailHtml(v),
      attachments: attachments.length ? attachments : undefined,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return json({ error: `Send failed: HTTP ${res.status} ${txt}` }, 502);
  }

  // Stamp sent_at and remember the address we sent to.
  await db
    .from("vouchers")
    .update({ sent_at: new Date().toISOString(), issued_to_email: to })
    .eq("id", v.id)
    .then(() => {}, () => {});

  return json({ ok: true, sent_to: to });
});
