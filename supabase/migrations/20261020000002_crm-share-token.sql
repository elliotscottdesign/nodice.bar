-- No Dice CRM — shareable client summary (20 Oct 2026).
-- A client-facing, read-only summary of their enquiry, reachable by a long
-- random token (not the uuid). The enquiries table has NO anon SELECT (client
-- data, GDPR), so we expose ONLY safe, client-facing fields through a
-- SECURITY DEFINER function keyed on the share token — never the whole row.

alter table enquiries
  add column if not exists share_token text;

-- Backfill + default a url-safe random token for every row.
update enquiries
  set share_token = replace(replace(encode(gen_random_bytes(18), 'base64'), '/', '_'), '+', '-')
  where share_token is null;

alter table enquiries
  alter column share_token set default replace(replace(encode(gen_random_bytes(18), 'base64'), '/', '_'), '+', '-');

create unique index if not exists enquiries_share_token_idx on enquiries (share_token);

-- Public summary: safe fields only, looked up by token. SECURITY DEFINER so it
-- bypasses RLS but returns a hand-picked projection — no email, phone, budget,
-- internal notes or other rows. Only shows PENCILLED / CONFIRMED (nothing is
-- shared with the client while it's still 'new' or after it's 'lost').
create or replace function public.enquiry_client_summary(p_token text)
returns table (
  contact_name   text,
  event_type     text,
  status         text,
  requested_date date,
  date_flex      text,
  party_size     integer
)
language sql
security definer
set search_path = public
as $$
  select e.contact_name, e.event_type, e.status, e.requested_date,
         e.date_flex, e.party_size
  from enquiries e
  where e.share_token = p_token
    and e.status in ('pencilled','confirmed')
  limit 1;
$$;

revoke all on function public.enquiry_client_summary(text) from public;
grant execute on function public.enquiry_client_summary(text) to anon, authenticated;
