-- Daxora Ground Control v3.10.6
-- Full-pitch allocation, weather disruption, winter-site inventory and shared analytics.
begin;

alter table public.annual_planner_bookings
  add column if not exists season_phase text not null default 'regular',
  add column if not exists site_inventory_id uuid,
  add column if not exists site_slot_id uuid,
  add column if not exists disruption_status text not null default 'none',
  add column if not exists disruption_reason text,
  add column if not exists disruption_notes text,
  add column if not exists disrupted_at timestamptz,
  add column if not exists original_start_at timestamptz,
  add column if not exists original_end_at timestamptz,
  add column if not exists rescheduled_from_booking_id uuid references public.annual_planner_bookings(id) on delete set null,
  add column if not exists rescheduled_booking_id uuid references public.annual_planner_bookings(id) on delete set null;

alter table public.annual_planner_bookings drop constraint if exists annual_planner_bookings_status_check;
alter table public.annual_planner_bookings add constraint annual_planner_bookings_status_check
  check (status in ('requested','provisional','confirmed','completed','postponed','cancelled','rejected'));
alter table public.annual_planner_bookings drop constraint if exists annual_planner_bookings_season_phase_check;
alter table public.annual_planner_bookings add constraint annual_planner_bookings_season_phase_check
  check (season_phase in ('preseason','regular','winter'));
alter table public.annual_planner_bookings drop constraint if exists annual_planner_bookings_disruption_status_check;
alter table public.annual_planner_bookings add constraint annual_planner_bookings_disruption_status_check
  check (disruption_status in ('none','awaiting_rearrangement','weather_postponed','weather_cancelled','rearranged'));

create table if not exists public.annual_planner_sites (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 200),
  address text,
  season_type text not null default 'winter' check (season_type in ('preseason','regular','winter')),
  provider_type text not null default 'external' check (provider_type in ('club','external','partner','school','council')),
  available_from date not null,
  available_to date not null,
  surface text,
  floodlights boolean not null default false,
  cost_pence integer not null default 0 check (cost_pence between 0 and 100000000),
  access_notes text,
  restrictions text,
  cancellation_terms text,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (available_to >= available_from)
);

create table if not exists public.annual_planner_site_slots (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  site_id uuid not null references public.annual_planner_sites(id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 160),
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  capacity integer not null default 1 check (capacity between 1 and 20),
  area_name text,
  cost_pence integer not null default 0 check (cost_pence between 0 and 100000000),
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

alter table public.annual_planner_bookings
  drop constraint if exists annual_planner_bookings_site_inventory_id_fkey,
  add constraint annual_planner_bookings_site_inventory_id_fkey foreign key (site_inventory_id) references public.annual_planner_sites(id) on delete set null,
  drop constraint if exists annual_planner_bookings_site_slot_id_fkey,
  add constraint annual_planner_bookings_site_slot_id_fkey foreign key (site_slot_id) references public.annual_planner_site_slots(id) on delete set null;

alter table public.coach_hub_requests
  add column if not exists season_phase text not null default 'regular',
  add column if not exists preferred_site_inventory_id uuid references public.annual_planner_sites(id) on delete set null,
  add column if not exists preferred_site_slot_id uuid references public.annual_planner_site_slots(id) on delete set null,
  add column if not exists proposed_site_inventory_id uuid references public.annual_planner_sites(id) on delete set null,
  add column if not exists proposed_site_slot_id uuid references public.annual_planner_site_slots(id) on delete set null;

alter table public.coach_hub_requests drop constraint if exists coach_hub_requests_season_phase_check;
alter table public.coach_hub_requests add constraint coach_hub_requests_season_phase_check
  check (season_phase in ('preseason','regular','winter'));

create index if not exists annual_planner_sites_club_season_idx on public.annual_planner_sites(club_id,season_type,active,available_from,available_to);
create index if not exists annual_planner_site_slots_site_idx on public.annual_planner_site_slots(club_id,site_id,day_of_week,start_time) where active;
create index if not exists annual_planner_bookings_site_slot_idx on public.annual_planner_bookings(club_id,site_slot_id,start_at,status) where site_slot_id is not null;
create index if not exists annual_planner_bookings_disruption_idx on public.annual_planner_bookings(club_id,disruption_status,start_at) where disruption_status <> 'none';

alter table public.annual_planner_sites enable row level security;
alter table public.annual_planner_sites force row level security;
alter table public.annual_planner_site_slots enable row level security;
alter table public.annual_planner_site_slots force row level security;
revoke all on table public.annual_planner_sites, public.annual_planner_site_slots from public,anon,authenticated;

drop policy if exists annual_planner_sites_read on public.annual_planner_sites;
create policy annual_planner_sites_read on public.annual_planner_sites for select to authenticated using (public.is_club_member(club_id) or public.can_access_coach_hub(club_id));
drop policy if exists annual_planner_sites_write on public.annual_planner_sites;
create policy annual_planner_sites_write on public.annual_planner_sites for all to authenticated using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));
drop policy if exists annual_planner_site_slots_read on public.annual_planner_site_slots;
create policy annual_planner_site_slots_read on public.annual_planner_site_slots for select to authenticated using (public.is_club_member(club_id) or public.can_access_coach_hub(club_id));
drop policy if exists annual_planner_site_slots_write on public.annual_planner_site_slots;
create policy annual_planner_site_slots_write on public.annual_planner_site_slots for all to authenticated using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

create or replace function public.touch_annual_planner_inventory_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at:=now(); new.updated_by:=auth.uid(); return new; end;
$$;
drop trigger if exists annual_planner_sites_touch on public.annual_planner_sites;
create trigger annual_planner_sites_touch before update on public.annual_planner_sites for each row execute function public.touch_annual_planner_inventory_updated_at();
drop trigger if exists annual_planner_site_slots_touch on public.annual_planner_site_slots;
create trigger annual_planner_site_slots_touch before update on public.annual_planner_site_slots for each row execute function public.touch_annual_planner_inventory_updated_at();

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
  type_value text:=lower(trim(coalesce(booking_type_value,'training')));
  area_value text:=nullif(trim(coalesce(target_pitch_area_id,'')),'');
  full_value boolean:=type_value<>'training' or area_value is null or area_value='__full_pitch__';
  capacity_value integer:=1;
  slot_id_value uuid;
  overlap_count integer:=0;
begin
  if target_pitch_id is null or trim(target_pitch_id)='' then return true; end if;
  if start_value is null or end_value is null or end_value<=start_value then return false; end if;

  if target_pitch_id like 'winter-slot:%' then
    begin slot_id_value:=replace(target_pitch_id,'winter-slot:','')::uuid; exception when others then return false; end;
    select greatest(1,slot.capacity) into capacity_value
    from public.annual_planner_site_slots slot
    join public.annual_planner_sites site on site.id=slot.site_id and site.club_id=slot.club_id
    where slot.id=slot_id_value and slot.club_id=target_club_id and slot.active and site.active
      and start_value::date between site.available_from and site.available_to
      and extract(dow from start_value)::integer=slot.day_of_week;
    if capacity_value is null then return false; end if;
    select count(*) into overlap_count from public.annual_planner_bookings existing
    where existing.club_id=target_club_id and existing.id is distinct from ignore_booking_id
      and (existing.site_slot_id=slot_id_value or existing.pitch_id=target_pitch_id)
      and existing.status in ('requested','provisional','confirmed')
      and tstzrange(existing.start_at,existing.end_at,'[)') && tstzrange(start_value,end_value,'[)');
    if type_value<>'training' then return overlap_count=0; end if;
    return overlap_count<capacity_value;
  end if;

  if private.pitch_is_closed(target_club_id,target_pitch_id,start_value,end_value) then return false; end if;
  capacity_value:=private.pitch_training_capacity(target_club_id,target_pitch_id);

  if full_value then
    return not exists(
      select 1 from public.annual_planner_bookings existing
      where existing.club_id=target_club_id and existing.id is distinct from ignore_booking_id
        and existing.pitch_id=target_pitch_id and existing.status in ('requested','provisional','confirmed')
        and tstzrange(existing.start_at,existing.end_at,'[)') && tstzrange(start_value,end_value,'[)')
    );
  end if;

  if exists(
    select 1 from public.annual_planner_bookings existing
    where existing.club_id=target_club_id and existing.id is distinct from ignore_booking_id
      and existing.pitch_id=target_pitch_id and existing.status in ('requested','provisional','confirmed')
      and tstzrange(existing.start_at,existing.end_at,'[)') && tstzrange(start_value,end_value,'[)')
      and (
        lower(coalesce(existing.booking_type,'training'))<>'training'
        or existing.pitch_area_id is null
        or existing.pitch_area_id='__full_pitch__'
        or existing.pitch_area_id=area_value
      )
  ) then return false; end if;

  select count(*) into overlap_count from public.annual_planner_bookings existing
  where existing.club_id=target_club_id and existing.id is distinct from ignore_booking_id
    and existing.pitch_id=target_pitch_id and existing.status in ('requested','provisional','confirmed')
    and tstzrange(existing.start_at,existing.end_at,'[)') && tstzrange(start_value,end_value,'[)');
  return overlap_count<capacity_value;
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
  full_value boolean;
  capacity_value integer:=1;
  booked_value integer:=0;
  pending_value integer:=0;
  reasons_value jsonb:='[]'::jsonb;
  assignment_id_value uuid:=nullif(request_data->>'assignment_id','')::uuid;
  site_slot_value uuid:=nullif(request_data->>'preferred_site_slot_id','')::uuid;
begin
  if coach_person_id is null then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  select * into assignment_row from public.coach_hub_team_assignments assignment
  where assignment.id=assignment_id_value and assignment.person_id=coach_person_id and assignment.club_id=target_club_id and assignment.status='active';
  if assignment_row.id is null then raise exception 'Choose one of your assigned teams' using errcode='42501'; end if;
  if start_value is null or end_value is null or end_value<=start_value then raise exception 'Choose a valid request time' using errcode='22023'; end if;

  full_value:=booking_type_value<>'training' or area_value is null or area_value='__full_pitch__';
  if pitch_value like 'winter-slot:%' and site_slot_value is null then
    begin site_slot_value:=replace(pitch_value,'winter-slot:','')::uuid; exception when others then site_slot_value:=null; end;
  end if;

  if site_slot_value is not null then
    select greatest(1,slot.capacity) into capacity_value from public.annual_planner_site_slots slot
    join public.annual_planner_sites site on site.id=slot.site_id and site.club_id=slot.club_id
    where slot.id=site_slot_value and slot.club_id=target_club_id and slot.active and site.active
      and start_value::date between site.available_from and site.available_to
      and extract(dow from start_value)::integer=slot.day_of_week;
    if capacity_value is null then
      reasons_value:=reasons_value||jsonb_build_array(jsonb_build_object('type','winter_slot','message','This winter slot is not available on the selected date'));
      capacity_value:=1;
    end if;
    select count(*) into booked_value from public.annual_planner_bookings booking
    where booking.club_id=target_club_id and booking.status in ('requested','provisional','confirmed')
      and (booking.site_slot_id=site_slot_value or booking.pitch_id='winter-slot:'||site_slot_value::text)
      and tstzrange(booking.start_at,booking.end_at,'[)') && tstzrange(start_value,end_value,'[)');
    select count(*) into pending_value from public.coach_hub_requests pending
    where pending.club_id=target_club_id and pending.id is distinct from request_id_value
      and pending.preferred_site_slot_id=site_slot_value and pending.status in ('submitted','needs_information','alternative_offered')
      and tstzrange(pending.preferred_start_at,pending.preferred_end_at,'[)') && tstzrange(start_value,end_value,'[)');
    if (booking_type_value<>'training' and booked_value+pending_value>0) or (booking_type_value='training' and booked_value+pending_value>=capacity_value) then
      reasons_value:=reasons_value||jsonb_build_array(jsonb_build_object('type','winter_capacity','message','The fixed winter slot has reached capacity','capacity',capacity_value,'used',booked_value+pending_value));
    end if;
  elsif pitch_value is not null then
    capacity_value:=private.pitch_training_capacity(target_club_id,pitch_value);
    select count(*) into booked_value from public.annual_planner_bookings booking
    where booking.club_id=target_club_id and booking.pitch_id=pitch_value and booking.status in ('requested','provisional','confirmed')
      and tstzrange(booking.start_at,booking.end_at,'[)') && tstzrange(start_value,end_value,'[)');
    select count(*) into pending_value from public.coach_hub_requests pending
    where pending.club_id=target_club_id and pending.id is distinct from request_id_value
      and pending.preferred_pitch_id=pitch_value and pending.status in ('submitted','needs_information','alternative_offered')
      and tstzrange(pending.preferred_start_at,pending.preferred_end_at,'[)') && tstzrange(start_value,end_value,'[)')
      and (
        full_value
        or lower(coalesce(pending.request_type,'training'))<>'training'
        or pending.preferred_pitch_area_id is null
        or pending.preferred_pitch_area_id='__full_pitch__'
        or pending.preferred_pitch_area_id=area_value
      );
    if not private.pitch_area_slot_available(target_club_id,pitch_value,area_value,start_value,end_value,booking_type_value,null)
      or (full_value and pending_value>0)
      or (not full_value and (booked_value+pending_value>=capacity_value or pending_value>0)) then
      reasons_value:=reasons_value||jsonb_build_array(jsonb_build_object(
        'type',case when full_value then 'full_pitch' else 'pitch_area' end,
        'message',case when full_value then 'The full pitch is unavailable because another booking or area allocation overlaps' else 'The selected pitch area is unavailable or the pitch has reached capacity' end,
        'capacity',capacity_value,'used',booked_value+pending_value,'pitch_area_id',area_value
      ));
    end if;
  end if;

  if exists(
    select 1 from public.annual_planner_bookings booking
    where booking.club_id=target_club_id and booking.team_key=assignment_row.team_key
      and booking.status in ('requested','provisional','confirmed')
      and tstzrange(booking.start_at,booking.end_at,'[)') && tstzrange(start_value,end_value,'[)')
      and not (
        booking_type_value='training' and booking.booking_type='training'
        and pitch_value is not null and booking.pitch_id=pitch_value
        and area_value is not null and area_value<>'__full_pitch__'
        and booking.pitch_area_id is not null and booking.pitch_area_id<>'__full_pitch__'
        and booking.pitch_area_id<>area_value
      )
  ) then reasons_value:=reasons_value||jsonb_build_array(jsonb_build_object('type','team_conflict','message','Your team already has another booking at this time')); end if;

  if exists(
    select 1 from public.annual_planner_blackouts blackout
    where blackout.club_id=target_club_id and blackout.start_at<end_value and blackout.end_at>start_value
      and (blackout.pitch_id is null or pitch_value is null or blackout.pitch_id=pitch_value)
  ) then reasons_value:=reasons_value||jsonb_build_array(jsonb_build_object('type','blackout','message','The facility is unavailable during this period')); end if;

  return jsonb_build_object(
    'available',jsonb_array_length(reasons_value)=0,
    'status',case when jsonb_array_length(reasons_value)=0 then case when full_value then 'full_pitch_available' when capacity_value-booked_value-pending_value<=1 then 'limited' else 'available' end else 'unavailable' end,
    'advisory',false,
    'allocation_mode',case when site_slot_value is not null then 'winter_slot' when full_value then 'full_pitch' else 'pitch_area' end,
    'capacity',capacity_value,
    'used_capacity',booked_value+pending_value,
    'remaining_capacity',case when full_value then 0 else greatest(0,capacity_value-booked_value-pending_value-1) end,
    'pitch_area_id',area_value,
    'reasons',reasons_value,
    'alternatives','[]'::jsonb
  );
end;
$$;

create or replace function public.save_annual_planner_booking(target_club_id uuid,booking_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid:=auth.uid();
  target_id uuid:=nullif(booking_data->>'booking_id','')::uuid;
  result public.annual_planner_bookings%rowtype;
  next_status text:=coalesce(nullif(lower(trim(booking_data->>'status')),''),'provisional');
  next_start timestamptz:=(booking_data->>'start_at')::timestamptz;
  next_end timestamptz:=(booking_data->>'end_at')::timestamptz;
  next_venue_id text:=nullif(booking_data->>'venue_id','');
  next_pitch_id text:=nullif(booking_data->>'pitch_id','');
  next_pitch_area_id text:=nullif(booking_data->>'pitch_area_id','');
  next_pitch_area_name text:=nullif(booking_data->>'pitch_area_name','');
  next_team_key text:=nullif(booking_data->>'team_key','');
  next_booking_type text:=coalesce(nullif(lower(trim(booking_data->>'booking_type')),''),'training');
  next_season text:=case lower(trim(coalesce(booking_data->>'season_phase','regular'))) when 'preseason' then 'preseason' when 'winter' then 'winter' else 'regular' end;
  next_site_id uuid:=nullif(booking_data->>'site_inventory_id','')::uuid;
  next_slot_id uuid:=nullif(booking_data->>'site_slot_id','')::uuid;
  can_manage boolean:=false;
  require_approval boolean:=false;
  can_edit_costs boolean:=true;
begin
  if actor_id is null or not public.can_operate_club(target_club_id) then raise exception 'Annual planner operation denied' using errcode='42501'; end if;
  if not private.club_has_entitlement(target_club_id,'annual_planner') then raise exception 'Annual planner is not included in this workspace package' using errcode='42501'; end if;
  can_manage:=public.can_manage_club(target_club_id);
  select coalesce(settings.require_approval,false),can_manage or coalesce(settings.show_costs_to_schedulers,true)
    into require_approval,can_edit_costs from (select 1) seed left join public.annual_planner_settings settings on settings.club_id=target_club_id;
  if require_approval and not can_manage then next_status:='requested'; end if;
  if next_end<=next_start then raise exception 'Annual planner booking must finish after it starts' using errcode='22023'; end if;
  if next_pitch_id is not null then
    perform pg_advisory_xact_lock(hashtext(target_club_id::text||':pitch:'||next_pitch_id));
    if not private.pitch_area_slot_available(target_club_id,next_pitch_id,next_pitch_area_id,next_start,next_end,next_booking_type,target_id) then
      raise exception 'This allocation is unavailable or has reached capacity' using errcode='23P01';
    end if;
  end if;
  if next_team_key is not null and exists(
    select 1 from public.annual_planner_bookings existing
    where existing.club_id=target_club_id and existing.id is distinct from target_id and existing.team_key=next_team_key
      and existing.status in ('requested','provisional','confirmed')
      and tstzrange(existing.start_at,existing.end_at,'[)') && tstzrange(next_start,next_end,'[)')
      and not (
        next_booking_type='training' and existing.booking_type='training'
        and next_pitch_id is not null and existing.pitch_id=next_pitch_id
        and next_pitch_area_id is not null and next_pitch_area_id<>'__full_pitch__'
        and existing.pitch_area_id is not null and existing.pitch_area_id<>'__full_pitch__'
        and existing.pitch_area_id<>next_pitch_area_id
      )
  ) then raise exception 'This team already has an active booking at the selected time' using errcode='23P01'; end if;
  if exists(
    select 1 from public.annual_planner_blackouts blackout
    where blackout.club_id=target_club_id
      and (blackout.venue_id is null or next_venue_id is null or blackout.venue_id=next_venue_id)
      and (blackout.pitch_id is null or next_pitch_id is null or blackout.pitch_id=next_pitch_id)
      and tstzrange(blackout.start_at,blackout.end_at,'[)') && tstzrange(next_start,next_end,'[)')
  ) then raise exception 'The selected facility is unavailable during this period' using errcode='23P01'; end if;

  if target_id is null then
    insert into public.annual_planner_bookings(
      club_id,series_id,title,booking_type,status,team_key,team_name,opponent_name,venue_id,venue_name,pitch_id,pitch_name,pitch_area_id,pitch_area_name,
      season_phase,site_inventory_id,site_slot_id,start_at,end_at,recurrence,recurrence_until,exception_dates,holiday_policy,cost_pence,supplier_reference,
      booking_reference,contact_name,contact_email,notes,finance_status,finance_reference,source_type,source_id,requested_by,approved_by,approved_at,created_by,updated_by
    ) values(
      target_club_id,nullif(booking_data->>'series_id',''),trim(booking_data->>'title'),next_booking_type,next_status,next_team_key,nullif(booking_data->>'team_name',''),
      nullif(booking_data->>'opponent_name',''),next_venue_id,nullif(booking_data->>'venue_name',''),next_pitch_id,nullif(booking_data->>'pitch_name',''),next_pitch_area_id,next_pitch_area_name,
      next_season,next_site_id,next_slot_id,next_start,next_end,coalesce(nullif(lower(trim(booking_data->>'recurrence')),''),'none'),nullif(booking_data->>'recurrence_until','')::date,
      coalesce(array(select value::date from jsonb_array_elements_text(coalesce(booking_data->'exception_dates','[]'::jsonb)) exception_row(value) where value~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),'{}'::date[]),
      case lower(trim(coalesce(booking_data->>'holiday_policy','include'))) when 'exclude' then 'exclude' when 'custom' then 'custom' else 'include' end,
      case when can_edit_costs then greatest(0,coalesce((booking_data->>'cost_pence')::integer,0)) else 0 end,
      case when can_edit_costs then nullif(booking_data->>'supplier_reference','') else null end,nullif(booking_data->>'booking_reference',''),
      nullif(booking_data->>'contact_name',''),nullif(booking_data->>'contact_email',''),nullif(booking_data->>'notes',''),
      case when can_manage then coalesce(nullif(lower(trim(booking_data->>'finance_status')),''),'unreconciled') else 'unreconciled' end,
      case when can_manage then nullif(booking_data->>'finance_reference','') else null end,coalesce(nullif(booking_data->>'source_type',''),'annual_planner'),
      nullif(booking_data->>'source_id',''),case when next_status='requested' then actor_id else null end,case when next_status='confirmed' then actor_id else null end,
      case when next_status='confirmed' then now() else null end,actor_id,actor_id
    ) returning * into result;
  else
    update public.annual_planner_bookings booking set
      series_id=nullif(booking_data->>'series_id',''),title=trim(booking_data->>'title'),booking_type=next_booking_type,status=next_status,
      team_key=next_team_key,team_name=nullif(booking_data->>'team_name',''),opponent_name=nullif(booking_data->>'opponent_name',''),venue_id=next_venue_id,
      venue_name=nullif(booking_data->>'venue_name',''),pitch_id=next_pitch_id,pitch_name=nullif(booking_data->>'pitch_name',''),pitch_area_id=next_pitch_area_id,
      pitch_area_name=next_pitch_area_name,season_phase=next_season,site_inventory_id=next_site_id,site_slot_id=next_slot_id,start_at=next_start,end_at=next_end,
      recurrence=coalesce(nullif(lower(trim(booking_data->>'recurrence')),''),'none'),recurrence_until=nullif(booking_data->>'recurrence_until','')::date,
      exception_dates=coalesce(array(select value::date from jsonb_array_elements_text(coalesce(booking_data->'exception_dates','[]'::jsonb)) exception_row(value) where value~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),'{}'::date[]),
      holiday_policy=case lower(trim(coalesce(booking_data->>'holiday_policy','include'))) when 'exclude' then 'exclude' when 'custom' then 'custom' else 'include' end,
      cost_pence=case when can_edit_costs then greatest(0,coalesce((booking_data->>'cost_pence')::integer,0)) else booking.cost_pence end,
      supplier_reference=case when can_edit_costs then nullif(booking_data->>'supplier_reference','') else booking.supplier_reference end,
      booking_reference=nullif(booking_data->>'booking_reference',''),contact_name=nullif(booking_data->>'contact_name',''),contact_email=nullif(booking_data->>'contact_email',''),
      notes=nullif(booking_data->>'notes',''),finance_status=case when can_manage then coalesce(nullif(lower(trim(booking_data->>'finance_status')),''),booking.finance_status) else booking.finance_status end,
      finance_reference=case when can_manage then nullif(booking_data->>'finance_reference','') else booking.finance_reference end,
      requested_by=case when next_status='requested' then actor_id else booking.requested_by end,approved_by=case when next_status='confirmed' then actor_id else null end,
      approved_at=case when next_status='confirmed' then coalesce(booking.approved_at,now()) else null end,updated_by=actor_id,updated_at=now()
    where booking.id=target_id and booking.club_id=target_club_id returning * into result;
    if result.id is null then raise exception 'Booking not found' using errcode='P0002'; end if;
  end if;
  perform public.record_audit_event(target_club_id,case when target_id is null then 'annual_planner.booking.created' else 'annual_planner.booking.updated' end,
    'annual_planner_booking',result.id::text,jsonb_build_object('status',result.status,'pitch_id',result.pitch_id,'pitch_area_id',result.pitch_area_id,'season_phase',result.season_phase,'site_slot_id',result.site_slot_id));
  return to_jsonb(result);
end;
$$;

create or replace function public.submit_coach_hub_request_v2(target_club_id uuid,request_data jsonb)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare result_value jsonb; request_id_value uuid; availability_value jsonb; request_type_value text:=lower(trim(coalesce(request_data->>'request_type','training'))); allow_advisory boolean:=coalesce((request_data->>'allow_advisory_submission')::boolean,false);
begin
  availability_value:=public.check_coach_hub_request_availability(target_club_id,request_data);
  if request_type_value not in ('change','cancellation') and coalesce((availability_value->>'available')::boolean,false)=false and allow_advisory=false then
    raise exception 'The requested slot is unavailable' using errcode='23P01',detail=coalesce((availability_value->'reasons')::text,'[]');
  end if;
  result_value:=public.submit_coach_hub_request(target_club_id,request_data); request_id_value:=(result_value->>'id')::uuid;
  update public.coach_hub_requests request_row set
    preferred_pitch_area_id=nullif(request_data->>'preferred_pitch_area_id',''),preferred_pitch_area_name=nullif(request_data->>'preferred_pitch_area_name',''),
    season_phase=case lower(trim(coalesce(request_data->>'season_phase','regular'))) when 'preseason' then 'preseason' when 'winter' then 'winter' else 'regular' end,
    preferred_site_inventory_id=nullif(request_data->>'preferred_site_inventory_id','')::uuid,preferred_site_slot_id=nullif(request_data->>'preferred_site_slot_id','')::uuid,
    acceptable_pitch_ids=coalesce(array(select jsonb_array_elements_text(coalesce(request_data->'acceptable_pitch_ids','[]'::jsonb))),'{}'::text[]),
    time_flexible=coalesce((request_data->>'time_flexible')::boolean,false),flexibility_minutes=case when coalesce((request_data->>'time_flexible')::boolean,false) then greatest(0,least(240,coalesce((request_data->>'flexibility_minutes')::integer,30))) else 0 end,
    availability_snapshot=availability_value,updated_at=now()
  where request_row.id=request_id_value;
  return (select to_jsonb(request_row)-'admin_notes' from public.coach_hub_requests request_row where request_row.id=request_id_value);
end;
$$;

create or replace function public.update_my_coach_hub_request_v2(target_club_id uuid,target_request_id uuid,request_data jsonb)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare result_value jsonb; availability_value jsonb;
begin
  availability_value:=public.check_coach_hub_request_availability(target_club_id,request_data);
  result_value:=public.update_my_coach_hub_request(target_club_id,target_request_id,request_data);
  update public.coach_hub_requests request_row set
    preferred_pitch_area_id=nullif(request_data->>'preferred_pitch_area_id',''),preferred_pitch_area_name=nullif(request_data->>'preferred_pitch_area_name',''),
    season_phase=case lower(trim(coalesce(request_data->>'season_phase','regular'))) when 'preseason' then 'preseason' when 'winter' then 'winter' else 'regular' end,
    preferred_site_inventory_id=nullif(request_data->>'preferred_site_inventory_id','')::uuid,preferred_site_slot_id=nullif(request_data->>'preferred_site_slot_id','')::uuid,
    acceptable_pitch_ids=coalesce(array(select jsonb_array_elements_text(coalesce(request_data->'acceptable_pitch_ids','[]'::jsonb))),'{}'::text[]),
    time_flexible=coalesce((request_data->>'time_flexible')::boolean,false),flexibility_minutes=case when coalesce((request_data->>'time_flexible')::boolean,false) then greatest(0,least(240,coalesce((request_data->>'flexibility_minutes')::integer,30))) else 0 end,
    availability_snapshot=availability_value,updated_at=now()
  where request_row.id=target_request_id;
  return (select to_jsonb(request_row)-'admin_notes' from public.coach_hub_requests request_row where request_row.id=target_request_id);
end;
$$;

create or replace function public.review_coach_hub_request_v2(target_club_id uuid,target_request_id uuid,decision text,decision_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare result_value jsonb; resulting_booking uuid; decision_value text:=lower(trim(coalesce(decision,'')));
begin
  if decision_value='approve' then
    update public.coach_hub_requests request_row set
      preferred_venue_id=coalesce(nullif(decision_data->>'venue_id',''),preferred_venue_id),preferred_venue_name=coalesce(nullif(decision_data->>'venue_name',''),preferred_venue_name),
      preferred_pitch_id=coalesce(nullif(decision_data->>'pitch_id',''),preferred_pitch_id),preferred_pitch_name=coalesce(nullif(decision_data->>'pitch_name',''),preferred_pitch_name),
      preferred_pitch_area_id=coalesce(nullif(decision_data->>'pitch_area_id',''),preferred_pitch_area_id),preferred_pitch_area_name=coalesce(nullif(decision_data->>'pitch_area_name',''),preferred_pitch_area_name),
      preferred_start_at=coalesce(nullif(decision_data->>'start_at','')::timestamptz,preferred_start_at),preferred_end_at=coalesce(nullif(decision_data->>'end_at','')::timestamptz,preferred_end_at),
      season_phase=case lower(trim(coalesce(decision_data->>'season_phase',season_phase))) when 'preseason' then 'preseason' when 'winter' then 'winter' else 'regular' end,
      preferred_site_inventory_id=coalesce(nullif(decision_data->>'site_inventory_id','')::uuid,preferred_site_inventory_id),preferred_site_slot_id=coalesce(nullif(decision_data->>'site_slot_id','')::uuid,preferred_site_slot_id)
    where request_row.id=target_request_id and request_row.club_id=target_club_id;
  elsif decision_value='alternative' then
    update public.coach_hub_requests request_row set
      proposed_pitch_area_id=nullif(decision_data->>'pitch_area_id',''),proposed_pitch_area_name=nullif(decision_data->>'pitch_area_name',''),
      proposed_site_inventory_id=nullif(decision_data->>'site_inventory_id','')::uuid,proposed_site_slot_id=nullif(decision_data->>'site_slot_id','')::uuid
    where request_row.id=target_request_id and request_row.club_id=target_club_id;
  end if;
  result_value:=public.review_coach_hub_request(target_club_id,target_request_id,decision,decision_data);
  resulting_booking:=nullif(result_value->>'resulting_booking_id','')::uuid;
  update public.annual_planner_bookings booking set
    season_phase=coalesce((select request_row.season_phase from public.coach_hub_requests request_row where request_row.id=target_request_id),booking.season_phase),
    site_inventory_id=coalesce((select case when decision_value='alternative' then request_row.proposed_site_inventory_id else request_row.preferred_site_inventory_id end from public.coach_hub_requests request_row where request_row.id=target_request_id),booking.site_inventory_id),
    site_slot_id=coalesce((select case when decision_value='alternative' then request_row.proposed_site_slot_id else request_row.preferred_site_slot_id end from public.coach_hub_requests request_row where request_row.id=target_request_id),booking.site_slot_id),
    cost_pence=coalesce(nullif(decision_data->>'cost_pence','')::integer,booking.cost_pence),updated_at=now()
  where booking.club_id=target_club_id and (booking.id=resulting_booking or (booking.source_type='coach_request' and booking.source_id=target_request_id::text));
  return (select to_jsonb(request_row) from public.coach_hub_requests request_row where request_row.id=target_request_id);
end;
$$;

create or replace function public.save_annual_planner_winter_site(target_club_id uuid,site_data jsonb)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare actor_id uuid:=auth.uid(); target_id uuid:=nullif(site_data->>'id','')::uuid; result public.annual_planner_sites%rowtype;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then raise exception 'Club owner or administrator access required' using errcode='42501'; end if;
  if target_id is null then
    insert into public.annual_planner_sites(club_id,name,address,season_type,provider_type,available_from,available_to,surface,floodlights,cost_pence,access_notes,restrictions,cancellation_terms,active,created_by,updated_by)
    values(target_club_id,trim(site_data->>'name'),nullif(site_data->>'address',''),case lower(trim(coalesce(site_data->>'seasonType',site_data->>'season_type','winter'))) when 'preseason' then 'preseason' when 'regular' then 'regular' else 'winter' end,
      case lower(trim(coalesce(site_data->>'providerType',site_data->>'provider_type','external'))) when 'club' then 'club' when 'partner' then 'partner' when 'school' then 'school' when 'council' then 'council' else 'external' end,
      coalesce(nullif(site_data->>'availableFrom','')::date,nullif(site_data->>'available_from','')::date,current_date),coalesce(nullif(site_data->>'availableTo','')::date,nullif(site_data->>'available_to','')::date,current_date),
      nullif(site_data->>'surface',''),coalesce((site_data->>'floodlights')::boolean,false),greatest(0,coalesce((coalesce(site_data->>'costPence',site_data->>'cost_pence'))::integer,0)),
      nullif(coalesce(site_data->>'accessNotes',site_data->>'access_notes'),''),nullif(site_data->>'restrictions',''),nullif(coalesce(site_data->>'cancellationTerms',site_data->>'cancellation_terms'),''),
      coalesce((site_data->>'active')::boolean,true),actor_id,actor_id) returning * into result;
  else
    update public.annual_planner_sites site set name=trim(site_data->>'name'),address=nullif(site_data->>'address',''),
      season_type=case lower(trim(coalesce(site_data->>'seasonType',site_data->>'season_type',site.season_type))) when 'preseason' then 'preseason' when 'regular' then 'regular' else 'winter' end,
      provider_type=case lower(trim(coalesce(site_data->>'providerType',site_data->>'provider_type',site.provider_type))) when 'club' then 'club' when 'partner' then 'partner' when 'school' then 'school' when 'council' then 'council' else 'external' end,
      available_from=coalesce(nullif(site_data->>'availableFrom','')::date,nullif(site_data->>'available_from','')::date,site.available_from),available_to=coalesce(nullif(site_data->>'availableTo','')::date,nullif(site_data->>'available_to','')::date,site.available_to),
      surface=nullif(site_data->>'surface',''),floodlights=coalesce((site_data->>'floodlights')::boolean,false),cost_pence=greatest(0,coalesce((coalesce(site_data->>'costPence',site_data->>'cost_pence'))::integer,0)),
      access_notes=nullif(coalesce(site_data->>'accessNotes',site_data->>'access_notes'),''),restrictions=nullif(site_data->>'restrictions',''),cancellation_terms=nullif(coalesce(site_data->>'cancellationTerms',site_data->>'cancellation_terms'),''),
      active=coalesce((site_data->>'active')::boolean,true),updated_by=actor_id,updated_at=now()
    where site.id=target_id and site.club_id=target_club_id returning * into result;
  end if;
  if result.id is null then raise exception 'Winter site not found' using errcode='P0002'; end if;
  perform public.record_audit_event(target_club_id,'annual_planner.winter_site.saved','annual_planner_site',result.id::text,jsonb_build_object('name',result.name));
  return to_jsonb(result);
end;
$$;

create or replace function public.delete_annual_planner_winter_site(target_club_id uuid,target_site_id uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
begin
  if auth.uid() is null or not public.can_manage_club(target_club_id) then raise exception 'Club owner or administrator access required' using errcode='42501'; end if;
  if exists(select 1 from public.annual_planner_bookings booking where booking.club_id=target_club_id and booking.site_inventory_id=target_site_id and booking.status in ('requested','provisional','confirmed')) then
    raise exception 'This winter site has active bookings and cannot be removed' using errcode='23503';
  end if;
  delete from public.annual_planner_sites site where site.id=target_site_id and site.club_id=target_club_id;
  return jsonb_build_object('deleted',found,'id',target_site_id);
end;
$$;

create or replace function public.save_annual_planner_winter_slot(target_club_id uuid,slot_data jsonb)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare actor_id uuid:=auth.uid(); target_id uuid:=nullif(slot_data->>'id','')::uuid; site_value uuid:=coalesce(nullif(slot_data->>'siteId','')::uuid,nullif(slot_data->>'site_id','')::uuid); result public.annual_planner_site_slots%rowtype;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then raise exception 'Club owner or administrator access required' using errcode='42501'; end if;
  if not exists(select 1 from public.annual_planner_sites site where site.id=site_value and site.club_id=target_club_id) then raise exception 'Choose a winter site' using errcode='22023'; end if;
  if target_id is null then
    insert into public.annual_planner_site_slots(club_id,site_id,label,day_of_week,start_time,end_time,capacity,area_name,cost_pence,active,created_by,updated_by)
    values(target_club_id,site_value,trim(slot_data->>'label'),coalesce((coalesce(slot_data->>'dayOfWeek',slot_data->>'day_of_week'))::integer,1),
      (coalesce(slot_data->>'startTime',slot_data->>'start_time'))::time,(coalesce(slot_data->>'endTime',slot_data->>'end_time'))::time,greatest(1,coalesce((slot_data->>'capacity')::integer,1)),
      nullif(coalesce(slot_data->>'areaName',slot_data->>'area_name'),''),greatest(0,coalesce((coalesce(slot_data->>'costPence',slot_data->>'cost_pence'))::integer,0)),coalesce((slot_data->>'active')::boolean,true),actor_id,actor_id)
    returning * into result;
  else
    update public.annual_planner_site_slots slot set site_id=site_value,label=trim(slot_data->>'label'),day_of_week=coalesce((coalesce(slot_data->>'dayOfWeek',slot_data->>'day_of_week'))::integer,slot.day_of_week),
      start_time=(coalesce(slot_data->>'startTime',slot_data->>'start_time'))::time,end_time=(coalesce(slot_data->>'endTime',slot_data->>'end_time'))::time,capacity=greatest(1,coalesce((slot_data->>'capacity')::integer,1)),
      area_name=nullif(coalesce(slot_data->>'areaName',slot_data->>'area_name'),''),cost_pence=greatest(0,coalesce((coalesce(slot_data->>'costPence',slot_data->>'cost_pence'))::integer,0)),active=coalesce((slot_data->>'active')::boolean,true),updated_by=actor_id,updated_at=now()
    where slot.id=target_id and slot.club_id=target_club_id returning * into result;
  end if;
  if result.id is null then raise exception 'Winter slot not found' using errcode='P0002'; end if;
  return to_jsonb(result);
end;
$$;

create or replace function public.delete_annual_planner_winter_slot(target_club_id uuid,target_slot_id uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
begin
  if auth.uid() is null or not public.can_manage_club(target_club_id) then raise exception 'Club owner or administrator access required' using errcode='42501'; end if;
  if exists(select 1 from public.annual_planner_bookings booking where booking.club_id=target_club_id and booking.site_slot_id=target_slot_id and booking.status in ('requested','provisional','confirmed')) then
    raise exception 'This winter slot has active bookings and cannot be removed' using errcode='23503';
  end if;
  delete from public.annual_planner_site_slots slot where slot.id=target_slot_id and slot.club_id=target_club_id;
  return jsonb_build_object('deleted',found,'id',target_slot_id);
end;
$$;

create or replace function public.record_annual_planner_weather_disruption(target_club_id uuid,target_booking_id uuid,action_value text,disruption_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare actor_id uuid:=auth.uid(); booking_row public.annual_planner_bookings%rowtype; action_safe text:=lower(trim(coalesce(action_value,'postpone'))); reason_value text:=nullif(trim(disruption_data->>'reason'),''); public_message text:=nullif(trim(disruption_data->>'public_message'),''); replacement jsonb; replacement_id uuid; message_title text; message_body text;
begin
  if actor_id is null or not public.can_operate_club(target_club_id) then raise exception 'Club operator access required' using errcode='42501'; end if;
  select * into booking_row from public.annual_planner_bookings booking where booking.id=target_booking_id and booking.club_id=target_club_id for update;
  if booking_row.id is null then raise exception 'Booking not found' using errcode='P0002'; end if;
  if reason_value is null then raise exception 'Record the weather reason' using errcode='22023'; end if;
  if action_safe='postpone' then
    update public.annual_planner_bookings booking set status='postponed',disruption_status='awaiting_rearrangement',disruption_reason=reason_value,disruption_notes=public_message,
      disrupted_at=now(),original_start_at=coalesce(original_start_at,start_at),original_end_at=coalesce(original_end_at,end_at),updated_by=actor_id,updated_at=now()
    where booking.id=booking_row.id;
    message_title:='Session postponed due to weather'; message_body:=coalesce(public_message,'The session has been postponed and is awaiting a new date.');
  elsif action_safe='cancel' then
    update public.annual_planner_bookings booking set status='cancelled',disruption_status='weather_cancelled',disruption_reason=reason_value,disruption_notes=public_message,
      disrupted_at=now(),original_start_at=coalesce(original_start_at,start_at),original_end_at=coalesce(original_end_at,end_at),updated_by=actor_id,updated_at=now()
    where booking.id=booking_row.id;
    message_title:='Session cancelled due to weather'; message_body:=coalesce(public_message,'The session has been cancelled because the facility is unsafe or unavailable.');
  elsif action_safe='rearrange' then
    replacement:=public.save_annual_planner_booking(target_club_id,jsonb_build_object(
      'title',booking_row.title,'booking_type',booking_row.booking_type,'status','confirmed','team_key',booking_row.team_key,'team_name',booking_row.team_name,
      'opponent_name',booking_row.opponent_name,'venue_id',coalesce(disruption_data->>'venue_id',booking_row.venue_id),'venue_name',coalesce(disruption_data->>'venue_name',booking_row.venue_name),
      'pitch_id',coalesce(disruption_data->>'pitch_id',booking_row.pitch_id),'pitch_name',coalesce(disruption_data->>'pitch_name',booking_row.pitch_name),
      'pitch_area_id',coalesce(disruption_data->>'pitch_area_id',booking_row.pitch_area_id),'pitch_area_name',coalesce(disruption_data->>'pitch_area_name',booking_row.pitch_area_name),
      'season_phase',coalesce(disruption_data->>'season_phase',booking_row.season_phase),'site_inventory_id',disruption_data->>'site_inventory_id','site_slot_id',disruption_data->>'site_slot_id',
      'start_at',disruption_data->>'start_at','end_at',disruption_data->>'end_at','recurrence','none','cost_pence',coalesce((disruption_data->>'cost_pence')::integer,booking_row.cost_pence),
      'booking_reference',booking_row.booking_reference,'contact_name',booking_row.contact_name,'contact_email',booking_row.contact_email,
      'notes',concat_ws(E'\n',booking_row.notes,'Rearranged due to weather: '||reason_value),'source_type','weather_rearrangement','source_id',booking_row.id::text
    ));
    replacement_id:=(replacement->>'id')::uuid;
    update public.annual_planner_bookings replacement_row set rescheduled_from_booking_id=booking_row.id,disruption_status='rearranged',disruption_reason=reason_value,disruption_notes=public_message,updated_at=now() where replacement_row.id=replacement_id;
    update public.annual_planner_bookings original set status='postponed',disruption_status='rearranged',disruption_reason=reason_value,disruption_notes=public_message,disrupted_at=now(),
      original_start_at=coalesce(original_start_at,start_at),original_end_at=coalesce(original_end_at,end_at),rescheduled_booking_id=replacement_id,updated_by=actor_id,updated_at=now()
    where original.id=booking_row.id;
    message_title:='Session rearranged due to weather'; message_body:=coalesce(public_message,'The session has been moved to a new date or facility. Open Coach Hub for the updated booking.');
  else raise exception 'Choose postpone, rearrange or cancel' using errcode='22023'; end if;

  insert into public.coach_hub_messages(club_id,person_id,team_key,message_type,title,body,related_type,related_id,requires_acknowledgement,created_by)
  select target_club_id,assignment.person_id,booking_row.team_key,'fixture_change',message_title,message_body,'annual_planner_booking',coalesce(replacement_id,booking_row.id)::text,true,actor_id
  from public.coach_hub_team_assignments assignment
  where assignment.club_id=target_club_id and assignment.team_key=booking_row.team_key and assignment.status='active'
  group by assignment.person_id;
  perform public.record_audit_event(target_club_id,'annual_planner.weather.'||action_safe,'annual_planner_booking',booking_row.id::text,jsonb_build_object('reason',reason_value,'replacement_booking_id',replacement_id));
  return jsonb_build_object('booking_id',booking_row.id,'action',action_safe,'replacement_booking_id',replacement_id);
end;
$$;

create or replace function public.list_annual_planner_workspace(target_club_id uuid,range_start date default null,range_end date default null)
returns jsonb language plpgsql stable security definer set search_path='' set row_security=off as $$
declare start_boundary timestamptz:=coalesce(range_start,make_date(extract(year from current_date)::integer,1,1))::timestamptz; end_boundary timestamptz:=(coalesce(range_end,make_date(extract(year from current_date)::integer,12,31))+1)::timestamptz; can_view_costs boolean:=false;
begin
  if auth.uid() is null or not public.is_club_member(target_club_id) then raise exception 'Annual planner access denied' using errcode='42501'; end if;
  if not private.club_has_entitlement(target_club_id,'annual_planner') then raise exception 'Annual planner is not included in this workspace package' using errcode='42501'; end if;
  select public.can_manage_club(target_club_id) or coalesce((select settings.show_costs_to_schedulers from public.annual_planner_settings settings where settings.club_id=target_club_id),true) into can_view_costs;
  return jsonb_build_object(
    'settings',coalesce((select to_jsonb(settings) from public.annual_planner_settings settings where settings.club_id=target_club_id),'{}'::jsonb),
    'bookings',coalesce((select jsonb_agg(case when can_view_costs then to_jsonb(booking) else to_jsonb(booking)-'cost_pence'-'supplier_reference' end order by booking.start_at,booking.title) from public.annual_planner_bookings booking where booking.club_id=target_club_id and booking.start_at<end_boundary and booking.end_at>=start_boundary),'[]'::jsonb),
    'blackouts',coalesce((select jsonb_agg(to_jsonb(blackout) order by blackout.start_at,blackout.title) from public.annual_planner_blackouts blackout where blackout.club_id=target_club_id and blackout.start_at<end_boundary and blackout.end_at>=start_boundary),'[]'::jsonb),
    'winter_sites',coalesce((select jsonb_agg(case when can_view_costs then to_jsonb(site) else to_jsonb(site)-'cost_pence' end order by site.name) from public.annual_planner_sites site where site.club_id=target_club_id),'[]'::jsonb),
    'winter_slots',coalesce((select jsonb_agg(case when can_view_costs then to_jsonb(slot) else to_jsonb(slot)-'cost_pence' end order by slot.day_of_week,slot.start_time,slot.label) from public.annual_planner_site_slots slot where slot.club_id=target_club_id),'[]'::jsonb)
  );
end;
$$;

create or replace function public.get_coach_hub_winter_inventory(target_club_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' set row_security=off as $$
begin
  if private.current_coach_person_id(target_club_id) is null then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  return jsonb_build_object(
    'winter_sites',coalesce((select jsonb_agg(to_jsonb(site)-'cost_pence'-'cancellation_terms' order by site.name) from public.annual_planner_sites site where site.club_id=target_club_id and site.active),'[]'::jsonb),
    'winter_slots',coalesce((select jsonb_agg(to_jsonb(slot)-'cost_pence' order by slot.day_of_week,slot.start_time,slot.label) from public.annual_planner_site_slots slot join public.annual_planner_sites site on site.id=slot.site_id where slot.club_id=target_club_id and slot.active and site.active),'[]'::jsonb)
  );
end;
$$;

create or replace function public.get_annual_planner_analytics_data(target_club_id uuid,range_start date default null,range_end date default null)
returns jsonb language plpgsql stable security definer set search_path='' set row_security=off as $$
declare start_boundary timestamptz:=coalesce(range_start,make_date(extract(year from current_date)::integer,1,1))::timestamptz; end_boundary timestamptz:=(coalesce(range_end,make_date(extract(year from current_date)::integer,12,31))+1)::timestamptz; can_view_costs boolean:=false;
begin
  if auth.uid() is null or not public.is_club_member(target_club_id) then raise exception 'Analytics access denied' using errcode='42501'; end if;
  if not private.club_has_entitlement(target_club_id,'analytics_core') then raise exception 'Analytics are not included in this workspace package' using errcode='42501'; end if;
  select public.can_manage_club(target_club_id) or coalesce((select settings.show_costs_to_schedulers from public.annual_planner_settings settings where settings.club_id=target_club_id),true) into can_view_costs;
  return jsonb_build_object(
    'bookings',coalesce((select jsonb_agg(case when can_view_costs then to_jsonb(booking) else to_jsonb(booking)-'cost_pence'-'supplier_reference' end order by booking.start_at) from public.annual_planner_bookings booking where booking.club_id=target_club_id and booking.start_at<end_boundary and booking.end_at>=start_boundary),'[]'::jsonb),
    'blackouts',coalesce((select jsonb_agg(to_jsonb(blackout) order by blackout.start_at) from public.annual_planner_blackouts blackout where blackout.club_id=target_club_id and blackout.start_at<end_boundary and blackout.end_at>=start_boundary),'[]'::jsonb),
    'winter_sites',coalesce((select jsonb_agg(case when can_view_costs then to_jsonb(site) else to_jsonb(site)-'cost_pence' end) from public.annual_planner_sites site where site.club_id=target_club_id),'[]'::jsonb),
    'winter_slots',coalesce((select jsonb_agg(case when can_view_costs then to_jsonb(slot) else to_jsonb(slot)-'cost_pence' end) from public.annual_planner_site_slots slot where slot.club_id=target_club_id),'[]'::jsonb),
    'requests',coalesce((select jsonb_agg(to_jsonb(request_row)-'admin_notes' order by request_row.created_at) from public.coach_hub_requests request_row where request_row.club_id=target_club_id and request_row.created_at<end_boundary and request_row.created_at>=start_boundary),'[]'::jsonb)
  );
end;
$$;

revoke all on function private.pitch_area_slot_available(uuid,text,text,timestamptz,timestamptz,text,uuid) from public,anon,authenticated;
revoke all on function public.check_coach_hub_request_availability(uuid,jsonb), public.save_annual_planner_booking(uuid,jsonb), public.submit_coach_hub_request_v2(uuid,jsonb), public.update_my_coach_hub_request_v2(uuid,uuid,jsonb), public.review_coach_hub_request_v2(uuid,uuid,text,jsonb), public.save_annual_planner_winter_site(uuid,jsonb), public.delete_annual_planner_winter_site(uuid,uuid), public.save_annual_planner_winter_slot(uuid,jsonb), public.delete_annual_planner_winter_slot(uuid,uuid), public.record_annual_planner_weather_disruption(uuid,uuid,text,jsonb), public.list_annual_planner_workspace(uuid,date,date), public.get_coach_hub_winter_inventory(uuid), public.get_annual_planner_analytics_data(uuid,date,date) from public,anon;
grant execute on function public.check_coach_hub_request_availability(uuid,jsonb), public.save_annual_planner_booking(uuid,jsonb), public.submit_coach_hub_request_v2(uuid,jsonb), public.update_my_coach_hub_request_v2(uuid,uuid,jsonb), public.review_coach_hub_request_v2(uuid,uuid,text,jsonb), public.save_annual_planner_winter_site(uuid,jsonb), public.delete_annual_planner_winter_site(uuid,uuid), public.save_annual_planner_winter_slot(uuid,jsonb), public.delete_annual_planner_winter_slot(uuid,uuid), public.record_annual_planner_weather_disruption(uuid,uuid,text,jsonb), public.list_annual_planner_workspace(uuid,date,date), public.get_coach_hub_winter_inventory(uuid), public.get_annual_planner_analytics_data(uuid,date,date) to authenticated;

comment on function private.pitch_area_slot_available(uuid,text,text,timestamptz,timestamptz,text,uuid) is 'v3.10.6 allocation authority: Full Pitch blocks every named area; named areas share capacity; winter slots use fixed provider capacity.';
comment on function public.record_annual_planner_weather_disruption(uuid,uuid,text,jsonb) is 'v3.10.6 weather workflow preserving original and replacement bookings, coach messages and analytics evidence.';
comment on function public.get_annual_planner_analytics_data(uuid,date,date) is 'Shared Annual Planner analytics payload used by module insights, main analytics and grant evidence.';

notify pgrst,'reload schema';
commit;
