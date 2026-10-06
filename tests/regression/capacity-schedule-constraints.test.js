import {describe,it,expect} from 'vitest';
import {modelPitches,modelFixture,modelTeam} from '../helpers/capacitySchedulingFixtures.js';
import {classifyFixtureTeam,getFixtureOccupancyMinutes} from '../../src/lib/scheduling/fixtureTiming.js';
import {getScheduleResourceFailure} from '../../src/lib/scheduling/scheduleConstraints.js';
import {isFixtureSchedulingDemand} from '../../src/lib/domain/fixtureLifecycle.js';
import {validateFixtureUpdate} from '../../src/lib/engines/validationEngine.js';
const pitches=modelPitches();
const club={startHour:9,startMin:0,endHour:12,endMin:0,bufferYouth:0,maxConcurrent:3,useAstro:true,parkingEnabled:false};
const fixture=(id,pitchId,start,end)=>modelFixture({id,sourceFixtureKey:id,homeTeam:id,awayTeam:'Visitors '+id,cfg:modelTeam({id,name:id}),pitchId,koMins:start,koTime:String(Math.floor(start/60)).padStart(2,'0')+':'+String(start%60).padStart(2,'0'),endMins:end});
const failure=(next,fixtures=[],options={})=>getScheduleResourceFailure({fixtures,next,fixtureIdentity:next.sourceFixtureKey,pitchCfg:pitches,closedPitches:[],club,matchDate:'2026-10-10',...options});
describe('shared hard scheduling rules',()=>{
  it('zero_buffer_is_real',()=>expect(getFixtureOccupancyMinutes(modelFixture(),{club:{bufferYouth:0},preserveExisting:false})).toBe(45));
  it('move_preserves_45_minutes',()=>expect(getFixtureOccupancyMinutes(modelFixture({endMins:585}),{club:{bufferYouth:30}})).toBe(45));
  it('u17_generic_11v11_on_p1_is_youth',()=>expect(classifyFixtureTeam({cfg:{name:'U17 Lisbon',format:'11v11',defaultPitch:'P1',teamType:'adult'}})).toBe('youth'));
  it('open_age_is_adult',()=>{
    expect(classifyFixtureTeam({cfg:{name:'HSM Reserves',format:'11v11'}})).toBe('adult');
    expect(classifyFixtureTeam({cfg:{name:'Unknown',format:'11v11',defaultPitch:'P1'}})).toBe('unknown');
  });
  it('concurrency_checked_at_interval_changes',()=>{
    const next=fixture('moving','AST-3',540,660);
    expect(failure(next,[fixture('a','AST-1',550,570),fixture('b','AST-2',600,620)],{club:{...club,maxConcurrent:2}})).toBe(null);
    expect(failure(next,[fixture('a','AST-1',600,640),fixture('b','AST-2',615,645)],{club:{...club,maxConcurrent:2}})).toMatchObject({type:'schedule_concurrency'});
    const independent=pitches.map(p=>p.id==='AST'?{...p,independent:true}:p);
    expect(failure(next,[fixture('a','AST-1',600,640)],{pitchCfg:independent,club:{...club,maxConcurrent:1}})).toBe(null);
  });
  it('parking_warning_does_not_hide_hard_conflict',()=>{
    const fixtures=[fixture('moving','AST-1',540,600),fixture('other','AST-2',540,600)];
    const opts={fixtures,fixtureIndex:0,patch:{pitchId:'AST-3'},pitchCfg:pitches,club:{...club,parkingEnabled:true,carParkSpaces:1,maxConcurrent:3},changeType:'schedule'};
    expect(validateFixtureUpdate(opts).ok).toBe(true);
    expect(validateFixtureUpdate({...opts,club:{...opts.club,maxConcurrent:1}})).toMatchObject({ok:false,type:'schedule_concurrency'});
  });
  it('team_cannot_play_twice',()=>{
    const next=fixture('next','AST-2',540,600), other=fixture('other','AST-1',550,620);
    next.cfg.id=other.cfg.id='same-team';
    expect(failure(next,[other])).toMatchObject({type:'team_clash'});
  });
  it('latest_ko_is_not_pitch_finish',()=>{
    const next=fixture('next','AST-1',720,765);
    expect(failure(next)).toBe(null);
    const configured=modelPitches({availabilityByDay:{saturday:[{from:'09:00',to:'12:45'}]}});
    expect(failure(next,[],{pitchCfg:configured})).toBe(null);
    expect(failure({...next,endMins:766},[],{pitchCfg:configured})).toMatchObject({type:'pitch_availability'});
  });
  it('invalid_pitch_fails_closed',()=>expect(failure(fixture('next','missing',540,600))).toMatchObject({type:'pitch_unsuitable'}));
  it('grid_can_start_at_0910',()=>expect(failure(fixture('next','AST-1',550,595),[],{club:{...club,startMin:10}})).toBe(null));
  it('inactive_away_retained_without_demand',()=>{
    for(const status of ['postponed','cancelled','canceled','abandoned','void','withdrawn','away']) expect(isFixtureSchedulingDemand(modelFixture({status}))).toBe(false);
    expect(isFixtureSchedulingDemand(modelFixture({homeAway:'away'}))).toBe(false);
    expect(isFixtureSchedulingDemand(modelFixture())).toBe(true);
  });
});
