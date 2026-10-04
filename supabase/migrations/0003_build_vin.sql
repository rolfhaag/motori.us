-- A Build's VIN (or, for cars old enough to predate the 17-character
-- standard -- this E9 included -- its original chassis number). Its own
-- column rather than buried in draft_content.hero, since it's the one
-- field a future Buyer/Browser role will gate: everyone sees the Build
-- page, but only an unlocked viewer sees this value. The site-side display
-- (src/legacy-pages/*.html, .vin/.vin-label/.vin-value in site.css) already
-- renders it plainly today; masking is not wired up yet (see the .masked
-- comment in site.css) -- add it here, not as a second column, when ready.
alter table public.builds add column if not exists vin text;
