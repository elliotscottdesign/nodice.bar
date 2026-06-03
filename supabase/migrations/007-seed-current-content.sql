-- =============================================================
-- Plonk Golf — seed current live content into page_content
-- =============================================================
-- 004-page-content.sql registered every editable slot with an
-- empty `value`, relying on the React fallbacks for what visitors
-- actually see. This migration fills `value` in with the live
-- copy + images so when an admin opens the CMS they see the
-- current site as their starting point, not blank fields.
--
-- Idempotent: only updates rows whose value is still empty, so
-- any edits already saved through the admin survive a re-run.
-- =============================================================

-- ---------- Home ----------
update public.page_content set value = '/borough/course/Course_1.jpg'
  where key = 'home.hero.image' and value = '';
update public.page_content set value = 'Hackney · Borough Market'
  where key = 'home.hero.eyebrow' and value = '';
update public.page_content set value = 'Crazy Golf Creations'
  where key = 'home.hero.headline_1' and value = '';
update public.page_content set value = 'Across the Capital'
  where key = 'home.hero.headline_2' and value = '';
update public.page_content set value = 'Two original courses. Two iconic London arches. One unforgettable round — with cocktails, food and games to match.'
  where key = 'home.hero.subcopy' and value = '';
update public.page_content set value = 'Polynesian putt paradise, 7ft American pool, retro arcade, tacos and rum punch.'
  where key = 'home.venues.hackney' and value = '';
update public.page_content set value = 'London under the arches — 9 holes of street-art murals, cocktails and full kitchen.'
  where key = 'home.venues.borough' and value = '';

-- ---------- Venue: Hackney ----------
update public.page_content set value = '/hackney/course/Course_1.jpg'
  where key = 'venue.hackney.hero_image' and value = '';
update public.page_content set value = 'Outdoors & covered'
  where key = 'venue.hackney.eyebrow' and value = '';
update public.page_content set value = 'Plonk Hackney at No Dice Games Bar'
  where key = 'venue.hackney.title' and value = '';
update public.page_content set value = 'Our perfectly positioned games bar and golf spot is just a short walk from Broadway Market and looks across London Fields.'
  where key = 'venue.hackney.intro' and value = '';
update public.page_content set value = '<h2>A Polynesian putting paradise</h2><p>Our Hackney course has been rebuilt — bigger, brighter and bolder than ever. Volcano canyons, a tiki forest, golf gods to appease, a stone circle to navigate and octopuses to dodge under the sea — all now fully covered and out of the rain.</p>'
  where key = 'venue.hackney.body' and value = '';

-- ---------- Venue: Borough Market ----------
update public.page_content set value = '/borough/course/Course_1.jpg'
  where key = 'venue.borough.hero_image' and value = '';
update public.page_content set value = 'Borough Market · Indoor · 9 holes'
  where key = 'venue.borough.eyebrow' and value = '';
update public.page_content set value = 'Crazy Golf at London Bridge'
  where key = 'venue.borough.title' and value = '';
update public.page_content set value = 'Tucked into four railway arches under London Bridge. A 360° gallery from London''s best street artists, surrounding nine holes of London icons.'
  where key = 'venue.borough.intro' and value = '';
update public.page_content set value = '<h2>London under the arches</h2><p>Nine holes navigating Big Ben, the Tower of London, the Thames Barrier and a London phone box, painted by the city''s best graffiti artists. Plus a full bar, arcade and snug pool tables.</p>'
  where key = 'venue.borough.body' and value = '';

-- ---------- Private hire — overview ----------
update public.page_content set value = 'Take Over Plonk'
  where key = 'privatehire.title' and value = '';
update public.page_content set value = 'Two London venues, one unforgettable party. Take over a course, an arch, or the whole place.'
  where key = 'privatehire.intro' and value = '';
update public.page_content set value = '<h2>The kind of party people actually remember.</h2><p>Take over a course, an arch, or the whole venue. Birthdays, work parties, hen dos, weddings — we host them all.</p>'
  where key = 'privatehire.body' and value = '';

-- ---------- Private hire — Hackney ----------
update public.page_content set value = 'Take Over Plonk Hackney'
  where key = 'privatehire.hackney.title' and value = '';
update public.page_content set value = '<p>Our nine-hole Polynesian course, beer garden, pool, arcade and tiki bar — all yours.</p>'
  where key = 'privatehire.hackney.body' and value = '';
update public.page_content set value = '/hackney/garden/Garden_1.jpg'
  where key = 'privatehire.hackney.image' and value = '';

-- ---------- Private hire — Borough Market ----------
update public.page_content set value = 'Take Over Plonk Borough'
  where key = 'privatehire.borough.title' and value = '';
update public.page_content set value = '<p>Four railway arches under London Bridge — yours for the night.</p>'
  where key = 'privatehire.borough.body' and value = '';
update public.page_content set value = '/borough/course/Course_4.jpg'
  where key = 'privatehire.borough.image' and value = '';

-- ---------- Info pages ----------
update public.page_content set value = 'All About Plonk Golf'
  where key = 'about.title' and value = '';
update public.page_content set value =
'<p>Plonk Crazy Golf was founded by a troop of set designers from the film industry who banded together for a common cause — using their skills to create the greatest crazy golf courses imaginable and plonking them down around the Capital.</p>
<p>In 2014 we opened our first course in Haggerston, London, built from 100% up-cycled materials rescued from the streets of Hackney. Since that initial success, we''ve been creating ever more ambitious courses across the UK and Europe.</p>
<h2>Totally unique, totally Plonk</h2>
<p>Totally unique and customisable, we work closely with award-winning venues, bars, pubs, and museums to create one-of-a-kind golf-stacle courses tailored to each venue. Outdoors you can find us working with major tourist attractions such as ZSL London Zoo and The Horniman Museum and Gardens, bringing our signature nine-hole courses to award-winning venues. Indoors, we''re creating hyper-coloured UV adventures.</p>
<h2>Design · Build · Install · Manage</h2>
<p>We design, build, install and manage all of our golf courses ourselves, meaning no two are alike. Each Plonk course offers a completely new experience tailored to match the venue. Big or small, themed or branded, our in-house design team always have their pencils sharpened, ready to design the perfect Plonk course.</p>
<p>So come on down and join us in one of our putting paradises for a plonking good time!</p>'
  where key = 'about.body' and value = '';

update public.page_content set value = 'Say Hello'
  where key = 'contact.title' and value = '';
update public.page_content set value =
'<p>For group bookings, partnership enquiries or anything else, drop us a line — we read every message.</p>
<p>Email: <a href="mailto:info@plonkgolf.co.uk">info@plonkgolf.co.uk</a></p>
<p>We''re always looking for new venues to work with — if you have a space, an idea, or just want to chat about a Plonk course in your location, get in touch.</p>'
  where key = 'contact.body' and value = '';

update public.page_content set value = 'Booking FAQs'
  where key = 'faqs.title' and value = '';
update public.page_content set value = 'Everything you need to know about how Plonk bookings work — slots, splits, prices, refunds, and what happens on the day.'
  where key = 'faqs.intro' and value = '';

update public.page_content set value = 'Snack Bar'
  where key = 'snackbar.title' and value = '';
update public.page_content set value =
'<p>BBQ meat &amp; burgers, supplied by Smokoloko of Spitalfields. Available at Plonk Hackney only.</p>'
  where key = 'snackbar.body' and value = '';

update public.page_content set value = 'Terms & Conditions'
  where key = 'terms.title' and value = '';
update public.page_content set value =
'<p>The full Plonk Golf terms &amp; conditions are being updated alongside the new booking system. For booking-specific questions in the meantime, please email <a href="mailto:info@plonkgolf.co.uk">info@plonkgolf.co.uk</a>.</p>'
  where key = 'terms.body' and value = '';

update public.page_content set value = 'Privacy Policy'
  where key = 'privacy.title' and value = '';
update public.page_content set value =
'<p>The full Plonk Golf privacy policy is being updated alongside the new booking system. In the meantime, any questions about how we handle your data can be sent to <a href="mailto:info@plonkgolf.co.uk">info@plonkgolf.co.uk</a>.</p>'
  where key = 'privacy.body' and value = '';
