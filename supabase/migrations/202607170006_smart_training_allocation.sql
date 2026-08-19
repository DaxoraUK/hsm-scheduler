-- Daxora Ground Control v3.10.7
-- Explainable Manual, Assisted and Automatic Draft training allocation.
begin;

create table if not exists public.annual_planner_team_preferences (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  team_key text not null,
  team_name text not null,
  season_phase text not null default 'regular' check (season_phase in ('preseason','regular','winter')),
  allocation_mode text not null default 'inherit' check (allocation_mode in ('inherit','manual','assisted','automatic')),
  preferred_days integer[] not null default '{}',
  preferred_start_times time[] not null default '{}',
  unavailable_days integer[] not null default '{}',
  preferred_pitch_ids text[] not null default '{}',
  preferred_winter_site_ids uuid[] not null default '{}',
  required_duration_minutes integer not null default 90 check (required_duration_minutes between 30 and 240),
  minimum_area_mode text not null default 'any' check (minimum_area_mode in ('any','named_area','full_pitch')),
  priority_weight integer not null default 50 check (priority_weight between 1 and 100),
  keep_current_allocation boolean not null default false,
  manual_only boolean not null default false,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id,team_key,season_phase),
  check (preferred_days <@ array[0,1,2,3,4,5,6]),
  check (unavailable_days <@ array[0,1,2,3,4,5,6])
);

create table if not exists public.annual_planner_allocation_runs (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  season_phase text not null check (season_phase in ('preseason','regular','winter')),
  mode text not null check (mode in ('manual','assisted','automatic')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  start_date date not null,
  end_date date not null,
  default_start_times time[] not null default '{}',
  summary jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  check (end_date >= start_date)
);

create table if not exists public.annual_planner_allocation_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.annual_planner_allocation_runs(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  team_key text not null,
  team_name text not null,
  status text not null default 'suggested' check (status in ('recommendation','suggested','proposed','unassigned','published')),
  locked boolean not null default false,
  confidence text not null default 'low' check (confidence in ('none','low','medium','high')),
  score numeric(8,2) not null default 0,
  day_of_week integer check (day_of_week between 0 and 6),
  start_time time,
  end_time time,
  pitch_id text,
  pitch_name text,
  pitch_area_id text,
  pitch_area_name text,
  site_inventory_id uuid references public.annual_planner_sites(id) on delete set null,
  site_slot_id uuid references public.annual_planner_site_slots(id) on delete set null,
  reasons jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  alternatives jsonb not null default '[]'::jsonb,
  published_series_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id,team_key),
  check ((status='unassigned' and day_of_week is null) or status<>'unassigned'),
  check (end_time is null or start_time is null or end_time>start_time)
);

create index if not exists annual_planner_team_preferences_club_phase_idx on public.annual_planner_team_preferences(club_id,season_phase,team_key);
create index if not exists annual_planner_allocation_runs_club_phase_idx on public.annual_planner_allocation_runs(club_id,season_phase,created_at desc);
create index if not exists annual_planner_allocation_items_run_idx on public.annual_planner_allocation_items(run_id,status,day_of_week,start_time);

alter table public.annual_planner_team_preferences enable row level security;
alter table public.annual_planner_team_preferences force row level security;
alter table public.annual_planner_allocation_runs enable row level security;
alter table public.annual_planner_allocation_runs force row level security;
alter table public.annual_planner_allocation_items enable row level security;
alter table public.annual_planner_allocation_items force row level security;
revoke all on table public.annual_planner_team_preferences, public.annual_planner_allocation_runs, public.annual_planner_allocation_items from public,anon,authenticated;

drop policy if exists annual_planner_team_preferences_read on public.annual_planner_team_preferences;
create policy annual_planner_team_preferences_read on public.annual_planner_team_preferences for select to authenticated using (public.is_club_member(club_id));
drop policy if exists annual_planner_team_preferences_write on public.annual_planner_team_preferences;
create policy annual_planner_team_preferences_write on public.annual_planner_team_preferences for all to authenticated using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));
drop policy if exists annual_planner_allocation_runs_read on public.annual_planner_allocation_runs;
create policy annual_planner_allocation_runs_read on public.annual_planner_allocation_runs for select to authenticated using (public.is_club_member(club_id));
drop policy if exists annual_planner_allocation_runs_write on public.annual_planner_allocation_runs;
create policy annual_planner_allocation_runs_write on public.annual_planner_allocation_runs for all to authenticated using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));
drop policy if exists annual_planner_allocation_items_read on public.annual_planner_allocation_items;
create policy annual_planner_allocation_items_read on public.annual_planner_allocation_items for select to authenticated using (public.is_club_member(club_id));
drop policy if exists annual_planner_allocation_items_write on public.annual_planner_allocation_items;
create policy annual_planner_allocation_items_write on public.annual_planner_allocation_items for all to authenticated using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

create or replace function public.save_annual_planner_team_preference(target_club_id uuid,preference_data jsonb)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare
  actor_id uuid:=auth.uid();
  result public.annual_planner_team_preferences%rowtype;
  preferred_days_value integer[]:=coalesce(array(select value::integer from jsonb_array_elements_text(coalesce(preference_data->'preferred_days','[]'::jsonb)) row_value(value) where value::integer between 0 and 6),'{}'::integer[]);
  unavailable_days_value integer[]:=coalesce(array(select value::integer from jsonb_array_elements_text(coalesce(preference_data->'unavailable_days','[]'::jsonb)) row_value(value) where value::integer between 0 and 6),'{}'::integer[]);
  preferred_times_value time[]:=coalesce(array(select value::time from jsonb_array_elements_text(coalesce(preference_data->'preferred_start_times','[]'::jsonb)) row_value(value)),'{}'::time[]);
  preferred_pitch_ids_value text[]:=coalesce(array(select trim(value) from jsonb_array_elements_text(coalesce(preference_data->'preferred_pitch_ids','[]'::jsonb)) row_value(value) where trim(value)<>''),'{}'::text[]);
  preferred_site_ids_value uuid[]:=coalesce(array(select value::uuid from jsonb_array_elements_text(coalesce(preference_data->'preferred_winter_site_ids','[]'::jsonb)) row_value(value) where value~'^[0-9a-fA-F-]{36}$'),'{}'::uuid[]);
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then raise exception 'Club owner or administrator access required' using errcode='42501'; end if;
  if trim(coalesce(preference_data->>'team_key',''))='' then raise exception 'Team key is required' using errcode='22023'; end if;
  insert into public.annual_planner_team_preferences(
    club_id,team_key,team_name,season_phase,allocation_mode,preferred_days,preferred_start_times,unavailable_days,preferred_pitch_ids,preferred_winter_site_ids,
    required_duration_minutes,minimum_area_mode,priority_weight,keep_current_allocation,manual_only,notes,created_by,updated_by
  ) values (
    target_club_id,lower(trim(preference_data->>'team_key')),trim(coalesce(preference_data->>'team_name',preference_data->>'team_key')),
    case lower(trim(coalesce(preference_data->>'season_phase','regular'))) when 'preseason' then 'preseason' when 'winter' then 'winter' else 'regular' end,
    case lower(trim(coalesce(preference_data->>'allocation_mode','inherit'))) when 'manual' then 'manual' when 'assisted' then 'assisted' when 'automatic' then 'automatic' else 'inherit' end,
    preferred_days_value,preferred_times_value,unavailable_days_value,preferred_pitch_ids_value,preferred_site_ids_value,
    greatest(30,least(240,coalesce((preference_data->>'required_duration_minutes')::integer,90))),
    case lower(trim(coalesce(preference_data->>'minimum_area_mode','any'))) when 'named_area' then 'named_area' when 'full_pitch' then 'full_pitch' else 'any' end,
    greatest(1,least(100,coalesce((preference_data->>'priority_weight')::integer,50))),coalesce((preference_data->>'keep_current_allocation')::boolean,false),coalesce((preference_data->>'manual_only')::boolean,false),nullif(preference_data->>'notes',''),actor_id,actor_id
  ) on conflict (club_id,team_key,season_phase) do update set
    team_name=excluded.team_name,allocation_mode=excluded.allocation_mode,preferred_days=excluded.preferred_days,preferred_start_times=excluded.preferred_start_times,
    unavailable_days=excluded.unavailable_days,preferred_pitch_ids=excluded.preferred_pitch_ids,preferred_winter_site_ids=excluded.preferred_winter_site_ids,
    required_duration_minutes=excluded.required_duration_minutes,minimum_area_mode=excluded.minimum_area_mode,priority_weight=excluded.priority_weight,
    keep_current_allocation=excluded.keep_current_allocation,manual_only=excluded.manual_only,notes=excluded.notes,updated_by=actor_id,updated_at=now()
  returning * into result;
  perform public.record_audit_event(target_club_id,'annual_planner.smart_preference.saved','annual_planner_team_preference',result.id::text,jsonb_build_object('team_key',result.team_key,'season_phase',result.season_phase,'mode',result.allocation_mode));
  return to_jsonb(result);
end;
$$;

create or replace function public.save_annual_planner_allocation_run(target_club_id uuid,run_data jsonb,item_rows jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare
  actor_id uuid:=auth.uid();
  target_run_id uuid:=nullif(run_data->>'id','')::uuid;
  run_row public.annual_planner_allocation_runs%rowtype;
  item jsonb;
  item_result public.annual_planner_allocation_items%rowtype;
  items_result jsonb:='[]'::jsonb;
  start_times_value time[]:=coalesce(array(select value::time from jsonb_array_elements_text(coalesce(run_data->'default_start_times','[]'::jsonb)) row_value(value)),'{}'::time[]);
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then raise exception 'Club owner or administrator access required' using errcode='42501'; end if;
  if target_run_id is null then
    insert into public.annual_planner_allocation_runs(club_id,season_phase,mode,status,start_date,end_date,default_start_times,summary,created_by,updated_by)
    values(target_club_id,
      case lower(trim(coalesce(run_data->>'season_phase','regular'))) when 'preseason' then 'preseason' when 'winter' then 'winter' else 'regular' end,
      case lower(trim(coalesce(run_data->>'mode','assisted'))) when 'manual' then 'manual' when 'automatic' then 'automatic' else 'assisted' end,
      'draft',coalesce(nullif(run_data->>'start_date','')::date,current_date),coalesce(nullif(run_data->>'end_date','')::date,current_date),start_times_value,coalesce(run_data->'summary','{}'::jsonb),actor_id,actor_id)
    returning * into run_row;
  else
    update public.annual_planner_allocation_runs run set
      season_phase=case lower(trim(coalesce(run_data->>'season_phase',run.season_phase))) when 'preseason' then 'preseason' when 'winter' then 'winter' else 'regular' end,
      mode=case lower(trim(coalesce(run_data->>'mode',run.mode))) when 'manual' then 'manual' when 'automatic' then 'automatic' else 'assisted' end,
      start_date=coalesce(nullif(run_data->>'start_date','')::date,run.start_date),end_date=coalesce(nullif(run_data->>'end_date','')::date,run.end_date),
      default_start_times=start_times_value,summary=coalesce(run_data->'summary',run.summary),updated_by=actor_id,updated_at=now()
    where run.id=target_run_id and run.club_id=target_club_id and run.status='draft' returning * into run_row;
    if run_row.id is null then raise exception 'Draft allocation run not found' using errcode='P0002'; end if;
    delete from public.annual_planner_allocation_items where run_id=run_row.id;
  end if;
  for item in select value from jsonb_array_elements(coalesce(item_rows,'[]'::jsonb)) row_value(value) loop
    insert into public.annual_planner_allocation_items(
      run_id,club_id,team_key,team_name,status,locked,confidence,score,day_of_week,start_time,end_time,pitch_id,pitch_name,pitch_area_id,pitch_area_name,
      site_inventory_id,site_slot_id,reasons,warnings,alternatives
    ) values (
      run_row.id,target_club_id,lower(trim(item->>'team_key')),trim(coalesce(item->>'team_name',item->>'team_key')),
      case lower(trim(coalesce(item->>'status','suggested'))) when 'recommendation' then 'recommendation' when 'proposed' then 'proposed' when 'unassigned' then 'unassigned' else 'suggested' end,
      coalesce((item->>'locked')::boolean,false),case lower(trim(coalesce(item->>'confidence','low'))) when 'none' then 'none' when 'high' then 'high' when 'medium' then 'medium' else 'low' end,
      coalesce((item->>'score')::numeric,0),nullif(item->>'day_of_week','')::integer,nullif(item->>'start_time','')::time,nullif(item->>'end_time','')::time,
      nullif(item->>'pitch_id',''),nullif(item->>'pitch_name',''),nullif(item->>'pitch_area_id',''),nullif(item->>'pitch_area_name',''),
      nullif(item->>'site_inventory_id','')::uuid,nullif(item->>'site_slot_id','')::uuid,coalesce(item->'reasons','[]'::jsonb),coalesce(item->'warnings','[]'::jsonb),coalesce(item->'alternatives','[]'::jsonb)
    ) returning * into item_result;
    items_result:=items_result||jsonb_build_array(to_jsonb(item_result));
  end loop;
  perform public.record_audit_event(target_club_id,'annual_planner.smart_run.saved','annual_planner_allocation_run',run_row.id::text,jsonb_build_object('season_phase',run_row.season_phase,'mode',run_row.mode,'items',jsonb_array_length(items_result)));
  return jsonb_build_object('run',to_jsonb(run_row),'items',items_result);
end;
$$;

create or replace function public.publish_annual_planner_allocation_run(target_club_id uuid,target_run_id uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare
  actor_id uuid:=auth.uid();
  run_row public.annual_planner_allocation_runs%rowtype;
  item public.annual_planner_allocation_items%rowtype;
  date_value date;
  start_value timestamptz;
  end_value timestamptz;
  series_key text;
  created_count integer:=0;
  conflict_rows jsonb:='[]'::jsonb;
  area_value text;
  booking_pitch_id text;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then raise exception 'Club owner or administrator access required' using errcode='42501'; end if;
  select * into run_row from public.annual_planner_allocation_runs run where run.id=target_run_id and run.club_id=target_club_id and run.status='draft' for update;
  if run_row.id is null then raise exception 'Draft allocation run not found' using errcode='P0002'; end if;
  if run_row.mode='manual' then raise exception 'Manual recommendation runs cannot be published' using errcode='22023'; end if;
  if not exists(select 1 from public.annual_planner_allocation_items allocation where allocation.run_id=run_row.id) then raise exception 'The smart allocation draft contains no teams' using errcode='22023'; end if;
  if exists(select 1 from public.annual_planner_allocation_items allocation where allocation.run_id=run_row.id and allocation.status in ('unassigned','recommendation')) then raise exception 'Resolve every unassigned or manual-only team before publishing' using errcode='23P01'; end if;
  if exists(select 1 from public.annual_planner_allocation_items allocation where allocation.run_id=run_row.id and allocation.status in ('suggested','proposed') and (allocation.day_of_week is null or allocation.start_time is null or allocation.end_time is null or (allocation.pitch_id is null and allocation.site_slot_id is null))) then raise exception 'Every publishable allocation requires a valid day, time and resource' using errcode='22023'; end if;

  for item in select * from public.annual_planner_allocation_items allocation where allocation.run_id=run_row.id and allocation.status in ('suggested','proposed') order by allocation.day_of_week,allocation.start_time,allocation.team_name loop
    series_key:='smart-allocation-'||run_row.id::text||'-'||item.id::text;
    booking_pitch_id:=case when item.site_slot_id is not null then 'winter-slot:'||item.site_slot_id::text else item.pitch_id end;
    area_value:=case when item.site_slot_id is not null then coalesce(item.pitch_area_id,item.pitch_area_name) else item.pitch_area_id end;
    for date_value in select value::date from generate_series(run_row.start_date,run_row.end_date,interval '1 day') row_value(value) where extract(dow from value)::integer=item.day_of_week loop
      start_value:=make_timestamptz(extract(year from date_value)::integer,extract(month from date_value)::integer,extract(day from date_value)::integer,extract(hour from item.start_time)::integer,extract(minute from item.start_time)::integer,0,'Europe/London');
      end_value:=make_timestamptz(extract(year from date_value)::integer,extract(month from date_value)::integer,extract(day from date_value)::integer,extract(hour from item.end_time)::integer,extract(minute from item.end_time)::integer,0,'Europe/London');
      if not private.pitch_area_slot_available(target_club_id,booking_pitch_id,area_value,start_value,end_value,'training',null) then
        conflict_rows:=conflict_rows||jsonb_build_array(jsonb_build_object('team_key',item.team_key,'team_name',item.team_name,'date',date_value,'resource',coalesce(item.pitch_name,item.pitch_area_name),'start_time',item.start_time));
      else
        insert into public.annual_planner_bookings(
          club_id,series_id,title,booking_type,status,team_key,team_name,venue_id,venue_name,pitch_id,pitch_name,pitch_area_id,pitch_area_name,
          season_phase,site_inventory_id,site_slot_id,start_at,end_at,recurrence,recurrence_until,cost_pence,notes,source_type,source_id,approved_by,approved_at,created_by,updated_by
        ) values (
          target_club_id,series_key,item.team_name||' training','training','confirmed',item.team_key,item.team_name,
          case when item.site_inventory_id is not null then item.site_inventory_id::text else null end,case when item.site_inventory_id is not null then item.pitch_name else null end,
          booking_pitch_id,item.pitch_name,area_value,item.pitch_area_name,run_row.season_phase,item.site_inventory_id,item.site_slot_id,start_value,end_value,'weekly',run_row.end_date,
          coalesce((select slot.cost_pence from public.annual_planner_site_slots slot where slot.id=item.site_slot_id),0),
          'Published from smart training allocation '||run_row.id::text,'smart_allocation',item.id::text,actor_id,now(),actor_id,actor_id
        );
        created_count:=created_count+1;
      end if;
    end loop;
    update public.annual_planner_allocation_items allocation set status='published',published_series_id=series_key,updated_at=now() where allocation.id=item.id;
  end loop;
  if jsonb_array_length(conflict_rows)>0 then raise exception 'Smart allocation publication found % conflicting sessions',jsonb_array_length(conflict_rows) using errcode='23P01',detail=conflict_rows::text; end if;
  update public.annual_planner_allocation_runs run set status='published',published_by=actor_id,published_at=now(),updated_by=actor_id,updated_at=now(),summary=run.summary||jsonb_build_object('published_bookings',created_count) where run.id=run_row.id;
  perform public.record_audit_event(target_club_id,'annual_planner.smart_run.published','annual_planner_allocation_run',run_row.id::text,jsonb_build_object('created_bookings',created_count));
  return jsonb_build_object('run_id',run_row.id,'created_bookings',created_count,'status','published');
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
    'winter_slots',coalesce((select jsonb_agg(case when can_view_costs then to_jsonb(slot) else to_jsonb(slot)-'cost_pence' end order by slot.day_of_week,slot.start_time,slot.label) from public.annual_planner_site_slots slot where slot.club_id=target_club_id),'[]'::jsonb),
    'allocation_preferences',coalesce((select jsonb_agg(to_jsonb(preference) order by preference.season_phase,preference.team_name) from public.annual_planner_team_preferences preference where preference.club_id=target_club_id),'[]'::jsonb),
    'allocation_runs',coalesce((select jsonb_agg(to_jsonb(run) order by run.created_at desc) from public.annual_planner_allocation_runs run where run.club_id=target_club_id),'[]'::jsonb),
    'allocation_items',coalesce((select jsonb_agg(to_jsonb(item) order by item.created_at,item.team_name) from public.annual_planner_allocation_items item where item.club_id=target_club_id and item.run_id in (select run.id from public.annual_planner_allocation_runs run where run.club_id=target_club_id order by run.created_at desc limit 12)),'[]'::jsonb)
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
    'requests',coalesce((select jsonb_agg(to_jsonb(request_row)-'admin_notes' order by request_row.created_at) from public.coach_hub_requests request_row where request_row.club_id=target_club_id and request_row.created_at<end_boundary and request_row.created_at>=start_boundary),'[]'::jsonb),
    'allocation_runs',coalesce((select jsonb_agg(to_jsonb(run) order by run.created_at) from public.annual_planner_allocation_runs run where run.club_id=target_club_id and run.created_at<end_boundary and run.created_at>=start_boundary),'[]'::jsonb),
    'allocation_items',coalesce((select jsonb_agg(to_jsonb(item) order by item.created_at,item.team_name) from public.annual_planner_allocation_items item join public.annual_planner_allocation_runs run on run.id=item.run_id where item.club_id=target_club_id and run.created_at<end_boundary and run.created_at>=start_boundary),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.save_annual_planner_team_preference(uuid,jsonb), public.save_annual_planner_allocation_run(uuid,jsonb,jsonb), public.publish_annual_planner_allocation_run(uuid,uuid), public.list_annual_planner_workspace(uuid,date,date), public.get_annual_planner_analytics_data(uuid,date,date) from public,anon;
grant execute on function public.save_annual_planner_team_preference(uuid,jsonb), public.save_annual_planner_allocation_run(uuid,jsonb,jsonb), public.publish_annual_planner_allocation_run(uuid,uuid), public.list_annual_planner_workspace(uuid,date,date), public.get_annual_planner_analytics_data(uuid,date,date) to authenticated;

comment on function public.publish_annual_planner_allocation_run(uuid,uuid) is 'v3.10.7 publishes an operator-reviewed smart allocation draft only after final database capacity validation.';
comment on table public.annual_planner_team_preferences is 'Per-team and per-season smart scheduling preferences supporting inherited run mode plus Manual, Assisted and Automatic Draft overrides.';

notify pgrst,'reload schema';
commit;
