-- Builder dashboard needs to tell apart two kinds of "not approved":
-- an editable denial the Builder should act on ('changes_requested' --
-- shown to them as "Needs response", same as applications.denied_resubmit)
-- versus a terminal one ('denied' -- view only, same as
-- applications.denied_final). Must be its own migration file: Postgres
-- won't let a transaction both add an enum value and reference it.
alter type build_status add value if not exists 'changes_requested';
