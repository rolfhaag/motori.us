-- One-time seed: gives Rolf's existing (Admin) account an approved Builder
-- profile for the "mahlzeit-motorsport" handle, so the Submit Build flow
-- (Chunk 1) and the builder-aware nav/roster-card enhancements have a
-- `builders` row to key off of. The public /builders/mahlzeit-motorsport/
-- page itself is still the static legacy page and is untouched by this --
-- this only connects the handle to a real account in the database.
--
-- Safe to re-run: no-ops if this user already has a builders row
-- (user_id is the primary key).
insert into public.builders (user_id, handle, description, socials)
select id, 'mahlzeit-motorsport',
       'Mahlzeit Motorsport -- restomods and documented builds.',
       null
from public.users
where email = 'rolfjhaag@gmail.com'
on conflict (user_id) do nothing;
