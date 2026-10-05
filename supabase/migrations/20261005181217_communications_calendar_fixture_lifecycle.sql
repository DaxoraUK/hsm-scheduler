-- Retain fixture venue and lifecycle on the existing shared calendar.
-- No imported fixtures, schedules, overrides or existing calendar rows are mutated.
begin;
alter table public.annual_planner_bookings
  add column if not exists fixture_venue_role text check (fixture_venue_role in ('home','away')),
  add column if not exists fixture_time_known boolean not null default true;

CREATE OR REPLACE FUNCTION public.sync_matchday_calendar(target_club_id uuid, day_scope text, matchday_date date, fixture_rows jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  actor_id uuid := auth.uid();
  safe_scope text := lower(trim(coalesce(day_scope, '')));
  safe_source_type text;
  row_data jsonb;
  source_id_value text;
  status_value text;
  venue_role_value text;
  time_known_value boolean;
  incoming_ids text[] := '{}';
  saved_count integer := 0;
  removed_count integer := 0;
begin
  if actor_id is null or not public.can_operate_club(target_club_id) then
    raise exception 'Club operations access required' using errcode = '42501';
  end if;
  if not private.club_has_entitlement(target_club_id, 'annual_planner') then
    raise exception 'Annual Planner is not enabled for this club' using errcode = '42501';
  end if;
  if safe_scope not in ('saturday', 'sunday', 'midweek') then
    raise exception 'Unsupported matchday scope' using errcode = '22023';
  end if;
  if matchday_date is null then
    raise exception 'Matchday date is required' using errcode = '22023';
  end if;
  if fixture_rows is null or jsonb_typeof(fixture_rows) <> 'array' then
    raise exception 'fixture_rows must be a JSON array' using errcode = '22023';
  end if;

  safe_source_type := 'matchday_' || safe_scope;

  for row_data in select value from jsonb_array_elements(fixture_rows)
  loop
    source_id_value := nullif(trim(coalesce(row_data->>'sourceId', row_data->>'source_id', row_data->>'id')), '');
    if source_id_value is null then
      raise exception 'Each matchday fixture requires a stable source id' using errcode = '22023';
    end if;
    if source_id_value = any(incoming_ids) then
      raise exception 'Duplicate matchday source identity: %', source_id_value using errcode = '22023';
    end if;
    incoming_ids := array_append(incoming_ids, source_id_value);
    status_value := lower(coalesce(nullif(trim(row_data->>'status'), ''), 'confirmed'));
    venue_role_value := lower(coalesce(nullif(trim(coalesce(row_data->>'fixtureVenueRole', row_data->>'fixture_venue_role')), ''), 'home'));
    time_known_value := coalesce((coalesce(row_data->>'fixtureTimeKnown', row_data->>'fixture_time_known'))::boolean, true);
    if status_value not in ('confirmed', 'provisional', 'postponed', 'cancelled')
      or venue_role_value not in ('home', 'away') then
      raise exception 'Invalid matchday lifecycle or venue role' using errcode = '22023';
    end if;
    if (row_data->>'startAt')::timestamptz < (matchday_date::timestamp at time zone 'Europe/London')
      or (row_data->>'startAt')::timestamptz >= ((matchday_date + 1)::timestamp at time zone 'Europe/London') then
      raise exception 'Fixture date is outside the selected matchday' using errcode = '22023';
    end if;

    insert into public.annual_planner_bookings(
      club_id, title, booking_type, status, team_key, team_name, opponent_name,
      venue_id, venue_name, pitch_id, pitch_name, start_at, end_at,
      recurrence, cost_pence, source_type, source_id, created_by, updated_by,
      fixture_venue_role, fixture_time_known
    ) values (
      target_club_id,
      left(trim(coalesce(row_data->>'title', 'Match fixture')), 240),
      'match',
      status_value,
      nullif(trim(coalesce(row_data->>'teamKey', row_data->>'team_key')), ''),
      nullif(trim(coalesce(row_data->>'teamName', row_data->>'team_name')), ''),
      nullif(trim(coalesce(row_data->>'opponentName', row_data->>'opponent_name')), ''),
      case when venue_role_value='away' or status_value in ('postponed','cancelled') then null else nullif(trim(coalesce(row_data->>'venueId', row_data->>'venue_id')), '') end,
      nullif(trim(coalesce(row_data->>'venueName', row_data->>'venue_name')), ''),
      case when venue_role_value='away' or status_value in ('postponed','cancelled') then null else nullif(trim(coalesce(row_data->>'pitchId', row_data->>'pitch_id')), '') end,
      case when venue_role_value='away' or status_value in ('postponed','cancelled') then null else nullif(trim(coalesce(row_data->>'pitchName', row_data->>'pitch_name')), '') end,
      (row_data->>'startAt')::timestamptz,
      (row_data->>'endAt')::timestamptz,
      'none', 0, safe_source_type, source_id_value, actor_id, actor_id,
      venue_role_value, time_known_value
    )
    on conflict (club_id, source_type, source_id)
      where source_type like 'matchday_%' and source_id is not null
    do update set
      title = excluded.title,
      status = excluded.status,
      fixture_venue_role = excluded.fixture_venue_role,
      fixture_time_known = excluded.fixture_time_known,
      team_key = excluded.team_key,
      team_name = excluded.team_name,
      opponent_name = excluded.opponent_name,
      venue_id = excluded.venue_id,
      venue_name = excluded.venue_name,
      pitch_id = excluded.pitch_id,
      pitch_name = excluded.pitch_name,
      start_at = excluded.start_at,
      end_at = excluded.end_at,
      updated_by = actor_id,
      updated_at = now()
    where (annual_planner_bookings.title, annual_planner_bookings.status, annual_planner_bookings.team_key,
      annual_planner_bookings.team_name, annual_planner_bookings.opponent_name, annual_planner_bookings.venue_id,
      annual_planner_bookings.venue_name, annual_planner_bookings.pitch_id, annual_planner_bookings.pitch_name,
      annual_planner_bookings.start_at, annual_planner_bookings.end_at,
      annual_planner_bookings.fixture_venue_role, annual_planner_bookings.fixture_time_known)
    is distinct from (excluded.title, excluded.status, excluded.team_key, excluded.team_name,
      excluded.opponent_name, excluded.venue_id, excluded.venue_name, excluded.pitch_id, excluded.pitch_name,
      excluded.start_at, excluded.end_at, excluded.fixture_venue_role, excluded.fixture_time_known);
    saved_count := saved_count + 1;
  end loop;

  delete from public.annual_planner_bookings booking
  where booking.club_id = target_club_id
    and booking.source_type = safe_source_type
    and booking.start_at >= (matchday_date::timestamp at time zone 'Europe/London')
    and booking.start_at < ((matchday_date + 1)::timestamp at time zone 'Europe/London')
    and not (booking.source_id = any(incoming_ids));
  get diagnostics removed_count = row_count;

  perform private.record_coach_hub_audit_event(
    target_club_id,
    'matchday.calendar.synchronised',
    'matchday_calendar',
    safe_scope || ':' || matchday_date::text,
    jsonb_build_object('day_scope', safe_scope, 'matchday_date', matchday_date, 'saved', saved_count, 'removed', removed_count)
  );

  return jsonb_build_object('day_scope', safe_scope, 'matchday_date', matchday_date, 'saved', saved_count, 'removed', removed_count);
end;
$function$
;

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
          and (candidate.team_key=booking.team_key or (nullif(trim(coalesce(booking.team_name,'')),'') is not null and regexp_replace(lower(candidate.team_name),'[^a-z0-9]+','','g')=regexp_replace(lower(booking.team_name),'[^a-z0-9]+','','g')))
        order by case when candidate.team_key=booking.team_key then 0 else 1 end,candidate.is_primary desc limit 1
      ) assignment on true
      where booking.club_id=target_club_id and booking.start_at>=start_boundary and booking.start_at<end_boundary and (booking.status='confirmed' or (booking.source_type like 'matchday_%' and booking.status in ('postponed','cancelled')))),'[]'::jsonb),
    'blackouts',coalesce((select jsonb_agg(to_jsonb(blackout)-'internal_note'-'created_by'-'updated_by'||jsonb_build_object('pitch_name',coalesce((select pitch.data->>'label' from public.pitches pitch where pitch.club_id=target_club_id and pitch.id=blackout.pitch_id limit 1),blackout.pitch_id),'affected_booking_count',(select count(*) from public.annual_planner_closure_impacts impact where impact.blackout_id=blackout.id and impact.status='action_required')) order by blackout.start_at) from public.annual_planner_blackouts blackout where blackout.club_id=target_club_id and blackout.visibility='club' and blackout.start_at<end_boundary and blackout.end_at>start_boundary),'[]'::jsonb),
    'pitch_closures',coalesce((select jsonb_agg(closure_row.data||jsonb_build_object('id',closure_row.id,'pitch_id',coalesce(closure_row.data->>'pitchId',closure_row.data->>'pitch_id',closure_row.id),'pitch_name',coalesce((select pitch.data->>'label' from public.pitches pitch where pitch.club_id=target_club_id and pitch.id=coalesce(closure_row.data->>'pitchId',closure_row.data->>'pitch_id',closure_row.id) limit 1),coalesce(closure_row.data->>'pitchId',closure_row.data->>'pitch_id',closure_row.id))) order by coalesce(closure_row.data->>'effectiveFrom',closure_row.data->>'effective_from',closure_row.data->>'date')) from public.pitch_closures closure_row where closure_row.club_id=target_club_id and nullif(coalesce(closure_row.data->>'reopenedAt',closure_row.data->>'reopened_at',''),'') is null and coalesce(closure_row.data->>'effectiveFrom',closure_row.data->>'effective_from',closure_row.data->>'date',current_date::text)::date<=end_boundary::date and (coalesce((closure_row.data->>'untilReopened')::boolean,(closure_row.data->>'until_reopened')::boolean,false) or lower(coalesce(closure_row.data->>'mode',''))='untilreopened' or coalesce(closure_row.data->>'effectiveTo',closure_row.data->>'effective_to',closure_row.data->>'effectiveFrom',closure_row.data->>'effective_from',closure_row.data->>'date',current_date::text)::date>=start_boundary::date)),'[]'::jsonb),
    'closure_impacts',coalesce((select jsonb_agg(to_jsonb(impact) order by impact.created_at desc) from public.annual_planner_closure_impacts impact join public.annual_planner_bookings booking on booking.id=impact.booking_id where impact.club_id=target_club_id and impact.status='action_required' and exists(select 1 from public.coach_hub_team_assignments assignment where assignment.person_id=coach_person_id and assignment.status='active' and (assignment.team_key=booking.team_key or regexp_replace(lower(assignment.team_name),'[^a-z0-9]+','','g')=regexp_replace(lower(coalesce(booking.team_name,'')),'[^a-z0-9]+','','g')))),'[]'::jsonb)
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
              nullif(trim(coalesce(booking.team_name,'')),'') is not null
              and regexp_replace(lower(assignment.team_name),'[^a-z0-9]+','','g')=regexp_replace(lower(booking.team_name),'[^a-z0-9]+','','g'))))
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
      and (
        assignment.team_key=new.team_key
        or (
          nullif(trim(coalesce(new.team_name,'')),'') is not null
          and regexp_replace(lower(assignment.team_name),'[^a-z0-9]+','','g')
            = regexp_replace(lower(new.team_name),'[^a-z0-9]+','','g')
        )
      )
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

revoke all on function public.sync_matchday_calendar(uuid,text,date,jsonb) from public,anon,authenticated;
grant execute on function public.sync_matchday_calendar(uuid,text,date,jsonb) to authenticated;
revoke all on function public.get_coach_hub_calendar_context(uuid,date,date) from public,anon,authenticated;
grant execute on function public.get_coach_hub_calendar_context(uuid,date,date) to authenticated;
revoke all on function public.get_coach_hub_calendar_by_token(text) from public,anon,authenticated;
grant execute on function public.get_coach_hub_calendar_by_token(text) to service_role;
revoke all on function private.notify_coach_hub_booking_change() from public,anon,authenticated;
commit;
