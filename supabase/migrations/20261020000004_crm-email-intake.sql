-- No Dice CRM — email intake (20 Oct 2026).
-- Emails landing in info@nodice.bar / info@plonkgolf.co.uk are scanned by a
-- Google Apps Script and posted to the email-enquiry edge function, which
-- creates a 'new' enquiry (source='email'). We store the Gmail message id so
-- a re-scan of the same message never creates a duplicate enquiry.

alter table enquiries
  add column if not exists email_message_id text;

-- One enquiry per source email. Partial unique so the many non-email enquiries
-- (which leave this null) are unaffected.
create unique index if not exists enquiries_email_message_id_idx
  on enquiries (email_message_id)
  where email_message_id is not null;
