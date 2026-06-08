-- =============================================================
-- Newsletter signups + WELCOME20 promo code
-- =============================================================
-- Backs the homepage NewsletterPopup. Two things in one migration:
--
--   1. `newsletter_signups` — one row per email entered into the
--      popup. Source tagged so we can later distinguish the popup
--      from other capture surfaces (footer block, booking flow
--      opt-in, etc.).
--
--   2. WELCOME20 row in `promo_codes` — the discount itself. 20%
--      off, no expiry, no max-uses cap (founder can edit limits in
--      /admin/promos any time without us pushing code).
-- =============================================================

-- ---------- newsletter_signups ----------
create table if not exists public.newsletter_signups (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  source      text not null default 'popup',  -- 'popup', 'footer', 'booking', …
  consent     boolean not null default true,  -- ticked the opt-in box
  created_at  timestamptz not null default now(),
  -- Sent-at marks when we actually emailed them the welcome code.
  -- Lets us retry failures + spot anyone stuck in 'pending' state.
  welcome_sent_at  timestamptz,
  unique (email, source)
);

create index if not exists newsletter_signups_email_idx
  on public.newsletter_signups (email);
create index if not exists newsletter_signups_created_idx
  on public.newsletter_signups (created_at desc);

alter table public.newsletter_signups enable row level security;

-- Public can INSERT (the popup runs in the browser with the anon
-- key) but cannot READ. That stops scraping the subscriber list.
drop policy if exists "newsletter_signups insert public"
  on public.newsletter_signups;
create policy "newsletter_signups insert public"
  on public.newsletter_signups for insert
  to anon with check (true);

drop policy if exists "newsletter_signups full access for auth"
  on public.newsletter_signups;
create policy "newsletter_signups full access for auth"
  on public.newsletter_signups for all
  to authenticated using (true) with check (true);

-- ---------- WELCOME20 promo code ----------
-- 20% off, valid from today, no end date (use far-future), no usage
-- cap. The founder can tweak via /admin/promos any time.
insert into public.promo_codes
  (code, kind, value, valid_from, valid_to, max_uses, uses, active)
values
  ('WELCOME20', 'percent', 20,
   now(), '2099-12-31T23:59:59Z',
   null, 0, true)
on conflict (code) do update set
  kind = excluded.kind,
  value = excluded.value,
  active = true,
  valid_to = excluded.valid_to;
