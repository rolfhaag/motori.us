-- Chunk 2A: AI-drafted Build pages. Tracks one Build's drafting state.
--   draft_status: none -> running -> done | failed. 'failed' is also how a
--     "your uploads weren't usable" send-back is recorded (draft_error holds
--     the explanation shown to the Builder).
--   draft_runs: successful drafts so far. Cap is 3 = the first draft plus
--     2 refreshes; failed runs don't count.
--   draft_feedback: the Builder's note for the latest refresh (text/photo
--     order only -- the page layout is a fixed template).
-- draft_content / photos (captions, categories, order) already exist.
alter table public.builds add column if not exists draft_status text not null default 'none';
alter table public.builds add column if not exists draft_error text;
alter table public.builds add column if not exists draft_runs integer not null default 0;
alter table public.builds add column if not exists draft_started_at timestamptz;
alter table public.builds add column if not exists draft_feedback text;
