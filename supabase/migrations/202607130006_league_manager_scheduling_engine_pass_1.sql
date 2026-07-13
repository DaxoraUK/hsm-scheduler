-- Daxora League Manager: scheduling engine pass 1.
-- Adds versioned draft schedules, atomic persistence, server validation,
-- publication, rollback-as-new-draft and venue simultaneous-fixture limits.

begin;

alter table public.league_venues
  add column if not exists simultaneous_fixture_limit integer not null default 1
  check (simultaneous_fixture_limit between 1 and 20);

create table if not exists public.league_schedule_versions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid not null references public.league_seasons(id) on delete restrict,
  parent_version_id uuid references public.league_schedule_versions(id) on delete set null,
  version_number integer not null,
  name text not null check (length(trim(name)) between 2 and 160),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  source text not null default 'generated' check (source in ('generated', 'restored', 'manual')),
  generation_config jsonb not null default '{}'::jsonb,
  validation_summary jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, season_id, version_number)
);

create table if not exists public.league_schedule_entries (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.league_schedule_versions(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid not null references public.league_seasons(id) on delete restrict,
  division_id uuid not null references public.league_divisions(id) on delete restrict,
  source_fixture_id uuid references public.league_fixtures(id) on delete set null,
  home_team_id uuid not null references public.league_teams(id) on delete restrict,
  away_team_id uuid not null references public.league_teams(id) on delete restrict,
  venue_id uuid references public.league_venues(id) on delete restrict,
  scheduled_date date,
  kick_off time,
  round_number integer not null default 0 check (round_number >= 0),
  placement_status text not null default 'unplaced' check (placement_status in ('placed', 'unplaced')),
  locked boolean not null default false,
  unresolved_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_team_id <> away_team_id),
  check ((placement_status = 'placed' and scheduled_date is not null) or (placement_status = 'unplaced' and scheduled_date is null)),
  unique (version_id, home_team_id, away_team_id)
);

alter table public.league_fixtures
  add column if not exists schedule_version_id uuid references public.league_schedule_versions(id) on delete set null;

create index if not exists league_schedule_versions_lookup_idx
  on public.league_schedule_versions(league_id, season_id, version_number desc);
create unique index if not exists league_schedule_one_published_idx
  on public.league_schedule_versions(league_id, season_id)
  where status = 'published';
create index if not exists league_schedule_entries_version_idx
  on public.league_schedule_entries(version_id, scheduled_date, kick_off, round_number);
create index if not exists league_schedule_entries_team_date_idx
  on public.league_schedule_entries(league_id, season_id, scheduled_date, home_team_id, away_team_id);
create index if not exists league_fixtures_schedule_version_idx
  on public.league_fixtures(schedule_version_id)
  where schedule_version_id is not null;

alter table public.league_schedule_versions enable row level security;
alter table public.league_schedule_versions force row level security;
alter table public.league_schedule_entries enable row level security;
alter table public.league_schedule_entries force row level security;

revoke all on table public.league_schedule_versions from anon, authenticated;
revoke all on table public.league_schedule_entries from anon, authenticated;

create policy league_schedule_versions_read on public.league_schedule_versions
  for select to authenticated
  using (public.can_view_league(league_id));
create policy league_schedule_versions_write on public.league_schedule_versions
  for all to authenticated
  using (public.can_operate_league(league_id))
  with check (public.can_operate_league(league_id));
create policy league_schedule_entries_read on public.league_schedule_entries
  for select to authenticated
  using (public.can_view_league(league_id));
create policy league_schedule_entries_write on public.league_schedule_entries
  for all to authenticated
  using (public.can_operate_league(league_id))
  with check (public.can_operate_league(league_id));

create or replace function public.set_league_venue_scheduling_capacity(
  target_league_id uuid,
  target_venue_id uuid,
  simultaneous_limit integer
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.can_manage_league(target_league_id) then
    raise exception 'League management access required' using errcode = '42501';
  end if;
  if coalesce(simultaneous_limit, 0) < 1 or simultaneous_limit > 20 then
    raise exception 'Simultaneous fixture limit must be between 1 and 20' using errcode = '22023';
  end if;

  update public.league_venues
  set simultaneous_fixture_limit = simultaneous_limit, updated_at = now()
  where id = target_venue_id and league_id = target_league_id;

  if not found then
    raise exception 'League venue not found' using errcode = 'P0002';
  end if;

  perform private.write_league_audit(
    target_league_id,
    'league.venue_scheduling_capacity_updated',
    'venue',
    target_venue_id,
    jsonb_build_object('simultaneous_fixture_limit', simultaneous_limit)
  );
end;
$$;

create or replace function public.list_league_schedule_versions(
  target_league_id uuid,
  target_season_id uuid default null
)
returns table (
  id uuid,
  league_id uuid,
  season_id uuid,
  parent_version_id uuid,
  version_number integer,
  name text,
  status text,
  source text,
  generation_config jsonb,
  validation_summary jsonb,
  created_by_label text,
  published_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.can_view_league(target_league_id) then
    raise exception 'League workspace access denied' using errcode = '42501';
  end if;

  return query
  select
    version.id,
    version.league_id,
    version.season_id,
    version.parent_version_id,
    version.version_number,
    version.name,
    version.status,
    version.source,
    version.generation_config,
    version.validation_summary,
    coalesce(profile.display_name, profile.email, 'League operator') as created_by_label,
    version.published_at,
    version.created_at,
    version.updated_at
  from public.league_schedule_versions version
  left join public.user_profiles profile on profile.id = version.created_by
  where version.league_id = target_league_id
    and (target_season_id is null or version.season_id = target_season_id)
  order by case version.status when 'published' then 0 when 'draft' then 1 else 2 end,
           version.version_number desc;
end;
$$;

create or replace function public.get_league_schedule_version(
  target_league_id uuid,
  target_version_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  result jsonb;
begin
  if not public.can_view_league(target_league_id) then
    raise exception 'League workspace access denied' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'version', jsonb_build_object(
      'id', version.id,
      'league_id', version.league_id,
      'season_id', version.season_id,
      'parent_version_id', version.parent_version_id,
      'version_number', version.version_number,
      'name', version.name,
      'status', version.status,
      'source', version.source,
      'generation_config', version.generation_config,
      'validation_summary', version.validation_summary,
      'published_at', version.published_at,
      'created_at', version.created_at,
      'updated_at', version.updated_at
    ),
    'entries', coalesce((
      select jsonb_agg(to_jsonb(entry) order by entry.round_number, entry.scheduled_date nulls last, entry.kick_off nulls last, entry.created_at)
      from public.league_schedule_entries entry
      where entry.version_id = version.id
    ), '[]'::jsonb)
  ) into result
  from public.league_schedule_versions version
  where version.id = target_version_id and version.league_id = target_league_id;

  if result is null then
    raise exception 'Schedule version not found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

create or replace function public.save_league_schedule_draft(
  target_league_id uuid,
  target_season_id uuid,
  draft_name text,
  generation_config jsonb,
  schedule_entries jsonb,
  parent_version_id uuid default null,
  draft_source text default 'generated'
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  next_version_number integer;
  new_version_id uuid;
  entry_data jsonb;
  division_id uuid;
  home_team_id uuid;
  away_team_id uuid;
  venue_id uuid;
  source_fixture_id uuid;
  scheduled_date date;
  kick_off time;
  safe_source text := lower(trim(coalesce(draft_source, 'generated')));
  entry_count integer;
begin
  if not public.can_operate_league(target_league_id) then
    raise exception 'League fixture access required' using errcode = '42501';
  end if;
  perform private.assert_league_reference(target_league_id, 'season', target_season_id);

  if length(trim(coalesce(draft_name, ''))) < 2 then
    raise exception 'Schedule version name is required' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(schedule_entries, '[]'::jsonb)) <> 'array' then
    raise exception 'Schedule entries must be an array' using errcode = '22023';
  end if;
  entry_count := jsonb_array_length(coalesce(schedule_entries, '[]'::jsonb));
  if entry_count < 1 or entry_count > 5000 then
    raise exception 'A schedule draft must contain between 1 and 5000 fixtures' using errcode = '22023';
  end if;
  if safe_source not in ('generated', 'restored', 'manual') then
    raise exception 'Unsupported schedule source' using errcode = '22023';
  end if;
  if parent_version_id is not null and not exists (
    select 1 from public.league_schedule_versions
    where id = parent_version_id and league_id = target_league_id and season_id = target_season_id
  ) then
    raise exception 'Parent schedule version does not belong to this league season' using errcode = '23503';
  end if;

  perform pg_advisory_xact_lock(hashtext(target_league_id::text || ':' || target_season_id::text));
  select coalesce(max(version_number), 0) + 1 into next_version_number
  from public.league_schedule_versions
  where league_id = target_league_id and season_id = target_season_id;

  insert into public.league_schedule_versions (
    league_id, season_id, parent_version_id, version_number, name, status, source,
    generation_config, validation_summary, created_by
  ) values (
    target_league_id,
    target_season_id,
    parent_version_id,
    next_version_number,
    trim(draft_name),
    'draft',
    safe_source,
    coalesce(generation_config, '{}'::jsonb),
    '{}'::jsonb,
    actor_id
  ) returning id into new_version_id;

  for entry_data in select value from jsonb_array_elements(schedule_entries)
  loop
    division_id := nullif(entry_data ->> 'division_id', '')::uuid;
    home_team_id := nullif(entry_data ->> 'home_team_id', '')::uuid;
    away_team_id := nullif(entry_data ->> 'away_team_id', '')::uuid;
    venue_id := nullif(entry_data ->> 'venue_id', '')::uuid;
    source_fixture_id := nullif(entry_data ->> 'source_fixture_id', '')::uuid;
    scheduled_date := nullif(entry_data ->> 'scheduled_date', '')::date;
    kick_off := nullif(entry_data ->> 'kick_off', '')::time;

    perform private.assert_league_reference(target_league_id, 'division', division_id);
    perform private.assert_league_reference(target_league_id, 'team', home_team_id);
    perform private.assert_league_reference(target_league_id, 'team', away_team_id);
    perform private.assert_league_reference(target_league_id, 'venue', venue_id);

    if home_team_id = away_team_id then
      raise exception 'A team cannot play itself' using errcode = '23514';
    end if;
    if not exists (
      select 1
      from public.league_teams home_team
      join public.league_teams away_team on away_team.id = away_team_id
      join public.league_divisions division_row on division_row.id = division_id
      where home_team.id = home_team_id
        and home_team.league_id = target_league_id
        and away_team.league_id = target_league_id
        and division_row.league_id = target_league_id
        and home_team.season_id = target_season_id
        and away_team.season_id = target_season_id
        and division_row.season_id = target_season_id
        and home_team.division_id = division_id
        and away_team.division_id = division_id
    ) then
      raise exception 'Schedule teams and division must belong to the selected season' using errcode = '23503';
    end if;
    if source_fixture_id is not null and not exists (
      select 1 from public.league_fixtures
      where id = source_fixture_id and league_id = target_league_id and season_id = target_season_id
    ) then
      raise exception 'Source fixture does not belong to this league season' using errcode = '23503';
    end if;

    insert into public.league_schedule_entries (
      version_id, league_id, season_id, division_id, source_fixture_id,
      home_team_id, away_team_id, venue_id, scheduled_date, kick_off,
      round_number, placement_status, locked, unresolved_reason, notes
    ) values (
      new_version_id,
      target_league_id,
      target_season_id,
      division_id,
      source_fixture_id,
      home_team_id,
      away_team_id,
      venue_id,
      scheduled_date,
      kick_off,
      greatest(coalesce((entry_data ->> 'round_number')::integer, 0), 0),
      case when scheduled_date is null then 'unplaced' else 'placed' end,
      coalesce((entry_data ->> 'locked')::boolean, false),
      nullif(trim(coalesce(entry_data ->> 'unresolved_reason', '')), ''),
      nullif(trim(coalesce(entry_data ->> 'notes', '')), '')
    );
  end loop;

  perform private.write_league_audit(
    target_league_id,
    'league.schedule_draft_created',
    'schedule_version',
    new_version_id,
    jsonb_build_object('season_id', target_season_id, 'version_number', next_version_number, 'fixtures', entry_count, 'source', safe_source)
  );

  return new_version_id;
end;
$$;

create or replace function public.update_league_schedule_entry(
  target_league_id uuid,
  target_version_id uuid,
  target_entry_id uuid,
  next_scheduled_date date,
  next_kick_off time,
  next_venue_id uuid,
  next_locked boolean,
  next_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  version_status text;
begin
  if not public.can_operate_league(target_league_id) then
    raise exception 'League fixture access required' using errcode = '42501';
  end if;
  select status into version_status
  from public.league_schedule_versions
  where id = target_version_id and league_id = target_league_id;
  if version_status is null then
    raise exception 'Schedule version not found' using errcode = 'P0002';
  end if;
  if version_status <> 'draft' then
    raise exception 'Published or archived schedules cannot be edited' using errcode = '42501';
  end if;
  perform private.assert_league_reference(target_league_id, 'venue', next_venue_id);

  update public.league_schedule_entries
  set scheduled_date = next_scheduled_date,
      kick_off = case when next_scheduled_date is null then null else next_kick_off end,
      venue_id = next_venue_id,
      placement_status = case when next_scheduled_date is null then 'unplaced' else 'placed' end,
      locked = coalesce(next_locked, false),
      unresolved_reason = case when next_scheduled_date is null then coalesce(unresolved_reason, 'Manually unplaced for review.') else null end,
      notes = nullif(trim(coalesce(next_notes, '')), ''),
      updated_at = now()
  where id = target_entry_id and version_id = target_version_id and league_id = target_league_id;

  if not found then
    raise exception 'Schedule entry not found' using errcode = 'P0002';
  end if;

  update public.league_schedule_versions
  set validation_summary = '{}'::jsonb, updated_at = now()
  where id = target_version_id;

  perform private.write_league_audit(
    target_league_id,
    'league.schedule_entry_updated',
    'schedule_entry',
    target_entry_id,
    jsonb_build_object('version_id', target_version_id, 'scheduled_date', next_scheduled_date, 'kick_off', next_kick_off, 'venue_id', next_venue_id, 'locked', next_locked)
  );
end;
$$;

create or replace function private.league_schedule_validation(
  target_league_id uuid,
  target_version_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  result jsonb;
begin
  with version_row as (
    select *
    from public.league_schedule_versions
    where id = target_version_id and league_id = target_league_id
  ),
  entries as (
    select entry.*,
           home_team.parent_club_id as home_club_id,
           away_team.parent_club_id as away_club_id,
           coalesce(nullif(venue.ground_share_key, ''), 'venue:' || venue.id::text) as ground_key,
           greatest(coalesce(venue.simultaneous_fixture_limit, 1), 1) as venue_limit
    from public.league_schedule_entries entry
    join version_row version on version.id = entry.version_id
    join public.league_teams home_team on home_team.id = entry.home_team_id
    join public.league_teams away_team on away_team.id = entry.away_team_id
    left join public.league_venues venue on venue.id = entry.venue_id
  ),
  team_date_usage as (
    select entry.id, entry.scheduled_date, unnest(array[entry.home_team_id, entry.away_team_id]) as team_id
    from entries entry
    where entry.scheduled_date is not null
  ),
  issue_rows as (
    select
      'unplaced:' || entry.id::text as issue_id,
      'blocking'::text as severity,
      'unplaced-fixture'::text as code,
      'A required fixture is unplaced.'::text as message,
      jsonb_build_array(entry.id) as entry_ids
    from entries entry
    where entry.scheduled_date is null

    union all

    select
      'missing-venue:' || entry.id::text,
      'blocking',
      'missing-venue',
      'A placed fixture has no valid venue.',
      jsonb_build_array(entry.id)
    from entries entry
    where entry.scheduled_date is not null and entry.venue_id is null

    union all

    select
      'team-clash:' || usage.scheduled_date::text || ':' || usage.team_id::text,
      'blocking',
      'team-double-booking',
      'A team has more than one fixture on ' || usage.scheduled_date::text || '.',
      jsonb_agg(usage.id order by usage.id)
    from team_date_usage usage
    group by usage.scheduled_date, usage.team_id
    having count(*) > 1

    union all

    select
      'ground-clash:' || entry.scheduled_date::text || ':' || coalesce(entry.kick_off::text, '') || ':' || entry.ground_key,
      'blocking',
      'ground-capacity-conflict',
      'A venue or ground-share group exceeds its simultaneous fixture limit.',
      jsonb_agg(entry.id order by entry.id)
    from entries entry
    where entry.scheduled_date is not null and entry.venue_id is not null
    group by entry.scheduled_date, entry.kick_off, entry.ground_key
    having count(*) > max(entry.venue_limit)

    union all

    select
      'playing-date:' || entry.id::text,
      'blocking',
      'unavailable-playing-date',
      'A fixture uses a date that is not available for its division.',
      jsonb_build_array(entry.id)
    from entries entry
    where entry.scheduled_date is not null
      and not exists (
        select 1
        from public.league_playing_dates playing_date
        where playing_date.league_id = target_league_id
          and playing_date.season_id = entry.season_id
          and playing_date.status = 'available'
          and playing_date.playing_date = entry.scheduled_date
          and (playing_date.division_id is null or playing_date.division_id = entry.division_id)
      )

    union all

    select
      'blackout:' || entry.id::text || ':' || blackout.id::text,
      'blocking',
      'blackout-violation',
      'A fixture conflicts with blackout: ' || blackout.reason,
      jsonb_build_array(entry.id)
    from entries entry
    join public.league_blackout_dates blackout
      on blackout.league_id = target_league_id
     and (blackout.season_id is null or blackout.season_id = entry.season_id)
     and entry.scheduled_date between blackout.starts_on and blackout.ends_on
     and (
       blackout.scope_type = 'league'
       or (blackout.scope_type = 'division' and blackout.scope_id = entry.division_id)
       or (blackout.scope_type = 'team' and blackout.scope_id in (entry.home_team_id, entry.away_team_id))
       or (blackout.scope_type = 'club' and blackout.scope_id in (entry.home_club_id, entry.away_club_id))
       or (blackout.scope_type = 'venue' and blackout.scope_id = entry.venue_id)
     )

    union all

    select
      'matrix:' || division.id::text,
      'blocking',
      'fixture-matrix-incomplete',
      division.name || ' does not contain the required number of fixtures.',
      '[]'::jsonb
    from public.league_divisions division
    join version_row version on version.season_id = division.season_id
    cross join lateral (
      select count(*)::integer as team_count
      from public.league_teams team
      where team.division_id = division.id and team.season_id = version.season_id and team.status = 'active'
    ) team_totals
    cross join lateral (
      select count(*)::integer as fixture_count
      from entries entry
      where entry.division_id = division.id
    ) fixture_totals
    where division.league_id = target_league_id
      and (
        jsonb_array_length(coalesce(version.generation_config -> 'divisionIds', '[]'::jsonb)) = 0
        or division.id::text in (
          select jsonb_array_elements_text(coalesce(version.generation_config -> 'divisionIds', '[]'::jsonb))
        )
      )
      and (
        case when coalesce((version.generation_config ->> 'meetings')::integer, 2) = 1
          then team_totals.team_count * greatest(team_totals.team_count - 1, 0) / 2
          else team_totals.team_count * greatest(team_totals.team_count - 1, 0)
        end
      ) <> fixture_totals.fixture_count

    union all

    select
      'pair-duplicate:' || entry.division_id::text || ':' || least(entry.home_team_id::text, entry.away_team_id::text) || ':' || greatest(entry.home_team_id::text, entry.away_team_id::text),
      'blocking',
      'duplicate-pairing',
      'A single-meeting schedule contains the same team pairing more than once.',
      jsonb_agg(entry.id order by entry.id)
    from entries entry
    join version_row version on true
    where coalesce((version.generation_config ->> 'meetings')::integer, 2) = 1
    group by entry.division_id, least(entry.home_team_id::text, entry.away_team_id::text), greatest(entry.home_team_id::text, entry.away_team_id::text)
    having count(*) > 1
  )
  select jsonb_build_object(
    'valid', count(*) filter (where severity = 'blocking') = 0,
    'blockingCount', count(*) filter (where severity = 'blocking'),
    'warningCount', count(*) filter (where severity = 'warning'),
    'issues', coalesce(jsonb_agg(jsonb_build_object(
      'id', issue_id,
      'severity', severity,
      'code', code,
      'message', message,
      'entryIds', entry_ids
    ) order by severity, code, issue_id), '[]'::jsonb)
  ) into result
  from issue_rows;

  return coalesce(result, jsonb_build_object('valid', true, 'blockingCount', 0, 'warningCount', 0, 'issues', '[]'::jsonb));
end;
$$;

create or replace function public.validate_league_schedule_version(
  target_league_id uuid,
  target_version_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  result jsonb;
begin
  if not public.can_view_league(target_league_id) then
    raise exception 'League workspace access denied' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.league_schedule_versions
    where id = target_version_id and league_id = target_league_id
  ) then
    raise exception 'Schedule version not found' using errcode = 'P0002';
  end if;

  result := private.league_schedule_validation(target_league_id, target_version_id);
  update public.league_schedule_versions
  set validation_summary = result, updated_at = now()
  where id = target_version_id and league_id = target_league_id;
  return result;
end;
$$;

create or replace function public.publish_league_schedule_version(
  target_league_id uuid,
  target_version_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  version_row public.league_schedule_versions%rowtype;
  validation jsonb;
  entry public.league_schedule_entries%rowtype;
  existing_fixture_id uuid;
  published_count integer := 0;
begin
  if not public.can_operate_league(target_league_id) then
    raise exception 'League fixture access required' using errcode = '42501';
  end if;

  select * into version_row
  from public.league_schedule_versions
  where id = target_version_id and league_id = target_league_id
  for update;
  if version_row.id is null then
    raise exception 'Schedule version not found' using errcode = 'P0002';
  end if;
  if version_row.status <> 'draft' then
    raise exception 'Only a draft schedule can be published' using errcode = '42501';
  end if;

  validation := private.league_schedule_validation(target_league_id, target_version_id);
  if not coalesce((validation ->> 'valid')::boolean, false) then
    raise exception 'Schedule has % blocking validation issue(s)', coalesce((validation ->> 'blockingCount')::integer, 0) using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtext(target_league_id::text || ':' || version_row.season_id::text));

  update public.league_schedule_versions
  set status = 'archived', updated_at = now()
  where league_id = target_league_id and season_id = version_row.season_id and status = 'published' and id <> target_version_id;

  delete from public.league_fixtures
  where league_id = target_league_id
    and season_id = version_row.season_id
    and source = 'generated'
    and coalesce(schedule_version_id, '00000000-0000-0000-0000-000000000000'::uuid) <> target_version_id;

  for entry in
    select * from public.league_schedule_entries
    where version_id = target_version_id and placement_status = 'placed'
    order by round_number, scheduled_date, kick_off
  loop
    existing_fixture_id := null;
    if entry.source_fixture_id is not null then
      select id into existing_fixture_id
      from public.league_fixtures
      where id = entry.source_fixture_id and league_id = target_league_id and season_id = version_row.season_id;
    end if;
    if existing_fixture_id is null then
      select id into existing_fixture_id
      from public.league_fixtures
      where league_id = target_league_id
        and season_id = version_row.season_id
        and home_team_id = entry.home_team_id
        and away_team_id = entry.away_team_id
      order by locked desc, created_at
      limit 1;
    end if;

    if existing_fixture_id is null then
      insert into public.league_fixtures (
        league_id, season_id, division_id, home_team_id, away_team_id, venue_id,
        scheduled_date, kick_off, status, locked, source, external_ref, notes, schedule_version_id
      ) values (
        target_league_id, version_row.season_id, entry.division_id, entry.home_team_id, entry.away_team_id, entry.venue_id,
        entry.scheduled_date, entry.kick_off, 'scheduled', entry.locked, 'generated', 'LM-' || entry.id::text, entry.notes, target_version_id
      );
    else
      update public.league_fixtures
      set division_id = entry.division_id,
          venue_id = entry.venue_id,
          scheduled_date = entry.scheduled_date,
          kick_off = entry.kick_off,
          status = 'scheduled',
          locked = entry.locked,
          notes = coalesce(entry.notes, notes),
          schedule_version_id = target_version_id,
          updated_at = now()
      where id = existing_fixture_id;
    end if;
    published_count := published_count + 1;
  end loop;

  update public.league_schedule_versions
  set status = 'published',
      validation_summary = validation,
      published_by = actor_id,
      published_at = now(),
      updated_at = now()
  where id = target_version_id;

  perform private.write_league_audit(
    target_league_id,
    'league.schedule_published',
    'schedule_version',
    target_version_id,
    jsonb_build_object('season_id', version_row.season_id, 'version_number', version_row.version_number, 'fixtures', published_count)
  );

  return jsonb_build_object('version_id', target_version_id, 'fixtures', published_count, 'validation', validation);
end;
$$;

create or replace function public.clone_league_schedule_version(
  target_league_id uuid,
  source_version_id uuid,
  next_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  source_version public.league_schedule_versions%rowtype;
  next_number integer;
  new_version_id uuid;
begin
  if not public.can_operate_league(target_league_id) then
    raise exception 'League fixture access required' using errcode = '42501';
  end if;
  select * into source_version
  from public.league_schedule_versions
  where id = source_version_id and league_id = target_league_id;
  if source_version.id is null then
    raise exception 'Schedule version not found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtext(target_league_id::text || ':' || source_version.season_id::text));
  select coalesce(max(version_number), 0) + 1 into next_number
  from public.league_schedule_versions
  where league_id = target_league_id and season_id = source_version.season_id;

  insert into public.league_schedule_versions (
    league_id, season_id, parent_version_id, version_number, name, status, source,
    generation_config, validation_summary, created_by
  ) values (
    target_league_id,
    source_version.season_id,
    source_version.id,
    next_number,
    coalesce(nullif(trim(next_name), ''), source_version.name || ' restored'),
    'draft',
    'restored',
    source_version.generation_config,
    '{}'::jsonb,
    actor_id
  ) returning id into new_version_id;

  insert into public.league_schedule_entries (
    version_id, league_id, season_id, division_id, source_fixture_id,
    home_team_id, away_team_id, venue_id, scheduled_date, kick_off,
    round_number, placement_status, locked, unresolved_reason, notes
  )
  select
    new_version_id, league_id, season_id, division_id, source_fixture_id,
    home_team_id, away_team_id, venue_id, scheduled_date, kick_off,
    round_number, placement_status, locked, unresolved_reason, notes
  from public.league_schedule_entries
  where version_id = source_version_id;

  perform private.write_league_audit(
    target_league_id,
    'league.schedule_version_restored',
    'schedule_version',
    new_version_id,
    jsonb_build_object('source_version_id', source_version_id, 'version_number', next_number)
  );
  return new_version_id;
end;
$$;

create or replace function public.delete_league_schedule_version(
  target_league_id uuid,
  target_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  version_status text;
begin
  if not public.can_operate_league(target_league_id) then
    raise exception 'League fixture access required' using errcode = '42501';
  end if;
  select status into version_status
  from public.league_schedule_versions
  where id = target_version_id and league_id = target_league_id;
  if version_status is null then
    raise exception 'Schedule version not found' using errcode = 'P0002';
  end if;
  if version_status <> 'draft' then
    raise exception 'Published or archived schedule versions cannot be deleted' using errcode = '42501';
  end if;

  delete from public.league_schedule_versions
  where id = target_version_id and league_id = target_league_id;

  perform private.write_league_audit(
    target_league_id,
    'league.schedule_draft_deleted',
    'schedule_version',
    target_version_id,
    '{}'::jsonb
  );
end;
$$;

revoke all on function public.set_league_venue_scheduling_capacity(uuid, uuid, integer) from public, anon;
revoke all on function public.list_league_schedule_versions(uuid, uuid) from public, anon;
revoke all on function public.get_league_schedule_version(uuid, uuid) from public, anon;
revoke all on function public.save_league_schedule_draft(uuid, uuid, text, jsonb, jsonb, uuid, text) from public, anon;
revoke all on function public.update_league_schedule_entry(uuid, uuid, uuid, date, time, uuid, boolean, text) from public, anon;
revoke all on function public.validate_league_schedule_version(uuid, uuid) from public, anon;
revoke all on function public.publish_league_schedule_version(uuid, uuid) from public, anon;
revoke all on function public.clone_league_schedule_version(uuid, uuid, text) from public, anon;
revoke all on function public.delete_league_schedule_version(uuid, uuid) from public, anon;

grant execute on function public.set_league_venue_scheduling_capacity(uuid, uuid, integer) to authenticated;
grant execute on function public.list_league_schedule_versions(uuid, uuid) to authenticated;
grant execute on function public.get_league_schedule_version(uuid, uuid) to authenticated;
grant execute on function public.save_league_schedule_draft(uuid, uuid, text, jsonb, jsonb, uuid, text) to authenticated;
grant execute on function public.update_league_schedule_entry(uuid, uuid, uuid, date, time, uuid, boolean, text) to authenticated;
grant execute on function public.validate_league_schedule_version(uuid, uuid) to authenticated;
grant execute on function public.publish_league_schedule_version(uuid, uuid) to authenticated;
grant execute on function public.clone_league_schedule_version(uuid, uuid, text) to authenticated;
grant execute on function public.delete_league_schedule_version(uuid, uuid) to authenticated;

commit;
