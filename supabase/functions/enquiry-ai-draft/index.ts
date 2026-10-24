// =============================================================
// enquiry-ai-draft — draft a reply to a CRM enquiry with Claude
// =============================================================
// POST /functions/v1/enquiry-ai-draft  Body: { enquiry_id: string }
//
// Office-initiated ("Draft with AI" in the reply box). Reads the enquiry + the
// whole conversation so far + the editable AI knowledge/FAQ (crm_settings.ai_faq)
// and asks Claude to draft the next reply in the No Dice voice. Returns the
// draft text for the office to review/edit before sending (approve-first).
//
// Uses the Anthropic Messages API (ANTHROPIC_API_KEY secret), Haiku for cost.
// Auth: verify_jwt on (anon-key bearer, like the other admin calls).
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const MODEL = "claude-haiku-5-5";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

  let b: { enquiry_id?: string };
  try { b = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const enquiryId = (b.enquiry_id ?? "").trim();
  if (!enquiryId) return json({ error: "enquiry_id is required" }, 400);

  const { data: e, error } = await db
    .from("enquiries")
    .select("contact_name, event_type, party_size, requested_date, date_flex, budget, notes, enquiry_type")
    .eq("id", enquiryId)
    .maybeSingle();
  if (error) return json({ error: `DB error: ${error.message}` }, 500);
  if (!e) return json({ error: "Enquiry not found" }, 404);

  const [{ data: msgs }, { data: faqRow }] = await Promise.all([
    db.from("enquiry_messages").select("direction, subject, body, created_at").eq("enquiry_id", enquiryId).order("created_at", { ascending: true }),
    db.from("crm_settings").select("value").eq("key", "ai_faq").maybeSingle(),
  ]);
  const faq = (faqRow?.value ?? "").trim();

  // LIVE LEARNING: pull real replies the office has already sent to enquiries of
  // the same type, so the AI matches how we actually answer and quotes facts we
  // use in practice. No manual upkeep — it reads the CRM fresh on every draft.
  let learned = "";
  try {
    const { data: sameType } = await db
      .from("enquiries")
      .select("id")
      .eq("enquiry_type", e.enquiry_type || "other")
      .neq("id", enquiryId)
      .order("created_at", { ascending: false })
      .limit(60);
    const ids = (sameType ?? []).map((r: { id: string }) => r.id);
    if (ids.length) {
      const { data: examples } = await db
        .from("enquiry_messages")
        .select("body")
        .in("enquiry_id", ids)
        .eq("direction", "out")
        .order("created_at", { ascending: false })
        .limit(8);
      learned = (examples ?? [])
        .map((m: { body: string }) => (m.body || "").trim())
        .filter((t: string) => t.length > 40)
        .slice(0, 6)
        .map((t: string, i: number) => `Example ${i + 1}:\n${t.slice(0, 900)}`)
        .join("\n\n---\n\n");
    }
  } catch { /* examples are a bonus — never block a draft on them */ }

  const first = (e.contact_name || "there").split(" ")[0];
  const summary = [
    e.contact_name ? `Contact: ${e.contact_name}` : "",
    e.event_type ? `Wants: ${e.event_type}` : "",
    e.enquiry_type ? `Type: ${e.enquiry_type}` : "",
    e.party_size ? `Party: ${e.party_size}` : "",
    e.requested_date || e.date_flex ? `Date: ${e.requested_date || e.date_flex}` : "",
    e.budget ? `Budget: ${e.budget}` : "",
    e.notes ? `Notes: ${e.notes}` : "",
  ].filter(Boolean).join("\n");

  const transcript = (msgs ?? [])
    .map((m: { direction: string; body: string }) =>
      `${m.direction === "out" ? "NO DICE" : m.direction === "note" ? "INTERNAL NOTE" : "CUSTOMER"}: ${m.body}`)
    .join("\n\n") || "(no messages captured yet — this is the first reply)";

  const system =
    "You are the bookings team at No Dice, a bar + games venue in London Fields, Hackney. " +
    "Draft the NEXT email reply to the customer. Write in a warm, friendly, concise British-English tone — " +
    "like a helpful independent venue, not a corporate script. Use the venue knowledge below. " +
    "IMPORTANT: never invent specific prices, availability or policies you are not given — if something " +
    "isn't in the knowledge, either ask the customer, or leave a clear [square-bracket placeholder] for the " +
    "office to fill. Keep it to a few short paragraphs. Sign off as 'The No Dice team'. " +
    "Output ONLY the email body text — no subject line, no 'Here's a draft', no explanation.\n\n" +
    "VENUE KNOWLEDGE / FAQ:\n" + (faq || "(none provided yet)") +
    (learned
      ? "\n\nHOW WE'VE REPLIED TO SIMILAR ENQUIRIES BEFORE (learn the tone and the " +
        "facts/prices we actually quote — but don't copy any of it word-for-word, and " +
        "never reuse a specific price or date unless it's also in the knowledge above):\n\n" +
        learned
      : "");

  const userMsg =
    `Enquiry details:\n${summary}\n\nConversation so far:\n${transcript}\n\n` +
    `Draft the next reply from No Dice to ${first}.`;

  let draft = "";
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system,
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    const data = await r.json();
    if (!r.ok) return json({ error: `Claude error: ${data?.error?.message || r.status}` }, 502);
    // Claude 5 may return a thinking block first — take every text block.
    draft = (Array.isArray(data?.content) ? data.content : [])
      .filter((c: { type?: string }) => c?.type === "text")
      .map((c: { text?: string }) => c.text ?? "")
      .join("")
      .trim();
  } catch (err) {
    return json({ error: `Claude request failed: ${err instanceof Error ? err.message : String(err)}` }, 502);
  }
  if (!draft) return json({ error: "No draft produced" }, 502);

  return json({ draft });
});
