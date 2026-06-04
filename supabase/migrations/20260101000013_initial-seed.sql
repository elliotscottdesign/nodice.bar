-- =============================================================
-- Plonk Golf — seed data
-- =============================================================
-- Mirrors the values currently hard-coded in lib/mockData.ts so the
-- public site renders the same numbers once the admin starts reading
-- from this database instead of the mock.
--
-- Safe to re-run: every insert uses ON CONFLICT DO NOTHING so it
-- won't duplicate rows you've already edited in the admin.
-- =============================================================

-- ---------- VENUES ----------
insert into public.venues (slug, name, sort_order) values
  ('hackney', 'Plonk Hackney',         1),
  ('borough', 'Plonk Borough Market', 2)
on conflict (slug) do nothing;

-- ---------- TICKETS ----------
-- Hackney
insert into public.tickets (venue_id, name, description, kind, category, price_pence, sort_order, available_days_of_week)
select id, 'Drink, Golf & Game', 'Round of golf, a house drink and 4 arcade tokens',
       'bundle', 'golf', 1200, 0, ARRAY[2]
from public.venues where slug = 'hackney'
on conflict do nothing;

insert into public.tickets (venue_id, name, kind, category, price_pence, sort_order)
select id, 'Adult — 1 round',                      'adult', 'golf', 1100, 1 from public.venues where slug = 'hackney' on conflict do nothing;
insert into public.tickets (venue_id, name, kind, category, price_pence, sort_order)
select id, 'Child (under 16) — 1 round',           'child', 'golf',  800, 2 from public.venues where slug = 'hackney' on conflict do nothing;
insert into public.tickets (venue_id, name, kind, category, price_pence, sort_order)
select id, 'Pool — 30 mins',                       'other', 'pool',  500, 3 from public.venues where slug = 'hackney' on conflict do nothing;

-- Borough
insert into public.tickets (venue_id, name, kind, category, price_pence, sort_order)
select id, 'Adult — 1 round',                      'adult', 'golf', 1300, 1 from public.venues where slug = 'borough' on conflict do nothing;
insert into public.tickets (venue_id, name, kind, category, price_pence, sort_order)
select id, 'Child (under 16) — 1 round',           'child', 'golf', 1000, 2 from public.venues where slug = 'borough' on conflict do nothing;
insert into public.tickets (venue_id, name, kind, category, price_pence, sort_order)
select id, 'Pool — 30 mins',                       'other', 'pool',  500, 3 from public.venues where slug = 'borough' on conflict do nothing;

-- ---------- ADDONS ---------- (venue_id = null => available at both)
insert into public.addons (name, description, price_pence, sort_order) values
  ('Arcade tokens (5)',  'Use in our arcade machines at the bar — shooters, racers, foosball, pinball, classic games, darts and skeeball.',  300, 1),
  ('Plonk medal',        'A premium weight metal medal with lanyard.',                                                                       600, 2),
  ('Bucket of 6 beers',  'Pick any of our house bottles or cans — Asahi, Bud, Corona, Lowrise or Local.',                                   2500, 3),
  ('Tray of 6 shots',    'Pick any house spirit or shooter.',                                                                                1800, 4),
  ('Plonkers Punch (jug)','Wray & Nephew''s rum, dark rum, triple sec, pineapple and grenadine. Good for 4 glasses.',                       2500, 5)
on conflict do nothing;

-- ---------- OPENING HOURS ----------
-- Hackney (Sun = 0)
insert into public.opening_hours (venue_id, day_of_week, open_time, close_time)
select id, 0, '12:00', '22:00' from public.venues where slug = 'hackney' on conflict do nothing;
insert into public.opening_hours (venue_id, day_of_week, open_time, close_time)
select id, 1, '17:00', '22:00' from public.venues where slug = 'hackney' on conflict do nothing;
insert into public.opening_hours (venue_id, day_of_week, open_time, close_time)
select id, 2, '17:00', '22:00' from public.venues where slug = 'hackney' on conflict do nothing;
insert into public.opening_hours (venue_id, day_of_week, open_time, close_time)
select id, 3, '17:00', '22:00' from public.venues where slug = 'hackney' on conflict do nothing;
insert into public.opening_hours (venue_id, day_of_week, open_time, close_time)
select id, 4, '17:00', '22:00' from public.venues where slug = 'hackney' on conflict do nothing;
insert into public.opening_hours (venue_id, day_of_week, open_time, close_time)
select id, 5, '17:00', '23:30' from public.venues where slug = 'hackney' on conflict do nothing;
insert into public.opening_hours (venue_id, day_of_week, open_time, close_time)
select id, 6, '12:00', '23:30' from public.venues where slug = 'hackney' on conflict do nothing;

-- Borough
insert into public.opening_hours (venue_id, day_of_week, open_time, close_time)
select id, 0, '12:00', '22:00' from public.venues where slug = 'borough' on conflict do nothing;
insert into public.opening_hours (venue_id, day_of_week, open_time, close_time)
select id, 1, '17:00', '22:30' from public.venues where slug = 'borough' on conflict do nothing;
insert into public.opening_hours (venue_id, day_of_week, open_time, close_time)
select id, 2, '17:00', '22:30' from public.venues where slug = 'borough' on conflict do nothing;
insert into public.opening_hours (venue_id, day_of_week, open_time, close_time)
select id, 3, '17:00', '23:00' from public.venues where slug = 'borough' on conflict do nothing;
insert into public.opening_hours (venue_id, day_of_week, open_time, close_time)
select id, 4, '17:00', '23:00' from public.venues where slug = 'borough' on conflict do nothing;
insert into public.opening_hours (venue_id, day_of_week, open_time, close_time)
select id, 5, '16:00', '23:59' from public.venues where slug = 'borough' on conflict do nothing;
insert into public.opening_hours (venue_id, day_of_week, open_time, close_time)
select id, 6, '12:00', '23:59' from public.venues where slug = 'borough' on conflict do nothing;

-- ---------- CLOSED DATES ----------
insert into public.closed_dates (date, reason) values
  ('2026-12-25', 'Christmas Day'),
  ('2026-12-26', 'Boxing Day')
on conflict do nothing;

-- ---------- PROMO CODES ----------
insert into public.promo_codes (code, kind, value, valid_from, valid_to, max_uses, uses, active) values
  ('FRIDAY20',  'percent', 20,  now() - interval '30 days', now() + interval '60 days',  200,  42, true),
  ('STUDENT10', 'percent', 10,  now() - interval '365 days', now() + interval '365 days', null, 318, true)
on conflict (code) do nothing;

-- ---------- EMAIL TEMPLATES ----------
insert into public.email_templates (key, label, subject, body) values
  (
    'booking_confirmation',
    'Booking confirmation',
    'Your Plonk booking is confirmed',
    E'Hey {{first_name}},\n\nYour Plonk booking is confirmed.\n\nWhen: {{slot_time}}\nWhere: {{venue_name}}\nParty: {{party_size}} people\nReference: {{reference}}\n\nShow this email at the bar when you arrive. See you on the greens!\n\n— The Plonk team'
  ),
  (
    'voucher_delivery',
    'Gift voucher delivery',
    'Your Plonk gift voucher',
    E'Hi {{recipient_name}},\n\n{{sender_name}} has sent you a Plonk gift voucher worth £{{value}}.\n\nVoucher code: {{voucher_code}}\nExpires: {{expires_at}}\n\nRedeem it at plonkgolf.co.uk against any ticket at either venue.\n\n— The Plonk team'
  ),
  (
    'refund_confirmation',
    'Refund confirmation',
    'Your Plonk refund has been processed',
    E'Hi {{first_name}},\n\nWe''ve processed a refund of £{{amount}} against your booking {{reference}}. It should land back on your card within 5–10 working days.\n\nIf you have any questions, just reply to this email.\n\n— The Plonk team'
  )
on conflict (key) do nothing;
