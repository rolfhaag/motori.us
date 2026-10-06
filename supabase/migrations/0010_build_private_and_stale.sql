-- Private publishing + stale-draft tracking.
--
-- visibility: 'public' (default, listed in the sitemap, open to anyone) or
-- 'private' (published, but only viewable with the share password; kept out
-- of the sitemap and search engines). access_password_hash stores a salted
-- scrypt hash -- the plain password is shown to Admin once, at generation.
--
-- draft_input_hash: fingerprint of the inputs (make/model/trim/theme, photo
-- set, PDF set) the current AI draft was generated from. When the Builder's
-- current inputs no longer match, the dashboard shows "inputs changed since
-- your draft" instead of silently showing an out-of-date page.
alter table public.builds
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public', 'private')),
  add column if not exists access_password_hash text,
  add column if not exists draft_input_hash text;
