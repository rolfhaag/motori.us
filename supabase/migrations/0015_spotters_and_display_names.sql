-- Spotters (people who find cars and nominate them) + separate display names.
-- Run once in Supabase's SQL editor, after 0014_legal_and_follow.sql and
-- BEFORE deploying the matching code.

-- 1. Display names: a handle is the lowercase URL; the display name is how it reads.
alter table public.builders add column if not exists display_name text;
alter table public.applications add column if not exists display_name text;

-- 2. Spotters.
create table if not exists public.spotters (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique references public.users(id) on delete cascade,
  handle text not null unique,
  display_name text not null,
  social_url text,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now()
);
alter table public.spotters enable row level security; -- server-only (service role)

-- 3. Invite links an Admin creates and shares (DM, text, email).
create table if not exists public.spotter_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  name text,                         -- who it's for (optional, prefilled at setup)
  email text,                        -- if the invite was also emailed
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by text references public.users(id) on delete set null,
  revoked_at timestamptz
);
alter table public.spotter_invites enable row level security;

-- 4. Nominations can now come from a Spotter, for a specific car.
alter table public.nominations alter column builder_id drop not null;
alter table public.nominations
  add column if not exists spotter_id uuid references public.spotters(id) on delete cascade,
  add column if not exists car_note text;
alter table public.nominations drop constraint if exists nominations_one_source;
alter table public.nominations
  add constraint nominations_one_source check (builder_id is not null or spotter_id is not null);
create index if not exists nominations_spotter_idx on public.nominations (spotter_id, created_at desc);

-- 5. Credits.
alter table public.applications add column if not exists spotter_id uuid references public.spotters(id) on delete set null;
alter table public.builders
  add column if not exists brought_by_spotter_id uuid references public.spotters(id) on delete set null,
  add column if not exists spotter_credit_answered boolean not null default false;
alter table public.builds add column if not exists spotted_by_spotter_id uuid references public.spotters(id) on delete set null;

-- 6. Legal: the Spotter Terms are a new document type.
alter table public.legal_documents drop constraint if exists legal_documents_doc_type_check;
alter table public.legal_documents
  add constraint legal_documents_doc_type_check
  check (doc_type in ('terms', 'builder_terms', 'privacy', 'mint_terms', 'spotter_terms'));
