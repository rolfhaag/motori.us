-- Phase 2: Applicant -> Builder -> Build submission/publish flow.
-- Run once in Supabase's SQL editor, after 0001_init.sql.

-- Ban: a flag on the existing users table, checked at login/sync time.
-- Cascades to hiding that user's builder/build pages in application logic
-- (visibility = NOT hidden AND NOT owner.banned), without overwriting the
-- independent `hidden` flags below -- so un-banning restores prior state.
alter table public.users add column if not exists banned boolean not null default false;

-- 'draft' = saved but not yet submitted (the "come back and finish later"
-- requirement); 'denied_resubmit' is also editable -- the applicant revises
-- the same row and resubmits. 'denied_final' and 'approved' are terminal.
create type application_status as enum ('draft', 'submitted', 'denied_resubmit', 'denied_final', 'approved');

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id),
  handle text not null,              -- desired Builder handle/slug, e.g. "mahlzeit-motorsport"
  description text not null default '',
  socials text,                      -- optional, freeform for now
  photos jsonb not null default '[]', -- array of storage paths, 1-3 items, enforced in app code
  status application_status not null default 'draft',
  admin_notes text,                  -- required when status = denied_resubmit or denied_final
  decided_by text references public.users(id),
  decided_at timestamptz,
  reapply_after timestamptz,         -- set to now() + 30 days on denied_final
  denied_snapshot jsonb,             -- {handle, description, socials, photos} captured at
                                      -- denial time, so a resubmit can be checked against
                                      -- it ("only if they make changes to the original")
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only one active (non-terminal) application per user at a time: a draft
-- being written, a submitted one awaiting review, or one sent back for
-- resubmission. Once it reaches denied_final or approved, this index no
-- longer blocks a new row.
create unique index if not exists one_active_application_per_user
  on public.applications(user_id)
  where status in ('draft', 'submitted', 'denied_resubmit');

drop trigger if exists trg_applications_updated_at on public.applications;
create trigger trg_applications_updated_at
  before update on public.applications
  for each row execute procedure public.set_updated_at();

alter table public.applications enable row level security;
create policy "Users can read their own applications"
  on public.applications for select
  using (auth.uid()::text = user_id);

-- Builder profile: created when an application is approved. Separate from
-- `users` so a user's role flip to 'builder' and their public profile data
-- are decoupled (role is auth/permissions; this is public-facing content).
create table if not exists public.builders (
  user_id text primary key references public.users(id),
  handle text not null unique,       -- powers /builders/<handle>/
  description text not null,
  socials text,
  hidden boolean not null default false, -- independent of ban; Admin toggle
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_builders_updated_at on public.builders;
create trigger trg_builders_updated_at
  before update on public.builders
  for each row execute procedure public.set_updated_at();

alter table public.builders enable row level security;
create policy "Anyone can read non-hidden builder profiles"
  on public.builders for select
  using (hidden = false);
create policy "Builders can read their own profile regardless of hidden"
  on public.builders for select
  using (auth.uid()::text = user_id);

create type build_status as enum ('submitted', 'denied', 'published');

create table if not exists public.builds (
  id uuid primary key default gen_random_uuid(),
  builder_id text not null references public.builders(user_id),
  slug text unique,                  -- assigned on publish, e.g. "71e9S38B36"
  title text not null,
  photos jsonb not null default '[]',     -- [{path, caption, category}], max 30
  documents jsonb not null default '[]',  -- [{path, filename}], max 10
  draft_content jsonb,               -- AI-generated page content, e9-shaped:
                                      -- { hero: {eyebrow, thesis, specChips[]},
                                      --   baseline: {summary, glance[], detailed[]},
                                      --   roadmap: [{category, text}],
                                      --   updates: [{date, title, text}] }
  edit_requests jsonb not null default '[]', -- [{section, note, created_at}]
  status build_status not null default 'submitted',
  hidden boolean not null default false,  -- independent Admin toggle, post-publish
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Max 5 submitted-and-undecided build submissions per builder: enforced in
-- application code (count existing 'submitted' rows before insert), since a
-- count-based cap isn't expressible as a plain unique index.

drop trigger if exists trg_builds_updated_at on public.builds;
create trigger trg_builds_updated_at
  before update on public.builds
  for each row execute procedure public.set_updated_at();

alter table public.builds enable row level security;
create policy "Anyone can read published, non-hidden builds"
  on public.builds for select
  using (status = 'published' and hidden = false);
create policy "Builders can read their own builds regardless of status"
  on public.builds for select
  using (auth.uid()::text = builder_id);
