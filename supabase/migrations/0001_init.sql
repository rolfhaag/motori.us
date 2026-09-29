-- Phase 1: users + roles.
-- Run this once in Supabase's SQL editor (or via `supabase db push` once the
-- CLI/project are linked) before the app's first login.

create type user_role as enum ('admin', 'builder', 'applicant');

create table if not exists public.users (
  id text primary key,               -- Privy DID, e.g. "did:privy:abc123"
  email text unique,
  role user_role not null default 'applicant',
  display_name text,
  wallet_address_evm text,
  wallet_address_btc text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at current on every row change.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
  before update on public.users
  for each row execute procedure public.set_updated_at();

-- Row-level security: locked down by default. The app's server-side code
-- uses the service role key (which bypasses RLS) for all writes in Phase 1;
-- these policies matter once Phase 2/3 add client-side reads.
alter table public.users enable row level security;

create policy "Users can read their own row"
  on public.users for select
  using (auth.uid()::text = id);
