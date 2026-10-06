import {getFixtureFlowIdentity} from '../domain/fixtureVenueFlow.js';
import {isFixtureSchedulingDemand} from '../domain/fixtureLifecycle.js';
import {isPitchSuitableForFixture} from '../intelligence/pitch/pitchService.js';
import {getKickOffRuleFailure} from '../intelligence/scheduling/kickOffRules.js';
import {getFixtureOccupancyMinutes} from './fixtureTiming.js';
import {getPitchAvailability,getPitchFootprint,getPitchClosureTargets,pitchesShareSpace,isPitchIndependent} from './pitchResourceModel.js';

export const getSchedulePitchId=fixture=>fixture.pitchId||fixture.pitch||'';
export const getScheduleStart=fixture=>Number.isFinite(fixture.koMins)?fixture.koMins:typeof fixture.koTime==='string'&&/^\d{2}:\d{2}$/.test(fixture.koTime)?Number(fixture.koTime.slice(0,2))*60+Number(fixture.koTime.slice(3)):null;
export function getScheduleTeamKeys(fixture={}) {
  // Home canonical cfg identifies the club team; opponent identity, when supplied, is separate.
  return [fixture.cfg?.id? 'id:'+fixture.cfg.id:String(fixture.cfg?.name||fixture.homeTeam||fixture.teamName||'').trim().toLowerCase(),
    fixture.awayTeamId?'id:'+fixture.awayTeamId:String(fixture.awayTeam||'').trim().toLowerCase()].filter(Boolean);
}
const overlap=(a,b)=>a.start<b.end&&b.start<a.end;
const fail=(type,reason,clash=null,meta=null)=>({ok:false,type,reason,clash,meta});
export function getScheduleResourceFailure({fixtures=[],fixtureIdentity,next={},pitchCfg=[],closedPitches=[],club={},matchDate,resourceContext=null}={}) {
  if(!isFixtureSchedulingDemand(next)) return null;
  const id=getSchedulePitchId(next),pitch=pitchCfg.find(p=>p.id===id);
  if(!pitch||!getPitchFootprint(id,pitchCfg).length||!isPitchSuitableForFixture(pitch,next)) return fail('pitch_unsuitable','Select an existing pitch suitable for this fixture format.');
  if(club.useAstro===false&&(['astro','3g','4g','artificial'].includes(pitch.surface)||pitch.astroOnly)) return fail('pitch_surface','Artificial pitches are disabled for this schedule.');
  const closed=[...closedPitches,...pitchCfg.filter(p=>p.closed||p.isClosed).map(p=>p.id)];
  if(getPitchClosureTargets(closed,pitchCfg).includes(id)) return fail('pitch_closed',(pitch.label||id)+' is unavailable because its playing space is closed.');
  const start=getScheduleStart(next),end=start+getFixtureOccupancyMinutes(next,{club});
  if(start===null||!Number.isFinite(end)||end<=start) return fail('pitch_availability','Enter a valid kick-off and positive duration.');
  const timing=getKickOffRuleFailure({fixture:next,koTime:next.koTime,club});
  if(timing) return {...timing,reason:timing.detail};
  const windows=getPitchAvailability({pitchId:id,pitches:pitchCfg,matchDate:matchDate||next.date||next.fixtureDate});
  if(!windows.some(w=>start>=w.startMins&&end<=w.endMins)) return fail('pitch_availability','The fixture and turnaround must fit within the pitch available-from/until window.');
  if(resourceContext&&(!['ready','disabled'].includes(resourceContext.status)||(resourceContext.matchDate&&matchDate&&resourceContext.matchDate!==matchDate)||(club.id&&resourceContext.clubId&&club.id!==resourceContext.clubId))) return fail('resource_context','Protected bookings are not ready for this club and date. Retry before moving or rebuilding.');
  const range={start,end};
  const other=fixtures.filter(f=>isFixtureSchedulingDemand(f)&&getFixtureFlowIdentity(f)!==fixtureIdentity).map(f=>({
    fixture:f,start:getScheduleStart(f),end:getScheduleStart(f)+getFixtureOccupancyMinutes(f,{club}),
  })).filter(f=>f.start!==null&&overlap(range,f));
  const clash=other.find(f=>pitchesShareSpace(id,getSchedulePitchId(f.fixture),pitchCfg));
  if(clash) return fail('pitch_clash',(clash.fixture.homeTeam||'Another fixture')+' already occupies this playing space at '+(clash.fixture.koTime||'that time')+'.',clash.fixture);
  const teams=new Set(getScheduleTeamKeys(next));
  const teamClash=other.find(f=>getScheduleTeamKeys(f.fixture).some(key=>teams.has(key)));
  if(teamClash) return fail('team_clash',(next.cfg?.name||next.homeTeam||'This team')+' already has a fixture at this time.',teamClash.fixture);
  for(const booking of resourceContext?.reservations??[]) {
    if(booking.fixtureIdentity&&booking.fixtureIdentity===fixtureIdentity) continue;
    if(!overlap(range,{start:booking.startMins,end:booking.endMins})) continue;
    if((booking.allPitches&&(!booking.venueId||!pitch.siteId||booking.venueId===pitch.siteId))||pitchesShareSpace(id,booking.pitchId,pitchCfg)||(booking.teamKey&&(teams.has(booking.teamKey)||teams.has('id:'+booking.teamKey)))) return fail('resource_booking','A protected planner booking occupies this pitch or team at this time.',booking);
  }
  const max=Number(club.maxConcurrent);
  if(max>0&&!isPitchIndependent(id,pitchCfg)) {
    const intervals=other.filter(f=>!isPitchIndependent(getSchedulePitchId(f.fixture),pitchCfg));
    const points=[start,...intervals.map(f=>f.start).filter(t=>t>start&&t<end)];
    const peak=Math.max(...points.map(t=>1+intervals.filter(f=>f.start<=t&&f.end>t).length));
    if(peak>max) return fail('schedule_concurrency','This reservation exceeds the configured maximum of '+max+' simultaneous games.',null,{peak,maxConcurrent:max});
  }
  return null;
}
