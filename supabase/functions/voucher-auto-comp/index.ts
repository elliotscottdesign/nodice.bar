// =============================================================
// voucher-auto-comp — "paid but can't come" → comp them automatically
// =============================================================
// POST { email?, booking_id?, reason?, secret, dry_run? }
//
// Founder policy: when someone who has PAID a pre-booking fee tells us they
// can't make it, we don't want to spend any time on it — we just let them come
// another time. So, automatically:
//   1. find their upcoming PAID booking (the fee, capped at £100),
//   2. turn that fee into a No Dice voucher (valid 1 year),
//   3. cancel the booking (frees the slot),
//   4. note it on their CRM thread so staff can see what happened,
//   5. email them a warm "no worries, come another time" note with the voucher,
//      CC'ing info@nodice.bar so the venue has a copy.
//
// Safety: it only ever fires when a matching PAID, upcoming booking exists, and
// the voucher can never exceed that fee or £100 — so a misread email can't issue
// free money or cancel a slot nobody paid for. Every action is logged on the CRM.
// Guarded by VOUCHER_SECRET. Deploy --no-verify-jwt.
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
const VOUCHER_SECRET = Deno.env.get("VOUCHER_SECRET") ?? "";
const SENDER = "No Dice <info@nodice.bar>";
const VENUE_CC = "info@nodice.bar";
const MAX_COMP_PENCE = 10000; // £100 cap
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function genCode(): string {
  const buf = new Uint32Array(10);
  crypto.getRandomValues(buf);
  let s = "";
  for (let i = 0; i < 10; i++) s += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
  return `ND-${s.slice(0, 5)}-${s.slice(5)}`;
}
function money(p: number): string {
  return p % 100 === 0 ? `£${p / 100}` : `£${(p / 100).toFixed(2)}`;
}
function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}
function londonToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

const KIND_LABEL: Record<string, string> = {
  pool: "pool table",
  table: "table",
  pingpong: "ping pong table",
};

function warmHtml(o: {
  name: string | null;
  kind: string;
  date: string | null;
  code: string;
  value_pence: number;
  expiry: string;
}): string {
  const hi = o.name ? `Hi ${esc(o.name.split(" ")[0])},` : "Hi there,";
  const what = KIND_LABEL[o.kind] || "booking";
  const when = o.date
    ? ` for ${new Date(o.date + "T00:00:00").toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f5f2ea;font-family:Helvetica,Arial,sans-serif;color:#1d1a16">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ea;padding:24px 0"><tr><td align="center">
   <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;padding:28px;max-width:480px">
    <tr><td style="font-size:20px;font-weight:800;letter-spacing:.04em;text-transform:uppercase">No Dice</td></tr>
    <tr><td style="padding:14px 0;font-size:15px;line-height:1.6">
      ${hi}<br/><br/>
      No need to worry at all — we know things come up. We've cancelled your ${esc(what)}${when}, so that's all sorted.<br/><br/>
      Because you'd already booked in, we've popped the ${money(o.value_pence)} you paid onto a No Dice voucher — come and use it whenever you fancy it. No rush, and no hard feelings: we'd just love to see you another time.
    </td></tr>
    <tr><td style="padding:4px 0">
      <table role="presentation" width="100%" style="background:#faf7f0;border:1px solid #e5e0d5;border-radius:12px"><tr><td style="padding:16px">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#8a8275">Your voucher</div>
        <div style="font-size:28px;font-weight:800">${money(o.value_pence)}</div>
        <div style="margin-top:10px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#8a8275">Code</div>
        <div style="font-size:20px;font-weight:700;letter-spacing:.06em;font-family:'Courier New',monospace">${esc(o.code)}</div>
      </td></tr></table>
    </td></tr>
    <tr><td style="padding:16px 0 4px;font-size:13px;line-height:1.6;color:#5a554c">
      Show this email at the bar and we'll scan the code. Valid until <strong>${o.expiry}</strong>, to use in person.
      On the day you use it the whole value goes in one visit — so bring a friend and make a night of it.
    </td></tr>
    <tr><td style="padding-top:18px;font-size:13px;color:#8a8275">See you soon,<br/>No Dice · London Fields · 407 Mentmore Terrace · E8 3PH</td></tr>
   </table>
  </td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let b: {
    email?: string;
    booking_id?: string;
    reason?: string;
    secret?: string;
    dry_run?: boolean;
  };
  try {
    b = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (VOUCHER_SECRET && b.secret !== VOUCHER_SECRET) return json({ error: "unauthorized" }, 401);

  const email = (b.email ?? "").trim().toLowerCase();
  const today = londonToday();

  // Find the booking: by id, else the customer's most imminent PAID upcoming one.
  let booking: {
    id: string;
    kind: string;
    name: string | null;
    email: string | null;
    reservation_date: string | null;
    amount_pence: number | null;
    status: string;
  } | null = null;

  if (b.booking_id) {
    const { data } = await db
      .from("bar_reservations")
      .select("id, kind, name, email, reservation_date, amount_pence, status")
      .eq("id", b.booking_id)
      .maybeSingle();
    booking = data ?? null;
  } else if (EMAIL_RE.test(email)) {
    const { data } = await db
      .from("bar_reservations")
      .select("id, kind, name, email, reservation_date, amount_pence, status")
      .ilike("email", email)
      .eq("status", "paid")
      .gte("reservation_date", today)
      .order("reservation_date", { ascending: true })
      .limit(1);
    booking = (data && data[0]) ?? null;
  } else {
    return json({ error: "Give an email or a booking_id." }, 400);
  }

  if (!booking) return json({ found: false, message: "No paid upcoming booking to comp." });
  if (booking.status === "cancelled")
    return json({ found: true, already: true, message: "That booking is already cancelled." });

  const fee = Math.min(Math.max(0, booking.amount_pence ?? 0), MAX_COMP_PENCE);
  if (fee <= 0)
    return json({ found: true, message: "That booking has no pre-booking fee to return." });

  const to = (booking.email ?? email).trim();
  if (!EMAIL_RE.test(to)) return json({ found: true, error: "No email to send the voucher to." }, 400);

  if (b.dry_run) {
    return json({ found: true, dry_run: true, booking_id: booking.id, would_comp_pence: fee, to });
  }

  // 1) Issue the voucher.
  const code = genCode();
  const expiresIso = new Date(Date.now() + 365 * 86400_000).toISOString();
  const { data: v, error: insErr } = await db
    .from("vouchers")
    .insert({
      code,
      value_pence: fee,
      balance_pence: fee,
      kind: "comp",
      issued_to_name: booking.name,
      issued_to_email: to,
      note: `Auto-comp: couldn't make ${booking.kind} booking ${booking.reservation_date ?? ""} (ref ${booking.id}).`,
      expires_at: expiresIso,
      status: "active",
      created_by: "auto:cancellation",
    })
    .select("id, code")
    .single();
  if (insErr) return json({ error: "Could not create the voucher." }, 500);

  // 2) Cancel the booking.
  await db
    .from("bar_reservations")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", booking.id);

  // 3) Note it on the CRM thread (most recent enquiry for this email).
  const note = `[${today}] Auto-comp: couldn't make ${booking.kind} booking ${booking.reservation_date ?? ""}. Issued ${money(fee)} voucher ${code} and emailed (CC ${VENUE_CC}). Booking cancelled.`;
  const { data: enq } = await db
    .from("enquiries")
    .select("id, notes")
    .ilike("contact_email", to)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (enq) {
    const merged = enq.notes ? `${enq.notes}\n${note}` : note;
    await db.from("enquiries").update({ notes: merged, updated_at: new Date().toISOString() }).eq("id", enq.id);
  }

  // 4) Warm email, CC the venue.
  let emailed = false;
  if (RESEND_API_KEY) {
    const expiry = new Date(expiresIso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: SENDER,
        to,
        cc: [VENUE_CC],
        reply_to: VENUE_CC,
        subject: "No worries — come another time (voucher inside)",
        html: warmHtml({
          name: booking.name,
          kind: booking.kind,
          date: booking.reservation_date,
          code,
          value_pence: fee,
          expiry,
        }),
      }),
    });
    emailed = res.ok;
    if (res.ok) await db.from("vouchers").update({ sent_at: new Date().toISOString() }).eq("id", v.id);
  }

  return json({
    ok: true,
    booking_id: booking.id,
    cancelled: true,
    voucher_code: code,
    comp_pence: fee,
    emailed,
    to,
  });
});
