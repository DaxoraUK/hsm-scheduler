/** @vitest-environment jsdom */
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {test,expect,beforeEach,afterEach,vi} from 'vitest';
import Card from '../../src/components/Operations/shared/MatchdayUnresolvedCard.jsx';
import {applyFixtureMoveTransaction} from '../../src/lib/scheduling/fixtureMove.js';
import {modelFixture,modelPitches} from '../helpers/capacitySchedulingFixtures.js';
import {toast} from '../../src/lib/notifications/daxoraNotifications.js';
vi.mock('../../src/lib/notifications/daxoraNotifications.js',()=>({toast:{success:vi.fn(),error:vi.fn()}}));
let host,root,state,pitches,resources,save,pending,club;
const fixture=modelFixture({pitchId:undefined,koMins:undefined,endMins:undefined,koTime:undefined});
const click=async node=>act(async()=>node.dispatchEvent(new MouseEvent('click',{bubbles:true})));
function props(){return {club,teamCfg:[fixture.cfg],pitchCfg:pitches,matchDate:'2026-10-10',resourceContext:resources,overrides:{9000:{pitchId:'AST-2',koTime:'09:00'}},
  unresolved:state.unresolved,scheduled:state.fixtures,setScheduled:next=>{state.fixtures=typeof next==='function'?next(state.fixtures):next;},setUnresolved:next=>{state.unresolved=typeof next==='function'?next(state.unresolved):next;},onOverride:()=>{},
  onAllocationChange:request=>applyFixtureMoveTransaction({request,getCurrent:()=>({...state,club,pitchCfg:pitches,matchDate:'2026-10-10'}),loadResources:async()=>resources,writeDraft:()=>save(),commitState:result=>{state={...state,...result};}})};}
async function render(){await act(async()=>root.render(React.createElement(Card,props())));}
async function manual(pitch='AST-2',time='09:00'){
  const select=host.querySelector('select'),input=host.querySelector('input[type=time]');
  await act(async()=>{select.value=pitch;select.dispatchEvent(new Event('change',{bubbles:true}));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,time);input.dispatchEvent(new Event('input',{bubbles:true}));});
}
beforeEach(()=>{vi.clearAllMocks();globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);
  state={fixtures:[],unresolved:[fixture],overrides:{}};pitches=modelPitches();resources={status:'disabled'};club={useAstro:true,maxConcurrent:3,bufferYouth:0,startHour:9,endHour:12,timingSettings:{earliestKickOff:'09:00',latestYouthKickOff:'12:00'}};save=()=>true;pending=null;});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
test('unresolved suggestions and assignment respect a closed weekday window',async()=>{
  pitches=pitches.map(p=>({...p,availabilityByDay:{saturday:[]}}));await render();
  expect(host.textContent).not.toContain('Apply Fix');
  await manual();await click([...host.querySelectorAll('button')].find(b=>b.textContent.includes('Confirm Assignment')));
  expect(state.fixtures).toHaveLength(0);expect(state.unresolved).toHaveLength(1);
});
test('manual confirmation requires a selected pitch and time, not stale unresolved allocation fields',async()=>{
  state.unresolved=[modelFixture({pitchId:'AST-1'})];await render();
  await click([...host.querySelectorAll('button')].find(b=>b.textContent.includes('Confirm Assignment')));
  expect(state.fixtures).toHaveLength(0);expect(state.unresolved).toHaveLength(1);
});
test('unresolved assignment cannot override a protected booking',async()=>{
  resources={status:'ready',reservations:[{pitchId:'AST',startMins:540,endMins:720}]};await render();await manual();
  await click([...host.querySelectorAll('button')].find(b=>b.textContent.includes('Confirm Assignment')));
  expect(state.fixtures).toHaveLength(0);expect(state.unresolved).toHaveLength(1);expect(host.textContent).not.toContain('Assign with override');
});
test('unresolved assignment uses mapped sibling areas and configured zero buffer',async()=>{
  state.fixtures=[modelFixture({sourceFixtureKey:'other',id:'other',homeTeam:'Other',awayTeam:'Other Visitors',cfg:{...fixture.cfg,id:'other',name:'Other'},pitchId:'AST-1',endMins:585})];
  await render();await manual();await click([...host.querySelectorAll('button')].find(b=>b.textContent.includes('Confirm Assignment')));
  expect(state.fixtures,JSON.stringify(toast.error.mock.calls)).toHaveLength(2);expect(state.unresolved).toHaveLength(0);
  expect(state.fixtures.find(f=>f.sourceFixtureKey==='source:one')).toMatchObject({pitchId:'AST-2',koMins:540,endMins:585});
  expect(state.overrides['fixture:source:one']).toMatchObject({pitchId:'AST-2',fixtureIdentity:'source:one'});
});
test('unresolved assignment prevents concurrent submissions and leaves both lists unchanged on failed save',async()=>{
  const original=state;let release;resources={status:'disabled'};const base=props();
  let count=0;base.onAllocationChange=async request=>{count++;await new Promise(resolve=>{release=resolve;});save=()=>false;return props().onAllocationChange(request);};
  await act(async()=>root.render(React.createElement(Card,base)));await manual();
  const button=[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Confirm Assignment'));
  await act(async()=>{button.click();button.click();});expect(count).toBe(1);expect(button.disabled).toBe(true);
  await act(async()=>release());expect(state).toEqual(original);expect(state.unresolved).toHaveLength(1);
});
