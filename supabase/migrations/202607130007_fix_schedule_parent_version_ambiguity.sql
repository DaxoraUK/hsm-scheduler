-- Daxora League Manager: schedule draft parent-version ambiguity fix.
-- Keeps the public RPC argument name stable while copying it into a uniquely
-- named PL/pgSQL variable before any SQL statement can confuse it with the
-- league_schedule_versions.parent_version_id column.

begin;

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
  safe_parent_version_id uuid := parent_version_id;
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
  if safe_parent_version_id is not null and not exists (
    select 1 from public.league_schedule_versions version_row
    where version_row.id = safe_parent_version_id
      and version_row.league_id = target_league_id
      and version_row.season_id = target_season_id
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
    safe_parent_version_id,
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

revoke all on function public.save_league_schedule_draft(uuid, uuid, text, jsonb, jsonb, uuid, text) from public, anon;
grant execute on function public.save_league_schedule_draft(uuid, uuid, text, jsonb, jsonb, uuid, text) to authenticated;

commit;
