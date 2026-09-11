-- Provider refresh can update evidence on configured feeds, not club settings.
create or replace function public.save_full_time_fixture_evidence(
  target_club_id uuid, target_day_scope text, target_matchday_date text,
  source_updates jsonb, event_detail jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare configuration jsonb; sources jsonb; source jsonb; patch jsonb;
  next_sources jsonb := '[]'::jsonb; history_entry jsonb;
begin
  if auth.uid() is null or not public.can_operate_club(target_club_id)
    or not private.club_subscription_allows_write(target_club_id) then
    raise exception 'Scheduling access required' using errcode='42501';
  end if;
  if jsonb_typeof(source_updates) is distinct from 'array' then
    raise exception 'Provider updates must be an array' using errcode='22023';
  end if;
  select data into configuration from public.club_config
    where club_id=target_club_id and id='club' for update;
  sources := configuration#>'{integrations,fullTimeFa,sources}';
  if jsonb_typeof(sources) is distinct from 'array' then
    raise exception 'Configure provider sources before refreshing' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(source_updates) value
      where nullif(trim(value->>'id'),'') is null
      or not exists(select 1 from jsonb_array_elements(sources) configured where configured->>'id'=value->>'id'))
    or (select count(*) from jsonb_array_elements(source_updates)) <>
       (select count(distinct value->>'id') from jsonb_array_elements(source_updates)) then
    raise exception 'Unknown or duplicate provider source' using errcode='22023';
  end if;
  for source in select value from jsonb_array_elements(sources) loop
    select value into patch from jsonb_array_elements(source_updates) where value->>'id'=source->>'id';
    if found then
      if patch ? 'fixtureSnapshot' then
        if jsonb_typeof(patch->'fixtureSnapshot') is distinct from 'array' or not (patch ? 'previousFixtureSnapshot') then
          raise exception 'Provider snapshot and previous snapshot are required' using errcode='22023';
        end if;
        if coalesce(source->'fixtureSnapshot','[]'::jsonb) is distinct from patch->'previousFixtureSnapshot' then
          raise exception 'Provider facts changed in another session; reload before refreshing' using errcode='40900';
        end if;
        source := source || jsonb_build_object('fixtureSnapshot',patch->'fixtureSnapshot');
      end if;
      if patch ? 'health' then
        if jsonb_typeof(patch->'health') is distinct from 'object' then raise exception 'Invalid source health' using errcode='22023'; end if;
        source := source || jsonb_build_object('health',patch->'health');
      end if;
      if patch ? 'pendingReconciliations' then
        if jsonb_typeof(patch->'pendingReconciliations') is distinct from 'array' then raise exception 'Invalid reconciliation evidence' using errcode='22023'; end if;
        source := source || jsonb_build_object('pendingReconciliations',patch->'pendingReconciliations');
      end if;
    end if;
    next_sources := next_sources || jsonb_build_array(source);
  end loop;
  configuration := jsonb_set(configuration,'{integrations,fullTimeFa,sources}',next_sources);
  update public.club_config set data=configuration,updated_at=now() where club_id=target_club_id and id='club';
  if nullif(trim(target_day_scope),'') is not null and nullif(trim(target_matchday_date),'') is not null then
    history_entry := public.record_matchday_history_event(target_club_id,target_day_scope,target_matchday_date,'provider.refreshed',
      coalesce(event_detail,'{}'::jsonb) || jsonb_build_object('sourceIds',(select jsonb_agg(value->>'id') from jsonb_array_elements(source_updates))));
  end if;
  return jsonb_build_object('configuration',configuration,'history_entry',history_entry);
end; $$;
revoke all on function public.save_full_time_fixture_evidence(uuid,text,text,jsonb,jsonb) from public,anon;
grant execute on function public.save_full_time_fixture_evidence(uuid,text,text,jsonb,jsonb) to authenticated;
