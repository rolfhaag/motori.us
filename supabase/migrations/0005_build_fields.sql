-- Submit Build flow (Chunk 1): the fields a Builder types in directly for a
-- new Build, before any AI drafting exists. `theme` is a short creative
-- brief (<=2 sentences) that informs the AI drafting step (Chunk 2) -- it is
-- not verbatim displayed copy. `builder_notes` is the Builder's optional
-- note *to* motori.us admins, kept separate from `admin_notes`, which flows
-- the other direction (Admin's note back to the Builder).
--
-- Run this only after 0004_build_status_draft.sql has been applied in its
-- own, separate transaction (see that file's comment).
alter table public.builds add column if not exists make text;
alter table public.builds add column if not exists model text;
alter table public.builds add column if not exists trim text;
alter table public.builds add column if not exists theme text;
alter table public.builds add column if not exists builder_notes text;

-- Note: `photos` and `documents` columns already exist from 0002_phase2.sql
-- ([{path, filename/caption/category}] jsonb arrays) -- nothing to add here.
