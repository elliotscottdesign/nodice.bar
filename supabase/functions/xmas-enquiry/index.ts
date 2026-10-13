// Supabase Edge Function: xmas-enquiry
// =============================================================
// Receives a Christmas party package enquiry from the /xmas package
// builder and emails it to info@nodice.bar via Resend (same sender
// setup as notify-big-booking). Enquiry only — no payment, no DB write.
// Deploy with verify_jwt:false (public form post).
// =============================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RECIPIENT = "info@nodice.bar";
// One function serves every party builder; `party_type` decides the wording.
const isKids = (e: Enquiry) => e.party_type === "kids";
const senderFor = (e: Enquiry) =>
  isKids(e) ? "No Dice Parties <info@nodice.bar>" : "No Dice Christmas <info@nodice.bar>";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

type Item = { name: string; price_per_head: number };
type Enquiry = {
  party_type?: string;      // "kids" | "xmas" (default xmas)
  time?: string | null;     // kids party time slot
  child_name?: string;      // kids
  child_age?: string;       // kids
  dates?: string[];
  private_hire?: boolean;
  slot?: string | null;
  min_spend?: number;
  budget?: number;
  headcount?: number;
  items?: Item[];
  package_per_head?: number;
  package_total?: number;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
};

function prettyDate(isoStr: string): string {
  try {
    return new Date(`${isoStr}T12:00:00`).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return isoStr;
  }
}

function buildHtml(e: Enquiry, forCustomer: boolean): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:8px 14px 8px 0;color:#9a9a9a;font-size:11px;text-transform:uppercase;letter-spacing:0.14em;vertical-align:top;white-space:nowrap">${esc(label)}</td><td style="padding:8px 0;color:#1a1a1a;font-size:14px">${value}</td></tr>`;
  const money = (n: unknown) => `£${Number(n ?? 0).toLocaleString()}`;

  const dates =
    e.dates && e.dates.length
      ? e.dates.map(prettyDate).map(esc).join("<br>")
      : "—";
  const items =
    e.items && e.items.length
      ? e.items
          .map((i) => `${esc(i.name)} <span style="color:#9a9a9a">(£${esc(i.price_per_head)}/head)</span>`)
          .join("<br>")
      : "None selected";

  const kids = isKids(e);
  const title = forCustomer
    ? (kids ? "Your No Dice kids' party" : "Your No Dice Christmas party")
    : (kids ? "🎈 Kids party enquiry" : "🎄 Christmas party enquiry");
  const intro = forCustomer
    ? `Thanks ${esc((e.name || "").split(" ")[0])} — here's the party you built. Our team will be in touch to confirm availability and send a firm quote.`
    : (kids ? "From the kids-party builder" : "From the /xmas package builder");
  const headLabel = kids ? "Children" : "Headcount";

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto">
    <h2 style="font-size:20px;color:#c0392b;margin:0 0 4px">${title}</h2>
    <p style="color:#666;font-size:13px;margin:0 0 18px">${intro}</p>
    <table style="width:100%;border-collapse:collapse">
      ${forCustomer ? "" : row("Name", esc(e.name))}
      ${forCustomer ? "" : row("Email", `<a href="mailto:${esc(e.email)}" style="color:#c0392b">${esc(e.email)}</a>`)}
      ${!forCustomer && e.phone ? row("Phone", esc(e.phone)) : ""}
      ${!forCustomer && e.company ? row("Company", esc(e.company)) : ""}
      ${kids && e.child_name ? row("Birthday child", `${esc(e.child_name)}${e.child_age ? ` (turning ${esc(e.child_age)})` : ""}`) : ""}
      ${row(headLabel, esc(e.headcount ?? "—"))}
      ${row("Preferred dates", dates)}
      ${kids ? (e.time ? row("Time slot", esc(e.time)) : "") : row("Private hire", e.private_hire ? `${esc(e.slot || "Yes")} · min spend ${money(e.min_spend)}` : "No")}
      ${e.budget && (kids || !e.private_hire) ? row("Budget", money(e.budget)) : ""}
      ${row("Packages", items)}
      ${row("Package total", `${money(e.package_total)} <span style="color:#9a9a9a">(£${esc(e.package_per_head ?? 0)}/head)</span>`)}
      ${e.notes ? row("Notes", esc(e.notes).replace(/\n/g, "<br>")) : ""}
    </table>
    <p style="color:#999;font-size:11px;margin-top:20px">${forCustomer ? "This is an enquiry, not a confirmed booking — we'll be in touch shortly." : "Reply straight to this email to reach the customer."}</p>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!RESEND_API_KEY) return json({ error: "Email not configured" }, 500);

  let e: Enquiry;
  try {
    e = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!e.name || !e.name.trim()) return json({ error: "Name is required" }, 400);
  if (!e.email || !EMAIL_RE.test(e.email)) {
    return json({ error: "A valid email is required" }, 400);
  }
  if (!e.headcount || e.headcount < 1) {
    return json({ error: "Headcount is required" }, 400);
  }

  const kids = isKids(e);
  const SENDER = senderFor(e);
  const send = (to: string[], subject: string, html: string, replyTo?: string) =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: SENDER, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });

  // 1) The team enquiry (the one that must land). Reply goes to the customer.
  const teamSubject = kids
    ? `🎈 Kids party enquiry — ${e.name}, ${e.headcount} children`
    : `🎄 Xmas party enquiry — ${e.name}${e.company ? ` (${e.company})` : ""}, ${e.headcount} guests`;
  const teamRes = await send([RECIPIENT], teamSubject, buildHtml(e, false), e.email);
  if (!teamRes.ok) {
    const txt = await teamRes.text().catch(() => "");
    return json({ error: `Email send failed: ${txt.slice(0, 200)}` }, 502);
  }

  // 2) The customer's copy of their package — best-effort; a failure here
  // doesn't fail the enquiry (the team already has it).
  try {
    await send(
      [e.email!],
      kids ? "Your No Dice kids' party 🎈" : "Your No Dice Christmas party package 🎄",
      buildHtml(e, true),
      RECIPIENT,
    );
  } catch {
    // ignore — team copy already sent
  }

  return json({ ok: true });
});
