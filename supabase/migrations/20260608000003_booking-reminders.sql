-- =============================================================
-- 24-hour booking reminder tracking
-- =============================================================
-- Adds a reminder_sent_at column to each of the three booking
-- tables so the reminder function knows who's already been
-- emailed and doesn't spam them. The send-booking-reminders
-- Edge Function (called by a Supabase cron every hour) finds
-- paid bookings whose start is 22–26 hours away and reminder
-- hasn't been sent yet, sends an email, and stamps the column.
--
--   bar_reservations    — pool table + table reservations
--   event_entries       — World Cup match tickets (+ any future
--                         ticketed event)
--   tournament_entries  — pool tournament team sign-ups
-- =============================================================

alter table public.bar_reservations    add column if not exists reminder_sent_at timestamptz;
alter table public.event_entries       add column if not exists reminder_sent_at timestamptz;
alter table public.tournament_entries  add column if not exists reminder_sent_at timestamptz;

create index if not exists bar_reservations_reminder_idx
  on public.bar_reservations (reservation_date, start_time)
  where reminder_sent_at is null and status = 'paid';

create index if not exists event_entries_reminder_idx
  on public.event_entries (event_id)
  where reminder_sent_at is null and status = 'paid';

create index if not exists tournament_entries_reminder_idx
  on public.tournament_entries (tournament_id)
  where reminder_sent_at is null and status = 'paid';
