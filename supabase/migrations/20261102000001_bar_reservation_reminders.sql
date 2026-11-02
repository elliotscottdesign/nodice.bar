-- Booking reminders on bar_reservations (2 Nov 2026)
-- These columns were missing, so the hourly reminder query errored silently and
-- bar bookings never got a reminder. Add them:
--  reminder_sent_at     — the "see you soon" nudge (24h casual / 48h CRM party)
--  pay_reminder_sent_at — the one-time "please pay to confirm" chase for unpaid
alter table bar_reservations add column if not exists reminder_sent_at timestamptz;
alter table bar_reservations add column if not exists pay_reminder_sent_at timestamptz;
