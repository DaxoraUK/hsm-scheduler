-- Daxora League Manager: secure pilot foundation.
-- Separate league product workspace for seasons, divisions, parent clubs, teams,
-- venues, ground sharing, blackout dates, fixture records and league access.

begin;

create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 160),
  slug text not null unique,
  country_code text not null default 'GB-ENG',
  governing_body text,
  timezone text not null default 'Europe/London',
  product_status text not null default 'pilot' check (product_status in ('pilot', 'contracted', 'live')),
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.league_memberships (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'admin', 'fixtures', 'viewer')),
  status text not null default 'active' check (status in ('active', 'invited', 'suspended', 'revoked')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create table if not exists public.league_invitations (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'fixtures', 'viewer')),
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (position('@' in email) > 1),
  check (expires_at > created_at)
);

create table if not exists public.league_seasons (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 80),
  starts_on date,
  ends_on date,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  unique (league_id, name)
);

create table if not exists public.league_divisions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid not null references public.league_seasons(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 120),
  code text,
  sort_order integer not null default 0,
  team_limit integer check (team_limit is null or team_limit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, name)
);

create table if not exists public.league_parent_clubs (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 160),
  short_name text,
  external_ref text,
  status text not null default 'active' check (status in ('active', 'inactive', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, name)
);

create table if not exists public.league_venues (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  parent_club_id uuid references public.league_parent_clubs(id) on delete set null,
  name text not null check (length(trim(name)) between 2 and 160),
  address text,
  postcode text,
  surface text,
  capacity integer check (capacity is null or capacity >= 0),
  ground_share_key text,
  status text not null default 'active' check (status in ('active', 'inactive', 'unavailable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, name)
);

create table if not exists public.league_teams (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid not null references public.league_seasons(id) on delete restrict,
  division_id uuid references public.league_divisions(id) on delete restrict,
  parent_club_id uuid not null references public.league_parent_clubs(id) on delete restrict,
  home_venue_id uuid references public.league_venues(id) on delete restrict,
  name text not null check (length(trim(name)) between 2 and 160),
  short_name text,
  external_ref text,
  status text not null default 'active' check (status in ('active', 'inactive', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, name)
);

create table if not exists public.league_blackout_dates (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid references public.league_seasons(id) on delete restrict,
  scope_type text not null check (scope_type in ('league', 'division', 'club', 'team', 'venue')),
  scope_id uuid,
  starts_on date not null,
  ends_on date not null,
  reason text not null check (length(trim(reason)) between 2 and 300),
  source text not null default 'manual' check (source in ('manual', 'club_request', 'league_rule', 'import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table if not exists public.league_playing_dates (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid not null references public.league_seasons(id) on delete restrict,
  division_id uuid references public.league_divisions(id) on delete restrict,
  playing_date date not null,
  default_kick_off time,
  status text not null default 'available' check (status in ('available', 'reserved', 'closed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists league_playing_dates_unique_scope_idx
  on public.league_playing_dates (
    league_id,
    season_id,
    coalesce(division_id, '00000000-0000-0000-0000-000000000000'::uuid),
    playing_date
  );

create table if not exists public.league_fixtures (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid not null references public.league_seasons(id) on delete restrict,
  division_id uuid references public.league_divisions(id) on delete restrict,
  home_team_id uuid not null references public.league_teams(id) on delete restrict,
  away_team_id uuid not null references public.league_teams(id) on delete restrict,
  venue_id uuid references public.league_venues(id) on delete restrict,
  scheduled_date date,
  kick_off time,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'postponed', 'rearranged', 'played', 'cancelled')),
  locked boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'csv', 'generated', 'league_import')),
  external_ref text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);

create table if not exists public.league_audit_events (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_label text not null,
  actor_role text not null,
  action text not null,
  entity_type text,
  entity_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists league_memberships_user_idx on public.league_memberships(user_id, status, league_id);
create index if not exists league_invitations_lookup_idx on public.league_invitations(lower(email), status, expires_at);
create index if not exists league_seasons_league_idx on public.league_seasons(league_id, is_current desc, starts_on desc);
create index if not exists league_divisions_season_idx on public.league_divisions(season_id, sort_order, name);
create index if not exists league_parent_clubs_league_idx on public.league_parent_clubs(league_id, name);
create index if not exists league_venues_league_idx on public.league_venues(league_id, name);
create index if not exists league_teams_season_idx on public.league_teams(season_id, division_id, name);
create index if not exists league_blackouts_range_idx on public.league_blackout_dates(league_id, starts_on, ends_on);
create index if not exists league_playing_dates_schedule_idx on public.league_playing_dates(league_id, season_id, playing_date, division_id);
create index if not exists league_fixtures_schedule_idx on public.league_fixtures(league_id, season_id, scheduled_date, kick_off);
create index if not exists league_fixtures_status_idx on public.league_fixtures(league_id, status, scheduled_date);
create unique index if not exists league_fixtures_external_ref_key on public.league_fixtures(league_id, external_ref) where external_ref is not null;
create index if not exists league_audit_created_idx on public.league_audit_events(league_id, created_at desc);

-- Keep update timestamps consistent.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'leagues', 'league_memberships', 'league_invitations', 'league_seasons',
    'league_divisions', 'league_parent_clubs', 'league_venues', 'league_teams',
    'league_blackout_dates', 'league_playing_dates', 'league_fixtures'
  ] loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_touch_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      table_name || '_touch_updated_at',
      table_name
    );
  end loop;
end $$;

-- Browser sessions never mutate league tables directly.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'leagues', 'league_memberships', 'league_invitations', 'league_seasons',
    'league_divisions', 'league_parent_clubs', 'league_venues', 'league_teams',
    'league_blackout_dates', 'league_playing_dates', 'league_fixtures', 'league_audit_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
  end loop;
end $$;

create or replace function private.is_active_platform_staff(actor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1 from public.platform_support_staff staff
    where staff.user_id = actor_id and staff.status = 'active'
  );
$$;

create or replace function private.is_platform_admin(actor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1 from public.platform_support_staff staff
    where staff.user_id = actor_id
      and staff.status = 'active'
      and staff.platform_role = 'admin'
  );
$$;

create or replace function private.current_league_role(target_league_id uuid, actor_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    (
      select membership.role
      from public.league_memberships membership
      where membership.league_id = target_league_id
        and membership.user_id = actor_id
        and membership.status = 'active'
      limit 1
    ),
    (
      select case when staff.platform_role = 'admin' then 'platform_admin' else 'platform_support' end
      from public.platform_support_staff staff
      where staff.user_id = actor_id and staff.status = 'active'
      limit 1
    ),
    'none'
  );
$$;

create or replace function public.can_view_league(target_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.leagues league
    where league.id = target_league_id
      and league.status <> 'closed'
      and (
        private.is_active_platform_staff(auth.uid())
        or exists (
          select 1 from public.league_memberships membership
          where membership.league_id = league.id
            and membership.user_id = auth.uid()
            and membership.status = 'active'
        )
      )
  );
$$;

create or replace function public.can_manage_league(target_league_id uuid)
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
      select 1 from public.league_memberships membership
      join public.leagues league on league.id = membership.league_id
      where membership.league_id = target_league_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
        and membership.role = any(array['owner', 'admin'])
        and league.status = 'active'
    )
  );
$$;

create or replace function public.can_operate_league(target_league_id uuid)
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
      select 1 from public.league_memberships membership
      join public.leagues league on league.id = membership.league_id
      where membership.league_id = target_league_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
        and membership.role = any(array['owner', 'admin', 'fixtures'])
        and league.status = 'active'
    )
  );
$$;

create or replace function private.current_league_actor_label(actor_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    nullif(trim(profile.display_name), ''),
    nullif(trim(profile.email), ''),
    'Authenticated user'
  )
  from public.user_profiles profile
  where profile.id = actor_id
  union all
  select 'Authenticated user'
  where not exists (select 1 from public.user_profiles profile where profile.id = actor_id)
  limit 1;
$$;

create or replace function private.write_league_audit(
  target_league_id uuid,
  event_action text,
  target_entity_type text default null,
  target_entity_id uuid default null,
  event_detail jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  event_id uuid;
begin
  if actor_id is null then
    raise exception 'Authenticated league actor required' using errcode = '42501';
  end if;

  insert into public.league_audit_events (
    league_id, actor_user_id, actor_label, actor_role, action, entity_type, entity_id, detail
  ) values (
    target_league_id,
    actor_id,
    private.current_league_actor_label(actor_id),
    private.current_league_role(target_league_id, actor_id),
    trim(event_action),
    nullif(trim(coalesce(target_entity_type, '')), ''),
    target_entity_id,
    coalesce(event_detail, '{}'::jsonb)
  ) returning id into event_id;

  return event_id;
end;
$$;

create or replace function private.league_slug(value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(trim(coalesce(value, 'league'))), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.list_accessible_leagues()
returns table (
  league_id uuid,
  league_name text,
  league_slug text,
  product_status text,
  league_status text,
  country_code text,
  governing_body text,
  timezone text,
  access_role text,
  read_only boolean
)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  platform_access boolean := private.is_active_platform_staff(actor_id);
  platform_admin boolean := private.is_platform_admin(actor_id);
begin
  if actor_id is null then
    raise exception 'Sign in to access League Manager' using errcode = '42501';
  end if;

  return query
  select
    league.id,
    league.name,
    league.slug,
    league.product_status,
    league.status,
    league.country_code,
    league.governing_body,
    league.timezone,
    coalesce(membership.role, case when platform_admin then 'platform_admin' else 'platform_support' end),
    case
      when membership.role in ('owner', 'admin', 'fixtures') then false
      when platform_admin then false
      else true
    end
  from public.leagues league
  left join public.league_memberships membership
    on membership.league_id = league.id
   and membership.user_id = actor_id
   and membership.status = 'active'
  where league.status <> 'closed'
    and (platform_access or membership.user_id is not null)
  order by league.name;
end;
$$;

create or replace function public.platform_create_league_pilot(
  league_name text,
  league_country_code text default 'GB-ENG',
  league_governing_body text default null,
  league_timezone text default 'Europe/London',
  initial_season_name text default null,
  initial_season_start date default null,
  initial_season_end date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_name text := trim(coalesce(league_name, ''));
  org_id uuid;
  new_league_id uuid;
  new_season_id uuid;
  base_slug text;
  unique_slug text;
begin
  perform private.require_platform_staff('admin');
  if length(safe_name) < 2 then
    raise exception 'League name is required' using errcode = '22023';
  end if;

  base_slug := coalesce(nullif(private.league_slug(safe_name), ''), 'league');
  unique_slug := base_slug;
  if exists (select 1 from public.organisations where slug = unique_slug)
     or exists (select 1 from public.leagues where slug = unique_slug) then
    unique_slug := base_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  end if;

  insert into public.organisations (name, slug, organisation_type, status, created_by)
  values (safe_name, unique_slug, 'league_operator', 'active', actor_id)
  returning id into org_id;

  insert into public.leagues (
    organisation_id, name, slug, country_code, governing_body, timezone, product_status, status, created_by
  ) values (
    org_id,
    safe_name,
    unique_slug,
    coalesce(nullif(trim(league_country_code), ''), 'GB-ENG'),
    nullif(trim(coalesce(league_governing_body, '')), ''),
    coalesce(nullif(trim(league_timezone), ''), 'Europe/London'),
    'pilot',
    'active',
    actor_id
  ) returning id into new_league_id;

  insert into public.league_memberships (league_id, user_id, role, status, created_by)
  values (new_league_id, actor_id, 'owner', 'active', actor_id);

  if length(trim(coalesce(initial_season_name, ''))) >= 2 then
    insert into public.league_seasons (league_id, name, starts_on, ends_on, status, is_current)
    values (
      new_league_id,
      trim(initial_season_name),
      initial_season_start,
      initial_season_end,
      'draft',
      true
    ) returning id into new_season_id;
  end if;

  perform private.write_league_audit(
    new_league_id,
    'league.pilot_created',
    'league',
    new_league_id,
    jsonb_build_object('season_id', new_season_id, 'product_status', 'pilot')
  );

  return jsonb_build_object('league_id', new_league_id, 'season_id', new_season_id, 'slug', unique_slug);
end;
$$;

create or replace function public.get_league_workspace(target_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  result jsonb;
begin
  if actor_id is null or not public.can_view_league(target_league_id) then
    raise exception 'League workspace access denied' using errcode = '42501';
  end if;

  update public.league_invitations
  set status = 'expired', updated_at = now()
  where league_id = target_league_id and status = 'pending' and expires_at <= now();

  select jsonb_build_object(
    'league', to_jsonb(league),
    'access', jsonb_build_object(
      'role', private.current_league_role(target_league_id, actor_id),
      'can_manage', public.can_manage_league(target_league_id),
      'can_operate', public.can_operate_league(target_league_id),
      'read_only', not public.can_operate_league(target_league_id)
    ),
    'seasons', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.is_current desc, row_value.starts_on desc nulls last, row_value.name) from public.league_seasons row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'divisions', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.sort_order, row_value.name) from public.league_divisions row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'clubs', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.name) from public.league_parent_clubs row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'venues', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.name) from public.league_venues row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'teams', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.name) from public.league_teams row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'blackouts', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.starts_on, row_value.scope_type) from public.league_blackout_dates row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'playing_dates', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.playing_date, row_value.division_id nulls first) from public.league_playing_dates row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'fixtures', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.scheduled_date nulls last, row_value.kick_off nulls last, row_value.created_at) from public.league_fixtures row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', membership.user_id,
        'role', membership.role,
        'status', membership.status,
        'display_name', profile.display_name,
        'email', profile.email,
        'created_at', membership.created_at
      ) order by case membership.role when 'owner' then 0 when 'admin' then 1 when 'fixtures' then 2 else 3 end, coalesce(profile.display_name, profile.email))
      from public.league_memberships membership
      left join public.user_profiles profile on profile.id = membership.user_id
      where membership.league_id = target_league_id and membership.status <> 'revoked'
    ), '[]'::jsonb),
    'invitations', case when public.can_manage_league(target_league_id) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', invitation.id,
        'email', invitation.email,
        'role', invitation.role,
        'status', invitation.status,
        'expires_at', invitation.expires_at,
        'created_at', invitation.created_at
      ) order by invitation.created_at desc)
      from public.league_invitations invitation
      where invitation.league_id = target_league_id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'audit', coalesce((
      select jsonb_agg(to_jsonb(audit_row) order by audit_row.created_at desc)
      from (
        select * from public.league_audit_events
        where league_id = target_league_id
        order by created_at desc
        limit 50
      ) audit_row
    ), '[]'::jsonb)
  ) into result
  from public.leagues league
  where league.id = target_league_id;

  if result is null then
    raise exception 'League workspace not found' using errcode = 'P0002';
  end if;

  return result;
end;
$$;

create or replace function private.assert_league_reference(target_league_id uuid, table_name text, target_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  valid_reference boolean := false;
begin
  if target_id is null then return; end if;
  case table_name
    when 'season' then select exists(select 1 from public.league_seasons where id = target_id and league_id = target_league_id) into valid_reference;
    when 'division' then select exists(select 1 from public.league_divisions where id = target_id and league_id = target_league_id) into valid_reference;
    when 'club' then select exists(select 1 from public.league_parent_clubs where id = target_id and league_id = target_league_id) into valid_reference;
    when 'venue' then select exists(select 1 from public.league_venues where id = target_id and league_id = target_league_id) into valid_reference;
    when 'team' then select exists(select 1 from public.league_teams where id = target_id and league_id = target_league_id) into valid_reference;
    else raise exception 'Unknown league reference type' using errcode = '22023';
  end case;
  if not valid_reference then
    raise exception 'Referenced % does not belong to this league', table_name using errcode = '23503';
  end if;
end;
$$;

create or replace function public.upsert_league_entity(
  target_league_id uuid,
  entity_type text,
  entity_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  safe_type text := lower(trim(coalesce(entity_type, '')));
  entity_id uuid := nullif(entity_data ->> 'id', '')::uuid;
  season_id uuid;
  division_id uuid;
  club_id uuid;
  venue_id uuid;
  home_team_id uuid;
  away_team_id uuid;
  scope_id uuid;
begin
  if entity_data is null or jsonb_typeof(entity_data) <> 'object' then
    raise exception 'League entity data is required' using errcode = '22023';
  end if;

  if safe_type in ('fixture', 'blackout', 'playing_date') then
    if not public.can_operate_league(target_league_id) then
      raise exception 'League fixture operation access required' using errcode = '42501';
    end if;
  elsif not public.can_manage_league(target_league_id) then
    raise exception 'League administrator access required' using errcode = '42501';
  end if;

  if entity_id is null and safe_type = 'fixture' and nullif(trim(coalesce(entity_data ->> 'external_ref', '')), '') is not null then
    select fixture_row.id into entity_id
    from public.league_fixtures fixture_row
    where fixture_row.league_id = target_league_id
      and fixture_row.external_ref = nullif(trim(coalesce(entity_data ->> 'external_ref', '')), '')
    limit 1;
  end if;
  entity_id := coalesce(entity_id, gen_random_uuid());

  case safe_type
    when 'season' then
      if coalesce((entity_data ->> 'is_current')::boolean, false) then
        update public.league_seasons set is_current = false where league_id = target_league_id and id <> entity_id;
      end if;
      insert into public.league_seasons (id, league_id, name, starts_on, ends_on, status, is_current)
      values (
        entity_id,
        target_league_id,
        trim(entity_data ->> 'name'),
        nullif(entity_data ->> 'starts_on', '')::date,
        nullif(entity_data ->> 'ends_on', '')::date,
        coalesce(nullif(entity_data ->> 'status', ''), 'draft'),
        coalesce((entity_data ->> 'is_current')::boolean, false)
      )
      on conflict (id) do update set
        name = excluded.name,
        starts_on = excluded.starts_on,
        ends_on = excluded.ends_on,
        status = excluded.status,
        is_current = excluded.is_current
      where public.league_seasons.league_id = target_league_id;

    when 'division' then
      season_id := nullif(entity_data ->> 'season_id', '')::uuid;
      perform private.assert_league_reference(target_league_id, 'season', season_id);
      insert into public.league_divisions (id, league_id, season_id, name, code, sort_order, team_limit)
      values (
        entity_id, target_league_id, season_id, trim(entity_data ->> 'name'),
        nullif(trim(coalesce(entity_data ->> 'code', '')), ''),
        coalesce((entity_data ->> 'sort_order')::integer, 0),
        nullif(entity_data ->> 'team_limit', '')::integer
      )
      on conflict (id) do update set
        season_id = excluded.season_id,
        name = excluded.name,
        code = excluded.code,
        sort_order = excluded.sort_order,
        team_limit = excluded.team_limit
      where public.league_divisions.league_id = target_league_id;

    when 'parent_club' then
      insert into public.league_parent_clubs (id, league_id, name, short_name, external_ref, status)
      values (
        entity_id, target_league_id, trim(entity_data ->> 'name'),
        nullif(trim(coalesce(entity_data ->> 'short_name', '')), ''),
        nullif(trim(coalesce(entity_data ->> 'external_ref', '')), ''),
        coalesce(nullif(entity_data ->> 'status', ''), 'active')
      )
      on conflict (id) do update set
        name = excluded.name,
        short_name = excluded.short_name,
        external_ref = excluded.external_ref,
        status = excluded.status
      where public.league_parent_clubs.league_id = target_league_id;

    when 'venue' then
      club_id := nullif(entity_data ->> 'parent_club_id', '')::uuid;
      perform private.assert_league_reference(target_league_id, 'club', club_id);
      insert into public.league_venues (id, league_id, parent_club_id, name, address, postcode, surface, capacity, ground_share_key, status)
      values (
        entity_id, target_league_id, club_id, trim(entity_data ->> 'name'),
        nullif(trim(coalesce(entity_data ->> 'address', '')), ''),
        nullif(upper(trim(coalesce(entity_data ->> 'postcode', ''))), ''),
        nullif(trim(coalesce(entity_data ->> 'surface', '')), ''),
        nullif(entity_data ->> 'capacity', '')::integer,
        nullif(trim(coalesce(entity_data ->> 'ground_share_key', '')), ''),
        coalesce(nullif(entity_data ->> 'status', ''), 'active')
      )
      on conflict (id) do update set
        parent_club_id = excluded.parent_club_id,
        name = excluded.name,
        address = excluded.address,
        postcode = excluded.postcode,
        surface = excluded.surface,
        capacity = excluded.capacity,
        ground_share_key = excluded.ground_share_key,
        status = excluded.status
      where public.league_venues.league_id = target_league_id;

    when 'team' then
      season_id := nullif(entity_data ->> 'season_id', '')::uuid;
      division_id := nullif(entity_data ->> 'division_id', '')::uuid;
      club_id := nullif(entity_data ->> 'parent_club_id', '')::uuid;
      venue_id := nullif(entity_data ->> 'home_venue_id', '')::uuid;
      perform private.assert_league_reference(target_league_id, 'season', season_id);
      perform private.assert_league_reference(target_league_id, 'division', division_id);
      perform private.assert_league_reference(target_league_id, 'club', club_id);
      perform private.assert_league_reference(target_league_id, 'venue', venue_id);
      if division_id is not null and not exists (
        select 1 from public.league_divisions division_row
        where division_row.id = division_id
          and division_row.season_id = nullif(entity_data ->> 'season_id', '')::uuid
      ) then
        raise exception 'The selected division does not belong to the selected season' using errcode = '23503';
      end if;
      insert into public.league_teams (id, league_id, season_id, division_id, parent_club_id, home_venue_id, name, short_name, external_ref, status)
      values (
        entity_id, target_league_id, season_id, division_id, club_id, venue_id,
        trim(entity_data ->> 'name'),
        nullif(trim(coalesce(entity_data ->> 'short_name', '')), ''),
        nullif(trim(coalesce(entity_data ->> 'external_ref', '')), ''),
        coalesce(nullif(entity_data ->> 'status', ''), 'active')
      )
      on conflict (id) do update set
        season_id = excluded.season_id,
        division_id = excluded.division_id,
        parent_club_id = excluded.parent_club_id,
        home_venue_id = excluded.home_venue_id,
        name = excluded.name,
        short_name = excluded.short_name,
        external_ref = excluded.external_ref,
        status = excluded.status
      where public.league_teams.league_id = target_league_id;

    when 'blackout' then
      season_id := nullif(entity_data ->> 'season_id', '')::uuid;
      scope_id := nullif(entity_data ->> 'scope_id', '')::uuid;
      perform private.assert_league_reference(target_league_id, 'season', season_id);
      if coalesce(entity_data ->> 'scope_type', 'league') = 'league' then
        if scope_id is not null then raise exception 'Whole-league blackout dates cannot have a scope record' using errcode = '22023'; end if;
      elsif entity_data ->> 'scope_type' = 'division' then perform private.assert_league_reference(target_league_id, 'division', scope_id);
      elsif entity_data ->> 'scope_type' = 'club' then perform private.assert_league_reference(target_league_id, 'club', scope_id);
      elsif entity_data ->> 'scope_type' = 'team' then perform private.assert_league_reference(target_league_id, 'team', scope_id);
      elsif entity_data ->> 'scope_type' = 'venue' then perform private.assert_league_reference(target_league_id, 'venue', scope_id);
      else raise exception 'Unsupported blackout scope type' using errcode = '22023';
      end if;
      if coalesce(entity_data ->> 'scope_type', 'league') <> 'league' and scope_id is null then
        raise exception 'A blackout scope record is required' using errcode = '22023';
      end if;
      insert into public.league_blackout_dates (id, league_id, season_id, scope_type, scope_id, starts_on, ends_on, reason, source)
      values (
        entity_id, target_league_id, season_id,
        coalesce(nullif(entity_data ->> 'scope_type', ''), 'league'), scope_id,
        (entity_data ->> 'starts_on')::date,
        coalesce(nullif(entity_data ->> 'ends_on', ''), entity_data ->> 'starts_on')::date,
        trim(entity_data ->> 'reason'),
        coalesce(nullif(entity_data ->> 'source', ''), 'manual')
      )
      on conflict (id) do update set
        season_id = excluded.season_id,
        scope_type = excluded.scope_type,
        scope_id = excluded.scope_id,
        starts_on = excluded.starts_on,
        ends_on = excluded.ends_on,
        reason = excluded.reason,
        source = excluded.source
      where public.league_blackout_dates.league_id = target_league_id;

    when 'playing_date' then
      season_id := nullif(entity_data ->> 'season_id', '')::uuid;
      division_id := nullif(entity_data ->> 'division_id', '')::uuid;
      perform private.assert_league_reference(target_league_id, 'season', season_id);
      perform private.assert_league_reference(target_league_id, 'division', division_id);
      if division_id is not null and not exists (
        select 1 from public.league_divisions division_row
        where division_row.id = division_id
          and division_row.season_id = nullif(entity_data ->> 'season_id', '')::uuid
      ) then
        raise exception 'The selected division does not belong to the selected season' using errcode = '23503';
      end if;
      insert into public.league_playing_dates (
        id, league_id, season_id, division_id, playing_date, default_kick_off, status, notes
      ) values (
        entity_id, target_league_id, season_id, division_id,
        (entity_data ->> 'playing_date')::date,
        nullif(entity_data ->> 'default_kick_off', '')::time,
        coalesce(nullif(entity_data ->> 'status', ''), 'available'),
        nullif(trim(coalesce(entity_data ->> 'notes', '')), '')
      )
      on conflict (id) do update set
        season_id = excluded.season_id,
        division_id = excluded.division_id,
        playing_date = excluded.playing_date,
        default_kick_off = excluded.default_kick_off,
        status = excluded.status,
        notes = excluded.notes
      where public.league_playing_dates.league_id = target_league_id;

    when 'fixture' then
      season_id := nullif(entity_data ->> 'season_id', '')::uuid;
      division_id := nullif(entity_data ->> 'division_id', '')::uuid;
      home_team_id := nullif(entity_data ->> 'home_team_id', '')::uuid;
      away_team_id := nullif(entity_data ->> 'away_team_id', '')::uuid;
      venue_id := nullif(entity_data ->> 'venue_id', '')::uuid;
      perform private.assert_league_reference(target_league_id, 'season', season_id);
      perform private.assert_league_reference(target_league_id, 'division', division_id);
      perform private.assert_league_reference(target_league_id, 'team', home_team_id);
      perform private.assert_league_reference(target_league_id, 'team', away_team_id);
      perform private.assert_league_reference(target_league_id, 'venue', venue_id);
      if not exists (
        select 1
        from public.league_teams home_team
        join public.league_teams away_team on away_team.id = away_team_id
        where home_team.id = home_team_id
          and home_team.season_id = nullif(entity_data ->> 'season_id', '')::uuid
          and away_team.season_id = nullif(entity_data ->> 'season_id', '')::uuid
          and (
            nullif(entity_data ->> 'division_id', '')::uuid is null
            or (
              home_team.division_id = nullif(entity_data ->> 'division_id', '')::uuid
              and away_team.division_id = nullif(entity_data ->> 'division_id', '')::uuid
            )
          )
      ) then
        raise exception 'Fixture teams must belong to the selected season and division' using errcode = '23503';
      end if;
      insert into public.league_fixtures (
        id, league_id, season_id, division_id, home_team_id, away_team_id, venue_id,
        scheduled_date, kick_off, status, locked, source, external_ref, notes
      ) values (
        entity_id, target_league_id, season_id, division_id, home_team_id, away_team_id, venue_id,
        nullif(entity_data ->> 'scheduled_date', '')::date,
        nullif(entity_data ->> 'kick_off', '')::time,
        coalesce(nullif(entity_data ->> 'status', ''), 'draft'),
        coalesce((entity_data ->> 'locked')::boolean, false),
        coalesce(nullif(entity_data ->> 'source', ''), 'manual'),
        nullif(trim(coalesce(entity_data ->> 'external_ref', '')), ''),
        nullif(trim(coalesce(entity_data ->> 'notes', '')), '')
      )
      on conflict (id) do update set
        season_id = excluded.season_id,
        division_id = excluded.division_id,
        home_team_id = excluded.home_team_id,
        away_team_id = excluded.away_team_id,
        venue_id = excluded.venue_id,
        scheduled_date = excluded.scheduled_date,
        kick_off = excluded.kick_off,
        status = excluded.status,
        locked = excluded.locked,
        source = excluded.source,
        external_ref = excluded.external_ref,
        notes = excluded.notes
      where public.league_fixtures.league_id = target_league_id;

    else
      raise exception 'Unsupported league entity type: %', safe_type using errcode = '22023';
  end case;

  if not found then
    raise exception 'League entity does not belong to the selected workspace' using errcode = '42501';
  end if;

  perform private.write_league_audit(
    target_league_id,
    'league.' || safe_type || '_saved',
    safe_type,
    entity_id,
    jsonb_build_object('name', entity_data ->> 'name', 'status', entity_data ->> 'status')
  );

  return entity_id;
end;
$$;

create or replace function public.delete_league_entity(
  target_league_id uuid,
  entity_type text,
  target_entity_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  safe_type text := lower(trim(coalesce(entity_type, '')));
begin
  if safe_type in ('fixture', 'blackout', 'playing_date') then
    if not public.can_operate_league(target_league_id) then
      raise exception 'League fixture operation access required' using errcode = '42501';
    end if;
  elsif not public.can_manage_league(target_league_id) then
    raise exception 'League administrator access required' using errcode = '42501';
  end if;

  case safe_type
    when 'season' then delete from public.league_seasons where id = target_entity_id and league_id = target_league_id;
    when 'division' then delete from public.league_divisions where id = target_entity_id and league_id = target_league_id;
    when 'parent_club' then delete from public.league_parent_clubs where id = target_entity_id and league_id = target_league_id;
    when 'venue' then delete from public.league_venues where id = target_entity_id and league_id = target_league_id;
    when 'team' then delete from public.league_teams where id = target_entity_id and league_id = target_league_id;
    when 'blackout' then delete from public.league_blackout_dates where id = target_entity_id and league_id = target_league_id;
    when 'playing_date' then delete from public.league_playing_dates where id = target_entity_id and league_id = target_league_id;
    when 'fixture' then delete from public.league_fixtures where id = target_entity_id and league_id = target_league_id;
    else raise exception 'Unsupported league entity type: %', safe_type using errcode = '22023';
  end case;

  if not found then
    raise exception 'League entity was not found' using errcode = 'P0002';
  end if;

  perform private.write_league_audit(target_league_id, 'league.' || safe_type || '_deleted', safe_type, target_entity_id, '{}'::jsonb);
end;
$$;

create or replace function public.import_league_structure(
  target_league_id uuid,
  target_season_id uuid,
  structure_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  row_data jsonb;
  division_name text;
  club_name text;
  team_name text;
  venue_name text;
  division_record_id uuid;
  club_record_id uuid;
  venue_record_id uuid;
  team_record_id uuid;
  divisions_created integer := 0;
  clubs_created integer := 0;
  venues_created integer := 0;
  teams_created integer := 0;
  teams_updated integer := 0;
begin
  if not public.can_manage_league(target_league_id) then
    raise exception 'League administrator access required' using errcode = '42501';
  end if;
  if target_season_id is null then
    raise exception 'A season is required for the structure import' using errcode = '22023';
  end if;
  perform private.assert_league_reference(target_league_id, 'season', target_season_id);
  if structure_rows is null or jsonb_typeof(structure_rows) <> 'array' or jsonb_array_length(structure_rows) < 1 then
    raise exception 'At least one structure row is required' using errcode = '22023';
  end if;
  if jsonb_array_length(structure_rows) > 1000 then
    raise exception 'A maximum of 1000 structure rows can be imported at once' using errcode = '22023';
  end if;

  for row_data in select value from jsonb_array_elements(structure_rows)
  loop
    division_name := trim(coalesce(row_data ->> 'division', ''));
    club_name := trim(coalesce(row_data ->> 'parent_club', ''));
    team_name := trim(coalesce(row_data ->> 'team', ''));
    venue_name := trim(coalesce(row_data ->> 'home_venue', ''));

    if length(division_name) < 1 or length(club_name) < 2 or length(team_name) < 2 or length(venue_name) < 2 then
      raise exception 'Every structure row requires division, parent club, team and home venue' using errcode = '22023';
    end if;

    select division_row.id into division_record_id
    from public.league_divisions division_row
    where division_row.league_id = target_league_id
      and division_row.season_id = target_season_id
      and lower(division_row.name) = lower(division_name)
    limit 1;

    if division_record_id is null then
      insert into public.league_divisions (league_id, season_id, name, code, sort_order)
      values (
        target_league_id,
        target_season_id,
        division_name,
        nullif(trim(coalesce(row_data ->> 'division_code', '')), ''),
        (select count(*) from public.league_divisions existing where existing.season_id = target_season_id)
      ) returning id into division_record_id;
      divisions_created := divisions_created + 1;
    end if;

    select club_row.id into club_record_id
    from public.league_parent_clubs club_row
    where club_row.league_id = target_league_id
      and lower(club_row.name) = lower(club_name)
    limit 1;

    if club_record_id is null then
      insert into public.league_parent_clubs (league_id, name, short_name, external_ref, status)
      values (
        target_league_id,
        club_name,
        nullif(trim(coalesce(row_data ->> 'club_short_name', '')), ''),
        nullif(trim(coalesce(row_data ->> 'club_external_ref', '')), ''),
        'active'
      ) returning id into club_record_id;
      clubs_created := clubs_created + 1;
    end if;

    select venue_row.id into venue_record_id
    from public.league_venues venue_row
    where venue_row.league_id = target_league_id
      and lower(venue_row.name) = lower(venue_name)
    limit 1;

    if venue_record_id is null then
      insert into public.league_venues (
        league_id, parent_club_id, name, address, postcode, surface, ground_share_key, status
      ) values (
        target_league_id,
        club_record_id,
        venue_name,
        nullif(trim(coalesce(row_data ->> 'address', '')), ''),
        nullif(upper(trim(coalesce(row_data ->> 'postcode', ''))), ''),
        nullif(trim(coalesce(row_data ->> 'surface', '')), ''),
        nullif(trim(coalesce(row_data ->> 'ground_share_key', '')), ''),
        'active'
      ) returning id into venue_record_id;
      venues_created := venues_created + 1;
    else
      update public.league_venues
      set
        parent_club_id = coalesce(parent_club_id, club_record_id),
        address = coalesce(address, nullif(trim(coalesce(row_data ->> 'address', '')), '')),
        postcode = coalesce(postcode, nullif(upper(trim(coalesce(row_data ->> 'postcode', ''))), '')),
        surface = coalesce(surface, nullif(trim(coalesce(row_data ->> 'surface', '')), '')),
        ground_share_key = coalesce(ground_share_key, nullif(trim(coalesce(row_data ->> 'ground_share_key', '')), ''))
      where id = venue_record_id and league_id = target_league_id;
    end if;

    select team_row.id into team_record_id
    from public.league_teams team_row
    where team_row.league_id = target_league_id
      and team_row.season_id = target_season_id
      and lower(team_row.name) = lower(team_name)
    limit 1;

    if team_record_id is null then
      insert into public.league_teams (
        league_id, season_id, division_id, parent_club_id, home_venue_id,
        name, short_name, external_ref, status
      ) values (
        target_league_id,
        target_season_id,
        division_record_id,
        club_record_id,
        venue_record_id,
        team_name,
        nullif(trim(coalesce(row_data ->> 'team_short_name', '')), ''),
        nullif(trim(coalesce(row_data ->> 'team_external_ref', '')), ''),
        'active'
      ) returning id into team_record_id;
      teams_created := teams_created + 1;
    else
      update public.league_teams
      set
        division_id = division_record_id,
        parent_club_id = club_record_id,
        home_venue_id = venue_record_id,
        short_name = coalesce(nullif(trim(coalesce(row_data ->> 'team_short_name', '')), ''), short_name),
        external_ref = coalesce(nullif(trim(coalesce(row_data ->> 'team_external_ref', '')), ''), external_ref),
        status = 'active'
      where id = team_record_id and league_id = target_league_id;
      teams_updated := teams_updated + 1;
    end if;
  end loop;

  perform private.write_league_audit(
    target_league_id,
    'league.structure_imported',
    'structure_import',
    null,
    jsonb_build_object(
      'rows', jsonb_array_length(structure_rows),
      'season_id', target_season_id,
      'divisions_created', divisions_created,
      'clubs_created', clubs_created,
      'venues_created', venues_created,
      'teams_created', teams_created,
      'teams_updated', teams_updated
    )
  );

  return jsonb_build_object(
    'rows', jsonb_array_length(structure_rows),
    'divisions_created', divisions_created,
    'clubs_created', clubs_created,
    'venues_created', venues_created,
    'teams_created', teams_created,
    'teams_updated', teams_updated
  );
end;
$$;

create or replace function public.import_league_fixtures(
  target_league_id uuid,
  fixture_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  row_data jsonb;
  imported integer := 0;
begin
  if not public.can_operate_league(target_league_id) then
    raise exception 'League fixture operation access required' using errcode = '42501';
  end if;
  if fixture_rows is null or jsonb_typeof(fixture_rows) <> 'array' or jsonb_array_length(fixture_rows) < 1 then
    raise exception 'At least one fixture row is required' using errcode = '22023';
  end if;
  if jsonb_array_length(fixture_rows) > 2000 then
    raise exception 'A maximum of 2000 fixtures can be imported at once' using errcode = '22023';
  end if;

  for row_data in select value from jsonb_array_elements(fixture_rows)
  loop
    perform public.upsert_league_entity(target_league_id, 'fixture', row_data || jsonb_build_object('source', 'csv'));
    imported := imported + 1;
  end loop;

  perform private.write_league_audit(
    target_league_id,
    'league.fixture_import_completed',
    'fixture_import',
    null,
    jsonb_build_object('fixtures', imported)
  );
  return jsonb_build_object('fixtures', imported);
end;
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
  if not public.can_manage_league(target_league_id) then
    raise exception 'League administrator access required' using errcode = '42501';
  end if;
  if position('@' in safe_email) <= 1 then
    raise exception 'A valid email address is required' using errcode = '22023';
  end if;
  if safe_role not in ('admin', 'fixtures', 'viewer') then
    raise exception 'Invalid league role' using errcode = '22023';
  end if;

  update public.league_invitations
  set status = 'revoked', revoked_at = now(), updated_at = now()
  where league_id = target_league_id and lower(email) = safe_email and status = 'pending';

  invitation_expiry := now() + make_interval(hours => greatest(1, least(coalesce(expiry_hours, 168), 720)));
  insert into public.league_invitations (
    league_id, email, role, token_hash, status, invited_by, expires_at
  ) values (
    target_league_id, safe_email, safe_role, encode(digest(raw_token, 'sha256'), 'hex'), 'pending', actor_id, invitation_expiry
  ) returning id into invitation_id;

  perform private.write_league_audit(target_league_id, 'league.invitation_created', 'invitation', invitation_id, jsonb_build_object('email', safe_email, 'role', safe_role));

  return jsonb_build_object('id', invitation_id, 'token', raw_token, 'email', safe_email, 'role', safe_role, 'expires_at', invitation_expiry);
end;
$$;

create or replace function public.accept_league_invitation(invitation_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  actor_email text;
  invitation public.league_invitations%rowtype;
begin
  if actor_id is null then
    raise exception 'Sign in to accept the league invitation' using errcode = '42501';
  end if;
  select lower(email) into actor_email from public.user_profiles where id = actor_id;
  if actor_email is null then
    raise exception 'Your account email could not be verified' using errcode = '42501';
  end if;

  select * into invitation
  from public.league_invitations row_value
  where row_value.token_hash = encode(digest(trim(coalesce(invitation_token, '')), 'sha256'), 'hex')
  for update;

  if invitation.id is null or invitation.status <> 'pending' or invitation.expires_at <= now() then
    raise exception 'This league invitation is invalid or has expired' using errcode = '42501';
  end if;
  if lower(invitation.email) <> actor_email then
    raise exception 'This invitation was issued to a different email address' using errcode = '42501';
  end if;

  insert into public.league_memberships (league_id, user_id, role, status, created_by)
  values (invitation.league_id, actor_id, invitation.role, 'active', invitation.invited_by)
  on conflict (league_id, user_id) do update
  set role = excluded.role, status = 'active', updated_at = now();

  update public.league_invitations
  set status = 'accepted', accepted_by = actor_id, accepted_at = now(), updated_at = now()
  where id = invitation.id;

  perform private.write_league_audit(invitation.league_id, 'league.invitation_accepted', 'invitation', invitation.id, jsonb_build_object('role', invitation.role));
  return invitation.league_id;
end;
$$;

create or replace function public.revoke_league_invitation(target_league_id uuid, invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.can_manage_league(target_league_id) then
    raise exception 'League administrator access required' using errcode = '42501';
  end if;
  update public.league_invitations
  set status = 'revoked', revoked_at = now(), updated_at = now()
  where id = invitation_id and league_id = target_league_id and status = 'pending';
  if not found then raise exception 'Pending invitation not found' using errcode = 'P0002'; end if;
  perform private.write_league_audit(target_league_id, 'league.invitation_revoked', 'invitation', invitation_id, '{}'::jsonb);
end;
$$;

create or replace function public.update_league_member_role(
  target_league_id uuid,
  target_user_id uuid,
  next_role text
)
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
  if not public.can_manage_league(target_league_id) then
    raise exception 'League administrator access required' using errcode = '42501';
  end if;
  if safe_role not in ('admin', 'fixtures', 'viewer') then
    raise exception 'Invalid league role' using errcode = '22023';
  end if;
  select role into target_current_role from public.league_memberships where league_id = target_league_id and user_id = target_user_id and status = 'active';
  if target_current_role is null then raise exception 'League member not found' using errcode = 'P0002'; end if;
  if target_current_role = 'owner' then raise exception 'The league owner role cannot be changed here' using errcode = '42501'; end if;
  update public.league_memberships set role = safe_role, updated_at = now() where league_id = target_league_id and user_id = target_user_id;
  perform private.write_league_audit(target_league_id, 'league.member_role_changed', 'member', target_user_id, jsonb_build_object('role', safe_role));
end;
$$;

create or replace function public.remove_league_member(target_league_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_current_role text;
begin
  if not public.can_manage_league(target_league_id) then
    raise exception 'League administrator access required' using errcode = '42501';
  end if;
  select role into target_current_role from public.league_memberships where league_id = target_league_id and user_id = target_user_id and status = 'active';
  if target_current_role is null then raise exception 'League member not found' using errcode = 'P0002'; end if;
  if target_current_role = 'owner' then raise exception 'The league owner cannot be removed' using errcode = '42501'; end if;
  update public.league_memberships set status = 'revoked', updated_at = now() where league_id = target_league_id and user_id = target_user_id;
  perform private.write_league_audit(target_league_id, 'league.member_removed', 'member', target_user_id, '{}'::jsonb);
end;
$$;

revoke all on function public.can_view_league(uuid) from public, anon;
revoke all on function public.can_manage_league(uuid) from public, anon;
revoke all on function public.can_operate_league(uuid) from public, anon;
revoke all on function public.list_accessible_leagues() from public, anon;
revoke all on function public.platform_create_league_pilot(text, text, text, text, text, date, date) from public, anon;
revoke all on function public.get_league_workspace(uuid) from public, anon;
revoke all on function public.upsert_league_entity(uuid, text, jsonb) from public, anon;
revoke all on function public.delete_league_entity(uuid, text, uuid) from public, anon;
revoke all on function public.import_league_structure(uuid, uuid, jsonb) from public, anon;
revoke all on function public.import_league_fixtures(uuid, jsonb) from public, anon;
revoke all on function public.create_league_invitation(uuid, text, text, integer) from public, anon;
revoke all on function public.accept_league_invitation(text) from public, anon;
revoke all on function public.revoke_league_invitation(uuid, uuid) from public, anon;
revoke all on function public.update_league_member_role(uuid, uuid, text) from public, anon;
revoke all on function public.remove_league_member(uuid, uuid) from public, anon;

grant execute on function public.can_view_league(uuid) to authenticated;
grant execute on function public.can_manage_league(uuid) to authenticated;
grant execute on function public.can_operate_league(uuid) to authenticated;
grant execute on function public.list_accessible_leagues() to authenticated;
grant execute on function public.platform_create_league_pilot(text, text, text, text, text, date, date) to authenticated;
grant execute on function public.get_league_workspace(uuid) to authenticated;
grant execute on function public.upsert_league_entity(uuid, text, jsonb) to authenticated;
grant execute on function public.delete_league_entity(uuid, text, uuid) to authenticated;
grant execute on function public.import_league_structure(uuid, uuid, jsonb) to authenticated;
grant execute on function public.import_league_fixtures(uuid, jsonb) to authenticated;
grant execute on function public.create_league_invitation(uuid, text, text, integer) to authenticated;
grant execute on function public.accept_league_invitation(text) to authenticated;
grant execute on function public.revoke_league_invitation(uuid, uuid) to authenticated;
grant execute on function public.update_league_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_league_member(uuid, uuid) to authenticated;

commit;
