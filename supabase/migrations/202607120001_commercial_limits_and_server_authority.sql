-- Daxora Ground Control: tighten launch package limits and make the secure
-- workspace authoritative for limit-controlled club resources.

begin;

update public.subscription_plans
set limits = '{"teams":15,"venues":1,"users":5,"pitches":15,"history_entries":52,"history_retention_days":365}'::jsonb,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'packaging_version', '2026-07-12.1',
      'commercial_limit_model', 'core_15_single_site'
    ),
    updated_at = now()
where code = 'core';

update public.subscription_plans
set limits = '{"teams":40,"venues":4,"users":15,"pitches":50,"history_entries":156,"history_retention_days":730}'::jsonb,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'packaging_version', '2026-07-12.1',
      'commercial_limit_model', 'pro_40_multi_site'
    ),
    updated_at = now()
where code = 'pro';

create or replace function public.replace_club_collection(
  target_club_id uuid,
  collection_name text,
  records jsonb default '[]'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  record_count integer := 0;
  maximum integer := -1;
  limit_key text := null;
  safe_collection text := lower(trim(coalesce(collection_name, '')));
  safe_records jsonb := coalesce(records, '[]'::jsonb);
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(safe_records) <> 'array' then
    raise exception 'records must be a JSON array' using errcode = '22023';
  end if;

  if safe_collection in ('pitches', 'team_config') then
    if not public.can_manage_club(target_club_id) then
      raise exception 'Club administrator access required' using errcode = '42501';
    end if;
  elsif safe_collection in ('refs', 'pitch_closures') then
    if not public.can_operate_club(target_club_id) then
      raise exception 'Club operator access required' using errcode = '42501';
    end if;
  else
    raise exception 'Unsupported collection: %', safe_collection using errcode = '22023';
  end if;

  select count(*)
  into record_count
  from jsonb_array_elements(safe_records) item
  where nullif(item ->> 'id', '') is not null;

  limit_key := case safe_collection
    when 'team_config' then 'teams'
    when 'pitches' then 'pitches'
    else null
  end;
  if limit_key is not null then
    maximum := private.club_subscription_limit(target_club_id, limit_key, 0);
    if maximum >= 0 and record_count > maximum then
      raise exception 'The current plan allows a maximum of % %', maximum, limit_key
        using errcode = '23514';
    end if;
  end if;

  if safe_collection = 'pitches' then
    delete from public.pitches where club_id = target_club_id;
    insert into public.pitches (club_id, id, data)
    select target_club_id, item ->> 'id', coalesce(item -> 'data', '{}'::jsonb)
    from jsonb_array_elements(safe_records) item
    where nullif(item ->> 'id', '') is not null;
  elsif safe_collection = 'team_config' then
    delete from public.team_config where club_id = target_club_id;
    insert into public.team_config (club_id, id, data)
    select target_club_id, item ->> 'id', coalesce(item -> 'data', '{}'::jsonb)
    from jsonb_array_elements(safe_records) item
    where nullif(item ->> 'id', '') is not null;
  elsif safe_collection = 'refs' then
    delete from public.refs where club_id = target_club_id;
    insert into public.refs (club_id, id, data)
    select target_club_id, item ->> 'id', coalesce(item -> 'data', '{}'::jsonb)
    from jsonb_array_elements(safe_records) item
    where nullif(item ->> 'id', '') is not null;
  elsif safe_collection = 'pitch_closures' then
    delete from public.pitch_closures where club_id = target_club_id;
    insert into public.pitch_closures (club_id, id, data)
    select target_club_id, item ->> 'id', coalesce(item -> 'data', '{}'::jsonb)
    from jsonb_array_elements(safe_records) item
    where nullif(item ->> 'id', '') is not null;
  end if;

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'settings.collection.replace',
    safe_collection,
    safe_collection,
    jsonb_build_object(
      'collection', safe_collection,
      'record_count', record_count,
      'plan_limit', maximum
    ),
    'database'
  );

  return record_count;
end;
$$;

revoke all on function public.replace_club_collection(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.replace_club_collection(uuid, text, jsonb) to authenticated;

commit;
