// =============================================================
// voucher-lookup — read-only "is this voucher genuine?" check
// =============================================================
// POST { code }  or  GET ?c=CODE
//
// Powers the public verify page behind the QR on the artwork, and gives the
// till/staff screen a quick balance read before redeeming. Returns only safe,
// non-sensitive fields. Deploy --no-verify-jwt.
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const db = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

function londonToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  let code = "";
  if (req.method === "GET") {
    code = new URL(req.url).searchParams.get("c") ?? "";
  } else if (req.method === "POST") {
    try {
      code = ((await req.json())?.code ?? "") as string;
    } catch {
      /* ignore */
    }
  } else {
    return json({ error: "GET or POST only" }, 405);
  }
  code = code.trim().toUpperCase();
  if (!code) return json({ found: false });

  const { data: v } = await db
    .from("vouchers")
    .select("code, value_pence, balance_pence, status, expires_at, first_redeemed_on")
    .eq("code", code)
    .maybeSingle();
  if (!v) return json({ found: false });

  const today = londonToday();
  const expiresDate = String(v.expires_at).slice(0, 10);
  const expired = today > expiresDate;
  const firstDay = v.first_redeemed_on ? String(v.first_redeemed_on).slice(0, 10) : null;
  const usableDay = !firstDay || firstDay === today;

  let spendable = 0;
  let status = v.status;
  if (v.status === "active" && !expired && usableDay) {
    spendable = v.balance_pence ?? 0;
  }
  if (v.status === "active" && (expired || (firstDay && !usableDay))) {
    status = "expired";
  }

  return json({
    found: true,
    code: v.code,
    value_pence: v.value_pence,
    balance_pence: v.balance_pence,
    spendable_today_pence: spendable,
    status,
    expires_at: v.expires_at,
    first_redeemed_on: v.first_redeemed_on,
  });
});
