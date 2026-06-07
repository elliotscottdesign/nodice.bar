-- =============================================================
-- /private-hire — surface section titles as CMS fields
-- =============================================================
-- The six fact-panel headings ("Capacity", "Room features", etc.)
-- used to be hardcoded in JSX. They're now editable via inline
-- Editable AND via the form-based admin at
-- /admin/content/private-hire — these rows make them show up in
-- that form.
-- =============================================================

insert into public.page_content (key, value, page, field_kind, label, helper, sort_order)
values
  ('privatehire.hackney.capacity_title',
   'Capacity',
   'privatehire.hackney', 'text',
   'Capacity — section title',
   'The heading above the three numbers (Standing / Dining / Cabaret).',
   400),
  ('privatehire.hackney.features_title',
   'Room features',
   'privatehire.hackney', 'text',
   'Room features — section title',
   'The heading above the tick-list of venue features.',
   410),
  ('privatehire.hackney.catering_title',
   'Catering',
   'privatehire.hackney', 'text',
   'Catering — section title',
   'The heading above the yes/no catering columns.',
   420),
  ('privatehire.hackney.licences_title',
   'Licences',
   'privatehire.hackney', 'text',
   'Licences — section title',
   'The heading above the alcohol licence paragraph.',
   430),
  ('privatehire.hackney.welcomes_title',
   'Venue welcomes',
   'privatehire.hackney', 'text',
   'Venue welcomes — section title',
   'The heading above the list of welcome event types.',
   440),
  ('privatehire.hackney.house_rules_title',
   'House rules',
   'privatehire.hackney', 'text',
   'House rules — section title',
   'The heading above the house rules paragraph.',
   450)
on conflict (key) do nothing;
