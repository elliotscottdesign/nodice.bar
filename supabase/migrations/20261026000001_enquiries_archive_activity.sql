-- Enquiries workspace rework (26 Oct 2026)
-- 1) archive/ignore: a timestamp so not-relevant enquiries drop off the board
--    without being "Lost" (we lose deals; we ignore spam). Reversible.
alter table enquiries add column if not exists archived_at timestamptz;
create index if not exists enquiries_archived_at_idx on enquiries (archived_at);

-- 2) per-enquiry comms activity, aggregated server-side (one row per enquiry,
--    well under the 1000-row cap) so the board can show replied / overdue /
--    came-in-today without loading every message. SECURITY DEFINER: the board
--    is authenticated, but this bypasses per-row RLS for a cheap group-by.
create or replace function enquiry_activity()
returns table(enquiry_id uuid, last_in timestamptz, last_out timestamptz, msg_count int)
language sql
stable
security definer
set search_path = public
as $$
  select enquiry_id,
         max(created_at) filter (where direction = 'in')  as last_in,
         max(created_at) filter (where direction = 'out') as last_out,
         count(*)::int as msg_count
  from enquiry_messages
  group by enquiry_id
$$;
grant execute on function enquiry_activity() to anon, authenticated;
