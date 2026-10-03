-- V2 Phase 2. Run after 202609150001_action.sql, in the SAME Supabase project.
-- Additive only: no payload rewrite, no deleted rows, no RLS/RPC/auth changes.
-- Safe to rerun. On failure the transaction restores the previous constraint.
begin;
set local lock_timeout = '5s';
alter table public.action_records drop constraint if exists action_records_kind_check;
alter table public.action_records add constraint action_records_kind_check check (
  kind in (
    'task','goal','inbox','event','account','income','client','salesDaily','deal',
    'sleep','course','study','episode','word','book','reading','workout','body',
    'routine','guitar','emotion','summary','plan','setting','focus',
    'project','projectNote'
  )
);
commit;
