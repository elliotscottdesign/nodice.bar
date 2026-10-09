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
const SENDER = "No Dice Christmas <info@nodice.bar>";
const RECIPIENT = "info@nodice.bar";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

type Item = { name: string; price_per_head: number };
type Enquiry = {
  dates?: string[];
  private_hire?: boolean;
  slot?: string | null;
  headcount?: number;
  items?: Item[];
  estimate_per_head?: number;
  estimate_total?: number;
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

function buildHtml(e: Enquiry): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:8px 14px 8px 0;color:#9a9a9a;font-size:11px;text-transform:uppercase;letter-spacing:0.14em;vertical-align:top;white-space:nowrap">${esc(label)}</td><td style="padding:8px 0;color:#1a1a1a;font-size:14px">${value}</td></tr>`;

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

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto">
    <h2 style="font-size:20px;color:#c0392b;margin:0 0 4px">🎄 Christmas party enquiry</h2>
    <p style="color:#666;font-size:13px;margin:0 0 18px">From the /xmas package builder</p>
    <table style="width:100%;border-collapse:collapse">
      ${row("Name", esc(e.name))}
      ${row("Email", `<a href="mailto:${esc(e.email)}" style="color:#c0392b">${esc(e.email)}</a>`)}
      ${e.phone ? row("Phone", esc(e.phone)) : ""}
      ${e.company ? row("Company", esc(e.company)) : ""}
      ${row("Headcount", esc(e.headcount ?? "—"))}
      ${row("Preferred dates", dates)}
      ${row("Private hire", e.private_hire ? esc(e.slot || "Yes") : "No")}
      ${row("Packages", items)}
      ${row("Indicative total", `£${Number(e.estimate_total ?? 0).toLocaleString()} <span style="color:#9a9a9a">(£${esc(e.estimate_per_head ?? 0)}/head)</span>`)}
      ${e.notes ? row("Notes", esc(e.notes).replace(/\n/g, "<br>")) : ""}
    </table>
    <p style="color:#999;font-size:11px;margin-top:20px">Reply straight to this email to reach the customer.</p>
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

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: SENDER,
      to: [RECIPIENT],
      reply_to: e.email,
      subject: `🎄 Xmas party enquiry — ${e.name}${e.company ? ` (${e.company})` : ""}, ${e.headcount} guests`,
      html: buildHtml(e),
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return json({ error: `Email send failed: ${txt.slice(0, 200)}` }, 502);
  }

  return json({ ok: true });
});
