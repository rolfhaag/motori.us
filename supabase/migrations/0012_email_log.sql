-- Email notifications: a log of every email we try to send.
-- Run once in Supabase's SQL editor, after 0011_build_year.sql.
--
-- dedupe_key makes sends idempotent: the same event (for example "the
-- approval of application X") can never email twice, even if a route is
-- retried or a cron job runs twice. The one-week nudge relies on this too:
-- its key is fixed per application/build, so it is sent once, ever.
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text unique,
  template text not null,
  to_email text not null,
  subject text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  provider_id text,                 -- Resend's id for the message
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists email_log_created_at_idx on public.email_log (created_at desc);

-- Server-only table (service role bypasses RLS); no client policies on purpose.
alter table public.email_log enable row level security;
