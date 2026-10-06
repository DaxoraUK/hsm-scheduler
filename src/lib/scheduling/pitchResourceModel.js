// Physical match occupancy is separate from structural containment and training capacity.
const clean=value=>String(value??'').trim();
export const WEEKDAYS=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
export function localWeekday(matchDate) {
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(clean(matchDate));
  if(!match) return null;
  const [y,m,d]=match.slice(1).map(Number);
  const date=new Date(Date.UTC(y,m-1,d));
  if(date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d) return null;
  return WEEKDAYS[date.getUTCDay()];
}
export function parsePitchTime(value) {
  const match=/^(\d{2}):(\d{2})$/.exec(clean(value));
  if(!match) return null;
  const h=Number(match[1]),m=Number(match[2]);
  return m<60&&(h<24||(h===24&&m===0)) ? h*60+m : null;
}
export function normalisePitchSchedulingFields(pitch={}) {
  const result={...pitch};
  if(Array.isArray(pitch.playingAreas)) result.playingAreas=pitch.playingAreas.map(area=>({...area,id:clean(area.id),label:clean(area.label)}));
  if(Array.isArray(pitch.playingAreaIds)) result.playingAreaIds=pitch.playingAreaIds.map(clean);
  if(pitch.availabilityByDay&&typeof pitch.availabilityByDay==='object') {
    result.availabilityByDay=Object.fromEntries(Object.entries(pitch.availabilityByDay).map(([day,windows])=>[day,Array.isArray(windows)?windows.map(window=>({...window,from:clean(window.from),to:clean(window.to)})):windows]));
  }
  return result;
}
export function validatePitchSchedulingConfig(pitches=[]) {
  const errors=[], ids=new Set();
  const fail=(pitch,reason)=>errors.push({pitchId:pitch?.id??'',reason});
  for(const pitch of pitches) {
    if(!clean(pitch.id)||ids.has(pitch.id)) fail(pitch,'Pitch IDs must be present and unique.');
    ids.add(pitch.id);
  }
  const byId=new Map(pitches.map(p=>[p.id,p]));
  for(const pitch of pitches) {
    const parent=pitch.innerOf?byId.get(pitch.innerOf):null;
    if(pitch.innerOf&&(!parent||parent.innerOf||parent.id===pitch.id)) fail(pitch,'Select an existing root parent; nested or cyclic layouts are not supported.');
    const areas=pitch.playingAreas??[];
    if(!Array.isArray(areas)||areas.some(a=>!clean(a.id))||new Set(areas.map(a=>a.id)).size!==areas.length) fail(pitch,'Playing area IDs must be present and unique.');
    if(pitch.playingAreaIds!==undefined) {
      const mapped=pitch.playingAreaIds;
      const allowed=new Set((parent?.playingAreas??[]).map(a=>a.id));
      if(!parent||!Array.isArray(mapped)||mapped.length===0||new Set(mapped).size!==mapped.length||mapped.some(id=>!allowed.has(id))) fail(pitch,'Map this layout to existing playing areas of its parent.');
    }
    if(pitch.availabilityByDay!=null) {
      if(typeof pitch.availabilityByDay!=='object'||Array.isArray(pitch.availabilityByDay)) {fail(pitch,'Availability must contain weekday windows.');continue;}
      for(const [day,windows] of Object.entries(pitch.availabilityByDay)) {
        if(!WEEKDAYS.includes(day)) {fail(pitch,'Invalid weekday.');continue;}
        if(windows==null) continue;
        if(!Array.isArray(windows)) {fail(pitch,'Availability must be a list of windows.');continue;}
        const intervals=windows.map(w=>({start:parsePitchTime(w.from),end:parsePitchTime(w.to)}));
        if(intervals.some(w=>w.start===null||w.end===null||w.start>=w.end)) {fail(pitch,'Enter valid same-day available-from/until times.');continue;}
        intervals.sort((a,b)=>a.start-b.start);
        if(intervals.some((w,i)=>i>0&&w.start<intervals[i-1].end)) fail(pitch,'Availability windows must not overlap.');
      }
    }
  }
  return {ok:errors.length===0,errors};
}
export function getPitchFootprint(pitchId,pitches=[]) {
  const pitch=pitches.find(p=>p.id===pitchId);
  if(!pitch) return [];
  const root=pitch.innerOf?pitches.find(p=>p.id===pitch.innerOf):pitch;
  if(!root||root.innerOf) return [];
  const all=(root.playingAreas??[]).map(area=>area.id);
  const requested=pitch.innerOf&&Array.isArray(pitch.playingAreaIds)&&pitch.playingAreaIds.length?pitch.playingAreaIds:all;
  if(requested.some(id=>!all.includes(id))) return [];
  return (requested.length?requested:['__whole__']).map(id=>JSON.stringify([root.id,id]));
}
export function pitchesShareSpace(firstId,secondId,pitches=[]) {
  const first=new Set(getPitchFootprint(firstId,pitches));
  return getPitchFootprint(secondId,pitches).some(token=>first.has(token));
}
export function getPitchClosureTargets(closedPitchIds=[],pitches=[]) {
  return pitches.filter(pitch=>closedPitchIds.includes(pitch.id)||closedPitchIds.some(id=>pitchesShareSpace(id,pitch.id,pitches))).map(pitch=>pitch.id);
}
export function getPitchAvailability({pitchId,pitches=[],matchDate}) {
  const weekday=localWeekday(matchDate);
  const seen=new Set();
  const resolve=id=>{
    const pitch=pitches.find(p=>p.id===id);
    if(!pitch||seen.has(id)) return [];
    seen.add(id);
    const parent=pitch.innerOf?resolve(pitch.innerOf):[{startMins:0,endMins:1440}];
    const windows=weekday?pitch.availabilityByDay?.[weekday]:null;
    if(windows==null) return parent;
    if(!Array.isArray(windows)) return [];
    return windows.flatMap(w=>{
      const start=parsePitchTime(w.from),end=parsePitchTime(w.to);
      if(start===null||end===null||end<=start) return [];
      return parent.map(p=>({startMins:Math.max(start,p.startMins),endMins:Math.min(end,p.endMins)})).filter(p=>p.endMins>p.startMins);
    });
  };
  return resolve(pitchId);
}
export function isPitchIndependent(pitchId,pitches=[]) {
  const pitch=pitches.find(p=>p.id===pitchId);
  if(!pitch) return false;
  if(typeof pitch.independent==='boolean') return pitch.independent;
  return pitch.innerOf?isPitchIndependent(pitch.innerOf,pitches):['AST','3v3'].includes(pitch.id);
}
