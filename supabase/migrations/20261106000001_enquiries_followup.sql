-- =============================================================
-- Enquiries: follow-up shelf + "a reply brings it back" trigger
-- =============================================================

-- #4 Follow-up: a date to chase the customer on. When set, the enquiry sits in
-- the "Follow up" section; when the date is reached the UI highlights it and
-- floats it to the top. Null = not a follow-up.
alter table public.enquiries
  add column if not exists followup_at timestamptz;

-- #2 A reply resurfaces the thread: whenever an INBOUND message lands on an
-- enquiry, clear whatever shelf it was on (archived / saved / follow-up) so it
-- reappears in the active "new enquiries" list. One trigger catches every path
-- that logs an inbound message (the Gmail scanner, the sent-sync, the CRM).
create or replace function public.enquiry_unshelve_on_inbound()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.direction = 'in' then
    update public.enquiries
      set archived_at = null,
          saved_at = null,
          followup_at = null,
          updated_at = now()
    where id = new.enquiry_id
      and (archived_at is not null or saved_at is not null or followup_at is not null);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enquiry_unshelve_on_inbound on public.enquiry_messages;
create trigger trg_enquiry_unshelve_on_inbound
  after insert on public.enquiry_messages
  for each row
  execute function public.enquiry_unshelve_on_inbound();
