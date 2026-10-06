import {expect,test} from 'vitest';
import * as moves from '../../src/lib/scheduling/fixtureMove.js';
import {applyFixtureOverrides,getFixtureFlowIdentity} from '../../src/lib/domain/fixtureVenueFlow.js';
import {buildPlannerChangeRecord} from '../../src/lib/engines/matchdayPlannerEngine.js';
import {modelFixture,modelPitches} from '../helpers/capacitySchedulingFixtures.js';
const pitches=modelPitches();
const home=modelFixture({pitchId:'AST-1',endMins:585,referee:'Pat',venueReversal:{originalHomeTeam:'Visitors'}});
const away=modelFixture({id:'away',sourceFixtureKey:'away',status:'away',venueRole:'away'});
const context={pitchCfg:pitches,club:{useAstro:true,maxConcurrent:3},matchDate:'2026-10-10',resourceContext:{status:'disabled'}};
test('away_first_drag_targets_home_only',()=>{
  const result=moves.validateFixtureMove({...context,fixtures:[away,home],fixtureIdentity:'source:one',patch:{pitchId:'AST-2'}});
  expect(result.ok).toBe(true);expect(result.fixtures[0]).toEqual(away);expect(result.fixtures[1].pitchId).toBe('AST-2');
});
test('postponed_first_sort_and_rebuild_do_not_retarget',()=>{
  const inactive=modelFixture({sourceFixtureKey:'inactive',status:'postponed'});
  const overrides=moves.updateFixtureOverridePatch({},'source:one',{pitchId:'AST-2',koMins:600});
  for(const fixtures of [[inactive,home],[home,inactive]]) {
    const output=applyFixtureOverrides(fixtures,overrides);
    expect(output.find(f=>f.sourceFixtureKey==='source:one').pitchId).toBe('AST-2');
    expect(output.find(f=>f.sourceFixtureKey==='inactive').pitchId).not.toBe('AST-2');
  }
});
test('missing_or_ambiguous_identity_rejected',()=>{
  expect(moves.resolveFixtureMoveTarget([home],'source:one').fixtureIndex).toBe(0);
  expect(moves.resolveFixtureMoveTarget([home],'missing').ok).toBe(false);
  expect(moves.resolveFixtureMoveTarget([home,home],'source:one').ok).toBe(false);
});
test('duration_45_move_ends_1045',()=>{
  expect(moves.buildFixtureAllocationPatch({fixture:home,pitch:pitches[2],koMins:600})).toMatchObject({pitchId:'AST-2',koMins:600,koTime:'10:00',endMins:645});
});
test('pitch_only_keeps_1007',()=>{
  const row={...home,koMins:607,koTime:'10:07',endMins:652};
  expect(moves.validateFixtureMove({...context,fixtures:[row],fixtureIdentity:'source:one',patch:{pitchId:'AST-2'}}).fixtures[0]).toMatchObject({koMins:607,endMins:652});
});
test('metadata_and_reversal_survive',()=>{
  const result=moves.validateFixtureMove({...context,fixtures:[home],fixtureIdentity:'source:one',patch:{pitchId:'AST-2'}});
  expect(result.fixtures[0]).toMatchObject({referee:'Pat',venueReversal:home.venueReversal,sourceFixtureKey:'source:one'});
  const overrides=moves.updateFixtureOverridePatch({'fixture:source:one':{fixtureIdentity:'source:one',referee:'Pat',venueReversal:home.venueReversal}},'source:one',result.patch);
  expect(overrides['fixture:source:one'].venueReversal).toEqual(home.venueReversal);
});
test('changed_booking_or_lock_rejects_old_preview',()=>{
  const request={...context,fixtures:[home],fixtureIdentity:'source:one',patch:{pitchId:'AST-2'},expectedPreviousPatch:{koMins:540}};
  expect(moves.validateFixtureMove(request).ok).toBe(true);
  expect(moves.validateFixtureMove({...request,readOnly:true}).ok).toBe(false);
  expect(moves.validateFixtureMove({...request,fixtures:[{...home,koMins:600}]}).ok).toBe(false);
  expect(moves.validateFixtureMove({...request,resourceContext:{status:'ready',reservations:[{pitchId:'AST-2',startMins:540,endMins:600}]}}).ok).toBe(false);
});
test('undo_uses_identity',()=>{
  const record=buildPlannerChangeRecord({fixture:{...home,id:'generated-position-1'},fixtureIndex:0,previousPatch:{pitchId:'AST-1'},patch:{pitchId:'AST-2'}});
  expect(record.fixtureId).toBe('source:one');
  const changed={...home,pitchId:'AST-2'};
  expect(moves.validateFixtureMove({...context,fixtures:[away,changed],fixtureIdentity:record.fixtureId,patch:record.previousPatch}).fixtures[1].pitchId).toBe('AST-1');
});
test('batch_recommendations_cannot_conflict',()=>{
  const other=modelFixture({sourceFixtureKey:'other',homeTeam:'U10 Other',awayTeam:'Else',cfg:{...home.cfg,id:'other'},pitchId:'AST-3'});
  const result=moves.validateFixtureMoveBatch({...context,fixtures:[home,other],moves:[{fixtureIdentity:'source:one',patch:{pitchId:'AST-2'}},{fixtureIdentity:'other',patch:{pitchId:'AST-2'}}]});
  expect(result.ok).toBe(false);expect(result.fixtures).toEqual([home,other]);expect(result.failures[0].type).toBe('pitch_clash');
});
test('local_save_failure_no_false_success',async()=>{
  let state=[home];
  const result=await moves.applyFixtureMoveTransaction({getCurrent:()=>({...context,fixtures:state}),request:{fixtureIdentity:getFixtureFlowIdentity(home),patch:{pitchId:'AST-2'}},loadResources:async()=>({status:'disabled'}),writeDraft:()=>false,commitState:r=>{state=r.fixtures;}});
  expect(result.ok).toBe(false);expect(state).toEqual([home]);
});
