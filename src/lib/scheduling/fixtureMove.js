import {getFixtureFlowIdentity} from '../domain/fixtureVenueFlow.js';
import {isFixtureSchedulingDemand} from '../domain/fixtureLifecycle.js';
import {getFixtureOccupancyMinutes} from './fixtureTiming.js';
import {getScheduleStart} from './scheduleConstraints.js';
import {validateFixtureUpdate,minutesToTime,timeToMinutes} from '../engines/validationEngine.js';

const allocationFields=['pitchId','pitchLabel','koMins','koTime','endMins','endTime'];
const failure=(type,reason)=>({ok:false,type,reason});
export function resolveFixtureMoveTarget(fixtures=[],fixtureIdentity) {
  const matches=fixtureIdentity?fixtures.map((f,i)=>getFixtureFlowIdentity(f)===fixtureIdentity?i:-1).filter(i=>i>=0):[];
  if(matches.length!==1) return failure('stale_fixture','This fixture is missing or ambiguous. Refresh the schedule.');
  return {ok:true,fixtureIndex:matches[0],fixture:fixtures[matches[0]]};
}
export function buildFixtureAllocationPatch({fixture={},pitch={},koMins=getScheduleStart(fixture),club={}}={}) {
  const endMins=koMins+getFixtureOccupancyMinutes(fixture,{club});
  return {pitchId:pitch.id,pitchLabel:pitch.label||pitch.id,koMins,koTime:minutesToTime(koMins),endMins,endTime:minutesToTime(endMins)};
}
export function updateFixtureOverridePatch(overrides={},fixtureIdentity,patch={}) {
  const next={...overrides};let existing={};
  Object.entries(next).forEach(([key,value])=>{if(value?.fixtureIdentity===fixtureIdentity){existing={...existing,...value};delete next[key];}});
  next['fixture:'+fixtureIdentity]={...existing,...patch,fixtureIdentity};
  return next;
}
export function validateFixtureMove({fixtures=[],fixtureIdentity,patch={},pitchCfg=[],club={},readOnly=false,expectedPreviousPatch,...context}={}) {
  if(readOnly) return failure('schedule_locked','This schedule is read-only or locked.');
  const target=resolveFixtureMoveTarget(fixtures,fixtureIdentity);
  if(!target.ok) return target;
  if(!isFixtureSchedulingDemand(target.fixture)) return failure('inactive_fixture','Only active Home fixtures need pitch allocation.');
  if(expectedPreviousPatch&&['pitchId','koMins','endMins'].some(field=>Object.hasOwn(expectedPreviousPatch,field)&&expectedPreviousPatch[field]!==target.fixture[field])) return failure('stale_move','The fixture allocation changed since this move was previewed. Review it again.');
  const pitch=pitchCfg.find(p=>p.id===(patch.pitchId??target.fixture.pitchId??target.fixture.pitch));
  const koMins=Object.hasOwn(patch,'koMins')?patch.koMins:Object.hasOwn(patch,'koTime')?timeToMinutes(patch.koTime):getScheduleStart(target.fixture);
  if(!pitch||!Number.isFinite(koMins)||koMins<0||koMins>=1440) return failure('invalid_allocation','Select a pitch and valid kick-off time.');
  const complete=buildFixtureAllocationPatch({fixture:target.fixture,pitch,koMins,club});
  const validation=validateFixtureUpdate({fixtures,fixtureIdentity,patch:complete,pitchCfg,club,...context});
  if(!validation.ok) return validation;
  const updated=fixtures.map((fixture,index)=>index===target.fixtureIndex?{...fixture,...complete,manualOverrideApplied:true}:fixture);
  return {...validation,...target,patch:complete,previousPatch:Object.fromEntries(allocationFields.map(field=>[field,target.fixture[field]])),fixtures:updated,fixtureIdentity};
}
export function validateFixtureMoveBatch({fixtures=[],moves=[],...context}={}) {
  let current=fixtures;const applied=[];
  for(const request of moves) {
    const result=validateFixtureMove({...context,fixtures:current,...request});
    if(!result.ok) return {...result,fixtures,moves:[],failures:[result]};
    current=result.fixtures;applied.push(result);
  }
  return {ok:true,fixtures:current,moves:applied,failures:[]};
}
// Re-read the complete day after asynchronous protection checks. Persist before
// committing either state or overrides; a rejected transaction has no side effects.
export async function applyFixtureMoveTransaction({getCurrent,request,loadResources,writeDraft,commitState,isCurrent=()=>true}) {
  try {
    const resourceContext=await loadResources();
    if(!isCurrent()) return failure('stale_scope','The club, date or settings changed. Retry the move.');
    const snapshot=getCurrent();
    const result=validateFixtureMoveBatch({...snapshot,resourceContext,moves:request.moves||[request]});
    if(!result.ok) return result;
    let overrides=snapshot.overrides||{};
    result.moves.forEach(move=>{overrides=updateFixtureOverridePatch(overrides,move.fixtureIdentity,move.patch);});
    const committed={...result,overrides};
    if(writeDraft(committed)!==true) return failure('draft_save','The local schedule draft could not be saved. The move was not applied.');
    commitState(committed);
    return committed;
  } catch(error) {return failure('move_failed',error?.message||'The move could not be applied.');}
}
