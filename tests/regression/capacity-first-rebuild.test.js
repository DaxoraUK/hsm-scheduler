import {it,expect} from 'vitest';
import {scheduleFixtureDay} from '../../src/lib/scheduler.js';
import {modelPitches,modelTeam,modelFixture} from '../helpers/capacitySchedulingFixtures.js';
import {applyFixtureOverrides,reverseAwayFixture,getFixtureFlowIdentity} from '../../src/lib/domain/fixtureVenueFlow.js';
const pitches=modelPitches({availabilityByDay:{saturday:[{from:'09:00',to:'13:00'}]}});
const make=(id,extra={})=>modelFixture({id,sourceFixtureKey:id,homeTeam:'U10 '+id,awayTeam:'Visitors '+id,cfg:modelTeam({id,name:'U10 '+id}),...extra});
const build=(fixtures,extra={})=>scheduleFixtureDay({fixtures,cfgList:fixtures.map(f=>f.cfg),useAstro:true,pitchCfg:pitches,startMins:540,endMins:720,maxConcurrent:3,club:{bufferYouth:15},matchDate:'2026-10-10',...extra});
it('free_0900_beats_later_grouping',()=>{
  const fixtures=[make('a',{manualOverrideApplied:true,pitchId:'AST-1',koMins:600,koTime:'10:00'}),make('b',{manualOverrideApplied:true,pitchId:'AST-2',koMins:600,koTime:'10:00'}),make('free')];
  expect(build(fixtures).scheduled.find(f=>f.id==='free').koTime).toBe('09:00');
});
it('referee-only edits do not pin an automatic allocation to its previous kick-off',()=>{
  const fixture=make('ref-edited',{pitchId:'AST-1',koMins:660,koTime:'11:00',endMins:720});
  const fixtures=applyFixtureOverrides([fixture],{'fixture:ref-edited':{fixtureIdentity:'ref-edited',referee:'Pat',refereeStatus:'confirmed'}});
  expect(build(fixtures).scheduled[0]).toMatchObject({koTime:'09:00',referee:'Pat',manualAllocationApplied:false});
});
it('earlier_alternative_beats_later_preference',()=>{
  const a=make('a',{manualOverrideApplied:true,pitchId:'AST-1'}),b=make('b');
  const result=build([a,b]);
  expect(result.scheduled.find(f=>f.id==='b')).toMatchObject({koTime:'09:00',pitchId:'AST-2'});
});
it('three_areas_fill_0900_to_1300',()=>{
  const fixtures=Array.from({length:12},(_,i)=>make('fixture-'+i));
  const result=build(fixtures);
  expect(result.unresolved).toEqual([]);
  expect(result.scheduled.map(f=>f.koTime).sort()).toEqual(['09:00','09:00','09:00','10:00','10:00','10:00','11:00','11:00','11:00','12:00','12:00','12:00']);
});
it('zero_buffer_next_grid',()=>{
  expect(build([make('a'),make('b')],{pitchCfg:[pitches[0]],maxConcurrent:1,club:{bufferYouth:0}}).scheduled.map(f=>f.koTime)).toEqual(['09:00','09:45']);
});
it('non_grid_start_0910',()=>expect(build([make('a'),make('b')],{pitchCfg:[pitches[0]],maxConcurrent:1,startMins:550,club:{bufferYouth:0}}).scheduled.map(f=>f.koTime)).toEqual(['09:10','09:55']));
it('reserve_manual_and_fixed_adult_before_flexible',()=>{
  const pitchCfg=[{id:'P1',format:'11v11'},{id:'P2',format:'11v11'}];
  const fixtures=[make('youth',{cfg:modelTeam({name:'U17 Lisbon',id:'youth',format:'11v11',gameMins:90,defaultPitch:'P1'})}),make('adult',{homeTeam:'HSM Reserves',koTime:'09:00',cfg:modelTeam({id:'adult',name:'HSM Reserves',teamType:'adult',format:'11v11',gameMins:90,defaultPitch:'P1'})})];
  expect(build(fixtures,{pitchCfg}).scheduled.find(f=>f.id==='adult')).toMatchObject({pitchId:'P1',koTime:'09:00',fixedKO:true});
  expect(build(fixtures,{pitchCfg}).scheduled.find(f=>f.id==='youth')).toMatchObject({pitchId:'P2',koTime:'09:00'});
});
it('invalid_manual_intent_is_retained_as_unresolved',()=>{
  const result=build([make('a',{manualOverrideApplied:true,pitchId:'AST-1',koTime:'08:00',koMins:480})]);
  expect(result.scheduled).toEqual([]);
  expect(result.unresolved[0]).toMatchObject({id:'a',pitchId:'AST-1',manualOverrideApplied:true});
  expect(result.unresolved[0].reason).toMatch(/before|window/i);
});
it('parent_checks_every_child',()=>{
  const a=make('a',{manualOverrideApplied:true,pitchId:'AST-3'}),b=make('b',{manualOverrideApplied:true,pitchId:'AST'});
  const result=build([a,b]);
  expect(result.scheduled).toHaveLength(1);
  expect(result.unresolved[0].reason).toMatch(/occup|space/i);
});
it('u17_and_genuine_adult',()=>{
  const youth=make('youth',{cfg:modelTeam({name:'U17 Lisbon',format:'11v11',defaultPitch:'P1',teamType:'adult',gameMins:90})});
  expect(build([youth],{pitchCfg:[{id:'P1',format:'11v11'}]}).scheduled[0]).toMatchObject({koTime:'09:00',fixedKO:false});
  const adult=make('adult',{koTime:'14:30',cfg:modelTeam({name:'HSM Reserves',format:'11v11',defaultPitch:'P1',teamType:'adult',gameMins:90})});
  expect(build([adult],{pitchCfg:[{id:'P1',format:'11v11'}]}).scheduled[0]).toMatchObject({koTime:'14:30',fixedKO:true});
});
it('twenty_rebuilds_same_id_set',()=>{
  const source=[make('knights'),make('cobras'),make('crusaders')];
  const first=build(source).scheduled;
  for(let i=0;i<20;i++) expect(build(first).scheduled.map(f=>[getFixtureFlowIdentity(f),f.pitchId,f.koTime])).toEqual(first.map(f=>[getFixtureFlowIdentity(f),f.pitchId,f.koTime]));
});
it('reversal_once_away_inactive_excluded',()=>{
  const away=make('away',{status:'away',isAwayFixture:true,requiresScheduling:false});
  const reversed=reverseAwayFixture(away);
  const result=build([reversed,make('ordinary',{status:'away'}),make('post',{status:'postponed'})]);
  expect(result.scheduled.map(f=>f.id)).toEqual(['away']);
});
it('distinct_similar_fixtures_preserved',()=>expect(build([make('one'),make('two')]).scheduled.map(f=>f.id)).toEqual(['one','two']));
