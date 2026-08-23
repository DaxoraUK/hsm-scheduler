-- Bind matchday publication to the exact schedule version approved by the lock.

alter table public.matchday_locks add column if not exists snapshot_hash text;
alter table public.matchday_locks add column if not exists fixture_count integer not null default 0 check (fixture_count >= 0);

drop function if exists public.set_matchday_lock(uuid,text,text,boolean);
create function public.set_matchday_lock(
  target_club_id uuid, target_day_scope text, target_matchday_date text,
  target_locked boolean, target_snapshot_hash text default null, target_fixture_count integer default 0
) returns jsonb language plpgsql security definer set search_path = '' set row_security = off as $$
declare actor_id uuid := auth.uid(); day_value text := left(lower(trim(coalesce(target_day_scope,''))),40); date_value text := left(trim(coalesce(target_matchday_date,'')),80); hash_value text := left(trim(coalesce(target_snapshot_hash,'')),100); saved public.matchday_locks%rowtype; actor_label text;
begin
  if actor_id is null or not public.can_publish_club_matchweek(target_club_id) then raise exception 'Matchweek publisher access required' using errcode='42501'; end if;
  if day_value='' or date_value='' then raise exception 'Matchday scope and date are required' using errcode='22023'; end if;
  if coalesce(target_locked,false) and (hash_value='' or coalesce(target_fixture_count,0)<1) then raise exception 'An exact non-empty schedule version is required' using errcode='22023'; end if;
  insert into public.matchday_locks(club_id,day_scope,matchday_date,locked,locked_by,locked_at,updated_by,snapshot_hash,fixture_count)
  values(target_club_id,day_value,date_value,coalesce(target_locked,false),case when target_locked then actor_id end,case when target_locked then now() end,actor_id,case when target_locked then hash_value end,case when target_locked then target_fixture_count else 0 end)
  on conflict(club_id,day_scope,matchday_date) do update set locked=excluded.locked,locked_by=excluded.locked_by,locked_at=excluded.locked_at,updated_by=actor_id,updated_at=now(),snapshot_hash=excluded.snapshot_hash,fixture_count=excluded.fixture_count returning * into saved;
  select coalesce(nullif(trim(profile.display_name),''),profile.email,actor_id::text) into actor_label from public.user_profiles profile where profile.id=actor_id;
  perform public.record_audit_event(target_club_id,case when saved.locked then 'matchday.schedule.locked' else 'matchday.schedule.unlocked' end,'matchday_lock',saved.day_scope||':'||saved.matchday_date,jsonb_build_object('day_scope',saved.day_scope,'matchday_date',saved.matchday_date,'snapshot_hash',saved.snapshot_hash,'fixture_count',saved.fixture_count));
  return jsonb_build_object('locked',saved.locked,'locked_by',saved.locked_by,'locked_by_label',actor_label,'locked_at',saved.locked_at,'updated_at',saved.updated_at,'snapshot_hash',saved.snapshot_hash,'fixture_count',saved.fixture_count);
end; $$;

create or replace function public.get_matchday_lock(target_club_id uuid,target_day_scope text,target_matchday_date text)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare saved public.matchday_locks%rowtype; actor_label text;
begin
  if auth.uid() is null or not public.is_club_member(target_club_id) then raise exception 'Club access required' using errcode='42501'; end if;
  select * into saved from public.matchday_locks lock_state where lock_state.club_id=target_club_id and lock_state.day_scope=left(lower(trim(coalesce(target_day_scope,''))),40) and lock_state.matchday_date=left(trim(coalesce(target_matchday_date,'')),80);
  if not found then return jsonb_build_object('locked',false); end if;
  select coalesce(nullif(trim(profile.display_name),''),profile.email,saved.locked_by::text) into actor_label from public.user_profiles profile where profile.id=saved.locked_by;
  return jsonb_build_object('locked',saved.locked,'locked_by',saved.locked_by,'locked_by_label',actor_label,'locked_at',saved.locked_at,'updated_at',saved.updated_at,'snapshot_hash',saved.snapshot_hash,'fixture_count',saved.fixture_count);
end; $$;

drop function if exists public.publish_coach_hub_matchweek_messages(uuid,jsonb);
create function public.publish_coach_hub_matchweek_messages(
  target_club_id uuid, messages jsonb, target_day_scope text default null,
  target_matchday_date text default null, target_snapshot_hash text default null
) returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare actor_id uuid:=auth.uid(); item jsonb; team_value text; identity_value text; inserted_id uuid; published_count integer:=0; reused_count integer:=0; approval public.matchday_locks%rowtype;
begin
  if actor_id is null or not public.can_publish_club_matchweek(target_club_id) then raise exception 'Matchweek publisher access required' using errcode='42501'; end if;
  if nullif(trim(coalesce(target_day_scope,'')),'') is not null then
    select * into approval from public.matchday_locks lock_state where lock_state.club_id=target_club_id and lock_state.day_scope=left(lower(trim(target_day_scope)),40) and lock_state.matchday_date=left(trim(coalesce(target_matchday_date,'')),80);
    if not found or not approval.locked then raise exception 'This matchday is not locked for publication' using errcode='22023'; end if;
    if approval.snapshot_hash is distinct from left(trim(coalesce(target_snapshot_hash,'')),100) then raise exception 'The fixture plan changed after approval. Unlock, review and lock it again' using errcode='22023'; end if;
  end if;
  if jsonb_typeof(messages)<>'array' or jsonb_array_length(messages)=0 then raise exception 'Choose at least one Coach Hub message' using errcode='22023'; end if;
  if jsonb_array_length(messages)>100 then raise exception 'Coach Hub batches are limited to 100 messages' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(messages) loop
    team_value:=nullif(left(trim(coalesce(item->>'team_key','')),180),''); identity_value:=nullif(left(trim(coalesce(item->>'message_identity','')),500),'');
    if team_value is null or identity_value is null or nullif(trim(coalesce(item->>'body','')),'') is null then raise exception 'Every Coach Hub message requires a team, identity and body' using errcode='22023'; end if;
    if not exists(select 1 from public.coach_hub_team_assignments assignment where assignment.club_id=target_club_id and assignment.team_key=team_value and assignment.status='active') then raise exception 'No active Coach Hub assignment exists for team %',team_value using errcode='22023'; end if;
    inserted_id:=null;
    insert into public.coach_hub_messages(club_id,person_id,team_key,message_type,title,body,related_type,related_id,requires_acknowledgement,created_by,expires_at)
    values(target_club_id,null,team_value,'fixture_change',left(coalesce(nullif(trim(item->>'title'),''),'Matchweek update'),180),left(trim(item->>'body'),8000),'matchweek_communication',identity_value,coalesce((item->>'requires_acknowledgement')::boolean,true),actor_id,now()+interval '21 days')
    on conflict(club_id,team_key,related_type,related_id) where related_type='matchweek_communication' and team_key is not null do nothing returning id into inserted_id;
    if inserted_id is null then reused_count:=reused_count+1; else published_count:=published_count+1; end if;
  end loop;
  perform public.record_audit_event(target_club_id,'communications.coach_hub.published','coach_hub_message_batch',actor_id::text,jsonb_build_object('published',published_count,'reused',reused_count,'day_scope',target_day_scope,'matchday_date',target_matchday_date,'snapshot_hash',target_snapshot_hash));
  return jsonb_build_object('published',published_count,'reused',reused_count);
end; $$;

revoke all on function public.set_matchday_lock(uuid,text,text,boolean,text,integer) from public,anon;
revoke all on function public.publish_coach_hub_matchweek_messages(uuid,jsonb,text,text,text) from public,anon;
grant execute on function public.set_matchday_lock(uuid,text,text,boolean,text,integer) to authenticated;
grant execute on function public.publish_coach_hub_matchweek_messages(uuid,jsonb,text,text,text) to authenticated;
