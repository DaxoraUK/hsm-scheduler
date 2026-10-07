/** @vitest-environment jsdom */
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,expect,test,vi} from 'vitest';
import MatchdayPage from '../../src/pages/MatchdayPage.jsx';
import {modelFixture,modelPitches} from '../helpers/capacitySchedulingFixtures.js';
vi.mock('../../src/lib/notifications/daxoraNotifications.js',()=>({toast:{success:vi.fn(),error:vi.fn(),info:vi.fn(),warning:vi.fn()}}));
let host,root;
const row=modelFixture({pitchId:'AST-1'});
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
async function render(day='Saturday',extra={}) {
  await act(async()=>root.render(React.createElement(MatchdayPage,{day,hasRun:true,final:[row],onOverride:()=>{},...extra,
    props:{club:{maxConcurrent:3},pitchCfg:modelPitches(),teamCfg:[row.cfg],refs:[],mode:'test',useAstro:true,
      satDate:'2026-10-10',sunDate:'2026-10-11',midweekDate:'2026-10-07',startHour:9,startMin:0,endHour:13,endMin:0,
      saveWeek:async()=>true,...extra.props},
  })));
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.hasAttribute('aria-expanded')&&b.textContent.includes(day+' Timeline')).click());
}
test.each(['Saturday','Sunday','Midweek'])('opening an existing %s schedule does not invent an unpublished change',async day=>{
  await render(day);
  expect(host.textContent).not.toMatch(/unpublished.*change/);
  expect([...host.querySelectorAll('button')].some(b=>b.textContent.trim()==='Save schedule')).toBe(false);
});
async function move() {
  await act(async()=>host.querySelector('[data-fixture-card]').click());
  await act(async()=>{const select=host.querySelector('select');select.value='AST-2';select.dispatchEvent(new Event('change',{bubbles:true}));});
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Validate move')).click());
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Apply move')).click());
}
test('an empty successful allocation response does not invent a change',async()=>{
  await render('Saturday',{onAllocationChange:async()=>({ok:true,moves:[]})});
  await move();
  expect(host.textContent).not.toMatch(/unpublished.*change/);
});
test('a real move shows one pending change and successful save clears it',async()=>{
  await render('Saturday',{onAllocationChange:async request=>({ok:true,moves:[{fixture:row,fixtureIdentity:row.sourceFixtureKey,patch:request.patch,previousPatch:{pitchId:'AST-1',koTime:'09:00',koMins:540,endMins:600}}]})});
  await move();
  expect(host.textContent).toContain('1 unpublished schedule change');
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save schedule').click());
  expect(host.textContent).not.toMatch(/unpublished.*change/);
});
test('undoing the only planner move clears the pending change',async()=>{
  await render('Saturday',{onAllocationChange:async request=>({ok:true,moves:[{fixture:row,fixtureIdentity:row.sourceFixtureKey,patch:request.patch||request.moves?.[0]?.patch,previousPatch:{pitchId:'AST-1',koTime:'09:00',koMins:540,endMins:600}}]})});
  await move();
  expect(host.textContent).toContain('1 unpublished schedule change');
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.trim()==='Undo').click());
  expect(host.textContent).not.toMatch(/unpublished.*change/);
  const redo=[...host.querySelectorAll('button')].find(b=>b.textContent.trim()==='Redo');
  expect(redo?.disabled).toBe(false);
  await act(async()=>redo.click());
  expect(host.textContent).toContain('1 unpublished schedule change');
});
test('a rejected move does not show a pending change',async()=>{
  await render('Saturday',{onAllocationChange:async()=>({ok:false,reason:'The draft could not be saved'})});
  await move();
  expect(host.textContent).not.toMatch(/unpublished.*change/);
});
test('discarding all planner moves does not leave a phantom pending change',async()=>{
  await render('Saturday',{onAllocationChange:async request=>({ok:true,moves:[{fixture:row,fixtureIdentity:row.sourceFixtureKey,patch:request.patch||request.moves?.[0]?.patch,previousPatch:{pitchId:'AST-1',koTime:'09:00',koMins:540,endMins:600}}]})});
  await move();
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.trim()==='Discard').click());
  await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Discard changes').click());
  expect(host.textContent).not.toMatch(/unpublished.*change/);
});
test('resolving an unresolved fixture without reversible move history remains saveable',async()=>{
  const missing=modelFixture({id:'missing',sourceFixtureKey:'missing',homeTeam:'U10 Missing',awayTeam:'Other Visitors',cfg:{...row.cfg,id:'missing',name:'U10 Missing'},pitchId:undefined,koTime:undefined,koMins:undefined,endMins:undefined});
  await render('Saturday',{unresolved:[missing],props:{teamCfg:[row.cfg,missing.cfg]},onAllocationChange:async request=>({ok:true,moves:[{fixture:missing,fixtureIdentity:'missing',patch:request.patch,previousPatch:{}}]})});
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.hasAttribute('aria-expanded')&&b.textContent.includes('Unresolved Fixtures')).click());
  await act(async()=>{const select=host.querySelector('select');select.value='AST-2';select.dispatchEvent(new Event('change',{bubbles:true}));
    const input=host.querySelector('input[type=time]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'10:00');input.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Confirm Assignment')).click());
  expect(host.textContent).toContain('1 unpublished schedule change');
  const save=[...host.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save schedule');
  expect(save?.disabled).toBe(false);
  await act(async()=>save.click());
  expect(host.textContent).not.toMatch(/unpublished.*change/);
});
