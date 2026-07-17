-- Daxora Ground Control v3.10.5.3
-- Prevents jumpy Annual Planner shadow refreshes and makes Coach Hub request submission
-- use the same named pitch-area rules as live availability and booking approval.
begin;

create or replace function public.submit_coach_hub_request(target_club_id uuid,request_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  coach_person_id uuid:=private.current_coach_person_id(target_club_id);
  assignment public.coach_hub_team_assignments%rowtype;
  target_booking public.annual_planner_bookings%rowtype;
  result public.coach_hub_requests%rowtype;
  request_type_value text:=lower(trim(coalesce(request_data->>'request_type','training')));
  target_booking_id_value uuid:=nullif(request_data->>'target_booking_id','')::uuid;
  start_value timestamptz:=(request_data->>'preferred_start_at')::timestamptz;
  end_value timestamptz:=(request_data->>'preferred_end_at')::timestamptz;
  pitch_value text:=nullif(request_data->>'preferred_pitch_id','');
  area_value text:=nullif(request_data->>'preferred_pitch_area_id','');
  booking_type_value text;
  conflicts jsonb:='[]'::jsonb;
begin
  if coach_person_id is null then raise exception 'Coach Hub access denied' using errcode='42501'; end if;

  select * into assignment
  from public.coach_hub_team_assignments assignment_row
  where assignment_row.id=(request_data->>'assignment_id')::uuid
    and assignment_row.person_id=coach_person_id
    and assignment_row.club_id=target_club_id
    and assignment_row.status='active';

  if assignment.id is null then raise exception 'Choose one of your assigned teams' using errcode='42501'; end if;
  if request_type_value='friendly' and not assignment.can_request_friendlies then raise exception 'Friendly requests are not enabled for this team role' using errcode='42501'; end if;
  if request_type_value in ('training','camp','tournament') and not assignment.can_request_training then raise exception 'Training requests are not enabled for this team role' using errcode='42501'; end if;
  if request_type_value in ('change','cancellation') and not assignment.can_request_changes then raise exception 'Booking change requests are not enabled for this team role' using errcode='42501'; end if;

  if request_type_value in ('change','cancellation') then
    select * into target_booking
    from public.annual_planner_bookings booking
    where booking.id=target_booking_id_value
      and booking.club_id=target_club_id
      and booking.team_key=assignment.team_key
      and booking.status in ('requested','provisional','confirmed');
    if target_booking.id is null then raise exception 'Choose an active booking for this team' using errcode='22023'; end if;
  end if;

  if end_value<=start_value then raise exception 'Request finish time must be after the start time' using errcode='22023'; end if;

  booking_type_value:=case
    when request_type_value in ('training','camp','tournament') then 'training'
    when request_type_value='friendly' then 'friendly'
    else coalesce(target_booking.booking_type,'training')
  end;

  select coalesce(jsonb_agg(conflict), '[]'::jsonb) into conflicts
  from (
    select jsonb_build_object(
      'type','pitch_conflict',
      'message',case when booking_type_value='training' then 'The preferred pitch area has reached its simultaneous training capacity' else 'The preferred pitch is already booked' end,
      'capacity',private.pitch_training_capacity(target_club_id,pitch_value),
      'pitch_area_id',area_value
    ) conflict
    where pitch_value is not null
      and not private.pitch_area_slot_available(target_club_id,pitch_value,area_value,start_value,end_value,booking_type_value,target_booking_id_value)

    union all

    select jsonb_build_object('type','team_conflict','message','Your team already has another booking at this time','booking_id',booking.id)
    from public.annual_planner_bookings booking
    where booking.club_id=target_club_id
      and booking.status in ('requested','provisional','confirmed')
      and booking.team_key=assignment.team_key
      and booking.start_at<end_value
      and booking.end_at>start_value
      and booking.id is distinct from target_booking_id_value
      and not (
        booking_type_value='training'
        and lower(coalesce(booking.booking_type,'training'))='training'
        and pitch_value is not null
        and booking.pitch_id=pitch_value
        and area_value is not null
        and booking.pitch_area_id is not null
        and booking.pitch_area_id<>area_value
      )

    union all

    select jsonb_build_object('type','blackout','message','The preferred facility is unavailable at this time','blackout_id',blackout.id)
    from public.annual_planner_blackouts blackout
    where blackout.club_id=target_club_id
      and blackout.start_at<end_value
      and blackout.end_at>start_value
      and (blackout.pitch_id is null or blackout.pitch_id=pitch_value)
  ) conflicts_query;

  if jsonb_array_length(conflicts)>0
    and coalesce((request_data->>'allow_advisory_submission')::boolean,false)=false
  then
    raise exception 'The requested slot is unavailable' using errcode='23P01',detail=conflicts::text;
  end if;

  insert into public.coach_hub_requests(
    club_id,person_id,assignment_id,target_booking_id,request_type,status,title,team_key,team_name,
    opponent_name,format,preferred_venue_id,preferred_venue_name,preferred_pitch_id,preferred_pitch_name,
    preferred_pitch_area_id,preferred_pitch_area_name,preferred_start_at,preferred_end_at,recurrence,
    recurrence_until,exception_dates,holiday_policy,estimated_attendance,referee_required,
    changing_rooms_required,coach_notes,conflict_summary
  ) values(
    target_club_id,coach_person_id,assignment.id,target_booking_id_value,request_type_value,'submitted',
    left(trim(coalesce(request_data->>'title',initcap(request_type_value)||' request')),240),
    assignment.team_key,assignment.team_name,nullif(trim(request_data->>'opponent_name'),''),
    nullif(trim(request_data->>'format'),''),nullif(request_data->>'preferred_venue_id',''),
    nullif(request_data->>'preferred_venue_name',''),pitch_value,nullif(request_data->>'preferred_pitch_name',''),
    area_value,nullif(request_data->>'preferred_pitch_area_name',''),start_value,end_value,
    coalesce(nullif(request_data->>'recurrence',''),'none'),nullif(request_data->>'recurrence_until','')::date,
    coalesce(array(
      select value::date
      from jsonb_array_elements_text(coalesce(request_data->'exception_dates','[]'::jsonb)) as exception_row(value)
      where value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    ),'{}'::date[]),
    case lower(trim(coalesce(request_data->>'holiday_policy','include'))) when 'exclude' then 'exclude' when 'custom' then 'custom' else 'include' end,
    nullif(request_data->>'estimated_attendance','')::integer,
    coalesce((request_data->>'referee_required')::boolean,false),
    coalesce((request_data->>'changing_rooms_required')::boolean,false),
    nullif(request_data->>'coach_notes',''),conflicts
  ) returning * into result;

  insert into public.coach_hub_messages(
    club_id,person_id,team_key,message_type,title,body,related_type,related_id,created_by
  ) values(
    target_club_id,coach_person_id,assignment.team_key,'information','Request submitted',
    'Your '||replace(request_type_value,'_',' ')||' request for '||to_char(start_value,'Dy DD Mon at HH24:MI')||' has been sent to the club scheduler.',
    'coach_request',result.id::text,auth.uid()
  );

  perform private.record_coach_hub_audit_event(
    target_club_id,'coach_hub.request.submitted','coach_hub_request',result.id::text,
    jsonb_build_object('team_key',assignment.team_key,'request_type',request_type_value,'conflicts',jsonb_array_length(conflicts),'pitch_area_id',area_value)
  );

  return to_jsonb(result)-'admin_notes';
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
  request_type_value text:=lower(trim(coalesce(request_data->>'request_type','training')));
  allow_advisory boolean:=coalesce((request_data->>'allow_advisory_submission')::boolean,false);
begin
  availability_value:=public.check_coach_hub_request_availability(target_club_id,request_data);

  if request_type_value not in ('change','cancellation')
    and coalesce((availability_value->>'available')::boolean,false)=false
    and allow_advisory=false
  then
    raise exception 'The requested slot is unavailable'
      using errcode='23P01',detail=coalesce((availability_value->'reasons')::text,'[]');
  end if;

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

  return (
    select to_jsonb(request_row)-'admin_notes'
    from public.coach_hub_requests request_row
    where request_row.id=request_id_value
  );
end;
$$;

revoke all on function public.submit_coach_hub_request(uuid,jsonb) from public,anon;
grant execute on function public.submit_coach_hub_request(uuid,jsonb) to authenticated;
revoke all on function public.submit_coach_hub_request_v2(uuid,jsonb) from public,anon;
grant execute on function public.submit_coach_hub_request_v2(uuid,jsonb) to authenticated;

comment on function public.submit_coach_hub_request(uuid,jsonb) is 'v3.10.5.3 area-aware request submission: separate named halves follow the same rules as availability and approval.';
comment on function public.submit_coach_hub_request_v2(uuid,jsonb) is 'v3.10.5.3 validates live availability before creating a Coach Hub request and returns clear conflict details.';

notify pgrst, 'reload schema';
commit;
