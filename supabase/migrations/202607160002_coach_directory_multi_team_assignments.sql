-- Ground Control v3.10.2.2
-- Coach directory, multi-team roles and team-contact sync repair.

create or replace function private.sync_team_contact_to_coach_hub()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  resolved_person_id uuid;
  identity_value text;
  role_value text;
  slot_value text;
  name_value text;
  email_value text;
  phone_value text;
  enabled_value boolean;
begin
  if tg_op = 'DELETE' then
    update public.coach_hub_team_assignments assignment
    set status = 'inactive', updated_at = now()
    where assignment.club_id = old.club_id
      and assignment.team_key = old.team_key
      and assignment.source_slot in ('coach','assistant');
    return old;
  end if;

  if tg_op = 'UPDATE' and old.team_key is distinct from new.team_key then
    update public.coach_hub_team_assignments assignment
    set status = 'inactive', updated_at = now()
    where assignment.club_id = old.club_id
      and assignment.team_key = old.team_key
      and assignment.source_slot in ('coach','assistant');
  end if;

  for slot_value, role_value, name_value, email_value, phone_value, enabled_value in
    select 'coach', 'manager', new.coach_name, lower(trim(new.coach_email)), new.coach_phone, true
    union all
    select 'assistant', 'assistant', new.assistant_name, lower(trim(new.assistant_email)), new.assistant_phone, new.assistant_enabled
  loop
    if not enabled_value or (trim(coalesce(name_value,'')) = '' and trim(coalesce(email_value,'')) = '' and trim(coalesce(phone_value,'')) = '') then
      update public.coach_hub_team_assignments assignment
      set status = 'inactive', updated_at = now()
      where assignment.club_id = new.club_id
        and assignment.team_key = new.team_key
        and assignment.source_slot = slot_value;
      continue;
    end if;

    identity_value := private.coach_identity_key(email_value, name_value, new.team_key, slot_value);

    insert into public.coach_hub_people (
      club_id, identity_key, display_name, email, mobile, preferred_channel,
      privacy_notice_provided_at, last_verified_at, status
    ) values (
      new.club_id,
      identity_value,
      trim(coalesce(name_value,'')),
      lower(trim(coalesce(email_value,''))),
      trim(coalesce(phone_value,'')),
      case when new.preferred_channel in ('email','sms','whatsapp') then new.preferred_channel else 'email' end,
      new.privacy_notice_provided_at,
      new.last_verified_at,
      'active'
    )
    on conflict (club_id, identity_key) do update set
      display_name = excluded.display_name,
      email = excluded.email,
      mobile = excluded.mobile,
      preferred_channel = excluded.preferred_channel,
      privacy_notice_provided_at = coalesce(excluded.privacy_notice_provided_at, public.coach_hub_people.privacy_notice_provided_at),
      last_verified_at = coalesce(excluded.last_verified_at, public.coach_hub_people.last_verified_at),
      status = 'active',
      updated_at = now()
    returning id into resolved_person_id;

    update public.coach_hub_team_assignments assignment
    set status = 'inactive', updated_at = now()
    where assignment.club_id = new.club_id
      and assignment.team_key = new.team_key
      and assignment.source_slot = slot_value
      and assignment.person_id <> resolved_person_id;

    insert into public.coach_hub_team_assignments (
      club_id, person_id, team_key, team_name, staff_role, source_slot, is_primary,
      can_request_training, can_request_friendlies, can_request_changes,
      can_view_team_contacts, can_view_costs, status
    ) values (
      new.club_id, resolved_person_id, new.team_key, new.team_name, role_value, slot_value, slot_value = 'coach',
      true, true, true, true, false, 'active'
    )
    on conflict (club_id, person_id, team_key, staff_role) do update set
      team_name = excluded.team_name,
      source_slot = excluded.source_slot,
      is_primary = excluded.is_primary,
      status = 'active',
      updated_at = now();
  end loop;

  return new;
end;
$$;

create or replace function public.upsert_coach_hub_person(target_club_id uuid, person_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  target_person_id uuid := nullif(person_data->>'id','')::uuid;
  existing public.coach_hub_people%rowtype;
  result public.coach_hub_people%rowtype;
  name_value text := left(trim(coalesce(person_data->>'display_name','')),160);
  email_value text := left(lower(trim(coalesce(person_data->>'email',''))),254);
  mobile_value text := left(trim(coalesce(person_data->>'mobile','')),40);
  channel_value text := lower(trim(coalesce(person_data->>'preferred_channel','email')));
  identity_value text;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode='42501';
  end if;
  if not private.club_has_entitlement(target_club_id,'annual_planner') then
    raise exception 'Coach Hub requires the Annual Planner module' using errcode='42501';
  end if;
  if name_value = '' then
    raise exception 'Coach name is required' using errcode='22023';
  end if;
  if email_value = '' and mobile_value = '' then
    raise exception 'Add an email address or mobile number' using errcode='22023';
  end if;
  if channel_value not in ('email','sms','whatsapp','in_app') then channel_value := 'email'; end if;

  if target_person_id is not null then
    select * into existing
    from public.coach_hub_people person
    where person.id=target_person_id and person.club_id=target_club_id
    for update;
    if existing.id is null then raise exception 'Coach contact not found' using errcode='P0002'; end if;

    if email_value <> '' and exists(
      select 1 from public.coach_hub_people person
      where person.club_id=target_club_id and person.id<>target_person_id
        and lower(person.email)=email_value and person.status<>'inactive'
    ) then
      raise exception 'Another coach already uses this email address' using errcode='23505';
    end if;

    update public.coach_hub_people
    set display_name=name_value,
        email=email_value,
        mobile=mobile_value,
        preferred_channel=channel_value,
        status='active',
        updated_at=now()
    where id=target_person_id
    returning * into result;
  else
    identity_value := case when email_value<>'' then 'email:'||email_value else 'manual:'||gen_random_uuid()::text end;
    insert into public.coach_hub_people(club_id,identity_key,display_name,email,mobile,preferred_channel,status)
    values(target_club_id,identity_value,name_value,email_value,mobile_value,channel_value,'active')
    on conflict (club_id,identity_key) do update set
      display_name=excluded.display_name,
      email=excluded.email,
      mobile=excluded.mobile,
      preferred_channel=excluded.preferred_channel,
      status='active',
      updated_at=now()
    returning * into result;
  end if;

  perform public.record_audit_event(
    target_club_id,
    case when target_person_id is null then 'coach_hub.person.created' else 'coach_hub.person.updated' end,
    'coach_hub_person',
    result.id::text,
    jsonb_build_object('email',result.email,'preferred_channel',result.preferred_channel)
  );

  return to_jsonb(result)-'identity_key';
end;
$$;

create or replace function public.save_coach_hub_team_assignment(target_club_id uuid, assignment_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  target_assignment_id uuid := nullif(assignment_data->>'id','')::uuid;
  target_person_id uuid := nullif(assignment_data->>'person_id','')::uuid;
  team_key_value text := left(trim(coalesce(assignment_data->>'team_key','')),160);
  team_name_value text := left(trim(coalesce(assignment_data->>'team_name','')),200);
  role_value text := lower(trim(coalesce(assignment_data->>'staff_role','coach')));
  primary_value boolean := coalesce(nullif(assignment_data->>'is_primary','')::boolean,false);
  result public.coach_hub_team_assignments%rowtype;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode='42501';
  end if;
  if not private.club_has_entitlement(target_club_id,'annual_planner') then
    raise exception 'Coach Hub requires the Annual Planner module' using errcode='42501';
  end if;
  if target_person_id is null or not exists(
    select 1 from public.coach_hub_people person
    where person.id=target_person_id and person.club_id=target_club_id and person.status='active'
  ) then raise exception 'Coach contact not found' using errcode='P0002'; end if;
  if team_key_value='' or team_name_value='' then raise exception 'Choose a team' using errcode='22023'; end if;
  if role_value not in ('manager','lead_coach','coach','assistant','team_secretary','welfare','emergency_contact') then
    raise exception 'Unsupported team role' using errcode='22023';
  end if;

  if primary_value then
    update public.coach_hub_team_assignments assignment
    set is_primary=false,updated_at=now()
    where assignment.club_id=target_club_id and assignment.team_key=team_key_value and assignment.status='active';
  end if;

  if target_assignment_id is not null then
    update public.coach_hub_team_assignments assignment
    set person_id=target_person_id,
        team_key=team_key_value,
        team_name=team_name_value,
        staff_role=role_value,
        source_slot='directory',
        is_primary=primary_value,
        can_request_training=coalesce(nullif(assignment_data->>'can_request_training','')::boolean,true),
        can_request_friendlies=coalesce(nullif(assignment_data->>'can_request_friendlies','')::boolean,true),
        can_request_changes=coalesce(nullif(assignment_data->>'can_request_changes','')::boolean,true),
        can_view_team_contacts=coalesce(nullif(assignment_data->>'can_view_team_contacts','')::boolean,true),
        can_view_costs=coalesce(nullif(assignment_data->>'can_view_costs','')::boolean,false),
        status='active',
        updated_at=now()
    where assignment.id=target_assignment_id and assignment.club_id=target_club_id
    returning * into result;
  else
    insert into public.coach_hub_team_assignments(
      club_id,person_id,team_key,team_name,staff_role,source_slot,is_primary,
      can_request_training,can_request_friendlies,can_request_changes,
      can_view_team_contacts,can_view_costs,status
    ) values(
      target_club_id,target_person_id,team_key_value,team_name_value,role_value,'directory',primary_value,
      coalesce(nullif(assignment_data->>'can_request_training','')::boolean,true),
      coalesce(nullif(assignment_data->>'can_request_friendlies','')::boolean,true),
      coalesce(nullif(assignment_data->>'can_request_changes','')::boolean,true),
      coalesce(nullif(assignment_data->>'can_view_team_contacts','')::boolean,true),
      coalesce(nullif(assignment_data->>'can_view_costs','')::boolean,false),'active'
    )
    on conflict (club_id,person_id,team_key,staff_role) do update set
      source_slot='directory',
      is_primary=excluded.is_primary,
      can_request_training=excluded.can_request_training,
      can_request_friendlies=excluded.can_request_friendlies,
      can_request_changes=excluded.can_request_changes,
      can_view_team_contacts=excluded.can_view_team_contacts,
      can_view_costs=excluded.can_view_costs,
      status='active',
      updated_at=now()
    returning * into result;
  end if;

  if result.id is null then raise exception 'Assignment could not be saved' using errcode='P0002'; end if;
  perform public.record_audit_event(target_club_id,'coach_hub.assignment.saved','coach_hub_team_assignment',result.id::text,jsonb_build_object('person_id',target_person_id,'team_key',team_key_value,'staff_role',role_value));
  return to_jsonb(result);
end;
$$;

create or replace function public.delete_coach_hub_team_assignment(target_club_id uuid, target_assignment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  assignment_row public.coach_hub_team_assignments%rowtype;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode='42501';
  end if;
  select * into assignment_row
  from public.coach_hub_team_assignments assignment
  where assignment.id=target_assignment_id and assignment.club_id=target_club_id
  for update;
  if assignment_row.id is null then return false; end if;

  update public.coach_hub_team_assignments
  set status='inactive',is_primary=false,updated_at=now()
  where id=target_assignment_id;

  perform public.record_audit_event(target_club_id,'coach_hub.assignment.removed','coach_hub_team_assignment',target_assignment_id::text,jsonb_build_object('person_id',assignment_row.person_id,'team_key',assignment_row.team_key,'staff_role',assignment_row.staff_role));
  return true;
end;
$$;

create or replace function public.list_team_contacts(target_club_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if auth.uid() is null or not public.can_operate_club(target_club_id) then
    raise exception 'Club operator access required' using errcode='42501';
  end if;

  return coalesce((
    with contact_rows as (
      select
        contact.club_id,
        contact.team_key,
        contact.team_name,
        contact.coach_name,
        contact.coach_phone,
        contact.coach_email,
        contact.preferred_channel,
        contact.assistant_name,
        contact.assistant_phone,
        contact.assistant_email,
        contact.assistant_enabled,
        contact.receive_matchday_messages,
        contact.privacy_notice_provided_at,
        contact.last_verified_at,
        contact.updated_at
      from public.team_contacts contact
      where contact.club_id=target_club_id

      union all

      select distinct on (assignment.team_key)
        assignment.club_id,
        assignment.team_key,
        assignment.team_name,
        ''::text,
        ''::text,
        ''::text,
        'email'::text,
        ''::text,
        ''::text,
        ''::text,
        false,
        true,
        null::timestamptz,
        null::timestamptz,
        max(assignment.updated_at) over (partition by assignment.team_key)
      from public.coach_hub_team_assignments assignment
      where assignment.club_id=target_club_id
        and assignment.status='active'
        and not exists(
          select 1 from public.team_contacts existing
          where existing.club_id=assignment.club_id and existing.team_key=assignment.team_key
        )
      order by assignment.team_key,assignment.updated_at desc
    )
    select jsonb_agg(jsonb_build_object(
      'team_key',contact.team_key,
      'team_name',contact.team_name,
      'coach_name',contact.coach_name,
      'coach_phone',contact.coach_phone,
      'coach_email',contact.coach_email,
      'preferred_channel',contact.preferred_channel,
      'assistant_name',contact.assistant_name,
      'assistant_phone',contact.assistant_phone,
      'assistant_email',contact.assistant_email,
      'assistant_enabled',contact.assistant_enabled,
      'receive_matchday_messages',contact.receive_matchday_messages,
      'privacy_notice_provided_at',contact.privacy_notice_provided_at,
      'last_verified_at',contact.last_verified_at,
      'updated_at',contact.updated_at,
      'additional_contacts',coalesce((
        select jsonb_agg(jsonb_build_object(
          'person_id',person.id,
          'assignment_id',assignment.id,
          'name',person.display_name,
          'email',person.email,
          'mobile',person.mobile,
          'preferred_channel',person.preferred_channel,
          'staff_role',assignment.staff_role,
          'is_primary',assignment.is_primary
        ) order by assignment.is_primary desc,assignment.staff_role,person.display_name)
        from public.coach_hub_team_assignments assignment
        join public.coach_hub_people person on person.id=assignment.person_id and person.club_id=assignment.club_id
        where assignment.club_id=contact.club_id
          and assignment.team_key=contact.team_key
          and assignment.status='active'
          and person.status='active'
          and assignment.source_slot='directory'
      ),'[]'::jsonb)
    ) order by contact.team_name,contact.team_key)
    from contact_rows contact
  ),'[]'::jsonb);
end;
$$;

revoke all on function public.upsert_coach_hub_person(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.save_coach_hub_team_assignment(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.delete_coach_hub_team_assignment(uuid,uuid) from public,anon,authenticated;
grant execute on function public.upsert_coach_hub_person(uuid,jsonb) to authenticated;
grant execute on function public.save_coach_hub_team_assignment(uuid,jsonb) to authenticated;
grant execute on function public.delete_coach_hub_team_assignment(uuid,uuid) to authenticated;
