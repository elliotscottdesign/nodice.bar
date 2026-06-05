-- =============================================================
-- Create the "media" storage bucket
-- =============================================================
-- The image-upload code in lib/db/media.ts targets a Supabase
-- Storage bucket called "media", but no migration was ever creating
-- it. New No Dice project → bucket didn't exist → admin upload UI
-- threw "Bucket not found" on the Galleries page.
--
-- Public bucket so the served images are readable without an auth
-- token (matches how the public site embeds them via <Image src>).
-- Row-Level Security on storage.objects still controls who can
-- WRITE — that's set up in 20260101000005_cms-extras.sql.
--
-- Idempotent: ON CONFLICT keeps the insert safe to re-run.
-- =============================================================

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = excluded.public;
