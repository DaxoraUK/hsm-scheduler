-- Daxora League Manager: Fixture Command, match officials and postponement control.
-- Adds secure officials pools, competition requirements, atomic appointment boards,
-- acceptance links, venue mapping and a controlled rearrangement queue.

begin;

create extension if not exists pgcrypto;
create schema if not exists private;

alter table public.league_venues
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6);

alter table public.league_venues drop constraint if exists league_venues_latitude_check;
alter table public.league_venues add constraint league_venues_latitude_check check (latitude is null or latitude between -90 and 90);
alter table public.league_venues drop constraint if exists league_venues_longitude_check;
alter table public.league_venues add constraint league_venues_longitude_check check (longitude is null or longitude between -180 and 180);

alter table public.league_memberships drop constraint if exists league_memberships_role_check;
alter table public.league_memberships add constraint league_memberships_role_check
  check (role in ('owner', 'admin', 'fixtures', 'officials', 'viewer'));

alter table public.league_invitations drop constraint if exists league_invitations_role_check;
alter table public.league_invitations add constraint league_invitations_role_check
  check (role in ('admin', 'fixtures', 'officials', 'viewer'));

create table if not exists public.league_officials (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 160),
  email text,
  phone text,
  grade text,
  home_postcode text,
  travel_radius_miles integer not null default 35 check (travel_radius_miles between 0 and 250),
  max_appointments_per_day integer not null default 1 check (max_appointments_per_day between 1 and 5),
  max_appointments_per_week integer not null default 2 check (max_appointments_per_week between 1 and 14),
  can_referee boolean not null default true,
  can_assistant boolean not null default true,
  can_fourth boolean not null default false,
  can_observe boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, name)
);

create table if not exists public.league_official_availability (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  official_id uuid not null references public.league_officials(id) on delete cascade,
  available_on date not null,
  starts_at time,
  ends_at time,
  availability_status text not null default 'available' check (availability_status in ('available', 'preferred', 'unavailable')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at),
  unique (official_id, available_on, availability_status, starts_at, ends_at)
);

create table if not exists public.league_official_conflicts (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  official_id uuid not null references public.league_officials(id) on delete cascade,
  conflict_type text not null check (conflict_type in ('club', 'team')),
  parent_club_id uuid references public.league_parent_clubs(id) on delete cascade,
  team_id uuid references public.league_teams(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((conflict_type = 'club' and parent_club_id is not null and team_id is null)
      or (conflict_type = 'team' and team_id is not null and parent_club_id is null))
);

create unique index if not exists league_official_conflicts_unique_idx
  on public.league_official_conflicts (
    official_id,
    conflict_type,
    coalesce(parent_club_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(team_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create table if not exists public.league_official_requirements (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  scope_type text not null check (scope_type in ('league', 'division', 'cup', 'cup_round')),
  scope_id uuid not null,
  referee_count integer not null default 1 check (referee_count between 0 and 1),
  assistant_count integer not null default 0 check (assistant_count between 0 and 2),
  fourth_official_count integer not null default 0 check (fourth_official_count between 0 and 1),
  observer_count integer not null default 0 check (observer_count between 0 and 1),
  minimum_grade text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, scope_type, scope_id)
);

create table if not exists public.league_official_assignments (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  target_type text not null check (target_type in ('schedule_entry', 'fixture', 'cup_tie')),
  target_id uuid not null,
  target_date date not null,
  kick_off time not null,
  venue_id uuid references public.league_venues(id) on delete set null,
  official_id uuid not null references public.league_officials(id) on delete restrict,
  role text not null check (role in ('referee', 'assistant_1', 'assistant_2', 'fourth_official', 'observer')),
  status text not null default 'proposed' check (status in ('proposed', 'sent', 'accepted', 'declined', 'withdrawn', 'confirmed', 'replacement_required')),
  response_token_hash text,
  response_expires_at timestamptz,
  responded_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, target_type, target_id, role)
);

create unique index if not exists league_official_assignment_response_token_idx
  on public.league_official_assignments(response_token_hash)
  where response_token_hash is not null;
create index if not exists league_official_assignments_date_idx
  on public.league_official_assignments(league_id, target_date, kick_off, official_id);

create table if not exists public.league_postponement_requests (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  target_type text not null check (target_type in ('schedule_entry', 'fixture', 'cup_tie')),
  target_id uuid not null,
  requested_by_club_id uuid references public.league_parent_clubs(id) on delete set null,
  reason_category text not null default 'other' check (reason_category in ('weather', 'venue_unavailable', 'cup_clash', 'club_request', 'officials', 'other')),
  reason text not null check (length(trim(reason)) between 2 and 500),
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'rearrangement_required', 'proposed', 'rearranged', 'closed')),
  original_date date,
  original_kick_off time,
  original_venue_id uuid references public.league_venues(id) on delete set null,
  proposed_dates jsonb not null default '[]'::jsonb,
  deadline_on date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists league_postponements_queue_idx
  on public.league_postponement_requests(league_id, status, deadline_on, created_at);

-- Raw response tokens are held in a private table and never exposed to ordinary viewers.
create table if not exists private.league_official_response_tokens (
  assignment_id uuid primary key references public.league_official_assignments(id) on delete cascade,
  raw_token text not null,
  created_at timestamptz not null default now()
);
revoke all on table private.league_official_response_tokens from public, anon, authenticated;

create or replace function public.can_manage_league_officials(target_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select auth.uid() is not null and (
    private.is_platform_admin(auth.uid())
    or exists (
      select 1
      from public.league_memberships membership
      join public.leagues league on league.id = membership.league_id
      where membership.league_id = target_league_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
        and membership.role = any(array['owner', 'admin', 'officials'])
        and league.status = 'active'
    )
  );
$$;

create or replace function public.create_league_invitation(
  target_league_id uuid,
  invite_email text,
  invite_role text default 'viewer',
  expiry_hours integer default 168
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_email text := lower(trim(coalesce(invite_email, '')));
  safe_role text := lower(trim(coalesce(invite_role, 'viewer')));
  raw_token text := encode(gen_random_bytes(32), 'hex');
  invitation_id uuid;
  invitation_expiry timestamptz;
begin
  if not public.can_manage_league(target_league_id) then raise exception 'League administrator access required' using errcode = '42501'; end if;
  if position('@' in safe_email) <= 1 then raise exception 'A valid email address is required' using errcode = '22023'; end if;
  if safe_role not in ('admin', 'fixtures', 'officials', 'viewer') then raise exception 'Invalid league role' using errcode = '22023'; end if;

  update public.league_invitations set status = 'revoked', revoked_at = now(), updated_at = now()
  where league_id = target_league_id and lower(email) = safe_email and status = 'pending';

  invitation_expiry := now() + make_interval(hours => greatest(1, least(coalesce(expiry_hours, 168), 720)));
  insert into public.league_invitations (league_id, email, role, token_hash, status, invited_by, expires_at)
  values (target_league_id, safe_email, safe_role, encode(digest(raw_token, 'sha256'), 'hex'), 'pending', actor_id, invitation_expiry)
  returning id into invitation_id;

  perform private.write_league_audit(target_league_id, 'league.invitation_created', 'invitation', invitation_id, jsonb_build_object('email', safe_email, 'role', safe_role));
  return jsonb_build_object('id', invitation_id, 'token', raw_token, 'email', safe_email, 'role', safe_role, 'expires_at', invitation_expiry);
end;
$$;

create or replace function public.update_league_member_role(target_league_id uuid, target_user_id uuid, next_role text)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  safe_role text := lower(trim(coalesce(next_role, '')));
  target_current_role text;
begin
  if not public.can_manage_league(target_league_id) then raise exception 'League administrator access required' using errcode = '42501'; end if;
  if safe_role not in ('admin', 'fixtures', 'officials', 'viewer') then raise exception 'Invalid league role' using errcode = '22023'; end if;
  select membership.role into target_current_role from public.league_memberships membership
  where membership.league_id = target_league_id and membership.user_id = target_user_id and membership.status = 'active';
  if target_current_role is null then raise exception 'League member not found' using errcode = 'P0002'; end if;
  if target_current_role = 'owner' then raise exception 'The league owner role cannot be changed here' using errcode = '42501'; end if;
  update public.league_memberships set role = safe_role, updated_at = now()
  where league_id = target_league_id and user_id = target_user_id;
  perform private.write_league_audit(target_league_id, 'league.member_role_changed', 'member', target_user_id, jsonb_build_object('role', safe_role));
end;
$$;

create or replace function private.assert_league_operations_target(
  target_league_id uuid,
  target_type text,
  target_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  result jsonb;
begin
  if target_type = 'schedule_entry' then
    select jsonb_build_object(
      'target_date', entry.scheduled_date,
      'kick_off', entry.kick_off,
      'venue_id', entry.venue_id,
      'division_id', entry.division_id,
      'home_team_id', entry.home_team_id,
      'away_team_id', entry.away_team_id
    ) into result
    from public.league_schedule_entries entry
    where entry.id = target_id and entry.league_id = target_league_id;
  elsif target_type = 'fixture' then
    select jsonb_build_object(
      'target_date', fixture.scheduled_date,
      'kick_off', fixture.kick_off,
      'venue_id', fixture.venue_id,
      'division_id', fixture.division_id,
      'home_team_id', fixture.home_team_id,
      'away_team_id', fixture.away_team_id
    ) into result
    from public.league_fixtures fixture
    where fixture.id = target_id and fixture.league_id = target_league_id;
  elsif target_type = 'cup_tie' then
    select jsonb_build_object(
      'target_date', tie.scheduled_date,
      'kick_off', tie.kick_off,
      'venue_id', tie.venue_id,
      'cup_id', tie.cup_id,
      'cup_round_id', tie.cup_round_id,
      'home_team_id', tie.home_team_id,
      'away_team_id', tie.away_team_id
    ) into result
    from public.league_cup_ties tie
    where tie.id = target_id and tie.league_id = target_league_id;
  else
    raise exception 'Unsupported league operations target' using errcode = '22023';
  end if;

  if result is null then raise exception 'Fixture target was not found' using errcode = 'P0002'; end if;
  return result;
end;
$$;

create or replace function public.get_league_operations_data(target_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  result jsonb;
begin
  if not public.can_view_league(target_league_id) then raise exception 'League workspace access denied' using errcode = '42501'; end if;

  select jsonb_build_object(
    'access', jsonb_build_object(
      'can_manage', public.can_manage_league(target_league_id),
      'can_operate', public.can_operate_league(target_league_id),
      'can_manage_officials', public.can_manage_league_officials(target_league_id)
    ),
    'officials', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.status, row_value.name) from public.league_officials row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'availability', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.available_on, row_value.starts_at) from public.league_official_availability row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'conflicts', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.created_at) from public.league_official_conflicts row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'requirements', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.scope_type, row_value.created_at) from public.league_official_requirements row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(
        to_jsonb(row_value) || jsonb_build_object(
          'response_token', case when public.can_manage_league_officials(target_league_id) and row_value.response_token_hash is not null then token_store.raw_token else null end
        )
        order by row_value.target_date, row_value.kick_off, row_value.role
      )
      from public.league_official_assignments row_value
      left join private.league_official_response_tokens token_store on token_store.assignment_id = row_value.id
      where row_value.league_id = target_league_id
    ), '[]'::jsonb),
    'postponements', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.deadline_on nulls last, row_value.created_at) from public.league_postponement_requests row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'venue_positions', coalesce((select jsonb_agg(jsonb_build_object('id', venue.id, 'latitude', venue.latitude, 'longitude', venue.longitude)) from public.league_venues venue where venue.league_id = target_league_id), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create or replace function public.upsert_league_official(target_league_id uuid, official_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  official_record_id uuid := coalesce(nullif(official_data ->> 'id', '')::uuid, gen_random_uuid());
begin
  if not public.can_manage_league_officials(target_league_id) then raise exception 'League officials permission required' using errcode = '42501'; end if;
  if length(trim(coalesce(official_data ->> 'name', ''))) < 2 then raise exception 'Official name is required' using errcode = '22023'; end if;

  insert into public.league_officials (
    id, league_id, name, email, phone, grade, home_postcode, travel_radius_miles,
    max_appointments_per_day, max_appointments_per_week, can_referee, can_assistant,
    can_fourth, can_observe, status, notes
  ) values (
    official_record_id, target_league_id, trim(official_data ->> 'name'),
    nullif(lower(trim(coalesce(official_data ->> 'email', ''))), ''),
    nullif(trim(coalesce(official_data ->> 'phone', '')), ''),
    nullif(trim(coalesce(official_data ->> 'grade', '')), ''),
    nullif(upper(trim(coalesce(official_data ->> 'home_postcode', ''))), ''),
    greatest(0, least(coalesce((official_data ->> 'travel_radius_miles')::integer, 35), 250)),
    greatest(1, least(coalesce((official_data ->> 'max_appointments_per_day')::integer, 1), 5)),
    greatest(1, least(coalesce((official_data ->> 'max_appointments_per_week')::integer, 2), 14)),
    coalesce((official_data ->> 'can_referee')::boolean, true),
    coalesce((official_data ->> 'can_assistant')::boolean, true),
    coalesce((official_data ->> 'can_fourth')::boolean, false),
    coalesce((official_data ->> 'can_observe')::boolean, false),
    coalesce(nullif(official_data ->> 'status', ''), 'active'),
    nullif(trim(coalesce(official_data ->> 'notes', '')), '')
  ) on conflict (id) do update set
    name = excluded.name, email = excluded.email, phone = excluded.phone, grade = excluded.grade,
    home_postcode = excluded.home_postcode, travel_radius_miles = excluded.travel_radius_miles,
    max_appointments_per_day = excluded.max_appointments_per_day,
    max_appointments_per_week = excluded.max_appointments_per_week,
    can_referee = excluded.can_referee, can_assistant = excluded.can_assistant,
    can_fourth = excluded.can_fourth, can_observe = excluded.can_observe,
    status = excluded.status, notes = excluded.notes, updated_at = now()
  where public.league_officials.league_id = target_league_id;

  perform private.write_league_audit(target_league_id, 'league.official_saved', 'official', official_record_id, jsonb_build_object('name', trim(official_data ->> 'name')));
  return official_record_id;
end;
$$;

create or replace function public.deactivate_league_official(target_league_id uuid, target_official_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.can_manage_league_officials(target_league_id) then raise exception 'League officials permission required' using errcode = '42501'; end if;
  update public.league_officials set status = 'inactive', updated_at = now()
  where id = target_official_id and league_id = target_league_id;
  if not found then raise exception 'Official not found' using errcode = 'P0002'; end if;
  perform private.write_league_audit(target_league_id, 'league.official_deactivated', 'official', target_official_id, '{}'::jsonb);
end;
$$;

create or replace function public.upsert_league_official_availability(target_league_id uuid, target_official_id uuid, availability_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  record_id uuid := coalesce(nullif(availability_data ->> 'id', '')::uuid, gen_random_uuid());
begin
  if not public.can_manage_league_officials(target_league_id) then raise exception 'League officials permission required' using errcode = '42501'; end if;
  if not exists (select 1 from public.league_officials official where official.id = target_official_id and official.league_id = target_league_id) then raise exception 'Official not found' using errcode = 'P0002'; end if;
  if nullif(availability_data ->> 'available_on', '') is null then raise exception 'Availability date is required' using errcode = '22023'; end if;

  insert into public.league_official_availability (id, league_id, official_id, available_on, starts_at, ends_at, availability_status, notes)
  values (record_id, target_league_id, target_official_id, (availability_data ->> 'available_on')::date,
    nullif(availability_data ->> 'starts_at', '')::time, nullif(availability_data ->> 'ends_at', '')::time,
    coalesce(nullif(availability_data ->> 'availability_status', ''), 'available'),
    nullif(trim(coalesce(availability_data ->> 'notes', '')), ''))
  on conflict (id) do update set available_on = excluded.available_on, starts_at = excluded.starts_at,
    ends_at = excluded.ends_at, availability_status = excluded.availability_status, notes = excluded.notes, updated_at = now()
  where public.league_official_availability.league_id = target_league_id;
  return record_id;
end;
$$;

create or replace function public.upsert_league_official_conflict(target_league_id uuid, target_official_id uuid, conflict_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  record_id uuid := coalesce(nullif(conflict_data ->> 'id', '')::uuid, gen_random_uuid());
  safe_type text := coalesce(nullif(conflict_data ->> 'conflict_type', ''), 'club');
  club_id uuid := nullif(conflict_data ->> 'parent_club_id', '')::uuid;
  team_record_id uuid := nullif(conflict_data ->> 'team_id', '')::uuid;
begin
  if not public.can_manage_league_officials(target_league_id) then raise exception 'League officials permission required' using errcode = '42501'; end if;
  if not exists (select 1 from public.league_officials official where official.id = target_official_id and official.league_id = target_league_id) then raise exception 'Official not found' using errcode = 'P0002'; end if;
  if safe_type = 'club' then perform private.assert_league_reference(target_league_id, 'parent_club', club_id);
  elsif safe_type = 'team' then perform private.assert_league_reference(target_league_id, 'team', team_record_id);
  else raise exception 'Invalid conflict type' using errcode = '22023'; end if;

  insert into public.league_official_conflicts (id, league_id, official_id, conflict_type, parent_club_id, team_id, reason)
  values (record_id, target_league_id, target_official_id, safe_type,
    case when safe_type = 'club' then club_id else null end,
    case when safe_type = 'team' then team_record_id else null end,
    nullif(trim(coalesce(conflict_data ->> 'reason', '')), ''))
  on conflict (id) do update set conflict_type = excluded.conflict_type, parent_club_id = excluded.parent_club_id,
    team_id = excluded.team_id, reason = excluded.reason, updated_at = now()
  where public.league_official_conflicts.league_id = target_league_id;
  return record_id;
end;
$$;

create or replace function public.upsert_league_official_requirement(target_league_id uuid, requirement_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  record_id uuid := coalesce(nullif(requirement_data ->> 'id', '')::uuid, gen_random_uuid());
  safe_scope text := lower(trim(coalesce(requirement_data ->> 'scope_type', '')));
  safe_scope_id uuid := nullif(requirement_data ->> 'scope_id', '')::uuid;
begin
  if not public.can_manage_league_officials(target_league_id) then raise exception 'League officials permission required' using errcode = '42501'; end if;
  if safe_scope = 'league' then
    if safe_scope_id <> target_league_id then raise exception 'Invalid league requirement scope' using errcode = '22023'; end if;
  elsif safe_scope = 'division' then perform private.assert_league_reference(target_league_id, 'division', safe_scope_id);
  elsif safe_scope = 'cup' then
    if not exists (select 1 from public.league_cups cup where cup.id = safe_scope_id and cup.league_id = target_league_id) then raise exception 'Cup not found' using errcode = 'P0002'; end if;
  elsif safe_scope = 'cup_round' then
    if not exists (select 1 from public.league_cup_rounds cup_round where cup_round.id = safe_scope_id and cup_round.league_id = target_league_id) then raise exception 'Cup round not found' using errcode = 'P0002'; end if;
  else raise exception 'Invalid official requirement scope' using errcode = '22023'; end if;

  insert into public.league_official_requirements (
    id, league_id, scope_type, scope_id, referee_count, assistant_count,
    fourth_official_count, observer_count, minimum_grade
  ) values (
    record_id, target_league_id, safe_scope, safe_scope_id,
    greatest(0, least(coalesce((requirement_data ->> 'referee_count')::integer, 1), 1)),
    greatest(0, least(coalesce((requirement_data ->> 'assistant_count')::integer, 0), 2)),
    greatest(0, least(coalesce((requirement_data ->> 'fourth_official_count')::integer, 0), 1)),
    greatest(0, least(coalesce((requirement_data ->> 'observer_count')::integer, 0), 1)),
    nullif(trim(coalesce(requirement_data ->> 'minimum_grade', '')), '')
  ) on conflict (league_id, scope_type, scope_id) do update set
    referee_count = excluded.referee_count, assistant_count = excluded.assistant_count,
    fourth_official_count = excluded.fourth_official_count, observer_count = excluded.observer_count,
    minimum_grade = excluded.minimum_grade, updated_at = now()
  returning id into record_id;

  perform private.write_league_audit(target_league_id, 'league.official_requirement_saved', 'official_requirement', record_id, jsonb_build_object('scope_type', safe_scope, 'scope_id', safe_scope_id));
  return record_id;
end;
$$;

create or replace function public.bulk_upsert_league_official_assignments(target_league_id uuid, appointment_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  row_data jsonb;
  snapshot jsonb;
  saved_assignment_id uuid;
  raw_token text;
  official_record_id uuid;
  official_profile public.league_officials%rowtype;
  requirement_profile public.league_official_requirements%rowtype;
  safe_role text;
  safe_target_type text;
  safe_target_id uuid;
  appointment_date date;
  appointment_time time;
  home_parent_club_id uuid;
  away_parent_club_id uuid;
  daily_count integer;
  weekly_count integer;
  minimum_grade_number integer;
  official_grade_number integer;
  saved jsonb := '[]'::jsonb;
begin
  if not public.can_manage_league_officials(target_league_id) then raise exception 'League officials permission required' using errcode = '42501'; end if;
  if appointment_rows is null or jsonb_typeof(appointment_rows) <> 'array' then raise exception 'Appointment rows must be an array' using errcode = '22023'; end if;
  if jsonb_array_length(appointment_rows) > 500 then raise exception 'A maximum of 500 appointments can be saved at once' using errcode = '22023'; end if;

  for row_data in select value from jsonb_array_elements(appointment_rows)
  loop
    official_record_id := nullif(row_data ->> 'official_id', '')::uuid;
    safe_role := lower(trim(coalesce(row_data ->> 'role', '')));
    safe_target_type := lower(trim(coalesce(row_data ->> 'target_type', '')));
    safe_target_id := nullif(row_data ->> 'target_id', '')::uuid;
    if official_record_id is null or safe_target_id is null then raise exception 'Official and fixture target are required' using errcode = '22023'; end if;
    if safe_role not in ('referee', 'assistant_1', 'assistant_2', 'fourth_official', 'observer') then raise exception 'Invalid official role' using errcode = '22023'; end if;

    select official.* into official_profile
    from public.league_officials official
    where official.id = official_record_id
      and official.league_id = target_league_id
      and official.status = 'active';
    if official_profile.id is null then raise exception 'Selected official is not active in this league' using errcode = '22023'; end if;
    if safe_role = 'referee' and not official_profile.can_referee then raise exception 'Selected official cannot be appointed as referee' using errcode = '22023'; end if;
    if safe_role in ('assistant_1', 'assistant_2') and not official_profile.can_assistant then raise exception 'Selected official cannot be appointed as assistant referee' using errcode = '22023'; end if;
    if safe_role = 'fourth_official' and not official_profile.can_fourth then raise exception 'Selected official cannot be appointed as fourth official' using errcode = '22023'; end if;
    if safe_role = 'observer' and not official_profile.can_observe then raise exception 'Selected official cannot be appointed as observer' using errcode = '22023'; end if;

    snapshot := private.assert_league_operations_target(target_league_id, safe_target_type, safe_target_id);
    if nullif(snapshot ->> 'target_date', '') is null or nullif(snapshot ->> 'kick_off', '') is null then raise exception 'Appointments require a placed fixture with a kick-off time' using errcode = '22023'; end if;
    appointment_date := (snapshot ->> 'target_date')::date;
    appointment_time := (snapshot ->> 'kick_off')::time;

    select requirement.* into requirement_profile
    from public.league_official_requirements requirement
    where requirement.league_id = target_league_id
      and (
        (requirement.scope_type = 'cup_round' and requirement.scope_id = nullif(snapshot ->> 'cup_round_id', '')::uuid)
        or (requirement.scope_type = 'cup' and requirement.scope_id = nullif(snapshot ->> 'cup_id', '')::uuid)
        or (requirement.scope_type = 'division' and requirement.scope_id = nullif(snapshot ->> 'division_id', '')::uuid)
        or (requirement.scope_type = 'league' and requirement.scope_id = target_league_id)
      )
    order by case requirement.scope_type when 'cup_round' then 1 when 'cup' then 2 when 'division' then 3 else 4 end
    limit 1;

    if requirement_profile.minimum_grade is not null then
      minimum_grade_number := nullif(regexp_replace(requirement_profile.minimum_grade, '[^0-9]+', '', 'g'), '')::integer;
      official_grade_number := nullif(regexp_replace(coalesce(official_profile.grade, ''), '[^0-9]+', '', 'g'), '')::integer;
      if minimum_grade_number is not null and (official_grade_number is null or official_grade_number > minimum_grade_number) then
        raise exception 'Selected official does not meet the competition minimum grade' using errcode = '22023';
      elsif minimum_grade_number is null and lower(trim(coalesce(official_profile.grade, ''))) <> lower(trim(requirement_profile.minimum_grade)) then
        raise exception 'Selected official does not meet the competition minimum grade' using errcode = '22023';
      end if;
    end if;

    if exists (
      select 1 from public.league_official_availability availability
      where availability.league_id = target_league_id
        and availability.official_id = official_record_id
        and availability.available_on = appointment_date
        and availability.availability_status = 'unavailable'
    ) then raise exception 'Selected official is unavailable on this date' using errcode = '22023'; end if;

    if exists (
      select 1 from public.league_official_availability availability
      where availability.league_id = target_league_id
        and availability.official_id = official_record_id
        and availability.available_on = appointment_date
    ) and not exists (
      select 1 from public.league_official_availability availability
      where availability.league_id = target_league_id
        and availability.official_id = official_record_id
        and availability.available_on = appointment_date
        and availability.availability_status in ('available', 'preferred')
        and (availability.starts_at is null or appointment_time >= availability.starts_at)
        and (availability.ends_at is null or appointment_time <= availability.ends_at)
    ) then raise exception 'Selected official is outside their available time window' using errcode = '22023'; end if;

    select team.parent_club_id into home_parent_club_id from public.league_teams team where team.id = nullif(snapshot ->> 'home_team_id', '')::uuid and team.league_id = target_league_id;
    select team.parent_club_id into away_parent_club_id from public.league_teams team where team.id = nullif(snapshot ->> 'away_team_id', '')::uuid and team.league_id = target_league_id;
    if exists (
      select 1 from public.league_official_conflicts conflict
      where conflict.league_id = target_league_id
        and conflict.official_id = official_record_id
        and (
          conflict.team_id in (nullif(snapshot ->> 'home_team_id', '')::uuid, nullif(snapshot ->> 'away_team_id', '')::uuid)
          or conflict.parent_club_id in (home_parent_club_id, away_parent_club_id)
        )
    ) then raise exception 'Selected official has a declared club or team conflict' using errcode = '22023'; end if;

    if exists (
      select 1 from public.league_official_assignments existing
      where existing.league_id = target_league_id
        and existing.official_id = official_record_id
        and existing.status not in ('declined', 'withdrawn', 'replacement_required')
        and existing.target_date = appointment_date
        and abs(extract(epoch from (existing.kick_off - appointment_time))) < 10800
        and not (existing.target_type = safe_target_type and existing.target_id = safe_target_id and existing.role = safe_role)
    ) then raise exception 'Official has another appointment too close to this kick-off' using errcode = '23505'; end if;

    select count(*) into daily_count
    from public.league_official_assignments existing
    where existing.league_id = target_league_id
      and existing.official_id = official_record_id
      and existing.status not in ('declined', 'withdrawn', 'replacement_required')
      and existing.target_date = appointment_date
      and not (existing.target_type = safe_target_type and existing.target_id = safe_target_id and existing.role = safe_role);
    if daily_count >= official_profile.max_appointments_per_day then raise exception 'Official daily appointment limit would be exceeded' using errcode = '22023'; end if;

    select count(*) into weekly_count
    from public.league_official_assignments existing
    where existing.league_id = target_league_id
      and existing.official_id = official_record_id
      and existing.status not in ('declined', 'withdrawn', 'replacement_required')
      and existing.target_date >= date_trunc('week', appointment_date::timestamp)::date
      and existing.target_date < (date_trunc('week', appointment_date::timestamp) + interval '7 days')::date
      and not (existing.target_type = safe_target_type and existing.target_id = safe_target_id and existing.role = safe_role);
    if weekly_count >= official_profile.max_appointments_per_week then raise exception 'Official weekly appointment limit would be exceeded' using errcode = '22023'; end if;

    raw_token := encode(gen_random_bytes(24), 'hex');
    insert into public.league_official_assignments (
      league_id, target_type, target_id, target_date, kick_off, venue_id,
      official_id, role, status, response_token_hash, response_expires_at, created_by, notes
    ) values (
      target_league_id, safe_target_type, safe_target_id, appointment_date,
      appointment_time, nullif(snapshot ->> 'venue_id', '')::uuid,
      official_record_id, safe_role, coalesce(nullif(row_data ->> 'status', ''), 'proposed'),
      encode(digest(raw_token, 'sha256'), 'hex'), now() + interval '30 days', auth.uid(),
      nullif(trim(coalesce(row_data ->> 'notes', '')), '')
    ) on conflict (league_id, target_type, target_id, role) do update set
      target_date = excluded.target_date, kick_off = excluded.kick_off, venue_id = excluded.venue_id,
      official_id = excluded.official_id,
      status = case when public.league_official_assignments.official_id = excluded.official_id then public.league_official_assignments.status else 'proposed' end,
      response_token_hash = excluded.response_token_hash,
      response_expires_at = excluded.response_expires_at,
      responded_at = case when public.league_official_assignments.official_id = excluded.official_id then public.league_official_assignments.responded_at else null end,
      notes = excluded.notes, updated_at = now()
    returning id into saved_assignment_id;

    insert into private.league_official_response_tokens (assignment_id, raw_token)
    values (saved_assignment_id, raw_token)
    on conflict (assignment_id) do update set raw_token = excluded.raw_token, created_at = now();

    saved := saved || jsonb_build_array(jsonb_build_object('id', saved_assignment_id, 'response_token', (select token.raw_token from private.league_official_response_tokens token where token.assignment_id = saved_assignment_id)));
  end loop;

  perform private.write_league_audit(target_league_id, 'league.official_appointments_saved', 'official_assignment_batch', null, jsonb_build_object('count', jsonb_array_length(saved)));
  return jsonb_build_object('assignments', saved, 'count', jsonb_array_length(saved));
end;
$$;

create or replace function public.update_league_official_assignment_status(target_league_id uuid, target_assignment_id uuid, next_status text)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare safe_status text := lower(trim(coalesce(next_status, '')));
begin
  if not public.can_manage_league_officials(target_league_id) then raise exception 'League officials permission required' using errcode = '42501'; end if;
  if safe_status not in ('proposed', 'sent', 'accepted', 'declined', 'withdrawn', 'confirmed', 'replacement_required') then raise exception 'Invalid appointment status' using errcode = '22023'; end if;
  update public.league_official_assignments set status = safe_status, updated_at = now(),
    responded_at = case when safe_status in ('accepted', 'declined') then now() else responded_at end
  where id = target_assignment_id and league_id = target_league_id;
  if not found then raise exception 'Appointment not found' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.respond_to_league_official_assignment(response_token text, decision text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  assignment public.league_official_assignments%rowtype;
  safe_decision text := lower(trim(coalesce(decision, '')));
  next_status text;
begin
  if safe_decision not in ('accepted', 'declined') then raise exception 'Response must be accepted or declined' using errcode = '22023'; end if;
  select row_value.* into assignment from public.league_official_assignments row_value
  where row_value.response_token_hash = encode(digest(trim(coalesce(response_token, '')), 'sha256'), 'hex')
    and row_value.response_expires_at > now()
  for update;
  if assignment.id is null then raise exception 'This appointment response link is invalid or expired' using errcode = '42501'; end if;
  next_status := case when safe_decision = 'accepted' then 'accepted' else 'replacement_required' end;
  update public.league_official_assignments
  set status = next_status,
      responded_at = now(),
      response_token_hash = null,
      response_expires_at = null,
      updated_at = now()
  where id = assignment.id;
  delete from private.league_official_response_tokens token_store where token_store.assignment_id = assignment.id;
  return jsonb_build_object('status', next_status, 'target_date', assignment.target_date, 'kick_off', assignment.kick_off, 'role', assignment.role);
end;
$$;

create or replace function public.update_league_venue_map_position(target_league_id uuid, target_venue_id uuid, target_latitude numeric, target_longitude numeric)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.can_manage_league(target_league_id) then raise exception 'League administrator access required' using errcode = '42501'; end if;
  if target_latitude not between -90 and 90 or target_longitude not between -180 and 180 then raise exception 'Invalid map coordinates' using errcode = '22023'; end if;
  update public.league_venues set latitude = target_latitude, longitude = target_longitude, updated_at = now()
  where id = target_venue_id and league_id = target_league_id;
  if not found then raise exception 'Venue not found' using errcode = 'P0002'; end if;
  perform private.write_league_audit(target_league_id, 'league.venue_map_position_saved', 'venue', target_venue_id, jsonb_build_object('latitude', target_latitude, 'longitude', target_longitude));
end;
$$;

create or replace function public.upsert_league_postponement(target_league_id uuid, postponement_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  record_id uuid := coalesce(nullif(postponement_data ->> 'id', '')::uuid, gen_random_uuid());
  safe_target_type text := lower(trim(coalesce(postponement_data ->> 'target_type', '')));
  safe_target_id uuid := nullif(postponement_data ->> 'target_id', '')::uuid;
  snapshot jsonb;
begin
  if not public.can_operate_league(target_league_id) then raise exception 'League fixture operation access required' using errcode = '42501'; end if;
  snapshot := private.assert_league_operations_target(target_league_id, safe_target_type, safe_target_id);
  insert into public.league_postponement_requests (
    id, league_id, target_type, target_id, requested_by_club_id, reason_category,
    reason, status, original_date, original_kick_off, original_venue_id,
    proposed_dates, deadline_on, notes, created_by
  ) values (
    record_id, target_league_id, safe_target_type, safe_target_id,
    nullif(postponement_data ->> 'requested_by_club_id', '')::uuid,
    coalesce(nullif(postponement_data ->> 'reason_category', ''), 'other'),
    trim(postponement_data ->> 'reason'),
    coalesce(nullif(postponement_data ->> 'status', ''), 'requested'),
    coalesce(nullif(postponement_data ->> 'original_date', '')::date, nullif(snapshot ->> 'target_date', '')::date),
    coalesce(nullif(postponement_data ->> 'original_kick_off', '')::time, nullif(snapshot ->> 'kick_off', '')::time),
    coalesce(nullif(postponement_data ->> 'original_venue_id', '')::uuid, nullif(snapshot ->> 'venue_id', '')::uuid),
    coalesce(postponement_data -> 'proposed_dates', '[]'::jsonb),
    nullif(postponement_data ->> 'deadline_on', '')::date,
    nullif(trim(coalesce(postponement_data ->> 'notes', '')), ''), auth.uid()
  ) on conflict (id) do update set
    requested_by_club_id = excluded.requested_by_club_id, reason_category = excluded.reason_category,
    reason = excluded.reason, status = excluded.status, proposed_dates = excluded.proposed_dates,
    deadline_on = excluded.deadline_on, notes = excluded.notes, updated_at = now()
  where public.league_postponement_requests.league_id = target_league_id;
  perform private.write_league_audit(target_league_id, 'league.postponement_saved', 'postponement', record_id, jsonb_build_object('target_type', safe_target_type, 'target_id', safe_target_id));
  return record_id;
end;
$$;

create or replace function public.update_league_postponement_status(target_league_id uuid, target_postponement_id uuid, next_status text)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare safe_status text := lower(trim(coalesce(next_status, '')));
begin
  if not public.can_operate_league(target_league_id) then raise exception 'League fixture operation access required' using errcode = '42501'; end if;
  if safe_status not in ('requested', 'approved', 'rejected', 'rearrangement_required', 'proposed', 'rearranged', 'closed') then raise exception 'Invalid postponement status' using errcode = '22023'; end if;
  update public.league_postponement_requests set status = safe_status, updated_at = now()
  where id = target_postponement_id and league_id = target_league_id;
  if not found then raise exception 'Postponement not found' using errcode = 'P0002'; end if;
  perform private.write_league_audit(target_league_id, 'league.postponement_status_changed', 'postponement', target_postponement_id, jsonb_build_object('status', safe_status));
end;
$$;

-- Secure all new public tables.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'league_officials', 'league_official_availability', 'league_official_conflicts',
    'league_official_requirements', 'league_official_assignments', 'league_postponement_requests'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
  end loop;
end $$;

-- Execute-only access through audited RPCs.
revoke all on function public.can_manage_league_officials(uuid) from public, anon;
revoke all on function public.get_league_operations_data(uuid) from public, anon;
revoke all on function public.upsert_league_official(uuid, jsonb) from public, anon;
revoke all on function public.deactivate_league_official(uuid, uuid) from public, anon;
revoke all on function public.upsert_league_official_availability(uuid, uuid, jsonb) from public, anon;
revoke all on function public.upsert_league_official_conflict(uuid, uuid, jsonb) from public, anon;
revoke all on function public.upsert_league_official_requirement(uuid, jsonb) from public, anon;
revoke all on function public.bulk_upsert_league_official_assignments(uuid, jsonb) from public, anon;
revoke all on function public.update_league_official_assignment_status(uuid, uuid, text) from public, anon;
revoke all on function public.update_league_venue_map_position(uuid, uuid, numeric, numeric) from public, anon;
revoke all on function public.upsert_league_postponement(uuid, jsonb) from public, anon;
revoke all on function public.update_league_postponement_status(uuid, uuid, text) from public, anon;
revoke all on function public.respond_to_league_official_assignment(text, text) from public;

revoke all on function public.can_manage_league_officials(uuid) from authenticated;
grant execute on function public.can_manage_league_officials(uuid) to authenticated;
grant execute on function public.get_league_operations_data(uuid) to authenticated;
grant execute on function public.upsert_league_official(uuid, jsonb) to authenticated;
grant execute on function public.deactivate_league_official(uuid, uuid) to authenticated;
grant execute on function public.upsert_league_official_availability(uuid, uuid, jsonb) to authenticated;
grant execute on function public.upsert_league_official_conflict(uuid, uuid, jsonb) to authenticated;
grant execute on function public.upsert_league_official_requirement(uuid, jsonb) to authenticated;
grant execute on function public.bulk_upsert_league_official_assignments(uuid, jsonb) to authenticated;
grant execute on function public.update_league_official_assignment_status(uuid, uuid, text) to authenticated;
grant execute on function public.update_league_venue_map_position(uuid, uuid, numeric, numeric) to authenticated;
grant execute on function public.upsert_league_postponement(uuid, jsonb) to authenticated;
grant execute on function public.update_league_postponement_status(uuid, uuid, text) to authenticated;
grant execute on function public.respond_to_league_official_assignment(text, text) to anon, authenticated;

commit;
