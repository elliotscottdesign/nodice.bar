-- No Dice CRM — enquiry type tag (22 Oct 2026).
-- A single primary "what is it" tag per lead so the board can filter:
-- party / pool / golf / ping_pong / table / private_hire / corporate / kids /
-- dj / tournament / fundraiser / other. Auto-set from content; office can
-- override. Separate from lead_bucket (venue vs wacky_works) and source.
alter table enquiries
  add column if not exists enquiry_type text;
create index if not exists enquiries_enquiry_type_idx on enquiries (enquiry_type);
