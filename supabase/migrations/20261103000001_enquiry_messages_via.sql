-- Track HOW an enquiry reply was sent + capture Gmail-direct replies (3 Nov 2026)
--  via               : 'crm' = sent from the CRM compose window;
--                      'email' = staff replied directly in Gmail (seen in Sent)
--  gmail_message_id  : Gmail's id for a captured Sent message, so the Sent
--                      scan never logs the same reply twice.
alter table enquiry_messages add column if not exists via text;
alter table enquiry_messages add column if not exists gmail_message_id text;
create unique index if not exists enquiry_messages_gmail_msg_uq
  on enquiry_messages (enquiry_id, gmail_message_id)
  where gmail_message_id is not null;
