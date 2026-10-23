-- Terms, privacy and following builds.
-- Run once in Supabase's SQL editor, after 0013_nominations.sql.
--
-- legal_documents: every version of every legal document, stored in full and
--   never changed (so "what exactly did they agree to" always has an answer).
-- legal_acceptances: append-only record of who accepted which version, when,
--   and where (sign-in gate, application, a specific Build submission).
-- email_subscriptions: people following the site, a Builder, or a Build, with
--   double opt-in and a one-click unsubscribe token.
-- builds.published_at: when a Build first went public (feeds and emails).

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  doc_type text not null check (doc_type in ('terms', 'builder_terms', 'privacy', 'mint_terms')),
  version text not null,                 -- e.g. '2026-10-19'
  title text not null,
  effective_date date not null,
  content_md text not null,
  content_sha256 text not null,
  change_summary text,                   -- plain-English "what changed", used in notice emails
  created_at timestamptz not null default now(),
  unique (doc_type, version)
);

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  doc_type text not null,
  version text not null,
  content_sha256 text not null,
  context text not null,                 -- 'gate' | 'application' | 'build_submit'
  build_id uuid references public.builds(id) on delete set null,
  ip text,
  user_agent text,
  accepted_at timestamptz not null default now()
);

create index if not exists legal_acceptances_user_idx
  on public.legal_acceptances (user_id, doc_type, accepted_at desc);

-- Legal records are append-only: block edits and deletes (the service role
-- included). Remove a row only by hand, deliberately, with the trigger dropped.
create or replace function public.legal_records_are_immutable()
returns trigger as $$
begin
  raise exception 'legal records are append-only';
end;
$$ language plpgsql;

drop trigger if exists trg_legal_documents_immutable on public.legal_documents;
create trigger trg_legal_documents_immutable
  before update or delete on public.legal_documents
  for each row execute procedure public.legal_records_are_immutable();

drop trigger if exists trg_legal_acceptances_immutable on public.legal_acceptances;
create trigger trg_legal_acceptances_immutable
  before update on public.legal_acceptances
  for each row execute procedure public.legal_records_are_immutable();
-- (acceptances may cascade-delete with the user; updates are blocked)

alter table public.legal_documents enable row level security;
alter table public.legal_acceptances enable row level security;
create policy "Anyone can read legal documents"
  on public.legal_documents for select using (true);

create table if not exists public.email_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null,                   -- lowercased
  scope text not null,                   -- 'site' | 'builder:<handle>' | 'build:<slug>'
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'unsubscribed')),
  token text not null unique,            -- confirm / unsubscribe links
  source text,                           -- page the signup came from
  consent_text text not null,            -- the exact wording shown next to the box
  ip text,
  user_agent text,
  confirm_sent_at timestamptz,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  unique (email, scope)
);

create index if not exists email_subscriptions_scope_idx
  on public.email_subscriptions (scope, status);

alter table public.email_subscriptions enable row level security;  -- server only

alter table public.builds add column if not exists published_at timestamptz;
update public.builds set published_at = coalesce(published_at, updated_at)
  where status = 'published' and published_at is null;
