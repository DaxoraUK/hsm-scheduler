-- Separate communications preparation from the authority to publish an approved matchweek.

create or replace function public.can_publish_club_matchweek(target_club_id uuid)
returns boolean language sql stable security definer set search_path = public set row_security = off as $$
  select public.has_club_role(target_club_id, array[
    'owner', 'admin', 'scheduler', 'fixture_officer', 'operations_officer'
  ]);
$$;

create or replace function public.publish_coach_hub_matchweek_messages(target_club_id uuid, messages jsonb)
returns jsonb language plpgsql security definer set search_path = '' set row_security = off as $$
declare
  actor_id uuid := auth.uid(); item jsonb; team_value text; identity_value text;
  inserted_id uuid; published_count integer := 0; reused_count integer := 0;
begin
  if actor_id is null or not public.can_publish_club_matchweek(target_club_id) then
    raise exception 'Matchweek publisher access required' using errcode = '42501';
  end if;
  if jsonb_typeof(messages) <> 'array' or jsonb_array_length(messages) = 0 then
    raise exception 'Choose at least one Coach Hub message' using errcode = '22023';
  end if;
  if jsonb_array_length(messages) > 100 then
    raise exception 'Coach Hub batches are limited to 100 messages' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(messages) loop
    team_value := nullif(left(trim(coalesce(item->>'team_key','')),180),'');
    identity_value := nullif(left(trim(coalesce(item->>'message_identity','')),500),'');
    if team_value is null or identity_value is null or nullif(trim(coalesce(item->>'body','')),'') is null then
      raise exception 'Every Coach Hub message requires a team, identity and body' using errcode = '22023';
    end if;
    if not exists (select 1 from public.coach_hub_team_assignments assignment where assignment.club_id=target_club_id and assignment.team_key=team_value and assignment.status='active') then
      raise exception 'No active Coach Hub assignment exists for team %', team_value using errcode = '22023';
    end if;
    inserted_id := null;
    insert into public.coach_hub_messages(club_id,person_id,team_key,message_type,title,body,related_type,related_id,requires_acknowledgement,created_by,expires_at)
    values(target_club_id,null,team_value,'fixture_change',left(coalesce(nullif(trim(item->>'title'),''),'Matchweek update'),180),left(trim(item->>'body'),8000),'matchweek_communication',identity_value,coalesce((item->>'requires_acknowledgement')::boolean,true),actor_id,now()+interval '21 days')
    on conflict(club_id,team_key,related_type,related_id) where related_type='matchweek_communication' and team_key is not null do nothing returning id into inserted_id;
    if inserted_id is null then reused_count := reused_count + 1; else published_count := published_count + 1; end if;
  end loop;
  perform public.record_audit_event(target_club_id,'communications.coach_hub.published','coach_hub_message_batch',actor_id::text,jsonb_build_object('published',published_count,'reused',reused_count));
  return jsonb_build_object('published',published_count,'reused',reused_count);
end; $$;

revoke all on function public.can_publish_club_matchweek(uuid) from public, anon;
grant execute on function public.can_publish_club_matchweek(uuid) to authenticated;
