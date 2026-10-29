-- The day shown on a deal poster's bottom line ("TUESDAYS", "MON-THURS") — a
-- free-text, per-deal editable field, since it can be a single day or a range
-- that doesn't map to the event's recurrence. Blank falls back to the date.
-- Additive + nullable; the site reads events with select("*").

alter table public.events
  add column if not exists poster_day_label text;
