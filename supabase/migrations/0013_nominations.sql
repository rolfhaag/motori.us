-- Nominations: a Builder taps "Nominate" on their Builder page, we mint a
-- one-person invite link (/apply/?n=<token>), and they send it with their
-- phone's share sheet. We store nothing about the person they send it to.
-- Run once in Supabase's SQL editor, after 0012_email_log.sql.
create table if not exists public.nominations (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  builder_id text not null references public.users(id),
  created_at timestamptz not null default now(),
  -- Set when someone applies through the link. The first applicant claims it.
  claimed_application_id uuid,
  claimed_at timestamptz
);
create index if not exists nominations_builder_idx on public.nominations (builder_id, created_at desc);

alter table public.nominations enable row level security; -- server-only (service role)

-- Who vouched for an application, shown to Admin on review.
alter table public.applications
  add column if not exists nominated_by text references public.users(id),
  add column if not exists nomination_id uuid references public.nominations(id);
