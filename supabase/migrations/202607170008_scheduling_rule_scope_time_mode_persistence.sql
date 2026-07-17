-- Daxora Ground Control v3.10.8.1
-- Scheduling rule scope, half-hour time selection and season mode persistence.
begin;

alter table public.annual_planner_scheduling_policies
  add column if not exists allocation_mode text not null default 'assisted';

alter table public.annual_planner_scheduling_policies
  drop constraint if exists annual_planner_scheduling_policies_scope_type_check;
alter table public.annual_planner_scheduling_policies
  add constraint annual_planner_scheduling_policies_scope_type_check
  check (scope_type in ('club','team_type','age_group','team'));

alter table public.annual_planner_scheduling_policies
  drop constraint if exists annual_planner_scheduling_policies_allocation_mode_check;
alter table public.annual_planner_scheduling_policies
  add constraint annual_planner_scheduling_policies_allocation_mode_check
  check (allocation_mode in ('manual','assisted','automatic'));

update public.annual_planner_scheduling_policies
set allocation_mode='assisted'
where allocation_mode is null or allocation_mode not in ('manual','assisted','automatic');

drop function if exists private.annual_planner_training_policy(uuid,text,text);
drop function if exists private.annual_planner_training_policy(uuid,text,text,text);

create function private.annual_planner_training_policy(
  target_club_id uuid,
  season_value text,
  team_name_value text,
  team_key_value text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
set row_security=off
as $$
declare
  safe_season text:=case lower(trim(coalesce(season_value,'regular'))) when 'preseason' then 'preseason' when 'winter' then 'winter' else 'regular' end;
  age_key text;
  type_key text;
  team_key_safe text;
  result jsonb;
begin
  select 'u'||match_row[1] into age_key
  from regexp_matches(lower(coalesce(team_name_value,'')),'u\s*-?\s*([0-9]{1,2})') match_row
  limit 1;
  age_key:=coalesce(age_key,case when lower(coalesce(team_name_value,''))~'(first|reserve|senior|adult|women|veteran)' then 'adult' else 'youth' end);
  type_key:=case when lower(coalesce(team_name_value,''))~'(first|reserve|senior|adult|women|veteran)' then 'adult' else 'youth' end;
  team_key_safe:=trim(both '-' from regexp_replace(lower(coalesce(nullif(trim(team_key_value),''),team_name_value,'')),'[^a-z0-9]+','-','g'));

  select to_jsonb(policy) into result
  from public.annual_planner_scheduling_policies policy
  where policy.club_id=target_club_id and policy.season_phase=safe_season
    and (
      (policy.scope_type='team' and policy.scope_key=team_key_safe)
      or (policy.scope_type='age_group' and policy.scope_key=age_key)
      or (policy.scope_type='team_type' and policy.scope_key=type_key)
      or (policy.scope_type='club' and policy.scope_key='all')
    )
  order by case policy.scope_type when 'team' then 4 when 'age_group' then 3 when 'team_type' then 2 else 1 end desc
  limit 1;

  return coalesce(result,jsonb_build_object(
    'season_phase',safe_season,'scope_type','club','scope_key','all','allowed_days',jsonb_build_array(1,2,3,4,5),
    'weekend_allowed',false,'preferred_start_times',jsonb_build_array('18:00','18:30','19:00'),
    'earliest_start_time','17:00','latest_end_time','21:00','default_duration_minutes',90,'minimum_area_mode','any',
    'sessions_per_week',1,'permitted_pitch_ids','[]'::jsonb,'permitted_winter_site_ids','[]'::jsonb,
    'coach_edit_policy','approval','allocation_mode','assisted'
  ));
end;
$$;

create or replace function public.save_annual_planner_scheduling_policy(target_club_id uuid,policy_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security=off
as $$
declare
  actor_id uuid:=auth.uid();
  result public.annual_planner_scheduling_policies%rowtype;
  season_value text:=case lower(trim(coalesce(policy_data->>'season_phase','regular'))) when 'preseason' then 'preseason' when 'winter' then 'winter' else 'regular' end;
  scope_type_value text:=case lower(trim(coalesce(policy_data->>'scope_type','club'))) when 'team' then 'team' when 'age_group' then 'age_group' when 'team_type' then 'team_type' else 'club' end;
  scope_key_value text;
  allowed_days_value integer[];
  preferred_times_value time[];
  pitch_ids_value text[];
  site_ids_value uuid[];
  weekend_value boolean:=coalesce((policy_data->>'weekend_allowed')::boolean,false);
  earliest_time time:=coalesce(nullif(policy_data->>'earliest_start_time','')::time,'17:00'::time);
  latest_time time:=coalesce(nullif(policy_data->>'latest_end_time','')::time,'21:00'::time);
  duration_value integer:=greatest(30,least(240,coalesce((policy_data->>'default_duration_minutes')::integer,90)));
  allocation_mode_value text:=case lower(trim(coalesce(policy_data->>'allocation_mode','assisted'))) when 'manual' then 'manual' when 'automatic' then 'automatic' else 'assisted' end;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then raise exception 'Club owner or administrator access required' using errcode='42501'; end if;
  scope_key_value:=case when scope_type_value='club' then 'all' else lower(trim(coalesce(policy_data->>'scope_key',''))) end;
  if scope_type_value<>'club' and scope_key_value='' then raise exception 'Rule scope is required' using errcode='22023'; end if;
  if latest_time<=earliest_time then raise exception 'Latest finish must be after earliest start' using errcode='22023'; end if;

  allowed_days_value:=coalesce(array(select distinct value::integer from jsonb_array_elements_text(coalesce(policy_data->'allowed_days','[]'::jsonb)) row_value(value) where value::integer between 0 and 6 order by value::integer),array[1,2,3,4,5]);
  if not weekend_value then allowed_days_value:=array(select day from unnest(allowed_days_value) day where day not in (0,6)); end if;
  if cardinality(allowed_days_value)=0 then raise exception 'At least one training day must be permitted' using errcode='22023'; end if;

  preferred_times_value:=coalesce(array(select value::time from jsonb_array_elements_text(coalesce(policy_data->'preferred_start_times','[]'::jsonb)) row_value(value)),'{}'::time[]);
  if cardinality(preferred_times_value)=0 then raise exception 'Choose at least one preferred start time' using errcode='22023'; end if;
  if exists(
    select 1 from unnest(preferred_times_value) selected_time
    where extract(minute from selected_time)::integer % 30<>0
       or extract(second from selected_time)<>0
       or selected_time<earliest_time
       or selected_time + make_interval(mins=>duration_value)>latest_time
  ) then raise exception 'Preferred times must use 30-minute intervals and finish inside the permitted window' using errcode='22023'; end if;

  pitch_ids_value:=coalesce(array(select trim(value) from jsonb_array_elements_text(coalesce(policy_data->'permitted_pitch_ids','[]'::jsonb)) row_value(value) where trim(value)<>''),'{}'::text[]);
  site_ids_value:=coalesce(array(select value::uuid from jsonb_array_elements_text(coalesce(policy_data->'permitted_winter_site_ids','[]'::jsonb)) row_value(value) where value~'^[0-9a-fA-F-]{36}$'),'{}'::uuid[]);

  insert into public.annual_planner_scheduling_policies(
    club_id,season_phase,scope_type,scope_key,allowed_days,weekend_allowed,preferred_start_times,earliest_start_time,latest_end_time,
    default_duration_minutes,minimum_area_mode,sessions_per_week,permitted_pitch_ids,permitted_winter_site_ids,coach_edit_policy,allocation_mode,notes,created_by,updated_by
  ) values (
    target_club_id,season_value,scope_type_value,scope_key_value,allowed_days_value,weekend_value,preferred_times_value,
    earliest_time,latest_time,duration_value,
    case lower(trim(coalesce(policy_data->>'minimum_area_mode','any'))) when 'named_area' then 'named_area' when 'full_pitch' then 'full_pitch' else 'any' end,
    greatest(1,least(7,coalesce((policy_data->>'sessions_per_week')::integer,1))),pitch_ids_value,site_ids_value,
    case lower(trim(coalesce(policy_data->>'coach_edit_policy','approval'))) when 'immediate' then 'immediate' when 'club_only' then 'club_only' else 'approval' end,
    allocation_mode_value,nullif(trim(policy_data->>'notes'),''),actor_id,actor_id
  )
  on conflict (club_id,season_phase,scope_type,scope_key) do update set
    allowed_days=excluded.allowed_days,weekend_allowed=excluded.weekend_allowed,preferred_start_times=excluded.preferred_start_times,
    earliest_start_time=excluded.earliest_start_time,latest_end_time=excluded.latest_end_time,default_duration_minutes=excluded.default_duration_minutes,
    minimum_area_mode=excluded.minimum_area_mode,sessions_per_week=excluded.sessions_per_week,permitted_pitch_ids=excluded.permitted_pitch_ids,
    permitted_winter_site_ids=excluded.permitted_winter_site_ids,coach_edit_policy=excluded.coach_edit_policy,allocation_mode=excluded.allocation_mode,
    notes=excluded.notes,updated_by=actor_id,updated_at=now()
  returning * into result;

  perform public.record_audit_event(target_club_id,'annual_planner.scheduling_policy.saved','annual_planner_scheduling_policy',result.id::text,
    jsonb_build_object('season_phase',season_value,'scope_type',scope_type_value,'scope_key',scope_key_value,'allocation_mode',allocation_mode_value));
  return to_jsonb(result);
end;
$$;

create or replace function public.submit_my_coach_training_preference(target_club_id uuid,preference_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security=off
as $$
declare
  actor_id uuid:=auth.uid();
  coach_person_id uuid;
  assignment_row public.coach_hub_team_assignments%rowtype;
  team_key_value text:=trim(coalesce(preference_data->>'team_key',''));
  season_value text:=case lower(trim(coalesce(preference_data->>'season_phase','regular'))) when 'preseason' then 'preseason' when 'winter' then 'winter' else 'regular' end;
  policy jsonb;
  preferred_days_value integer[];
  unavailable_days_value integer[];
  preferred_times_value time[];
  pitch_ids_value text[];
  site_ids_value uuid[];
  proposed jsonb;
  proposal_row public.annual_planner_coach_preference_proposals%rowtype;
  edit_policy text;
  earliest_time time;
  latest_time time;
  duration_value integer;
  allowed_days_value integer[];
  permitted_pitch_ids_value text[];
  permitted_site_ids_value uuid[];
begin
  if actor_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select person.id into coach_person_id from public.coach_hub_people person where person.club_id=target_club_id and person.user_id=actor_id and person.status='active' limit 1;
  if coach_person_id is null then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  select assignment.* into assignment_row from public.coach_hub_team_assignments assignment where assignment.club_id=target_club_id and assignment.person_id=coach_person_id and assignment.team_key=team_key_value and assignment.status='active' order by assignment.is_primary desc limit 1;
  if assignment_row.id is null then raise exception 'This coach is not assigned to the selected team' using errcode='42501'; end if;

  policy:=private.annual_planner_training_policy(target_club_id,season_value,assignment_row.team_name,assignment_row.team_key);
  edit_policy:=coalesce(policy->>'coach_edit_policy','approval');
  if edit_policy='club_only' then raise exception 'The club manages training preferences for this team' using errcode='42501'; end if;
  allowed_days_value:=coalesce(array(select value::integer from jsonb_array_elements_text(coalesce(policy->'allowed_days','[]'::jsonb)) row_value(value)),array[1,2,3,4,5]);
  preferred_days_value:=coalesce(array(select distinct value::integer from jsonb_array_elements_text(coalesce(preference_data->'preferred_days','[]'::jsonb)) row_value(value) where value::integer between 0 and 6 order by value::integer),'{}'::integer[]);
  unavailable_days_value:=coalesce(array(select distinct value::integer from jsonb_array_elements_text(coalesce(preference_data->'unavailable_days','[]'::jsonb)) row_value(value) where value::integer between 0 and 6 order by value::integer),'{}'::integer[]);
  if not preferred_days_value <@ allowed_days_value or not unavailable_days_value <@ allowed_days_value then raise exception 'A selected day is blocked by the club master rules' using errcode='22023'; end if;
  if not coalesce((policy->>'weekend_allowed')::boolean,false) and (preferred_days_value && array[0,6]) then raise exception 'Weekend training is disabled by the club' using errcode='22023'; end if;

  duration_value:=greatest(30,least(240,coalesce((preference_data->>'required_duration_minutes')::integer,coalesce((policy->>'default_duration_minutes')::integer,90))));
  preferred_times_value:=coalesce(array(select value::time from jsonb_array_elements_text(coalesce(preference_data->'preferred_start_times','[]'::jsonb)) row_value(value)),'{}'::time[]);
  if cardinality(preferred_times_value)=0 then raise exception 'Choose at least one preferred start time' using errcode='22023'; end if;
  earliest_time:=coalesce((policy->>'earliest_start_time')::time,'17:00'::time);
  latest_time:=coalesce((policy->>'latest_end_time')::time,'21:00'::time);
  if exists(
    select 1 from unnest(preferred_times_value) selected_time
    where extract(minute from selected_time)::integer % 30<>0
       or extract(second from selected_time)<>0
       or selected_time<earliest_time
       or selected_time + make_interval(mins=>duration_value)>latest_time
  ) then raise exception 'A preferred time is outside the permitted 30-minute training choices' using errcode='22023'; end if;

  pitch_ids_value:=coalesce(array(select trim(value) from jsonb_array_elements_text(coalesce(preference_data->'preferred_pitch_ids','[]'::jsonb)) row_value(value) where trim(value)<>''),'{}'::text[]);
  site_ids_value:=coalesce(array(select value::uuid from jsonb_array_elements_text(coalesce(preference_data->'preferred_winter_site_ids','[]'::jsonb)) row_value(value) where value~'^[0-9a-fA-F-]{36}$'),'{}'::uuid[]);
  permitted_pitch_ids_value:=coalesce(array(select value from jsonb_array_elements_text(coalesce(policy->'permitted_pitch_ids','[]'::jsonb)) row_value(value)),'{}'::text[]);
  permitted_site_ids_value:=coalesce(array(select value::uuid from jsonb_array_elements_text(coalesce(policy->'permitted_winter_site_ids','[]'::jsonb)) row_value(value) where value~'^[0-9a-fA-F-]{36}$'),'{}'::uuid[]);
  if cardinality(permitted_pitch_ids_value)>0 and not pitch_ids_value <@ permitted_pitch_ids_value then raise exception 'A selected pitch is not permitted by the club' using errcode='22023'; end if;
  if cardinality(permitted_site_ids_value)>0 and not site_ids_value <@ permitted_site_ids_value then raise exception 'A selected winter site is not permitted by the club' using errcode='22023'; end if;

  proposed:=jsonb_build_object(
    'team_key',team_key_value,'team_name',assignment_row.team_name,'season_phase',season_value,
    'preferred_days',to_jsonb(preferred_days_value),'preferred_start_times',to_jsonb(preferred_times_value),'unavailable_days',to_jsonb(unavailable_days_value),
    'preferred_pitch_ids',to_jsonb(pitch_ids_value),'preferred_winter_site_ids',to_jsonb(site_ids_value),
    'required_duration_minutes',duration_value,
    'minimum_area_mode',case lower(trim(coalesce(preference_data->>'minimum_area_mode','any'))) when 'named_area' then 'named_area' when 'full_pitch' then 'full_pitch' else 'any' end,
    'notes',nullif(trim(preference_data->>'notes'),''),'override_fields',coalesce(preference_data->'override_fields','[]'::jsonb)
  );
  update public.annual_planner_coach_preference_proposals proposal set status='superseded',updated_at=now() where proposal.club_id=target_club_id and proposal.person_id=coach_person_id and proposal.team_key=team_key_value and proposal.season_phase=season_value and proposal.status='pending';
  insert into public.annual_planner_coach_preference_proposals(club_id,person_id,assignment_id,team_key,team_name,season_phase,status,proposed_preference,policy_snapshot,created_by)
  values(target_club_id,coach_person_id,assignment_row.id,team_key_value,assignment_row.team_name,season_value,case when edit_policy='immediate' then 'approved' else 'pending' end,proposed,policy,actor_id)
  returning * into proposal_row;
  if edit_policy='immediate' then
    insert into public.annual_planner_team_preferences(
      club_id,team_key,team_name,season_phase,allocation_mode,preferred_days,preferred_start_times,unavailable_days,preferred_pitch_ids,preferred_winter_site_ids,
      required_duration_minutes,minimum_area_mode,priority_weight,keep_current_allocation,manual_only,notes,override_fields,preference_source,approved_proposal_id,created_by,updated_by
    ) values (
      target_club_id,team_key_value,assignment_row.team_name,season_value,'inherit',preferred_days_value,preferred_times_value,unavailable_days_value,pitch_ids_value,site_ids_value,
      duration_value,proposed->>'minimum_area_mode',50,false,false,proposed->>'notes',
      coalesce(array(select value from jsonb_array_elements_text(coalesce(proposed->'override_fields','[]'::jsonb)) row_value(value)),'{}'::text[]),'coach',proposal_row.id,actor_id,actor_id
    ) on conflict (club_id,team_key,season_phase) do update set
      preferred_days=excluded.preferred_days,preferred_start_times=excluded.preferred_start_times,unavailable_days=excluded.unavailable_days,
      preferred_pitch_ids=excluded.preferred_pitch_ids,preferred_winter_site_ids=excluded.preferred_winter_site_ids,required_duration_minutes=excluded.required_duration_minutes,
      minimum_area_mode=excluded.minimum_area_mode,notes=excluded.notes,override_fields=excluded.override_fields,preference_source='coach',approved_proposal_id=proposal_row.id,
      updated_by=actor_id,updated_at=now();
  end if;
  perform private.record_coach_hub_audit_event(target_club_id,'coach_hub.training_preferences.submitted','annual_planner_coach_preference_proposal',proposal_row.id::text,jsonb_build_object('team_key',team_key_value,'season_phase',season_value,'status',proposal_row.status));
  return jsonb_build_object('id',proposal_row.id,'status',proposal_row.status,'policy',policy);
end;
$$;

revoke all on function private.annual_planner_training_policy(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.save_annual_planner_scheduling_policy(uuid,jsonb), public.submit_my_coach_training_preference(uuid,jsonb) from public,anon;
grant execute on function public.save_annual_planner_scheduling_policy(uuid,jsonb), public.submit_my_coach_training_preference(uuid,jsonb) to authenticated;

comment on column public.annual_planner_scheduling_policies.allocation_mode is 'Saved Manual, Assisted or Automatic Draft mode for the club default in each season.';
comment on table public.annual_planner_scheduling_policies is 'Master training rules inherited by season, team type, age group and specific team. Preferred starts use 30-minute intervals.';

notify pgrst,'reload schema';
commit;
