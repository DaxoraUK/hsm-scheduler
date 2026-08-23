-- Ground Control v3.10.59: governed matchweek communications into Coach Hub.

create or replace function public.can_communicate_club(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select public.has_club_role(target_club_id, array[
    'owner', 'admin', 'club_secretary', 'scheduler', 'fixture_officer',
    'operations_officer', 'communications_officer'
  ]);
$$;

create unique index if not exists coach_hub_matchweek_message_identity_idx
on public.coach_hub_messages(club_id, team_key, related_type, related_id)
where related_type = 'matchweek_communication' and team_key is not null;

create or replace function public.publish_coach_hub_matchweek_messages(target_club_id uuid, messages jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  item jsonb;
  team_value text;
  identity_value text;
  inserted_id uuid;
  published_count integer := 0;
  reused_count integer := 0;
begin
  if actor_id is null or not public.can_communicate_club(target_club_id) then
    raise exception 'Club communications access required' using errcode = '42501';
  end if;
  if jsonb_typeof(messages) <> 'array' or jsonb_array_length(messages) = 0 then
    raise exception 'Choose at least one Coach Hub message' using errcode = '22023';
  end if;
  if jsonb_array_length(messages) > 100 then
    raise exception 'Coach Hub batches are limited to 100 messages' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(messages)
  loop
    team_value := nullif(left(trim(coalesce(item->>'team_key', '')), 180), '');
    identity_value := nullif(left(trim(coalesce(item->>'message_identity', '')), 500), '');
    if team_value is null or identity_value is null or nullif(trim(coalesce(item->>'body', '')), '') is null then
      raise exception 'Every Coach Hub message requires a team, identity and body' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.coach_hub_team_assignments assignment
      where assignment.club_id = target_club_id
        and assignment.team_key = team_value
        and assignment.status = 'active'
    ) then
      raise exception 'No active Coach Hub assignment exists for team %', team_value using errcode = '22023';
    end if;

    inserted_id := null;
    insert into public.coach_hub_messages(
      club_id, person_id, team_key, message_type, title, body, related_type,
      related_id, requires_acknowledgement, created_by, expires_at
    ) values (
      target_club_id, null, team_value, 'fixture_change',
      left(coalesce(nullif(trim(item->>'title'), ''), 'Matchweek update'), 180),
      left(trim(item->>'body'), 8000), 'matchweek_communication', identity_value,
      coalesce((item->>'requires_acknowledgement')::boolean, true), actor_id,
      now() + interval '21 days'
    )
    on conflict (club_id, team_key, related_type, related_id)
      where related_type = 'matchweek_communication' and team_key is not null
    do nothing
    returning id into inserted_id;

    if inserted_id is null then reused_count := reused_count + 1;
    else published_count := published_count + 1;
    end if;
  end loop;

  perform public.record_audit_event(
    target_club_id, 'communications.coach_hub.published', 'coach_hub_message_batch',
    actor_id::text, jsonb_build_object('published', published_count, 'reused', reused_count)
  );
  return jsonb_build_object('published', published_count, 'reused', reused_count);
end;
$$;

create or replace function public.list_coach_hub_matchweek_delivery_status(target_club_id uuid, result_limit integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if auth.uid() is null or not public.can_communicate_club(target_club_id) then
    raise exception 'Club communications access required' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(status_row) order by status_row.created_at desc)
    from (
      select message.id, message.team_key, message.title, message.related_id, message.created_at,
        count(distinct person.user_id) filter (where person.user_id is not null) as expected_recipients,
        count(distinct receipt.user_id) filter (where receipt.read_at is not null) as read_count,
        count(distinct receipt.user_id) filter (where receipt.acknowledged_at is not null) as acknowledged_count
      from public.coach_hub_messages message
      left join public.coach_hub_team_assignments assignment
        on assignment.club_id = message.club_id and assignment.team_key = message.team_key and assignment.status = 'active'
      left join public.coach_hub_people person on person.id = assignment.person_id and person.status = 'active'
      left join public.coach_hub_message_receipts receipt on receipt.message_id = message.id
      where message.club_id = target_club_id and message.related_type = 'matchweek_communication'
      group by message.id
      order by message.created_at desc
      limit greatest(1, least(coalesce(result_limit, 30), 100))
    ) status_row
  ), '[]'::jsonb);
end;
$$;

create or replace function public.mark_coach_hub_message(target_club_id uuid, target_message_id uuid, acknowledge boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  coach_person_id uuid := private.current_coach_person_id(target_club_id);
  message_row public.coach_hub_messages%rowtype;
begin
  if coach_person_id is null then raise exception 'Coach Hub access denied' using errcode = '42501'; end if;
  select message.* into message_row
  from public.coach_hub_messages message
  where message.id = target_message_id
    and message.club_id = target_club_id
    and (
      message.person_id = coach_person_id
      or (
        message.person_id is null
        and (
          message.team_key is null
          or exists (
            select 1 from public.coach_hub_team_assignments assignment
            where assignment.club_id = target_club_id
              and assignment.person_id = coach_person_id
              and assignment.team_key = message.team_key
              and assignment.status = 'active'
          )
        )
      )
    );
  if message_row.id is null then raise exception 'Message not found' using errcode = 'P0002'; end if;
  insert into public.coach_hub_message_receipts(message_id, user_id, read_at, acknowledged_at)
  values(message_row.id, auth.uid(), now(), case when acknowledge then now() else null end)
  on conflict(message_id, user_id) do update set
    read_at = coalesce(public.coach_hub_message_receipts.read_at, now()),
    acknowledged_at = case when acknowledge then now() else public.coach_hub_message_receipts.acknowledged_at end,
    updated_at = now();
  return jsonb_build_object('message_id', message_row.id, 'read_at', now(), 'acknowledged', acknowledge);
end;
$$;

revoke all on function public.can_communicate_club(uuid) from public, anon;
revoke all on function public.publish_coach_hub_matchweek_messages(uuid, jsonb) from public, anon;
revoke all on function public.list_coach_hub_matchweek_delivery_status(uuid, integer) from public, anon;
revoke all on function public.mark_coach_hub_message(uuid, uuid, boolean) from public, anon;
grant execute on function public.can_communicate_club(uuid) to authenticated;
grant execute on function public.publish_coach_hub_matchweek_messages(uuid, jsonb) to authenticated;
grant execute on function public.list_coach_hub_matchweek_delivery_status(uuid, integer) to authenticated;
grant execute on function public.mark_coach_hub_message(uuid, uuid, boolean) to authenticated;
