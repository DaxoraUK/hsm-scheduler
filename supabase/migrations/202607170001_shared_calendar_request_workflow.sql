-- Daxora Ground Control v3.10.5
-- Shared calendar visibility, guided request availability and closure-impact workflow.
begin;

alter table public.annual_planner_blackouts
  add column if not exists closure_type text not null default 'blackout'
    check (closure_type in ('blackout','pitch_closure','maintenance','external_hire','weather','club_event')),
  add column if not exists visibility text not null default 'club'
    check (visibility in ('club','operators')),
  add column if not exists public_note text,
  add column if not exists internal_note text;

alter table public.annual_planner_bookings
  add column if not exists pitch_area_id text,
  add column if not exists pitch_area_name text;

alter table public.coach_hub_requests
  add column if not exists preferred_pitch_area_id text,
  add column if not exists preferred_pitch_area_name text,
  add column if not exists acceptable_pitch_ids text[] not null default '{}'::text[],
  add column if not exists time_flexible boolean not null default false,
  add column if not exists flexibility_minutes integer not null default 0
    check (flexibility_minutes between 0 and 240),
  add column if not exists availability_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists proposed_pitch_area_id text,
  add column if not exists proposed_pitch_area_name text;

create table if not exists public.annual_planner_closure_impacts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  blackout_id uuid not null references public.annual_planner_blackouts(id) on delete cascade,
  booking_id uuid not null references public.annual_planner_bookings(id) on delete cascade,
  team_key text,
  status text not null default 'action_required'
    check (status in ('action_required','acknowledged','relocated','cancelled','resolved')),
  resolution_note text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (blackout_id, booking_id)
);

create index if not exists annual_planner_closure_impacts_club_status_idx
  on public.annual_planner_closure_impacts(club_id,status,created_at desc);

alter table public.annual_planner_closure_impacts enable row level security;
alter table public.annual_planner_closure_impacts force row level security;
revoke all on table public.annual_planner_closure_impacts from public,anon,authenticated;

drop policy if exists annual_planner_closure_impacts_read on public.annual_planner_closure_impacts;
create policy annual_planner_closure_impacts_read on public.annual_planner_closure_impacts
  for select to authenticated using (public.can_operate_club(club_id));

drop policy if exists annual_planner_closure_impacts_write on public.annual_planner_closure_impacts;
create policy annual_planner_closure_impacts_write on public.annual_planner_closure_impacts
  for all to authenticated using (public.can_operate_club(club_id)) with check (public.can_operate_club(club_id));

create or replace function private.pitch_is_closed(
  target_club_id uuid,
  target_pitch_id text,
  range_start timestamptz,
  range_end timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists(
    select 1
    from public.pitch_closures closure_row
    where closure_row.club_id = target_club_id
      and coalesce(closure_row.data->>'pitchId', closure_row.data->>'pitch_id', closure_row.id) = target_pitch_id
      and nullif(coalesce(closure_row.data->>'reopenedAt', closure_row.data->>'reopened_at', ''), '') is null
      and coalesce(closure_row.data->>'effectiveFrom', closure_row.data->>'effective_from', closure_row.data->>'date', current_date::text)::date <= range_end::date
      and (
        coalesce((closure_row.data->>'untilReopened')::boolean, (closure_row.data->>'until_reopened')::boolean, false)
        or lower(coalesce(closure_row.data->>'mode','')) = 'untilreopened'
        or coalesce(closure_row.data->>'effectiveTo', closure_row.data->>'effective_to', closure_row.data->>'effectiveFrom', closure_row.data->>'effective_from', closure_row.data->>'date', current_date::text)::date >= range_start::date
      )
  );
$$;

create or replace function private.pitch_slot_available(target_club_id uuid,target_pitch_id text,start_value timestamptz,end_value timestamptz,booking_type_value text,ignore_booking_id uuid default null)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  overlap_count integer:=0;
  exclusive_count integer:=0;
  capacity_value integer:=private.pitch_training_capacity(target_club_id,target_pitch_id);
  type_value text:=lower(trim(coalesce(booking_type_value,'training')));
begin
  if target_pitch_id is null or trim(target_pitch_id)='' then return true; end if;
  if private.pitch_is_closed(target_club_id,target_pitch_id,start_value,end_value) then return false; end if;
  select count(*),count(*) filter(where lower(coalesce(existing.booking_type,'training'))<>'training')
    into overlap_count,exclusive_count
  from public.annual_planner_bookings existing
  where existing.club_id=target_club_id
    and existing.id is distinct from ignore_booking_id
    and existing.pitch_id=target_pitch_id
    and existing.status in ('requested','provisional','confirmed')
    and tstzrange(existing.start_at,existing.end_at,'[)') && tstzrange(start_value,end_value,'[)');
  if type_value='training' then return exclusive_count=0 and overlap_count<capacity_value; end if;
  return overlap_count=0;
end;
$$;

create or replace function public.get_coach_hub_calendar_context(
  target_club_id uuid,
  range_start date default null,
  range_end date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  coach_person_id uuid:=private.current_coach_person_id(target_club_id);
  start_boundary timestamptz:=coalesce(range_start,current_date-interval '30 days');
  end_boundary timestamptz:=coalesce(range_end,current_date+interval '400 days')+interval '1 day';
begin
  if coach_person_id is null or not public.can_access_coach_hub(target_club_id) then
    raise exception 'Coach Hub access denied' using errcode='42501';
  end if;
  return jsonb_build_object(
    'blackouts',coalesce((
      select jsonb_agg(
        to_jsonb(blackout)-'internal_note'-'created_by'-'updated_by'
        || jsonb_build_object(
          'pitch_name',coalesce((select pitch.data->>'label' from public.pitches pitch where pitch.club_id=target_club_id and pitch.id=blackout.pitch_id limit 1),blackout.pitch_id),
          'affected_booking_count',(select count(*) from public.annual_planner_closure_impacts impact where impact.blackout_id=blackout.id and impact.status='action_required')
        ) order by blackout.start_at
      )
      from public.annual_planner_blackouts blackout
      where blackout.club_id=target_club_id
        and blackout.visibility='club'
        and blackout.start_at<end_boundary and blackout.end_at>start_boundary
    ),'[]'::jsonb),
    'pitch_closures',coalesce((
      select jsonb_agg(
        closure_row.data || jsonb_build_object(
          'id',closure_row.id,
          'pitch_id',coalesce(closure_row.data->>'pitchId',closure_row.data->>'pitch_id',closure_row.id),
          'pitch_name',coalesce((select pitch.data->>'label' from public.pitches pitch where pitch.club_id=target_club_id and pitch.id=coalesce(closure_row.data->>'pitchId',closure_row.data->>'pitch_id',closure_row.id) limit 1),coalesce(closure_row.data->>'pitchId',closure_row.data->>'pitch_id',closure_row.id))
        ) order by coalesce(closure_row.data->>'effectiveFrom',closure_row.data->>'effective_from',closure_row.data->>'date')
      )
      from public.pitch_closures closure_row
      where closure_row.club_id=target_club_id
        and nullif(coalesce(closure_row.data->>'reopenedAt',closure_row.data->>'reopened_at',''),'') is null
        and coalesce(closure_row.data->>'effectiveFrom',closure_row.data->>'effective_from',closure_row.data->>'date',current_date::text)::date <= end_boundary::date
        and (
          coalesce((closure_row.data->>'untilReopened')::boolean,(closure_row.data->>'until_reopened')::boolean,false)
          or lower(coalesce(closure_row.data->>'mode',''))='untilreopened'
          or coalesce(closure_row.data->>'effectiveTo',closure_row.data->>'effective_to',closure_row.data->>'effectiveFrom',closure_row.data->>'effective_from',closure_row.data->>'date',current_date::text)::date >= start_boundary::date
        )
    ),'[]'::jsonb),
    'closure_impacts',coalesce((
      select jsonb_agg(to_jsonb(impact) order by impact.created_at desc)
      from public.annual_planner_closure_impacts impact
      join public.annual_planner_bookings booking on booking.id=impact.booking_id
      where impact.club_id=target_club_id
        and impact.status='action_required'
        and booking.team_key in (
          select assignment.team_key from public.coach_hub_team_assignments assignment
          where assignment.person_id=coach_person_id and assignment.status='active'
        )
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.check_coach_hub_request_availability(target_club_id uuid,request_data jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  coach_person_id uuid:=private.current_coach_person_id(target_club_id);
  assignment_row public.coach_hub_team_assignments%rowtype;
  start_value timestamptz:=(request_data->>'preferred_start_at')::timestamptz;
  end_value timestamptz:=(request_data->>'preferred_end_at')::timestamptz;
  pitch_value text:=nullif(request_data->>'preferred_pitch_id','');
  request_id_value uuid:=nullif(request_data->>'request_id','')::uuid;
  request_type_value text:=lower(trim(coalesce(request_data->>'request_type','training')));
  booking_type_value text:=case when request_type_value in ('training','camp','tournament') then 'training' when request_type_value='friendly' then 'friendly' else 'training' end;
  capacity_value integer:=private.pitch_training_capacity(target_club_id,pitch_value);
  used_value integer:=0;
  pending_value integer:=0;
  pending_exclusive_value integer:=0;
  reasons_value jsonb:='[]'::jsonb;
  alternatives_value jsonb:='[]'::jsonb;
  flexible_minutes integer:=greatest(0,least(240,coalesce((request_data->>'flexibility_minutes')::integer,0)));
  acceptable_pitch_values text[]:='{}'::text[];
begin
  if coach_person_id is null then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  acceptable_pitch_values:=coalesce(array(select jsonb_array_elements_text(coalesce(request_data->'acceptable_pitch_ids','[]'::jsonb))),'{}'::text[]);
  select * into assignment_row from public.coach_hub_team_assignments assignment
  where assignment.id=(request_data->>'assignment_id')::uuid
    and assignment.person_id=coach_person_id and assignment.club_id=target_club_id and assignment.status='active';
  if assignment_row.id is null then raise exception 'Choose one of your assigned teams' using errcode='42501'; end if;
  if start_value is null or end_value is null or end_value<=start_value then raise exception 'Choose a valid request time' using errcode='22023'; end if;

  if pitch_value is not null then
    select count(*) into used_value from public.annual_planner_bookings existing
    where existing.club_id=target_club_id and existing.pitch_id=pitch_value
      and existing.status in ('requested','provisional','confirmed')
      and tstzrange(existing.start_at,existing.end_at,'[)') && tstzrange(start_value,end_value,'[)');
    select count(*),count(*) filter(where lower(coalesce(pending.request_type,'training'))<>'training')
      into pending_value,pending_exclusive_value
    from public.coach_hub_requests pending
    where pending.club_id=target_club_id
      and pending.id is distinct from request_id_value
      and pending.preferred_pitch_id=pitch_value
      and pending.status in ('submitted','needs_information','alternative_offered')
      and tstzrange(pending.preferred_start_at,pending.preferred_end_at,'[)') && tstzrange(start_value,end_value,'[)');
  end if;

  select coalesce(jsonb_agg(reason),'[]'::jsonb) into reasons_value from (
    select jsonb_build_object('type','pitch_closed','message','The selected pitch is closed during this period') reason
      where pitch_value is not null and private.pitch_is_closed(target_club_id,pitch_value,start_value,end_value)
    union all
    select jsonb_build_object('type','pitch_capacity','message',case when booking_type_value='training' then 'The selected pitch has reached its simultaneous training capacity' else 'The selected pitch is already in use' end,'capacity',capacity_value,'used',used_value+pending_value)
      where pitch_value is not null and (
        not private.pitch_slot_available(target_club_id,pitch_value,start_value,end_value,booking_type_value,null)
        or pending_exclusive_value>0
        or (booking_type_value<>'training' and pending_value>0)
        or (booking_type_value='training' and used_value+pending_value>=capacity_value)
      )
    union all
    select jsonb_build_object('type','team_conflict','message','Your team already has another booking at this time','booking_id',booking.id)
      from public.annual_planner_bookings booking
      where booking.club_id=target_club_id and booking.team_key=assignment_row.team_key
        and booking.status in ('requested','provisional','confirmed')
        and tstzrange(booking.start_at,booking.end_at,'[)') && tstzrange(start_value,end_value,'[)')
    union all
    select jsonb_build_object('type','blackout','message',case when blackout.visibility='operators' then 'The facility is unavailable during this period' else coalesce(nullif(blackout.public_note,''),blackout.reason,'The facility is unavailable during this period') end,'blackout_id',blackout.id)
      from public.annual_planner_blackouts blackout
      where blackout.club_id=target_club_id and blackout.start_at<end_value and blackout.end_at>start_value
        and (blackout.pitch_id is null or pitch_value is null or blackout.pitch_id=pitch_value)
  ) reason_rows;

  with candidate_times as (
    select start_value candidate_start,end_value candidate_end,0 distance_minutes
    union all
    select start_value+(step_value||' minutes')::interval,end_value+(step_value||' minutes')::interval,abs(step_value)
    from generate_series(-flexible_minutes,flexible_minutes,30) step_value
    where flexible_minutes>0 and step_value<>0
  ), candidate_pitches as (
    select pitch.id pitch_id,coalesce(pitch.data->>'label',pitch.id) pitch_name,
      coalesce(pitch.data->>'siteId',pitch.data->>'site_id',pitch.data->>'venueId',pitch.data->>'venue_id') venue_id,
      coalesce(pitch.data->>'siteName',pitch.data->>'site_name',pitch.data->>'siteLabel',pitch.data->>'venueName',pitch.data->>'venue_name') venue_name
    from public.pitches pitch
    where pitch.club_id=target_club_id
      and (
        cardinality(acceptable_pitch_values)=0
        or pitch.id=any(acceptable_pitch_values)
        or pitch.id=pitch_value
      )
  )
  select coalesce(jsonb_agg(candidate order by candidate->>'distance_minutes',candidate->>'pitch_name'),'[]'::jsonb) into alternatives_value
  from (
    select jsonb_build_object(
      'pitch_id',candidate_pitch.pitch_id,'pitch_name',candidate_pitch.pitch_name,
      'venue_id',candidate_pitch.venue_id,'venue_name',candidate_pitch.venue_name,
      'start_at',candidate_time.candidate_start,'end_at',candidate_time.candidate_end,
      'distance_minutes',candidate_time.distance_minutes,
      'remaining_capacity',greatest(0,private.pitch_training_capacity(target_club_id,candidate_pitch.pitch_id)-(
        select count(*) from public.annual_planner_bookings existing
        where existing.club_id=target_club_id and existing.pitch_id=candidate_pitch.pitch_id
          and existing.status in ('requested','provisional','confirmed')
          and tstzrange(existing.start_at,existing.end_at,'[)') && tstzrange(candidate_time.candidate_start,candidate_time.candidate_end,'[)')
      )-(
        select count(*) from public.coach_hub_requests pending
        where pending.club_id=target_club_id
          and pending.id is distinct from request_id_value
          and pending.preferred_pitch_id=candidate_pitch.pitch_id
          and pending.status in ('submitted','needs_information','alternative_offered')
          and tstzrange(pending.preferred_start_at,pending.preferred_end_at,'[)') && tstzrange(candidate_time.candidate_start,candidate_time.candidate_end,'[)')
      ))
    ) candidate
    from candidate_times candidate_time cross join candidate_pitches candidate_pitch
    where (candidate_pitch.pitch_id is distinct from pitch_value or candidate_time.distance_minutes>0)
      and private.pitch_slot_available(target_club_id,candidate_pitch.pitch_id,candidate_time.candidate_start,candidate_time.candidate_end,booking_type_value,null)
      and (
        (booking_type_value='training' and (
          select count(*) from public.coach_hub_requests pending
          where pending.club_id=target_club_id
            and pending.id is distinct from request_id_value
            and pending.preferred_pitch_id=candidate_pitch.pitch_id
            and pending.status in ('submitted','needs_information','alternative_offered')
            and tstzrange(pending.preferred_start_at,pending.preferred_end_at,'[)') && tstzrange(candidate_time.candidate_start,candidate_time.candidate_end,'[)')
        ) + (
          select count(*) from public.annual_planner_bookings existing
          where existing.club_id=target_club_id and existing.pitch_id=candidate_pitch.pitch_id
            and existing.status in ('requested','provisional','confirmed')
            and tstzrange(existing.start_at,existing.end_at,'[)') && tstzrange(candidate_time.candidate_start,candidate_time.candidate_end,'[)')
        ) < private.pitch_training_capacity(target_club_id,candidate_pitch.pitch_id))
        or (booking_type_value<>'training' and not exists(
          select 1 from public.coach_hub_requests pending
          where pending.club_id=target_club_id
            and pending.id is distinct from request_id_value
            and pending.preferred_pitch_id=candidate_pitch.pitch_id
            and pending.status in ('submitted','needs_information','alternative_offered')
            and tstzrange(pending.preferred_start_at,pending.preferred_end_at,'[)') && tstzrange(candidate_time.candidate_start,candidate_time.candidate_end,'[)')
        ))
      )
      and not exists(
        select 1 from public.coach_hub_requests pending
        where pending.club_id=target_club_id
          and pending.id is distinct from request_id_value
          and pending.preferred_pitch_id=candidate_pitch.pitch_id
          and pending.status in ('submitted','needs_information','alternative_offered')
          and lower(coalesce(pending.request_type,'training'))<>'training'
          and tstzrange(pending.preferred_start_at,pending.preferred_end_at,'[)') && tstzrange(candidate_time.candidate_start,candidate_time.candidate_end,'[)')
      )
      and not exists(
        select 1 from public.annual_planner_bookings booking
        where booking.club_id=target_club_id and booking.team_key=assignment_row.team_key
          and booking.status in ('requested','provisional','confirmed')
          and tstzrange(booking.start_at,booking.end_at,'[)') && tstzrange(candidate_time.candidate_start,candidate_time.candidate_end,'[)')
      )
      and not exists(
        select 1 from public.annual_planner_blackouts blackout
        where blackout.club_id=target_club_id
          and (blackout.pitch_id is null or blackout.pitch_id=candidate_pitch.pitch_id)
          and tstzrange(blackout.start_at,blackout.end_at,'[)') && tstzrange(candidate_time.candidate_start,candidate_time.candidate_end,'[)')
      )
    limit 8
  ) alternatives;

  return jsonb_build_object(
    'available',jsonb_array_length(reasons_value)=0,
    'status',case when jsonb_array_length(reasons_value)=0 then case when pitch_value is not null and capacity_value-used_value-pending_value<=1 then 'limited' else 'available' end else 'unavailable' end,
    'advisory',jsonb_array_length(reasons_value)>0 and jsonb_array_length(alternatives_value)>0,
    'capacity',capacity_value,
    'used_capacity',used_value+pending_value,
    'remaining_capacity',greatest(0,capacity_value-used_value-pending_value),
    'reasons',reasons_value,
    'alternatives',alternatives_value
  );
end;
$$;

create or replace function public.submit_coach_hub_request_v2(target_club_id uuid,request_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  result_value jsonb;
  request_id_value uuid;
  availability_value jsonb;
begin
  availability_value:=public.check_coach_hub_request_availability(target_club_id,request_data);
  result_value:=public.submit_coach_hub_request(target_club_id,request_data);
  request_id_value:=(result_value->>'id')::uuid;
  update public.coach_hub_requests request_row set
    preferred_pitch_area_id=nullif(request_data->>'preferred_pitch_area_id',''),
    preferred_pitch_area_name=nullif(request_data->>'preferred_pitch_area_name',''),
    acceptable_pitch_ids=coalesce(array(select jsonb_array_elements_text(coalesce(request_data->'acceptable_pitch_ids','[]'::jsonb))),'{}'::text[]),
    time_flexible=coalesce((request_data->>'time_flexible')::boolean,false),
    flexibility_minutes=case when coalesce((request_data->>'time_flexible')::boolean,false) then greatest(0,least(240,coalesce((request_data->>'flexibility_minutes')::integer,30))) else 0 end,
    availability_snapshot=availability_value,
    updated_at=now()
  where request_row.id=request_id_value;
  return (select to_jsonb(request_row)-'admin_notes' from public.coach_hub_requests request_row where request_row.id=request_id_value);
end;
$$;

create or replace function public.update_my_coach_hub_request_v2(target_club_id uuid,target_request_id uuid,request_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  result_value jsonb;
  availability_value jsonb;
begin
  availability_value:=public.check_coach_hub_request_availability(target_club_id,request_data);
  result_value:=public.update_my_coach_hub_request(target_club_id,target_request_id,request_data);
  update public.coach_hub_requests request_row set
    preferred_pitch_area_id=nullif(request_data->>'preferred_pitch_area_id',''),
    preferred_pitch_area_name=nullif(request_data->>'preferred_pitch_area_name',''),
    acceptable_pitch_ids=coalesce(array(select jsonb_array_elements_text(coalesce(request_data->'acceptable_pitch_ids','[]'::jsonb))),'{}'::text[]),
    time_flexible=coalesce((request_data->>'time_flexible')::boolean,false),
    flexibility_minutes=case when coalesce((request_data->>'time_flexible')::boolean,false) then greatest(0,least(240,coalesce((request_data->>'flexibility_minutes')::integer,30))) else 0 end,
    availability_snapshot=availability_value,
    updated_at=now()
  where request_row.id=target_request_id;
  return (select to_jsonb(request_row)-'admin_notes' from public.coach_hub_requests request_row where request_row.id=target_request_id);
end;
$$;

create or replace function public.review_coach_hub_request_v2(target_club_id uuid,target_request_id uuid,decision text,decision_data jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  result_value jsonb;
  resulting_booking uuid;
begin
  if lower(trim(coalesce(decision,'')))='alternative' then
    update public.coach_hub_requests request_row set
      proposed_pitch_area_id=nullif(decision_data->>'pitch_area_id',''),
      proposed_pitch_area_name=nullif(decision_data->>'pitch_area_name','')
    where request_row.id=target_request_id and request_row.club_id=target_club_id;
  end if;
  result_value:=public.review_coach_hub_request(target_club_id,target_request_id,decision,decision_data);
  resulting_booking:=nullif(result_value->>'resulting_booking_id','')::uuid;
  if resulting_booking is not null then
    update public.annual_planner_bookings booking set
      pitch_area_id=coalesce(nullif(result_value->>'proposed_pitch_area_id',''),nullif(result_value->>'preferred_pitch_area_id','')),
      pitch_area_name=coalesce(nullif(result_value->>'proposed_pitch_area_name',''),nullif(result_value->>'preferred_pitch_area_name','')),
      updated_at=now()
    where booking.id=resulting_booking and booking.club_id=target_club_id;
  end if;
  return (select to_jsonb(request_row) from public.coach_hub_requests request_row where request_row.id=target_request_id);
end;
$$;

create or replace function public.save_annual_planner_blackout_v2(target_club_id uuid,blackout_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid:=auth.uid();
  result_value jsonb;
  blackout_id_value uuid;
begin
  if actor_id is null or not public.can_operate_club(target_club_id) then raise exception 'Club operator access required' using errcode='42501'; end if;
  result_value:=public.save_annual_planner_blackout(target_club_id,blackout_data);
  blackout_id_value:=(result_value->>'id')::uuid;
  update public.annual_planner_blackouts blackout set
    closure_type=case lower(trim(coalesce(blackout_data->>'closure_type','blackout'))) when 'pitch_closure' then 'pitch_closure' when 'maintenance' then 'maintenance' when 'external_hire' then 'external_hire' when 'weather' then 'weather' when 'club_event' then 'club_event' else 'blackout' end,
    visibility=case lower(trim(coalesce(blackout_data->>'visibility','club'))) when 'operators' then 'operators' else 'club' end,
    public_note=nullif(trim(coalesce(blackout_data->>'public_note',blackout_data->>'reason','')),''),
    internal_note=nullif(trim(coalesce(blackout_data->>'internal_note','')),''),
    updated_at=now()
  where blackout.id=blackout_id_value;

  with inserted_impacts as (
    insert into public.annual_planner_closure_impacts(club_id,blackout_id,booking_id,team_key)
    select target_club_id,blackout_id_value,booking.id,booking.team_key
    from public.annual_planner_bookings booking
    join public.annual_planner_blackouts blackout on blackout.id=blackout_id_value
    where booking.club_id=target_club_id
      and booking.status in ('requested','provisional','confirmed')
      and tstzrange(booking.start_at,booking.end_at,'[)') && tstzrange(blackout.start_at,blackout.end_at,'[)')
      and (blackout.pitch_id is null or booking.pitch_id=blackout.pitch_id)
      and (blackout.venue_id is null or booking.venue_id=blackout.venue_id)
    on conflict(blackout_id,booking_id) do nothing
    returning *
  )
  insert into public.coach_hub_messages(club_id,person_id,team_key,message_type,title,body,related_type,related_id,requires_acknowledgement,created_by)
  select distinct target_club_id,assignment.person_id,impact.team_key,'action_required',
    'Facility closure affects a team booking',
    coalesce(nullif(blackout.public_note,''),blackout.reason,'A facility closure now affects one of your approved or provisional bookings. Open Coach Hub for the latest details.'),
    'annual_planner_blackout',blackout_id_value::text,true,actor_id
  from inserted_impacts impact
  join public.coach_hub_team_assignments assignment on assignment.club_id=target_club_id and assignment.team_key=impact.team_key and assignment.status='active'
  join public.annual_planner_blackouts blackout on blackout.id=blackout_id_value
  where blackout.visibility='club';

  perform public.record_audit_event(target_club_id,'annual_planner.blackout.saved','annual_planner_blackout',blackout_id_value::text,
    jsonb_build_object('affected_bookings',(select count(*) from public.annual_planner_closure_impacts impact where impact.blackout_id=blackout_id_value and impact.status='action_required')));
  return (select to_jsonb(blackout)||jsonb_build_object('affected_booking_count',(select count(*) from public.annual_planner_closure_impacts impact where impact.blackout_id=blackout.id and impact.status='action_required')) from public.annual_planner_blackouts blackout where blackout.id=blackout_id_value);
end;
$$;

create or replace function public.list_annual_planner_closure_impacts(target_club_id uuid,range_start date default null,range_end date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  start_boundary timestamptz:=coalesce(range_start,current_date-interval '30 days');
  end_boundary timestamptz:=coalesce(range_end,current_date+interval '400 days')+interval '1 day';
begin
  if auth.uid() is null or not public.can_operate_club(target_club_id) then raise exception 'Club operator access required' using errcode='42501'; end if;
  return coalesce((
    select jsonb_agg(
      to_jsonb(impact)||jsonb_build_object(
        'blackout_title',blackout.title,'blackout_start_at',blackout.start_at,'blackout_end_at',blackout.end_at,
        'booking_title',booking.title,'booking_start_at',booking.start_at,'booking_end_at',booking.end_at,
        'team_name',booking.team_name,'pitch_name',booking.pitch_name
      ) order by blackout.start_at,booking.start_at
    )
    from public.annual_planner_closure_impacts impact
    join public.annual_planner_blackouts blackout on blackout.id=impact.blackout_id
    join public.annual_planner_bookings booking on booking.id=impact.booking_id
    where impact.club_id=target_club_id and blackout.start_at<end_boundary and blackout.end_at>start_boundary
  ),'[]'::jsonb);
end;
$$;

create or replace function public.resolve_annual_planner_closure_impact(target_club_id uuid,target_impact_id uuid,resolution_data jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid:=auth.uid();
  status_value text:=lower(trim(coalesce(resolution_data->>'status','resolved')));
  result_row public.annual_planner_closure_impacts%rowtype;
begin
  if actor_id is null or not public.can_operate_club(target_club_id) then raise exception 'Club operator access required' using errcode='42501'; end if;
  if status_value not in ('acknowledged','relocated','cancelled','resolved') then raise exception 'Unsupported closure-impact resolution' using errcode='22023'; end if;
  update public.annual_planner_closure_impacts impact set
    status=status_value,resolution_note=nullif(trim(resolution_data->>'note'),''),resolved_by=actor_id,resolved_at=now(),updated_at=now()
  where impact.id=target_impact_id and impact.club_id=target_club_id returning * into result_row;
  if result_row.id is null then raise exception 'Closure impact not found' using errcode='P0002'; end if;
  perform public.record_audit_event(target_club_id,'annual_planner.closure_impact.'||status_value,'annual_planner_closure_impact',result_row.id::text,jsonb_build_object('booking_id',result_row.booking_id,'blackout_id',result_row.blackout_id));
  return to_jsonb(result_row);
end;
$$;

create or replace function public.get_coach_hub_calendar_by_token(feed_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare feed public.coach_hub_calendar_feeds%rowtype;
begin
  select * into feed from public.coach_hub_calendar_feeds row_value where row_value.token_hash=encode(digest(trim(coalesce(feed_token,'')),'sha256'),'hex') and row_value.status='active';
  if feed.id is null then raise exception 'Calendar feed not found' using errcode='P0002'; end if;
  update public.coach_hub_calendar_feeds set last_accessed_at=now() where id=feed.id;
  return jsonb_build_object(
    'club_name',(select name from public.clubs where id=feed.club_id),
    'label',feed.label,
    'team_key',feed.team_key,
    'bookings',coalesce((select jsonb_agg(to_jsonb(booking)-'cost_pence'-'supplier_reference'-'notes'-'finance_reference' order by booking.start_at)
      from public.annual_planner_bookings booking
      where booking.club_id=feed.club_id
        and booking.team_key in(select assignment.team_key from public.coach_hub_team_assignments assignment where assignment.person_id=feed.person_id and assignment.status='active' and (feed.team_key is null or assignment.team_key=feed.team_key))
        and booking.status in ('provisional','confirmed') and booking.end_at>now()-interval '30 days'),'[]'::jsonb),
    'blackouts',coalesce((select jsonb_agg(to_jsonb(blackout)-'internal_note'-'created_by'-'updated_by' order by blackout.start_at)
      from public.annual_planner_blackouts blackout where blackout.club_id=feed.club_id and blackout.visibility='club' and blackout.end_at>now()-interval '30 days'),'[]'::jsonb),
    'pitch_closures',coalesce((select jsonb_agg(closure_row.data||jsonb_build_object('id',closure_row.id,'pitch_id',coalesce(closure_row.data->>'pitchId',closure_row.data->>'pitch_id',closure_row.id)))
      from public.pitch_closures closure_row where closure_row.club_id=feed.club_id and nullif(coalesce(closure_row.data->>'reopenedAt',closure_row.data->>'reopened_at',''),'') is null),'[]'::jsonb)
  );
end;
$$;


do $$
declare crypto_schema text;
begin
  select namespace.nspname into crypto_schema
  from pg_catalog.pg_extension extension_row
  join pg_catalog.pg_namespace namespace on namespace.oid=extension_row.extnamespace
  where extension_row.extname='pgcrypto';
  if crypto_schema is null then raise exception 'The pgcrypto extension is required for calendar feed tokens'; end if;
  execute pg_catalog.format('alter function public.get_coach_hub_calendar_by_token(text) set search_path = pg_catalog, %I',crypto_schema);
end;
$$;

revoke all on function private.pitch_is_closed(uuid,text,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.get_coach_hub_calendar_context(uuid,date,date),public.check_coach_hub_request_availability(uuid,jsonb),public.submit_coach_hub_request_v2(uuid,jsonb),public.update_my_coach_hub_request_v2(uuid,uuid,jsonb),public.review_coach_hub_request_v2(uuid,uuid,text,jsonb),public.save_annual_planner_blackout_v2(uuid,jsonb),public.list_annual_planner_closure_impacts(uuid,date,date),public.resolve_annual_planner_closure_impact(uuid,uuid,jsonb) from public,anon;
grant execute on function public.get_coach_hub_calendar_context(uuid,date,date),public.check_coach_hub_request_availability(uuid,jsonb),public.submit_coach_hub_request_v2(uuid,jsonb),public.update_my_coach_hub_request_v2(uuid,uuid,jsonb),public.review_coach_hub_request_v2(uuid,uuid,text,jsonb),public.save_annual_planner_blackout_v2(uuid,jsonb),public.list_annual_planner_closure_impacts(uuid,date,date),public.resolve_annual_planner_closure_impact(uuid,uuid,jsonb) to authenticated;
revoke all on function public.get_coach_hub_calendar_by_token(text) from public,anon,authenticated;
grant execute on function public.get_coach_hub_calendar_by_token(text) to service_role;

notify pgrst, 'reload schema';
commit;
