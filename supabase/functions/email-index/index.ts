// =============================================================
// email-index — collect name->email pairs harvested from a Gmail mailbox
// =============================================================
// POST /functions/v1/email-index
// Body: { app: "nodice-crm-scanner", pairs: [{ name: string, email: string }] }
//
// A one-off Apps Script harvester (run on info@plonkgolf.co.uk, which holds the
// old Plonk-era client mail) sweeps its whole history and posts the sender/
// recipient name+email pairs here in batches. We store them normalized in
// `email_index`; a separate SQL match then fills historic_enquiries.email for
// the leads whose name maps unambiguously to one address.
//
// Guarded by the fixed app tag (same as the scanner). Deploy --no-verify-jwt.
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const APP_TAG = "nodice-crm-scanner";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Must match the SQL normalisation used when matching to historic_enquiries.
function norm(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/^(mr|mrs|ms|miss|dr)\.?\s+/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let b: { app?: string; pairs?: { name?: string; email?: string }[] };
  try {
    b = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if ((b.app ?? "") !== APP_TAG) return json({ error: "Unauthorized" }, 401);

  const rows: { name_norm: string; email: string; display_name: string }[] = [];
  for (const p of b.pairs ?? []) {
    const email = (p.email ?? "").trim().toLowerCase();
    const nn = norm(p.name ?? "");
    // Need a real email and a 2+ word name (so single tokens don't pollute).
    if (!EMAIL_RE.test(email)) continue;
    if (nn.split(" ").length < 2) continue;
    rows.push({ name_norm: nn, email, display_name: (p.name ?? "").trim().slice(0, 120) });
  }
  if (!rows.length) return json({ ok: true, stored: 0 });

  const { error } = await db
    .from("email_index")
    .upsert(rows, { onConflict: "name_norm,email", ignoreDuplicates: true });
  if (error) return json({ error: `Insert failed: ${error.message}` }, 500);

  return json({ ok: true, stored: rows.length });
});
