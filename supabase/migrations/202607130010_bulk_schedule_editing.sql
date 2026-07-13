begin;

create or replace function public.update_league_schedule_entries(
  target_league_id uuid,
  target_version_id uuid,
  entry_updates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_version_status text;
  v_update_data jsonb;
  v_entry_id uuid;
  v_scheduled_date date;
  v_kick_off time;
  v_venue_id uuid;
  v_locked boolean;
  v_notes text;
  v_updated integer := 0;
begin
  if not public.can_operate_league(target_league_id) then
    raise exception 'League fixture access required' using errcode = '42501';
  end if;

  if entry_updates is null or jsonb_typeof(entry_updates) <> 'array' then
    raise exception 'Schedule entry updates must be a JSON array' using errcode = '22023';
  end if;

  if jsonb_array_length(entry_updates) > 1000 then
    raise exception 'No more than 1000 schedule entries can be updated in one batch' using errcode = '22023';
  end if;

  select schedule_version.status
  into v_version_status
  from public.league_schedule_versions as schedule_version
  where schedule_version.id = target_version_id
    and schedule_version.league_id = target_league_id;

  if v_version_status is null then
    raise exception 'Schedule version not found' using errcode = 'P0002';
  end if;

  if v_version_status <> 'draft' then
    raise exception 'Published or archived schedules cannot be edited' using errcode = '42501';
  end if;

  for v_update_data in
    select update_row.value
    from jsonb_array_elements(entry_updates) as update_row(value)
  loop
    begin
      v_entry_id := nullif(trim(coalesce(v_update_data ->> 'id', '')), '')::uuid;
      v_scheduled_date := nullif(trim(coalesce(v_update_data ->> 'scheduled_date', '')), '')::date;
      v_kick_off := nullif(trim(coalesce(v_update_data ->> 'kick_off', '')), '')::time;
      v_venue_id := nullif(trim(coalesce(v_update_data ->> 'venue_id', '')), '')::uuid;
    exception
      when invalid_text_representation or datetime_field_overflow then
        raise exception 'A schedule entry update contains an invalid identifier, date or time' using errcode = '22023';
    end;

    if v_entry_id is null then
      raise exception 'Every schedule entry update requires an id' using errcode = '22023';
    end if;

    v_locked := coalesce((v_update_data ->> 'locked')::boolean, false);
    v_notes := nullif(trim(coalesce(v_update_data ->> 'notes', '')), '');

    if v_scheduled_date is not null and v_venue_id is null then
      raise exception 'A placed fixture requires a venue' using errcode = '23502';
    end if;

    perform private.assert_league_reference(target_league_id, 'venue', v_venue_id);

    update public.league_schedule_entries as schedule_entry
    set scheduled_date = v_scheduled_date,
        kick_off = case when v_scheduled_date is null then null else coalesce(v_kick_off, '15:00'::time) end,
        venue_id = v_venue_id,
        placement_status = case when v_scheduled_date is null then 'unplaced' else 'placed' end,
        locked = v_locked,
        unresolved_reason = case when v_scheduled_date is null then coalesce(schedule_entry.unresolved_reason, 'Manually unplaced for review.') else null end,
        notes = v_notes,
        updated_at = now()
    where schedule_entry.id = v_entry_id
      and schedule_entry.version_id = target_version_id
      and schedule_entry.league_id = target_league_id;

    if not found then
      raise exception 'Schedule entry % was not found in this draft', v_entry_id using errcode = 'P0002';
    end if;

    v_updated := v_updated + 1;
  end loop;

  if v_updated > 0 then
    update public.league_schedule_versions as schedule_version
    set validation_summary = '{}'::jsonb,
        updated_at = now()
    where schedule_version.id = target_version_id
      and schedule_version.league_id = target_league_id;

    perform private.write_league_audit(
      target_league_id,
      'league.schedule_entries_updated',
      'schedule_version',
      target_version_id,
      jsonb_build_object('updated_entries', v_updated)
    );
  end if;

  return jsonb_build_object('updated', v_updated, 'version_id', target_version_id);
end;
$$;

revoke all on function public.update_league_schedule_entries(uuid, uuid, jsonb) from public, anon;
grant execute on function public.update_league_schedule_entries(uuid, uuid, jsonb) to authenticated;

commit;
