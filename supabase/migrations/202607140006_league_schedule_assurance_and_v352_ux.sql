-- Daxora League Operations v3.5.2: real competition formats and server-enforced schedule assurance.
begin;

alter table public.league_divisions
  add column if not exists extra_home_rotation_offset integer not null default 0;

alter table public.league_divisions
  drop constraint if exists league_divisions_extra_home_rotation_offset_check;

alter table public.league_divisions
  add constraint league_divisions_extra_home_rotation_offset_check
  check (extra_home_rotation_offset in (0, 1));

create or replace function public.upsert_league_schedule_settings_entity(
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
  entity_id uuid := coalesce(nullif(entity_data ->> 'id', '')::uuid, gen_random_uuid());
  season_id uuid;
begin
  if not public.can_manage_league(target_league_id) then
    raise exception 'League administrator access required' using errcode = '42501';
  end if;
  if entity_data is null or jsonb_typeof(entity_data) <> 'object' then
    raise exception 'League entity data is required' using errcode = '22023';
  end if;

  if safe_type = 'season' then
    if nullif(entity_data ->> 'default_kick_off', '') is null then
      raise exception 'The league default kick-off is required' using errcode = '22023';
    end if;
    insert into public.league_seasons (
      id, league_id, name, starts_on, ends_on, status, is_current,
      default_kick_off, primary_weekday, max_consecutive_home_away
    ) values (
      entity_id, target_league_id, trim(entity_data ->> 'name'),
      nullif(entity_data ->> 'starts_on', '')::date,
      nullif(entity_data ->> 'ends_on', '')::date,
      coalesce(nullif(entity_data ->> 'status', ''), 'draft'),
      coalesce((entity_data ->> 'is_current')::boolean, false),
      nullif(entity_data ->> 'default_kick_off', '')::time,
      greatest(0, least(coalesce((entity_data ->> 'primary_weekday')::integer, 6), 6)),
      greatest(1, least(coalesce((entity_data ->> 'max_consecutive_home_away')::integer, 2), 6))
    )
    on conflict (id) do update set
      name = excluded.name,
      starts_on = excluded.starts_on,
      ends_on = excluded.ends_on,
      status = excluded.status,
      is_current = excluded.is_current,
      default_kick_off = excluded.default_kick_off,
      primary_weekday = excluded.primary_weekday,
      max_consecutive_home_away = excluded.max_consecutive_home_away,
      updated_at = now()
    where public.league_seasons.league_id = target_league_id;

    if coalesce((entity_data ->> 'is_current')::boolean, false) then
      update public.league_seasons
      set is_current = false, updated_at = now()
      where league_id = target_league_id and id <> entity_id and is_current;
    end if;
  elsif safe_type = 'division' then
    season_id := nullif(entity_data ->> 'season_id', '')::uuid;
    perform private.assert_league_reference(target_league_id, 'season', season_id);

    insert into public.league_divisions (
      id, league_id, season_id, name, code, sort_order, team_limit,
      starts_on, ends_on, meetings_per_pairing, default_kick_off,
      playing_weekday, max_consecutive_home_away, extra_home_rotation_offset,
      win_points, draw_points, loss_points, walkover_score
    ) values (
      entity_id, target_league_id, season_id, trim(entity_data ->> 'name'),
      nullif(trim(coalesce(entity_data ->> 'code', '')), ''),
      coalesce((entity_data ->> 'sort_order')::integer, 0),
      nullif(entity_data ->> 'team_limit', '')::integer,
      nullif(entity_data ->> 'starts_on', '')::date,
      nullif(entity_data ->> 'ends_on', '')::date,
      greatest(1, least(coalesce((entity_data ->> 'meetings_per_pairing')::integer, 2), 4)),
      nullif(entity_data ->> 'default_kick_off', '')::time,
      nullif(entity_data ->> 'playing_weekday', '')::integer,
      greatest(1, least(coalesce((entity_data ->> 'max_consecutive_home_away')::integer, 2), 6)),
      greatest(0, least(coalesce((entity_data ->> 'extra_home_rotation_offset')::integer, 0), 1)),
      greatest(0, least(coalesce((entity_data ->> 'win_points')::integer, 3), 10)),
      greatest(0, least(coalesce((entity_data ->> 'draw_points')::integer, 1), 10)),
      greatest(-10, least(coalesce((entity_data ->> 'loss_points')::integer, 0), 10)),
      greatest(1, least(coalesce((entity_data ->> 'walkover_score')::integer, 3), 20))
    )
    on conflict (id) do update set
      season_id = excluded.season_id,
      name = excluded.name,
      code = excluded.code,
      sort_order = excluded.sort_order,
      team_limit = excluded.team_limit,
      starts_on = excluded.starts_on,
      ends_on = excluded.ends_on,
      meetings_per_pairing = excluded.meetings_per_pairing,
      default_kick_off = excluded.default_kick_off,
      playing_weekday = excluded.playing_weekday,
      max_consecutive_home_away = excluded.max_consecutive_home_away,
      extra_home_rotation_offset = excluded.extra_home_rotation_offset,
      win_points = excluded.win_points,
      draw_points = excluded.draw_points,
      loss_points = excluded.loss_points,
      walkover_score = excluded.walkover_score,
      updated_at = now()
    where public.league_divisions.league_id = target_league_id;
  else
    raise exception 'Only season and division schedule settings are supported' using errcode = '22023';
  end if;

  perform private.write_league_audit(
    target_league_id,
    'league.' || safe_type || '_schedule_settings_saved',
    safe_type,
    entity_id,
    entity_data
  );
  return entity_id;
end;
$$;

create or replace function private.league_schedule_structure_assurance(
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
    select version.id, version.season_id
    from public.league_schedule_versions version
    where version.id = target_version_id and version.league_id = target_league_id
  ),
  divisions as (
    select division.id, division.name, division.season_id,
      greatest(1, least(coalesce(division.meetings_per_pairing, 2), 4))::integer as meetings
    from public.league_divisions division
    join version_row version on version.season_id = division.season_id
    where division.league_id = target_league_id
  ),
  active_teams as (
    select team.id, team.division_id, team.name
    from public.league_teams team
    join version_row version on version.season_id = team.season_id
    where team.league_id = target_league_id and team.status = 'active'
  ),
  entries as (
    select entry.*,
      least(entry.home_team_id::text, entry.away_team_id::text) as pair_low,
      greatest(entry.home_team_id::text, entry.away_team_id::text) as pair_high
    from public.league_schedule_entries entry
    where entry.league_id = target_league_id and entry.version_id = target_version_id
  ),
  expected_pairs as (
    select division.id as division_id, division.name as division_name, division.meetings,
      first_team.id as team_a_id, second_team.id as team_b_id,
      first_team.name as team_a_name, second_team.name as team_b_name,
      least(first_team.id::text, second_team.id::text) as pair_low,
      greatest(first_team.id::text, second_team.id::text) as pair_high
    from divisions division
    join active_teams first_team on first_team.division_id = division.id
    join active_teams second_team on second_team.division_id = division.id and first_team.id::text < second_team.id::text
  ),
  pair_counts as (
    select entry.division_id, entry.pair_low, entry.pair_high,
      count(*)::integer as fixture_count,
      count(*) filter (where entry.home_team_id::text = entry.pair_low)::integer as low_team_home_count,
      count(*) filter (where entry.home_team_id::text = entry.pair_high)::integer as high_team_home_count,
      count(distinct entry.meeting_number)::integer as distinct_meeting_count,
      coalesce(jsonb_agg(entry.id order by entry.meeting_number, entry.id), '[]'::jsonb) as entry_ids
    from entries entry
    group by entry.division_id, entry.pair_low, entry.pair_high
  ),
  expected_team_totals as (
    select team.id as team_id, team.name as team_name, division.id as division_id,
      division.name as division_name, division.meetings,
      greatest((count(other_team.id) * division.meetings), 0)::integer as expected_fixtures
    from active_teams team
    join divisions division on division.id = team.division_id
    left join active_teams other_team on other_team.division_id = team.division_id and other_team.id <> team.id
    group by team.id, team.name, division.id, division.name, division.meetings
  ),
  actual_team_totals as (
    select team.id as team_id,
      count(entry.id)::integer as fixture_count,
      count(entry.id) filter (where entry.home_team_id = team.id)::integer as home_count,
      count(entry.id) filter (where entry.away_team_id = team.id)::integer as away_count,
      coalesce(jsonb_agg(entry.id order by entry.round_number, entry.id) filter (where entry.id is not null), '[]'::jsonb) as entry_ids
    from active_teams team
    left join entries entry on entry.home_team_id = team.id or entry.away_team_id = team.id
    group by team.id
  ),
  duplicate_meetings as (
    select entry.division_id, entry.pair_low, entry.pair_high, entry.meeting_number,
      count(*)::integer as duplicate_count,
      jsonb_agg(entry.id order by entry.id) as entry_ids
    from entries entry
    group by entry.division_id, entry.pair_low, entry.pair_high, entry.meeting_number
    having count(*) > 1
  ),
  issue_rows as (
    select
      'pair-total:' || expected_pair.division_id::text || ':' || expected_pair.pair_low || ':' || expected_pair.pair_high as issue_id,
      'blocking'::text as severity,
      'pairing-meeting-count-mismatch'::text as code,
      expected_pair.division_name || ': ' || expected_pair.team_a_name || ' v ' || expected_pair.team_b_name || ' requires ' || expected_pair.meetings::text || ' meetings but the draft contains ' || coalesce(pair_count.fixture_count, 0)::text || '.' as message,
      coalesce(pair_count.entry_ids, '[]'::jsonb) as entry_ids
    from expected_pairs expected_pair
    left join pair_counts pair_count
      on pair_count.division_id = expected_pair.division_id
      and pair_count.pair_low = expected_pair.pair_low
      and pair_count.pair_high = expected_pair.pair_high
    where coalesce(pair_count.fixture_count, 0) <> expected_pair.meetings

    union all

    select
      'pair-home:' || expected_pair.division_id::text || ':' || expected_pair.pair_low || ':' || expected_pair.pair_high,
      'blocking',
      'home-allocation-mismatch',
      expected_pair.division_name || ': ' || expected_pair.team_a_name || ' v ' || expected_pair.team_b_name || ' does not have a valid home/away split for ' || expected_pair.meetings::text || ' meetings.',
      coalesce(pair_count.entry_ids, '[]'::jsonb)
    from expected_pairs expected_pair
    join pair_counts pair_count
      on pair_count.division_id = expected_pair.division_id
      and pair_count.pair_low = expected_pair.pair_low
      and pair_count.pair_high = expected_pair.pair_high
    where pair_count.fixture_count = expected_pair.meetings
      and (
        (mod(expected_pair.meetings, 2) = 0 and pair_count.low_team_home_count <> pair_count.high_team_home_count)
        or
        (mod(expected_pair.meetings, 2) = 1 and abs(pair_count.low_team_home_count - pair_count.high_team_home_count) <> 1)
      )

    union all

    select
      'duplicate-meeting:' || duplicate.division_id::text || ':' || duplicate.pair_low || ':' || duplicate.pair_high || ':' || duplicate.meeting_number::text,
      'blocking',
      'duplicate-pairing-meeting',
      'A team pairing contains meeting number ' || duplicate.meeting_number::text || ' more than once.',
      duplicate.entry_ids
    from duplicate_meetings duplicate

    union all

    select
      'meeting-range:' || entry.id::text,
      'blocking',
      'unexpected-fixture',
      division.name || ' contains meeting ' || entry.meeting_number::text || ' but its format allows meetings 1 to ' || division.meetings::text || '.',
      jsonb_build_array(entry.id)
    from entries entry
    join divisions division on division.id = entry.division_id
    where entry.meeting_number < 1 or entry.meeting_number > division.meetings

    union all

    select
      'entry-team:' || entry.id::text,
      'blocking',
      'fixture-team-division-mismatch',
      division.name || ' contains a fixture whose teams are not both active members of that division.',
      jsonb_build_array(entry.id)
    from entries entry
    join divisions division on division.id = entry.division_id
    where not exists (
      select 1 from active_teams team
      where team.id = entry.home_team_id and team.division_id = entry.division_id
    ) or not exists (
      select 1 from active_teams team
      where team.id = entry.away_team_id and team.division_id = entry.division_id
    )

    union all

    select
      'team-total:' || expected.team_id::text,
      'blocking',
      'team-fixture-total-mismatch',
      expected.division_name || ': ' || expected.team_name || ' requires ' || expected.expected_fixtures::text || ' fixtures but has ' || coalesce(actual.fixture_count, 0)::text || '.',
      coalesce(actual.entry_ids, '[]'::jsonb)
    from expected_team_totals expected
    left join actual_team_totals actual on actual.team_id = expected.team_id
    where coalesce(actual.fixture_count, 0) <> expected.expected_fixtures

    union all

    select
      'team-balance:' || expected.team_id::text,
      'blocking',
      'home-away-balance-mismatch',
      expected.division_name || ': ' || expected.team_name || ' has an invalid home/away balance for a ' || expected.meetings::text || '-meeting format.',
      coalesce(actual.entry_ids, '[]'::jsonb)
    from expected_team_totals expected
    join actual_team_totals actual on actual.team_id = expected.team_id
    where actual.fixture_count = expected.expected_fixtures
      and (
        (mod(expected.expected_fixtures, 2) = 0 and actual.home_count <> actual.away_count)
        or
        (mod(expected.expected_fixtures, 2) = 1 and abs(actual.home_count - actual.away_count) <> 1)
      )
  )
  select jsonb_build_object(
    'valid', count(*) filter (where severity = 'blocking') = 0,
    'blockingCount', count(*) filter (where severity = 'blocking'),
    'warningCount', count(*) filter (where severity = 'warning'),
    'issues', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', issue_id,
          'severity', severity,
          'code', code,
          'message', message,
          'entryIds', entry_ids
        ) order by code, issue_id
      ),
      '[]'::jsonb
    )
  ) into result
  from issue_rows;

  return coalesce(result, jsonb_build_object(
    'valid', true,
    'blockingCount', 0,
    'warningCount', 0,
    'issues', '[]'::jsonb
  ));
end;
$$;

create or replace function private.league_schedule_combined_validation(
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
  operational_result jsonb;
  structure_result jsonb;
  combined_issues jsonb;
  blocking_count integer;
  warning_count integer;
begin
  operational_result := private.league_schedule_validation(target_league_id, target_version_id);
  structure_result := private.league_schedule_structure_assurance(target_league_id, target_version_id);
  combined_issues := coalesce(operational_result -> 'issues', '[]'::jsonb) || coalesce(structure_result -> 'issues', '[]'::jsonb);
  blocking_count := coalesce((operational_result ->> 'blockingCount')::integer, 0) + coalesce((structure_result ->> 'blockingCount')::integer, 0);
  warning_count := coalesce((operational_result ->> 'warningCount')::integer, 0) + coalesce((structure_result ->> 'warningCount')::integer, 0);

  return jsonb_build_object(
    'valid', blocking_count = 0,
    'blockingCount', blocking_count,
    'warningCount', warning_count,
    'issues', combined_issues
  );
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

  result := private.league_schedule_combined_validation(target_league_id, target_version_id);
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

  validation := private.league_schedule_combined_validation(target_league_id, target_version_id);
  if not coalesce((validation ->> 'valid')::boolean, false) then
    raise exception 'Schedule has % blocking validation issue(s)', coalesce((validation ->> 'blockingCount')::integer, 0)
      using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtext(target_league_id::text || ':' || version_row.season_id::text));

  update public.league_schedule_versions
  set status = 'archived', updated_at = now()
  where league_id = target_league_id
    and season_id = version_row.season_id
    and status = 'published'
    and id <> target_version_id;

  delete from public.league_fixtures
  where league_id = target_league_id
    and season_id = version_row.season_id
    and source = 'generated'
    and competition_type = 'league';

  for entry in
    select *
    from public.league_schedule_entries
    where version_id = target_version_id and placement_status = 'placed'
    order by round_number, scheduled_date, kick_off
  loop
    insert into public.league_fixtures (
      league_id, season_id, division_id, home_team_id, away_team_id, venue_id,
      scheduled_date, kick_off, status, locked, source, external_ref, notes,
      schedule_version_id, meeting_number, competition_type
    ) values (
      target_league_id, version_row.season_id, entry.division_id,
      entry.home_team_id, entry.away_team_id, entry.venue_id,
      entry.scheduled_date, entry.kick_off, 'scheduled', entry.locked,
      'generated', 'LM-' || entry.id::text, entry.notes,
      target_version_id, entry.meeting_number, 'league'
    );
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
    jsonb_build_object(
      'season_id', version_row.season_id,
      'version_number', version_row.version_number,
      'fixtures', published_count
    )
  );

  return jsonb_build_object(
    'version_id', target_version_id,
    'fixtures', published_count,
    'validation', validation
  );
end;
$$;

revoke all on function public.upsert_league_schedule_settings_entity(uuid, text, jsonb) from public, anon;
revoke all on function public.validate_league_schedule_version(uuid, uuid) from public, anon;
revoke all on function public.publish_league_schedule_version(uuid, uuid) from public, anon;

grant execute on function public.upsert_league_schedule_settings_entity(uuid, text, jsonb) to authenticated;
grant execute on function public.validate_league_schedule_version(uuid, uuid) to authenticated;
grant execute on function public.publish_league_schedule_version(uuid, uuid) to authenticated;

commit;
