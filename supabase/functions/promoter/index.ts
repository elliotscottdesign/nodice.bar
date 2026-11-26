// =============================================================
// promoter — the promoter portal back-end
// =============================================================
// POST /functions/v1/promoter   { action, ... }   (deployed --no-verify-jwt)
//
// One portal, three audiences: a music DJ selling their own-ticket night
// (e.g. Siclano's "Batuke De Siclano"), a non-music promoter (Billy — Comedy
// & Bingo), and a chef pop-up. A promoter logs in with their email + the
// password the venue set in the events builder, and sees LIVE ticket sales
// for their own events, a copy-paste public ticket link, and a notes thread to
// the venue.
//
// Ticket sales are read, never stored here. They live in TWO tables depending
// on how the event was booked, so for one event id we union BOTH:
//   • event_entries      (events-platform / the /event?o=<id> on-site checkout)
//   • tournament_entries (legacy — bingo + pool specials via tournament flow;
//                         FK tournament_id === the events row id)
// A promoter's events come from the event_promoters link table.
//
// Auth model (matches the rest of the project — functions are --no-verify-jwt,
// identity is a token/secret in the body, validated in-function):
//   • promoter calls carry the promoter's `token` (random hex, == the magic
//     link in their welcome email, stored in their browser).
//   • admin calls (from the events builder, behind /admin's Supabase-Auth gate)
//     carry the signed-in staffer's Supabase access token, validated here via
//     auth.getUser(). Only those can assign a promoter / set a password / email
//     credentials.
// Passwords are PBKDF2-hashed; plaintext is only ever held in-flight to email
// it at the moment the office sets it. "Resend login" re-sends the one-click
// magic link (we can't re-send a password we never stored).
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};
function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "content-type": "application/json", ...(init.headers || {}) },
  });
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = "info@nodice.bar";
const SITE = "https://nodice.bar";

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const norm = (e: unknown) => String(e ?? "").trim().toLowerCase();

// ── crypto helpers ─────────────────────────────────────────────────────────
function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function randomToken(): string {
  const a = new Uint8Array(20);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}
const PBKDF2_ITERS = 120000;
async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: PBKDF2_ITERS, hash: "SHA-256" }, key, 256);
  return `${PBKDF2_ITERS}:${b64(salt)}:${b64(new Uint8Array(bits))}`;
}
async function verifyPassword(pw: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [itStr, saltB64, hashB64] = stored.split(":");
  const iterations = parseInt(itStr, 10);
  if (!iterations || !saltB64 || !hashB64) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: unb64(saltB64), iterations, hash: "SHA-256" }, key, 256);
  // constant-ish-time compare
  const a = b64(new Uint8Array(bits));
  if (a.length !== hashB64.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ hashB64.charCodeAt(i);
  return diff === 0;
}

// The 15 allergen keys the On A Roll menu uses (14 FSA + mushroom), and the
// three "has it" states. Keep in sync with the kitchen 🍔 Menu editor.
const ALLERGEN_KEYS = new Set([
  "celery", "gluten", "crustaceans", "eggs", "fish", "lupin", "milk", "molluscs",
  "mustard", "nuts", "peanuts", "sesame", "soya", "sulphites", "mushroom",
]);
const ALLERGEN_STATES = new Set(["contains", "trace", "pending"]);
const clampStr = (v: unknown, n: number) => String(v ?? "").slice(0, n);
const pence = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 10_000_00 ? n : 0;
};

// Normalise an incoming chef menu doc to the shape we store — never trust the
// client. Caps the number of dishes and the field sizes, keeps only valid
// allergen keys/states, coerces prices to whole pence.
function sanitizeMenuDoc(raw: unknown): { dishes: unknown[]; note: string; logo: string } {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const dishesIn = Array.isArray(d.dishes) ? d.dishes.slice(0, 80) : [];
  const dishes = dishesIn.map((row) => {
    const r = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
    const allerIn = (r.allergens && typeof r.allergens === "object" ? r.allergens : {}) as Record<string, unknown>;
    const allergens: Record<string, string> = {};
    for (const [k, v] of Object.entries(allerIn)) {
      if (ALLERGEN_KEYS.has(k) && ALLERGEN_STATES.has(String(v))) allergens[k] = String(v);
    }
    return {
      id: clampStr(r.id, 40) || `d_${crypto.randomUUID().slice(0, 8)}`,
      name: clampStr(r.name, 120),
      desc: clampStr(r.desc, 500),
      sell_pence: pence(r.sell_pence),
      cost_pence: pence(r.cost_pence),
      qty: Math.max(0, Math.min(9999, Math.round(Number(r.qty) || 0))),
      allergens,
    };
  });
  return { dishes, note: clampStr(d.note, 2000), logo: clampStr(d.logo, 500000) };
}

// Validate the signed-in staffer behind /admin. Returns their email or null.
async function adminEmail(accessToken: unknown): Promise<string | null> {
  const t = String(accessToken ?? "");
  if (!t || !ANON_KEY) return null;
  try {
    const auth = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data, error } = await auth.auth.getUser(t);
    if (error || !data?.user) return null;
    return data.user.email ?? "admin";
  } catch {
    return null;
  }
}

// ── live sales for one event (union of both entry tables) ───────────────────
type Buyer = { name: string; qty: number; amountPence: number | null; status: string; at: string };

async function eventDashboard(eventId: string) {
  const { data: ev } = await db
    .from("events")
    .select("id, name, description, event_date, start_time, end_time, poster_url, category, subcategory, max_attendees, registration_open, bookable, requires_ticket, external_link")
    .eq("id", eventId)
    .maybeSingle();
  if (!ev) return null;

  // Headline price: first active ticket type, else the legacy tournaments fee.
  let pricePence: number | null = null;
  const { data: tt } = await db
    .from("ticket_types")
    .select("price_pence")
    .eq("event_id", eventId)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (tt?.price_pence != null) pricePence = tt.price_pence;
  if (pricePence == null) {
    const { data: trn } = await db.from("tournaments").select("entry_fee_pence").eq("id", eventId).maybeSingle();
    if (trn?.entry_fee_pence != null) pricePence = trn.entry_fee_pence;
  }

  const buyers: Buyer[] = [];

  // Events-platform entries (on-site /event?o= checkout).
  const { data: ee } = await db
    .from("event_entries")
    .select("attendee_name, team_name, quantity, amount_paid_pence, status, created_at, paid_at")
    .eq("event_id", eventId);
  for (const r of ee || []) {
    buyers.push({
      name: r.team_name || r.attendee_name || "—",
      qty: Number(r.quantity) || 1,
      amountPence: r.amount_paid_pence ?? null,
      status: r.status,
      at: r.paid_at || r.created_at,
    });
  }

  // Legacy tournament_entries (bingo + pool specials sharing this id).
  const { data: te } = await db
    .from("tournament_entries")
    .select("team_name, captain_name, player_count, status, created_at, paid_at")
    .eq("tournament_id", eventId);
  for (const r of te || []) {
    const qty = Number(r.player_count) || 1;
    buyers.push({
      name: r.captain_name || r.team_name || "—",
      qty,
      amountPence: pricePence != null ? pricePence * qty : null,
      status: r.status,
      at: r.paid_at || r.created_at,
    });
  }

  buyers.sort((a, b) => (a.at < b.at ? 1 : -1)); // newest first

  const isPaid = (s: string) => s === "paid";
  const isPending = (s: string) => s === "pending_payment" || s === "pending";
  const soldTickets = buyers.filter((b) => isPaid(b.status)).reduce((n, b) => n + b.qty, 0);
  const pendingTickets = buyers.filter((b) => isPending(b.status)).reduce((n, b) => n + b.qty, 0);
  const revenuePence = buyers
    .filter((b) => isPaid(b.status))
    .reduce((n, b) => n + (b.amountPence ?? (pricePence != null ? pricePence * b.qty : 0)), 0);

  // Notes thread.
  const { data: notes } = await db
    .from("promoter_notes")
    .select("id, author, author_email, body, created_at, read_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  return {
    id: ev.id,
    name: ev.name,
    event_date: ev.event_date,
    start_time: ev.start_time,
    end_time: ev.end_time,
    poster_url: ev.poster_url,
    category: ev.category,
    subcategory: ev.subcategory,
    maxAttendees: ev.max_attendees,
    registrationOpen: ev.registration_open,
    bookable: ev.bookable,
    requiresTicket: ev.requires_ticket,
    externalLink: ev.external_link,
    shareUrl: `${SITE}/event?o=${ev.id}`,
    pricePence,
    soldTickets,
    pendingTickets,
    revenuePence,
    // Only name / qty / time / status reach the promoter — buyer email & phone
    // are customer PII and stay with the venue.
    buyers: buyers.map((b) => ({ name: b.name, qty: b.qty, status: b.status, at: b.at })),
    notes: (notes || []).map((n) => ({
      id: n.id,
      author: n.author,
      body: n.body,
      at: n.created_at,
      read_at: n.read_at,
    })),
  };
}

// The full payload a logged-in promoter sees: their profile + every event.
async function promoterPayload(email: string) {
  const { data: links } = await db
    .from("event_promoters")
    .select("event_id")
    .eq("promoter_email", email);
  const ids = (links || []).map((l) => l.event_id);
  const events = [];
  for (const id of ids) {
    const d = await eventDashboard(id);
    if (d) events.push(d);
  }
  // Soonest upcoming first; past events sink to the bottom.
  const today = new Date().toISOString().slice(0, 10);
  events.sort((a, b) => {
    const ap = a.event_date < today, bp = b.event_date < today;
    if (ap !== bp) return ap ? 1 : -1;
    return a.event_date < b.event_date ? -1 : 1;
  });
  return events;
}

async function sendWelcome(email: string, name: string | null, token: string, password: string | null) {
  if (!RESEND_API_KEY) return { sent: false, reason: "RESEND_API_KEY not configured" };
  const portal = `${SITE}/promoter`;
  const magic = `${SITE}/promoter?k=${token}`;
  const who = name ? name.split(" ")[0] : "there";
  const pwLine = password
    ? `<p style="margin:0 0 6px"><strong>Password:</strong> ${password}</p>`
    : "";
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
      <h1 style="font-family:'Bebas Neue',Arial,sans-serif;letter-spacing:.02em;font-size:30px;margin:0 0 4px">NO DICE · PROMOTER PORTAL</h1>
      <p style="margin:0 0 16px;color:#555">London Fields, Hackney</p>
      <p style="margin:0 0 14px">Hi ${who}, your promoter login for No Dice is ready. You can watch your ticket sales come in live, grab your ticket link to share, and leave us any details for your event.</p>
      <div style="background:#f6f4ef;border-radius:12px;padding:16px 18px;margin:0 0 16px">
        <p style="margin:0 0 6px"><strong>Login email:</strong> ${email}</p>
        ${pwLine}
      </div>
      <p style="margin:0 0 18px"><a href="${magic}" style="background:#e4007c;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:700;display:inline-block">Open my portal →</a></p>
      <p style="margin:0 0 6px;color:#555;font-size:13px">Or go to <a href="${portal}">${portal}</a> and sign in with the email and password above.</p>
      <p style="margin:18px 0 0;color:#888;font-size:12px">No Dice, Arch 407, Mentmore Terrace, London Fields, E8 3PH</p>
    </div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: `No Dice <${FROM_EMAIL}>`,
        reply_to: FROM_EMAIL,
        to: [email],
        subject: "Your No Dice promoter login",
        html,
      }),
    });
    if (!res.ok) return { sent: false, reason: `Resend ${res.status}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, { status: 405 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const action = String(body.action ?? "");

  try {
    // ── PROMOTER: log in with email + password ──────────────────────────────
    if (action === "login") {
      const email = norm(body.email);
      const password = String(body.password ?? "");
      if (!EMAIL_RE.test(email)) return json({ error: "Enter a valid email." }, { status: 400 });
      const { data: p } = await db.from("promoters").select("*").eq("email", email).maybeSingle();
      if (!p || !(await verifyPassword(password, p.pass_hash)))
        return json({ error: "Email or password not recognised." }, { status: 401 });
      const events = await promoterPayload(email);
      return json({ token: p.token, promoter: { email: p.email, name: p.name }, events });
    }

    // ── PROMOTER: load everything by token (login link + polling) ────────────
    if (action === "load") {
      const token = String(body.token ?? "");
      if (!token) return json({ error: "No token" }, { status: 400 });
      const { data: p } = await db.from("promoters").select("*").eq("token", token).maybeSingle();
      if (!p) return json({ error: "Session expired — please sign in again." }, { status: 401 });
      const events = await promoterPayload(p.email);
      return json({ token: p.token, promoter: { email: p.email, name: p.name }, events });
    }

    // ── PROMOTER: leave a note for the venue ────────────────────────────────
    if (action === "addNote") {
      const token = String(body.token ?? "");
      const eventId = String(body.event_id ?? "");
      const text = String(body.body ?? "").trim();
      if (!token) return json({ error: "No token" }, { status: 400 });
      if (!UUID_RE.test(eventId)) return json({ error: "Bad event" }, { status: 400 });
      if (text.length < 1) return json({ error: "Write something first." }, { status: 400 });
      if (text.length > 4000) return json({ error: "That note is too long." }, { status: 400 });
      const { data: p } = await db.from("promoters").select("email").eq("token", token).maybeSingle();
      if (!p) return json({ error: "Session expired — please sign in again." }, { status: 401 });
      // Only against their own events.
      const { data: link } = await db
        .from("event_promoters")
        .select("event_id")
        .eq("promoter_email", p.email)
        .eq("event_id", eventId)
        .maybeSingle();
      if (!link) return json({ error: "Not your event." }, { status: 403 });
      await db.from("promoter_notes").insert({
        event_id: eventId,
        author: "promoter",
        author_email: p.email,
        body: text,
      });
      return json({ ok: true });
    }

    // ── PROMOTER: chef pop-up menu (draft builder) ──────────────────────────
    // A food-event promoter builds their menu here. It is a DRAFT — it never
    // touches the live On A Roll menu; the office publishes it separately.
    if (action === "menuGet" || action === "menuSave" || action === "menuSubmit") {
      const token = String(body.token ?? "");
      const eventId = String(body.event_id ?? "");
      if (!token) return json({ error: "No token" }, { status: 400 });
      if (!UUID_RE.test(eventId)) return json({ error: "Bad event" }, { status: 400 });
      const { data: p } = await db.from("promoters").select("email").eq("token", token).maybeSingle();
      if (!p) return json({ error: "Session expired — please sign in again." }, { status: 401 });
      const { data: link } = await db
        .from("event_promoters").select("event_id")
        .eq("promoter_email", p.email).eq("event_id", eventId).maybeSingle();
      if (!link) return json({ error: "Not your event." }, { status: 403 });

      if (action === "menuGet") {
        const { data: m } = await db
          .from("promoter_menus")
          .select("doc, status, submitted_at, published_at")
          .eq("event_id", eventId).maybeSingle();
        return json(m ?? { doc: { dishes: [] }, status: "draft", submitted_at: null, published_at: null });
      }

      // Save / submit both persist the doc; submit also flips the status.
      const doc = sanitizeMenuDoc(body.doc);
      const patch: Record<string, unknown> = { event_id: eventId, doc, updated_at: new Date().toISOString() };
      if (action === "menuSubmit") { patch.status = "submitted"; patch.submitted_at = new Date().toISOString(); }
      await db.from("promoter_menus").upsert(patch, { onConflict: "event_id" });
      if (action === "menuSubmit") {
        // Let the office know, in the same notes thread they already watch.
        await db.from("promoter_notes").insert({
          event_id: eventId, author: "promoter", author_email: p.email,
          body: "📋 Submitted the pop-up menu for you to review & put live on On A Roll.",
        });
      }
      return json({ ok: true });
    }

    // ── DJ PORTAL: live sales for a DJ's own-ticket nights ──────────────────
    // Called from the team-hub DJ portal with the DJ's existing portal token
    // (djs.token). No separate promoter login needed: if the DJ's email is set
    // as the promoter on any event, they see the same live dashboard here. The
    // dj lane owns DJPortal.jsx; this keeps all the logic on our side.
    if (action === "djSales") {
      const token = String(body.token ?? "");
      if (!token) return json({ error: "No token" }, { status: 400 });
      const { data: dj } = await db.from("djs").select("email").eq("token", token).maybeSingle();
      if (!dj) return json({ error: "Unknown DJ token" }, { status: 401 });
      const email = norm(dj.email);
      if (!email) return json({ events: [] }); // DJ has no email on file yet
      const events = await promoterPayload(email);
      return json({ events });
    }

    // ── ADMIN: assign/update a promoter on an event (from the events builder)─
    if (action === "adminAssign") {
      const who = await adminEmail(body.accessToken);
      if (!who) return json({ error: "Not authorised." }, { status: 401 });
      const eventId = String(body.event_id ?? "");
      const email = norm(body.email);
      const name = typeof body.name === "string" ? body.name.trim() || null : null;
      const password = typeof body.password === "string" && body.password.trim() ? body.password : null;
      if (!UUID_RE.test(eventId)) return json({ error: "Bad event id." }, { status: 400 });
      if (!EMAIL_RE.test(email)) return json({ error: "Enter a valid promoter email." }, { status: 400 });

      // Upsert the promoter record.
      const { data: existing } = await db.from("promoters").select("*").eq("email", email).maybeSingle();
      const patch: Record<string, unknown> = { email, updated_at: new Date().toISOString() };
      if (name !== null) patch.name = name;
      if (password) patch.pass_hash = await hashPassword(password);
      let token: string;
      if (existing) {
        token = existing.token;
        await db.from("promoters").update(patch).eq("email", email);
      } else {
        token = randomToken();
        await db.from("promoters").insert({ ...patch, token, name });
      }

      // Link the event to the promoter (idempotent).
      await db.from("event_promoters").upsert(
        { event_id: eventId, promoter_email: email },
        { onConflict: "event_id,promoter_email" },
      );

      // "The moment I save their details" → email the login now.
      const mail = await sendWelcome(email, name ?? existing?.name ?? null, token, password);
      if (mail.sent) await db.from("promoters").update({ welcome_sent_at: new Date().toISOString() }).eq("email", email);

      return json({ ok: true, emailed: mail.sent, emailError: mail.sent ? null : mail.reason });
    }

    // ── ADMIN: current assignment + notes for one event (builder view) ──────
    if (action === "adminGet") {
      const who = await adminEmail(body.accessToken);
      if (!who) return json({ error: "Not authorised." }, { status: 401 });
      const eventId = String(body.event_id ?? "");
      if (!UUID_RE.test(eventId)) return json({ error: "Bad event id." }, { status: 400 });
      const { data: links } = await db
        .from("event_promoters")
        .select("promoter_email, assigned_at")
        .eq("event_id", eventId);
      const promoters = [];
      for (const l of links || []) {
        const { data: p } = await db
          .from("promoters")
          .select("email, name, welcome_sent_at")
          .eq("email", l.promoter_email)
          .maybeSingle();
        if (p) promoters.push({ ...p, assigned_at: l.assigned_at });
      }
      const { data: notes } = await db
        .from("promoter_notes")
        .select("id, author, author_email, body, created_at, read_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      return json({ promoters, notes: notes || [] });
    }

    // ── ADMIN: resend the login (magic link; password not stored) ───────────
    if (action === "adminResend") {
      const who = await adminEmail(body.accessToken);
      if (!who) return json({ error: "Not authorised." }, { status: 401 });
      const email = norm(body.email);
      const { data: p } = await db.from("promoters").select("*").eq("email", email).maybeSingle();
      if (!p) return json({ error: "No such promoter." }, { status: 404 });
      const mail = await sendWelcome(email, p.name, p.token, null);
      if (mail.sent) await db.from("promoters").update({ welcome_sent_at: new Date().toISOString() }).eq("email", email);
      return json({ ok: mail.sent, emailError: mail.sent ? null : mail.reason });
    }

    // ── ADMIN: remove a promoter from an event ──────────────────────────────
    if (action === "adminUnassign") {
      const who = await adminEmail(body.accessToken);
      if (!who) return json({ error: "Not authorised." }, { status: 401 });
      const eventId = String(body.event_id ?? "");
      const email = norm(body.email);
      await db.from("event_promoters").delete().eq("event_id", eventId).eq("promoter_email", email);
      return json({ ok: true });
    }

    // ── ADMIN: reply to the promoter's notes thread ─────────────────────────
    if (action === "adminNote") {
      const who = await adminEmail(body.accessToken);
      if (!who) return json({ error: "Not authorised." }, { status: 401 });
      const eventId = String(body.event_id ?? "");
      const text = String(body.body ?? "").trim();
      if (!UUID_RE.test(eventId)) return json({ error: "Bad event id." }, { status: 400 });
      if (!text) return json({ error: "Write something first." }, { status: 400 });
      // Mark the promoter's notes on this event as read, and post the reply.
      await db.from("promoter_notes").update({ read_at: new Date().toISOString() })
        .eq("event_id", eventId).eq("author", "promoter").is("read_at", null);
      await db.from("promoter_notes").insert({ event_id: eventId, author: "office", author_email: who, body: text });
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
});
