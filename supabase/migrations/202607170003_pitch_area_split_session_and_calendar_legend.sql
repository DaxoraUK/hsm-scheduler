-- Daxora Ground Control v3.10.5.2
-- Allows split training sessions across different named pitch areas and aligns calendar legend colours.
begin;

create or replace function private.pitch_area_slot_available(
  target_club_id uuid,
  target_pitch_id text,
  target_pitch_area_id text,
  start_value timestamptz,
  end_value timestamptz,
  booking_type_value text,
  ignore_booking_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  type_value text := lower(trim(coalesce(booking_type_value, 'training')));
  area_value text := nullif(trim(coalesce(target_pitch_area_id, '')), '');
begin
  if not private.pitch_slot_available(
    target_club_id,
    target_pitch_id,
    start_value,
    end_value,
    type_value,
    ignore_booking_id
  ) then
    return false;
  end if;

  if type_value <> 'training' or area_value is null then
    return true;
  end if;

  return not exists (
    select 1
    from public.annual_planner_bookings existing
    where existing.club_id = target_club_id
      and existing.id is distinct from ignore_booking_id
      and existing.pitch_id = target_pitch_id
      and existing.pitch_area_id = area_value
      and existing.status in ('requested', 'provisional', 'confirmed')
      and tstzrange(existing.start_at, existing.end_at, '[)')
        && tstzrange(start_value, end_value, '[)')
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
  area_value text:=nullif(request_data->>'preferred_pitch_area_id','');
  request_id_value uuid:=nullif(request_data->>'request_id','')::uuid;
  request_type_value text:=lower(trim(coalesce(request_data->>'request_type','training')));
  booking_type_value text:=case when request_type_value in ('training','camp','tournament') then 'training' when request_type_value='friendly' then 'friendly' else 'training' end;
  capacity_value integer:=private.pitch_training_capacity(target_club_id,pitch_value);
  used_value integer:=0;
  pending_value integer:=0;
  pending_exclusive_value integer:=0;
  area_used_value integer:=0;
  pending_area_value integer:=0;
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
    if area_value is not null then
      select count(*) into area_used_value from public.annual_planner_bookings existing
      where existing.club_id=target_club_id and existing.pitch_id=pitch_value
        and existing.pitch_area_id=area_value
        and existing.status in ('requested','provisional','confirmed')
        and tstzrange(existing.start_at,existing.end_at,'[)') && tstzrange(start_value,end_value,'[)');
      select count(*) into pending_area_value from public.coach_hub_requests pending
      where pending.club_id=target_club_id
        and pending.id is distinct from request_id_value
        and pending.preferred_pitch_id=pitch_value
        and pending.preferred_pitch_area_id=area_value
        and pending.status in ('submitted','needs_information','alternative_offered')
        and tstzrange(pending.preferred_start_at,pending.preferred_end_at,'[)') && tstzrange(start_value,end_value,'[)');
    end if;
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
    select jsonb_build_object('type','pitch_area','message','The selected pitch area is already allocated during this period','pitch_area_id',area_value,'used',area_used_value+pending_area_value)
      where booking_type_value='training' and area_value is not null and area_used_value+pending_area_value>0
    union all
    select jsonb_build_object('type','team_conflict','message','Your team already has another booking at this time','booking_id',booking.id)
      from public.annual_planner_bookings booking
      where booking.club_id=target_club_id and booking.team_key=assignment_row.team_key
        and booking.status in ('requested','provisional','confirmed')
        and tstzrange(booking.start_at,booking.end_at,'[)') && tstzrange(start_value,end_value,'[)')
        and not (
          booking_type_value='training'
          and booking.booking_type='training'
          and pitch_value is not null
          and booking.pitch_id=pitch_value
          and area_value is not null
          and booking.pitch_area_id is not null
          and booking.pitch_area_id<>area_value
        )
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
    'pitch_area_id',area_value,
    'area_used_capacity',area_used_value+pending_area_value,
    'reasons',reasons_value,
    'alternatives',alternatives_value
  );
end;
$$;

create or replace function public.save_annual_planner_booking(
  target_club_id uuid,
  booking_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  target_id uuid := nullif(booking_data->>'booking_id','')::uuid;
  result public.annual_planner_bookings%rowtype;
  next_status text := coalesce(nullif(lower(trim(booking_data->>'status')),''), 'provisional');
  next_start timestamptz := (booking_data->>'start_at')::timestamptz;
  next_end timestamptz := (booking_data->>'end_at')::timestamptz;
  next_venue_id text := nullif(booking_data->>'venue_id','');
  next_pitch_id text := nullif(booking_data->>'pitch_id','');
  next_pitch_area_id text := nullif(booking_data->>'pitch_area_id','');
  next_pitch_area_name text := nullif(booking_data->>'pitch_area_name','');
  next_team_key text := nullif(booking_data->>'team_key','');
  next_booking_type text := coalesce(nullif(lower(trim(booking_data->>'booking_type')),''),'training');
  can_manage boolean := false;
  require_approval boolean := false;
  can_edit_costs boolean := true;
begin
  if actor_id is null or not public.can_operate_club(target_club_id) then
    raise exception 'Annual planner operation denied' using errcode = '42501';
  end if;
  if not private.club_has_entitlement(target_club_id, 'annual_planner') then
    raise exception 'Annual planner is not included in this workspace package' using errcode = '42501';
  end if;

  can_manage := public.can_manage_club(target_club_id);
  select coalesce(settings.require_approval, false),
    can_manage or coalesce(settings.show_costs_to_schedulers, true)
  into require_approval, can_edit_costs
  from (select 1) seed
  left join public.annual_planner_settings settings on settings.club_id = target_club_id;

  if require_approval and not can_manage then next_status := 'requested'; end if;
  if next_end <= next_start then
    raise exception 'Annual planner booking must finish after it starts' using errcode = '22023';
  end if;

  if next_pitch_id is not null then
    perform pg_advisory_xact_lock(hashtext(target_club_id::text || ':pitch:' || next_pitch_id));
    if not private.pitch_area_slot_available(target_club_id,next_pitch_id,next_pitch_area_id,next_start,next_end,next_booking_type,target_id) then
      raise exception 'This pitch has reached its capacity for the selected time' using errcode = '23P01';
    end if;
  end if;

  if next_team_key is not null then
    perform pg_advisory_xact_lock(hashtext(target_club_id::text || ':team:' || next_team_key));
    if exists (
      select 1 from public.annual_planner_bookings existing
      where existing.club_id = target_club_id
        and existing.id is distinct from target_id
        and existing.team_key = next_team_key
        and existing.status in ('requested','provisional','confirmed')
        and tstzrange(existing.start_at, existing.end_at, '[)') && tstzrange(next_start, next_end, '[)')
        and not (
          next_booking_type='training'
          and existing.booking_type='training'
          and next_pitch_id is not null
          and existing.pitch_id=next_pitch_id
          and next_pitch_area_id is not null
          and existing.pitch_area_id is not null
          and existing.pitch_area_id<>next_pitch_area_id
        )
    ) then
      raise exception 'This team already has an active annual-planner booking at the selected time' using errcode = '23P01';
    end if;
  end if;

  if exists (
    select 1 from public.annual_planner_blackouts blackout
    where blackout.club_id = target_club_id
      and (blackout.venue_id is null or next_venue_id is null or blackout.venue_id = next_venue_id)
      and (blackout.pitch_id is null or next_pitch_id is null or blackout.pitch_id = next_pitch_id)
      and tstzrange(blackout.start_at, blackout.end_at, '[)') && tstzrange(next_start, next_end, '[)')
  ) then
    raise exception 'The selected facility is unavailable during this period' using errcode = '23P01';
  end if;

  if target_id is null then
    insert into public.annual_planner_bookings (
      club_id,series_id,title,booking_type,status,team_key,team_name,opponent_name,
      venue_id,venue_name,pitch_id,pitch_name,pitch_area_id,pitch_area_name,start_at,end_at,recurrence,recurrence_until,exception_dates,holiday_policy,
      cost_pence,supplier_reference,booking_reference,contact_name,contact_email,notes,finance_status,finance_reference,
      source_type,source_id,requested_by,approved_by,approved_at,created_by,updated_by
    ) values (
      target_club_id,nullif(booking_data->>'series_id',''),trim(booking_data->>'title'),
      coalesce(nullif(lower(trim(booking_data->>'booking_type')),''),'training'),next_status,
      nullif(booking_data->>'team_key',''),nullif(booking_data->>'team_name',''),nullif(booking_data->>'opponent_name',''),
      nullif(booking_data->>'venue_id',''),nullif(booking_data->>'venue_name',''),next_pitch_id,nullif(booking_data->>'pitch_name',''),next_pitch_area_id,next_pitch_area_name,
      next_start,next_end,
      coalesce(nullif(lower(trim(booking_data->>'recurrence')),''),'none'),nullif(booking_data->>'recurrence_until','')::date,
      coalesce(array(select value::date from jsonb_array_elements_text(coalesce(booking_data->'exception_dates','[]'::jsonb)) as exception_row(value) where value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),'{}'::date[]),
      case lower(trim(coalesce(booking_data->>'holiday_policy','include'))) when 'exclude' then 'exclude' when 'custom' then 'custom' else 'include' end,
      case when can_edit_costs then greatest(0,coalesce((booking_data->>'cost_pence')::integer,0)) else 0 end,
      case when can_edit_costs then nullif(booking_data->>'supplier_reference','') else null end,
      nullif(booking_data->>'booking_reference',''),nullif(booking_data->>'contact_name',''),nullif(booking_data->>'contact_email',''),
      nullif(booking_data->>'notes',''),
      case when can_manage then coalesce(nullif(lower(trim(booking_data->>'finance_status')),''),'unreconciled') else 'unreconciled' end,
      case when can_manage then nullif(booking_data->>'finance_reference','') else null end,
      coalesce(nullif(booking_data->>'source_type',''),'annual_planner'),nullif(booking_data->>'source_id',''),
      case when next_status = 'requested' then actor_id else null end,
      case when next_status = 'confirmed' then actor_id else null end,
      case when next_status = 'confirmed' then now() else null end,
      actor_id,actor_id
    ) returning * into result;
  else
    update public.annual_planner_bookings booking set
      series_id = nullif(booking_data->>'series_id',''),
      title = trim(booking_data->>'title'),
      booking_type = coalesce(nullif(lower(trim(booking_data->>'booking_type')),''),'training'),
      status = next_status,
      team_key = nullif(booking_data->>'team_key',''), team_name = nullif(booking_data->>'team_name',''),
      opponent_name = nullif(booking_data->>'opponent_name',''), venue_id = nullif(booking_data->>'venue_id',''),
      venue_name = nullif(booking_data->>'venue_name',''), pitch_id = nullif(booking_data->>'pitch_id',''),
      pitch_name = nullif(booking_data->>'pitch_name',''), pitch_area_id = next_pitch_area_id,
      pitch_area_name = next_pitch_area_name, start_at = next_start,
      end_at = next_end, recurrence = coalesce(nullif(lower(trim(booking_data->>'recurrence')),''),'none'),
      recurrence_until = nullif(booking_data->>'recurrence_until','')::date,
      exception_dates = coalesce(array(select value::date from jsonb_array_elements_text(coalesce(booking_data->'exception_dates','[]'::jsonb)) as exception_row(value) where value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),'{}'::date[]),
      holiday_policy = case lower(trim(coalesce(booking_data->>'holiday_policy','include'))) when 'exclude' then 'exclude' when 'custom' then 'custom' else 'include' end,
      cost_pence = case when can_edit_costs then greatest(0,coalesce((booking_data->>'cost_pence')::integer,0)) else booking.cost_pence end,
      supplier_reference = case when can_edit_costs then nullif(booking_data->>'supplier_reference','') else booking.supplier_reference end, booking_reference = nullif(booking_data->>'booking_reference',''),
      contact_name = nullif(booking_data->>'contact_name',''), contact_email = nullif(booking_data->>'contact_email',''),
      notes = nullif(booking_data->>'notes',''),
      finance_status = case when can_manage then coalesce(nullif(lower(trim(booking_data->>'finance_status')),''),booking.finance_status) else booking.finance_status end,
      finance_reference = case when can_manage then nullif(booking_data->>'finance_reference','') else booking.finance_reference end,
      requested_by = case when next_status = 'requested' then actor_id else booking.requested_by end,
      approved_by = case when next_status = 'confirmed' then actor_id else null end,
      approved_at = case when next_status = 'confirmed' then coalesce(booking.approved_at,now()) else null end,
      updated_by = actor_id, updated_at = now()
    where booking.id = target_id and booking.club_id = target_club_id
    returning * into result;
    if result.id is null then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  end if;

  perform public.record_audit_event(target_club_id,
    case when target_id is null then 'annual_planner.booking.created' else 'annual_planner.booking.updated' end,
    'annual_planner_booking',result.id::text,
    jsonb_build_object('title',result.title,'status',result.status,'start_at',result.start_at,'pitch_id',result.pitch_id,'pitch_area_id',result.pitch_area_id));
  return to_jsonb(result);
end;
$$;

create or replace function private.create_booking_from_coach_request(request_row public.coach_hub_requests,actor_id uuid,use_proposal boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  first_booking_id uuid;
  next_booking_id uuid;
  target_booking public.annual_planner_bookings%rowtype;
  start_value timestamptz:=case when use_proposal then request_row.proposed_start_at else request_row.preferred_start_at end;
  end_value timestamptz:=case when use_proposal then request_row.proposed_end_at else request_row.preferred_end_at end;
  pitch_value text:=case when use_proposal then request_row.proposed_pitch_id else request_row.preferred_pitch_id end;
  pitch_name_value text:=case when use_proposal then request_row.proposed_pitch_name else request_row.preferred_pitch_name end;
  pitch_area_value text:=case when use_proposal then request_row.proposed_pitch_area_id else request_row.preferred_pitch_area_id end;
  pitch_area_name_value text:=case when use_proposal then request_row.proposed_pitch_area_name else request_row.preferred_pitch_area_name end;
  venue_value text:=case when use_proposal then request_row.proposed_venue_id else request_row.preferred_venue_id end;
  venue_name_value text:=case when use_proposal then request_row.proposed_venue_name else request_row.preferred_venue_name end;
  occurrence_start timestamptz;
  occurrence_end timestamptz;
  interval_step interval:=case when request_row.recurrence='weekly' then interval '7 days' when request_row.recurrence='fortnightly' then interval '14 days' else interval '100 years' end;
  series_key text:='coach-'||request_row.id::text;
  occurrence_count integer:=0;
  coach_name text;
  coach_email text;
  booking_type_value text:=case when request_row.request_type in ('training','camp','tournament') then 'training' when request_row.request_type='friendly' then 'friendly' else 'training' end;
begin
  if actor_id is null then raise exception 'Coach request approval actor is required' using errcode='42501'; end if;
  if start_value is null or end_value is null or end_value<=start_value then
    raise exception 'The approved booking time is invalid' using errcode='22023';
  end if;

  select person.display_name,person.email into coach_name,coach_email
  from public.coach_hub_people person where person.id=request_row.person_id and person.club_id=request_row.club_id;

  if request_row.request_type in ('change','cancellation') then
    select * into target_booking from public.annual_planner_bookings booking
    where booking.id=request_row.target_booking_id and booking.club_id=request_row.club_id for update;
    if target_booking.id is null then raise exception 'The original booking is no longer available' using errcode='P0002'; end if;

    if request_row.request_type='cancellation' then
      update public.annual_planner_bookings booking set
        status='cancelled',
        notes=concat_ws(E'\n',booking.notes,request_row.coach_notes),
        updated_by=actor_id,
        updated_at=now()
      where booking.id=target_booking.id
      returning booking.id into next_booking_id;
    else
      if pitch_value is not null then
        perform pg_advisory_xact_lock(hashtext(request_row.club_id::text||':pitch:'||pitch_value));
        if not private.pitch_area_slot_available(request_row.club_id,pitch_value,pitch_area_value,start_value,end_value,target_booking.booking_type,target_booking.id) then raise exception 'The alternative pitch has reached capacity at this time' using errcode='23P01'; end if;
      end if;
      perform pg_advisory_xact_lock(hashtext(request_row.club_id::text||':team:'||target_booking.team_key));
      if exists(
        select 1 from public.annual_planner_bookings existing
        where existing.club_id=request_row.club_id
          and existing.id is distinct from target_booking.id
          and existing.team_key=target_booking.team_key
          and existing.status in ('requested','provisional','confirmed')
          and tstzrange(existing.start_at,existing.end_at,'[)') && tstzrange(start_value,end_value,'[)')
          and not (
            target_booking.booking_type='training'
            and existing.booking_type='training'
            and pitch_value is not null
            and existing.pitch_id=pitch_value
            and pitch_area_value is not null
            and existing.pitch_area_id is not null
            and existing.pitch_area_id<>pitch_area_value
          )
      ) then raise exception 'The team already has another booking at this time' using errcode='23P01'; end if;
      if exists(
        select 1 from public.annual_planner_blackouts blackout
        where blackout.club_id=request_row.club_id
          and (blackout.venue_id is null or venue_value is null or blackout.venue_id=venue_value)
          and (blackout.pitch_id is null or pitch_value is null or blackout.pitch_id=pitch_value)
          and tstzrange(blackout.start_at,blackout.end_at,'[)') && tstzrange(start_value,end_value,'[)')
      ) then raise exception 'The alternative facility is unavailable during this period' using errcode='23P01'; end if;

      update public.annual_planner_bookings booking set
        status='confirmed',
        venue_id=venue_value,
        venue_name=venue_name_value,
        pitch_id=pitch_value,
        pitch_name=pitch_name_value,
        pitch_area_id=pitch_area_value,
        pitch_area_name=pitch_area_name_value,
        start_at=start_value,
        end_at=end_value,
        notes=concat_ws(E'\n',booking.notes,request_row.coach_notes),
        approved_by=actor_id,
        approved_at=coalesce(booking.approved_at,now()),
        updated_by=actor_id,
        updated_at=now()
      where booking.id=target_booking.id
      returning booking.id into next_booking_id;
    end if;

    perform public.record_audit_event(request_row.club_id,
      case when request_row.request_type='cancellation' then 'annual_planner.booking.cancelled_from_coach_request' else 'annual_planner.booking.changed_from_coach_request' end,
      'annual_planner_booking',next_booking_id::text,
      jsonb_build_object('coach_request_id',request_row.id,'start_at',start_value,'pitch_id',pitch_value,'pitch_area_id',pitch_area_value));
    return next_booking_id;
  end if;

  occurrence_start:=start_value;
  occurrence_end:=end_value;
  loop
    exit when request_row.recurrence<>'none'
      and request_row.recurrence_until is not null
      and occurrence_start::date>request_row.recurrence_until;
    if occurrence_start::date = any(coalesce(request_row.exception_dates,'{}'::date[])) then
      occurrence_start:=occurrence_start+interval_step;
      occurrence_end:=occurrence_end+interval_step;
      continue;
    end if;
    occurrence_count:=occurrence_count+1;
    if occurrence_count>160 then raise exception 'Coach booking series exceeds 160 occurrences' using errcode='22023'; end if;

    if pitch_value is not null then
      perform pg_advisory_xact_lock(hashtext(request_row.club_id::text||':pitch:'||pitch_value));
      if not private.pitch_area_slot_available(request_row.club_id,pitch_value,pitch_area_value,occurrence_start,occurrence_end,booking_type_value,null) then raise exception 'The approved pitch has reached capacity for one or more requested dates' using errcode='23P01'; end if;
    end if;

    perform pg_advisory_xact_lock(hashtext(request_row.club_id::text||':team:'||request_row.team_key));
    if exists(
      select 1 from public.annual_planner_bookings existing
      where existing.club_id=request_row.club_id
        and existing.team_key=request_row.team_key
        and existing.status in ('requested','provisional','confirmed')
        and tstzrange(existing.start_at,existing.end_at,'[)') && tstzrange(occurrence_start,occurrence_end,'[)')
        and not (
          booking_type_value='training'
          and existing.booking_type='training'
          and pitch_value is not null
          and existing.pitch_id=pitch_value
          and pitch_area_value is not null
          and existing.pitch_area_id is not null
          and existing.pitch_area_id<>pitch_area_value
        )
    ) then raise exception 'The team already has another booking for one or more requested dates' using errcode='23P01'; end if;

    if exists(
      select 1 from public.annual_planner_blackouts blackout
      where blackout.club_id=request_row.club_id
        and (blackout.venue_id is null or venue_value is null or blackout.venue_id=venue_value)
        and (blackout.pitch_id is null or pitch_value is null or blackout.pitch_id=pitch_value)
        and tstzrange(blackout.start_at,blackout.end_at,'[)') && tstzrange(occurrence_start,occurrence_end,'[)')
    ) then raise exception 'The approved facility is unavailable for one or more requested dates' using errcode='23P01'; end if;

    insert into public.annual_planner_bookings(
      club_id,series_id,title,booking_type,status,team_key,team_name,opponent_name,
      venue_id,venue_name,pitch_id,pitch_name,pitch_area_id,pitch_area_name,start_at,end_at,recurrence,recurrence_until,
      cost_pence,supplier_reference,booking_reference,contact_name,contact_email,notes,
      source_type,source_id,exception_dates,holiday_policy,finance_status,approved_by,approved_at,created_by,updated_by
    ) values(
      request_row.club_id,case when request_row.recurrence='none' then null else series_key end,request_row.title,
      case when request_row.request_type='friendly' then 'friendly' when request_row.request_type in ('camp','tournament') then request_row.request_type else 'training' end,
      'confirmed',request_row.team_key,request_row.team_name,request_row.opponent_name,
      venue_value,venue_name_value,pitch_value,pitch_name_value,pitch_area_value,pitch_area_name_value,occurrence_start,occurrence_end,
      request_row.recurrence,request_row.recurrence_until,0,null,null,coach_name,coach_email,request_row.coach_notes,
      'coach_request',request_row.id::text,request_row.exception_dates,request_row.holiday_policy,'unreconciled',actor_id,now(),actor_id,actor_id
    ) returning id into next_booking_id;

    if first_booking_id is null then first_booking_id:=next_booking_id; end if;
    perform public.record_audit_event(request_row.club_id,'annual_planner.booking.created_from_coach_request',
      'annual_planner_booking',next_booking_id::text,
      jsonb_build_object('coach_request_id',request_row.id,'series_id',series_key,'occurrence',occurrence_count,'pitch_area_id',pitch_area_value));
    exit when request_row.recurrence='none';
    occurrence_start:=occurrence_start+interval_step;
    occurrence_end:=occurrence_end+interval_step;
  end loop;
  return first_booking_id;
end;
$$;


revoke all on function private.pitch_area_slot_available(uuid,text,text,timestamptz,timestamptz,text,uuid) from public,anon,authenticated;
revoke all on function public.check_coach_hub_request_availability(uuid,jsonb) from public,anon;
grant execute on function public.check_coach_hub_request_availability(uuid,jsonb) to authenticated;
revoke all on function public.save_annual_planner_booking(uuid,jsonb) from public,anon;
grant execute on function public.save_annual_planner_booking(uuid,jsonb) to authenticated;

comment on function public.check_coach_hub_request_availability(uuid,jsonb) is 'v3.10.5.2 area-aware availability: different named areas may host split training sessions, including for the same team.';
comment on function public.save_annual_planner_booking(uuid,jsonb) is 'v3.10.5.2 area-aware save: same-team split training is allowed only on different named areas of the same pitch.';

notify pgrst, 'reload schema';
commit;
