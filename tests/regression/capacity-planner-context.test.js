import {it,expect,vi} from 'vitest';
import {modelPitches,modelFixture} from '../helpers/capacitySchedulingFixtures.js';
import {loadScheduleResourceContext,bookingToScheduleReservation} from '../../src/lib/scheduling/scheduleResourceContext.js';
import {detectAnnualPlannerConflicts} from '../../src/lib/planning/annualPlannerEngine.js';
import {getScheduleResourceFailure} from '../../src/lib/scheduling/scheduleConstraints.js';
const pitches=modelPitches();
const booking=(pitchId,extra={})=>({id:'booking-one',clubId:'a',bookingType:'friendly',status:'confirmed',pitchId,startDate:'2026-10-10',startTime:'09:00',endTime:'10:00',...extra});
const candidate=booking('AST-1');
it('full_parent_booking_blocks_child',()=>expect(detectAnnualPlannerConflicts(candidate,{bookings:[booking('AST')],pitches})).not.toHaveLength(0));
it('disjoint_child_booking_does_not_block_sibling',()=>expect(detectAnnualPlannerConflicts(candidate,{bookings:[booking('AST-2')],pitches})).toHaveLength(0));
it('unmapped_training_area_blocks_match_parent',()=>expect(detectAnnualPlannerConflicts(candidate,{bookings:[booking('AST',{bookingType:'training',pitchAreaId:'training-left'})],pitches})).not.toHaveLength(0));
it('own_sync_booking_is_ignored_only_by_identity',()=>{
  const reservation=bookingToScheduleReservation(booking('AST-1',{sourceId:'source:one',sourceType:'matchday'}),{pitchCfg:pitches,matchDate:'2026-10-10'});
  const options={next:modelFixture({pitchId:'AST-1'}),fixtureIdentity:'source:one',pitchCfg:pitches,club:{useAstro:true},matchDate:'2026-10-10',resourceContext:{status:'ready',clubId:'a',matchDate:'2026-10-10',reservations:[reservation]}};
  expect(getScheduleResourceFailure(options)).toBe(null);
  expect(getScheduleResourceFailure({...options,fixtureIdentity:'source:other'})).toMatchObject({type:'resource_booking'});
});
it('uk_date_window_and_midweek_weekday',async()=>{
  const loader=vi.fn().mockResolvedValue({bookings:[],blackouts:[]});
  await loadScheduleResourceContext({clubId:'a',matchDate:'2026-10-25',plannerEnabled:true,loadWorkspace:loader});
  expect(loader).toHaveBeenCalledWith('a',{startDate:'2026-10-24',endDate:'2026-10-26'});
  expect(bookingToScheduleReservation(booking('AST',{startAt:'2026-10-10T08:00:00Z',endAt:'2026-10-10T09:00:00Z',setupBufferMinutes:15}),{pitchCfg:pitches,matchDate:'2026-10-10'})).toMatchObject({startMins:525,endMins:600});
  expect(bookingToScheduleReservation(booking('AST',{status:'postponed'}),{pitchCfg:pitches,matchDate:'2026-10-10'})).toBe(null);
});
it('resource_load_failure_is_not_ready',async()=>{
  await expect(loadScheduleResourceContext({clubId:'a',matchDate:'2026-10-25',plannerEnabled:true,loadWorkspace:()=>Promise.reject(new Error('offline'))})).rejects.toThrow('offline');
});
it('club_switch_ignores_old_response',async()=>{
  await expect(loadScheduleResourceContext({clubId:'a',matchDate:'2026-10-25',plannerEnabled:true,loadWorkspace:async()=>({clubId:'b',bookings:[],blackouts:[]})})).rejects.toThrow(/club/i);
});
