-- Compatibility is read-only: keep existing assignments, contacts, bookings and
-- messages intact. Opaque IDs are never matched solely by their display name.
create or replace function private.contact_team_slug(value text)
returns text language sql immutable set search_path='' as $$
  select left(trim(both '-' from regexp_replace(replace(lower(trim(coalesce(value,''))),'&','and'),'[^a-z0-9]+','-','g')),120);
$$;

create or replace function private.resolve_contact_team_key(target_club_id uuid, key_value text, name_value text default '')
returns text language plpgsql stable set search_path='' as $$
declare raw_key text:=trim(coalesce(key_value,'')); name_slug text:=private.contact_team_slug(name_value);
  matches integer; resolved text;
begin
  select count(*),min(coalesce(nullif(trim(cfg.data->>'id'),''),nullif(trim(cfg.data->>'teamId'),''),nullif(trim(cfg.data->>'key'),''),private.contact_team_slug(coalesce(cfg.data->>'name',cfg.data->>'teamName'))))
  into matches,resolved from public.team_config cfg where cfg.club_id=target_club_id
    and coalesce(nullif(trim(cfg.data->>'id'),''),nullif(trim(cfg.data->>'teamId'),''),nullif(trim(cfg.data->>'key'),''),private.contact_team_slug(coalesce(cfg.data->>'name',cfg.data->>'teamName')))=raw_key;
  if raw_key<>'' and matches=1 then return raw_key; end if;
  if matches>1 then return null; end if;
  if name_slug='' or (raw_key<>'' and private.contact_team_slug(raw_key)<>name_slug) then return nullif(raw_key,''); end if;
  select count(*),min(coalesce(nullif(trim(cfg.data->>'id'),''),nullif(trim(cfg.data->>'teamId'),''),nullif(trim(cfg.data->>'key'),''),private.contact_team_slug(coalesce(cfg.data->>'name',cfg.data->>'teamName'))))
  into matches,resolved from public.team_config cfg where cfg.club_id=target_club_id
    and private.contact_team_slug(coalesce(cfg.data->>'name',cfg.data->>'teamName'))=name_slug;
  if matches=1 then return resolved; end if;
  if matches>1 then return null; end if;
  return name_slug;
end $$;

create or replace function private.same_contact_team(target_club_id uuid, key_value text, name_value text, other_key text, other_name text)
returns boolean language sql stable set search_path='' as $$
  -- Keyless calendar rows retain their existing guarded legacy fallback.
  select nullif(trim(key_value),'') is not null and nullif(trim(other_key),'') is not null
    and private.resolve_contact_team_key(target_club_id,key_value,name_value)=private.resolve_contact_team_key(target_club_id,other_key,other_name);
$$;

create or replace function private.effective_team_contacts(target_club_id uuid)
returns jsonb language sql stable set search_path='' as $$
  with legacy as (
    select distinct on (private.resolve_contact_team_key(target_club_id,c.team_key,c.team_name))
      c.*,private.resolve_contact_team_key(target_club_id,c.team_key,c.team_name) as resolved_key
    from public.team_contacts c where c.club_id=target_club_id
      and private.resolve_contact_team_key(target_club_id,c.team_key,c.team_name) is not null
    order by private.resolve_contact_team_key(target_club_id,c.team_key,c.team_name),
      (c.team_key=private.resolve_contact_team_key(target_club_id,c.team_key,c.team_name)) desc,c.updated_at desc,c.id
  ), active_teams as (
    select distinct on (private.resolve_contact_team_key(target_club_id,a.team_key,a.team_name))
      private.resolve_contact_team_key(target_club_id,a.team_key,a.team_name) as resolved_key,a.team_name,a.updated_at
    from public.coach_hub_team_assignments a join public.coach_hub_people p on p.id=a.person_id and p.club_id=a.club_id and p.status='active'
    where a.club_id=target_club_id and a.status='active'
      and private.resolve_contact_team_key(target_club_id,a.team_key,a.team_name) is not null
    order by private.resolve_contact_team_key(target_club_id,a.team_key,a.team_name),a.is_primary desc,a.updated_at desc,a.id
  ), teams as (
    select resolved_key,team_name from legacy union
    select a.resolved_key,a.team_name from active_teams a where not exists(select 1 from legacy l where l.resolved_key=a.resolved_key)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'team_key',t.resolved_key,'team_name',t.team_name,
    'coach_name',coalesce(l.coach_name,''),'coach_phone',coalesce(l.coach_phone,''),'coach_email',coalesce(l.coach_email,''),
    'preferred_channel',coalesce(l.preferred_channel,'email'),
    'assistant_name',coalesce(l.assistant_name,''),'assistant_phone',coalesce(l.assistant_phone,''),'assistant_email',coalesce(l.assistant_email,''),
    'assistant_enabled',coalesce(l.assistant_enabled,false),'receive_matchday_messages',coalesce(l.receive_matchday_messages,true),
    'privacy_notice_provided_at',l.privacy_notice_provided_at,'last_verified_at',l.last_verified_at,'updated_at',l.updated_at,
    'additional_contacts',coalesce((select jsonb_agg(jsonb_build_object(
      'person_id',p.id,'assignment_id',a.id,'name',p.display_name,'email',p.email,'mobile',p.mobile,
      'preferred_channel',p.preferred_channel,'staff_role',a.staff_role,'is_primary',a.is_primary,'source_slot',a.source_slot
    ) order by a.is_primary desc,a.staff_role,p.display_name,a.id)
      from public.coach_hub_team_assignments a join public.coach_hub_people p on p.id=a.person_id and p.club_id=a.club_id and p.status='active'
      where a.club_id=target_club_id and a.status='active' and private.resolve_contact_team_key(target_club_id,a.team_key,a.team_name)=t.resolved_key),'[]'::jsonb)
  ) order by t.team_name,t.resolved_key),'[]'::jsonb)
  from teams t left join legacy l on l.resolved_key=t.resolved_key;
$$;

revoke all on function private.contact_team_slug(text) from public,anon,authenticated;
revoke all on function private.resolve_contact_team_key(uuid,text,text) from public,anon,authenticated;
revoke all on function private.same_contact_team(uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function private.effective_team_contacts(uuid) from public,anon,authenticated;

create or replace function public.list_team_contacts_v2(target_club_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' set row_security=off as $$
begin
  if auth.uid() is null or not public.can_operate_club(target_club_id) then
    raise exception 'Club operator access required' using errcode='42501';
  end if;
  return private.effective_team_contacts(target_club_id);
end $$;

create or replace function public.validate_communication_delivery_recipients(target_club_id uuid, recipients jsonb default '[]'::jsonb)
returns boolean language plpgsql stable security definer set search_path='' set row_security=off as $$
#variable_conflict error
declare item jsonb; contact jsonb; person public.coach_hub_people%rowtype;
  safe_recipients jsonb:=coalesce(recipients,'[]'::jsonb); channel_value text; expected text; supplied text; type_value text; canonical_key text;
begin
  if auth.uid() is null or not public.can_operate_club(target_club_id) then raise exception 'Club operator access required' using errcode='42501'; end if;
  if jsonb_typeof(safe_recipients)<>'array' or jsonb_array_length(safe_recipients) not between 1 and 100 then
    raise exception 'Choose between 1 and 100 authorised coach recipients' using errcode='22023';
  end if;
  for item in select value from jsonb_array_elements(safe_recipients) loop
    canonical_key:=private.resolve_contact_team_key(target_club_id,item->>'teamKey',item->>'teamKey');
    select row_value into contact from jsonb_array_elements(private.effective_team_contacts(target_club_id)) row_value where row_value->>'team_key'=canonical_key;
    if contact is null then raise exception 'The selected team contact is no longer available' using errcode='22023'; end if;
    if not (contact->>'receive_matchday_messages')::boolean then raise exception 'Matchday messages are disabled for %',contact->>'team_name' using errcode='22023'; end if;
    if nullif(contact->>'privacy_notice_provided_at','') is null then raise exception 'Record the privacy notice for % before web sending',contact->>'team_name' using errcode='22023'; end if;
    channel_value:=lower(trim(coalesce(item->>'channel','')));
    if channel_value not in ('email','sms','whatsapp') then raise exception 'Unsupported communication channel' using errcode='22023'; end if;
    type_value:=case when lower(item->>'recipientType')='assistant' then 'assistant' else 'coach' end;
    if nullif(item->>'assignmentId','') is not null then
      select p.* into person from public.coach_hub_team_assignments a
      join public.coach_hub_people p on p.id=a.person_id and p.club_id=a.club_id and p.status='active'
      where a.id::text=item->>'assignmentId' and a.club_id=target_club_id and a.status='active'
        and private.resolve_contact_team_key(target_club_id,a.team_key,a.team_name)=canonical_key
        and (nullif(item->>'personId','') is null or p.id::text=item->>'personId');
      if not found then raise exception 'The selected active team assignment is no longer available' using errcode='22023'; end if;
      if person.preferred_channel='in_app' then raise exception 'This contact receives Coach Hub updates only' using errcode='22023'; end if;
      expected:=case when channel_value='email' then lower(trim(person.email)) else private.normalise_communication_phone(person.mobile) end;
    else
      if nullif(item->>'personId','') is not null then raise exception 'A directory recipient requires a team assignment' using errcode='22023'; end if;
      if type_value='assistant' and not (contact->>'assistant_enabled')::boolean then raise exception 'Assistant messages are disabled for %',contact->>'team_name' using errcode='22023'; end if;
      expected:=case when channel_value='email' then lower(trim(contact->>(case when type_value='assistant' then 'assistant_email' else 'coach_email' end)))
        else private.normalise_communication_phone(contact->>(case when type_value='assistant' then 'assistant_phone' else 'coach_phone' end)) end;
      -- An older client may omit directory IDs. That must not turn a mirrored
      -- legacy slot into an escape hatch around directory status/preferences.
      if exists (
        select 1 from public.coach_hub_team_assignments a join public.coach_hub_people p on p.id=a.person_id
        where a.club_id=target_club_id and private.resolve_contact_team_key(target_club_id,a.team_key,a.team_name)=canonical_key
          and (a.source_slot=type_value or expected=case when channel_value='email' then lower(trim(p.email)) else private.normalise_communication_phone(p.mobile) end)
      ) and not exists (
        select 1 from public.coach_hub_team_assignments a join public.coach_hub_people p on p.id=a.person_id and p.club_id=a.club_id
        where a.club_id=target_club_id and a.status='active' and p.status='active' and p.preferred_channel<>'in_app'
          and private.resolve_contact_team_key(target_club_id,a.team_key,a.team_name)=canonical_key
          and expected=case when channel_value='email' then lower(trim(p.email)) else private.normalise_communication_phone(p.mobile) end
      ) then raise exception 'The linked directory contact is not available for external sending' using errcode='22023'; end if;
    end if;
    supplied:=case when channel_value='email' then lower(trim(coalesce(item->>'destination',''))) else private.normalise_communication_phone(item->>'destination') end;
    if coalesce(supplied,'')='' or coalesce(expected,'')='' or supplied<>expected then
      raise exception 'The selected recipient does not match the saved adult team contact' using errcode='22023';
    end if;
  end loop;
  return true;
end $$;

-- Existing authorisation and lifecycle policies remain unchanged. Only keyed
-- team joins use the shared compatibility rule; guarded keyless fallbacks stay.
CREATE OR REPLACE FUNCTION public.get_coach_hub_workspace(target_club_id uuid, range_start date DEFAULT NULL::date, range_end date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare coach_person_id uuid:=private.current_coach_person_id(target_club_id); start_boundary timestamptz:=coalesce(range_start,current_date-interval '30 days'); end_boundary timestamptz:=coalesce(range_end,current_date+interval '400 days')+interval '1 day';
begin
  if coach_person_id is null or not public.can_access_coach_hub(target_club_id) then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  if not private.club_has_entitlement(target_club_id,'annual_planner') then raise exception 'Coach Hub is not enabled for this club' using errcode='42501'; end if;
  return jsonb_build_object(
    'club', (select jsonb_build_object('id',club.id,'name',club.name,'slug',club.slug) from public.clubs club where club.id=target_club_id),
    'person', (select to_jsonb(person)-'identity_key' from public.coach_hub_people person where person.id=coach_person_id),
    'assignments', coalesce((select jsonb_agg(to_jsonb(assignment) order by assignment.team_name,assignment.staff_role) from public.coach_hub_team_assignments assignment where assignment.person_id=coach_person_id and assignment.status='active'),'[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(to_jsonb(booking)-'cost_pence'-'supplier_reference'-'admin_notes' order by booking.start_at) from public.annual_planner_bookings booking where booking.club_id=target_club_id and exists(select 1 from public.coach_hub_team_assignments assignment where assignment.club_id=target_club_id and assignment.person_id=coach_person_id and assignment.status='active' and private.same_contact_team(target_club_id,assignment.team_key,assignment.team_name,booking.team_key,booking.team_name)) and booking.start_at>=start_boundary and booking.start_at<end_boundary and booking.status not in ('cancelled','rejected')),'[]'::jsonb),
    'requests', coalesce((select jsonb_agg(to_jsonb(request_row)-'admin_notes' order by request_row.created_at desc) from public.coach_hub_requests request_row where request_row.person_id=coach_person_id and request_row.club_id=target_club_id),'[]'::jsonb),
    'messages', coalesce((select jsonb_agg((to_jsonb(message_row)||jsonb_build_object('read_at',receipt.read_at,'acknowledged_at',receipt.acknowledged_at)) order by message_row.created_at desc) from public.coach_hub_messages message_row left join public.coach_hub_message_receipts receipt on receipt.message_id=message_row.id and receipt.user_id=auth.uid() where message_row.club_id=target_club_id and (message_row.person_id=coach_person_id or (message_row.person_id is null and (message_row.team_key is null or exists(select 1 from public.coach_hub_team_assignments assignment where assignment.club_id=target_club_id and assignment.person_id=coach_person_id and assignment.status='active' and private.same_contact_team(target_club_id,assignment.team_key,assignment.team_name,message_row.team_key,message_row.team_key))))) and (message_row.expires_at is null or message_row.expires_at>now())),'[]'::jsonb),
    'pitches', coalesce((select jsonb_agg(pitch.data || jsonb_build_object('id',pitch.id,'trainingCapacity',private.pitch_training_capacity(target_club_id,pitch.id)) order by coalesce(pitch.data->>'label',pitch.id)) from public.pitches pitch where pitch.club_id=target_club_id),'[]'::jsonb),
    'team_contacts', coalesce((select jsonb_agg(shared.contact order by shared.contact->>'team_name') from (
      select distinct contact||jsonb_build_object('team_key',assignment.team_key) as contact
      from jsonb_array_elements(private.effective_team_contacts(target_club_id)) contact
      join public.coach_hub_team_assignments assignment on assignment.club_id=target_club_id and assignment.person_id=coach_person_id
        and assignment.status='active' and assignment.can_view_team_contacts
        and private.same_contact_team(target_club_id,assignment.team_key,assignment.team_name,contact->>'team_key',contact->>'team_name')
    ) shared),'[]'::jsonb)
  );
end;
$function$;

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
            and (feed.team_key is null or private.same_contact_team(feed.club_id,assignment.team_key,assignment.team_name,feed.team_key,feed.team_key))
            and (private.same_contact_team(feed.club_id,assignment.team_key,assignment.team_name,booking.team_key,booking.team_name) or (
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
$function$;

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
          and (private.same_contact_team(target_club_id,candidate.team_key,candidate.team_name,booking.team_key,booking.team_name) or (
 nullif(trim(coalesce(booking.team_key,'')),'') is null
 and nullif(trim(coalesce(booking.team_name,'')),'') is not null
 and regexp_replace(lower(candidate.team_name),'[^a-z0-9]+','','g')=regexp_replace(lower(booking.team_name),'[^a-z0-9]+','','g')
 and (select count(distinct known.team_key) from public.coach_hub_team_assignments known
 where known.club_id=booking.club_id and known.status='active'
 and regexp_replace(lower(known.team_name),'[^a-z0-9]+','','g')=regexp_replace(lower(booking.team_name),'[^a-z0-9]+','','g'))=1))
        order by case when private.same_contact_team(target_club_id,candidate.team_key,candidate.team_name,booking.team_key,booking.team_name) then 0 else 1 end,candidate.is_primary desc limit 1
      ) assignment on true
      where booking.club_id=target_club_id and booking.start_at>=start_boundary and booking.start_at<end_boundary and (booking.status='confirmed' or (booking.source_type like 'matchday_%' and booking.status in ('postponed','cancelled')))),'[]'::jsonb),
    'blackouts',coalesce((select jsonb_agg(to_jsonb(blackout)-'internal_note'-'created_by'-'updated_by'||jsonb_build_object('pitch_name',coalesce((select pitch.data->>'label' from public.pitches pitch where pitch.club_id=target_club_id and pitch.id=blackout.pitch_id limit 1),blackout.pitch_id),'affected_booking_count',(select count(*) from public.annual_planner_closure_impacts impact where impact.blackout_id=blackout.id and impact.status='action_required')) order by blackout.start_at) from public.annual_planner_blackouts blackout where blackout.club_id=target_club_id and blackout.visibility='club' and blackout.start_at<end_boundary and blackout.end_at>start_boundary),'[]'::jsonb),
    'pitch_closures',coalesce((select jsonb_agg(closure_row.data||jsonb_build_object('id',closure_row.id,'pitch_id',coalesce(closure_row.data->>'pitchId',closure_row.data->>'pitch_id',closure_row.id),'pitch_name',coalesce((select pitch.data->>'label' from public.pitches pitch where pitch.club_id=target_club_id and pitch.id=coalesce(closure_row.data->>'pitchId',closure_row.data->>'pitch_id',closure_row.id) limit 1),coalesce(closure_row.data->>'pitchId',closure_row.data->>'pitch_id',closure_row.id))) order by coalesce(closure_row.data->>'effectiveFrom',closure_row.data->>'effective_from',closure_row.data->>'date')) from public.pitch_closures closure_row where closure_row.club_id=target_club_id and nullif(coalesce(closure_row.data->>'reopenedAt',closure_row.data->>'reopened_at',''),'') is null and coalesce(closure_row.data->>'effectiveFrom',closure_row.data->>'effective_from',closure_row.data->>'date',current_date::text)::date<=end_boundary::date and (coalesce((closure_row.data->>'untilReopened')::boolean,(closure_row.data->>'until_reopened')::boolean,false) or lower(coalesce(closure_row.data->>'mode',''))='untilreopened' or coalesce(closure_row.data->>'effectiveTo',closure_row.data->>'effective_to',closure_row.data->>'effectiveFrom',closure_row.data->>'effective_from',closure_row.data->>'date',current_date::text)::date>=start_boundary::date)),'[]'::jsonb),
    'closure_impacts',coalesce((select jsonb_agg(to_jsonb(impact) order by impact.created_at desc) from public.annual_planner_closure_impacts impact join public.annual_planner_bookings booking on booking.id=impact.booking_id where impact.club_id=target_club_id and impact.status='action_required' and exists(select 1 from public.coach_hub_team_assignments assignment where assignment.club_id=target_club_id and assignment.person_id=coach_person_id and assignment.status='active' and (private.same_contact_team(target_club_id,assignment.team_key,assignment.team_name,booking.team_key,booking.team_name) or (
 nullif(trim(coalesce(booking.team_key,'')),'') is null
 and nullif(trim(coalesce(booking.team_name,'')),'') is not null
 and regexp_replace(lower(assignment.team_name),'[^a-z0-9]+','','g')=regexp_replace(lower(booking.team_name),'[^a-z0-9]+','','g')
 and (select count(distinct known.team_key) from public.coach_hub_team_assignments known
 where known.club_id=booking.club_id and known.status='active'
 and regexp_replace(lower(known.team_name),'[^a-z0-9]+','','g')=regexp_replace(lower(booking.team_name),'[^a-z0-9]+','','g'))=1)))),'[]'::jsonb)
  );
end;
$function$;

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
    join public.coach_hub_people person on person.id=assignment.person_id and person.club_id=assignment.club_id and person.status='active'
    where assignment.club_id=new.club_id
      and assignment.status='active'
      and (private.same_contact_team(new.club_id,assignment.team_key,assignment.team_name,new.team_key,new.team_name) or (
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
$function$;

CREATE OR REPLACE FUNCTION public.publish_coach_hub_matchweek_messages(target_club_id uuid, messages jsonb, target_day_scope text DEFAULT NULL::text, target_matchday_date text DEFAULT NULL::text, target_snapshot_hash text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare actor_id uuid:=auth.uid(); item jsonb; team_value text; identity_value text; inserted_id uuid; published_count integer:=0; reused_count integer:=0; approval public.matchday_locks%rowtype;
begin
  if actor_id is null or not public.can_publish_club_matchweek(target_club_id) then raise exception 'Matchweek publisher access required' using errcode='42501'; end if;
  if nullif(trim(coalesce(target_day_scope,'')),'') is not null then
    select * into approval from public.matchday_locks lock_state where lock_state.club_id=target_club_id and lock_state.day_scope=left(lower(trim(target_day_scope)),40) and lock_state.matchday_date=left(trim(coalesce(target_matchday_date,'')),80);
    if not found or not approval.locked then raise exception 'This matchday is not locked for publication' using errcode='22023'; end if;
    if approval.snapshot_hash is distinct from left(trim(coalesce(target_snapshot_hash,'')),100) then raise exception 'The fixture plan changed after approval. Unlock, review and lock it again' using errcode='22023'; end if;
  end if;
  if jsonb_typeof(messages)<>'array' or jsonb_array_length(messages)=0 then raise exception 'Choose at least one Coach Hub message' using errcode='22023'; end if;
  if jsonb_array_length(messages)>100 then raise exception 'Coach Hub batches are limited to 100 messages' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(messages) loop
    team_value:=nullif(left(trim(coalesce(item->>'team_key','')),180),''); identity_value:=nullif(left(trim(coalesce(item->>'message_identity','')),500),'');
    if team_value is null or identity_value is null or nullif(trim(coalesce(item->>'body','')),'') is null then raise exception 'Every Coach Hub message requires a team, identity and body' using errcode='22023'; end if;
    if not exists(select 1 from public.coach_hub_team_assignments assignment where assignment.club_id=target_club_id and private.same_contact_team(target_club_id,assignment.team_key,assignment.team_name,team_value,team_value) and assignment.status='active') then raise exception 'No active Coach Hub assignment exists for team %',team_value using errcode='22023'; end if;
    inserted_id:=null;
    insert into public.coach_hub_messages(club_id,person_id,team_key,message_type,title,body,related_type,related_id,requires_acknowledgement,created_by,expires_at)
    values(target_club_id,null,team_value,'fixture_change',left(coalesce(nullif(trim(item->>'title'),''),'Matchweek update'),180),left(trim(item->>'body'),8000),'matchweek_communication',identity_value,coalesce((item->>'requires_acknowledgement')::boolean,true),actor_id,now()+interval '21 days')
    on conflict(club_id,team_key,related_type,related_id) where related_type='matchweek_communication' and team_key is not null do nothing returning id into inserted_id;
    if inserted_id is null then reused_count:=reused_count+1; else published_count:=published_count+1; end if;
  end loop;
  perform public.record_audit_event(target_club_id,'communications.coach_hub.published','coach_hub_message_batch',actor_id::text,jsonb_build_object('published',published_count,'reused',reused_count,'day_scope',target_day_scope,'matchday_date',target_matchday_date,'snapshot_hash',target_snapshot_hash));
  return jsonb_build_object('published',published_count,'reused',reused_count);
end; $function$;

CREATE OR REPLACE FUNCTION private.sync_coach_hub_booking_reminders()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
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
  where assignment.club_id=new.club_id and private.same_contact_team(new.club_id,assignment.team_key,assignment.team_name,new.team_key,new.team_name) and assignment.status='active' and new.start_at>now()
  on conflict(booking_id,person_id,reminder_type) do update set due_at=excluded.due_at,status='pending',delivery_error=null,updated_at=now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_coach_hub_matchweek_delivery_status(target_club_id uuid, result_limit integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
begin
  if auth.uid() is null or not public.can_communicate_club(target_club_id) then
    raise exception 'Club communications access required' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(status_row) order by status_row.created_at desc)
    from (
      select message.id, message.team_key, message.title, message.related_id, message.created_at,
        count(distinct person.user_id) filter (where person.user_id is not null) as expected_recipients,
        count(distinct receipt.user_id) filter (where receipt.read_at is not null) as read_count,
        count(distinct receipt.user_id) filter (where receipt.acknowledged_at is not null) as acknowledged_count
      from public.coach_hub_messages message
      left join public.coach_hub_team_assignments assignment
        on assignment.club_id = message.club_id and private.same_contact_team(target_club_id,assignment.team_key,assignment.team_name,message.team_key,message.team_key) and assignment.status = 'active'
      left join public.coach_hub_people person on person.id = assignment.person_id and person.status = 'active'
      left join public.coach_hub_message_receipts receipt on receipt.message_id = message.id
      where message.club_id = target_club_id and message.related_type = 'matchweek_communication'
      group by message.id
      order by message.created_at desc
      limit greatest(1, least(coalesce(result_limit, 30), 100))
    ) status_row
  ), '[]'::jsonb);
end;
$function$;

CREATE OR REPLACE FUNCTION public.mark_coach_hub_message(target_club_id uuid, target_message_id uuid, acknowledge boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  coach_person_id uuid := private.current_coach_person_id(target_club_id);
  message_row public.coach_hub_messages%rowtype;
begin
  if coach_person_id is null then raise exception 'Coach Hub access denied' using errcode = '42501'; end if;
  select message.* into message_row
  from public.coach_hub_messages message
  where message.id = target_message_id
    and message.club_id = target_club_id
    and (
      message.person_id = coach_person_id
      or (
        message.person_id is null
        and (
          message.team_key is null
          or exists (
            select 1 from public.coach_hub_team_assignments assignment
            where assignment.club_id = target_club_id
              and assignment.person_id = coach_person_id
              and private.same_contact_team(target_club_id,assignment.team_key,assignment.team_name,message.team_key,message.team_key)
              and assignment.status = 'active'
          )
        )
      )
    );
  if message_row.id is null then raise exception 'Message not found' using errcode = 'P0002'; end if;
  insert into public.coach_hub_message_receipts(message_id, user_id, read_at, acknowledged_at)
  values(message_row.id, auth.uid(), now(), case when acknowledge then now() else null end)
  on conflict(message_id, user_id) do update set
    read_at = coalesce(public.coach_hub_message_receipts.read_at, now()),
    acknowledged_at = case when acknowledge then now() else public.coach_hub_message_receipts.acknowledged_at end,
    updated_at = now();
  return jsonb_build_object('message_id', message_row.id, 'read_at', now(), 'acknowledged', acknowledge);
end;
$function$;
