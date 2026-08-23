-- One reusable approval assertion for every matchday communication channel.

create or replace function public.assert_matchday_approval(target_club_id uuid,target_day_scope text,target_matchday_date text,target_snapshot_hash text)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare approval public.matchday_locks%rowtype;
begin
  if auth.uid() is null or not public.is_club_member(target_club_id) then raise exception 'Club access required' using errcode='42501'; end if;
  select * into approval from public.matchday_locks lock_state where lock_state.club_id=target_club_id and lock_state.day_scope=left(lower(trim(coalesce(target_day_scope,''))),40) and lock_state.matchday_date=left(trim(coalesce(target_matchday_date,'')),80);
  if not found or not approval.locked then raise exception 'This matchday is not locked for communication' using errcode='22023'; end if;
  if approval.snapshot_hash is distinct from left(trim(coalesce(target_snapshot_hash,'')),100) then raise exception 'The fixture plan changed after approval. Unlock, review and lock it again' using errcode='22023'; end if;
  return jsonb_build_object('approved',true,'locked_by',approval.locked_by,'locked_at',approval.locked_at,'snapshot_hash',approval.snapshot_hash);
end; $$;

revoke all on function public.assert_matchday_approval(uuid,text,text,text) from public,anon;
grant execute on function public.assert_matchday_approval(uuid,text,text,text) to authenticated;
