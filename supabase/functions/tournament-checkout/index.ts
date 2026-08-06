// =============================================================
// tournament-checkout — secure tournament entry endpoint
// =============================================================
// POST /functions/v1/tournament-checkout
// Body (full entry data — no row exists yet on the client side):
//   {
//     tournament_id: string,       // event id (events table)
//     team_name: string,
//     captain_name: string,
//     captain_email: string,
//     captain_phone: string,
//     player_count?: number | null,
//     notes?: string | null,
//     heard_from?: string | null,
//     marketing_opt_in?: boolean
//   }
//
// Flow:
//   1. Validate body server-side.
//   2. Look up the events row (events table is the source of truth
//      since the events-platform migration; tournament_id is the
//      event id, which equals the legacy tournaments.id).
//   3. Look up the active ticket_types row for the entry fee — never
//      trust the client price.
//   4. Capacity check vs paid + recent-pending entries.
//   5. Create a Stripe PaymentIntent.
//   6. INSERT the tournament_entries row using the service_role key
//      with the intent_id already stamped.
//   7. Return { entry_id, client_secret }.
//
// Why this shape:
//   The customer-site browser holds only the anon key. With RLS
//   enabled on tournament_entries, anon cannot insert directly. So
//   the insert lives here, where the service_role key bypasses RLS
//   server-side.
// =============================================================

import Stripe from "https://esm.sh/stripe@17.4.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};
function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
}
function handlePreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return null;
}

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TournamentEntryInput = {
  tournament_id: string;
  team_name: string;
  captain_name: string;
  captain_email: string;
  captain_phone: string;
  // Doubles collect BOTH players (founder rule 6 Aug 2026): the prize tab
  // splits half-and-half and each half is emailed separately.
  partner_name?: string | null;
  partner_email?: string | null;
  player_count?: number | null;
  notes?: string | null;
  heard_from?: string | null;
  marketing_opt_in?: boolean;
};

function validate(body: Partial<TournamentEntryInput>): {
  ok: true;
  input: TournamentEntryInput;
} | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body must be a JSON object" };
  }
  if (!body.tournament_id || !UUID_RE.test(body.tournament_id)) {
    return { ok: false, error: "tournament_id must be a UUID" };
  }
  if (
    !body.team_name ||
    typeof body.team_name !== "string" ||
    body.team_name.trim().length < 2
  ) {
    return { ok: false, error: "team_name is required" };
  }
  if (
    !body.captain_name ||
    typeof body.captain_name !== "string" ||
    body.captain_name.trim().length < 2
  ) {
    return { ok: false, error: "captain_name is required" };
  }
  if (
    !body.captain_email ||
    typeof body.captain_email !== "string" ||
    !EMAIL_RE.test(body.captain_email)
  ) {
    return { ok: false, error: "valid captain_email is required" };
  }
  if (
    !body.captain_phone ||
    typeof body.captain_phone !== "string" ||
    body.captain_phone.trim().length < 5
  ) {
    return { ok: false, error: "captain_phone is required" };
  }
  if (
    body.partner_email != null &&
    body.partner_email !== "" &&
    (typeof body.partner_email !== "string" || !EMAIL_RE.test(body.partner_email))
  ) {
    return { ok: false, error: "partner_email must be a valid email" };
  }
  return {
    ok: true,
    input: {
      tournament_id: body.tournament_id,
      team_name: body.team_name.trim(),
      captain_name: body.captain_name.trim(),
      captain_email: body.captain_email.trim(),
      captain_phone: body.captain_phone.trim(),
      partner_name:
        typeof body.partner_name === "string" ? body.partner_name.trim() || null : null,
      partner_email:
        typeof body.partner_email === "string" ? body.partner_email.trim() || null : null,
      player_count:
        typeof body.player_count === "number" ? body.player_count : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      heard_from:
        typeof body.heard_from === "string" ? body.heard_from.trim() || null : null,
      marketing_opt_in: !!body.marketing_opt_in,
    },
  };
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return jsonResponse({ error: "POST only" }, { status: 405 });
  }
  if (!STRIPE_SECRET_KEY) {
    return jsonResponse(
      { error: "STRIPE_SECRET_KEY not configured" },
      { status: 500 },
    );
  }

  let raw: Partial<TournamentEntryInput>;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  const v = validate(raw);
  if (!v.ok) return jsonResponse({ error: v.error }, { status: 400 });
  const input = v.input;

  // Look up the tournament event (events table — the events-platform
  // migration moved tournament metadata here; ticket_types now holds
  // the entry fee). The id equals the legacy tournaments.id for
  // backfilled tournaments, so this works for both old and new.
  const { data: ev, error: evErr } = await db
    .from("events")
    .select(
      "id, name, category, registration_open, bookable, max_attendees, paid_entries_count",
    )
    .eq("id", input.tournament_id)
    .maybeSingle();
  if (evErr) {
    return jsonResponse(
      { error: `DB error on tournament lookup: ${evErr.message}` },
      { status: 500 },
    );
  }
  if (!ev) {
    return jsonResponse({ error: "Tournament not found" }, { status: 404 });
  }
  if (!ev.registration_open) {
    return jsonResponse(
      { error: "Registration is closed for this tournament" },
      { status: 409 },
    );
  }
  if (!ev.bookable) {
    return jsonResponse(
      { error: "This event is invitation only — not publicly bookable" },
      { status: 409 },
    );
  }
  if (
    ev.category !== "pool_tournament_doubles" &&
    ev.category !== "pool_tournament_singles" &&
    ev.category !== "pool_special"
  ) {
    return jsonResponse(
      { error: "Event is not a tournament" },
      { status: 400 },
    );
  }
  // Doubles need BOTH players' details — the prize tab splits half-and-half
  // and each player's half is emailed to their own address (founder rule
  // 6 Aug 2026).
  if (ev.category === "pool_tournament_doubles" && !input.partner_email) {
    return jsonResponse(
      { error: "Doubles entries need your partner's name and email too" },
      { status: 400 },
    );
  }

  // First active ticket = the entry fee. Mirrors loadOpenTournaments.
  const { data: tt, error: ttErr } = await db
    .from("ticket_types")
    .select("id, price_pence, active")
    .eq("event_id", input.tournament_id)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (ttErr) {
    return jsonResponse(
      { error: `DB error on ticket lookup: ${ttErr.message}` },
      { status: 500 },
    );
  }
  if (!tt || !tt.price_pence || tt.price_pence <= 0) {
    return jsonResponse(
      { error: "Tournament has no entry fee configured" },
      { status: 500 },
    );
  }

  // Capacity check — count paid entries + pending entries created in
  // the last 15 min (treat older pending as abandoned).
  const FIFTEEN_MIN_AGO = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count: activeCount, error: countErr } = await db
    .from("tournament_entries")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", input.tournament_id)
    .or(
      `status.eq.paid,and(status.eq.pending_payment,created_at.gte.${FIFTEEN_MIN_AGO})`,
    );
  if (countErr) {
    return jsonResponse(
      { error: `Capacity check failed: ${countErr.message}` },
      { status: 500 },
    );
  }
  const maxTeams = ev.max_attendees ?? 12;
  if ((activeCount ?? 0) >= maxTeams) {
    return jsonResponse(
      {
        error: `Sorry, this tournament just filled up — ${maxTeams} teams already secured. Pick another date.`,
      },
      { status: 409 },
    );
  }

  // Stripe FIRST — if it fails, we never write an orphan entry.
  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.create({
      amount: tt.price_pence,
      currency: "gbp",
      receipt_email: input.captain_email,
      description: `${ev.name} — entry for team "${input.team_name}"`,
      automatic_payment_methods: { enabled: true },
      metadata: {
        kind: "tournament_entry",
        tournament_id: ev.id,
        team_name: input.team_name,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse(
      { error: `Stripe create-intent failed: ${msg}` },
      { status: 502 },
    );
  }

  if (!intent.client_secret) {
    return jsonResponse(
      { error: "Stripe returned no client_secret" },
      { status: 502 },
    );
  }

  // INSERT the entry with intent already stamped.
  const { data: entry, error: insertErr } = await db
    .from("tournament_entries")
    .insert({
      tournament_id: input.tournament_id,
      team_name: input.team_name,
      captain_name: input.captain_name,
      captain_email: input.captain_email,
      captain_phone: input.captain_phone,
      partner_name: input.partner_name,
      partner_email: input.partner_email,
      player_count: input.player_count,
      notes: input.notes,
      heard_from: input.heard_from,
      marketing_opt_in: input.marketing_opt_in,
      stripe_payment_intent_id: intent.id,
    })
    .select("id")
    .single();
  if (insertErr || !entry) {
    await stripe.paymentIntents
      .cancel(intent.id, { cancellation_reason: "abandoned" })
      .catch(() => {});
    return jsonResponse(
      {
        error: `Failed to save entry: ${
          insertErr?.message ?? "unknown error"
        }`,
      },
      { status: 500 },
    );
  }

  // Stamp the entry_id back onto Stripe metadata for the webhook.
  await stripe.paymentIntents
    .update(intent.id, {
      metadata: {
        ...intent.metadata,
        entry_id: entry.id,
      },
    })
    .catch((e) => {
      console.warn(`Could not update PaymentIntent metadata: ${e}`);
    });

  return jsonResponse({
    entry_id: entry.id,
    client_secret: intent.client_secret,
  });
});
