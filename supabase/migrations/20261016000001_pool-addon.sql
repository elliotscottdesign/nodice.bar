-- =============================================================
-- Pool add-on — office-added pool time on a table reservation
-- =============================================================
-- The office can add pool time to an existing TABLE reservation from
-- /admin/table-reservations. It creates a SEPARATE pool row in
-- bar_reservations (kind='pool') so it blocks the pool slot exactly
-- like any other pool booking (the overlap check in pool-checkout
-- counts every kind='pool' row). The add-on row points back at its
-- parent table reservation via parent_reservation_id, so the admin
-- shows it as a pool line INSIDE the one table booking rather than a
-- second standalone booking.
--
-- pool_pay_url holds the Stripe Payment Link the customer pays later.
-- The add-on row starts status='pending' and the stripe-webhook flips
-- it to 'paid' (metadata.kind = 'pool_addon') when the link is paid.
-- =============================================================

alter table public.bar_reservations
  add column if not exists parent_reservation_id uuid
    references public.bar_reservations(id) on delete cascade;

alter table public.bar_reservations
  add column if not exists pool_pay_url text;

create index if not exists bar_reservations_parent_idx
  on public.bar_reservations(parent_reservation_id)
  where parent_reservation_id is not null;
