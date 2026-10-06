import {mergeFixtureScheduleResults,deduplicateFixtureSet} from '../domain/fixtureVenueFlow.js';
import {writeMatchdayScheduleDraft} from '../storage/matchdayScheduleDraft.js';
// Async preparation, not a second allocator. Callers swap state only after this succeeds.
export async function prepareScopedScheduleDraft({context,dayKey,matchDate,all,away,overrides,schedule,loadResources,writeDraft=writeMatchdayScheduleDraft,isCurrent=()=>true}) {
  try {
    const resourceContext=await loadResources();
    if(!isCurrent()) throw new Error('The club, date or settings changed. Retry this rebuild.');
    const result=schedule(resourceContext);
    const scheduled=mergeFixtureScheduleResults(all,result.scheduled,away);
    const unresolved=deduplicateFixtureSet(result.unresolved);
    if(!isCurrent()||!writeDraft({context,dayKey,matchDate,scheduled,unresolved,overrides})) throw new Error('The local schedule draft could not be saved. The previous schedule was kept.');
    return {ok:true,scheduled,unresolved,resourceContext};
  } catch(error) {return {ok:false,reason:error?.message||'Schedule preparation failed.'};}
}
