-- Daxora Ground Control v3.10.10
-- Seasonal rollover, training waitlists, shared resources and buffered facility capacity.
begin;

alter table public.annual_planner_bookings
  add column if not exists participant_count integer not null default 0,
  add column if not exists setup_buffer_minutes integer not null default 0,
  add column if not exists clear_down_buffer_minutes integer not null default 0,
  add column if not exists resource_requirements jsonb not null default '[]'::jsonb;

alter table public.annual_planner_bookings
  drop constraint if exists annual_planner_bookings_participant_count_check;
alter table public.annual_planner_bookings
  add constraint annual_planner_bookings_participant_count_check check (participant_count between 0 and 999);
alter table public.annual_planner_bookings
  drop constraint if exists annual_planner_bookings_setup_buffer_check;
alter table public.annual_planner_bookings
  add constraint annual_planner_bookings_setup_buffer_check check (setup_buffer_minutes between 0 and 240);
alter table public.annual_planner_bookings
  drop constraint if exists annual_planner_bookings_clear_down_buffer_check;
alter table public.annual_planner_bookings
  add constraint annual_planner_bookings_clear_down_buffer_check check (clear_down_buffer_minutes between 0 and 240);
alter table public.annual_planner_bookings
  drop constraint if exists annual_planner_bookings_resource_requirements_array_check;
alter table public.annual_planner_bookings
  add constraint annual_planner_bookings_resource_requirements_array_check check (jsonb_typeof(resource_requirements)='array');

create table if not exists public.annual_planner_resources (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  resource_type text not null default 'equipment' check (resource_type in ('equipment','changing_room','access','lighting','staff','other')),
  quantity integer not null default 1 check (quantity between 1 and 999),
  setup_buffer_minutes integer not null default 0 check (setup_buffer_minutes between 0 and 240),
  clear_down_buffer_minutes integer not null default 0 check (clear_down_buffer_minutes between 0 and 240),
  notes text,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id,name)
);

create table if not exists public.annual_planner_waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  team_key text not null,
  team_name text not null,
  season_phase text not null default 'regular' check (season_phase in ('preseason','regular','winter')),
  preferred_days integer[] not null default array[1,2,3,4,5],
  preferred_start_times time[] not null default '{}',
  required_duration_minutes integer not null default 90 check (required_duration_minutes between 30 and 240),
  pitch_id text,
  pitch_area_id text,
  winter_site_id uuid references public.annual_planner_sites(id) on delete set null,
  resource_requirements jsonb not null default '[]'::jsonb check (jsonb_typeof(resource_requirements)='array'),
  participant_count integer not null default 0 check (participant_count between 0 and 999),
  priority integer not null default 50 check (priority between 1 and 100),
  status text not null default 'waiting' check (status in ('waiting','offered','allocated','withdrawn')),
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (preferred_days <@ array[0,1,2,3,4,5,6])
);

create table if not exists public.annual_planner_season_rollovers (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  from_season_phase text not null check (from_season_phase in ('preseason','regular','winter')),
  to_season_phase text not null check (to_season_phase in ('preseason','regular','winter')),
  from_start_date date not null,
  from_end_date date not null,
  to_start_date date not null,
  to_end_date date not null,
  source_run_id uuid references public.annual_planner_allocation_runs(id) on delete set null,
  target_run_id uuid references public.annual_planner_allocation_runs(id) on delete set null,
  copied_preferences integer not null default 0,
  copied_allocations integer not null default 0,
  status text not null default 'draft' check (status in ('draft','reviewed','published','cancelled')),
  summary jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (from_end_date>=from_start_date),
  check (to_end_date>=to_start_date),
  check (from_season_phase<>to_season_phase or from_start_date<>to_start_date or from_end_date<>to_end_date)
);

create index if not exists annual_planner_resources_club_active_idx on public.annual_planner_resources(club_id,active,name);
create index if not exists annual_planner_waitlist_queue_idx on public.annual_planner_waitlist_entries(club_id,status,season_phase,priority desc,created_at);
create index if not exists annual_planner_rollovers_club_idx on public.annual_planner_season_rollovers(club_id,created_at desc);

alter table public.annual_planner_resources enable row level security;
alter table public.annual_planner_resources force row level security;
alter table public.annual_planner_waitlist_entries enable row level security;
alter table public.annual_planner_waitlist_entries force row level security;
alter table public.annual_planner_season_rollovers enable row level security;
alter table public.annual_planner_season_rollovers force row level security;

revoke all on table public.annual_planner_resources, public.annual_planner_waitlist_entries, public.annual_planner_season_rollovers from public,anon,authenticated;

drop policy if exists annual_planner_resources_read on public.annual_planner_resources;
create policy annual_planner_resources_read on public.annual_planner_resources for select to authenticated using (public.is_club_member(club_id));
drop policy if exists annual_planner_resources_write on public.annual_planner_resources;
create policy annual_planner_resources_write on public.annual_planner_resources for all to authenticated using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));
drop policy if exists annual_planner_waitlist_read on public.annual_planner_waitlist_entries;
create policy annual_planner_waitlist_read on public.annual_planner_waitlist_entries for select to authenticated using (public.is_club_member(club_id));
drop policy if exists annual_planner_waitlist_write on public.annual_planner_waitlist_entries;
create policy annual_planner_waitlist_write on public.annual_planner_waitlist_entries for all to authenticated using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));
drop policy if exists annual_planner_rollovers_read on public.annual_planner_season_rollovers;
create policy annual_planner_rollovers_read on public.annual_planner_season_rollovers for select to authenticated using (public.is_club_member(club_id));
drop policy if exists annual_planner_rollovers_write on public.annual_planner_season_rollovers;
create policy annual_planner_rollovers_write on public.annual_planner_season_rollovers for all to authenticated using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

create or replace function private.pitch_area_buffered_slot_available(
  target_club_id uuid,
  target_pitch_id text,
  target_pitch_area_id text,
  start_value timestamptz,
  end_value timestamptz,
  booking_type_value text,
  setup_buffer_value integer default 0,
  clear_down_buffer_value integer default 0,
  ignore_booking_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
set row_security=off
as $$
declare
  type_value text:=lower(trim(coalesce(booking_type_value,'training')));
  area_value text:=nullif(trim(coalesce(target_pitch_area_id,'')),'');
  full_value boolean:=type_value<>'training' or area_value is null or area_value='__full_pitch__';
  capacity_value integer:=1;
  slot_id_value uuid;
  overlap_count integer:=0;
  buffered_start timestamptz:=start_value-make_interval(mins=>greatest(0,least(240,coalesce(setup_buffer_value,0))));
  buffered_end timestamptz:=end_value+make_interval(mins=>greatest(0,least(240,coalesce(clear_down_buffer_value,0))));
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
    select count(*) into overlap_count
    from public.annual_planner_bookings existing
    where existing.club_id=target_club_id and existing.id is distinct from ignore_booking_id
      and (existing.site_slot_id=slot_id_value or existing.pitch_id=target_pitch_id)
      and existing.status in ('requested','provisional','confirmed')
      and tstzrange(existing.start_at-make_interval(mins=>existing.setup_buffer_minutes),existing.end_at+make_interval(mins=>existing.clear_down_buffer_minutes),'[)')
        && tstzrange(buffered_start,buffered_end,'[)');
    if type_value<>'training' then return overlap_count=0; end if;
    return overlap_count<capacity_value;
  end if;

  if private.pitch_is_closed(target_club_id,target_pitch_id,buffered_start,buffered_end) then return false; end if;
  capacity_value:=private.pitch_training_capacity(target_club_id,target_pitch_id);

  if full_value then
    return not exists(
      select 1 from public.annual_planner_bookings existing
      where existing.club_id=target_club_id and existing.id is distinct from ignore_booking_id
        and existing.pitch_id=target_pitch_id and existing.status in ('requested','provisional','confirmed')
        and tstzrange(existing.start_at-make_interval(mins=>existing.setup_buffer_minutes),existing.end_at+make_interval(mins=>existing.clear_down_buffer_minutes),'[)')
          && tstzrange(buffered_start,buffered_end,'[)')
    );
  end if;

  if exists(
    select 1 from public.annual_planner_bookings existing
    where existing.club_id=target_club_id and existing.id is distinct from ignore_booking_id
      and existing.pitch_id=target_pitch_id and existing.status in ('requested','provisional','confirmed')
      and tstzrange(existing.start_at-make_interval(mins=>existing.setup_buffer_minutes),existing.end_at+make_interval(mins=>existing.clear_down_buffer_minutes),'[)')
        && tstzrange(buffered_start,buffered_end,'[)')
      and (
        lower(coalesce(existing.booking_type,'training'))<>'training'
        or existing.pitch_area_id is null
        or existing.pitch_area_id='__full_pitch__'
        or existing.pitch_area_id=area_value
      )
  ) then return false; end if;

  select count(*) into overlap_count
  from public.annual_planner_bookings existing
  where existing.club_id=target_club_id and existing.id is distinct from ignore_booking_id
    and existing.pitch_id=target_pitch_id and existing.status in ('requested','provisional','confirmed')
    and tstzrange(existing.start_at-make_interval(mins=>existing.setup_buffer_minutes),existing.end_at+make_interval(mins=>existing.clear_down_buffer_minutes),'[)')
      && tstzrange(buffered_start,buffered_end,'[)');
  return overlap_count<capacity_value;
end;
$$;

create or replace function private.annual_planner_resources_available(
  target_club_id uuid,
  requirements_value jsonb,
  start_value timestamptz,
  end_value timestamptz,
  setup_buffer_value integer default 0,
  clear_down_buffer_value integer default 0,
  ignore_booking_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
set row_security=off
as $$
declare
  requirement jsonb;
  resource_row public.annual_planner_resources%rowtype;
  resource_id_value uuid;
  requested_quantity integer;
  used_quantity integer;
  candidate_start timestamptz;
  candidate_end timestamptz;
begin
  if requirements_value is null or jsonb_typeof(requirements_value)<>'array' or jsonb_array_length(requirements_value)=0 then return true; end if;
  for requirement in select value from jsonb_array_elements(requirements_value) row_value(value) loop
    begin resource_id_value:=coalesce(nullif(requirement->>'resource_id',''),nullif(requirement->>'resourceId',''))::uuid; exception when others then return false; end;
    requested_quantity:=greatest(1,least(999,coalesce((requirement->>'quantity')::integer,1)));
    select * into resource_row from public.annual_planner_resources resource where resource.id=resource_id_value and resource.club_id=target_club_id and resource.active;
    if resource_row.id is null or requested_quantity>resource_row.quantity then return false; end if;
    candidate_start:=start_value-make_interval(mins=>greatest(setup_buffer_value,resource_row.setup_buffer_minutes));
    candidate_end:=end_value+make_interval(mins=>greatest(clear_down_buffer_value,resource_row.clear_down_buffer_minutes));
    select coalesce(sum(greatest(1,coalesce((item->>'quantity')::integer,1))),0)::integer into used_quantity
    from public.annual_planner_bookings existing
    cross join lateral jsonb_array_elements(existing.resource_requirements) item
    where existing.club_id=target_club_id and existing.id is distinct from ignore_booking_id
      and existing.status in ('requested','provisional','confirmed')
      and coalesce(nullif(item->>'resource_id',''),nullif(item->>'resourceId',''))=resource_id_value::text
      and tstzrange(
        existing.start_at-make_interval(mins=>greatest(existing.setup_buffer_minutes,resource_row.setup_buffer_minutes)),
        existing.end_at+make_interval(mins=>greatest(existing.clear_down_buffer_minutes,resource_row.clear_down_buffer_minutes)),
        '[)'
      ) && tstzrange(candidate_start,candidate_end,'[)');
    if used_quantity+requested_quantity>resource_row.quantity then return false; end if;
  end loop;
  return true;
end;
$$;

create or replace function public.save_annual_planner_booking_v4(target_club_id uuid,booking_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security=off
as $$
declare
  target_id uuid:=nullif(booking_data->>'booking_id','')::uuid;
  start_value timestamptz:=(booking_data->>'start_at')::timestamptz;
  end_value timestamptz:=(booking_data->>'end_at')::timestamptz;
  setup_value integer:=greatest(0,least(240,coalesce((booking_data->>'setup_buffer_minutes')::integer,0)));
  clear_value integer:=greatest(0,least(240,coalesce((booking_data->>'clear_down_buffer_minutes')::integer,0)));
  participant_value integer:=greatest(0,least(999,coalesce((booking_data->>'participant_count')::integer,0)));
  requirements_value jsonb:=coalesce((select jsonb_agg(jsonb_build_object('resource_id',resource_id_value,'quantity',quantity_value)) from (
    select coalesce(nullif(item->>'resource_id',''),nullif(item->>'resourceId','')) as resource_id_value,
      greatest(1,least(999,coalesce((item->>'quantity')::integer,1))) as quantity_value
    from jsonb_array_elements(coalesce(booking_data->'resource_requirements','[]'::jsonb)) item
    where coalesce(nullif(item->>'resource_id',''),nullif(item->>'resourceId','')) is not null
  ) normalised),'[]'::jsonb);
  result jsonb;
  result_id uuid;
begin
  if not private.pitch_area_buffered_slot_available(
    target_club_id,
    nullif(booking_data->>'pitch_id',''),
    nullif(booking_data->>'pitch_area_id',''),
    start_value,
    end_value,
    coalesce(nullif(booking_data->>'booking_type',''),'training'),
    setup_value,
    clear_value,
    target_id
  ) then raise exception 'This pitch or area is unavailable once setup and clear-down time are included' using errcode='23P01'; end if;

  if not private.annual_planner_resources_available(target_club_id,requirements_value,start_value,end_value,setup_value,clear_value,target_id) then
    raise exception 'A shared resource has reached capacity during the buffered booking period' using errcode='23P01';
  end if;

  result:=public.save_annual_planner_booking(target_club_id,booking_data);
  result_id:=(result->>'id')::uuid;
  update public.annual_planner_bookings booking set
    participant_count=participant_value,
    setup_buffer_minutes=setup_value,
    clear_down_buffer_minutes=clear_value,
    resource_requirements=requirements_value,
    updated_at=now()
  where booking.id=result_id and booking.club_id=target_club_id;
  perform public.record_audit_event(target_club_id,'annual_planner.booking.capacity_saved','annual_planner_booking',result_id::text,jsonb_build_object('participant_count',participant_value,'setup_buffer_minutes',setup_value,'clear_down_buffer_minutes',clear_value,'resource_requirements',requirements_value));
  return (select to_jsonb(booking) from public.annual_planner_bookings booking where booking.id=result_id);
end;
$$;

create or replace function public.save_annual_planner_booking_series_v4(target_club_id uuid,booking_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security=off
as $$
declare
  row_value jsonb;
  saved_rows jsonb:='[]'::jsonb;
begin
  if jsonb_typeof(coalesce(booking_rows,'[]'::jsonb))<>'array' then raise exception 'Booking rows must be an array' using errcode='22023'; end if;
  for row_value in select value from jsonb_array_elements(coalesce(booking_rows,'[]'::jsonb)) row_data(value) loop
    saved_rows:=saved_rows||jsonb_build_array(public.save_annual_planner_booking_v4(target_club_id,row_value));
  end loop;
  return saved_rows;
end;
$$;

create or replace function public.save_annual_planner_resource(target_club_id uuid,resource_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security=off
as $$
declare
  actor_id uuid:=auth.uid();
  target_id uuid:=nullif(resource_data->>'id','')::uuid;
  result public.annual_planner_resources%rowtype;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then raise exception 'Club owner or administrator access required' using errcode='42501'; end if;
  if trim(coalesce(resource_data->>'name',''))='' then raise exception 'Resource name is required' using errcode='22023'; end if;
  if target_id is null then
    insert into public.annual_planner_resources(club_id,name,resource_type,quantity,setup_buffer_minutes,clear_down_buffer_minutes,notes,active,created_by,updated_by)
    values(target_club_id,trim(resource_data->>'name'),case lower(trim(coalesce(resource_data->>'resource_type','equipment'))) when 'changing_room' then 'changing_room' when 'access' then 'access' when 'lighting' then 'lighting' when 'staff' then 'staff' when 'other' then 'other' else 'equipment' end,
      greatest(1,least(999,coalesce((resource_data->>'quantity')::integer,1))),greatest(0,least(240,coalesce((resource_data->>'setup_buffer_minutes')::integer,0))),greatest(0,least(240,coalesce((resource_data->>'clear_down_buffer_minutes')::integer,0))),nullif(resource_data->>'notes',''),coalesce((resource_data->>'active')::boolean,true),actor_id,actor_id)
    on conflict (club_id,name) do update set resource_type=excluded.resource_type,quantity=excluded.quantity,setup_buffer_minutes=excluded.setup_buffer_minutes,clear_down_buffer_minutes=excluded.clear_down_buffer_minutes,notes=excluded.notes,active=excluded.active,updated_by=actor_id,updated_at=now()
    returning * into result;
  else
    update public.annual_planner_resources resource set name=trim(resource_data->>'name'),resource_type=case lower(trim(coalesce(resource_data->>'resource_type',resource.resource_type))) when 'changing_room' then 'changing_room' when 'access' then 'access' when 'lighting' then 'lighting' when 'staff' then 'staff' when 'other' then 'other' else 'equipment' end,
      quantity=greatest(1,least(999,coalesce((resource_data->>'quantity')::integer,resource.quantity))),setup_buffer_minutes=greatest(0,least(240,coalesce((resource_data->>'setup_buffer_minutes')::integer,resource.setup_buffer_minutes))),clear_down_buffer_minutes=greatest(0,least(240,coalesce((resource_data->>'clear_down_buffer_minutes')::integer,resource.clear_down_buffer_minutes))),notes=nullif(resource_data->>'notes',''),active=coalesce((resource_data->>'active')::boolean,resource.active),updated_by=actor_id,updated_at=now()
    where resource.id=target_id and resource.club_id=target_club_id returning * into result;
  end if;
  if result.id is null then raise exception 'Shared resource not found' using errcode='P0002'; end if;
  perform public.record_audit_event(target_club_id,'annual_planner.resource.saved','annual_planner_resource',result.id::text,jsonb_build_object('name',result.name,'quantity',result.quantity));
  return to_jsonb(result);
end;
$$;

create or replace function public.delete_annual_planner_resource(target_club_id uuid,target_resource_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security=off
as $$
declare actor_id uuid:=auth.uid(); result public.annual_planner_resources%rowtype;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then raise exception 'Club owner or administrator access required' using errcode='42501'; end if;
  update public.annual_planner_resources resource set active=false,updated_by=actor_id,updated_at=now() where resource.id=target_resource_id and resource.club_id=target_club_id returning * into result;
  if result.id is null then raise exception 'Shared resource not found' using errcode='P0002'; end if;
  perform public.record_audit_event(target_club_id,'annual_planner.resource.deactivated','annual_planner_resource',result.id::text,jsonb_build_object('name',result.name));
  return to_jsonb(result);
end;
$$;

create or replace function public.save_annual_planner_waitlist_entry(target_club_id uuid,waitlist_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security=off
as $$
declare
  actor_id uuid:=auth.uid();
  target_id uuid:=nullif(waitlist_data->>'id','')::uuid;
  result public.annual_planner_waitlist_entries%rowtype;
  days_value integer[]:=coalesce(array(select value::integer from jsonb_array_elements_text(coalesce(waitlist_data->'preferred_days','[]'::jsonb)) row_value(value) where value::integer between 0 and 6),'{}'::integer[]);
  times_value time[]:=coalesce(array(select value::time from jsonb_array_elements_text(coalesce(waitlist_data->'preferred_start_times','[]'::jsonb)) row_value(value)),'{}'::time[]);
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then raise exception 'Club owner or administrator access required' using errcode='42501'; end if;
  if trim(coalesce(waitlist_data->>'team_key',''))='' then raise exception 'Team is required' using errcode='22023'; end if;
  if target_id is null then
    insert into public.annual_planner_waitlist_entries(club_id,team_key,team_name,season_phase,preferred_days,preferred_start_times,required_duration_minutes,pitch_id,pitch_area_id,winter_site_id,resource_requirements,participant_count,priority,status,notes,created_by,updated_by)
    values(target_club_id,lower(trim(waitlist_data->>'team_key')),trim(coalesce(waitlist_data->>'team_name',waitlist_data->>'team_key')),case lower(trim(coalesce(waitlist_data->>'season_phase','regular'))) when 'preseason' then 'preseason' when 'winter' then 'winter' else 'regular' end,
      days_value,times_value,greatest(30,least(240,coalesce((waitlist_data->>'required_duration_minutes')::integer,90))),nullif(waitlist_data->>'pitch_id',''),nullif(waitlist_data->>'pitch_area_id',''),nullif(waitlist_data->>'winter_site_id','')::uuid,coalesce(waitlist_data->'resource_requirements','[]'::jsonb),greatest(0,least(999,coalesce((waitlist_data->>'participant_count')::integer,0))),greatest(1,least(100,coalesce((waitlist_data->>'priority')::integer,50))),case lower(trim(coalesce(waitlist_data->>'status','waiting'))) when 'offered' then 'offered' when 'allocated' then 'allocated' when 'withdrawn' then 'withdrawn' else 'waiting' end,nullif(waitlist_data->>'notes',''),actor_id,actor_id)
    returning * into result;
  else
    update public.annual_planner_waitlist_entries waitlist set team_key=lower(trim(waitlist_data->>'team_key')),team_name=trim(coalesce(waitlist_data->>'team_name',waitlist.team_name)),season_phase=case lower(trim(coalesce(waitlist_data->>'season_phase',waitlist.season_phase))) when 'preseason' then 'preseason' when 'winter' then 'winter' else 'regular' end,
      preferred_days=days_value,preferred_start_times=times_value,required_duration_minutes=greatest(30,least(240,coalesce((waitlist_data->>'required_duration_minutes')::integer,waitlist.required_duration_minutes))),pitch_id=nullif(waitlist_data->>'pitch_id',''),pitch_area_id=nullif(waitlist_data->>'pitch_area_id',''),winter_site_id=nullif(waitlist_data->>'winter_site_id','')::uuid,resource_requirements=coalesce(waitlist_data->'resource_requirements',waitlist.resource_requirements),participant_count=greatest(0,least(999,coalesce((waitlist_data->>'participant_count')::integer,waitlist.participant_count))),priority=greatest(1,least(100,coalesce((waitlist_data->>'priority')::integer,waitlist.priority))),status=case lower(trim(coalesce(waitlist_data->>'status',waitlist.status))) when 'offered' then 'offered' when 'allocated' then 'allocated' when 'withdrawn' then 'withdrawn' else 'waiting' end,notes=nullif(waitlist_data->>'notes',''),updated_by=actor_id,updated_at=now()
    where waitlist.id=target_id and waitlist.club_id=target_club_id returning * into result;
  end if;
  if result.id is null then raise exception 'Waitlist entry not found' using errcode='P0002'; end if;
  perform public.record_audit_event(target_club_id,'annual_planner.waitlist.saved','annual_planner_waitlist_entry',result.id::text,jsonb_build_object('team_key',result.team_key,'status',result.status,'priority',result.priority));
  return to_jsonb(result);
end;
$$;

create or replace function public.create_annual_planner_season_rollover(target_club_id uuid,rollover_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security=off
as $$
declare
  actor_id uuid:=auth.uid();
  from_phase text:=case lower(trim(coalesce(rollover_data->>'from_season_phase','regular'))) when 'preseason' then 'preseason' when 'winter' then 'winter' else 'regular' end;
  to_phase text:=case lower(trim(coalesce(rollover_data->>'to_season_phase','winter'))) when 'preseason' then 'preseason' when 'regular' then 'regular' else 'winter' end;
  from_start date:=nullif(rollover_data->>'from_start_date','')::date;
  from_end date:=nullif(rollover_data->>'from_end_date','')::date;
  to_start date:=nullif(rollover_data->>'to_start_date','')::date;
  to_end date:=nullif(rollover_data->>'to_end_date','')::date;
  copy_preferences boolean:=coalesce((rollover_data->>'copy_preferences')::boolean,true);
  copy_allocations boolean:=coalesce((rollover_data->>'copy_allocations')::boolean,true);
  source_run public.annual_planner_allocation_runs%rowtype;
  target_run public.annual_planner_allocation_runs%rowtype;
  rollover_row public.annual_planner_season_rollovers%rowtype;
  preference_count integer:=0;
  allocation_count integer:=0;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then raise exception 'Club owner or administrator access required' using errcode='42501'; end if;
  if from_start is null or from_end is null or to_start is null or to_end is null or from_end<from_start or to_end<to_start then raise exception 'Valid source and target date ranges are required' using errcode='22023'; end if;
  if from_phase=to_phase and from_start=to_start and from_end=to_end then raise exception 'The target season must differ from the source period' using errcode='22023'; end if;

  select * into source_run from public.annual_planner_allocation_runs run
  where run.club_id=target_club_id and run.season_phase=from_phase and run.status='published'
    and run.start_date<=from_end and run.end_date>=from_start
  order by run.published_at desc nulls last,run.created_at desc limit 1;

  insert into public.annual_planner_season_rollovers(club_id,from_season_phase,to_season_phase,from_start_date,from_end_date,to_start_date,to_end_date,source_run_id,status,summary,created_by)
  values(target_club_id,from_phase,to_phase,from_start,from_end,to_start,to_end,source_run.id,'draft',jsonb_build_object('copy_preferences',copy_preferences,'copy_allocations',copy_allocations),actor_id)
  returning * into rollover_row;

  if copy_preferences then
    insert into public.annual_planner_team_preferences(
      club_id,team_key,team_name,season_phase,allocation_mode,preferred_days,preferred_start_times,unavailable_days,preferred_pitch_ids,preferred_winter_site_ids,required_duration_minutes,minimum_area_mode,priority_weight,keep_current_allocation,manual_only,notes,override_fields,preference_source,approved_proposal_id,created_by,updated_by
    )
    select preference.club_id,preference.team_key,preference.team_name,to_phase,preference.allocation_mode,preference.preferred_days,preference.preferred_start_times,preference.unavailable_days,
      case when to_phase='winter' then '{}'::text[] else preference.preferred_pitch_ids end,
      case when to_phase='winter' then preference.preferred_winter_site_ids else '{}'::uuid[] end,
      preference.required_duration_minutes,preference.minimum_area_mode,preference.priority_weight,preference.keep_current_allocation,preference.manual_only,
      concat_ws(E'\n',nullif(preference.notes,''),'Rolled over from '||from_phase||' by '||rollover_row.id::text),preference.override_fields,'import',null,actor_id,actor_id
    from public.annual_planner_team_preferences preference
    where preference.club_id=target_club_id and preference.season_phase=from_phase
    on conflict (club_id,team_key,season_phase) do update set
      allocation_mode=excluded.allocation_mode,preferred_days=excluded.preferred_days,preferred_start_times=excluded.preferred_start_times,unavailable_days=excluded.unavailable_days,
      preferred_pitch_ids=excluded.preferred_pitch_ids,preferred_winter_site_ids=excluded.preferred_winter_site_ids,required_duration_minutes=excluded.required_duration_minutes,
      minimum_area_mode=excluded.minimum_area_mode,priority_weight=excluded.priority_weight,keep_current_allocation=excluded.keep_current_allocation,manual_only=excluded.manual_only,
      notes=excluded.notes,override_fields=excluded.override_fields,preference_source='import',approved_proposal_id=null,updated_by=actor_id,updated_at=now();
    get diagnostics preference_count=row_count;
  end if;

  if copy_allocations and source_run.id is not null then
    insert into public.annual_planner_allocation_runs(club_id,season_phase,mode,status,start_date,end_date,default_start_times,summary,created_by,updated_by)
    values(target_club_id,to_phase,'assisted','draft',to_start,to_end,source_run.default_start_times,jsonb_build_object('rollover_id',rollover_row.id,'source_run_id',source_run.id,'cross_inventory',from_phase<>to_phase),actor_id,actor_id)
    returning * into target_run;

    insert into public.annual_planner_allocation_items(run_id,club_id,team_key,team_name,status,locked,confidence,score,day_of_week,start_time,end_time,pitch_id,pitch_name,pitch_area_id,pitch_area_name,site_inventory_id,site_slot_id,reasons,warnings,alternatives,created_at,updated_at)
    select target_run.id,item.club_id,item.team_key,item.team_name,
      case when from_phase=to_phase then 'suggested' else 'unassigned' end,false,
      case when from_phase=to_phase then item.confidence else 'none' end,
      case when from_phase=to_phase then item.score else 0 end,
      item.day_of_week,item.start_time,item.end_time,
      case when from_phase=to_phase then item.pitch_id else null end,
      case when from_phase=to_phase then item.pitch_name else null end,
      case when from_phase=to_phase then item.pitch_area_id else null end,
      case when from_phase=to_phase then item.pitch_area_name else null end,
      case when from_phase=to_phase then item.site_inventory_id else null end,
      case when from_phase=to_phase then item.site_slot_id else null end,
      case when from_phase=to_phase then jsonb_build_array('Copied from the previous published allocation') else jsonb_build_array('Previous day and time retained; target-season resource must be reassigned') end,
      case when from_phase=to_phase then '[]'::jsonb else jsonb_build_array('Summer and winter inventories are intentionally separate') end,
      '[]'::jsonb,now(),now()
    from public.annual_planner_allocation_items item
    where item.run_id=source_run.id and item.status='published';
    get diagnostics allocation_count=row_count;
  end if;

  update public.annual_planner_season_rollovers rollover set target_run_id=target_run.id,copied_preferences=preference_count,copied_allocations=allocation_count,
    summary=rollover.summary||jsonb_build_object('source_run_found',source_run.id is not null,'target_run_id',target_run.id,'copied_preferences',preference_count,'copied_allocations',allocation_count)
  where rollover.id=rollover_row.id returning * into rollover_row;

  perform public.record_audit_event(target_club_id,'annual_planner.season_rollover.created','annual_planner_season_rollover',rollover_row.id::text,rollover_row.summary);
  return to_jsonb(rollover_row);
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
    'season_rollovers',coalesce((select jsonb_agg(to_jsonb(rollover) order by rollover.created_at desc) from public.annual_planner_season_rollovers rollover where rollover.club_id=target_club_id),'[]'::jsonb)
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
    'waitlist',coalesce((select jsonb_agg(to_jsonb(waitlist) order by waitlist.created_at) from public.annual_planner_waitlist_entries waitlist where waitlist.club_id=target_club_id and waitlist.created_at<end_boundary and waitlist.created_at>=start_boundary),'[]'::jsonb),
    'season_rollovers',coalesce((select jsonb_agg(to_jsonb(rollover) order by rollover.created_at) from public.annual_planner_season_rollovers rollover where rollover.club_id=target_club_id and rollover.created_at<end_boundary and rollover.created_at>=start_boundary),'[]'::jsonb)
  );
end;
$$;

revoke all on function private.pitch_area_buffered_slot_available(uuid,text,text,timestamptz,timestamptz,text,integer,integer,uuid) from public,anon,authenticated;
revoke all on function private.annual_planner_resources_available(uuid,jsonb,timestamptz,timestamptz,integer,integer,uuid) from public,anon,authenticated;
revoke all on function public.save_annual_planner_booking_v4(uuid,jsonb) from public,anon;
revoke all on function public.save_annual_planner_booking_series_v4(uuid,jsonb) from public,anon;
revoke all on function public.save_annual_planner_resource(uuid,jsonb) from public,anon;
revoke all on function public.delete_annual_planner_resource(uuid,uuid) from public,anon;
revoke all on function public.save_annual_planner_waitlist_entry(uuid,jsonb) from public,anon;
revoke all on function public.create_annual_planner_season_rollover(uuid,jsonb) from public,anon;
revoke all on function public.list_annual_planner_scheduling_context(uuid) from public,anon;
revoke all on function public.get_annual_planner_analytics_data(uuid,date,date) from public,anon;

grant execute on function public.save_annual_planner_booking_v4(uuid,jsonb) to authenticated;
grant execute on function public.save_annual_planner_booking_series_v4(uuid,jsonb) to authenticated;
grant execute on function public.save_annual_planner_resource(uuid,jsonb) to authenticated;
grant execute on function public.delete_annual_planner_resource(uuid,uuid) to authenticated;
grant execute on function public.save_annual_planner_waitlist_entry(uuid,jsonb) to authenticated;
grant execute on function public.create_annual_planner_season_rollover(uuid,jsonb) to authenticated;
grant execute on function public.list_annual_planner_scheduling_context(uuid) to authenticated;
grant execute on function public.get_annual_planner_analytics_data(uuid,date,date) to authenticated;

comment on table public.annual_planner_resources is 'Shared equipment, rooms, access and staffing capacity used by Annual Planner bookings.';
comment on table public.annual_planner_waitlist_entries is 'Unmet training demand retained for later smart allocation and grant evidence.';
comment on table public.annual_planner_season_rollovers is 'Audited season-to-season copies of team preferences and published allocation drafts.';
comment on function public.create_annual_planner_season_rollover(uuid,jsonb) is 'Creates a reviewable target-season draft without mixing summer and winter facility inventories.';

notify pgrst,'reload schema';
commit;
