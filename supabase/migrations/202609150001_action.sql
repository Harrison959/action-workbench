-- Run once in your own Supabase SQL editor. No private records are in this file.
create table if not exists public.action_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 200),
  kind text not null check (kind in ('task','goal','inbox','event','account','income','client','salesDaily','deal','sleep','course','study','episode','word','book','reading','workout','body','routine','guitar','emotion','summary','plan','setting','focus')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) < 200000),
  version bigint not null default 1,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(user_id,id)
);
alter table public.action_records enable row level security;
drop policy if exists "Read own records" on public.action_records;
create policy "Read own records" on public.action_records for select to authenticated using ((select auth.uid())=user_id);
-- All writes use compare-and-swap RPC, so stale devices cannot silently overwrite money.
revoke all on public.action_records from anon, authenticated;
grant select on public.action_records to authenticated;
create or replace function public.save_action_record(p_id text,p_kind text,p_payload jsonb,p_deleted boolean,p_expected bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); existing public.action_records; saved public.action_records;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || p_id, 0));
 select * into existing from public.action_records where user_id=uid and id=p_id for update;
 if (existing.id is null and p_expected<>0) or (existing.id is not null and existing.version<>p_expected) then
   return jsonb_build_object('conflict',true,'record',to_jsonb(existing));
 end if;
 insert into public.action_records(user_id,id,kind,payload,version,deleted)
 values(uid,p_id,p_kind,p_payload,1,p_deleted)
 on conflict(user_id,id) do update set payload=excluded.payload,kind=excluded.kind,deleted=excluded.deleted,version=action_records.version+1,updated_at=now()
 returning * into saved;
 return jsonb_build_object('conflict',false,'record',to_jsonb(saved));
end $$;
revoke all on function public.save_action_record(text,text,jsonb,boolean,bigint) from public,anon;
grant execute on function public.save_action_record(text,text,jsonb,boolean,bigint) to authenticated;
