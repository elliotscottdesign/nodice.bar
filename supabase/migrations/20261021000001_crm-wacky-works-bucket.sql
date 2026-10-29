-- No Dice CRM — Wacky Works lead bucket (21 Oct 2026).
-- No Dice earns commission building/selling mini-golf courses for "Wacky Works"
-- (the founder's separate design/build company). B2B course-build enquiries
-- (a venue wanting its OWN course installed/supplied) must sit in a separate
-- bucket from normal venue party/booking enquiries, and stay cleanly separable
-- so they can be lifted into a dedicated Wacky Works system later.

alter table enquiries
  add column if not exists lead_bucket text not null default 'venue'
    check (lead_bucket in ('venue','wacky_works'));

create index if not exists enquiries_lead_bucket_idx on enquiries (lead_bucket);
