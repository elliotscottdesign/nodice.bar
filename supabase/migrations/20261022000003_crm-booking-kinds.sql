-- No Dice CRM — allow golf + private_hire reservation kinds (22 Oct 2026).
-- So the CRM "Add booking" can create any venue booking type into
-- bar_reservations. Additive; pool/table logic (overlap checks, capacity)
-- filters by its own kind so it is unaffected.
alter table bar_reservations drop constraint if exists bar_reservations_kind_check;
alter table bar_reservations add constraint bar_reservations_kind_check
  check (kind = any (array['pool','table','golf','private_hire']));
