-- Staging only. Fixture evidence and History are rolled back after assertions.
begin;
do $$
declare club uuid := 'ce481c32-be1e-4db1-ba58-7ed923e3c81a'; actor uuid;
  before_config jsonb; saved jsonb; source_id text; before_source jsonb;
begin
  select user_id into actor from public.club_memberships where club_id=club and role='scheduler' and status='active' limit 1;
  assert actor is not null, 'Active staging scheduler required';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  assert not public.can_manage_club(club), 'Scheduler unexpectedly has settings authority';
  select data into before_config from public.club_config where club_id=club and id='club';
  before_source := before_config#>'{integrations,fullTimeFa,sources,0}';
  source_id := before_source->>'id';
  saved := public.save_full_time_fixture_evidence(club,'saturday','2099-09-05',
    jsonb_build_array(jsonb_build_object('id',source_id,'health',jsonb_build_object('ok',true,'testEvidence',true),'url','must-not-replace-url','name','must-not-replace-name')),
    '{"canonicalIdentities":[],"qa":true}');
  assert saved->'configuration'#>'{integrations,fullTimeFa,sources,0,health,testEvidence}'='true'::jsonb, 'Evidence not saved';
  assert ((saved->'configuration'#>'{integrations,fullTimeFa,sources,0}') - 'health')=(before_source - 'health'), 'Provider settings or snapshot changed';
  assert ((saved->'configuration') #- '{integrations,fullTimeFa,sources}')=(before_config #- '{integrations,fullTimeFa,sources}'), 'Unrelated settings changed';
  assert exists(select 1 from public.history where club_id=club and id=saved->'history_entry'->>'id'), 'Refresh history missing';
  begin
    perform public.save_full_time_fixture_evidence(club,'saturday','2099-09-05',
      jsonb_build_array(jsonb_build_object('id',source_id,'fixtureSnapshot','[]'::jsonb,'previousFixtureSnapshot','[{"canonicalFixtureIdentity":"never-current-contract-snapshot"}]'::jsonb)),'{}');
    raise exception 'Stale provider snapshot unexpectedly overwrote current facts';
  exception when sqlstate '40900' then null; end;
  begin
    perform public.save_full_time_fixture_evidence(club,'saturday','2099-09-05','[{"id":"nonexistent-source"}]','{}');
    raise exception 'Unknown provider source unexpectedly created';
  exception when sqlstate '22023' then null; end;
  assert not public.can_manage_club(club), 'Provider refresh expanded settings authority';
end; $$;
rollback;
