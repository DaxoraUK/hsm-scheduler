-- Daxora Ground Control v3.10.2: Coach Hub and Annual Planner pilot refinement.
begin;

alter table public.coach_hub_people
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified','verified','due','overdue','replacement_required')),
  add column if not exists verification_due_at timestamptz,
  add column if not exists replacement_requested_at timestamptz;

alter table public.coach_hub_requests
  add column if not exists exception_dates date[] not null default '{}'::date[],
  add column if not exists holiday_policy text not null default 'include'
    check (holiday_policy in ('include','exclude','custom')),
  add column if not exists last_message_at timestamptz;

alter table public.coach_hub_calendar_feeds
  add column if not exists team_key text;

alter table public.annual_planner_bookings
  add column if not exists exception_dates date[] not null default '{}'::date[],
  add column if not exists holiday_policy text not null default 'include'
    check (holiday_policy in ('include','exclude','custom')),
  add column if not exists finance_status text not null default 'unreconciled'
    check (finance_status in ('unreconciled','ready','reconciled','not_required')),
  add column if not exists finance_reference text;

create table if not exists public.coach_hub_request_messages (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  request_id uuid not null references public.coach_hub_requests(id) on delete cascade,
  person_id uuid references public.coach_hub_people(id) on delete set null,
  author_user_id uuid references auth.users(id) on delete set null,
  author_role text not null check (author_role in ('coach','club','system')),
  author_name text not null default '',
  body text not null check (length(trim(body)) between 1 and 5000),
  read_by_coach_at timestamptz,
  read_by_club_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.coach_hub_booking_reminders (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  booking_id uuid not null references public.annual_planner_bookings(id) on delete cascade,
  person_id uuid not null references public.coach_hub_people(id) on delete cascade,
  team_key text not null,
  reminder_type text not null check (reminder_type in ('48_hour','4_hour','change','cancellation')),
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','processing','delivered','failed','cancelled')),
  delivery_reference text,
  delivery_error text,
  sent_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, person_id, reminder_type)
);

create index if not exists coach_hub_request_messages_thread_idx
  on public.coach_hub_request_messages(club_id,request_id,created_at);
create index if not exists coach_hub_booking_reminders_due_idx
  on public.coach_hub_booking_reminders(status,due_at);
create index if not exists coach_hub_calendar_feeds_team_idx
  on public.coach_hub_calendar_feeds(club_id,person_id,team_key,status);

alter table public.coach_hub_request_messages enable row level security;
alter table public.coach_hub_request_messages force row level security;
alter table public.coach_hub_booking_reminders enable row level security;
alter table public.coach_hub_booking_reminders force row level security;
revoke all on table public.coach_hub_request_messages, public.coach_hub_booking_reminders from anon, authenticated;

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
    if exists (
      select 1 from public.annual_planner_bookings existing
      where existing.club_id = target_club_id
        and existing.id is distinct from target_id
        and existing.pitch_id = next_pitch_id
        and existing.status in ('requested','provisional','confirmed')
        and tstzrange(existing.start_at, existing.end_at, '[)') && tstzrange(next_start, next_end, '[)')
    ) then
      raise exception 'This pitch already has an active annual-planner booking at the selected time' using errcode = '23P01';
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


create or replace function public.submit_coach_hub_request(target_club_id uuid,request_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare person_id uuid:=private.current_coach_person_id(target_club_id); assignment public.coach_hub_team_assignments%rowtype; target_booking public.annual_planner_bookings%rowtype; result public.coach_hub_requests%rowtype; request_type_value text:=lower(trim(coalesce(request_data->>'request_type','training'))); target_booking_id_value uuid:=nullif(request_data->>'target_booking_id','')::uuid; start_value timestamptz:=(request_data->>'preferred_start_at')::timestamptz; end_value timestamptz:=(request_data->>'preferred_end_at')::timestamptz; conflicts jsonb:='[]'::jsonb;
begin
  if person_id is null then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  select * into assignment from public.coach_hub_team_assignments where id=(request_data->>'assignment_id')::uuid and person_id=person_id and club_id=target_club_id and status='active';
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
    select jsonb_build_object('type','pitch_conflict','message','The preferred pitch is already booked','booking_id',booking.id) conflict
    from public.annual_planner_bookings booking where booking.club_id=target_club_id and booking.status in ('requested','provisional','confirmed') and nullif(request_data->>'preferred_pitch_id','') is not null and booking.pitch_id=nullif(request_data->>'preferred_pitch_id','') and booking.start_at<end_value and booking.end_at>start_value and booking.id is distinct from target_booking_id_value
    union all
    select jsonb_build_object('type','team_conflict','message','Your team already has another booking at this time','booking_id',booking.id)
    from public.annual_planner_bookings booking where booking.club_id=target_club_id and booking.status in ('requested','provisional','confirmed') and booking.team_key=assignment.team_key and booking.start_at<end_value and booking.end_at>start_value and booking.id is distinct from target_booking_id_value
    union all
    select jsonb_build_object('type','blackout','message','The preferred facility is unavailable at this time','blackout_id',blackout.id)
    from public.annual_planner_blackouts blackout where blackout.club_id=target_club_id and blackout.start_at<end_value and blackout.end_at>start_value and (blackout.pitch_id is null or blackout.pitch_id=nullif(request_data->>'preferred_pitch_id',''))
  ) conflicts_query;
  if jsonb_array_length(conflicts)>0 and coalesce((request_data->>'allow_advisory_submission')::boolean,false)=false then raise exception 'The requested slot has a facility or team conflict' using errcode='23P01',detail=conflicts::text; end if;
  insert into public.coach_hub_requests(club_id,person_id,assignment_id,target_booking_id,request_type,status,title,team_key,team_name,opponent_name,format,preferred_venue_id,preferred_venue_name,preferred_pitch_id,preferred_pitch_name,preferred_start_at,preferred_end_at,recurrence,recurrence_until,exception_dates,holiday_policy,estimated_attendance,referee_required,changing_rooms_required,coach_notes,conflict_summary)
  values(target_club_id,person_id,assignment.id,target_booking_id_value,request_type_value,'submitted',left(trim(coalesce(request_data->>'title',initcap(request_type_value)||' request')),240),assignment.team_key,assignment.team_name,nullif(trim(request_data->>'opponent_name'),''),nullif(trim(request_data->>'format'),''),nullif(request_data->>'preferred_venue_id',''),nullif(request_data->>'preferred_venue_name',''),nullif(request_data->>'preferred_pitch_id',''),nullif(request_data->>'preferred_pitch_name',''),start_value,end_value,coalesce(nullif(request_data->>'recurrence',''),'none'),nullif(request_data->>'recurrence_until','')::date,coalesce(array(select value::date from jsonb_array_elements_text(coalesce(request_data->'exception_dates','[]'::jsonb)) as exception_row(value) where value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),'{}'::date[]),case lower(trim(coalesce(request_data->>'holiday_policy','include'))) when 'exclude' then 'exclude' when 'custom' then 'custom' else 'include' end,nullif(request_data->>'estimated_attendance','')::integer,coalesce((request_data->>'referee_required')::boolean,false),coalesce((request_data->>'changing_rooms_required')::boolean,false),nullif(request_data->>'coach_notes',''),conflicts)
  returning * into result;
  insert into public.coach_hub_messages(club_id,person_id,team_key,message_type,title,body,related_type,related_id,created_by)
  values(target_club_id,person_id,assignment.team_key,'information','Request submitted','Your '||replace(request_type_value,'_',' ')||' request for '||to_char(start_value,'Dy DD Mon at HH24:MI')||' has been sent to the club scheduler.','coach_request',result.id::text,auth.uid());
  perform public.record_audit_event(target_club_id,'coach_hub.request.submitted','coach_hub_request',result.id::text,jsonb_build_object('team_key',assignment.team_key,'request_type',request_type_value,'conflicts',jsonb_array_length(conflicts)));
  return to_jsonb(result)-'admin_notes';
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
        if exists(
          select 1 from public.annual_planner_bookings existing
          where existing.club_id=request_row.club_id
            and existing.id is distinct from target_booking.id
            and existing.pitch_id=pitch_value
            and existing.status in ('requested','provisional','confirmed')
            and tstzrange(existing.start_at,existing.end_at,'[)') && tstzrange(start_value,end_value,'[)')
        ) then raise exception 'The alternative pitch is already booked at this time' using errcode='23P01'; end if;
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
      if exists(
        select 1 from public.annual_planner_bookings existing
        where existing.club_id=request_row.club_id
          and existing.pitch_id=pitch_value
          and existing.status in ('requested','provisional','confirmed')
          and tstzrange(existing.start_at,existing.end_at,'[)') && tstzrange(occurrence_start,occurrence_end,'[)')
      ) then raise exception 'The approved pitch is already booked for one or more requested dates' using errcode='23P01'; end if;
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


create or replace function public.list_coach_hub_request_thread(target_club_id uuid,target_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare coach_person_id uuid:=private.current_coach_person_id(target_club_id); request_row public.coach_hub_requests%rowtype; club_operator boolean:=public.can_operate_club(target_club_id);
begin
  select * into request_row from public.coach_hub_requests where id=target_request_id and club_id=target_club_id;
  if request_row.id is null then raise exception 'Coach request not found' using errcode='P0002'; end if;
  if not club_operator and (coach_person_id is null or request_row.person_id<>coach_person_id) then raise exception 'Request conversation access denied' using errcode='42501'; end if;
  if club_operator then
    update public.coach_hub_request_messages set read_by_club_at=coalesce(read_by_club_at,now()) where club_id=target_club_id and request_id=target_request_id and author_role='coach';
  else
    update public.coach_hub_request_messages set read_by_coach_at=coalesce(read_by_coach_at,now()) where club_id=target_club_id and request_id=target_request_id and author_role in ('club','system');
  end if;
  return jsonb_build_object(
    'request', case when club_operator then to_jsonb(request_row) else to_jsonb(request_row)-'admin_notes' end,
    'messages', coalesce((select jsonb_agg(to_jsonb(message_row)||jsonb_build_object('read_at',case when club_operator then message_row.read_by_club_at else message_row.read_by_coach_at end) order by message_row.created_at) from public.coach_hub_request_messages message_row where message_row.club_id=target_club_id and message_row.request_id=target_request_id),'[]'::jsonb)
  );
end;
$$;

create or replace function public.post_coach_hub_request_message(target_club_id uuid,target_request_id uuid,message_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare coach_person_id uuid:=private.current_coach_person_id(target_club_id); request_row public.coach_hub_requests%rowtype; club_operator boolean:=public.can_operate_club(target_club_id); role_value text; name_value text; result public.coach_hub_request_messages%rowtype;
begin
  if length(trim(coalesce(message_body,''))) not between 1 and 5000 then raise exception 'Write a message between 1 and 5000 characters' using errcode='22023'; end if;
  select * into request_row from public.coach_hub_requests where id=target_request_id and club_id=target_club_id for update;
  if request_row.id is null then raise exception 'Coach request not found' using errcode='P0002'; end if;
  if club_operator then
    role_value:='club';
    select coalesce(nullif(raw_user_meta_data->>'display_name',''),nullif(raw_user_meta_data->>'full_name',''),email,'Club operator') into name_value from auth.users where id=auth.uid();
  elsif coach_person_id is not null and request_row.person_id=coach_person_id then
    role_value:='coach';
    select display_name into name_value from public.coach_hub_people where id=coach_person_id;
  else raise exception 'Request conversation access denied' using errcode='42501'; end if;
  insert into public.coach_hub_request_messages(club_id,request_id,person_id,author_user_id,author_role,author_name,body,read_by_coach_at,read_by_club_at)
  values(target_club_id,target_request_id,request_row.person_id,auth.uid(),role_value,coalesce(name_value,initcap(role_value)),trim(message_body),case when role_value='coach' then now() else null end,case when role_value='club' then now() else null end)
  returning * into result;
  update public.coach_hub_requests set last_message_at=now(),updated_at=now() where id=target_request_id;
  if role_value='club' then
    insert into public.coach_hub_messages(club_id,person_id,team_key,message_type,title,body,related_type,related_id,requires_acknowledgement,created_by)
    values(target_club_id,request_row.person_id,request_row.team_key,'direct_reply','New reply about your request',trim(message_body),'coach_request',target_request_id::text,false,auth.uid());
  end if;
  perform public.record_audit_event(target_club_id,'coach_hub.request.message_posted','coach_hub_request',target_request_id::text,jsonb_build_object('author_role',role_value));
  return to_jsonb(result)||jsonb_build_object('read_at',now());
end;
$$;

create or replace function public.mark_coach_hub_message(target_club_id uuid,target_message_id uuid,acknowledge boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare coach_person_id uuid:=private.current_coach_person_id(target_club_id); message_row public.coach_hub_messages%rowtype;
begin
  if coach_person_id is null then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  select message.* into message_row from public.coach_hub_messages message
  where message.id=target_message_id and message.club_id=target_club_id and (message.person_id=coach_person_id or message.person_id is null);
  if message_row.id is null then raise exception 'Message not found' using errcode='P0002'; end if;
  insert into public.coach_hub_message_receipts(message_id,user_id,read_at,acknowledged_at)
  values(message_row.id,auth.uid(),now(),case when acknowledge then now() else null end)
  on conflict(message_id,user_id) do update set read_at=coalesce(public.coach_hub_message_receipts.read_at,now()),acknowledged_at=case when acknowledge then now() else public.coach_hub_message_receipts.acknowledged_at end,updated_at=now();
  if acknowledge and message_row.related_type='coach_hub_reminder' then
    update public.coach_hub_booking_reminders set acknowledged_at=coalesce(acknowledged_at,now()),updated_at=now() where id=nullif(message_row.related_id,'')::uuid and person_id=coach_person_id;
  end if;
  return jsonb_build_object('message_id',message_row.id,'read_at',now(),'acknowledged',acknowledge);
end;
$$;

create or replace function public.verify_my_coach_hub_contact(target_club_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare person_id uuid:=private.current_coach_person_id(target_club_id); result public.coach_hub_people%rowtype;
begin
  if person_id is null then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  update public.coach_hub_people set verification_status='verified',last_verified_at=now(),verification_due_at=now()+interval '180 days',replacement_requested_at=null,updated_at=now() where id=person_id returning * into result;
  update public.team_contacts contact set last_verified_at=now(),updated_at=now()
  from public.coach_hub_team_assignments assignment where assignment.person_id=person_id and assignment.club_id=contact.club_id and assignment.team_key=contact.team_key and contact.club_id=target_club_id;
  perform public.record_audit_event(target_club_id,'coach_hub.contact.verified','coach_hub_person',person_id::text,jsonb_build_object('next_due_at',result.verification_due_at));
  return to_jsonb(result)-'identity_key';
end;
$$;

create or replace function public.replace_coach_hub_contact(target_club_id uuid,target_person_id uuid,replacement_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare actor_id uuid:=auth.uid(); result public.coach_hub_people%rowtype; next_email text:=lower(trim(coalesce(replacement_data->>'email',''))); next_name text:=left(trim(coalesce(replacement_data->>'display_name','')),160); next_mobile text:=left(trim(coalesce(replacement_data->>'mobile','')),40);
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then raise exception 'Club administrator access required' using errcode='42501'; end if;
  if next_email<>'' and next_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Enter a valid replacement email address' using errcode='22023'; end if;
  update public.coach_hub_people set display_name=coalesce(nullif(next_name,''),display_name),email=next_email,mobile=next_mobile,user_id=null,status='active',verification_status='replacement_required',replacement_requested_at=now(),verification_due_at=null,updated_at=now() where id=target_person_id and club_id=target_club_id returning * into result;
  if result.id is null then raise exception 'Coach contact not found' using errcode='P0002'; end if;
  update public.coach_hub_invitations set status='revoked',revoked_at=now(),updated_at=now() where club_id=target_club_id and person_id=target_person_id and status='pending';
  update public.coach_hub_calendar_feeds set status='revoked',revoked_at=now() where club_id=target_club_id and person_id=target_person_id and status='active';
  update public.team_contacts contact set
    coach_name=case when assignment.source_slot='coach' then result.display_name else contact.coach_name end,
    coach_email=case when assignment.source_slot='coach' then result.email else contact.coach_email end,
    coach_phone=case when assignment.source_slot='coach' then result.mobile else contact.coach_phone end,
    assistant_name=case when assignment.source_slot='assistant' then result.display_name else contact.assistant_name end,
    assistant_email=case when assignment.source_slot='assistant' then result.email else contact.assistant_email end,
    assistant_phone=case when assignment.source_slot='assistant' then result.mobile else contact.assistant_phone end,
    updated_at=now()
  from public.coach_hub_team_assignments assignment where assignment.person_id=result.id and assignment.club_id=contact.club_id and assignment.team_key=contact.team_key and contact.club_id=target_club_id;
  perform public.record_audit_event(target_club_id,'coach_hub.contact.replaced','coach_hub_person',target_person_id::text,jsonb_build_object('email',next_email));
  return to_jsonb(result)-'identity_key';
end;
$$;

create or replace function public.create_coach_hub_team_calendar_feed(target_club_id uuid,team_key_value text,label_value text default 'My team calendar')
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare person_id uuid:=private.current_coach_person_id(target_club_id); raw_token text:=encode(gen_random_bytes(32),'hex'); feed_id uuid; safe_team_key text:=nullif(trim(coalesce(team_key_value,'')),'');
begin
  if person_id is null then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  if safe_team_key is not null and not exists(select 1 from public.coach_hub_team_assignments assignment where assignment.club_id=target_club_id and assignment.person_id=person_id and assignment.team_key=safe_team_key and assignment.status='active') then raise exception 'Team calendar access denied' using errcode='42501'; end if;
  update public.coach_hub_calendar_feeds set status='revoked',revoked_at=now() where club_id=target_club_id and person_id=person_id and coalesce(team_key,'')=coalesce(safe_team_key,'') and status='active';
  insert into public.coach_hub_calendar_feeds(club_id,person_id,team_key,token_hash,label) values(target_club_id,person_id,safe_team_key,encode(digest(raw_token,'sha256'),'hex'),left(trim(coalesce(label_value,'My team calendar')),120)) returning id into feed_id;
  return jsonb_build_object('id',feed_id,'token',raw_token,'team_key',safe_team_key,'label',label_value);
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
        and booking.status in ('provisional','confirmed') and booking.end_at>now()-interval '30 days'),'[]'::jsonb)
  );
end;
$$;

create or replace function public.list_coach_hub_pilot_metrics(target_club_id uuid,range_start date default null,range_end date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare start_boundary timestamptz:=coalesce(range_start,date_trunc('year',current_date)::date)::timestamptz; end_boundary timestamptz:=(coalesce(range_end,(date_trunc('year',current_date)+interval '1 year-1 day')::date)+1)::timestamptz;
begin
  if auth.uid() is null or not public.can_operate_club(target_club_id) then raise exception 'Club operator access required' using errcode='42501'; end if;
  return jsonb_build_object(
    'people',coalesce((select jsonb_agg(to_jsonb(person)-'identity_key') from public.coach_hub_people person where person.club_id=target_club_id and person.status<>'inactive'),'[]'::jsonb),
    'assignments',coalesce((select jsonb_agg(to_jsonb(assignment)) from public.coach_hub_team_assignments assignment where assignment.club_id=target_club_id and assignment.status='active'),'[]'::jsonb),
    'invitations',coalesce((select jsonb_agg(to_jsonb(invitation)-'token_hash') from public.coach_hub_invitations invitation where invitation.club_id=target_club_id and invitation.created_at>=start_boundary),'[]'::jsonb),
    'requests',coalesce((select jsonb_agg(to_jsonb(request_row)) from public.coach_hub_requests request_row where request_row.club_id=target_club_id and request_row.created_at>=start_boundary and request_row.created_at<end_boundary),'[]'::jsonb),
    'messages',coalesce((select jsonb_agg(to_jsonb(message_row)||jsonb_build_object('acknowledged_at',receipt.acknowledged_at)) from public.coach_hub_messages message_row left join public.coach_hub_message_receipts receipt on receipt.message_id=message_row.id where message_row.club_id=target_club_id and message_row.created_at>=start_boundary and message_row.created_at<end_boundary),'[]'::jsonb),
    'reminders',coalesce((select jsonb_agg(to_jsonb(reminder)) from public.coach_hub_booking_reminders reminder where reminder.club_id=target_club_id and reminder.created_at>=start_boundary and reminder.created_at<end_boundary),'[]'::jsonb),
    'bookings',coalesce((select jsonb_agg(to_jsonb(booking)) from public.annual_planner_bookings booking where booking.club_id=target_club_id and booking.start_at>=start_boundary and booking.start_at<end_boundary),'[]'::jsonb)
  );
end;
$$;

create or replace function private.sync_coach_hub_booking_reminders()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if new.status not in ('provisional','confirmed') or new.team_key is null then
    update public.coach_hub_booking_reminders set status='cancelled',updated_at=now() where booking_id=new.id and status in ('pending','processing');
    return new;
  end if;
  insert into public.coach_hub_booking_reminders(club_id,booking_id,person_id,team_key,reminder_type,due_at)
  select new.club_id,new.id,assignment.person_id,new.team_key,kind.reminder_type,greatest(now(),new.start_at-kind.offset_value)
  from public.coach_hub_team_assignments assignment
  join public.coach_hub_people person on person.id=assignment.person_id and person.club_id=assignment.club_id and person.status='active'
  cross join (values('48_hour'::text,interval '48 hours'),('4_hour'::text,interval '4 hours')) kind(reminder_type,offset_value)
  where assignment.club_id=new.club_id and assignment.team_key=new.team_key and assignment.status='active' and new.start_at>now()
  on conflict(booking_id,person_id,reminder_type) do update set due_at=excluded.due_at,status='pending',delivery_error=null,updated_at=now();
  return new;
end;
$$;

drop trigger if exists annual_planner_sync_coach_reminders on public.annual_planner_bookings;
create trigger annual_planner_sync_coach_reminders
after insert or update of start_at,end_at,status,pitch_id,venue_id on public.annual_planner_bookings
for each row execute function private.sync_coach_hub_booking_reminders();

insert into public.coach_hub_booking_reminders(club_id,booking_id,person_id,team_key,reminder_type,due_at)
select booking.club_id,booking.id,assignment.person_id,booking.team_key,kind.reminder_type,greatest(now(),booking.start_at-kind.offset_value)
from public.annual_planner_bookings booking
join public.coach_hub_team_assignments assignment on assignment.club_id=booking.club_id and assignment.team_key=booking.team_key and assignment.status='active'
join public.coach_hub_people person on person.id=assignment.person_id and person.status='active'
cross join (values('48_hour'::text,interval '48 hours'),('4_hour'::text,interval '4 hours')) kind(reminder_type,offset_value)
where booking.status in ('provisional','confirmed') and booking.start_at>now()
on conflict(booking_id,person_id,reminder_type) do nothing;

create or replace function public.claim_due_coach_hub_reminders(batch_size integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare result jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  with due as (
    select reminder.id from public.coach_hub_booking_reminders reminder
    where reminder.status='pending' and reminder.due_at<=now()
    order by reminder.due_at for update skip locked limit greatest(1,least(coalesce(batch_size,50),200))
  ), claimed as (
    update public.coach_hub_booking_reminders reminder set status='processing',updated_at=now() from due where reminder.id=due.id
    returning reminder.*
  )
  select coalesce(jsonb_agg(to_jsonb(claimed)||jsonb_build_object(
    'email',person.email,'display_name',person.display_name,'preferred_channel',person.preferred_channel,
    'club_name',club.name,'booking_title',booking.title,'team_name',booking.team_name,'pitch_name',booking.pitch_name,
    'venue_name',booking.venue_name,'start_at',booking.start_at,'end_at',booking.end_at
  )),'[]'::jsonb) into result
  from claimed join public.coach_hub_people person on person.id=claimed.person_id join public.clubs club on club.id=claimed.club_id join public.annual_planner_bookings booking on booking.id=claimed.booking_id;
  return result;
end;
$$;

create or replace function public.complete_coach_hub_reminder(target_reminder_id uuid,delivered boolean,provider_reference_value text default null,error_message_value text default null)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare reminder public.coach_hub_booking_reminders%rowtype; booking public.annual_planner_bookings%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  update public.coach_hub_booking_reminders set status=case when delivered then 'delivered' else 'failed' end,delivery_reference=nullif(provider_reference_value,''),delivery_error=nullif(error_message_value,''),sent_at=case when delivered then now() else sent_at end,updated_at=now() where id=target_reminder_id returning * into reminder;
  if reminder.id is null then return; end if;
  if delivered then
    select * into booking from public.annual_planner_bookings where id=reminder.booking_id;
    insert into public.coach_hub_messages(club_id,person_id,team_key,message_type,title,body,related_type,related_id,requires_acknowledgement,created_by)
    values(reminder.club_id,reminder.person_id,reminder.team_key,'action_required',case when reminder.reminder_type='4_hour' then 'Team activity today' else 'Upcoming team activity' end,booking.title||' · '||to_char(booking.start_at,'Dy DD Mon HH24:MI')||coalesce(' · '||nullif(booking.pitch_name,''),''),'coach_hub_reminder',reminder.id::text,reminder.reminder_type='4_hour',null);
  end if;
end;
$$;


create or replace function public.reconcile_annual_planner_booking_cost(target_club_id uuid,target_booking_id uuid,reconciliation_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare result public.annual_planner_bookings%rowtype; next_status text:=lower(trim(coalesce(reconciliation_data->>'status','reconciled')));
begin
  if auth.uid() is null or not public.can_manage_club(target_club_id) then raise exception 'Club administrator access required' using errcode='42501'; end if;
  if next_status not in ('unreconciled','ready','reconciled','not_required') then raise exception 'Invalid finance reconciliation status' using errcode='22023'; end if;
  update public.annual_planner_bookings booking set finance_status=next_status,finance_reference=nullif(trim(reconciliation_data->>'reference'),''),updated_by=auth.uid(),updated_at=now()
  where booking.id=target_booking_id and booking.club_id=target_club_id returning * into result;
  if result.id is null then raise exception 'Annual Planner booking not found' using errcode='P0002'; end if;
  perform public.record_audit_event(target_club_id,'annual_planner.booking.finance_reconciled','annual_planner_booking',result.id::text,jsonb_build_object('finance_status',result.finance_status,'finance_reference',result.finance_reference,'cost_pence',result.cost_pence));
  return to_jsonb(result);
end;
$$;

revoke all on function public.list_coach_hub_request_thread(uuid,uuid), public.post_coach_hub_request_message(uuid,uuid,text), public.verify_my_coach_hub_contact(uuid), public.replace_coach_hub_contact(uuid,uuid,jsonb), public.create_coach_hub_team_calendar_feed(uuid,text,text), public.list_coach_hub_pilot_metrics(uuid,date,date), public.claim_due_coach_hub_reminders(integer), public.complete_coach_hub_reminder(uuid,boolean,text,text), public.reconcile_annual_planner_booking_cost(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.list_coach_hub_request_thread(uuid,uuid), public.post_coach_hub_request_message(uuid,uuid,text), public.verify_my_coach_hub_contact(uuid), public.replace_coach_hub_contact(uuid,uuid,jsonb), public.create_coach_hub_team_calendar_feed(uuid,text,text), public.list_coach_hub_pilot_metrics(uuid,date,date), public.reconcile_annual_planner_booking_cost(uuid,uuid,jsonb) to authenticated;
grant execute on function public.claim_due_coach_hub_reminders(integer), public.complete_coach_hub_reminder(uuid,boolean,text,text) to service_role;

commit;
