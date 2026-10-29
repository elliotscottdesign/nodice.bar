-- No Dice CRM — email index (22 Oct 2026).
-- A harvested name->email lookup (from the old info@plonkgolf.co.uk mailbox via
-- the historic-email-harvester Apps Script -> email-index edge fn), used to
-- backfill historic_enquiries.email so old clients become re-targetable.
create table if not exists email_index (
  name_norm    text not null,
  email        text not null,
  display_name text,
  primary key (name_norm, email)
);
create index if not exists email_index_name_idx on email_index (name_norm);
