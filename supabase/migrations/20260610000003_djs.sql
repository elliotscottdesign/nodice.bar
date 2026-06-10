-- =============================================================
-- DJ profiles + event linkage
-- =============================================================
-- Adds a `djs` table so resident / returning DJs have a single
-- profile (name, bio, profile image, socials) the founder maintains
-- in /admin/djs. Each event can link to a DJ via events.dj_id.
--
-- Display fallback chain (computed in the app):
--   1. events.poster_url  — the event-specific image, if set
--   2. djs.profile_image_url — the DJ's standing profile image
--   3. a default "DJ Night" placeholder
--
-- Public-facing: at launch this is INTERNAL only — the DJ entity
-- powers the fallback image so a recurring DJ doesn't have to
-- re-upload artwork every time. A public /djs page can come later.
--
-- Access: same as the rest of admin — the founder edits via
-- /admin/djs (admin auth). No DJ-facing login at launch.
-- =============================================================

create table if not exists public.djs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  /** Short bio shown in admin only at launch. Markdown-style line
   *  breaks tolerated; never rendered as HTML. */
  bio text,
  /** URL of the DJ's profile image — defaults to whatever poster
   *  appears on their events when no per-event image is uploaded.
   *  Stored as a full URL (the founder uploads via /admin/djs and
   *  the upload UI pastes the resulting Supabase Storage URL here). */
  profile_image_url text,
  /** Optional Instagram handle WITHOUT the @ (e.g. "nodice.bar").
   *  Reserved for the future public /djs page; not displayed at
   *  launch. */
  instagram_handle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists djs_name_idx on public.djs (lower(name));

-- updated_at trigger — matches the pattern used by other tables.
create or replace function public.djs_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists djs_touch_updated_at on public.djs;
create trigger djs_touch_updated_at
  before update on public.djs
  for each row execute function public.djs_touch_updated_at();

-- ---------------------------------------------------------
-- Event linkage: events.dj_id → djs.id (nullable)
-- ---------------------------------------------------------
-- Nullable because non-DJ events (food residencies, pool tournaments,
-- World Cup matches) don't have a DJ. ON DELETE SET NULL so deleting
-- a DJ doesn't cascade and wipe events — admin sees "DJ removed"
-- and re-assigns.
alter table public.events
  add column if not exists dj_id uuid references public.djs(id) on delete set null;

create index if not exists events_dj_id_idx
  on public.events (dj_id)
  where dj_id is not null;

comment on column public.events.dj_id is
  'Optional FK to djs.id. Used for dj_night events so the public/admin display can fall back to the DJ profile image when poster_url is empty.';

-- ---------------------------------------------------------
-- RLS — same shape as other admin-managed tables
-- ---------------------------------------------------------
alter table public.djs enable row level security;
drop policy if exists "anon_select_djs" on public.djs;
drop policy if exists "authenticated_all_djs" on public.djs;

-- Authenticated admin: full access.
create policy "authenticated_all_djs"
  on public.djs
  for all
  to authenticated
  using (true)
  with check (true);

-- Anon: read-only. The public /events page is statically generated
-- by the customer site using the anon key — it needs to read the
-- profile image URL to render the fallback. No write paths from
-- anon (we never expose a DJ-facing upload form at launch).
create policy "anon_select_djs"
  on public.djs
  for select
  to anon
  using (true);
