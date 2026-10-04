-- Submit Build flow (Chunk 1): a Build row can now be saved before it's
-- submitted for review, same "come back and finish later" semantics as
-- applications.status = 'draft'. Must be its own migration file: Postgres
-- won't let a transaction both add an enum value and reference that value,
-- so this cannot be combined with 0005_build_fields.sql even though they're
-- part of the same feature.
alter type build_status add value if not exists 'draft';
