import {getPitchFootprint,localWeekday} from './pitchResourceModel.js';
const active=new Set(['requested','provisional','confirmed','completed']);
const dateShift=(key,days)=>{
  const [year,month,day]=key.split('-').map(Number);
  return new Date(Date.UTC(year,month-1,day+days)).toISOString().slice(0,10);
};
const london=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function relativeMinutes(value,dateKey) {
  const date=new Date(value);
  if(!Number.isFinite(date.getTime())) return null;
  const parts=Object.fromEntries(london.formatToParts(date).map(p=>[p.type,p.value]));
  const [year,month,day]=dateKey.split('-').map(Number);
  const dayOffset=(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day))-Date.UTC(year,month-1,day))/86400000;
  return dayOffset*1440+Number(parts.hour)*60+Number(parts.minute);
}
export function bookingToScheduleReservation(booking={}, {pitchCfg=[],matchDate}={}) {
  if(!localWeekday(matchDate)||!active.has(String(booking.status||'provisional').toLowerCase())||String(booking.fixtureVenueRole||booking.fixture_venue_role||'').toLowerCase()==='away') return null;
  const pitchId=booking.pitchId||booking.pitch_id||'';
  const startAt=booking.startAt||booking.start_at,endAt=booking.endAt||booking.end_at;
  let startMins,endMins;
  const setup=Math.max(0,Number(booking.setupBufferMinutes??booking.setup_buffer_minutes??0));
  const clear=Math.max(0,Number(booking.clearDownBufferMinutes??booking.clear_down_buffer_minutes??0));
  if(startAt&&endAt) {
    startMins=relativeMinutes(new Date(new Date(startAt).getTime()-setup*60000),matchDate);
    endMins=relativeMinutes(new Date(new Date(endAt).getTime()+clear*60000),matchDate);
  } else {
    const date=booking.startDate||booking.start_date;
    if(!localWeekday(date)) return null;
    const [y,m,d]=date.split('-').map(Number),[my,mm,md]=matchDate.split('-').map(Number);
    const offset=(Date.UTC(y,m-1,d)-Date.UTC(my,mm-1,md))/86400000*1440;
    const parse=time=>/^\d{2}:\d{2}$/.test(time||'')?Number(time.slice(0,2))*60+Number(time.slice(3)):NaN;
    startMins=offset+parse(booking.startTime||booking.start_time)-setup;
    endMins=offset+parse(booking.endTime||booking.end_time)+clear;
  }
  if(startMins===null||endMins===null||!Number.isFinite(startMins)||!Number.isFinite(endMins)||endMins<=startMins||endMins<=0||startMins>=1440) return null;
  return {fixtureIdentity:booking.sourceId||booking.source_id||'',pitchId,footprint:getPitchFootprint(pitchId,pitchCfg),startMins,endMins,
    teamKey:booking.teamKey||booking.team_key||String(booking.teamName||booking.team_name||'').trim().toLowerCase(),booking};
}
export async function loadScheduleResourceContext({clubId,matchDate,plannerEnabled,loadWorkspace,isCurrent=()=>true}={}) {
  const base={clubId,matchDate,bookings:[],blackouts:[]};
  if(!plannerEnabled) return {...base,status:'disabled'};
  if(!clubId||!localWeekday(matchDate)||typeof loadWorkspace!=='function') throw new Error('Protected bookings require a valid club and date.');
  const result=await loadWorkspace(clubId,{startDate:dateShift(matchDate,-1),endDate:dateShift(matchDate,1)});
  if(!isCurrent()) throw new Error('The club or date changed while loading protected bookings.');
  if(!result||!Array.isArray(result.bookings)||!Array.isArray(result.blackouts)) throw new Error('Protected booking response is incomplete.');
  if((result.clubId&&result.clubId!==clubId)||(result.matchDate&&result.matchDate!==matchDate)||result.bookings.some(b=>(b.clubId||b.club_id)&&(b.clubId||b.club_id)!==clubId)) throw new Error('Protected bookings belong to a different club or date.');
  return {...result,...base,bookings:result.bookings,blackouts:result.blackouts,status:'ready'};
}
export function withScheduleReservations(context,pitchCfg) {
  if(!context) return null;
  const reservations=(context.bookings??[]).map(b=>bookingToScheduleReservation(b,{pitchCfg,matchDate:context.matchDate})).filter(Boolean);
  for(const blackout of context.blackouts??[]) {
    const reservation=bookingToScheduleReservation({...blackout,status:'confirmed'},{pitchCfg,matchDate:context.matchDate});
    if(reservation) reservations.push({...reservation,allPitches:!reservation.pitchId,venueId:blackout.venueId||blackout.venue_id});
  }
  return {...context,reservations};
}
