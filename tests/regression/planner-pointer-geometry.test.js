import {test,expect} from 'vitest';
import * as pointer from '../../src/lib/engines/plannerPointerEngine.js';
import {buildTimelineMoveCandidate} from '../../src/lib/engines/timelineDragEngine.js';
import {buildMatchdayTimeline} from '../../src/lib/engines/timelineEngine.js';
import {modelFixture,modelPitches} from '../helpers/capacitySchedulingFixtures.js';
const fixture=modelFixture({pitchId:'AST-1',endMins:585});
const context={fixtures:[fixture],fixtureIdentity:'source:one',fixtureIndex:0,pitchCfg:modelPitches(),pitchId:'AST-2',club:{startHour:9,startMin:0,endHour:12,endMin:0},matchDate:'2026-10-10'};
test('whole_card_keeps_grab_offset',()=>{
  expect(pointer.getPlannerPointerTime({clientX:300,rowLeft:0,rowWidth:600,displayStart:540,displayEnd:720,grabOffsetMins:30})).toBe(600);
  expect(pointer.getPlannerGrabOffset({clientX:100,rowLeft:0,rowWidth:600,displayStart:540,displayEnd:720,fixtureKoMins:540})).toBe(30);
});
test('fit_quarter_half_hour_scroll_coordinates',()=>{
  for(const [width,left,x] of [[600,0,300],[1200,-200,400],[2400,-600,600]])
    expect(pointer.getPlannerPointerTime({clientX:x,rowLeft:left,rowWidth:width,displayStart:540,displayEnd:720,grabOffsetMins:30})).toBe(600);
});
test('0910_anchor_and_exact_pitch_only',()=>{
  expect(pointer.snapPlannerTime(595,{anchorMins:550})).toBe(595);
  const row={...fixture,koMins:607,koTime:'10:07',endMins:652};
  expect(buildTimelineMoveCandidate({...context,fixtures:[row],koMins:607,snapTime:false}).patch).toMatchObject({koMins:607,endMins:652});
});
test('1100_not_clamped_to_0945',()=>{
  expect(buildTimelineMoveCandidate({...context,start:510,end:630,koMins:660}).patch).toMatchObject({koTime:'11:00',endMins:705});
  const timeline=buildMatchdayTimeline({games:[fixture],pitchCfg:modelPitches(),club:context.club,includeEmptyPitches:true});
  expect(timeline.end).toBeGreaterThanOrEqual(765);expect(timeline.rows).toHaveLength(4);
});
test('preview_patch_same_time_at_window_edge',()=>{
  const result=buildTimelineMoveCandidate({...context,koMins:735,start:540,end:780});
  expect(result.blocked).toBe(true);expect(result.patch.koMins).toBe(735);
});
