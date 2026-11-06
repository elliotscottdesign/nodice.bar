-- Auction / activity-prize vouchers: an experience instead of a cash value
-- (e.g. a round of mini golf + drinks for 6). kind = 'auction', value_pence 0.
alter table public.vouchers add column if not exists prize_description text;
