// =============================================================
// email-enquiry — turn an inbound email into a CRM enquiry
// =============================================================
// POST /functions/v1/email-enquiry
// Body: {
//   secret: string,            // must match EMAIL_ENQUIRY_SECRET
//   gmail_message_id: string,  // dedupe key — one enquiry per email
//   from_name?: string,
//   from_email: string,
//   subject?: string,
//   body?: string,             // plain-text body (truncated by the scanner)
//   received_at?: string,      // ISO
//   source_inbox?: string      // e.g. "info@nodice.bar" — which inbox it hit
// }
//
// Called by the Google Apps Script scanners running on info@nodice.bar and
// info@plonkgolf.co.uk (auto-scan both inboxes → the CRM board). Creates a
// 'new' enquiry (source='email') and logs the email body as the first
// message on its thread. Idempotent: if an enquiry already exists for this
// gmail_message_id it returns { duplicate:true } and does nothing.
//
// Public endpoint (deploy --no-verify-jwt) but guarded by a shared secret so
// only our scanners can post. Deploy:
//   supabase functions deploy email-enquiry --project-ref <ref> --no-verify-jwt
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

// Guard: the scanner always sends a fixed app tag in the body. This replaces
// the old fillable secret (which was a constant pain to paste correctly) — the
// tag is baked into the scanner, nothing to fill in. A legacy EMAIL_ENQUIRY_
// SECRET is still accepted if an older scanner sends it. The endpoint only
// creates 'new' enquiry rows (internal, triaged on the board), so a fixed tag
// plus the anon key is an acceptable guard here.
const APP_TAG = "nodice-crm-scanner";
const EMAIL_ENQUIRY_SECRET = Deno.env.get("EMAIL_ENQUIRY_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Route B2B course-build leads to the Wacky Works bucket. A lead is Wacky Works
// when it's about a mini/crazy-golf COURSE being built/installed/supplied for a
// venue (not a customer wanting to come and PLAY). Requires a golf-course
// mention PLUS a build/supply/dimensions/"our venue" signal, so a normal
// "can I book crazy golf" booking stays as a venue enquiry.
function classifyBucket(text: string): "venue" | "wacky_works" {
  const t = (text || "").toLowerCase();
  const golf = /(crazy|mini|adventure)[\s-]?golf|golf course/.test(t);
  if (!golf) return "venue";
  const hasCourse = /course/.test(t);
  const buildVerb = /(instal|\bbuild|suppl|bespoke|fit[\s-]?out|manufactur|design and build)/.test(t);
  const dims = /(square\s?met|\d{2,}\s?sq\.?\s?m|\d{2,}\s?m2|\d{2,}\s?m²|\d{2,}\s?sqm)/.test(t);
  const courseToVenue = /course\s+(to|for|in|at|into|within)\s+(our|your|the|my|their)\s+(venue|space|site|premises|bar|pub|location|unit|arcade|building)/.test(t);
  // Wacky Works = a mini/crazy-golf COURSE to be built/installed/supplied, or
  // sized in sq-m, or going into a venue/space. Broad "your venue" or bare
  // "add golf" is NOT enough (that's marketing spam or a party add-on).
  const isBuild = (hasCourse && buildVerb) || dims || courseToVenue;
  return isBuild ? "wacky_works" : "venue";
}

// A single "what is it" tag, activity-first. Office can override on the board.
function classifyType(text: string): string {
  const t = (text || "").toLowerCase();
  if (/ping[\s-]?pong|table tennis/.test(t)) return "ping_pong";
  if (/\bpool\b|pool table|pool comp/.test(t)) return "pool";
  if (/crazy golf|mini[\s-]?golf|\bgolf\b|golf course/.test(t)) return "golf";
  if (/tournament|competition|\bcomp\b|\bleague\b/.test(t)) return "tournament";
  if (/\bdj\b|dj set|decks|djing/.test(t)) return "dj";
  if (/fundrais|charity|raffle|donation/.test(t)) return "fundraiser";
  if (/\bkids?\b|children|\bchild\b|kids? party/.test(t)) return "kids";
  if (/corporate|work do|work social|team building|team-building|office party|colleagues/.test(t)) return "corporate";
  if (/private hire|exclusive hire|whole venue|venue hire|private event|exclusive use/.test(t)) return "private_hire";
  if (/\bparty\b|birthday|celebrat|hen do|stag do|\bhen\b|\bstag\b|anniversary|leaving do/.test(t)) return "party";
  if (/\btable\b|dinner|drinks|reservation|book a table|group booking/.test(t)) return "table";
  return "other";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let b: Record<string, string>;
  try {
    b = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const tagOk = (b.app ?? "") === APP_TAG;
  const legacySecretOk =
    !!EMAIL_ENQUIRY_SECRET && (b.secret ?? "") === EMAIL_ENQUIRY_SECRET;
  if (!tagOk && !legacySecretOk) {
    return json({ error: "Unauthorized" }, 401);
  }

  const messageId = (b.gmail_message_id ?? "").trim();
  if (!messageId) return json({ error: "gmail_message_id is required" }, 400);

  const fromEmail = (b.from_email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(fromEmail)) {
    return json({ error: "A valid from_email is required" }, 400);
  }

  // Dedupe: already logged this exact email?
  const { data: existing, error: exErr } = await db
    .from("enquiries")
    .select("id")
    .eq("email_message_id", messageId)
    .maybeSingle();
  if (exErr) return json({ error: `Lookup failed: ${exErr.message}` }, 500);
  if (existing) return json({ ok: true, duplicate: true, id: existing.id });

  const fromName = (b.from_name ?? "").trim().slice(0, 200);
  const subject = (b.subject ?? "").trim().slice(0, 300);
  const body = (b.body ?? "").trim().slice(0, 8000);
  const inbox = (b.source_inbox ?? "").trim().slice(0, 120);

  // Short notes snippet on the enquiry; full email goes on the thread.
  const snippet = body.slice(0, 280);
  const notes = [
    inbox ? `From email to ${inbox}` : "From email",
    subject ? `Subject: ${subject}` : "",
    snippet,
  ]
    .filter(Boolean)
    .join("\n");

  const { data: enq, error: insErr } = await db
    .from("enquiries")
    .insert({
      source: "email",
      status: "new",
      contact_name: fromName,
      contact_email: fromEmail,
      event_type: subject,
      notes,
      email_message_id: messageId,
      lead_bucket: classifyBucket(subject + " " + body),
      enquiry_type: classifyType(subject + " " + body),
    })
    .select("id")
    .single();
  if (insErr || !enq) {
    // Unique-violation = a concurrent scan beat us to it; treat as duplicate.
    if (insErr && /duplicate key|unique/i.test(insErr.message)) {
      return json({ ok: true, duplicate: true });
    }
    return json(
      { error: `Insert failed: ${insErr?.message ?? "unknown"}` },
      500,
    );
  }

  // Log the full email as the first message on the thread (best-effort).
  if (body || subject) {
    await db
      .from("enquiry_messages")
      .insert({
        enquiry_id: enq.id,
        direction: "in",
        channel: "email",
        subject,
        body: body || "(no body)",
      })
      .then(() => {}, () => {});
  }

  return json({ ok: true, id: enq.id });
});
