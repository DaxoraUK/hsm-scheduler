-- Daxora Ground Control v3.10: annual pitch booking, training and friendlies planner.
begin;

-- Commercial packaging: Core can receive the module as a controlled add-on,
-- while Pro and Elite include it in the package catalogue.
update public.subscription_plans
set entitlements = case
      when 'annual_planner' = any(entitlements) then entitlements
      else array_append(entitlements, 'annual_planner')
    end,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'packaging_version', '2026-07-15.3',
      'annual_planner', 'included'
    ),
    updated_at = now()
where code in ('pro', 'elite');

update public.subscription_plans
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'packaging_version', '2026-07-15.3',
      'available_addons', coalesce(metadata->'available_addons', '[]'::jsonb) || '"annual_planner"'::jsonb
    ),
    updated_at = now()
where code = 'core';

create table if not exists public.annual_planner_settings (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  calendar_year_start_month integer not null default 1 check (calendar_year_start_month between 1 and 12),
  default_training_duration_minutes integer not null default 90 check (default_training_duration_minutes between 15 and 720),
  default_friendly_duration_minutes integer not null default 150 check (default_friendly_duration_minutes between 15 and 720),
  default_status text not null default 'provisional' check (default_status in ('requested','provisional','confirmed')),
  booking_reference_prefix text not null default 'GC' check (length(trim(booking_reference_prefix)) between 1 and 20),
  require_approval boolean not null default false,
  show_costs_to_schedulers boolean not null default true,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.annual_planner_bookings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  series_id text,
  title text not null check (length(trim(title)) between 2 and 240),
  booking_type text not null default 'training'
    check (booking_type in ('training','friendly','camp','tournament','meeting','maintenance','external_hire','match')),
  status text not null default 'provisional'
    check (status in ('requested','provisional','confirmed','cancelled','rejected')),
  team_key text,
  team_name text,
  opponent_name text,
  venue_id text,
  venue_name text,
  pitch_id text,
  pitch_name text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  recurrence text not null default 'none' check (recurrence in ('none','weekly','fortnightly')),
  recurrence_until date,
  cost_pence integer not null default 0 check (cost_pence between 0 and 100000000),
  supplier_reference text,
  booking_reference text,
  contact_name text,
  contact_email text,
  notes text check (notes is null or length(notes) <= 10000),
  source_type text not null default 'annual_planner',
  source_id text,
  requested_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  check (contact_email is null or contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

create table if not exists public.annual_planner_blackouts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 240),
  venue_id text,
  pitch_id text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text check (reason is null or length(reason) <= 5000),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index if not exists annual_planner_bookings_calendar_idx
  on public.annual_planner_bookings(club_id,start_at,status,pitch_id);
create index if not exists annual_planner_bookings_series_idx
  on public.annual_planner_bookings(club_id,series_id,start_at)
  where series_id is not null;
create index if not exists annual_planner_bookings_team_idx
  on public.annual_planner_bookings(club_id,team_key,start_at)
  where team_key is not null;
create index if not exists annual_planner_blackouts_calendar_idx
  on public.annual_planner_blackouts(club_id,start_at,pitch_id);

alter table public.annual_planner_settings enable row level security;
alter table public.annual_planner_settings force row level security;
alter table public.annual_planner_bookings enable row level security;
alter table public.annual_planner_bookings force row level security;
alter table public.annual_planner_blackouts enable row level security;
alter table public.annual_planner_blackouts force row level security;

revoke all on table public.annual_planner_settings, public.annual_planner_bookings,
  public.annual_planner_blackouts from anon, authenticated;

drop policy if exists annual_planner_settings_read on public.annual_planner_settings;
create policy annual_planner_settings_read on public.annual_planner_settings
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists annual_planner_settings_write on public.annual_planner_settings;
create policy annual_planner_settings_write on public.annual_planner_settings
  for all to authenticated using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

drop policy if exists annual_planner_bookings_read on public.annual_planner_bookings;
create policy annual_planner_bookings_read on public.annual_planner_bookings
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists annual_planner_bookings_write on public.annual_planner_bookings;
create policy annual_planner_bookings_write on public.annual_planner_bookings
  for all to authenticated using (public.can_operate_club(club_id)) with check (public.can_operate_club(club_id));

drop policy if exists annual_planner_blackouts_read on public.annual_planner_blackouts;
create policy annual_planner_blackouts_read on public.annual_planner_blackouts
  for select to authenticated using (public.is_club_member(club_id));
drop policy if exists annual_planner_blackouts_write on public.annual_planner_blackouts;
create policy annual_planner_blackouts_write on public.annual_planner_blackouts
  for all to authenticated using (public.can_operate_club(club_id)) with check (public.can_operate_club(club_id));

create or replace function public.touch_annual_planner_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

revoke all on function public.touch_annual_planner_updated_at() from public, anon;
grant execute on function public.touch_annual_planner_updated_at() to authenticated;

drop trigger if exists annual_planner_settings_touch_updated_at on public.annual_planner_settings;
create trigger annual_planner_settings_touch_updated_at
before update on public.annual_planner_settings
for each row execute function public.touch_annual_planner_updated_at();

drop trigger if exists annual_planner_bookings_touch_updated_at on public.annual_planner_bookings;
create trigger annual_planner_bookings_touch_updated_at
before update on public.annual_planner_bookings
for each row execute function public.touch_annual_planner_updated_at();

drop trigger if exists annual_planner_blackouts_touch_updated_at on public.annual_planner_blackouts;
create trigger annual_planner_blackouts_touch_updated_at
before update on public.annual_planner_blackouts
for each row execute function public.touch_annual_planner_updated_at();

create or replace function public.list_annual_planner_workspace(
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
  start_boundary timestamptz := coalesce(range_start, make_date(extract(year from current_date)::integer, 1, 1))::timestamptz;
  end_boundary timestamptz := (coalesce(range_end, make_date(extract(year from current_date)::integer, 12, 31)) + 1)::timestamptz;
  can_view_costs boolean := false;
begin
  if auth.uid() is null or not public.is_club_member(target_club_id) then
    raise exception 'Annual planner access denied' using errcode = '42501';
  end if;
  if not private.club_has_entitlement(target_club_id, 'annual_planner') then
    raise exception 'Annual planner is not included in this workspace package' using errcode = '42501';
  end if;

  select public.can_manage_club(target_club_id)
    or coalesce((select settings.show_costs_to_schedulers from public.annual_planner_settings settings where settings.club_id = target_club_id), true)
  into can_view_costs;

  return jsonb_build_object(
    'settings', coalesce((select to_jsonb(settings) from public.annual_planner_settings settings where settings.club_id = target_club_id), '{}'::jsonb),
    'bookings', coalesce((select jsonb_agg(
        case when can_view_costs then to_jsonb(booking)
          else to_jsonb(booking) - 'cost_pence' - 'supplier_reference'
        end order by booking.start_at, booking.title)
      from public.annual_planner_bookings booking
      where booking.club_id = target_club_id
        and booking.start_at < end_boundary
        and booking.end_at >= start_boundary), '[]'::jsonb),
    'blackouts', coalesce((select jsonb_agg(to_jsonb(blackout) order by blackout.start_at, blackout.title)
      from public.annual_planner_blackouts blackout
      where blackout.club_id = target_club_id
        and blackout.start_at < end_boundary
        and blackout.end_at >= start_boundary), '[]'::jsonb)
  );
end;
$$;

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
      venue_id,venue_name,pitch_id,pitch_name,start_at,end_at,recurrence,recurrence_until,
      cost_pence,supplier_reference,booking_reference,contact_name,contact_email,notes,
      source_type,source_id,requested_by,approved_by,approved_at,created_by,updated_by
    ) values (
      target_club_id,nullif(booking_data->>'series_id',''),trim(booking_data->>'title'),
      coalesce(nullif(lower(trim(booking_data->>'booking_type')),''),'training'),next_status,
      nullif(booking_data->>'team_key',''),nullif(booking_data->>'team_name',''),nullif(booking_data->>'opponent_name',''),
      nullif(booking_data->>'venue_id',''),nullif(booking_data->>'venue_name',''),next_pitch_id,nullif(booking_data->>'pitch_name',''),
      next_start,next_end,
      coalesce(nullif(lower(trim(booking_data->>'recurrence')),''),'none'),nullif(booking_data->>'recurrence_until','')::date,
      case when can_edit_costs then greatest(0,coalesce((booking_data->>'cost_pence')::integer,0)) else 0 end,
      case when can_edit_costs then nullif(booking_data->>'supplier_reference','') else null end,
      nullif(booking_data->>'booking_reference',''),nullif(booking_data->>'contact_name',''),nullif(booking_data->>'contact_email',''),
      nullif(booking_data->>'notes',''),coalesce(nullif(booking_data->>'source_type',''),'annual_planner'),nullif(booking_data->>'source_id',''),
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
      cost_pence = case when can_edit_costs then greatest(0,coalesce((booking_data->>'cost_pence')::integer,0)) else booking.cost_pence end,
      supplier_reference = case when can_edit_costs then nullif(booking_data->>'supplier_reference','') else booking.supplier_reference end, booking_reference = nullif(booking_data->>'booking_reference',''),
      contact_name = nullif(booking_data->>'contact_name',''), contact_email = nullif(booking_data->>'contact_email',''),
      notes = nullif(booking_data->>'notes',''),
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

create or replace function public.save_annual_planner_booking_series(
  target_club_id uuid,
  booking_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  item jsonb;
  saved jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(coalesce(booking_rows,'[]'::jsonb)) <> 'array'
     or jsonb_array_length(booking_rows) = 0
     or jsonb_array_length(booking_rows) > 160 then
    raise exception 'Booking series must contain between 1 and 160 occurrences' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(booking_rows)
  loop
    saved := saved || jsonb_build_array(public.save_annual_planner_booking(target_club_id,item));
  end loop;
  return saved;
end;
$$;

create or replace function public.delete_annual_planner_booking(
  target_club_id uuid,
  target_booking_id uuid,
  delete_series boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  target_series text;
  deleted_count integer := 0;
begin
  if actor_id is null or not public.can_operate_club(target_club_id) then
    raise exception 'Annual planner operation denied' using errcode = '42501';
  end if;
  if not private.club_has_entitlement(target_club_id, 'annual_planner') then
    raise exception 'Annual planner is not included in this workspace package' using errcode = '42501';
  end if;
  select series_id into target_series from public.annual_planner_bookings where club_id=target_club_id and id=target_booking_id;
  if delete_series and nullif(target_series,'') is not null then
    delete from public.annual_planner_bookings where club_id=target_club_id and series_id=target_series;
  else
    delete from public.annual_planner_bookings where club_id=target_club_id and id=target_booking_id;
  end if;
  get diagnostics deleted_count = row_count;
  perform public.record_audit_event(target_club_id,'annual_planner.booking.deleted','annual_planner_booking',target_booking_id::text,
    jsonb_build_object('delete_series',delete_series,'deleted_count',deleted_count));
  return deleted_count;
end;
$$;

create or replace function public.save_annual_planner_blackout(
  target_club_id uuid,
  blackout_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  target_id uuid := nullif(blackout_data->>'blackout_id','')::uuid;
  result public.annual_planner_blackouts%rowtype;
begin
  if actor_id is null or not public.can_operate_club(target_club_id) then
    raise exception 'Annual planner operation denied' using errcode = '42501';
  end if;
  if not private.club_has_entitlement(target_club_id, 'annual_planner') then
    raise exception 'Annual planner is not included in this workspace package' using errcode = '42501';
  end if;
  if target_id is null then
    insert into public.annual_planner_blackouts(club_id,title,venue_id,pitch_id,start_at,end_at,reason,created_by,updated_by)
    values(target_club_id,trim(blackout_data->>'title'),nullif(blackout_data->>'venue_id',''),nullif(blackout_data->>'pitch_id',''),
      (blackout_data->>'start_at')::timestamptz,(blackout_data->>'end_at')::timestamptz,nullif(blackout_data->>'reason',''),actor_id,actor_id)
    returning * into result;
  else
    update public.annual_planner_blackouts set title=trim(blackout_data->>'title'),venue_id=nullif(blackout_data->>'venue_id',''),
      pitch_id=nullif(blackout_data->>'pitch_id',''),start_at=(blackout_data->>'start_at')::timestamptz,
      end_at=(blackout_data->>'end_at')::timestamptz,reason=nullif(blackout_data->>'reason',''),updated_by=actor_id,updated_at=now()
    where club_id=target_club_id and id=target_id returning * into result;
    if result.id is null then raise exception 'Blackout not found' using errcode = 'P0002'; end if;
  end if;
  perform public.record_audit_event(target_club_id,
    case when target_id is null then 'annual_planner.blackout.created' else 'annual_planner.blackout.updated' end,
    'annual_planner_blackout',result.id::text,
    jsonb_build_object('title',result.title,'start_at',result.start_at,'pitch_id',result.pitch_id));
  return to_jsonb(result);
end;
$$;

create or replace function public.delete_annual_planner_blackout(target_club_id uuid,target_blackout_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if auth.uid() is null or not public.can_operate_club(target_club_id) then
    raise exception 'Annual planner operation denied' using errcode = '42501';
  end if;
  if not private.club_has_entitlement(target_club_id, 'annual_planner') then
    raise exception 'Annual planner is not included in this workspace package' using errcode = '42501';
  end if;
  delete from public.annual_planner_blackouts where club_id=target_club_id and id=target_blackout_id;
  if found then
    perform public.record_audit_event(target_club_id,'annual_planner.blackout.deleted','annual_planner_blackout',target_blackout_id::text,'{}'::jsonb);
  end if;
  return found;
end;
$$;

create or replace function public.save_annual_planner_settings(target_club_id uuid,settings_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  result public.annual_planner_settings%rowtype;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then
    raise exception 'Annual planner settings require owner or administrator access' using errcode = '42501';
  end if;
  if not private.club_has_entitlement(target_club_id, 'annual_planner') then
    raise exception 'Annual planner is not included in this workspace package' using errcode = '42501';
  end if;
  insert into public.annual_planner_settings(club_id,calendar_year_start_month,default_training_duration_minutes,
    default_friendly_duration_minutes,default_status,booking_reference_prefix,require_approval,show_costs_to_schedulers,updated_by)
  values(target_club_id,greatest(1,least(12,coalesce((settings_data->>'calendar_year_start_month')::integer,1))),
    greatest(15,least(720,coalesce((settings_data->>'default_training_duration_minutes')::integer,90))),
    greatest(15,least(720,coalesce((settings_data->>'default_friendly_duration_minutes')::integer,150))),
    coalesce(nullif(lower(trim(settings_data->>'default_status')),''),'provisional'),
    coalesce(nullif(trim(settings_data->>'booking_reference_prefix'),''),'GC'),
    coalesce((settings_data->>'require_approval')::boolean,false),coalesce((settings_data->>'show_costs_to_schedulers')::boolean,true),actor_id)
  on conflict(club_id) do update set
    calendar_year_start_month=excluded.calendar_year_start_month,
    default_training_duration_minutes=excluded.default_training_duration_minutes,
    default_friendly_duration_minutes=excluded.default_friendly_duration_minutes,
    default_status=excluded.default_status,booking_reference_prefix=excluded.booking_reference_prefix,
    require_approval=excluded.require_approval,show_costs_to_schedulers=excluded.show_costs_to_schedulers,
    updated_by=actor_id,updated_at=now()
  returning * into result;
  perform public.record_audit_event(target_club_id,'annual_planner.settings.updated','annual_planner_settings',target_club_id::text,
    jsonb_build_object('require_approval',result.require_approval,'show_costs_to_schedulers',result.show_costs_to_schedulers));
  return to_jsonb(result);
end;
$$;

-- Extend the package override vocabulary so Core can receive the planner as a
-- paid add-on without weakening the fail-closed entitlement model.
create or replace function private.sanitise_subscription_package_overrides()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  known_entitlements constant text[] := array[
    'dashboard','club_profile','fixture_import','league_link','communications','resource_registry',
    'matchday_scheduling','midweek_scheduling','operations_advanced','pitch_intelligence',
    'parking_intelligence','weather_intelligence','officials_management','reports_operations',
    'reports_advanced','analytics_core','analytics_advanced','data_export','multi_venue',
    'priority_support','premium_support','advanced_integrations','organisation_command',
    'executive_reporting','governance_controls','approval_workflows','site_responsibility',
    'communication_governance','funding_portfolio','enhanced_audit','annual_planner'
  ];
  known_limits constant text[] := array['teams','venues','users','pitches','history_entries','history_retention_days'];
  effective_entitlements text[] := '{}'::text[];
  safe_entitlement_overrides jsonb := '{}'::jsonb;
  safe_limit_overrides jsonb := '{}'::jsonb;
begin
  select coalesce(jsonb_object_agg(entry.key, to_jsonb(true)), '{}'::jsonb)
  into safe_entitlement_overrides
  from jsonb_each_text(coalesce(new.entitlement_overrides, '{}'::jsonb)) entry
  where entry.key = any(known_entitlements) and lower(entry.value) = 'true';

  select coalesce(jsonb_object_agg(entry.key, to_jsonb(greatest(0, (entry.value)::numeric))), '{}'::jsonb)
  into safe_limit_overrides
  from jsonb_each_text(coalesce(new.limit_overrides, '{}'::jsonb)) entry
  where entry.key = any(known_limits) and entry.value ~ '^-?[0-9]+(\.[0-9]+)?$';

  new.entitlement_overrides := safe_entitlement_overrides;
  new.limit_overrides := safe_limit_overrides;

  select coalesce(plan.entitlements, '{}'::text[]) || coalesce(array(
    select key from jsonb_each_text(safe_entitlement_overrides) where lower(value) = 'true'
  ), '{}'::text[])
  into effective_entitlements
  from public.subscription_plans plan where plan.code = new.plan_code;

  if 'approval_workflows' = any(effective_entitlements)
     and not ('organisation_command' = any(effective_entitlements) and 'governance_controls' = any(effective_entitlements)) then
    raise exception 'Approval workflows require Organisation Command and governance controls' using errcode = '22023';
  end if;
  if 'site_responsibility' = any(effective_entitlements) and not 'organisation_command' = any(effective_entitlements) then
    raise exception 'Site responsibility requires Organisation Command' using errcode = '22023';
  end if;
  if 'reports_advanced' = any(effective_entitlements) and not 'reports_operations' = any(effective_entitlements) then
    raise exception 'Advanced reports require operational reports' using errcode = '22023';
  end if;
  if 'analytics_advanced' = any(effective_entitlements) and not 'analytics_core' = any(effective_entitlements) then
    raise exception 'Advanced analytics require core analytics' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.list_annual_planner_workspace(uuid,date,date),
  public.save_annual_planner_booking(uuid,jsonb), public.save_annual_planner_booking_series(uuid,jsonb),
  public.delete_annual_planner_booking(uuid,uuid,boolean), public.save_annual_planner_blackout(uuid,jsonb),
  public.delete_annual_planner_blackout(uuid,uuid), public.save_annual_planner_settings(uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.list_annual_planner_workspace(uuid,date,date),
  public.save_annual_planner_booking(uuid,jsonb), public.save_annual_planner_booking_series(uuid,jsonb),
  public.delete_annual_planner_booking(uuid,uuid,boolean), public.save_annual_planner_blackout(uuid,jsonb),
  public.delete_annual_planner_blackout(uuid,uuid), public.save_annual_planner_settings(uuid,jsonb)
  to authenticated;

commit;
notify pgrst, 'reload schema';
