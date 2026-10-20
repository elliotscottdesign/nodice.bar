-- No Dice CRM — enquiries pipeline (20 Oct 2026).
-- The spine of the unified booking system: an enquiry comes in (party-booker
-- form, email, bar staff, later IG/FB), gets PENCILLED, then CONFIRMED — at which
-- point it links to a real event/booking. A comms thread hangs off each enquiry.
-- This is NEW data only; the CRM reads existing event/booking sources elsewhere.

create table if not exists enquiries (
  id              uuid primary key default gen_random_uuid(),
  -- where it came from
  source          text not null default 'bar_staff'
                    check (source in ('party_form','email','bar_staff','phone','instagram','facebook','other')),
  -- pipeline stage
  status          text not null default 'new'
                    check (status in ('new','pencilled','confirmed','lost')),
  -- who's asking
  contact_name    text not null default '',
  contact_email   text not null default '',
  contact_phone   text not null default '',
  -- what they want
  event_type      text not null default '',       -- free text or a category key
  party_size      integer,
  requested_date  date,                            -- null = flexible / TBC
  date_flex       text not null default '',        -- "any Fri in Nov", etc.
  budget          text not null default '',
  notes           text not null default '',
  -- ops
  assigned_to     text not null default '',        -- staff handling it
  -- once confirmed, the real thing it became (events.id, a tournament, a booking…)
  linked_kind     text not null default ''         -- 'event' | 'tournament' | 'booking' | ''
                    check (linked_kind in ('event','tournament','booking','')),
  linked_id       text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists enquiries_status_idx on enquiries (status);
create index if not exists enquiries_date_idx   on enquiries (requested_date);

-- Comms + internal notes thread per enquiry.
create table if not exists enquiry_messages (
  id          uuid primary key default gen_random_uuid(),
  enquiry_id  uuid not null references enquiries (id) on delete cascade,
  direction   text not null default 'out' check (direction in ('in','out','note')),
  channel     text not null default 'email' check (channel in ('email','sms','note','phone')),
  subject     text not null default '',
  body        text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists enquiry_messages_enquiry_idx on enquiry_messages (enquiry_id, created_at);

-- RLS: signed-in admins get full access; the PUBLIC party-booker form may only
-- INSERT a new enquiry (insert-only, like bar_helpers — never read others back).
alter table enquiries enable row level security;
alter table enquiry_messages enable row level security;

drop policy if exists enquiries_admin_all on enquiries;
create policy enquiries_admin_all on enquiries
  for all to authenticated using (true) with check (true);

drop policy if exists enquiries_public_insert on enquiries;
create policy enquiries_public_insert on enquiries
  for insert to anon with check (status = 'new');

drop policy if exists enquiry_messages_admin_all on enquiry_messages;
create policy enquiry_messages_admin_all on enquiry_messages
  for all to authenticated using (true) with check (true);

-- keep updated_at fresh
create or replace function set_enquiry_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
drop trigger if exists enquiries_updated_at on enquiries;
create trigger enquiries_updated_at before update on enquiries
  for each row execute function set_enquiry_updated_at();
