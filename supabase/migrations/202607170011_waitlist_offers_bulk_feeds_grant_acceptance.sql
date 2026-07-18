-- Daxora Ground Control v3.10.12
-- Waiting-list offers, bulk planner commands, operator calendar feeds and grant evidence completion.
begin;

create table if not exists public.annual_planner_waitlist_offers (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  waitlist_entry_id uuid not null references public.annual_planner_waitlist_entries(id) on delete cascade,
  team_key text not null,
  team_name text not null,
  status text not null default 'offered' check (status in ('offered','accepted','declined','expired','revoked')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  venue_id text,
  venue_name text,
  pitch_id text,
  pitch_name text,
  pitch_area_id text,
  pitch_area_name text,
  site_inventory_id uuid references public.annual_planner_sites(id) on delete set null,
  site_slot_id uuid references public.annual_planner_site_slots(id) on delete set null,
  message text,
  coach_response text,
  expires_at timestamptz,
  booking_id uuid references public.annual_planner_bookings(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  responded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  check (end_at>start_at)
);

create table if not exists public.annual_planner_bulk_commands (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  command_type text not null check (command_type in ('change_status','move_pitch','shift_dates')),
  booking_ids uuid[] not null,
  affected_count integer not null default 0,
  command_data jsonb not null default '{}'::jsonb,
  status text not null default 'completed' check (status in ('completed','failed')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.annual_planner_calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  label text not null,
  scope_type text not null default 'club' check (scope_type in ('club','team','season')),
  scope_key text,
  season_phase text not null default 'all' check (season_phase in ('all','preseason','regular','winter')),
  token text not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null
);

create index if not exists annual_planner_waitlist_offers_club_status_idx on public.annual_planner_waitlist_offers(club_id,status,created_at desc);
create index if not exists annual_planner_waitlist_offers_team_idx on public.annual_planner_waitlist_offers(club_id,team_key,status);
create index if not exists annual_planner_bulk_commands_club_idx on public.annual_planner_bulk_commands(club_id,created_at desc);
create index if not exists annual_planner_calendar_feeds_club_idx on public.annual_planner_calendar_feeds(club_id,revoked_at,created_at desc);

alter table public.annual_planner_waitlist_offers enable row level security;
alter table public.annual_planner_waitlist_offers force row level security;
alter table public.annual_planner_bulk_commands enable row level security;
alter table public.annual_planner_bulk_commands force row level security;
alter table public.annual_planner_calendar_feeds enable row level security;
alter table public.annual_planner_calendar_feeds force row level security;

revoke all on table public.annual_planner_waitlist_offers,public.annual_planner_bulk_commands,public.annual_planner_calendar_feeds from public,anon,authenticated;

drop policy if exists annual_planner_waitlist_offers_operator_read on public.annual_planner_waitlist_offers;
create policy annual_planner_waitlist_offers_operator_read on public.annual_planner_waitlist_offers for select to authenticated using (public.can_manage_club(club_id));
drop policy if exists annual_planner_waitlist_offers_operator_write on public.annual_planner_waitlist_offers;
create policy annual_planner_waitlist_offers_operator_write on public.annual_planner_waitlist_offers for all to authenticated using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));
drop policy if exists annual_planner_bulk_commands_operator on public.annual_planner_bulk_commands;
create policy annual_planner_bulk_commands_operator on public.annual_planner_bulk_commands for all to authenticated using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));
drop policy if exists annual_planner_calendar_feeds_operator on public.annual_planner_calendar_feeds;
create policy annual_planner_calendar_feeds_operator on public.annual_planner_calendar_feeds for all to authenticated using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

create or replace function public.offer_annual_planner_waitlist_slot(target_club_id uuid,offer_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security=off
as $$
declare
  actor_id uuid:=auth.uid();
  waitlist_id uuid:=nullif(offer_data->>'waitlist_entry_id','')::uuid;
  waitlist_row public.annual_planner_waitlist_entries%rowtype;
  start_value timestamptz:=(offer_data->>'start_at')::timestamptz;
  end_value timestamptz:=(offer_data->>'end_at')::timestamptz;
  result public.annual_planner_waitlist_offers%rowtype;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then raise exception 'Club owner or administrator access required' using errcode='42501'; end if;
  select * into waitlist_row from public.annual_planner_waitlist_entries entry where entry.id=waitlist_id and entry.club_id=target_club_id;
  if waitlist_row.id is null then raise exception 'Waitlist entry not found' using errcode='P0002'; end if;
  if end_value is null or start_value is null or end_value<=start_value then raise exception 'A valid offered time is required' using errcode='22023'; end if;
  if not private.pitch_area_buffered_slot_available(target_club_id,nullif(offer_data->>'pitch_id',''),nullif(offer_data->>'pitch_area_id',''),start_value,end_value,'training',0,0,null) then
    raise exception 'The offered pitch or area is unavailable' using errcode='23P01';
  end if;
  update public.annual_planner_waitlist_offers offer set status='revoked',updated_at=now()
  where offer.club_id=target_club_id and offer.waitlist_entry_id=waitlist_id and offer.status='offered';
  insert into public.annual_planner_waitlist_offers(club_id,waitlist_entry_id,team_key,team_name,start_at,end_at,venue_id,venue_name,pitch_id,pitch_name,pitch_area_id,pitch_area_name,site_inventory_id,site_slot_id,message,expires_at,created_by)
  values(target_club_id,waitlist_id,waitlist_row.team_key,waitlist_row.team_name,start_value,end_value,nullif(offer_data->>'venue_id',''),nullif(offer_data->>'venue_name',''),nullif(offer_data->>'pitch_id',''),nullif(offer_data->>'pitch_name',''),nullif(offer_data->>'pitch_area_id',''),nullif(offer_data->>'pitch_area_name',''),nullif(offer_data->>'site_inventory_id','')::uuid,nullif(offer_data->>'site_slot_id','')::uuid,nullif(offer_data->>'message',''),coalesce(nullif(offer_data->>'expires_at','')::timestamptz,now()+interval '7 days'),actor_id)
  returning * into result;
  update public.annual_planner_waitlist_entries entry set status='offered',updated_by=actor_id,updated_at=now() where entry.id=waitlist_id;
  insert into public.coach_hub_messages(club_id,person_id,team_key,message_type,title,body,related_type,related_id,requires_acknowledgement,created_by)
  select target_club_id,assignment.person_id,waitlist_row.team_key,'training_request','Training slot offered',coalesce(nullif(result.message,''),'Open Coach Hub to accept or decline the offered training slot.'),'annual_planner_waitlist_offer',result.id::text,true,actor_id
  from public.coach_hub_team_assignments assignment
  join public.coach_hub_people person on person.id=assignment.person_id and person.status='active'
  where assignment.club_id=target_club_id and assignment.team_key=waitlist_row.team_key and assignment.status='active';
  perform public.record_audit_event(target_club_id,'annual_planner.waitlist_offer.created','annual_planner_waitlist_offer',result.id::text,jsonb_build_object('team_key',result.team_key,'start_at',result.start_at,'pitch_id',result.pitch_id,'pitch_area_id',result.pitch_area_id));
  return to_jsonb(result);
end;
$$;

create or replace function public.list_my_annual_planner_waitlist_offers(target_club_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
set row_security=off
as $$
declare coach_person_id uuid:=private.current_coach_person_id(target_club_id);
begin
  if coach_person_id is null then raise exception 'Coach Hub access required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(offer) order by offer.created_at desc)
    from public.annual_planner_waitlist_offers offer
    where offer.club_id=target_club_id
      and offer.team_key in (select assignment.team_key from public.coach_hub_team_assignments assignment where assignment.club_id=target_club_id and assignment.person_id=coach_person_id and assignment.status='active')
      and offer.status in ('offered','accepted','declined')
  ),'[]'::jsonb);
end;
$$;

create or replace function public.respond_to_annual_planner_waitlist_offer(target_club_id uuid,target_offer_id uuid,response_value text,coach_message text default null)
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security=off
as $$
declare
  actor_id uuid:=auth.uid();
  coach_person_id uuid:=private.current_coach_person_id(target_club_id);
  offer_row public.annual_planner_waitlist_offers%rowtype;
  waitlist_row public.annual_planner_waitlist_entries%rowtype;
  booking_result jsonb;
  booking_id_value uuid;
  response_text text:=lower(trim(coalesce(response_value,'')));
begin
  if coach_person_id is null then raise exception 'Coach Hub access required' using errcode='42501'; end if;
  select * into offer_row from public.annual_planner_waitlist_offers offer where offer.id=target_offer_id and offer.club_id=target_club_id for update;
  if offer_row.id is null then raise exception 'Waitlist offer not found' using errcode='P0002'; end if;
  if offer_row.status<>'offered' then raise exception 'This waitlist offer has already been answered' using errcode='22023'; end if;
  if offer_row.expires_at is not null and offer_row.expires_at<now() then update public.annual_planner_waitlist_offers set status='expired',updated_at=now() where id=offer_row.id; raise exception 'This waitlist offer has expired' using errcode='22023'; end if;
  if not exists(select 1 from public.coach_hub_team_assignments assignment where assignment.club_id=target_club_id and assignment.person_id=coach_person_id and assignment.team_key=offer_row.team_key and assignment.status='active') then raise exception 'This offer is not assigned to your team' using errcode='42501'; end if;
  select * into waitlist_row from public.annual_planner_waitlist_entries entry where entry.id=offer_row.waitlist_entry_id;
  if response_text='accept' then
    if not private.pitch_area_buffered_slot_available(target_club_id,offer_row.pitch_id,offer_row.pitch_area_id,offer_row.start_at,offer_row.end_at,'training',0,0,null) then
      raise exception 'The offered pitch or area is no longer available' using errcode='23P01';
    end if;
    if not private.annual_planner_resources_available(target_club_id,waitlist_row.resource_requirements,offer_row.start_at,offer_row.end_at,0,0,null) then
      raise exception 'A required shared resource is no longer available' using errcode='23P01';
    end if;
    if exists(select 1 from public.annual_planner_bookings existing where existing.club_id=target_club_id and existing.team_key=offer_row.team_key and existing.status in ('requested','provisional','confirmed') and tstzrange(existing.start_at,existing.end_at,'[)') && tstzrange(offer_row.start_at,offer_row.end_at,'[)')) then
      raise exception 'This team already has an active booking at the offered time' using errcode='23P01';
    end if;
    insert into public.annual_planner_bookings(
      club_id,title,booking_type,status,team_key,team_name,venue_id,venue_name,pitch_id,pitch_name,pitch_area_id,pitch_area_name,season_phase,site_inventory_id,site_slot_id,
      start_at,end_at,recurrence,cost_pence,notes,source_type,source_id,approved_by,approved_at,created_by,updated_by,participant_count,resource_requirements
    ) values(
      target_club_id,offer_row.team_name||' training','training','confirmed',offer_row.team_key,offer_row.team_name,offer_row.venue_id,offer_row.venue_name,offer_row.pitch_id,offer_row.pitch_name,offer_row.pitch_area_id,offer_row.pitch_area_name,
      waitlist_row.season_phase,offer_row.site_inventory_id,offer_row.site_slot_id,offer_row.start_at,offer_row.end_at,'none',0,'Accepted from training waitlist offer '||offer_row.id::text,'annual_planner_waitlist_offer',offer_row.id::text,
      offer_row.created_by,now(),actor_id,actor_id,waitlist_row.participant_count,waitlist_row.resource_requirements
    ) returning id into booking_id_value;
    update public.annual_planner_waitlist_offers set status='accepted',coach_response=nullif(coach_message,''),booking_id=booking_id_value,responded_by=actor_id,responded_at=now(),updated_at=now() where id=offer_row.id returning * into offer_row;
    update public.annual_planner_waitlist_entries set status='allocated',updated_by=actor_id,updated_at=now() where id=offer_row.waitlist_entry_id;
  elsif response_text='decline' then
    update public.annual_planner_waitlist_offers set status='declined',coach_response=nullif(coach_message,''),responded_by=actor_id,responded_at=now(),updated_at=now() where id=offer_row.id returning * into offer_row;
    update public.annual_planner_waitlist_entries set status='waiting',updated_by=actor_id,updated_at=now() where id=offer_row.waitlist_entry_id;
  else raise exception 'Response must be accept or decline' using errcode='22023'; end if;
  perform private.record_coach_hub_audit_event(target_club_id,'annual_planner.waitlist_offer.responded','annual_planner_waitlist_offer',offer_row.id::text,jsonb_build_object('response',response_text,'team_key',offer_row.team_key));
  return to_jsonb(offer_row);
end;
$$;

create or replace function public.apply_annual_planner_bulk_command(target_club_id uuid,command_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security=off
as $$
declare
  actor_id uuid:=auth.uid();
  command_type_value text:=lower(trim(coalesce(command_data->>'command_type','change_status')));
  booking_ids_value uuid[]:=coalesce(array(select value::uuid from jsonb_array_elements_text(coalesce(command_data->'booking_ids','[]'::jsonb)) row_value(value)),'{}'::uuid[]);
  booking_row public.annual_planner_bookings%rowtype;
  changed integer:=0;
  target_status text:=lower(trim(coalesce(command_data->>'status','')));
  target_pitch_id text:=nullif(command_data->>'pitch_id','');
  target_pitch_name text:=nullif(command_data->>'pitch_name','');
  target_area_id text:=nullif(command_data->>'pitch_area_id','');
  target_area_name text:=nullif(command_data->>'pitch_area_name','');
  shift_days_value integer:=greatest(-365,least(365,coalesce((command_data->>'shift_days')::integer,0)));
  command_row public.annual_planner_bulk_commands%rowtype;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then raise exception 'Club owner or administrator access required' using errcode='42501'; end if;
  if coalesce(array_length(booking_ids_value,1),0)=0 then raise exception 'Select at least one booking' using errcode='22023'; end if;
  if command_type_value not in ('change_status','move_pitch','shift_dates') then raise exception 'Unsupported bulk command' using errcode='22023'; end if;
  for booking_row in select * from public.annual_planner_bookings booking where booking.club_id=target_club_id and booking.id=any(booking_ids_value) for update loop
    if command_type_value='change_status' then
      if target_status not in ('requested','provisional','confirmed','postponed','cancelled','completed') then raise exception 'Choose a valid booking status' using errcode='22023'; end if;
      update public.annual_planner_bookings set status=target_status,updated_at=now() where id=booking_row.id;
    elsif command_type_value='move_pitch' then
      if target_pitch_id is null then raise exception 'Choose a target pitch' using errcode='22023'; end if;
      if not private.pitch_area_buffered_slot_available(target_club_id,target_pitch_id,target_area_id,booking_row.start_at,booking_row.end_at,booking_row.booking_type,booking_row.setup_buffer_minutes,booking_row.clear_down_buffer_minutes,booking_row.id) then raise exception 'A selected booking cannot move to the target pitch or area' using errcode='23P01'; end if;
      update public.annual_planner_bookings set pitch_id=target_pitch_id,pitch_name=target_pitch_name,pitch_area_id=target_area_id,pitch_area_name=target_area_name,updated_at=now() where id=booking_row.id;
    else
      if shift_days_value=0 then raise exception 'Choose a non-zero date shift' using errcode='22023'; end if;
      if not private.pitch_area_buffered_slot_available(target_club_id,booking_row.pitch_id,booking_row.pitch_area_id,booking_row.start_at+make_interval(days=>shift_days_value),booking_row.end_at+make_interval(days=>shift_days_value),booking_row.booking_type,booking_row.setup_buffer_minutes,booking_row.clear_down_buffer_minutes,booking_row.id) then raise exception 'A selected booking conflicts after the date shift' using errcode='23P01'; end if;
      update public.annual_planner_bookings set start_at=booking_row.start_at+make_interval(days=>shift_days_value),end_at=booking_row.end_at+make_interval(days=>shift_days_value),updated_at=now() where id=booking_row.id;
    end if;
    changed:=changed+1;
  end loop;
  if changed<>coalesce(array_length(booking_ids_value,1),0) then raise exception 'One or more selected bookings were not found' using errcode='P0002'; end if;
  insert into public.annual_planner_bulk_commands(club_id,command_type,booking_ids,affected_count,command_data,status,created_by)
  values(target_club_id,command_type_value,booking_ids_value,changed,command_data,'completed',actor_id) returning * into command_row;
  perform public.record_audit_event(target_club_id,'annual_planner.bulk_command.completed','annual_planner_bulk_command',command_row.id::text,jsonb_build_object('command_type',command_type_value,'affected_count',changed,'reason',command_data->>'reason'));
  return to_jsonb(command_row);
end;
$$;

create or replace function public.create_annual_planner_calendar_feed(target_club_id uuid,feed_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security=off
as $$
declare actor_id uuid:=auth.uid(); result public.annual_planner_calendar_feeds%rowtype; scope_type_value text:=lower(trim(coalesce(feed_data->>'scope_type','club'))); season_value text:=lower(trim(coalesce(feed_data->>'season_phase','all')));
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then raise exception 'Club owner or administrator access required' using errcode='42501'; end if;
  if scope_type_value not in ('club','team','season') then scope_type_value:='club'; end if;
  if season_value not in ('all','preseason','regular','winter') then season_value:='all'; end if;
  insert into public.annual_planner_calendar_feeds(club_id,label,scope_type,scope_key,season_phase,token,created_by)
  values(target_club_id,trim(coalesce(feed_data->>'label','Annual Planner calendar')),scope_type_value,nullif(feed_data->>'scope_key',''),season_value,replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),actor_id)
  returning * into result;
  perform public.record_audit_event(target_club_id,'annual_planner.calendar_feed.created','annual_planner_calendar_feed',result.id::text,jsonb_build_object('scope_type',result.scope_type,'scope_key',result.scope_key,'season_phase',result.season_phase));
  return to_jsonb(result);
end;
$$;

create or replace function public.revoke_annual_planner_calendar_feed(target_club_id uuid,target_feed_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security=off
as $$
declare actor_id uuid:=auth.uid(); result public.annual_planner_calendar_feeds%rowtype;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then raise exception 'Club owner or administrator access required' using errcode='42501'; end if;
  update public.annual_planner_calendar_feeds set revoked_at=now(),revoked_by=actor_id where id=target_feed_id and club_id=target_club_id returning * into result;
  if result.id is null then raise exception 'Calendar feed not found' using errcode='P0002'; end if;
  perform public.record_audit_event(target_club_id,'annual_planner.calendar_feed.revoked','annual_planner_calendar_feed',result.id::text,'{}'::jsonb);
  return to_jsonb(result);
end;
$$;

create or replace function public.get_annual_planner_calendar_by_token(feed_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
set row_security=off
as $$
declare feed public.annual_planner_calendar_feeds%rowtype; club_name_value text;
begin
  select * into feed from public.annual_planner_calendar_feeds calendar_feed where calendar_feed.token=trim(feed_token) and calendar_feed.revoked_at is null;
  if feed.id is null then raise exception 'Calendar feed not found' using errcode='P0002'; end if;
  select club.name into club_name_value from public.clubs club where club.id=feed.club_id;
  return jsonb_build_object(
    'label',feed.label,'club_name',club_name_value,
    'bookings',coalesce((select jsonb_agg(to_jsonb(booking)-'cost_pence'-'supplier_reference'-'admin_notes' order by booking.start_at) from public.annual_planner_bookings booking where booking.club_id=feed.club_id and booking.status not in ('cancelled','rejected') and (feed.scope_type<>'team' or booking.team_key=feed.scope_key) and (feed.scope_type<>'season' or booking.season_phase=feed.season_phase)),'[]'::jsonb),
    'blackouts',coalesce((select jsonb_agg(to_jsonb(blackout)-'internal_note' order by blackout.start_at) from public.annual_planner_blackouts blackout where blackout.club_id=feed.club_id and blackout.visibility='club'),'[]'::jsonb),
    'pitch_closures','[]'::jsonb
  );
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
    'preference_proposals',case when public.can_manage_club(target_club_id) then coalesce((select jsonb_agg(to_jsonb(proposal) order by proposal.created_at desc) from public.annual_planner_coach_preference_proposals proposal where proposal.club_id=target_club_id),'[]'::jsonb) else '[]'::jsonb end,
    'resources',coalesce((select jsonb_agg(to_jsonb(resource) order by resource.active desc,resource.name) from public.annual_planner_resources resource where resource.club_id=target_club_id),'[]'::jsonb),
    'waitlist',coalesce((select jsonb_agg(to_jsonb(waitlist) order by case waitlist.status when 'waiting' then 0 when 'offered' then 1 else 2 end,waitlist.priority desc,waitlist.created_at) from public.annual_planner_waitlist_entries waitlist where waitlist.club_id=target_club_id),'[]'::jsonb),
    'season_rollovers',coalesce((select jsonb_agg(to_jsonb(rollover) order by rollover.created_at desc) from public.annual_planner_season_rollovers rollover where rollover.club_id=target_club_id),'[]'::jsonb),
    'waitlist_offers',case when public.can_manage_club(target_club_id) then coalesce((select jsonb_agg(to_jsonb(offer) order by offer.created_at desc) from public.annual_planner_waitlist_offers offer where offer.club_id=target_club_id),'[]'::jsonb) else '[]'::jsonb end,
    'bulk_commands',case when public.can_manage_club(target_club_id) then coalesce((select jsonb_agg(to_jsonb(command_row) order by command_row.created_at desc) from public.annual_planner_bulk_commands command_row where command_row.club_id=target_club_id limit 50),'[]'::jsonb) else '[]'::jsonb end,
    'calendar_feeds',case when public.can_manage_club(target_club_id) then coalesce((select jsonb_agg(to_jsonb(feed) order by feed.created_at desc) from public.annual_planner_calendar_feeds feed where feed.club_id=target_club_id),'[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

create or replace function public.get_annual_planner_analytics_data(target_club_id uuid,range_start date default null,range_end date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
set row_security=off
as $$
declare
  start_boundary timestamptz:=coalesce(range_start,make_date(extract(year from current_date)::integer,1,1))::timestamptz;
  end_boundary timestamptz:=(coalesce(range_end,make_date(extract(year from current_date)::integer,12,31))+1)::timestamptz;
  can_view_costs boolean:=false;
begin
  if auth.uid() is null or not public.is_club_member(target_club_id) then raise exception 'Analytics access denied' using errcode='42501'; end if;
  if not private.club_has_entitlement(target_club_id,'analytics_core') then raise exception 'Analytics are not included in this workspace package' using errcode='42501'; end if;
  select public.can_manage_club(target_club_id) or coalesce((select settings.show_costs_to_schedulers from public.annual_planner_settings settings where settings.club_id=target_club_id),true) into can_view_costs;
  return jsonb_build_object(
    'bookings',coalesce((select jsonb_agg(case when can_view_costs then to_jsonb(booking) else to_jsonb(booking)-'cost_pence'-'supplier_reference' end order by booking.start_at) from public.annual_planner_bookings booking where booking.club_id=target_club_id and booking.start_at<end_boundary and booking.end_at>=start_boundary),'[]'::jsonb),
    'blackouts',coalesce((select jsonb_agg(to_jsonb(blackout) order by blackout.start_at) from public.annual_planner_blackouts blackout where blackout.club_id=target_club_id and blackout.start_at<end_boundary and blackout.end_at>=start_boundary),'[]'::jsonb),
    'winter_sites',coalesce((select jsonb_agg(case when can_view_costs then to_jsonb(site) else to_jsonb(site)-'cost_pence' end) from public.annual_planner_sites site where site.club_id=target_club_id),'[]'::jsonb),
    'winter_slots',coalesce((select jsonb_agg(case when can_view_costs then to_jsonb(slot) else to_jsonb(slot)-'cost_pence' end) from public.annual_planner_site_slots slot where slot.club_id=target_club_id),'[]'::jsonb),
    'requests',coalesce((select jsonb_agg(to_jsonb(request_row)-'admin_notes' order by request_row.created_at) from public.coach_hub_requests request_row where request_row.club_id=target_club_id and request_row.created_at<end_boundary and request_row.created_at>=start_boundary),'[]'::jsonb),
    'allocation_runs',coalesce((select jsonb_agg(to_jsonb(run) order by run.created_at) from public.annual_planner_allocation_runs run where run.club_id=target_club_id and run.created_at<end_boundary and run.created_at>=start_boundary),'[]'::jsonb),
    'allocation_items',coalesce((select jsonb_agg(to_jsonb(item) order by item.created_at,item.team_name) from public.annual_planner_allocation_items item join public.annual_planner_allocation_runs run on run.id=item.run_id where item.club_id=target_club_id and run.created_at<end_boundary and run.created_at>=start_boundary),'[]'::jsonb),
    'closure_impacts',coalesce((select jsonb_agg(to_jsonb(impact)||jsonb_build_object('booking_title',booking.title,'team_key',booking.team_key,'team_name',booking.team_name,'booking_start_at',booking.start_at,'booking_end_at',booking.end_at,'pitch_id',booking.pitch_id,'pitch_name',booking.pitch_name,'pitch_area_id',booking.pitch_area_id,'pitch_area_name',booking.pitch_area_name) order by impact.created_at) from public.annual_planner_closure_impacts impact join public.annual_planner_bookings booking on booking.id=impact.booking_id where impact.club_id=target_club_id and booking.start_at<end_boundary and booking.end_at>=start_boundary),'[]'::jsonb),
    'resources',coalesce((select jsonb_agg(to_jsonb(resource) order by resource.name) from public.annual_planner_resources resource where resource.club_id=target_club_id),'[]'::jsonb),
    'waitlist',coalesce((select jsonb_agg(to_jsonb(waitlist) order by waitlist.created_at) from public.annual_planner_waitlist_entries waitlist where waitlist.club_id=target_club_id),'[]'::jsonb),
    'season_rollovers',coalesce((select jsonb_agg(to_jsonb(rollover) order by rollover.created_at) from public.annual_planner_season_rollovers rollover where rollover.club_id=target_club_id),'[]'::jsonb),
    'waitlist_offers',coalesce((select jsonb_agg(to_jsonb(offer) order by offer.created_at) from public.annual_planner_waitlist_offers offer where offer.club_id=target_club_id and offer.created_at<end_boundary and offer.created_at>=start_boundary),'[]'::jsonb),
    'bulk_commands',coalesce((select jsonb_agg(to_jsonb(command_row) order by command_row.created_at) from public.annual_planner_bulk_commands command_row where command_row.club_id=target_club_id and command_row.created_at<end_boundary and command_row.created_at>=start_boundary),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.offer_annual_planner_waitlist_slot(uuid,jsonb),public.list_my_annual_planner_waitlist_offers(uuid),public.respond_to_annual_planner_waitlist_offer(uuid,uuid,text,text),public.apply_annual_planner_bulk_command(uuid,jsonb),public.create_annual_planner_calendar_feed(uuid,jsonb),public.revoke_annual_planner_calendar_feed(uuid,uuid),public.get_annual_planner_calendar_by_token(text),public.list_annual_planner_scheduling_context(uuid),public.get_annual_planner_analytics_data(uuid,date,date) from public,anon;
grant execute on function public.offer_annual_planner_waitlist_slot(uuid,jsonb),public.list_my_annual_planner_waitlist_offers(uuid),public.respond_to_annual_planner_waitlist_offer(uuid,uuid,text,text),public.apply_annual_planner_bulk_command(uuid,jsonb),public.create_annual_planner_calendar_feed(uuid,jsonb),public.revoke_annual_planner_calendar_feed(uuid,uuid),public.list_annual_planner_scheduling_context(uuid),public.get_annual_planner_analytics_data(uuid,date,date) to authenticated;
grant execute on function public.get_annual_planner_calendar_by_token(text) to anon,authenticated;

comment on table public.annual_planner_waitlist_offers is 'Coach-response offers that turn unresolved training demand into confirmed capacity only after acceptance.';
comment on table public.annual_planner_bulk_commands is 'Audited transactional operator changes across selected Annual Planner bookings.';
comment on table public.annual_planner_calendar_feeds is 'Revocable private Annual Planner calendar subscription feeds.';
notify pgrst,'reload schema';
commit;
