-- Model year of the car, entered on the Submit Build form (above Make).
-- It is now part of the Build title ("<year> <make> <model> <trim>") and is
-- what the E9 page's heading is built from, instead of a hand-typed "1971".
alter table public.builds
  add column if not exists year integer check (year between 1885 and 2100);

-- The E9 already has its year in its title; record it as data.
update public.builds set year = 1971 where slug = '71e9S38B36' and year is null;
