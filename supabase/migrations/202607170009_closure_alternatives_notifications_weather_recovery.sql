-- Daxora Ground Control v3.10.9
-- Closure-impact resolution, coach alternatives, notifications and weather recovery.
begin;

alter table public.annual_planner_closure_impacts
  drop constraint if exists annual_planner_closure_impacts_status_check;

alter table public.annual_planner_closure_impacts
  add constraint annual_planner_closure_impacts_status_check
  check (status in ('action_required','awaiting_coach','acknowledged','relocated','postponed','cancelled','resolved'));

alter table public.annual_planner_closure_impacts
  add column if not exists resolution_action text,
  add column if not exists proposed_start_at timestamptz,
  add column if not exists proposed_end_at timestamptz,
  add column if not exists proposed_venue_id text,
  add column if not exists proposed_venue_name text,
  add column if not exists proposed_pitch_id text,
  add column if not exists proposed_pitch_name text,
  add column if not exists proposed_pitch_area_id text,
  add column if not exists proposed_pitch_area_name text,
  add column if not exists proposed_site_inventory_id uuid references public.annual_planner_sites(id) on delete set null,
  add column if not exists proposed_site_slot_id uuid references public.annual_planner_site_slots(id) on delete set null,
  add column if not exists coach_response_status text not null default 'not_required'
    check (coach_response_status in ('not_required','pending','accepted','declined')),
  add column if not exists public_message text,
  add column if not exists internal_note text,
  add column if not exists last_notified_at timestamptz;

create table if not exists public.annual_planner_booking_alternatives (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  impact_id uuid not null unique references public.annual_planner_closure_impacts(id) on delete cascade,
  booking_id uuid not null references public.annual_planner_bookings(id) on delete cascade,
  team_key text not null,
  status text not null default 'offered'
    check (status in ('offered','accepted','declined','withdrawn','expired')),
  proposed_start_at timestamptz not null,
  proposed_end_at timestamptz not null,
  proposed_venue_id text,
  proposed_venue_name text,
  proposed_pitch_id text,
  proposed_pitch_name text,
  proposed_pitch_area_id text,
  proposed_pitch_area_name text,
  proposed_site_inventory_id uuid references public.annual_planner_sites(id) on delete set null,
  proposed_site_slot_id uuid references public.annual_planner_site_slots(id) on delete set null,
  message text,
  coach_response_message text,
  offered_by uuid references auth.users(id) on delete set null,
  offered_at timestamptz not null default now(),
  responded_by uuid references auth.users(id) on delete set null,
  responded_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists annual_planner_booking_alternatives_club_status_idx
  on public.annual_planner_booking_alternatives(club_id,status,offered_at desc);
create index if not exists annual_planner_booking_alternatives_team_idx
  on public.annual_planner_booking_alternatives(club_id,team_key,status);

alter table public.annual_planner_booking_alternatives enable row level security;
alter table public.annual_planner_booking_alternatives force row level security;
revoke all on table public.annual_planner_booking_alternatives from public,anon,authenticated;

drop policy if exists annual_planner_booking_alternatives_operator_read on public.annual_planner_booking_alternatives;
create policy annual_planner_booking_alternatives_operator_read on public.annual_planner_booking_alternatives
  for select to authenticated using (public.can_operate_club(club_id));

drop policy if exists annual_planner_booking_alternatives_coach_read on public.annual_planner_booking_alternatives;
create policy annual_planner_booking_alternatives_coach_read on public.annual_planner_booking_alternatives
  for select to authenticated using (
    exists (
      select 1
      from public.coach_hub_team_assignments assignment
      join public.coach_hub_people person on person.id=assignment.person_id
      where assignment.club_id=annual_planner_booking_alternatives.club_id
        and assignment.team_key=annual_planner_booking_alternatives.team_key
        and assignment.status='active'
        and person.user_id=auth.uid()
        and person.status='active'
    )
  );

create or replace function private.queue_annual_planner_coach_notification(
  target_club_id uuid,
  target_booking_id uuid,
  title_value text,
  body_value text,
  message_type_value text default 'fixture_change',
  reminder_type_value text default 'change',
  acknowledgement_required boolean default true
)
returns integer
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  booking_row public.annual_planner_bookings%rowtype;
  inserted_count integer:=0;
begin
  select * into booking_row
  from public.annual_planner_bookings booking
  where booking.id=target_booking_id and booking.club_id=target_club_id;
  if booking_row.id is null then return 0; end if;

  insert into public.coach_hub_messages(
    club_id,person_id,team_key,message_type,title,body,related_type,related_id,
    requires_acknowledgement,created_by
  )
  select target_club_id,assignment.person_id,booking_row.team_key,
    coalesce(nullif(message_type_value,''),'fixture_change'),
    coalesce(nullif(title_value,''),'Booking update'),
    coalesce(nullif(body_value,''),'Open Coach Hub for the latest booking update.'),
    'annual_planner_booking',booking_row.id::text,acknowledgement_required,auth.uid()
  from public.coach_hub_team_assignments assignment
  join public.coach_hub_people person on person.id=assignment.person_id and person.status='active'
  where assignment.club_id=target_club_id
    and assignment.team_key=booking_row.team_key
    and assignment.status='active';
  get diagnostics inserted_count=row_count;

  if reminder_type_value in ('change','cancellation') then
    insert into public.coach_hub_booking_reminders(
      club_id,booking_id,person_id,team_key,reminder_type,due_at,status,updated_at
    )
    select target_club_id,booking_row.id,assignment.person_id,booking_row.team_key,
      reminder_type_value,now(),'pending',now()
    from public.coach_hub_team_assignments assignment
    join public.coach_hub_people person on person.id=assignment.person_id and person.status='active'
    where assignment.club_id=target_club_id
      and assignment.team_key=booking_row.team_key
      and assignment.status='active'
    on conflict(booking_id,person_id,reminder_type) do update set
      due_at=excluded.due_at,status='pending',delivery_reference=null,delivery_error=null,
      sent_at=null,acknowledged_at=null,updated_at=now();
  end if;

  return inserted_count;
end;
$$;

create or replace function public.list_annual_planner_closure_impacts(
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
  start_boundary timestamptz:=coalesce(range_start,current_date-interval '30 days');
  end_boundary timestamptz:=coalesce(range_end,current_date+interval '400 days')+interval '1 day';
begin
  if auth.uid() is null or not public.can_operate_club(target_club_id) then
    raise exception 'Club operator access required' using errcode='42501';
  end if;
  return coalesce((
    select jsonb_agg(
      to_jsonb(impact)||jsonb_build_object(
        'blackout_title',blackout.title,'blackout_start_at',blackout.start_at,'blackout_end_at',blackout.end_at,
        'blackout_type',blackout.closure_type,
        'booking_title',booking.title,'booking_start_at',booking.start_at,'booking_end_at',booking.end_at,
        'booking_type',booking.booking_type,'team_name',booking.team_name,'pitch_id',booking.pitch_id,
        'pitch_name',booking.pitch_name,'pitch_area_id',booking.pitch_area_id,'pitch_area_name',booking.pitch_area_name,
        'venue_name',booking.venue_name,'season_phase',booking.season_phase,
        'alternative',case when alternative.id is null then null else to_jsonb(alternative) end
      ) order by
        case impact.status when 'action_required' then 0 when 'awaiting_coach' then 1 else 2 end,
        blackout.start_at,booking.start_at
    )
    from public.annual_planner_closure_impacts impact
    join public.annual_planner_blackouts blackout on blackout.id=impact.blackout_id
    join public.annual_planner_bookings booking on booking.id=impact.booking_id
    left join public.annual_planner_booking_alternatives alternative on alternative.impact_id=impact.id
    where impact.club_id=target_club_id
      and blackout.start_at<end_boundary and blackout.end_at>start_boundary
  ),'[]'::jsonb);
end;
$$;

create or replace function public.resolve_annual_planner_closure_impact(
  target_club_id uuid,
  target_impact_id uuid,
  resolution_data jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid:=auth.uid();
  action_value text:=lower(trim(coalesce(resolution_data->>'action',resolution_data->>'status','acknowledge')));
  impact_row public.annual_planner_closure_impacts%rowtype;
  booking_row public.annual_planner_bookings%rowtype;
  blackout_row public.annual_planner_blackouts%rowtype;
  alternative_row public.annual_planner_booking_alternatives%rowtype;
  start_value timestamptz:=nullif(resolution_data->>'start_at','')::timestamptz;
  end_value timestamptz:=nullif(resolution_data->>'end_at','')::timestamptz;
  pitch_value text:=nullif(resolution_data->>'pitch_id','');
  pitch_area_value text:=nullif(resolution_data->>'pitch_area_id','');
  site_slot_value uuid:=nullif(resolution_data->>'site_slot_id','')::uuid;
  availability_pitch text;
  public_message_value text:=nullif(trim(resolution_data->>'public_message'),'');
  internal_note_value text:=nullif(trim(resolution_data->>'internal_note'),'');
  notification_title text;
  notification_body text;
  reminder_kind text:='change';
begin
  if actor_id is null or not public.can_operate_club(target_club_id) then
    raise exception 'Club operator access required' using errcode='42501';
  end if;

  select impact.* into impact_row
  from public.annual_planner_closure_impacts impact
  where impact.id=target_impact_id and impact.club_id=target_club_id
  for update;
  if impact_row.id is null then raise exception 'Closure impact not found' using errcode='P0002'; end if;

  select * into booking_row from public.annual_planner_bookings booking where booking.id=impact_row.booking_id for update;
  select * into blackout_row from public.annual_planner_blackouts blackout where blackout.id=impact_row.blackout_id;
  if booking_row.id is null then raise exception 'Affected booking not found' using errcode='P0002'; end if;

  if action_value in ('relocate','offer_alternative') then
    if start_value is null or end_value is null or end_value<=start_value then
      raise exception 'Choose a valid replacement date and time' using errcode='22023';
    end if;
    if site_slot_value is not null then
      availability_pitch:='winter-slot:'||site_slot_value::text;
    else
      availability_pitch:=pitch_value;
    end if;
    if availability_pitch is null then raise exception 'Choose a replacement facility' using errcode='22023'; end if;
    perform pg_advisory_xact_lock(hashtext(target_club_id::text||':closure-impact:'||availability_pitch));
    if not private.pitch_area_slot_available(
      target_club_id,availability_pitch,pitch_area_value,start_value,end_value,
      booking_row.booking_type,booking_row.id
    ) then raise exception 'The proposed replacement is unavailable or has reached capacity' using errcode='23P01'; end if;
    if exists(
      select 1 from public.annual_planner_blackouts blackout
      where blackout.club_id=target_club_id and blackout.id<>impact_row.blackout_id
        and (blackout.venue_id is null or nullif(resolution_data->>'venue_id','') is null or blackout.venue_id=resolution_data->>'venue_id')
        and (blackout.pitch_id is null or pitch_value is null or blackout.pitch_id=pitch_value)
        and tstzrange(blackout.start_at,blackout.end_at,'[)') && tstzrange(start_value,end_value,'[)')
    ) then raise exception 'The proposed replacement overlaps another unavailable period' using errcode='23P01'; end if;
  end if;

  if action_value='offer_alternative' then
    insert into public.annual_planner_booking_alternatives(
      club_id,impact_id,booking_id,team_key,status,proposed_start_at,proposed_end_at,
      proposed_venue_id,proposed_venue_name,proposed_pitch_id,proposed_pitch_name,
      proposed_pitch_area_id,proposed_pitch_area_name,proposed_site_inventory_id,proposed_site_slot_id,
      message,offered_by,offered_at,responded_by,responded_at,coach_response_message,updated_at
    ) values(
      target_club_id,impact_row.id,booking_row.id,booking_row.team_key,'offered',start_value,end_value,
      nullif(resolution_data->>'venue_id',''),nullif(resolution_data->>'venue_name',''),pitch_value,nullif(resolution_data->>'pitch_name',''),
      pitch_area_value,nullif(resolution_data->>'pitch_area_name',''),nullif(resolution_data->>'site_inventory_id','')::uuid,site_slot_value,
      public_message_value,actor_id,now(),null,null,null,now()
    )
    on conflict(impact_id) do update set
      status='offered',proposed_start_at=excluded.proposed_start_at,proposed_end_at=excluded.proposed_end_at,
      proposed_venue_id=excluded.proposed_venue_id,proposed_venue_name=excluded.proposed_venue_name,
      proposed_pitch_id=excluded.proposed_pitch_id,proposed_pitch_name=excluded.proposed_pitch_name,
      proposed_pitch_area_id=excluded.proposed_pitch_area_id,proposed_pitch_area_name=excluded.proposed_pitch_area_name,
      proposed_site_inventory_id=excluded.proposed_site_inventory_id,proposed_site_slot_id=excluded.proposed_site_slot_id,
      message=excluded.message,offered_by=excluded.offered_by,offered_at=now(),responded_by=null,responded_at=null,
      coach_response_message=null,updated_at=now()
    returning * into alternative_row;

    update public.annual_planner_closure_impacts impact set
      status='awaiting_coach',resolution_action='offer_alternative',proposed_start_at=start_value,proposed_end_at=end_value,
      proposed_venue_id=nullif(resolution_data->>'venue_id',''),proposed_venue_name=nullif(resolution_data->>'venue_name',''),
      proposed_pitch_id=pitch_value,proposed_pitch_name=nullif(resolution_data->>'pitch_name',''),
      proposed_pitch_area_id=pitch_area_value,proposed_pitch_area_name=nullif(resolution_data->>'pitch_area_name',''),
      proposed_site_inventory_id=nullif(resolution_data->>'site_inventory_id','')::uuid,proposed_site_slot_id=site_slot_value,
      coach_response_status='pending',public_message=public_message_value,internal_note=internal_note_value,
      resolution_note=internal_note_value,resolved_by=null,resolved_at=null,last_notified_at=now(),updated_at=now()
    where impact.id=impact_row.id returning * into impact_row;
    notification_title:='Alternative offered for affected session';
    notification_body:=coalesce(public_message_value,'A closure affects '||booking_row.title||'. The club has offered another slot. Open Coach Hub to accept or decline it.');
  elsif action_value='relocate' then
    update public.annual_planner_bookings booking set
      status='confirmed',start_at=start_value,end_at=end_value,
      venue_id=nullif(resolution_data->>'venue_id',''),venue_name=nullif(resolution_data->>'venue_name',''),
      pitch_id=pitch_value,pitch_name=nullif(resolution_data->>'pitch_name',''),
      pitch_area_id=pitch_area_value,pitch_area_name=nullif(resolution_data->>'pitch_area_name',''),
      season_phase=coalesce(nullif(resolution_data->>'season_phase',''),booking.season_phase),
      site_inventory_id=nullif(resolution_data->>'site_inventory_id','')::uuid,site_slot_id=site_slot_value,
      disruption_status='rearranged',disruption_reason=coalesce(booking.disruption_reason,blackout_row.reason,blackout_row.title),
      disruption_notes=public_message_value,original_start_at=coalesce(booking.original_start_at,booking.start_at),
      original_end_at=coalesce(booking.original_end_at,booking.end_at),updated_by=actor_id,updated_at=now()
    where booking.id=booking_row.id returning * into booking_row;
    update public.annual_planner_closure_impacts impact set
      status='relocated',resolution_action='relocate',coach_response_status='not_required',
      public_message=public_message_value,internal_note=internal_note_value,resolution_note=internal_note_value,
      resolved_by=actor_id,resolved_at=now(),last_notified_at=now(),updated_at=now()
    where impact.id=impact_row.id returning * into impact_row;
    notification_title:='Session relocated';
    notification_body:=coalesce(public_message_value,booking_row.title||' has moved to '||to_char(start_value,'Dy DD Mon HH24:MI')||coalesce(' · '||nullif(booking_row.pitch_name,''),''));
  elsif action_value='postpone' then
    update public.annual_planner_bookings booking set
      status='postponed',disruption_status='awaiting_rearrangement',
      disruption_reason=coalesce(blackout_row.reason,blackout_row.title,'Facility unavailable'),
      disruption_notes=public_message_value,disrupted_at=now(),
      original_start_at=coalesce(booking.original_start_at,booking.start_at),
      original_end_at=coalesce(booking.original_end_at,booking.end_at),updated_by=actor_id,updated_at=now()
    where booking.id=booking_row.id returning * into booking_row;
    update public.annual_planner_closure_impacts impact set
      status='postponed',resolution_action='postpone',coach_response_status='not_required',
      public_message=public_message_value,internal_note=internal_note_value,resolution_note=internal_note_value,
      resolved_by=actor_id,resolved_at=now(),last_notified_at=now(),updated_at=now()
    where impact.id=impact_row.id returning * into impact_row;
    notification_title:='Session postponed';
    notification_body:=coalesce(public_message_value,booking_row.title||' has been postponed while the club arranges another slot.');
  elsif action_value='cancel' then
    update public.annual_planner_bookings booking set
      status='cancelled',
      disruption_status=case when blackout_row.closure_type='weather' then 'weather_cancelled' else booking.disruption_status end,
      disruption_reason=coalesce(blackout_row.reason,blackout_row.title,'Facility unavailable'),
      disruption_notes=public_message_value,disrupted_at=now(),
      original_start_at=coalesce(booking.original_start_at,booking.start_at),
      original_end_at=coalesce(booking.original_end_at,booking.end_at),updated_by=actor_id,updated_at=now()
    where booking.id=booking_row.id returning * into booking_row;
    update public.annual_planner_closure_impacts impact set
      status='cancelled',resolution_action='cancel',coach_response_status='not_required',
      public_message=public_message_value,internal_note=internal_note_value,resolution_note=internal_note_value,
      resolved_by=actor_id,resolved_at=now(),last_notified_at=now(),updated_at=now()
    where impact.id=impact_row.id returning * into impact_row;
    notification_title:='Session cancelled';
    notification_body:=coalesce(public_message_value,booking_row.title||' has been cancelled because the facility is unavailable.');
    reminder_kind:='cancellation';
  elsif action_value in ('acknowledge','resolved') then
    update public.annual_planner_closure_impacts impact set
      status=case when action_value='resolved' then 'resolved' else 'acknowledged' end,
      resolution_action=action_value,coach_response_status='not_required',public_message=public_message_value,
      internal_note=internal_note_value,resolution_note=internal_note_value,resolved_by=actor_id,resolved_at=now(),updated_at=now()
    where impact.id=impact_row.id returning * into impact_row;
  else
    raise exception 'Choose offer alternative, relocate, postpone, cancel or acknowledge' using errcode='22023';
  end if;

  if notification_title is not null then
    perform private.queue_annual_planner_coach_notification(
      target_club_id,booking_row.id,notification_title,notification_body,'fixture_change',reminder_kind,true
    );
  end if;

  perform public.record_audit_event(
    target_club_id,'annual_planner.closure_impact.'||action_value,'annual_planner_closure_impact',impact_row.id::text,
    jsonb_build_object('booking_id',booking_row.id,'blackout_id',impact_row.blackout_id,'alternative_id',alternative_row.id,
      'proposed_start_at',start_value,'proposed_pitch_id',pitch_value,'proposed_pitch_area_id',pitch_area_value)
  );
  return to_jsonb(impact_row)||jsonb_build_object('alternative',case when alternative_row.id is null then null else to_jsonb(alternative_row) end);
end;
$$;

create or replace function public.list_my_annual_planner_alternatives(target_club_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare coach_person_id uuid:=private.current_coach_person_id(target_club_id);
begin
  if coach_person_id is null or not public.can_access_coach_hub(target_club_id) then
    raise exception 'Coach Hub access denied' using errcode='42501';
  end if;
  return coalesce((
    select jsonb_agg(
      to_jsonb(alternative)||jsonb_build_object(
        'booking_title',booking.title,'booking_type',booking.booking_type,'team_name',booking.team_name,
        'current_start_at',booking.start_at,'current_end_at',booking.end_at,
        'current_venue_name',booking.venue_name,'current_pitch_name',booking.pitch_name,
        'current_pitch_area_name',booking.pitch_area_name,
        'closure_title',blackout.title,'closure_reason',blackout.reason
      ) order by alternative.offered_at desc
    )
    from public.annual_planner_booking_alternatives alternative
    join public.annual_planner_bookings booking on booking.id=alternative.booking_id
    join public.annual_planner_closure_impacts impact on impact.id=alternative.impact_id
    join public.annual_planner_blackouts blackout on blackout.id=impact.blackout_id
    where alternative.club_id=target_club_id
      and alternative.team_key in (
        select assignment.team_key
        from public.coach_hub_team_assignments assignment
        where assignment.person_id=coach_person_id and assignment.status='active'
      )
      and alternative.status in ('offered','accepted','declined')
  ),'[]'::jsonb);
end;
$$;

create or replace function public.respond_to_annual_planner_alternative(
  target_club_id uuid,
  target_alternative_id uuid,
  response_value text,
  coach_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid:=auth.uid();
  coach_person_id uuid:=private.current_coach_person_id(target_club_id);
  response_safe text:=lower(trim(coalesce(response_value,'')));
  alternative_row public.annual_planner_booking_alternatives%rowtype;
  impact_row public.annual_planner_closure_impacts%rowtype;
  booking_row public.annual_planner_bookings%rowtype;
  availability_pitch text;
begin
  if actor_id is null or coach_person_id is null or not public.can_access_coach_hub(target_club_id) then
    raise exception 'Coach Hub access denied' using errcode='42501';
  end if;
  if response_safe not in ('accept','decline') then raise exception 'Choose accept or decline' using errcode='22023'; end if;

  select alternative.* into alternative_row
  from public.annual_planner_booking_alternatives alternative
  where alternative.id=target_alternative_id and alternative.club_id=target_club_id
    and alternative.status='offered'
    and alternative.team_key in (
      select assignment.team_key from public.coach_hub_team_assignments assignment
      where assignment.person_id=coach_person_id and assignment.status='active'
    )
  for update;
  if alternative_row.id is null then raise exception 'This alternative is no longer awaiting a response' using errcode='P0002'; end if;

  select * into booking_row from public.annual_planner_bookings booking where booking.id=alternative_row.booking_id for update;
  select * into impact_row from public.annual_planner_closure_impacts impact where impact.id=alternative_row.impact_id for update;

  if response_safe='accept' then
    availability_pitch:=case when alternative_row.proposed_site_slot_id is not null then 'winter-slot:'||alternative_row.proposed_site_slot_id::text else alternative_row.proposed_pitch_id end;
    if availability_pitch is null or not private.pitch_area_slot_available(
      target_club_id,availability_pitch,alternative_row.proposed_pitch_area_id,
      alternative_row.proposed_start_at,alternative_row.proposed_end_at,booking_row.booking_type,booking_row.id
    ) then raise exception 'The offered alternative is no longer available. Ask the club for another option.' using errcode='23P01'; end if;

    update public.annual_planner_bookings booking set
      status='confirmed',start_at=alternative_row.proposed_start_at,end_at=alternative_row.proposed_end_at,
      venue_id=alternative_row.proposed_venue_id,venue_name=alternative_row.proposed_venue_name,
      pitch_id=alternative_row.proposed_pitch_id,pitch_name=alternative_row.proposed_pitch_name,
      pitch_area_id=alternative_row.proposed_pitch_area_id,pitch_area_name=alternative_row.proposed_pitch_area_name,
      site_inventory_id=alternative_row.proposed_site_inventory_id,site_slot_id=alternative_row.proposed_site_slot_id,
      season_phase=case when alternative_row.proposed_site_slot_id is not null then 'winter' else booking.season_phase end,
      disruption_status='rearranged',original_start_at=coalesce(booking.original_start_at,booking.start_at),
      original_end_at=coalesce(booking.original_end_at,booking.end_at),updated_by=actor_id,updated_at=now()
    where booking.id=booking_row.id returning * into booking_row;

    update public.annual_planner_booking_alternatives alternative set
      status='accepted',coach_response_message=nullif(trim(coach_message),''),responded_by=actor_id,responded_at=now(),updated_at=now()
    where alternative.id=alternative_row.id returning * into alternative_row;
    update public.annual_planner_closure_impacts impact set
      status='relocated',resolution_action='alternative_accepted',coach_response_status='accepted',
      resolution_note=concat_ws(E'\n',impact.resolution_note,nullif(trim(coach_message),'')),
      resolved_by=actor_id,resolved_at=now(),updated_at=now()
    where impact.id=impact_row.id returning * into impact_row;

    insert into public.coach_hub_messages(club_id,person_id,team_key,message_type,title,body,related_type,related_id,requires_acknowledgement,created_by)
    values(target_club_id,coach_person_id,booking_row.team_key,'fixture_change','Alternative accepted',
      booking_row.title||' is now confirmed for '||to_char(booking_row.start_at,'Dy DD Mon HH24:MI')||coalesce(' · '||nullif(booking_row.pitch_name,''),''),
      'annual_planner_booking',booking_row.id::text,false,actor_id);
  else
    update public.annual_planner_booking_alternatives alternative set
      status='declined',coach_response_message=nullif(trim(coach_message),''),responded_by=actor_id,responded_at=now(),updated_at=now()
    where alternative.id=alternative_row.id returning * into alternative_row;
    update public.annual_planner_closure_impacts impact set
      status='action_required',resolution_action='alternative_declined',coach_response_status='declined',
      resolution_note=concat_ws(E'\n',impact.resolution_note,nullif(trim(coach_message),'')),
      resolved_by=null,resolved_at=null,updated_at=now()
    where impact.id=impact_row.id returning * into impact_row;

    insert into public.coach_hub_messages(club_id,person_id,team_key,message_type,title,body,related_type,related_id,requires_acknowledgement,created_by)
    values(target_club_id,coach_person_id,booking_row.team_key,'action_required','Alternative declined',
      coalesce(nullif(trim(coach_message),''),'The club scheduler will review another option.'),
      'annual_planner_booking',booking_row.id::text,false,actor_id);
  end if;

  perform public.record_audit_event(target_club_id,'annual_planner.alternative.'||response_safe,'annual_planner_booking_alternative',alternative_row.id::text,
    jsonb_build_object('booking_id',booking_row.id,'impact_id',impact_row.id,'coach_person_id',coach_person_id));
  return to_jsonb(alternative_row)||jsonb_build_object('impact_status',impact_row.status,'booking',to_jsonb(booking_row));
end;
$$;


create or replace function public.get_annual_planner_analytics_data(
  target_club_id uuid,
  range_start date default null,
  range_end date default null
)
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
  if auth.uid() is null or not public.is_club_member(target_club_id) then
    raise exception 'Analytics access denied' using errcode='42501';
  end if;
  if not private.club_has_entitlement(target_club_id,'analytics_core') then
    raise exception 'Analytics are not included in this workspace package' using errcode='42501';
  end if;

  select public.can_manage_club(target_club_id)
    or coalesce((select settings.show_costs_to_schedulers from public.annual_planner_settings settings where settings.club_id=target_club_id),true)
  into can_view_costs;

  return jsonb_build_object(
    'bookings',coalesce((
      select jsonb_agg(
        case when can_view_costs then to_jsonb(booking)
        else to_jsonb(booking)-'cost_pence'-'supplier_reference' end
        order by booking.start_at
      )
      from public.annual_planner_bookings booking
      where booking.club_id=target_club_id
        and booking.start_at<end_boundary
        and booking.end_at>=start_boundary
    ),'[]'::jsonb),
    'blackouts',coalesce((
      select jsonb_agg(to_jsonb(blackout) order by blackout.start_at)
      from public.annual_planner_blackouts blackout
      where blackout.club_id=target_club_id
        and blackout.start_at<end_boundary
        and blackout.end_at>=start_boundary
    ),'[]'::jsonb),
    'winter_sites',coalesce((
      select jsonb_agg(case when can_view_costs then to_jsonb(site) else to_jsonb(site)-'cost_pence' end)
      from public.annual_planner_sites site
      where site.club_id=target_club_id
    ),'[]'::jsonb),
    'winter_slots',coalesce((
      select jsonb_agg(case when can_view_costs then to_jsonb(slot) else to_jsonb(slot)-'cost_pence' end)
      from public.annual_planner_site_slots slot
      where slot.club_id=target_club_id
    ),'[]'::jsonb),
    'requests',coalesce((
      select jsonb_agg(to_jsonb(request_row)-'admin_notes' order by request_row.created_at)
      from public.coach_hub_requests request_row
      where request_row.club_id=target_club_id
        and request_row.created_at<end_boundary
        and request_row.created_at>=start_boundary
    ),'[]'::jsonb),
    'closure_impacts',coalesce((
      select jsonb_agg(
        to_jsonb(impact)
        || jsonb_build_object(
          'booking_title',booking.title,
          'team_key',booking.team_key,
          'team_name',booking.team_name,
          'booking_start_at',booking.start_at,
          'booking_end_at',booking.end_at,
          'pitch_id',booking.pitch_id,
          'pitch_name',booking.pitch_name,
          'pitch_area_id',booking.pitch_area_id,
          'pitch_area_name',booking.pitch_area_name
        )
        order by impact.created_at
      )
      from public.annual_planner_closure_impacts impact
      join public.annual_planner_bookings booking on booking.id=impact.booking_id
      where impact.club_id=target_club_id
        and booking.start_at<end_boundary
        and booking.end_at>=start_boundary
    ),'[]'::jsonb)
  );
end;
$$;

revoke all on function private.queue_annual_planner_coach_notification(uuid,uuid,text,text,text,text,boolean) from public,anon,authenticated;
revoke all on function public.list_my_annual_planner_alternatives(uuid) from public,anon;
revoke all on function public.respond_to_annual_planner_alternative(uuid,uuid,text,text) from public,anon;
revoke all on function public.list_annual_planner_closure_impacts(uuid,date,date) from public,anon;
revoke all on function public.resolve_annual_planner_closure_impact(uuid,uuid,jsonb) from public,anon;
revoke all on function public.get_annual_planner_analytics_data(uuid,date,date) from public,anon;
grant execute on function public.list_my_annual_planner_alternatives(uuid) to authenticated;
grant execute on function public.respond_to_annual_planner_alternative(uuid,uuid,text,text) to authenticated;
grant execute on function public.list_annual_planner_closure_impacts(uuid,date,date) to authenticated;
grant execute on function public.resolve_annual_planner_closure_impact(uuid,uuid,jsonb) to authenticated;
grant execute on function public.get_annual_planner_analytics_data(uuid,date,date) to authenticated;

comment on function public.resolve_annual_planner_closure_impact(uuid,uuid,jsonb) is 'v3.10.9 closure resolution authority with immediate relocation, coach alternatives, postponement, cancellation and notifications.';
comment on function public.respond_to_annual_planner_alternative(uuid,uuid,text,text) is 'v3.10.9 secure coach acceptance or decline of a closure-driven alternative.';
comment on function public.get_annual_planner_analytics_data(uuid,date,date) is 'Shared Annual Planner analytics payload including closure impact resolution evidence.';

notify pgrst,'reload schema';
commit;
