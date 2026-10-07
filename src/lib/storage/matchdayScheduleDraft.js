import {getTenantStorageContext,tenantGetJson,tenantSetJson,tenantRemoveItem} from './tenantStorage.js';
import {localWeekday} from '../scheduling/pitchResourceModel.js';
import {ensureManualFixtureIdentity,getFixtureFlowIdentity} from '../domain/fixtureVenueFlow.js';
const key=({dayKey,matchDate})=>'schedule-draft:'+dayKey+':'+matchDate;
const matches=context=>{
  const current=getTenantStorageContext();
  return Boolean(context?.userId&&context?.clubId&&current.userId===context.userId&&current.clubId===context.clubId);
};
const validScope=args=>['saturday','sunday','midweek'].includes(args.dayKey)&&localWeekday(args.matchDate)!==null;
export function writeMatchdayScheduleDraft(args) {
  if(!matches(args.context)||!validScope(args)||!Array.isArray(args.scheduled)||!Array.isArray(args.unresolved)) return false;
  return tenantSetJson(key(args),{version:1,context:args.context,dayKey:args.dayKey,matchDate:args.matchDate,scheduled:args.scheduled,unresolved:args.unresolved,overrides:args.overrides??{},manualFixtures:args.manualFixtures??[]});
}
export function readMatchdayScheduleDraft(args) {
  if(!matches(args.context)||!validScope(args)) return null;
  const draft=tenantGetJson(key(args));
  if(draft?.version!==1||draft?.dayKey!==args.dayKey||draft?.matchDate!==args.matchDate||!matches(draft?.context)||!Array.isArray(draft.scheduled)||!Array.isArray(draft.unresolved)||!draft.overrides||typeof draft.overrides!=='object') return null;
  // Older local drafts did not retain canonical manual inputs. Recover only
  // actual Manual-form records, never imported records merely resolved by hand.
  const manualFixtures=Array.isArray(draft.manualFixtures)?draft.manualFixtures:[...draft.scheduled,...draft.unresolved].filter(f=>f.manual&&(f.league==='Manual'||f.date==='Manual'));
  // An old form had no immutable ID. A unique legacy row can be upgraded, but
  // two indistinguishable inputs cannot safely share an alias or override.
  for(const collection of [manualFixtures,draft.scheduled,draft.unresolved]) {
    const identities=new Set();
    for(const fixture of collection) {
      if(!fixture.manual||fixture.sourceFixtureUrl||fixture.sourceFixtureKey||fixture.fixtureId||fixture.fullTimeId||fixture.id) continue;
      const identity=getFixtureFlowIdentity(fixture);
      if(identities.has(identity)) throw new Error('The saved draft contains ambiguous legacy manual fixtures. It was not changed; review the original fixtures before rebuilding.');
      identities.add(identity);
    }
  }
  const aliases=new Map();
  const upgrade=fixture=>{
    const old=getFixtureFlowIdentity(fixture);
    if(aliases.has(old)) return {...fixture,sourceFixtureKey:aliases.get(old)};
    const next=ensureManualFixtureIdentity(fixture);
    if(next!==fixture) aliases.set(old,next.sourceFixtureKey);
    return next;
  };
  const manual=manualFixtures.map(upgrade);
  const scheduled=draft.scheduled.map(upgrade),unresolved=draft.unresolved.map(upgrade);
  const overrides=Object.fromEntries(Object.entries(draft.overrides).map(([name,value])=>{
    const identity=aliases.get(value?.fixtureIdentity);
    return identity?[`fixture:${identity}`,{...value,fixtureIdentity:identity}]:[name,value];
  }));
  const next={...draft,manualFixtures:manual,scheduled,unresolved,overrides};
  if(JSON.stringify(next)!==JSON.stringify(draft)&&!tenantSetJson(key(args),next)) return null;
  return next;
}
export function removeMatchdayScheduleDraft(args) {
  return matches(args.context)&&validScope(args)?tenantRemoveItem(key(args)):false;
}
