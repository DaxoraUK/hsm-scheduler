import {getTenantStorageContext,tenantGetJson,tenantSetJson,tenantRemoveItem} from './tenantStorage.js';
import {localWeekday} from '../scheduling/pitchResourceModel.js';
const key=({dayKey,matchDate})=>'schedule-draft:'+dayKey+':'+matchDate;
const matches=context=>{
  const current=getTenantStorageContext();
  return Boolean(context?.userId&&context?.clubId&&current.userId===context.userId&&current.clubId===context.clubId);
};
const validScope=args=>['saturday','sunday','midweek'].includes(args.dayKey)&&localWeekday(args.matchDate)!==null;
export function writeMatchdayScheduleDraft(args) {
  if(!matches(args.context)||!validScope(args)||!Array.isArray(args.scheduled)||!Array.isArray(args.unresolved)) return false;
  return tenantSetJson(key(args),{version:1,context:args.context,dayKey:args.dayKey,matchDate:args.matchDate,scheduled:args.scheduled,unresolved:args.unresolved,overrides:args.overrides??{}});
}
export function readMatchdayScheduleDraft(args) {
  if(!matches(args.context)||!validScope(args)) return null;
  const draft=tenantGetJson(key(args));
  if(draft?.version!==1||draft?.dayKey!==args.dayKey||draft?.matchDate!==args.matchDate||!matches(draft?.context)||!Array.isArray(draft.scheduled)||!Array.isArray(draft.unresolved)||!draft.overrides||typeof draft.overrides!=='object') return null;
  return draft;
}
export function removeMatchdayScheduleDraft(args) {
  return matches(args.context)&&validScope(args)?tenantRemoveItem(key(args)):false;
}
