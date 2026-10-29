-- Per-event toggle for the little title/time/description block under the poster
-- on the public /events calendar card. The coloured side stripe is removed for
-- everyone (in the page), the category bubble stays, and this controls the text.
-- Default true keeps the current look; deals read clean (the poster says it all).

alter table public.events
  add column if not exists show_description boolean not null default true;

update public.events
set show_description = false
where category = 'drink_special'
   or subcategory ilike '%Deals%';
