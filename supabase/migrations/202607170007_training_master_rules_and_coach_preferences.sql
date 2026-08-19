-- Daxora Ground Control v3.10.8
-- Club master scheduling rules, inherited defaults and coach-managed team preferences.
begin;

create table if not exists public.annual_planner_scheduling_policies (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  season_phase text not null default 'regular' check (season_phase in ('preseason','regular','winter')),
  scope_type text not null default 'club' check (scope_type in ('club','team_type','age_group')),
  scope_key text not null default 'all',
  allowed_days integer[] not null default array[1,2,3,4,5],
  weekend_allowed boolean not null default false,
  preferred_start_times time[] not null default array['17:00'::time,'18:00'::time,'19:00'::time,'20:00'::time],
  earliest_start_time time not null default '17:00',
  latest_end_time time not null default '21:00',
  default_duration_minutes integer not null default 90 check (default_duration_minutes between 30 and 240),
  minimum_area_mode text not null default 'any' check (minimum_area_mode in ('any','named_area','full_pitch')),
  sessions_per_week integer not null default 1 check (sessions_per_week between 1 and 7),
  permitted_pitch_ids text[] not null default '{}',
  permitted_winter_site_ids uuid[] not null default '{}',
  coach_edit_policy text not null default 'approval' check (coach_edit_policy in ('approval','immediate','club_only')),
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id,season_phase,scope_type,scope_key),
  check (allowed_days <@ array[0,1,2,3,4,5,6]),
  check (latest_end_time > earliest_start_time),
  check ((weekend_allowed and cardinality(allowed_days)>0) or (not weekend_allowed and not (allowed_days && array[0,6]) and cardinality(allowed_days)>0)),
  check ((scope_type='club' and scope_key='all') or (scope_type<>'club' and length(trim(scope_key))>0))
);

alter table public.annual_planner_team_preferences
  add column if not exists override_fields text[] not null default '{}',
  add column if not exists preference_source text not null default 'club' check (preference_source in ('club','coach','import')),
  add column if not exists approved_proposal_id uuid;

create table if not exists public.annual_planner_coach_preference_proposals (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  person_id uuid not null references public.coach_hub_people(id) on delete cascade,
  assignment_id uuid not null references public.coach_hub_team_assignments(id) on delete cascade,
  team_key text not null,
  team_name text not null,
  season_phase text not null default 'regular' check (season_phase in ('preseason','regular','winter')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','superseded')),
  proposed_preference jsonb not null default '{}'::jsonb,
  policy_snapshot jsonb not null default '{}'::jsonb,
  decision_note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.annual_planner_team_preferences
  drop constraint if exists annual_planner_team_preferences_approved_proposal_id_fkey;
alter table public.annual_planner_team_preferences
  add constraint annual_planner_team_preferences_approved_proposal_id_fkey
  foreign key (approved_proposal_id) references public.annual_planner_coach_preference_proposals(id) on delete set null;

create index if not exists annual_planner_scheduling_policies_lookup_idx on public.annual_planner_scheduling_policies(club_id,season_phase,scope_type,scope_key);
create index if not exists annual_planner_coach_preference_proposals_queue_idx on public.annual_planner_coach_preference_proposals(club_id,status,season_phase,created_at desc);
create unique index if not exists annual_planner_coach_preference_one_pending_idx on public.annual_planner_coach_preference_proposals(club_id,person_id,team_key,season_phase) where status='pending';

alter table public.annual_planner_scheduling_policies enable row level security;
alter table public.annual_planner_scheduling_policies force row level security;
alter table public.annual_planner_coach_preference_proposals enable row level security;
alter table public.annual_planner_coach_preference_proposals force row level security;

revoke all on table public.annual_planner_scheduling_policies, public.annual_planner_coach_preference_proposals from public,anon,authenticated;

drop policy if exists annual_planner_scheduling_policies_read on public.annual_planner_scheduling_policies;
create policy annual_planner_scheduling_policies_read on public.annual_planner_scheduling_policies for select to authenticated using (public.is_club_member(club_id) or public.can_access_coach_hub(club_id));
drop policy if exists annual_planner_scheduling_policies_write on public.annual_planner_scheduling_policies;
create policy annual_planner_scheduling_policies_write on public.annual_planner_scheduling_policies for all to authenticated using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));
drop policy if exists annual_planner_coach_preference_proposals_admin_read on public.annual_planner_coach_preference_proposals;
create policy annual_planner_coach_preference_proposals_admin_read on public.annual_planner_coach_preference_proposals for select to authenticated using (public.can_manage_club(club_id) or created_by=auth.uid());
drop policy if exists annual_planner_coach_preference_proposals_admin_write on public.annual_planner_coach_preference_proposals;
create policy annual_planner_coach_preference_proposals_admin_write on public.annual_planner_coach_preference_proposals for all to authenticated using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

insert into public.annual_planner_scheduling_policies(
  club_id,season_phase,scope_type,scope_key,allowed_days,weekend_allowed,preferred_start_times,earliest_start_time,latest_end_time,
  default_duration_minutes,minimum_area_mode,sessions_per_week,coach_edit_policy,created_by,updated_by
)
select club.id,phase.value,'club','all',array[1,2,3,4,5],false,array['17:00'::time,'18:00'::time,'19:00'::time,'20:00'::time],
       '17:00'::time,'21:00'::time,case when phase.value='winter' then 60 else 90 end,'any',1,'approval',
       coalesce((select membership.user_id from public.club_memberships membership where membership.club_id=club.id and membership.status='active' order by case membership.role when 'owner' then 0 else 1 end, membership.created_at limit 1),(select id from auth.users order by created_at limit 1)),
       coalesce((select membership.user_id from public.club_memberships membership where membership.club_id=club.id and membership.status='active' order by case membership.role when 'owner' then 0 else 1 end, membership.created_at limit 1),(select id from auth.users order by created_at limit 1))
from public.clubs club
cross join (values ('preseason'),('regular'),('winter')) phase(value)
where exists(select 1 from auth.users)
on conflict (club_id,season_phase,scope_type,scope_key) do nothing;

create or replace function private.annual_planner_training_policy(
  target_club_id uuid,
  season_value text,
  team_name_value text
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
  result jsonb;
begin
  select 'u'||match_row[1] into age_key
  from regexp_matches(lower(coalesce(team_name_value,'')),'u\s*-?\s*([0-9]{1,2})') match_row
  limit 1;
  age_key:=coalesce(age_key,case when lower(coalesce(team_name_value,''))~'(first|reserve|senior|adult|women|veteran)' then 'adult' else 'youth' end);
  type_key:=case when lower(coalesce(team_name_value,''))~'(first|reserve|senior|adult|women|veteran)' then 'adult' else 'youth' end;
  select to_jsonb(policy) into result
  from public.annual_planner_scheduling_policies policy
  where policy.club_id=target_club_id and policy.season_phase=safe_season
    and (
      (policy.scope_type='age_group' and policy.scope_key=age_key)
      or (policy.scope_type='team_type' and policy.scope_key=type_key)
      or (policy.scope_type='club' and policy.scope_key='all')
    )
  order by case policy.scope_type when 'age_group' then 3 when 'team_type' then 2 else 1 end desc
  limit 1;
  return coalesce(result,jsonb_build_object(
    'season_phase',safe_season,'scope_type','club','scope_key','all','allowed_days',jsonb_build_array(1,2,3,4,5),
    'weekend_allowed',false,'preferred_start_times',jsonb_build_array('17:00','18:00','19:00','20:00'),
    'earliest_start_time','17:00','latest_end_time','21:00','default_duration_minutes',90,'minimum_area_mode','any',
    'sessions_per_week',1,'permitted_pitch_ids','[]'::jsonb,'permitted_winter_site_ids','[]'::jsonb,'coach_edit_policy','approval'
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
  scope_type_value text:=case lower(trim(coalesce(policy_data->>'scope_type','club'))) when 'age_group' then 'age_group' when 'team_type' then 'team_type' else 'club' end;
  scope_key_value text;
  allowed_days_value integer[];
  preferred_times_value time[];
  pitch_ids_value text[];
  site_ids_value uuid[];
  weekend_value boolean:=coalesce((policy_data->>'weekend_allowed')::boolean,false);
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then raise exception 'Club owner or administrator access required' using errcode='42501'; end if;
  scope_key_value:=case when scope_type_value='club' then 'all' else lower(trim(coalesce(policy_data->>'scope_key',''))) end;
  if scope_type_value<>'club' and scope_key_value='' then raise exception 'Rule scope is required' using errcode='22023'; end if;
  allowed_days_value:=coalesce(array(select distinct value::integer from jsonb_array_elements_text(coalesce(policy_data->'allowed_days','[]'::jsonb)) row_value(value) where value::integer between 0 and 6 order by value::integer),array[1,2,3,4,5]);
  if not weekend_value then allowed_days_value:=array(select day from unnest(allowed_days_value) day where day not in (0,6)); end if;
  if cardinality(allowed_days_value)=0 then raise exception 'At least one training day must be permitted' using errcode='22023'; end if;
  preferred_times_value:=coalesce(array(select value::time from jsonb_array_elements_text(coalesce(policy_data->'preferred_start_times','[]'::jsonb)) row_value(value)),array['17:00'::time,'18:00'::time,'19:00'::time,'20:00'::time]);
  pitch_ids_value:=coalesce(array(select trim(value) from jsonb_array_elements_text(coalesce(policy_data->'permitted_pitch_ids','[]'::jsonb)) row_value(value) where trim(value)<>''),'{}'::text[]);
  site_ids_value:=coalesce(array(select value::uuid from jsonb_array_elements_text(coalesce(policy_data->'permitted_winter_site_ids','[]'::jsonb)) row_value(value) where value~'^[0-9a-fA-F-]{36}$'),'{}'::uuid[]);
  insert into public.annual_planner_scheduling_policies(
    club_id,season_phase,scope_type,scope_key,allowed_days,weekend_allowed,preferred_start_times,earliest_start_time,latest_end_time,
    default_duration_minutes,minimum_area_mode,sessions_per_week,permitted_pitch_ids,permitted_winter_site_ids,coach_edit_policy,notes,created_by,updated_by
  ) values (
    target_club_id,season_value,scope_type_value,scope_key_value,allowed_days_value,weekend_value,preferred_times_value,
    coalesce(nullif(policy_data->>'earliest_start_time','')::time,'17:00'::time),coalesce(nullif(policy_data->>'latest_end_time','')::time,'21:00'::time),
    greatest(30,least(240,coalesce((policy_data->>'default_duration_minutes')::integer,90))),
    case lower(trim(coalesce(policy_data->>'minimum_area_mode','any'))) when 'named_area' then 'named_area' when 'full_pitch' then 'full_pitch' else 'any' end,
    greatest(1,least(7,coalesce((policy_data->>'sessions_per_week')::integer,1))),pitch_ids_value,site_ids_value,
    case lower(trim(coalesce(policy_data->>'coach_edit_policy','approval'))) when 'immediate' then 'immediate' when 'club_only' then 'club_only' else 'approval' end,
    nullif(trim(policy_data->>'notes'),''),actor_id,actor_id
  )
  on conflict (club_id,season_phase,scope_type,scope_key) do update set
    allowed_days=excluded.allowed_days,weekend_allowed=excluded.weekend_allowed,preferred_start_times=excluded.preferred_start_times,
    earliest_start_time=excluded.earliest_start_time,latest_end_time=excluded.latest_end_time,default_duration_minutes=excluded.default_duration_minutes,
    minimum_area_mode=excluded.minimum_area_mode,sessions_per_week=excluded.sessions_per_week,permitted_pitch_ids=excluded.permitted_pitch_ids,
    permitted_winter_site_ids=excluded.permitted_winter_site_ids,coach_edit_policy=excluded.coach_edit_policy,notes=excluded.notes,
    updated_by=actor_id,updated_at=now()
  returning * into result;
  perform public.record_audit_event(target_club_id,'annual_planner.scheduling_policy.saved','annual_planner_scheduling_policy',result.id::text,jsonb_build_object('season_phase',season_value,'scope_type',scope_type_value,'scope_key',scope_key_value));
  return to_jsonb(result);
end;
$$;

create or replace function public.list_annual_planner_scheduling_context(target_club_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
set row_security=off
as $$
begin
  if auth.uid() is null or not public.is_club_member(target_club_id) then raise exception 'Annual planner access denied' using errcode='42501'; end if;
  return jsonb_build_object(
    'scheduling_policies',coalesce((select jsonb_agg(to_jsonb(policy) order by policy.season_phase,policy.scope_type,policy.scope_key) from public.annual_planner_scheduling_policies policy where policy.club_id=target_club_id),'[]'::jsonb),
    'preference_proposals',case when public.can_manage_club(target_club_id) then coalesce((select jsonb_agg(to_jsonb(proposal) order by proposal.created_at desc) from public.annual_planner_coach_preference_proposals proposal where proposal.club_id=target_club_id),'[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

create or replace function public.get_my_coach_training_preferences(target_club_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
set row_security=off
as $$
declare
  actor_id uuid:=auth.uid();
  coach_person_id uuid;
begin
  if actor_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select person.id into coach_person_id from public.coach_hub_people person where person.club_id=target_club_id and person.user_id=actor_id and person.status='active' limit 1;
  if coach_person_id is null then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  return jsonb_build_object(
    'policies',coalesce((select jsonb_agg(to_jsonb(policy) order by policy.season_phase,policy.scope_type,policy.scope_key) from public.annual_planner_scheduling_policies policy where policy.club_id=target_club_id),'[]'::jsonb),
    'preferences',coalesce((select jsonb_agg(to_jsonb(preference) order by preference.season_phase,preference.team_name) from public.annual_planner_team_preferences preference where preference.club_id=target_club_id and preference.team_key in (select assignment.team_key from public.coach_hub_team_assignments assignment where assignment.club_id=target_club_id and assignment.person_id=coach_person_id and assignment.status='active')),'[]'::jsonb),
    'proposals',coalesce((select jsonb_agg(to_jsonb(proposal) order by proposal.created_at desc) from public.annual_planner_coach_preference_proposals proposal where proposal.club_id=target_club_id and proposal.person_id=coach_person_id),'[]'::jsonb)
  );
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
  allowed_days_value integer[];
  permitted_pitch_ids_value text[];
  permitted_site_ids_value uuid[];
begin
  if actor_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select person.id into coach_person_id from public.coach_hub_people person where person.club_id=target_club_id and person.user_id=actor_id and person.status='active' limit 1;
  if coach_person_id is null then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  select assignment.* into assignment_row from public.coach_hub_team_assignments assignment where assignment.club_id=target_club_id and assignment.person_id=coach_person_id and assignment.team_key=team_key_value and assignment.status='active' order by assignment.is_primary desc limit 1;
  if assignment_row.id is null then raise exception 'This coach is not assigned to the selected team' using errcode='42501'; end if;
  policy:=private.annual_planner_training_policy(target_club_id,season_value,assignment_row.team_name);
  edit_policy:=coalesce(policy->>'coach_edit_policy','approval');
  if edit_policy='club_only' then raise exception 'The club manages training preferences for this team' using errcode='42501'; end if;
  allowed_days_value:=coalesce(array(select value::integer from jsonb_array_elements_text(coalesce(policy->'allowed_days','[]'::jsonb)) row_value(value)),array[1,2,3,4,5]);
  preferred_days_value:=coalesce(array(select distinct value::integer from jsonb_array_elements_text(coalesce(preference_data->'preferred_days','[]'::jsonb)) row_value(value) where value::integer between 0 and 6 order by value::integer),'{}'::integer[]);
  unavailable_days_value:=coalesce(array(select distinct value::integer from jsonb_array_elements_text(coalesce(preference_data->'unavailable_days','[]'::jsonb)) row_value(value) where value::integer between 0 and 6 order by value::integer),'{}'::integer[]);
  if not preferred_days_value <@ allowed_days_value or not unavailable_days_value <@ allowed_days_value then raise exception 'A selected day is blocked by the club master rules' using errcode='22023'; end if;
  if not coalesce((policy->>'weekend_allowed')::boolean,false) and (preferred_days_value && array[0,6]) then raise exception 'Weekend training is disabled by the club' using errcode='22023'; end if;
  preferred_times_value:=coalesce(array(select value::time from jsonb_array_elements_text(coalesce(preference_data->'preferred_start_times','[]'::jsonb)) row_value(value)),'{}'::time[]);
  earliest_time:=coalesce((policy->>'earliest_start_time')::time,'17:00'::time);
  latest_time:=coalesce((policy->>'latest_end_time')::time,'21:00'::time);
  if exists(select 1 from unnest(preferred_times_value) selected_time where selected_time<earliest_time or selected_time>=latest_time) then raise exception 'A preferred time is outside the permitted club training window' using errcode='22023'; end if;
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
    'required_duration_minutes',greatest(30,least(240,coalesce((preference_data->>'required_duration_minutes')::integer,coalesce((policy->>'default_duration_minutes')::integer,90)))),
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
      (proposed->>'required_duration_minutes')::integer,proposed->>'minimum_area_mode',50,false,false,proposed->>'notes',
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

create or replace function public.review_coach_training_preference_proposal(target_club_id uuid,target_proposal_id uuid,decision_value text,decision_note text default null)
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security=off
as $$
declare
  actor_id uuid:=auth.uid();
  proposal_row public.annual_planner_coach_preference_proposals%rowtype;
  decision_safe text:=lower(trim(coalesce(decision_value,'')));
  proposed jsonb;
  preferred_days_value integer[];
  unavailable_days_value integer[];
  preferred_times_value time[];
  pitch_ids_value text[];
  site_ids_value uuid[];
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then raise exception 'Club owner or administrator access required' using errcode='42501'; end if;
  if decision_safe not in ('approve','reject') then raise exception 'Decision must be approve or reject' using errcode='22023'; end if;
  select proposal.* into proposal_row from public.annual_planner_coach_preference_proposals proposal where proposal.id=target_proposal_id and proposal.club_id=target_club_id for update;
  if proposal_row.id is null then raise exception 'Coach preference proposal not found' using errcode='P0002'; end if;
  if proposal_row.status<>'pending' then raise exception 'This coach preference proposal has already been decided' using errcode='22023'; end if;
  proposed:=proposal_row.proposed_preference;
  if decision_safe='approve' then
    preferred_days_value:=coalesce(array(select value::integer from jsonb_array_elements_text(coalesce(proposed->'preferred_days','[]'::jsonb)) row_value(value)),'{}'::integer[]);
    unavailable_days_value:=coalesce(array(select value::integer from jsonb_array_elements_text(coalesce(proposed->'unavailable_days','[]'::jsonb)) row_value(value)),'{}'::integer[]);
    preferred_times_value:=coalesce(array(select value::time from jsonb_array_elements_text(coalesce(proposed->'preferred_start_times','[]'::jsonb)) row_value(value)),'{}'::time[]);
    pitch_ids_value:=coalesce(array(select value from jsonb_array_elements_text(coalesce(proposed->'preferred_pitch_ids','[]'::jsonb)) row_value(value)),'{}'::text[]);
    site_ids_value:=coalesce(array(select value::uuid from jsonb_array_elements_text(coalesce(proposed->'preferred_winter_site_ids','[]'::jsonb)) row_value(value) where value~'^[0-9a-fA-F-]{36}$'),'{}'::uuid[]);
    insert into public.annual_planner_team_preferences(
      club_id,team_key,team_name,season_phase,allocation_mode,preferred_days,preferred_start_times,unavailable_days,preferred_pitch_ids,preferred_winter_site_ids,
      required_duration_minutes,minimum_area_mode,priority_weight,keep_current_allocation,manual_only,notes,override_fields,preference_source,approved_proposal_id,created_by,updated_by
    ) values (
      target_club_id,proposal_row.team_key,proposal_row.team_name,proposal_row.season_phase,'inherit',preferred_days_value,preferred_times_value,unavailable_days_value,pitch_ids_value,site_ids_value,
      greatest(30,least(240,coalesce((proposed->>'required_duration_minutes')::integer,90))),
      case proposed->>'minimum_area_mode' when 'named_area' then 'named_area' when 'full_pitch' then 'full_pitch' else 'any' end,
      50,false,false,proposed->>'notes',coalesce(array(select value from jsonb_array_elements_text(coalesce(proposed->'override_fields','[]'::jsonb)) row_value(value)),'{}'::text[]),'coach',proposal_row.id,actor_id,actor_id
    ) on conflict (club_id,team_key,season_phase) do update set
      preferred_days=excluded.preferred_days,preferred_start_times=excluded.preferred_start_times,unavailable_days=excluded.unavailable_days,
      preferred_pitch_ids=excluded.preferred_pitch_ids,preferred_winter_site_ids=excluded.preferred_winter_site_ids,required_duration_minutes=excluded.required_duration_minutes,
      minimum_area_mode=excluded.minimum_area_mode,notes=excluded.notes,override_fields=excluded.override_fields,preference_source='coach',approved_proposal_id=proposal_row.id,
      updated_by=actor_id,updated_at=now();
  end if;
  update public.annual_planner_coach_preference_proposals proposal set status=case when decision_safe='approve' then 'approved' else 'rejected' end,decision_note=nullif(trim(coalesce(decision_note,'')),''),reviewed_by=actor_id,reviewed_at=now(),updated_at=now() where proposal.id=proposal_row.id returning * into proposal_row;
  insert into public.coach_hub_messages(club_id,person_id,team_key,message_type,title,body,related_type,related_id,created_by)
  values(target_club_id,proposal_row.person_id,proposal_row.team_key,'information',case when decision_safe='approve' then 'Training preferences approved' else 'Training preferences need revision' end,
         case when decision_safe='approve' then 'Your training preferences have been approved and will be used by the smart allocation assistant.' else 'The club has not approved your latest training preferences.' end||case when nullif(trim(coalesce(decision_note,'')),'') is not null then ' '||trim(decision_note) else '' end,
         'coach_training_preference',proposal_row.id::text,actor_id);
  perform public.record_audit_event(target_club_id,'annual_planner.coach_preference.'||case when decision_safe='approve' then 'approved' else 'rejected' end,'annual_planner_coach_preference_proposal',proposal_row.id::text,jsonb_build_object('team_key',proposal_row.team_key,'season_phase',proposal_row.season_phase));
  return to_jsonb(proposal_row);
end;
$$;

revoke all on function private.annual_planner_training_policy(uuid,text,text) from public,anon,authenticated;
revoke all on function public.save_annual_planner_scheduling_policy(uuid,jsonb), public.list_annual_planner_scheduling_context(uuid), public.get_my_coach_training_preferences(uuid), public.submit_my_coach_training_preference(uuid,jsonb), public.review_coach_training_preference_proposal(uuid,uuid,text,text) from public,anon;
grant execute on function public.save_annual_planner_scheduling_policy(uuid,jsonb), public.list_annual_planner_scheduling_context(uuid), public.get_my_coach_training_preferences(uuid), public.submit_my_coach_training_preference(uuid,jsonb), public.review_coach_training_preference_proposal(uuid,uuid,text,text) to authenticated;

comment on table public.annual_planner_scheduling_policies is 'v3.10.8 master training rules inherited by season, team type and age group. Weekends are disabled by default.';
comment on table public.annual_planner_coach_preference_proposals is 'Coach-submitted team training preferences reviewed under the club master scheduling policy.';

notify pgrst,'reload schema';
commit;
