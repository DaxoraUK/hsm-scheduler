-- Saved output is evidence, separate from explicit intent. Never hydrate a
-- generated allocation into an intent lock.
alter table public.matchday_scheduling_states
  add column if not exists operational_snapshot jsonb;

create or replace function public.load_matchday_scheduling_state(target_club_id uuid, target_day_scope text, target_matchday_date text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.matchday_scheduling_states%rowtype;
begin
  if auth.uid() is null or not public.is_club_member(target_club_id) then
    raise exception 'Club access required' using errcode = '42501';
  end if;
  select * into saved from public.matchday_scheduling_states
  where club_id = target_club_id and day_scope = lower(trim(target_day_scope)) and matchday_date = trim(target_matchday_date);
  if found then return to_jsonb(saved); end if;
  return jsonb_build_object('revision', 0, 'intents', '{}'::jsonb, 'manual_fixtures', '[]'::jsonb);
end; $$;

create or replace function public.commit_matchday_schedule(
  target_club_id uuid, target_day_scope text, target_matchday_date text,
  expected_revision integer, intent_data jsonb, manual_fixture_data jsonb, operational_evidence jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved jsonb; previous jsonb; entry jsonb; entry_id text; fixture_count integer; unique_count integer;
  day_evidence jsonb; actual_ids jsonb; declared_ids jsonb; actor_label text;
begin
  if auth.uid() is null or not public.can_operate_club(target_club_id) then
    raise exception 'Matchday operator access required' using errcode = '42501';
  end if;
  if jsonb_typeof(operational_evidence) is distinct from 'object'
    or jsonb_typeof(operational_evidence->'canonicalIdentities') is distinct from 'array'
    or jsonb_typeof(operational_evidence->'fixtureDays') is distinct from 'array' then
    raise exception 'Canonical operational evidence is required' using errcode = '22023';
  end if;
  select count(*), count(distinct value) into fixture_count, unique_count
  from jsonb_array_elements_text(operational_evidence->'canonicalIdentities');
  if fixture_count <> unique_count then raise exception 'Duplicate canonical identity' using errcode = '22023'; end if;
  if jsonb_array_length(operational_evidence->'fixtureDays') <> 1 then
    raise exception 'Exactly one saved matchday is required' using errcode = '22023';
  end if;
  day_evidence := operational_evidence->'fixtureDays'->0;
  if day_evidence->>'key' is distinct from lower(trim(target_day_scope))
    or day_evidence->>'date' is distinct from trim(target_matchday_date)
    or jsonb_typeof(day_evidence->'scheduled') is distinct from 'array'
    or jsonb_typeof(day_evidence->'unresolved') is distinct from 'array' then
    raise exception 'Operational evidence does not match the requested day' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(value->>'canonicalFixtureIdentity' order by value->>'canonicalFixtureIdentity'),'[]'::jsonb)
    into actual_ids from jsonb_array_elements((day_evidence->'scheduled') || (day_evidence->'unresolved'));
  select coalesce(jsonb_agg(value order by value),'[]'::jsonb) into declared_ids
    from jsonb_array_elements_text(operational_evidence->'canonicalIdentities');
  if actual_ids is distinct from declared_ids or exists(select 1 from jsonb_array_elements_text(actual_ids) where nullif(trim(value),'') is null) then
    raise exception 'Saved fixture identities do not match canonical evidence' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_club_id::text || ':' || lower(trim(target_day_scope)) || ':' || trim(target_matchday_date), 0));
  if coalesce((public.get_matchday_lock(target_club_id, target_day_scope, target_matchday_date)->>'locked')::boolean, false) then
    raise exception 'Unlock this matchday before editing or saving' using errcode = '55000';
  end if;
  previous := public.load_matchday_scheduling_state(target_club_id, target_day_scope, target_matchday_date);
  if coalesce((previous->>'revision')::integer, 0) <> expected_revision then
    raise exception 'Matchday scheduling state has changed; reload before saving' using errcode = '40900';
  end if;
  saved := public.save_matchday_scheduling_state(target_club_id, target_day_scope, target_matchday_date, expected_revision, intent_data, manual_fixture_data);
  entry_id := lower(trim(target_day_scope)) || ':' || trim(target_matchday_date) || ':revision:' || (saved->>'revision');
  select display_name into actor_label from public.user_profiles where id=auth.uid();
  entry := operational_evidence || jsonb_build_object('id', entry_id, 'savedAt', now(), 'operatorId', auth.uid(), 'operatorLabel', actor_label, 'revision', saved->'revision');
  update public.matchday_scheduling_states set operational_snapshot = entry
  where club_id = target_club_id and day_scope = lower(trim(target_day_scope)) and matchday_date = trim(target_matchday_date);
  perform public.save_matchweek_history(target_club_id, entry_id, entry, now());
  perform public.record_audit_event(target_club_id, 'matchday.' || coalesce(operational_evidence->>'action', 'schedule.saved'),
    'matchday_scheduling_state', entry_id, jsonb_build_object('before', previous, 'after', saved, 'canonicalIdentities', entry->'canonicalIdentities'));
  return saved || jsonb_build_object('history_entry', entry, 'operational_snapshot', entry);
end; $$;

create or replace function public.set_matchday_lock(
  target_club_id uuid, target_day_scope text, target_matchday_date text,
  target_locked boolean, target_snapshot_hash text default null, target_fixture_count integer default 0
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.matchday_locks%rowtype;
begin
  if auth.uid() is null or not public.can_operate_club(target_club_id) or not private.club_subscription_allows_write(target_club_id) then
    raise exception 'Matchday operator access required' using errcode = '42501';
  end if;
  if nullif(trim(target_day_scope), '') is null or nullif(trim(target_matchday_date), '') is null then
    raise exception 'Matchday scope and date required' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_club_id::text || ':' || lower(trim(target_day_scope)) || ':' || trim(target_matchday_date), 0));
  if target_locked and not exists(select 1 from public.matchday_scheduling_states where club_id=target_club_id and day_scope=lower(trim(target_day_scope)) and matchday_date=trim(target_matchday_date) and revision > 0) then
    raise exception 'Save the matchday before locking it' using errcode = '22023';
  end if;
  insert into public.matchday_locks(club_id, day_scope, matchday_date, locked, locked_by, locked_at, updated_by, snapshot_hash, fixture_count)
  values(target_club_id, lower(trim(target_day_scope)), trim(target_matchday_date), coalesce(target_locked,false), case when target_locked then auth.uid() end, case when target_locked then now() end, auth.uid(), target_snapshot_hash, greatest(coalesce(target_fixture_count,0),0))
  on conflict(club_id,day_scope,matchday_date) do update set locked=excluded.locked, locked_by=excluded.locked_by, locked_at=excluded.locked_at, updated_by=excluded.updated_by, updated_at=now(), snapshot_hash=excluded.snapshot_hash, fixture_count=excluded.fixture_count
  returning * into saved;
  perform public.record_audit_event(target_club_id, case when saved.locked then 'matchday.schedule.locked' else 'matchday.schedule.unlocked' end, 'matchday_lock', saved.day_scope||':'||saved.matchday_date, to_jsonb(saved));
  return public.get_matchday_lock(target_club_id, target_day_scope, target_matchday_date);
end; $$;

revoke all on function public.commit_matchday_schedule(uuid,text,text,integer,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.commit_matchday_schedule(uuid,text,text,integer,jsonb,jsonb,jsonb) to authenticated;
revoke all on function public.load_matchday_scheduling_state(uuid,text,text) from public,anon;
revoke all on function public.set_matchday_lock(uuid,text,text,boolean,text,integer) from public,anon;
grant execute on function public.load_matchday_scheduling_state(uuid,text,text) to authenticated;
grant execute on function public.set_matchday_lock(uuid,text,text,boolean,text,integer) to authenticated;

create or replace function public.record_matchday_history_event(target_club_id uuid, target_day_scope text, target_matchday_date text, event_action text, event_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare entry jsonb; entry_id text; actor_label text;
begin
  if auth.uid() is null or not public.is_club_member(target_club_id)
    or not (public.can_operate_club(target_club_id) or public.can_publish_club_matchweek(target_club_id)) then
    raise exception 'Scheduling access required' using errcode = '42501';
  end if;
  if not private.club_subscription_allows_write(target_club_id) then raise exception 'Subscription is read only' using errcode = '42501'; end if;
  if event_action not in ('provider.refreshed','schedule.locked','schedule.unlocked','schedule.published') then
    raise exception 'Unknown scheduling event' using errcode = '22023';
  end if;
  select display_name into actor_label from public.user_profiles where id = auth.uid();
  entry_id := target_day_scope || ':' || target_matchday_date || ':event:' || gen_random_uuid()::text;
  entry := jsonb_build_object('id',entry_id,'eventOnly',true,'action',event_action,'date',target_matchday_date,
    'dateLabel',target_day_scope||' '||target_matchday_date,'savedAt',now(),'operatorId',auth.uid(),'operatorLabel',actor_label,'detail',event_data);
  insert into public.history(club_id,id,data,saved_at) values(target_club_id,entry_id,entry,now());
  perform public.record_audit_event(target_club_id,'matchday.'||event_action,'matchday',target_day_scope||':'||target_matchday_date,event_data);
  return entry;
end; $$;

create or replace function private.record_matchday_lifecycle_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'matchday_locks' then
    if tg_op = 'INSERT' or new.locked is distinct from old.locked then
      perform public.record_matchday_history_event(new.club_id,new.day_scope,new.matchday_date,
        case when new.locked then 'schedule.locked' else 'schedule.unlocked' end,
        jsonb_build_object('before',case when tg_op='UPDATE' then to_jsonb(old) else null end,'after',to_jsonb(new)));
    end if;
  elsif new.published_at is distinct from old.published_at then
    perform public.record_matchday_history_event(new.club_id,new.day_scope,new.matchday_date,'schedule.published',
      jsonb_build_object('revision',new.published_revision,'canonicalIdentities',new.published_snapshot->'canonicalIdentities'));
  end if;
  return new;
end; $$;
create trigger matchday_lock_history after insert or update on public.matchday_locks
  for each row execute function private.record_matchday_lifecycle_history();
create trigger matchday_publication_history after update on public.matchday_scheduling_states
  for each row execute function private.record_matchday_lifecycle_history();

-- Old clients cannot bypass a saved lock by calling the legacy save RPC.
create or replace function private.guard_matchday_intent_lock()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.club_id::text || ':' || new.day_scope || ':' || new.matchday_date, 0));
  if tg_op = 'INSERT' or new.intents is distinct from old.intents or new.manual_fixtures is distinct from old.manual_fixtures then
    if exists(select 1 from public.matchday_locks where club_id=new.club_id and day_scope=new.day_scope and matchday_date=new.matchday_date and locked) then
      raise exception 'Unlock this matchday before changing scheduling intent' using errcode = '55000';
    end if;
  end if;
  return new;
end; $$;
create trigger matchday_intent_lock before insert or update on public.matchday_scheduling_states
  for each row execute function private.guard_matchday_intent_lock();
revoke all on function public.record_matchday_history_event(uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.record_matchday_history_event(uuid,text,text,text,jsonb) to authenticated;
revoke all on function private.record_matchday_lifecycle_history() from public,anon,authenticated;
revoke all on function private.guard_matchday_intent_lock() from public,anon,authenticated;
