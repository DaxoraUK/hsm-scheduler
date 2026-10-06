import {describe,it,expect} from 'vitest';
import {modelPitches} from '../helpers/capacitySchedulingFixtures.js';
import {normalisePitchSchedulingFields,validatePitchSchedulingConfig,getPitchFootprint,pitchesShareSpace,getPitchClosureTargets,getPitchAvailability} from '../../src/lib/scheduling/pitchResourceModel.js';
import {createPitchRegistry} from '../../src/lib/registry/pitchRegistry.js';

describe('physical resources',()=>{
  it('separate_two_three_ten_areas',()=>{
    for(const count of [2,3,10]) {
      const pitches=modelPitches({count});
      expect(pitchesShareSpace('AST-1','AST-2',pitches)).toBe(false);
      expect(getPitchFootprint('AST',pitches)).toHaveLength(count);
      expect(createPitchRegistry(pitches).getPitch('AST').independent).toBe(false);
    }
  });
  it('parent_conflicts_with_last_child',()=>expect(pitchesShareSpace('AST','AST-10',modelPitches({count:10}))).toBe(true));
  it('alternative_layouts_overlap',()=>{
    const pitches=[...modelPitches(),{id:'large',innerOf:'AST',playingAreaIds:['area-1','area-2']}];
    expect(pitchesShareSpace('large','AST-2',pitches)).toBe(true);
    expect(pitchesShareSpace('large','AST-3',pitches)).toBe(false);
  });
  it('legacy_children_are_conservative',()=>{
    const pitches=[...modelPitches(),{id:'legacy',innerOf:'AST'}];
    expect(pitchesShareSpace('legacy','AST-3',pitches)).toBe(true);
  });
  it('partial_closure_leaves_separate_sibling_open',()=>{
    expect(getPitchClosureTargets(['AST-1'],modelPitches())).toEqual(['AST','AST-1']);
    expect(getPitchClosureTargets(['AST'],modelPitches())).toEqual(['AST','AST-1','AST-2','AST-3']);
  });
  it('window_inheritance_and_intersection',()=>{
    const pitches=modelPitches({availabilityByDay:{saturday:[{from:'09:00',to:'13:00'}]}});
    pitches[1].availabilityByDay={saturday:[{from:'08:00',to:'10:00'},{from:'12:00',to:'15:00'}]};
    expect(getPitchAvailability({pitchId:'AST-1',pitches,matchDate:'2026-10-10'})).toEqual([{startMins:540,endMins:600},{startMins:720,endMins:780}]);
    pitches[1].availabilityByDay.saturday=[];
    expect(getPitchAvailability({pitchId:'AST-1',pitches,matchDate:'2026-10-10'})).toEqual([]);
    expect(getPitchAvailability({pitchId:'AST-2',pitches,matchDate:'2026-10-11'})).toEqual([{startMins:0,endMins:1440}]);
  });
  it('invalid_mapping_is_rejected',()=>{
    for(const mutate of [
      p=>p[1].playingAreaIds=['missing'],p=>p[1].innerOf='missing',p=>p[0].innerOf='AST-1',
      p=>p[1].innerOf='AST-2',p=>p[1].id='AST',p=>p[0].playingAreas.push({id:'area-1'}),
      p=>p[0].availabilityByDay={saturday:[{from:'22:00',to:'08:00'}]},
      p=>p[0].availabilityByDay={saturday:[{from:'09:00',to:'11:00'},{from:'10:00',to:'12:00'}]},
      p=>p[0].availabilityByDay={saturday:[{from:'9:AA',to:'11:00'}]},
    ]) {const pitches=modelPitches();mutate(pitches);expect(validatePitchSchedulingConfig(pitches).ok).toBe(false);}
    const pitch={...modelPitches()[0],unrelated:'keep'};
    expect(normalisePitchSchedulingFields(pitch)).toMatchObject({unrelated:'keep',playingAreas:pitch.playingAreas});
  });
  it('weekday_is_local_date',()=>{
    const pitches=modelPitches({availabilityByDay:{sunday:[{from:'09:00',to:'13:00'}],tuesday:[]}});
    expect(getPitchAvailability({pitchId:'AST-1',pitches,matchDate:'2026-10-25'})).toEqual([{startMins:540,endMins:780}]);
    expect(getPitchAvailability({pitchId:'AST-1',pitches,matchDate:'2026-10-27'})).toEqual([]);
  });
});
