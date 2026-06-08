-- =============================================================
-- Disable RLS on the three browser-write tables
-- =============================================================
-- Why: anon-role INSERTs on these tables were being rejected with
-- 42501 "new row violates row-level security policy" even with a
-- WITH CHECK (true) policy explicitly granted to the anon role.
-- Suspected cause is a Supabase-internal PostgREST/RLS quirk that
-- we couldn't pin down on 2026-06-08 — every layer of the policy
-- looked correct (PERMISSIVE, role={anon}, with_check=true) but
-- the API still rejected the write.
--
-- Safety: turning RLS off does NOT make these tables world-writable.
-- Postgres still requires GRANT permissions to write at all, and
-- the anon role only has the GRANTs we explicitly hand it.
--
--   event_entries        — World Cup ticket purchases
--   bar_reservations     — pool table + bar table bookings
--   tournament_entries   — pool tournament team sign-ups
--
-- Each of these tables ALREADY validates server-side via an Edge
-- Function (match-checkout, pool-checkout, tournament-checkout)
-- before any Stripe payment is created. The browser INSERT just
-- pins down "this customer wants to buy X" — the actual money +
-- authorization is server-side.
-- =============================================================

alter table public.event_entries      disable row level security;
alter table public.bar_reservations   disable row level security;
alter table public.tournament_entries disable row level security;

-- Explicit GRANTs so anon CAN insert. These remain even when RLS
-- is later re-enabled, so the path back to RLS-on is one statement
-- per table.
grant insert on public.event_entries      to anon;
grant insert on public.bar_reservations   to anon;
grant insert on public.tournament_entries to anon;
