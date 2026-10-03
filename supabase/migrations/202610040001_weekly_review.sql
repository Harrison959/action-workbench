-- Phase 6: additive kind only. Run after the existing migrations in the same project.
-- No payload rewrite, no RLS/RPC change. Safe to rerun.
begin;
set local lock_timeout = '5s';
alter table public.action_records drop constraint if exists action_records_kind_check;
alter table public.action_records add constraint action_records_kind_check check (
  kind in (
    'task','goal','inbox','event','account','income','client','salesDaily','deal',
    'sleep','course','study','episode','word','book','reading','workout','body',
    'routine','guitar','emotion','summary','plan','setting','focus',
    'project','projectNote','weeklyReview'
  )
);
commit;
