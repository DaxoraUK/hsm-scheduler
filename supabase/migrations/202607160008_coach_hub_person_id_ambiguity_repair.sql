-- Daxora Ground Control v3.10.3.4
-- Repair Coach Hub RPCs that used a local variable called person_id while
-- querying tables that also contain a person_id column.

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
  values(target_club_id,coach_person_id,assignment.id,target_booking_id_value,request_type_value,'submitted',left(trim(coalesce(request_data->>'title',initcap(request_type_value)||' request')),240),assignment.team_key,assignment.team_name,nullif(trim(request_data->>'opponent_name'),''),nullif(trim(request_data->>'format'),''),nullif(request_data->>'preferred_venue_id',''),nullif(request_data->>'preferred_venue_name',''),nullif(request_data->>'preferred_pitch_id',''),nullif(request_data->>'preferred_pitch_name',''),start_value,end_value,coalesce(nullif(request_data->>'recurrence',''),'none'),nullif(request_data->>'recurrence_until','')::date,coalesce(array(select value::date from jsonb_array_elements_text(coalesce(request_data->'exception_dates','[]'::jsonb)) as exception_row(value) where value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),'{}'::date[]),case lower(trim(coalesce(request_data->>'holiday_policy','include'))) when 'exclude' then 'exclude' when 'custom' then 'custom' else 'include' end,nullif(request_data->>'estimated_attendance','')::integer,coalesce((request_data->>'referee_required')::boolean,false),coalesce((request_data->>'changing_rooms_required')::boolean,false),nullif(request_data->>'coach_notes',''),conflicts)
  returning * into result;
  insert into public.coach_hub_messages(club_id,person_id,team_key,message_type,title,body,related_type,related_id,created_by)
  values(target_club_id,coach_person_id,assignment.team_key,'information','Request submitted','Your '||replace(request_type_value,'_',' ')||' request for '||to_char(start_value,'Dy DD Mon at HH24:MI')||' has been sent to the club scheduler.','coach_request',result.id::text,auth.uid());
  perform private.record_coach_hub_audit_event(target_club_id,'coach_hub.request.submitted','coach_hub_request',result.id::text,jsonb_build_object('team_key',assignment.team_key,'request_type',request_type_value,'conflicts',jsonb_array_length(conflicts)));
  return to_jsonb(result)-'admin_notes';
end;
$$;

create or replace function public.respond_to_coach_hub_alternative(target_club_id uuid,target_request_id uuid,response_value text,coach_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare coach_person_id uuid:=private.current_coach_person_id(target_club_id); request_row public.coach_hub_requests%rowtype; response_safe text:=lower(trim(coalesce(response_value,''))); booking_id uuid;
begin
  if coach_person_id is null then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  select * into request_row from public.coach_hub_requests where id=target_request_id and club_id=target_club_id and person_id=coach_person_id and status='alternative_offered' for update;
  if request_row.id is null then raise exception 'Alternative offer not found' using errcode='P0002'; end if;
  if response_safe='accept' then
    booking_id:=private.create_booking_from_coach_request(request_row,coalesce(request_row.reviewed_by,auth.uid()),true);
    update public.coach_hub_requests set status='accepted',resulting_booking_id=booking_id,coach_notes=concat_ws(E'\n',coach_notes,nullif(coach_message,'')),updated_at=now() where id=request_row.id;
  elsif response_safe='decline' then
    update public.coach_hub_requests set status='declined',coach_notes=concat_ws(E'\n',coach_notes,nullif(coach_message,'')),updated_at=now() where id=request_row.id;
  else raise exception 'Choose accept or decline' using errcode='22023'; end if;
  perform private.record_coach_hub_audit_event(target_club_id,'coach_hub.alternative.'||response_safe,'coach_hub_request',request_row.id::text,jsonb_build_object('booking_id',booking_id));
  return (select to_jsonb(row_value)-'admin_notes' from public.coach_hub_requests row_value where row_value.id=request_row.id);
end;
$$;

create or replace function public.update_my_coach_hub_profile(target_club_id uuid,profile_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare coach_person_id uuid:=private.current_coach_person_id(target_club_id); result public.coach_hub_people%rowtype;
begin
  if coach_person_id is null then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  update public.coach_hub_people set display_name=left(trim(coalesce(profile_data->>'display_name',display_name)),160),mobile=left(trim(coalesce(profile_data->>'mobile',mobile)),40),preferred_channel=case lower(trim(coalesce(profile_data->>'preferred_channel',preferred_channel))) when 'sms' then 'sms' when 'whatsapp' then 'whatsapp' when 'in_app' then 'in_app' else 'email' end,last_verified_at=now(),updated_at=now() where id=coach_person_id returning * into result;
  update public.team_contacts contact set coach_name=case when assignment.source_slot='coach' then result.display_name else contact.coach_name end,coach_phone=case when assignment.source_slot='coach' then result.mobile else contact.coach_phone end,assistant_name=case when assignment.source_slot='assistant' then result.display_name else contact.assistant_name end,assistant_phone=case when assignment.source_slot='assistant' then result.mobile else contact.assistant_phone end,preferred_channel=case when result.preferred_channel in ('email','sms','whatsapp') then result.preferred_channel else contact.preferred_channel end,last_verified_at=now(),updated_at=now()
  from public.coach_hub_team_assignments assignment where assignment.person_id=result.id and assignment.club_id=contact.club_id and assignment.team_key=contact.team_key and contact.club_id=target_club_id;
  perform private.record_coach_hub_audit_event(target_club_id,'coach_hub.profile.updated','coach_hub_person',coach_person_id::text,jsonb_build_object('preferred_channel',result.preferred_channel));
  return to_jsonb(result)-'identity_key';
end;
$$;

create or replace function public.create_coach_hub_calendar_feed(target_club_id uuid,label_value text default 'My team calendar')
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare coach_person_id uuid:=private.current_coach_person_id(target_club_id); raw_token text:=encode(gen_random_bytes(32),'hex'); feed_id uuid;
begin
  if coach_person_id is null then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  update public.coach_hub_calendar_feeds set status='revoked',revoked_at=now() where club_id=target_club_id and person_id=coach_person_id and status='active';
  insert into public.coach_hub_calendar_feeds(club_id,person_id,token_hash,label) values(target_club_id,coach_person_id,encode(digest(raw_token,'sha256'),'hex'),left(trim(coalesce(label_value,'My team calendar')),120)) returning id into feed_id;
  return jsonb_build_object('id',feed_id,'token',raw_token,'label',label_value);
end;
$$;

create or replace function public.verify_my_coach_hub_contact(target_club_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare coach_person_id uuid:=private.current_coach_person_id(target_club_id); result public.coach_hub_people%rowtype;
begin
  if coach_person_id is null then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  update public.coach_hub_people set verification_status='verified',last_verified_at=now(),verification_due_at=now()+interval '180 days',replacement_requested_at=null,updated_at=now() where id=coach_person_id returning * into result;
  update public.team_contacts contact set last_verified_at=now(),updated_at=now()
  from public.coach_hub_team_assignments assignment where assignment.person_id=coach_person_id and assignment.club_id=contact.club_id and assignment.team_key=contact.team_key and contact.club_id=target_club_id;
  perform private.record_coach_hub_audit_event(target_club_id,'coach_hub.contact.verified','coach_hub_person',coach_person_id::text,jsonb_build_object('next_due_at',result.verification_due_at));
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
declare coach_person_id uuid:=private.current_coach_person_id(target_club_id); raw_token text:=encode(gen_random_bytes(32),'hex'); feed_id uuid; safe_team_key text:=nullif(trim(coalesce(team_key_value,'')),'');
begin
  if coach_person_id is null then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  if safe_team_key is not null and not exists(select 1 from public.coach_hub_team_assignments assignment where assignment.club_id=target_club_id and assignment.person_id=coach_person_id and assignment.team_key=safe_team_key and assignment.status='active') then raise exception 'Team calendar access denied' using errcode='42501'; end if;
  update public.coach_hub_calendar_feeds set status='revoked',revoked_at=now() where club_id=target_club_id and person_id=coach_person_id and coalesce(team_key,'')=coalesce(safe_team_key,'') and status='active';
  insert into public.coach_hub_calendar_feeds(club_id,person_id,team_key,token_hash,label) values(target_club_id,coach_person_id,safe_team_key,encode(digest(raw_token,'sha256'),'hex'),left(trim(coalesce(label_value,'My team calendar')),120)) returning id into feed_id;
  return jsonb_build_object('id',feed_id,'token',raw_token,'team_key',safe_team_key,'label',label_value);
end;
$$;

-- Reapply the restricted pgcrypto search path to the replaced feed functions.
do $$
declare
  crypto_schema text;
begin
  select namespace.nspname
    into crypto_schema
  from pg_catalog.pg_extension extension_row
  join pg_catalog.pg_namespace namespace
    on namespace.oid = extension_row.extnamespace
  where extension_row.extname = 'pgcrypto';

  if crypto_schema is null then
    raise exception 'The pgcrypto extension is required for Coach Hub calendar feeds';
  end if;

  execute pg_catalog.format(
    'alter function public.create_coach_hub_calendar_feed(uuid,text) set search_path = pg_catalog, %I',
    crypto_schema
  );
  execute pg_catalog.format(
    'alter function public.create_coach_hub_team_calendar_feed(uuid,text,text) set search_path = pg_catalog, %I',
    crypto_schema
  );
end;
$$;

notify pgrst, 'reload schema';
