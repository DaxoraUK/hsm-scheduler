/** @vitest-environment jsdom */
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,expect,test,vi} from 'vitest';
import {FixtureMoveHarness,readMoveRows,changeDrawerPitch,moveAway} from '../helpers/fixtureMoveHarness.jsx';
import MatchdayPage from '../../src/pages/MatchdayPage.jsx';
import {modelFixture,modelPitches} from '../helpers/capacitySchedulingFixtures.js';
import ManualForm from '../../src/components/ManualForm.jsx';
import {getFixtureFlowIdentity} from '../../src/lib/domain/fixtureVenueFlow.js';
vi.mock('../../src/lib/notifications/daxoraNotifications.js',()=>({toast:{success:vi.fn(),error:vi.fn(),info:vi.fn(),warning:vi.fn()}}));
let host,root;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
test('drawer applies one complete move to Home without changing preceding Away',async()=>{
  await act(async()=>root.render(React.createElement(FixtureMoveHarness)));
  await act(async()=>changeDrawerPitch(host,'AST-2'));
  expect(readMoveRows(host)[0]).toEqual(moveAway);
  expect(readMoveRows(host)[1]).toMatchObject({pitchId:'AST-2',koMins:540,endMins:585,pitchLabel:'Area 2'});
});
test('failed draft save is visible and leaves the drawer allocation unchanged',async()=>{
  await act(async()=>root.render(React.createElement(FixtureMoveHarness,{save:false})));
  await act(async()=>changeDrawerPitch(host,'AST-2'));
  expect(readMoveRows(host)[1].pitchId).toBe('AST-1');
  expect(host.textContent).toContain('could not be saved');
});
test('Midweek Operations preview uses its evening window rather than saved weekend limits',async()=>{
  const row=modelFixture({pitchId:'AST-1',date:'2026-10-07',koMins:1090,koTime:'18:10',endMins:1150});
  const requests=[];
  await act(async()=>root.render(React.createElement(MatchdayPage,{
    day:'Midweek',hasRun:true,final:[row],onOverride:()=>{},onAllocationChange:request=>{requests.push(request);return {ok:true,moves:[]};},
    props:{club:{maxConcurrent:3,timingSettings:{earliestKickOff:'09:00',latestYouthKickOff:'11:30'}},pitchCfg:modelPitches(),teamCfg:[row.cfg],refs:[],mode:'test',
      midweekDate:'2026-10-07',startHour:18,startMin:10,endHour:20,endMin:0,useAstro:true},
  })));
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Midweek Timeline')&&b.hasAttribute('aria-expanded')).click());
  await act(async()=>host.querySelector('[data-fixture-card]').click());
  await act(async()=>{const select=host.querySelector('select');select.value='AST-2';select.dispatchEvent(new Event('change',{bubbles:true}));});
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Validate move')).click());
  const apply=[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Apply move'));
  expect(apply,host.textContent).toBeDefined();
  await act(async()=>apply.click());
  expect(requests[0]?.patch).toMatchObject({pitchId:'AST-2',koTime:'18:10',koMins:1090,endMins:1150});
});
test('real manual form creates different immutable identities for similar friendlies',async()=>{
  const added=[];
  await act(async()=>root.render(React.createElement(ManualForm,{cfgList:[modelFixture().cfg],club:{name:'Test Club'},onAdd:f=>added.push(f)})));
  for(let i=0;i<2;i++) {
    await act(async()=>{const select=host.querySelector('select');select.value='U10 Test';select.dispatchEvent(new Event('change',{bubbles:true}));});
    const input=host.querySelector('input[placeholder="e.g. Farnworth Town"]');
    await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Visitors');input.dispatchEvent(new Event('input',{bubbles:true}));});
    await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Add Fixture')).click());
  }
  expect(added).toHaveLength(2);
  expect(getFixtureFlowIdentity(added[0])).toMatch(/^manual:/);
  expect(getFixtureFlowIdentity(added[0])).not.toBe(getFixtureFlowIdentity(added[1]));
  expect(getFixtureFlowIdentity({...added[0],koTime:'10:00',pitchId:'AST-2'})).toBe(getFixtureFlowIdentity(added[0]));
});
test('full Operations drawer retains the selected identity when fixtures reorder',async()=>{
  const first=modelFixture({pitchId:'AST-1'}),other=modelFixture({id:'other',sourceFixtureKey:'other',homeTeam:'U10 Other',awayTeam:'Else',pitchId:'AST-2',cfg:{...first.cfg,id:'other',name:'U10 Other'}});
  const page=final=>React.createElement(MatchdayPage,{day:'Saturday',hasRun:true,final,onOverride:()=>{},props:{club:{},pitchCfg:modelPitches(),teamCfg:[first.cfg,other.cfg],refs:[],satDate:'2026-10-10'}});
  await act(async()=>root.render(page([first,other])));
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.hasAttribute('aria-expanded')&&b.textContent.includes('Schedule')&&!b.textContent.includes('Unresolved')).click());
  const open=[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Open Control Centre')&&b.parentElement.parentElement.textContent.includes('U10 Test'));
  await act(async()=>open.click());
  await act(async()=>root.render(page([other,first])));
  const drawer=host.querySelector('button[aria-label="Close fixture drawer"]').parentElement;
  expect(drawer.textContent).toContain('U10 Test');
  expect(drawer.textContent).not.toContain('U10 Other');
});
