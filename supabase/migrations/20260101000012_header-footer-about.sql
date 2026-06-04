-- =============================================================
-- Migration 009 — site-wide chrome (Header + Footer), /about
-- inline photos, and homepage press logos
-- =============================================================
-- After this the chrome that sits on every public page (the sticky
-- header and the footer) is editable, plus the about-page in-line
-- images and the press logo strip on the homepage.
--
-- Header nav + Footer social links are stored as textareas with one
-- entry per line in "Label | URL" form. The public components split
-- on the pipe and trim. Empty lines and lines without "|" are
-- skipped.
--
-- Safe to re-run.
-- =============================================================

insert into public.page_content (key, page, field_kind, label, helper, sort_order, value)
values
  -- ===== Site Header (global) =====
  ('header.logo_image', 'global.header', 'image',    'Logo image',  'Header logo (transparent PNG works best).', 1, ''),
  ('header.logo_alt',   'global.header', 'text',     'Logo alt text', 'For screen readers.',                    2, ''),
  ('header.nav',        'global.header', 'textarea', 'Nav links',   'One per line, "Label | /href".',           3, ''),
  ('header.cta_label',  'global.header', 'text',     'CTA button label', 'The pink "Book Now" button.',         4, ''),
  ('header.cta_href',   'global.header', 'url',      'CTA button href',  '',                                    5, ''),

  -- ===== Site Footer (global) =====
  ('footer.brand_title',   'global.footer', 'text',     'Brand title',    'Big "Plonk Golf" heading in column 1.',   1, ''),
  ('footer.brand_tagline', 'global.footer', 'textarea', 'Brand tagline',  '',                                        2, ''),
  ('footer.brand_email',   'global.footer', 'text',     'Contact email',  'Shown as a mailto link.',                 3, ''),

  ('footer.hackney_heading', 'global.footer', 'text',     'Hackney heading',  '',                                    10, ''),
  ('footer.hackney_address', 'global.footer', 'textarea', 'Hackney address',  'One line per line. HTML-style breaks; use a *line starting with —* for the "main entrance" subtext.', 11, ''),

  ('footer.borough_heading', 'global.footer', 'text',     'Borough heading',  '',                                    20, ''),
  ('footer.borough_address', 'global.footer', 'textarea', 'Borough address',  'One line per line.',                  21, ''),

  ('footer.socials_heading', 'global.footer', 'text',     'Social column heading', '',                               30, ''),
  ('footer.socials',         'global.footer', 'textarea', 'Social links',          'One per line, "Label | https://...".', 31, ''),

  ('footer.copyright',       'global.footer', 'text',     'Copyright line',  'Use {{year}} to insert the current year.', 40, ''),

  -- ===== /about inline photos =====
  ('about.body_image1',  'info.about', 'image',    'Body image 1',  'First photo mid-article on /about.',         10, ''),
  ('about.body_image2',  'info.about', 'image',    'Body image 2',  'Second photo mid-article on /about.',        11, ''),
  ('about.body_heading2', 'info.about', 'text',    'Sub-heading 2', '"Totally unique, totally Plonk" heading.',   12, ''),
  ('about.body_para1',   'info.about', 'textarea', 'Body — opening paragraphs', 'Lead paragraph(s) of the article. Blank line between paragraphs.', 13, ''),
  ('about.body_para2',   'info.about', 'textarea', 'Body — section 2 paragraph', 'Paragraph(s) under "Totally unique, totally Plonk".', 14, ''),
  ('about.body_heading3', 'info.about', 'text',    'Sub-heading 3', '"Design · Build · Install · Manage" heading.', 15, ''),
  ('about.body_para3',   'info.about', 'textarea', 'Body — section 3 paragraph', '', 16, ''),
  ('about.gallery_heading', 'info.about', 'text',    'Gallery heading', '',                                          20, ''),
  ('about.gallery_intro',   'info.about', 'textarea', 'Gallery intro',   '',                                          21, ''),

  -- ===== Homepage press logo strip =====
  ('home.press.eyebrow', 'home', 'text', 'Press strip eyebrow', '"As featured in" line above the logos.', 50, '')

on conflict (key) do update
  set page = excluded.page,
      field_kind = excluded.field_kind,
      label = excluded.label,
      helper = excluded.helper,
      sort_order = excluded.sort_order;
