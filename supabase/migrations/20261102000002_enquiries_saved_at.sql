-- Save-for-later (2 Nov 2026): clears an enquiry from the active CRM list but,
-- unlike archive, does NOT tidy the email out of Gmail — it stays in the inbox.
alter table enquiries add column if not exists saved_at timestamptz;
create index if not exists enquiries_saved_at_idx on enquiries (saved_at);
