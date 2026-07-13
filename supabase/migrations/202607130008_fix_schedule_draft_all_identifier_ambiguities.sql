-- Daxora League Manager: complete schedule draft identifier ambiguity fix.
-- Replaces every local variable that can collide with a schedule table column.
-- The public RPC signature remains unchanged for the existing browser client.

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
  v_actor_id uuid := auth.uid();
  v_parent_version_id uuid := parent_version_id;
  v_next_version_number integer;
  v_new_version_id uuid;
  v_entry_data jsonb;
  v_division_id uuid;
  v_home_team_id uuid;
  v_away_team_id uuid;
  v_venue_id uuid;
  v_source_fixture_id uuid;
  v_scheduled_date date;
  v_kick_off time;
  v_safe_source text := lower(trim(coalesce(draft_source, 'generated')));
  v_entry_count integer;
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

  v_entry_count := jsonb_array_length(coalesce(schedule_entries, '[]'::jsonb));
  if v_entry_count < 1 or v_entry_count > 5000 then
    raise exception 'A schedule draft must contain between 1 and 5000 fixtures' using errcode = '22023';
  end if;
  if v_safe_source not in ('generated', 'restored', 'manual') then
    raise exception 'Unsupported schedule source' using errcode = '22023';
  end if;

  if v_parent_version_id is not null and not exists (
    select 1
    from public.league_schedule_versions as parent_version
    where parent_version.id = v_parent_version_id
      and parent_version.league_id = target_league_id
      and parent_version.season_id = target_season_id
  ) then
    raise exception 'Parent schedule version does not belong to this league season' using errcode = '23503';
  end if;

  perform pg_advisory_xact_lock(hashtext(target_league_id::text || ':' || target_season_id::text));

  select coalesce(max(schedule_version.version_number), 0) + 1
  into v_next_version_number
  from public.league_schedule_versions as schedule_version
  where schedule_version.league_id = target_league_id
    and schedule_version.season_id = target_season_id;

  insert into public.league_schedule_versions (
    league_id,
    season_id,
    parent_version_id,
    version_number,
    name,
    status,
    source,
    generation_config,
    validation_summary,
    created_by
  ) values (
    target_league_id,
    target_season_id,
    v_parent_version_id,
    v_next_version_number,
    trim(draft_name),
    'draft',
    v_safe_source,
    coalesce(generation_config, '{}'::jsonb),
    '{}'::jsonb,
    v_actor_id
  )
  returning id into v_new_version_id;

  for v_entry_data in
    select schedule_entry.value
    from jsonb_array_elements(schedule_entries) as schedule_entry(value)
  loop
    v_division_id := nullif(v_entry_data ->> 'division_id', '')::uuid;
    v_home_team_id := nullif(v_entry_data ->> 'home_team_id', '')::uuid;
    v_away_team_id := nullif(v_entry_data ->> 'away_team_id', '')::uuid;
    v_venue_id := nullif(v_entry_data ->> 'venue_id', '')::uuid;
    v_source_fixture_id := nullif(v_entry_data ->> 'source_fixture_id', '')::uuid;
    v_scheduled_date := nullif(v_entry_data ->> 'scheduled_date', '')::date;
    v_kick_off := nullif(v_entry_data ->> 'kick_off', '')::time;

    perform private.assert_league_reference(target_league_id, 'division', v_division_id);
    perform private.assert_league_reference(target_league_id, 'team', v_home_team_id);
    perform private.assert_league_reference(target_league_id, 'team', v_away_team_id);
    perform private.assert_league_reference(target_league_id, 'venue', v_venue_id);

    if v_home_team_id = v_away_team_id then
      raise exception 'A team cannot play itself' using errcode = '23514';
    end if;

    if not exists (
      select 1
      from public.league_teams as home_team
      join public.league_teams as away_team
        on away_team.id = v_away_team_id
      join public.league_divisions as selected_division
        on selected_division.id = v_division_id
      where home_team.id = v_home_team_id
        and home_team.league_id = target_league_id
        and away_team.league_id = target_league_id
        and selected_division.league_id = target_league_id
        and home_team.season_id = target_season_id
        and away_team.season_id = target_season_id
        and selected_division.season_id = target_season_id
        and home_team.division_id = v_division_id
        and away_team.division_id = v_division_id
    ) then
      raise exception 'Schedule teams and division must belong to the selected season' using errcode = '23503';
    end if;

    if v_source_fixture_id is not null and not exists (
      select 1
      from public.league_fixtures as source_fixture
      where source_fixture.id = v_source_fixture_id
        and source_fixture.league_id = target_league_id
        and source_fixture.season_id = target_season_id
    ) then
      raise exception 'Source fixture does not belong to this league season' using errcode = '23503';
    end if;

    insert into public.league_schedule_entries (
      version_id,
      league_id,
      season_id,
      division_id,
      source_fixture_id,
      home_team_id,
      away_team_id,
      venue_id,
      scheduled_date,
      kick_off,
      round_number,
      placement_status,
      locked,
      unresolved_reason,
      notes
    ) values (
      v_new_version_id,
      target_league_id,
      target_season_id,
      v_division_id,
      v_source_fixture_id,
      v_home_team_id,
      v_away_team_id,
      v_venue_id,
      v_scheduled_date,
      v_kick_off,
      greatest(coalesce((v_entry_data ->> 'round_number')::integer, 0), 0),
      case when v_scheduled_date is null then 'unplaced' else 'placed' end,
      coalesce((v_entry_data ->> 'locked')::boolean, false),
      nullif(trim(coalesce(v_entry_data ->> 'unresolved_reason', '')), ''),
      nullif(trim(coalesce(v_entry_data ->> 'notes', '')), '')
    );
  end loop;

  perform private.write_league_audit(
    target_league_id,
    'league.schedule_draft_created',
    'schedule_version',
    v_new_version_id,
    jsonb_build_object(
      'season_id', target_season_id,
      'version_number', v_next_version_number,
      'fixtures', v_entry_count,
      'source', v_safe_source
    )
  );

  return v_new_version_id;
end;
$$;

revoke all on function public.save_league_schedule_draft(uuid, uuid, text, jsonb, jsonb, uuid, text) from public, anon;
grant execute on function public.save_league_schedule_draft(uuid, uuid, text, jsonb, jsonb, uuid, text) to authenticated;

commit;
