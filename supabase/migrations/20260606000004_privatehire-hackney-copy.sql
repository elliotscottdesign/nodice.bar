-- =============================================================
-- /private-hire copy clean-up: kill Plonk Golf + Borough leftovers
-- =============================================================
-- The 20260101000008 seed migration originally populated this page
-- with copy inherited from the Plonk Golf fork ("Two London venues",
-- "nine-hole Polynesian course", "Take over a course"). No Dice
-- Hackney is a single bar — fix the live copy to match the actual
-- product. Falls back to the rephrased text only when the row hasn't
-- been hand-edited via /admin/content/private-hire since the bad
-- seed landed (we don't want to clobber the founder's edits).
-- =============================================================

-- 1. Intro under the title — was "Two London venues, one unforgettable party..."
update public.page_content
set value = 'London Fields'' newest bar — yours for the night. Take over an arch or the whole place.'
where key = 'privatehire.intro'
  and value = 'Two London venues, one unforgettable party. Take over a course, an arch, or the whole place.';

-- 2. Body block — was the "course/arch/venue" Plonk Golf copy
update public.page_content
set value = '<h2>The kind of party people actually remember.</h2><p>Take over an arch or the whole bar. Birthdays, work parties, hen dos, weddings — we host them all.</p>'
where key = 'privatehire.body'
  and value = '<h2>The kind of party people actually remember.</h2><p>Take over a course, an arch, or the whole venue. Birthdays, work parties, hen dos, weddings — we host them all.</p>';

-- 3. Hackney-card body — was about a "nine-hole Polynesian course" (Plonk venue)
update public.page_content
set value = '<p>Two archways at London Fields — bar, pool tables and an open lounge — all yours.</p>'
where key = 'privatehire.hackney.body'
  and value = '<p>Our nine-hole Polynesian course, beer garden, pool, arcade and tiki bar — all yours.</p>';

-- 4. Hackney image fallback — was a /hackney/garden/Garden_1.jpg from the
-- Plonk-era asset set we purged. Blanking lets the page render cleanly
-- until the founder uploads their own via the admin.
update public.page_content
set value = ''
where key = 'privatehire.hackney.image'
  and value = '/hackney/garden/Garden_1.jpg';
