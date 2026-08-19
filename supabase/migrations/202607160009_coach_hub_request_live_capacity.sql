-- Daxora Ground Control v3.10.4
-- Coach request editing, selectable pitches, training-slot capacity and live conversation support.
begin;

create or replace function private.pitch_training_capacity(target_club_id uuid,target_pitch_id text)
returns integer
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select greatest(1,least(20,coalesce((
    select case
      when coalesce(pitch.data->>'trainingCapacity',pitch.data->>'training_capacity',pitch.data->>'maxSimultaneousTraining',pitch.data->>'max_simultaneous_training','') ~ '^[0-9]+$'
      then coalesce(pitch.data->>'trainingCapacity',pitch.data->>'training_capacity',pitch.data->>'maxSimultaneousTraining',pitch.data->>'max_simultaneous_training')::integer
      else 1
    end
    from public.pitches pitch
    where pitch.club_id=target_club_id and pitch.id=target_pitch_id
    limit 1
  ),1)));
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

create or replace function public.get_coach_hub_workspace(target_club_id uuid,range_start date default null,range_end date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare coach_person_id uuid:=private.current_coach_person_id(target_club_id); start_boundary timestamptz:=coalesce(range_start,current_date-interval '30 days'); end_boundary timestamptz:=coalesce(range_end,current_date+interval '400 days')+interval '1 day';
begin
  if coach_person_id is null or not public.can_access_coach_hub(target_club_id) then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  if not private.club_has_entitlement(target_club_id,'annual_planner') then raise exception 'Coach Hub is not enabled for this club' using errcode='42501'; end if;
  return jsonb_build_object(
    'club', (select jsonb_build_object('id',club.id,'name',club.name,'slug',club.slug) from public.clubs club where club.id=target_club_id),
    'person', (select to_jsonb(person)-'identity_key' from public.coach_hub_people person where person.id=coach_person_id),
    'assignments', coalesce((select jsonb_agg(to_jsonb(assignment) order by assignment.team_name,assignment.staff_role) from public.coach_hub_team_assignments assignment where assignment.person_id=coach_person_id and assignment.status='active'),'[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(to_jsonb(booking)-'cost_pence'-'supplier_reference'-'admin_notes' order by booking.start_at) from public.annual_planner_bookings booking where booking.club_id=target_club_id and booking.team_key in (select assignment.team_key from public.coach_hub_team_assignments assignment where assignment.person_id=coach_person_id and assignment.status='active') and booking.start_at>=start_boundary and booking.start_at<end_boundary and booking.status not in ('cancelled','rejected')),'[]'::jsonb),
    'requests', coalesce((select jsonb_agg(to_jsonb(request_row)-'admin_notes' order by request_row.created_at desc) from public.coach_hub_requests request_row where request_row.person_id=coach_person_id and request_row.club_id=target_club_id),'[]'::jsonb),
    'messages', coalesce((select jsonb_agg((to_jsonb(message_row)||jsonb_build_object('read_at',receipt.read_at,'acknowledged_at',receipt.acknowledged_at)) order by message_row.created_at desc) from public.coach_hub_messages message_row left join public.coach_hub_message_receipts receipt on receipt.message_id=message_row.id and receipt.user_id=auth.uid() where message_row.club_id=target_club_id and (message_row.person_id=coach_person_id or (message_row.person_id is null and (message_row.team_key is null or message_row.team_key in (select assignment.team_key from public.coach_hub_team_assignments assignment where assignment.person_id=coach_person_id and assignment.status='active')))) and (message_row.expires_at is null or message_row.expires_at>now())),'[]'::jsonb),
    'pitches', coalesce((select jsonb_agg(pitch.data || jsonb_build_object('id',pitch.id,'trainingCapacity',private.pitch_training_capacity(target_club_id,pitch.id)) order by coalesce(pitch.data->>'label',pitch.id)) from public.pitches pitch where pitch.club_id=target_club_id),'[]'::jsonb),
    'team_contacts', coalesce((select jsonb_agg(jsonb_build_object('team_key',contact.team_key,'team_name',contact.team_name,'coach_name',contact.coach_name,'coach_email',contact.coach_email,'coach_phone',contact.coach_phone,'assistant_name',case when contact.assistant_enabled then contact.assistant_name else '' end,'assistant_email',case when contact.assistant_enabled then contact.assistant_email else '' end,'assistant_phone',case when contact.assistant_enabled then contact.assistant_phone else '' end) order by contact.team_name) from public.team_contacts contact where contact.club_id=target_club_id and contact.team_key in (select assignment.team_key from public.coach_hub_team_assignments assignment where assignment.person_id=coach_person_id and assignment.status='active' and assignment.can_view_team_contacts)),'[]'::jsonb)
  );
end;
$$;

create or replace function public.submit_coach_hub_request(target_club_id uuid,request_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare coach_person_id uuid:=private.current_coach_person_id(target_club_id); assignment public.coach_hub_team_assignments%rowtype; target_booking public.annual_planner_bookings%rowtype; result public.coach_hub_requests%rowtype; request_type_value text:=lower(trim(coalesce(request_data->>'request_type','training'))); target_booking_id_value uuid:=nullif(request_data->>'target_booking_id','')::uuid; start_value timestamptz:=(request_data->>'preferred_start_at')::timestamptz; end_value timestamptz:=(request_data->>'preferred_end_at')::timestamptz; conflicts jsonb:='[]'::jsonb;
begin
  if coach_person_id is null then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  select * into assignment from public.coach_hub_team_assignments where id=(request_data->>'assignment_id')::uuid and person_id=coach_person_id and club_id=target_club_id and status='active';
  if assignment.id is null then raise exception 'Choose one of your assigned teams' using errcode='42501'; end if;
  if request_type_value='friendly' and not assignment.can_request_friendlies then raise exception 'Friendly requests are not enabled for this team role' using errcode='42501'; end if;
  if request_type_value in ('training','camp','tournament') and not assignment.can_request_training then raise exception 'Training requests are not enabled for this team role' using errcode='42501'; end if;
  if request_type_value in ('change','cancellation') and not assignment.can_request_changes then raise exception 'Booking change requests are not enabled for this team role' using errcode='42501'; end if;
  if request_type_value in ('change','cancellation') then
    select * into target_booking from public.annual_planner_bookings booking
    where booking.id=target_booking_id_value and booking.club_id=target_club_id and booking.team_key=assignment.team_key and booking.status in ('requested','provisional','confirmed');
    if target_booking.id is null then raise exception 'Choose an active booking for this team' using errcode='22023'; end if;
  end if;
  if end_value<=start_value then raise exception 'Request finish time must be after the start time' using errcode='22023'; end if;
  select coalesce(jsonb_agg(conflict), '[]'::jsonb) into conflicts from (
    select jsonb_build_object('type','pitch_conflict','message',case when request_type_value='training' then 'The preferred pitch has reached its simultaneous training capacity' else 'The preferred pitch is already booked' end,'capacity',private.pitch_training_capacity(target_club_id,nullif(request_data->>'preferred_pitch_id',''))) conflict
    where nullif(request_data->>'preferred_pitch_id','') is not null
      and not private.pitch_slot_available(target_club_id,nullif(request_data->>'preferred_pitch_id',''),start_value,end_value,case when request_type_value in ('training','camp','tournament') then 'training' when request_type_value='friendly' then 'friendly' else coalesce(target_booking.booking_type,'training') end,target_booking_id_value)
    union all
    select jsonb_build_object('type','team_conflict','message','Your team already has another booking at this time','booking_id',booking.id)
    from public.annual_planner_bookings booking where booking.club_id=target_club_id and booking.status in ('requested','provisional','confirmed') and booking.team_key=assignment.team_key and booking.start_at<end_value and booking.end_at>start_value and booking.id is distinct from target_booking_id_value
    union all
    select jsonb_build_object('type','blackout','message','The preferred facility is unavailable at this time','blackout_id',blackout.id)
    from public.annual_planner_blackouts blackout where blackout.club_id=target_club_id and blackout.start_at<end_value and blackout.end_at>start_value and (blackout.pitch_id is null or blackout.pitch_id=nullif(request_data->>'preferred_pitch_id',''))
  ) conflicts_query;
  if jsonb_array_length(conflicts)>0 and coalesce((request_data->>'allow_advisory_submission')::boolean,false)=false then raise exception 'The requested slot has a facility or team conflict' using errcode='23P01',detail=conflicts::text; end if;
  insert into public.coach_hub_requests(club_id,person_id,assignment_id,target_booking_id,request_type,status,title,team_key,team_name,opponent_name,format,preferred_venue_id,preferred_venue_name,preferred_pitch_id,preferred_pitch_name,preferred_start_at,preferred_end_at,recurrence,recurrence_until,exception_dates,holiday_policy,estimated_attendance,referee_required,changing_rooms_required,coach_notes,conflict_summary)
  values(target_club_id,coach_person_id,assignment.id,target_booking_id_value,request_type_value,'submitted',left(trim(coalesce(request_data->>'title',initcap(request_type_value)||' request')),240),assignment.team_key,assignment.team_name,nullif(trim(request_data->>'opponent_name'),''),nullif(trim(request_data->>'format'),''),nullif(request_data->>'preferred_venue_id',''),nullif(request_data->>'preferred_venue_name',''),nullif(request_data->>'preferred_pitch_id',''),nullif(request_data->>'preferred_pitch_name',''),start_value,end_value,coalesce(nullif(request_data->>'recurrence',''),'none'),nullif(request_data->>'recurrence_until','')::date,coalesce(array(select value::date from jsonb_array_elements_text(coalesce(request_data->'exception_dates','[]'::jsonb)) as exception_row(value) where value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),'{}'::date[]),case lower(trim(coalesce(request_data->>'holiday_policy','include'))) when 'exclude' then 'exclude' when 'custom' then 'custom' else 'include' end,nullif(request_data->>'estimated_attendance','')::integer,coalesce((request_data->>'referee_required')::boolean,false),coalesce((request_data->>'changing_rooms_required')::boolean,false),nullif(request_data->>'coach_notes',''),conflicts)
  returning * into result;
  insert into public.coach_hub_messages(club_id,person_id,team_key,message_type,title,body,related_type,related_id,created_by)
  values(target_club_id,coach_person_id,assignment.team_key,'information','Request submitted','Your '||replace(request_type_value,'_',' ')||' request for '||to_char(start_value,'Dy DD Mon at HH24:MI')||' has been sent to the club scheduler.','coach_request',result.id::text,auth.uid());
  perform private.record_coach_hub_audit_event(target_club_id,'coach_hub.request.submitted','coach_hub_request',result.id::text,jsonb_build_object('team_key',assignment.team_key,'request_type',request_type_value,'conflicts',jsonb_array_length(conflicts)));
  return to_jsonb(result)-'admin_notes';
end;
$$;

create or replace function public.update_my_coach_hub_request(target_club_id uuid,target_request_id uuid,request_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  coach_person_id uuid:=private.current_coach_person_id(target_club_id);
  current_request public.coach_hub_requests%rowtype;
  assignment public.coach_hub_team_assignments%rowtype;
  target_booking public.annual_planner_bookings%rowtype;
  result public.coach_hub_requests%rowtype;
  request_type_value text:=lower(trim(coalesce(request_data->>'request_type','training')));
  target_booking_id_value uuid:=nullif(request_data->>'target_booking_id','')::uuid;
  start_value timestamptz:=(request_data->>'preferred_start_at')::timestamptz;
  end_value timestamptz:=(request_data->>'preferred_end_at')::timestamptz;
  conflicts jsonb:='[]'::jsonb;
begin
  if coach_person_id is null then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  select * into current_request from public.coach_hub_requests request_row where request_row.id=target_request_id and request_row.club_id=target_club_id and request_row.person_id=coach_person_id for update;
  if current_request.id is null then raise exception 'Coach request not found' using errcode='P0002'; end if;
  if current_request.status not in ('submitted','needs_information') then raise exception 'This request can no longer be edited' using errcode='42501'; end if;
  select * into assignment from public.coach_hub_team_assignments assignment_row where assignment_row.id=(request_data->>'assignment_id')::uuid and assignment_row.person_id=coach_person_id and assignment_row.club_id=target_club_id and assignment_row.status='active';
  if assignment.id is null then raise exception 'Choose one of your assigned teams' using errcode='42501'; end if;
  if request_type_value='friendly' and not assignment.can_request_friendlies then raise exception 'Friendly requests are not enabled for this team role' using errcode='42501'; end if;
  if request_type_value in ('training','camp','tournament') and not assignment.can_request_training then raise exception 'Training requests are not enabled for this team role' using errcode='42501'; end if;
  if request_type_value in ('change','cancellation') and not assignment.can_request_changes then raise exception 'Booking change requests are not enabled for this team role' using errcode='42501'; end if;
  if request_type_value in ('change','cancellation') then
    select * into target_booking from public.annual_planner_bookings booking where booking.id=target_booking_id_value and booking.club_id=target_club_id and booking.team_key=assignment.team_key and booking.status in ('requested','provisional','confirmed');
    if target_booking.id is null then raise exception 'Choose an active booking for this team' using errcode='22023'; end if;
  end if;
  if end_value<=start_value then raise exception 'Request finish time must be after the start time' using errcode='22023'; end if;
  select coalesce(jsonb_agg(conflict),'[]'::jsonb) into conflicts from (
    select jsonb_build_object('type','pitch_conflict','message',case when request_type_value='training' then 'The preferred pitch has reached its simultaneous training capacity' else 'The preferred pitch is already booked' end,'capacity',private.pitch_training_capacity(target_club_id,nullif(request_data->>'preferred_pitch_id',''))) conflict
    where nullif(request_data->>'preferred_pitch_id','') is not null and not private.pitch_slot_available(target_club_id,nullif(request_data->>'preferred_pitch_id',''),start_value,end_value,case when request_type_value in ('training','camp','tournament') then 'training' when request_type_value='friendly' then 'friendly' else coalesce(target_booking.booking_type,'training') end,target_booking_id_value)
    union all
    select jsonb_build_object('type','team_conflict','message','Your team already has another booking at this time','booking_id',booking.id) from public.annual_planner_bookings booking where booking.club_id=target_club_id and booking.status in ('requested','provisional','confirmed') and booking.team_key=assignment.team_key and booking.start_at<end_value and booking.end_at>start_value and booking.id is distinct from target_booking_id_value
    union all
    select jsonb_build_object('type','blackout','message','The preferred facility is unavailable at this time','blackout_id',blackout.id) from public.annual_planner_blackouts blackout where blackout.club_id=target_club_id and blackout.start_at<end_value and blackout.end_at>start_value and (blackout.pitch_id is null or blackout.pitch_id=nullif(request_data->>'preferred_pitch_id',''))
  ) conflict_rows;
  if jsonb_array_length(conflicts)>0 and coalesce((request_data->>'allow_advisory_submission')::boolean,false)=false then raise exception 'The requested slot has a facility or team conflict' using errcode='23P01',detail=conflicts::text; end if;
  update public.coach_hub_requests set
    assignment_id=assignment.id,target_booking_id=target_booking_id_value,request_type=request_type_value,status='submitted',title=left(trim(coalesce(request_data->>'title',initcap(request_type_value)||' request')),240),team_key=assignment.team_key,team_name=assignment.team_name,opponent_name=nullif(trim(request_data->>'opponent_name'),''),format=nullif(trim(request_data->>'format'),''),preferred_venue_id=nullif(request_data->>'preferred_venue_id',''),preferred_venue_name=nullif(request_data->>'preferred_venue_name',''),preferred_pitch_id=nullif(request_data->>'preferred_pitch_id',''),preferred_pitch_name=nullif(request_data->>'preferred_pitch_name',''),preferred_start_at=start_value,preferred_end_at=end_value,recurrence=coalesce(nullif(request_data->>'recurrence',''),'none'),recurrence_until=nullif(request_data->>'recurrence_until','')::date,exception_dates=coalesce(array(select value::date from jsonb_array_elements_text(coalesce(request_data->'exception_dates','[]'::jsonb)) as exception_row(value) where value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),'{}'::date[]),holiday_policy=case lower(trim(coalesce(request_data->>'holiday_policy','include'))) when 'exclude' then 'exclude' when 'custom' then 'custom' else 'include' end,estimated_attendance=nullif(request_data->>'estimated_attendance','')::integer,referee_required=coalesce((request_data->>'referee_required')::boolean,false),changing_rooms_required=coalesce((request_data->>'changing_rooms_required')::boolean,false),coach_notes=nullif(request_data->>'coach_notes',''),conflict_summary=conflicts,proposed_venue_id=null,proposed_venue_name=null,proposed_pitch_id=null,proposed_pitch_name=null,proposed_start_at=null,proposed_end_at=null,proposed_message=null,reviewed_by=null,reviewed_at=null,updated_at=now()
  where id=current_request.id returning * into result;
  insert into public.coach_hub_request_messages(club_id,request_id,person_id,author_user_id,author_role,author_name,body,read_by_coach_at)
  values(target_club_id,result.id,coach_person_id,auth.uid(),'coach',coalesce((select display_name from public.coach_hub_people where id=coach_person_id),'Coach'),'Request details updated',now());
  perform private.record_coach_hub_audit_event(target_club_id,'coach_hub.request.updated','coach_hub_request',result.id::text,jsonb_build_object('team_key',assignment.team_key,'request_type',request_type_value,'conflicts',jsonb_array_length(conflicts)));
  return to_jsonb(result)-'admin_notes';
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
    if not private.pitch_slot_available(target_club_id,next_pitch_id,next_start,next_end,next_booking_type,target_id) then
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
      venue_id,venue_name,pitch_id,pitch_name,start_at,end_at,recurrence,recurrence_until,exception_dates,holiday_policy,
      cost_pence,supplier_reference,booking_reference,contact_name,contact_email,notes,finance_status,finance_reference,
      source_type,source_id,requested_by,approved_by,approved_at,created_by,updated_by
    ) values (
      target_club_id,nullif(booking_data->>'series_id',''),trim(booking_data->>'title'),
      coalesce(nullif(lower(trim(booking_data->>'booking_type')),''),'training'),next_status,
      nullif(booking_data->>'team_key',''),nullif(booking_data->>'team_name',''),nullif(booking_data->>'opponent_name',''),
      nullif(booking_data->>'venue_id',''),nullif(booking_data->>'venue_name',''),next_pitch_id,nullif(booking_data->>'pitch_name',''),
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
      pitch_name = nullif(booking_data->>'pitch_name',''), start_at = next_start,
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
    jsonb_build_object('title',result.title,'status',result.status,'start_at',result.start_at,'pitch_id',result.pitch_id));
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
        if not private.pitch_slot_available(request_row.club_id,pitch_value,start_value,end_value,target_booking.booking_type,target_booking.id) then raise exception 'The alternative pitch has reached capacity at this time' using errcode='23P01'; end if;
      end if;
      perform pg_advisory_xact_lock(hashtext(request_row.club_id::text||':team:'||target_booking.team_key));
      if exists(
        select 1 from public.annual_planner_bookings existing
        where existing.club_id=request_row.club_id
          and existing.id is distinct from target_booking.id
          and existing.team_key=target_booking.team_key
          and existing.status in ('requested','provisional','confirmed')
          and tstzrange(existing.start_at,existing.end_at,'[)') && tstzrange(start_value,end_value,'[)')
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
      jsonb_build_object('coach_request_id',request_row.id,'start_at',start_value,'pitch_id',pitch_value));
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
      if not private.pitch_slot_available(request_row.club_id,pitch_value,occurrence_start,occurrence_end,booking_type_value,null) then raise exception 'The approved pitch has reached capacity for one or more requested dates' using errcode='23P01'; end if;
    end if;

    perform pg_advisory_xact_lock(hashtext(request_row.club_id::text||':team:'||request_row.team_key));
    if exists(
      select 1 from public.annual_planner_bookings existing
      where existing.club_id=request_row.club_id
        and existing.team_key=request_row.team_key
        and existing.status in ('requested','provisional','confirmed')
        and tstzrange(existing.start_at,existing.end_at,'[)') && tstzrange(occurrence_start,occurrence_end,'[)')
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
      venue_id,venue_name,pitch_id,pitch_name,start_at,end_at,recurrence,recurrence_until,
      cost_pence,supplier_reference,booking_reference,contact_name,contact_email,notes,
      source_type,source_id,exception_dates,holiday_policy,finance_status,approved_by,approved_at,created_by,updated_by
    ) values(
      request_row.club_id,case when request_row.recurrence='none' then null else series_key end,request_row.title,
      case when request_row.request_type='friendly' then 'friendly' when request_row.request_type in ('camp','tournament') then request_row.request_type else 'training' end,
      'confirmed',request_row.team_key,request_row.team_name,request_row.opponent_name,
      venue_value,venue_name_value,pitch_value,pitch_name_value,occurrence_start,occurrence_end,
      request_row.recurrence,request_row.recurrence_until,0,null,null,coach_name,coach_email,request_row.coach_notes,
      'coach_request',request_row.id::text,request_row.exception_dates,request_row.holiday_policy,'unreconciled',actor_id,now(),actor_id,actor_id
    ) returning id into next_booking_id;

    if first_booking_id is null then first_booking_id:=next_booking_id; end if;
    perform public.record_audit_event(request_row.club_id,'annual_planner.booking.created_from_coach_request',
      'annual_planner_booking',next_booking_id::text,
      jsonb_build_object('coach_request_id',request_row.id,'series_id',series_key,'occurrence',occurrence_count));
    exit when request_row.recurrence='none';
    occurrence_start:=occurrence_start+interval_step;
    occurrence_end:=occurrence_end+interval_step;
  end loop;
  return first_booking_id;
end;
$$;

revoke all on function public.update_my_coach_hub_request(uuid,uuid,jsonb) from public,anon;
grant execute on function public.update_my_coach_hub_request(uuid,uuid,jsonb) to authenticated;
revoke all on function private.pitch_training_capacity(uuid,text),private.pitch_slot_available(uuid,text,timestamptz,timestamptz,text,uuid) from public,anon,authenticated;
notify pgrst, 'reload schema';
commit;
