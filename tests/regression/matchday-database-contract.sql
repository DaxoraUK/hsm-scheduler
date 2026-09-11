-- Run only against the dedicated staging project. All test data is rolled back.
begin;
do $$
declare
  club uuid := 'ce481c32-be1e-4db1-ba58-7ed923e3c81a';
  actor uuid; test_role text; state jsonb; evidence jsonb;
  approval_count integer; audit_count integer; revision integer;
begin
  select count(*) into approval_count from public.elite_approval_requests where club_id=club;
  select count(*) into audit_count from public.audit_events where club_id=club;
  evidence := '{"action":"calendar.saved","canonicalIdentities":["manual:contract-test"],"fixtureDays":[{"key":"saturday","date":"2099-09-05","hasRun":true,"scheduled":[{"canonicalFixtureIdentity":"manual:contract-test","pitchId":"P2","koTime":"08:05","koMins":485,"endMins":570,"status":"active"}],"unresolved":[]}]}';
  foreach test_role in array array['owner','scheduler'] loop
    select user_id into actor from public.club_memberships where club_id=club and role=test_role and status='active' limit 1;
    assert actor is not null, 'Staging fixture requires an active owner and scheduler';
    perform set_config('request.jwt.claim.sub',actor::text,true);
    state := public.load_matchday_scheduling_state(club,'saturday','2099-09-05');
    revision := (state->>'revision')::integer;
    state := public.commit_matchday_schedule(club,'saturday','2099-09-05',revision,
      '{"manual:contract-test":{"allocation":{"mode":"locked","pitchId":"P2","koTime":"08:05"}}}',
      '[{"canonicalFixtureIdentity":"manual:contract-test","manual":true}]',evidence);
    assert (state->>'revision')::integer=revision+1, 'Save did not advance revision';
    assert state->'operational_snapshot'->'canonicalIdentities'='["manual:contract-test"]'::jsonb, 'Snapshot missing';
    assert exists(select 1 from public.history where club_id=club and id=state->'history_entry'->>'id'), 'Atomic history missing';
    state := public.publish_matchday_scheduling_state(club,'saturday','2099-09-05',revision+1,state->'operational_snapshot');
    assert (state->>'published_revision')::integer=revision+1, 'Authorised publish failed';
    assert public.set_matchday_lock(club,'saturday','2099-09-05',true)->>'locked'='true', 'Lock failed';
    begin
      perform public.commit_matchday_schedule(club,'saturday','2099-09-05',revision+1,'{}','[]',evidence);
      raise exception 'Locked save unexpectedly succeeded';
    exception when sqlstate '55000' then null; end;
    assert public.set_matchday_lock(club,'saturday','2099-09-05',false)->>'locked'='false', 'Unlock failed';
    begin
      perform public.commit_matchday_schedule(club,'saturday','2099-09-05',revision,'{}','[]',evidence);
      raise exception 'Stale revision unexpectedly succeeded';
    exception when sqlstate '40900' then null; end;
    begin
      perform public.commit_matchday_schedule(club,'saturday','2099-09-05',revision+1,'{}','[]',jsonb_set(evidence,'{canonicalIdentities}','["manual:other"]'));
      raise exception 'Inconsistent evidence unexpectedly succeeded';
    exception when sqlstate '22023' then null; end;
    begin
      perform public.load_matchday_scheduling_state('00000000-0000-0000-0000-000000000001','saturday','2099-09-05');
      raise exception 'Cross-club read unexpectedly succeeded';
    exception when sqlstate '42501' then null; end;
  end loop;
  assert (select count(*) from public.elite_approval_requests where club_id=club)=approval_count, 'Scheduling created approval requests';
  assert (select count(*) from public.audit_events where club_id=club)>audit_count, 'Audit was not retained';
  assert exists(select 1 from public.history where club_id=club and data->>'action'='schedule.published' and data->>'date'='2099-09-05'), 'Publication history missing';
  assert exists(select 1 from public.history where club_id=club and data->>'action'='schedule.unlocked' and data->>'date'='2099-09-05'), 'Unlock history missing';
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.commit_matchday_schedule(club,'saturday','2099-09-05',0,'{}','[]',evidence);
    raise exception 'Unauthenticated save unexpectedly succeeded';
  exception when sqlstate '42501' then null; end;
  assert not has_function_privilege('anon','public.commit_matchday_schedule(uuid,text,text,integer,jsonb,jsonb,jsonb)','EXECUTE'), 'Anonymous execute grant';
end; $$;
rollback;
