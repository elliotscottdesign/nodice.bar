// =============================================================
// voucher-redeem — take value off a voucher on the till
// =============================================================
// POST { code, amount_pence, staff?, secret? }
//
// This is the endpoint the tills + staff profile system call to redeem a No
// Dice voucher against a bill. It is the single source of truth for the money,
// so a photocopied voucher can't be spent twice — the balance lives here.
//
// Rule (founder): a voucher is valid for 1 year. The FIRST day it is used, the
// whole value becomes spendable and change accrues across that day's redemptions
// — but anything left at the END of that first-use day is void. No change is
// carried to another day. So: redemptions are allowed only while
// first_redeemed_on is today (or unset, which sets it to today).
//
// Guard: if VOUCHER_SECRET is set in the project, the caller must pass it.
// Deploy --no-verify-jwt.
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
const VOUCHER_SECRET = Deno.env.get("VOUCHER_SECRET") ?? "";
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Today in the venue's timezone, as YYYY-MM-DD.
function londonToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let b: { code?: string; amount_pence?: number; staff?: string; secret?: string };
  try {
    b = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (VOUCHER_SECRET && b.secret !== VOUCHER_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }

  const code = (b.code ?? "").trim().toUpperCase();
  const amount = Math.round(Number(b.amount_pence) || 0);
  if (!code) return json({ error: "No voucher code given." }, 400);
  if (!(amount > 0)) return json({ error: "Enter an amount to redeem." }, 400);

  const { data: v, error } = await db
    .from("vouchers")
    .select("id, code, value_pence, balance_pence, status, expires_at, first_redeemed_on")
    .eq("code", code)
    .maybeSingle();
  if (error) return json({ error: "Lookup failed." }, 500);
  if (!v) return json({ found: false, error: "Voucher not found." }, 404);

  if (v.status === "cancelled")
    return json({ found: true, error: "This voucher has been cancelled." }, 409);
  if (v.status === "redeemed")
    return json({ found: true, error: "This voucher has already been fully used." }, 409);

  const today = londonToday();
  const expiresDate = String(v.expires_at).slice(0, 10);

  // Past its 1-year validity.
  if (today > expiresDate) {
    if (v.status !== "expired")
      await db.from("vouchers").update({ status: "expired" }).eq("id", v.id);
    return json({ found: true, error: "This voucher has expired." }, 409);
  }

  // Used on an earlier day → the first-use day has passed, balance is void.
  if (v.first_redeemed_on && String(v.first_redeemed_on).slice(0, 10) !== today) {
    if (v.status !== "expired")
      await db.from("vouchers").update({ status: "expired" }).eq("id", v.id);
    return json(
      {
        found: true,
        error: `This voucher was first used on ${v.first_redeemed_on} and had to be spent in full that day — the remaining balance has expired.`,
      },
      409,
    );
  }

  const balance = v.balance_pence ?? 0;
  if (balance <= 0)
    return json({ found: true, error: "This voucher has no balance left." }, 409);

  const take = Math.min(amount, balance);
  const newBalance = balance - take;
  const fullyUsed = newBalance === 0;

  const { error: upErr } = await db
    .from("vouchers")
    .update({
      balance_pence: newBalance,
      first_redeemed_on: v.first_redeemed_on ?? today,
      status: fullyUsed ? "redeemed" : "active",
      redeemed_at: fullyUsed ? new Date().toISOString() : null,
    })
    .eq("id", v.id);
  if (upErr) return json({ error: "Could not update the voucher." }, 500);

  await db.from("voucher_redemptions").insert({
    voucher_id: v.id,
    amount_pence: take,
    balance_after_pence: newBalance,
    staff: (b.staff ?? "").slice(0, 120) || null,
  });

  return json({
    ok: true,
    code: v.code,
    redeemed_pence: take,
    balance_pence: newBalance,
    status: fullyUsed ? "redeemed" : "active",
    must_spend_today: newBalance > 0,
    message: fullyUsed
      ? "Voucher fully redeemed."
      : `£${(newBalance / 100).toFixed(2)} left — must be spent today or it's void.`,
  });
});
