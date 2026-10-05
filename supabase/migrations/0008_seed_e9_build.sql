-- One-time seed: registers the existing hand-built E9 page
-- (/builds/71e9S38B36/, still served from its static page) as a real row
-- under the Mahlzeit Motorsport Builder, so it shows up in that Builder's
-- dashboard as Approved. The static page keeps winning the route, so the
-- page itself is unchanged -- and note the Admin "Hide" toggle only affects
-- dynamic pages, so it won't hide this one.
--
-- Run after 0006 (needs the mahlzeit-motorsport builders row). Safe to
-- re-run: no-ops if the slug already exists.
insert into public.builds (builder_id, slug, title, make, model, trim, vin, theme, status)
select user_id, '71e9S38B36', '1971 BMW E9 S38B36', 'BMW', 'E9', 'S38B36', '2230478',
       'A gentleman''s Strassenversion homage E9 carrying the 3.6-liter S38 and Getrag gearbox from a 90''s E34 M5.',
       'published'
from public.builders
where handle = 'mahlzeit-motorsport'
on conflict (slug) do nothing;
