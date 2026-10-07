import {test,expect} from 'vitest';
import {matchdayFixtureToAnnualBooking} from '../../src/lib/planning/annualPlannerEngine.js';
import {bookingToScheduleReservation} from '../../src/lib/scheduling/scheduleResourceContext.js';
import {requiresLocalOfficial} from '../../src/lib/engines/officialsEngine.js';
import {modelFixture,modelPitches} from '../helpers/capacitySchedulingFixtures.js';
const pitchCfg=modelPitches(),matchDate='2026-10-10';
test.each([{status:'void'},{status:'withdrawn'},{status:'scheduled',lifecycleStatus:'postponed'},{status:'scheduled',lifecycleStatus:'abandoned'}])('inactive lifecycle %j remains on calendar but creates no protected occupancy or official task',patch=>{
  const fixture=modelFixture({pitchId:'AST-1',...patch});
  const booking=matchdayFixtureToAnnualBooking(fixture,{date:matchDate,pitchCfg});
  expect(['postponed','cancelled']).toContain(booking.status);expect(booking.pitchId).toBe('');
  expect(bookingToScheduleReservation(booking,{pitchCfg,matchDate})).toBe(null);
  expect(requiresLocalOfficial(fixture)).toBe(false);
});
test('ordinary Home needs an official and reserves its pitch; Away has calendar visibility without local demand',()=>{
  const home=modelFixture({pitchId:'AST-1'});
  expect(requiresLocalOfficial(home)).toBe(true);
  expect(bookingToScheduleReservation(matchdayFixtureToAnnualBooking(home,{date:matchDate,pitchCfg}),{pitchCfg,matchDate})).toBeTruthy();
  const away={...home,homeAway:'away'};
  const booking=matchdayFixtureToAnnualBooking(away,{date:matchDate,pitchCfg});
  expect(booking.fixtureVenueRole).toBe('away');expect(booking.pitchId).toBe('');
  expect(requiresLocalOfficial(away)).toBe(false);
});
