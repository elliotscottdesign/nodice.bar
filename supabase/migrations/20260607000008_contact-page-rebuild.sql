-- =============================================================
-- /contact — clean structured CMS surface
-- =============================================================
-- The old /contact page rendered a free-form HTML `contact.body`
-- field plus a hardcoded section, which produced the duplicated
-- "drop us a line" framing the founder flagged + still showed Plonk
-- Golf references inherited from the fork.
--
-- The new page replaces all of that with structured fields (email,
-- address, hours, social links). This migration:
--   • Drops the old contact.body row so it stops appearing in the
--     admin form as dead config.
--   • Seeds rows for every new field with sensible defaults +
--     helper text so /admin/content/info/contact reads cleanly.
-- =============================================================

delete from public.page_content where key = 'contact.body';

insert into public.page_content (key, value, page, field_kind, label, helper, sort_order)
values
  ('contact.eyebrow',
   'Get in touch',
   'info.contact', 'text',
   'Hero — Eyebrow',
   'Small label above the page title.',
   10),
  ('contact.title',
   'Say Hello',
   'info.contact', 'text',
   'Hero — Title',
   'The big headline of the page.',
   20),
  ('contact.intro',
   'For group bookings, partnership enquiries or anything else — drop us a line, we read every message.',
   'info.contact', 'textarea',
   'Hero — Intro paragraph',
   'Sits under the title; sets the tone before the cards.',
   30),

  ('contact.email_label',
   'Email us',
   'info.contact', 'text',
   'Email card — Label',
   'Small label above the email address card.',
   100),
  ('contact.email_address',
   'info@nodice.bar',
   'info.contact', 'text',
   'Email card — Address',
   'The email address customers can click to compose a message.',
   110),
  ('contact.email_blurb',
   'Best for group bookings, dietary requests, accessibility questions, press, and anything that needs a written reply.',
   'info.contact', 'textarea',
   'Email card — Blurb',
   'Helper text under the email address.',
   120),

  ('contact.address_label',
   'Visit',
   'info.contact', 'text',
   'Address card — Label',
   'Small label above the venue address.',
   200),
  ('contact.address_line1',
   'Arch 407, Mentmore Terrace',
   'info.contact', 'text',
   'Address card — Line 1',
   'Street address line.',
   210),
  ('contact.address_line2',
   'London Fields, Hackney, E8 3PH',
   'info.contact', 'text',
   'Address card — Line 2',
   'Area + postcode line.',
   220),
  ('contact.address_blurb',
   'Two minutes from London Fields station. We''re under the arches behind the park.',
   'info.contact', 'textarea',
   'Address card — Blurb',
   'Optional directions / "how to find us" copy.',
   230),
  ('contact.map_href',
   'https://maps.google.com/?q=Arch+407+Mentmore+Terrace+London+E8+3PH',
   'info.contact', 'url',
   'Address card — Map link',
   'Where the "Open in Google Maps" button goes.',
   240),

  ('contact.hours_label',
   'Opening hours',
   'info.contact', 'text',
   'Hours card — Label',
   'Small label above the opening hours block.',
   300),
  ('contact.hours_body',
   E'Mon–Thu  5pm – 11pm\nFri        5pm – 12am\nSat       2pm – 12am\nSun       2pm – 10pm',
   'info.contact', 'textarea',
   'Hours card — Body',
   'One day per line. Whitespace + en-dashes are preserved as typed.',
   310),

  ('contact.social_label',
   'Follow No Dice',
   'info.contact', 'text',
   'Social card — Label',
   'Small label above the social-media buttons.',
   400),
  ('contact.instagram_href',
   'https://www.instagram.com/nodice.bar/',
   'info.contact', 'url',
   'Social card — Instagram URL',
   'Where the Instagram button links to.',
   410),
  ('contact.facebook_href',
   'https://www.facebook.com/nodice.bar',
   'info.contact', 'url',
   'Social card — Facebook URL',
   'Where the Facebook button links to.',
   420)
on conflict (key) do nothing;
