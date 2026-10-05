-- Exact team keys govern calendar and change-message access.
-- Name fallback is limited to keyless legacy rows with one unambiguous club team.
begin;
CREATE OR REPLACE FUNCTION public.get_coach_hub_calendar_context(target_club_id uuid, range_start date DEFAULT NULL::date, range_end date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare coach_person_id uuid:=private.current_coach_person_id(target_club_id); start_boundary timestamptz:=coalesce(range_start,current_date-interval '30 days'); end_boundary timestamptz:=coalesce(range_end,current_date+interval '400 days')+interval '1 day';
begin
  if coach_person_id is null or not public.can_access_coach_hub(target_club_id) then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  return jsonb_build_object(
    'bookings',coalesce((select jsonb_agg(to_jsonb(booking)-'cost_pence'-'supplier_reference'-'admin_notes'-'notes'-'finance_reference'-'contact_email'-'contact_name'||jsonb_build_object('team_key',assignment.team_key,'team_name',assignment.team_name) order by booking.start_at)
      from public.annual_planner_bookings booking join lateral (
        select candidate.team_key,candidate.team_name from public.coach_hub_team_assignments candidate
        where candidate.person_id=coach_person_id and candidate.club_id=target_club_id and candidate.status='active'
          and (candidate.team_key=booking.team_key or (
 nullif(trim(coalesce(booking.team_key,'')),'') is null
 and nullif(trim(coalesce(booking.team_name,'')),'') is not null
 and regexp_replace(lower(candidate.team_name),'[^a-z0-9]+','','g')=regexp_replace(lower(booking.team_name),'[^a-z0-9]+','','g')
 and (select count(distinct known.team_key) from public.coach_hub_team_assignments known
 where known.club_id=booking.club_id and known.status='active'
 and regexp_replace(lower(known.team_name),'[^a-z0-9]+','','g')=regexp_replace(lower(booking.team_name),'[^a-z0-9]+','','g'))=1))
        order by case when candidate.team_key=booking.team_key then 0 else 1 end,candidate.is_primary desc limit 1
      ) assignment on true
      where booking.club_id=target_club_id and booking.start_at>=start_boundary and booking.start_at<end_boundary and (booking.status='confirmed' or (booking.source_type like 'matchday_%' and booking.status in ('postponed','cancelled')))),'[]'::jsonb),
    'blackouts',coalesce((select jsonb_agg(to_jsonb(blackout)-'internal_note'-'created_by'-'updated_by'||jsonb_build_object('pitch_name',coalesce((select pitch.data->>'label' from public.pitches pitch where pitch.club_id=target_club_id and pitch.id=blackout.pitch_id limit 1),blackout.pitch_id),'affected_booking_count',(select count(*) from public.annual_planner_closure_impacts impact where impact.blackout_id=blackout.id and impact.status='action_required')) order by blackout.start_at) from public.annual_planner_blackouts blackout where blackout.club_id=target_club_id and blackout.visibility='club' and blackout.start_at<end_boundary and blackout.end_at>start_boundary),'[]'::jsonb),
    'pitch_closures',coalesce((select jsonb_agg(closure_row.data||jsonb_build_object('id',closure_row.id,'pitch_id',coalesce(closure_row.data->>'pitchId',closure_row.data->>'pitch_id',closure_row.id),'pitch_name',coalesce((select pitch.data->>'label' from public.pitches pitch where pitch.club_id=target_club_id and pitch.id=coalesce(closure_row.data->>'pitchId',closure_row.data->>'pitch_id',closure_row.id) limit 1),coalesce(closure_row.data->>'pitchId',closure_row.data->>'pitch_id',closure_row.id))) order by coalesce(closure_row.data->>'effectiveFrom',closure_row.data->>'effective_from',closure_row.data->>'date')) from public.pitch_closures closure_row where closure_row.club_id=target_club_id and nullif(coalesce(closure_row.data->>'reopenedAt',closure_row.data->>'reopened_at',''),'') is null and coalesce(closure_row.data->>'effectiveFrom',closure_row.data->>'effective_from',closure_row.data->>'date',current_date::text)::date<=end_boundary::date and (coalesce((closure_row.data->>'untilReopened')::boolean,(closure_row.data->>'until_reopened')::boolean,false) or lower(coalesce(closure_row.data->>'mode',''))='untilreopened' or coalesce(closure_row.data->>'effectiveTo',closure_row.data->>'effective_to',closure_row.data->>'effectiveFrom',closure_row.data->>'effective_from',closure_row.data->>'date',current_date::text)::date>=start_boundary::date)),'[]'::jsonb),
    'closure_impacts',coalesce((select jsonb_agg(to_jsonb(impact) order by impact.created_at desc) from public.annual_planner_closure_impacts impact join public.annual_planner_bookings booking on booking.id=impact.booking_id where impact.club_id=target_club_id and impact.status='action_required' and exists(select 1 from public.coach_hub_team_assignments assignment where assignment.club_id=target_club_id and assignment.person_id=coach_person_id and assignment.status='active' and (assignment.team_key=booking.team_key or (
 nullif(trim(coalesce(booking.team_key,'')),'') is null
 and nullif(trim(coalesce(booking.team_name,'')),'') is not null
 and regexp_replace(lower(assignment.team_name),'[^a-z0-9]+','','g')=regexp_replace(lower(booking.team_name),'[^a-z0-9]+','','g')
 and (select count(distinct known.team_key) from public.coach_hub_team_assignments known
 where known.club_id=booking.club_id and known.status='active'
 and regexp_replace(lower(known.team_name),'[^a-z0-9]+','','g')=regexp_replace(lower(booking.team_name),'[^a-z0-9]+','','g'))=1)))),'[]'::jsonb)
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_coach_hub_calendar_by_token(feed_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'extensions'
 SET row_security TO 'off'
AS $function$
declare feed public.coach_hub_calendar_feeds%rowtype;
begin
  select * into feed from public.coach_hub_calendar_feeds row_value where row_value.token_hash=encode(digest(trim(coalesce(feed_token,'')),'sha256'),'hex') and row_value.status='active';
  if feed.id is null then raise exception 'Calendar feed not found' using errcode='P0002'; end if;
  update public.coach_hub_calendar_feeds set last_accessed_at=now() where id=feed.id;
  return jsonb_build_object(
    'club_name',(select name from public.clubs where id=feed.club_id),
    'label',feed.label,
    'team_key',feed.team_key,
    'bookings',coalesce((select jsonb_agg(to_jsonb(booking)-'cost_pence'-'supplier_reference'-'notes'-'finance_reference'-'contact_email'-'contact_name' order by booking.start_at)
      from public.annual_planner_bookings booking
      where booking.club_id=feed.club_id
        and exists(select 1 from public.coach_hub_team_assignments assignment
          where assignment.club_id=feed.club_id and assignment.person_id=feed.person_id and assignment.status='active'
            and (feed.team_key is null or assignment.team_key=feed.team_key)
            and (assignment.team_key=booking.team_key or (
 nullif(trim(coalesce(booking.team_key,'')),'') is null
 and nullif(trim(coalesce(booking.team_name,'')),'') is not null
 and regexp_replace(lower(assignment.team_name),'[^a-z0-9]+','','g')=regexp_replace(lower(booking.team_name),'[^a-z0-9]+','','g')
 and (select count(distinct known.team_key) from public.coach_hub_team_assignments known
 where known.club_id=booking.club_id and known.status='active'
 and regexp_replace(lower(known.team_name),'[^a-z0-9]+','','g')=regexp_replace(lower(booking.team_name),'[^a-z0-9]+','','g'))=1)))
        and (booking.status='confirmed' or (booking.source_type like 'matchday_%' and booking.status in ('postponed','cancelled'))) and booking.end_at>now()-interval '30 days'),'[]'::jsonb),
    'blackouts',coalesce((select jsonb_agg(to_jsonb(blackout)-'internal_note'-'created_by'-'updated_by' order by blackout.start_at)
      from public.annual_planner_blackouts blackout where blackout.club_id=feed.club_id and blackout.visibility='club' and blackout.end_at>now()-interval '30 days'),'[]'::jsonb),
    'pitch_closures',coalesce((select jsonb_agg(closure_row.data||jsonb_build_object('id',closure_row.id,'pitch_id',coalesce(closure_row.data->>'pitchId',closure_row.data->>'pitch_id',closure_row.id)))
      from public.pitch_closures closure_row where closure_row.club_id=feed.club_id and nullif(coalesce(closure_row.data->>'reopenedAt',closure_row.data->>'reopened_at',''),'') is null),'[]'::jsonb)
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION private.notify_coach_hub_booking_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  assignment_row record;
  message_title text;
  message_body text;
  message_type_value text := 'fixture_change';
  acknowledgement_value boolean := false;
begin
  -- Away information belongs in the calendar, not the matchday message queue.
  if new.fixture_venue_role='away' then return new; end if;
  if tg_op='INSERT' and new.status<>'confirmed' then return new; end if;
  if tg_op='UPDATE' then
    if old.status<>'confirmed' and new.status<>'confirmed' then return new; end if;
    if old.status='confirmed' and new.status='confirmed'
      and (old.title,old.team_key,old.team_name,old.opponent_name,old.venue_id,old.venue_name,old.pitch_id,old.pitch_name,old.start_at,old.end_at,old.fixture_venue_role,old.fixture_time_known)
        is not distinct from
          (new.title,new.team_key,new.team_name,new.opponent_name,new.venue_id,new.venue_name,new.pitch_id,new.pitch_name,new.start_at,new.end_at,new.fixture_venue_role,new.fixture_time_known)
    then return new; end if;
  end if;

  if tg_op='UPDATE' and new.source_type like 'matchday_%' and new.status in ('postponed','cancelled') and old.status is distinct from new.status then
    message_title := case when new.status='postponed' then 'Fixture postponed' else 'Fixture cancelled' end;
    message_body := new.title || ' is ' || new.status || '. It remains labelled on your calendar for reference; no pitch or referee action is required.';
    message_type_value := 'action_required';
    acknowledgement_value := true;
  elsif tg_op='UPDATE' and old.status='confirmed' and new.status<>'confirmed' then
    message_title := 'Calendar booking withdrawn';
    message_body := new.title || ' is no longer on the published team calendar. Contact the club if you need clarification.';
    message_type_value := 'action_required';
    acknowledgement_value := true;
  elsif tg_op='INSERT' or (tg_op='UPDATE' and old.status<>'confirmed' and new.status='confirmed') then
    message_title := case when new.booking_type='match' then 'Fixture added to your calendar' else 'Booking published to your calendar' end;
    message_body := new.title || ' · ' || to_char(new.start_at at time zone 'Europe/London','Dy DD Mon HH24:MI') || coalesce(' · '||nullif(new.pitch_name,''),'');
  else
    message_title := case when new.booking_type='match' then 'Fixture details changed' else 'Calendar booking changed' end;
    message_body := new.title || ' was updated to ' || to_char(new.start_at at time zone 'Europe/London','Dy DD Mon HH24:MI') || coalesce(' · '||nullif(new.pitch_name,''),'') || '. Please review the latest details.';
    acknowledgement_value := true;
  end if;

  for assignment_row in
    select distinct on (assignment.person_id)
      assignment.person_id,assignment.team_key
    from public.coach_hub_team_assignments assignment
    where assignment.club_id=new.club_id
      and assignment.status='active'
      and (assignment.team_key=new.team_key or (
 nullif(trim(coalesce(new.team_key,'')),'') is null
 and nullif(trim(coalesce(new.team_name,'')),'') is not null
 and regexp_replace(lower(assignment.team_name),'[^a-z0-9]+','','g')=regexp_replace(lower(new.team_name),'[^a-z0-9]+','','g')
 and (select count(distinct known.team_key) from public.coach_hub_team_assignments known
 where known.club_id=new.club_id and known.status='active'
 and regexp_replace(lower(known.team_name),'[^a-z0-9]+','','g')=regexp_replace(lower(new.team_name),'[^a-z0-9]+','','g'))=1))
    order by assignment.person_id,assignment.is_primary desc
  loop
    insert into public.coach_hub_messages(
      club_id,person_id,team_key,message_type,title,body,related_type,related_id,
      action_url,requires_acknowledgement,created_by
    ) values (
      new.club_id,assignment_row.person_id,assignment_row.team_key,message_type_value,
      message_title,message_body,'annual_planner_booking',new.id::text,
      '/coach',acknowledgement_value,auth.uid()
    );
  end loop;
  return new;
end;
$function$
;
commit;
