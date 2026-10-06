/** @vitest-environment jsdom */
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,test,expect,vi} from 'vitest';
import MatchdayTimelineCard from '../../src/components/Operations/shared/MatchdayTimelineCard.jsx';
import {modelFixture,modelPitches} from '../helpers/capacitySchedulingFixtures.js';
let host,root,moves,opened,target;
const games=[modelFixture({pitchId:'AST-1'})];
function pointer(node,type,x=130,y=100,pointerType='mouse') {
  const event=new Event(type,{bubbles:true,cancelable:true});
  Object.defineProperties(event,Object.fromEntries(Object.entries({clientX:x,clientY:y,pointerId:1,pointerType,isPrimary:true,button:0}).map(([key,value])=>[key,{value}])));
  node.dispatchEvent(event);
}
async function render(readOnly=false,rows=games) {
  await act(async()=>root.render(React.createElement(MatchdayTimelineCard,{games:rows,pitchCfg:modelPitches(),club:{startHour:9,startMin:0,endHour:12,endMin:0,maxConcurrent:3},readOnly,matchDate:'2026-10-10',onMoveRequest:move=>moves.push(move),onFixtureClick:f=>opened.push(f)})));
  host.querySelectorAll('[data-planner-pitch-id]').forEach(row=>{row.getBoundingClientRect=()=>({left:100,right:700,width:600,top:0,bottom:800,height:800});});
  target=host.querySelector('[data-planner-pitch-id="AST-2"]');
}
beforeEach(async()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);moves=[];opened=[];
  vi.stubGlobal('innerWidth',1024);document.elementFromPoint=()=>target;await render();});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
test('release_recalculates_without_pointermove',async()=>{
  const card=host.querySelector('[data-fixture-card]');
  await act(async()=>pointer(card,'pointerdown'));
  await act(async()=>pointer(window,'pointermove',280));
  await act(async()=>pointer(window,'pointerup',430));
  expect(moves).toHaveLength(1);expect(moves[0].patch).toMatchObject({pitchId:'AST-2',koMins:660,endMins:720});
});
test('outside_row_does_not_commit',async()=>{
  await act(async()=>pointer(host.querySelector('[data-fixture-card]'),'pointerdown'));
  await act(async()=>pointer(window,'pointermove',280));target=null;
  await act(async()=>pointer(window,'pointerup',430));expect(moves).toHaveLength(0);
});
test('escape_cancel_unmount_lock_clear_state',async()=>{
  for(const cancel of ['escape','cancel','lock']) {
    await render();await act(async()=>pointer(host.querySelector('[data-fixture-card]'),'pointerdown'));
    await act(async()=>pointer(window,'pointermove',280));
    if(cancel==='lock') await render(true);
    else await act(async()=>cancel==='escape'?window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})):pointer(window,'pointercancel',280));
    await act(async()=>pointer(window,'pointerup',430));
    expect(moves).toHaveLength(0);expect(document.body.style.userSelect).toBe('');
  }
});
test('mouse_and_touch_threshold_preserves_click',async()=>{
  for(const kind of ['mouse','touch']) {
    const card=host.querySelector('[data-fixture-card]');
    await act(async()=>pointer(card,'pointerdown',130,100,kind));
    await act(async()=>pointer(window,'pointerup',133,100,kind));
    await act(async()=>card.click());
    expect(host.textContent).toContain('Move fixture');
    await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Open full fixture record')).click());
  }
  expect(moves).toHaveLength(0);expect(opened).toHaveLength(2);
});
test('unmount restores page styles and releases a pending drag',async()=>{
  await act(async()=>pointer(host.querySelector('[data-fixture-card]'),'pointerdown'));
  await act(async()=>pointer(window,'pointermove',280));
  await act(async()=>root.unmount());root=createRoot(host);
  await act(async()=>pointer(window,'pointerup',430));
  expect(moves).toHaveLength(0);expect(document.body.style.cursor).toBe('');expect(document.body.style.userSelect).toBe('');
});
test('whole card keeps its time offset across zoom and scrolled row rectangles',async()=>{
  for(const [label,left,width,x] of [['Fit day',100,600,280],['15 min',-200,1200,160],['30 min',-500,2400,220],['60 min',-50,900,220]]) {
    await render();
    await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent===label).click());
    await act(async()=>pointer(host.querySelector('[data-fixture-card]'),'pointerdown'));
    target.getBoundingClientRect=()=>({left,width,right:left+width,top:0,bottom:800});
    await act(async()=>pointer(window,'pointerup',x,200));
    expect(moves.at(-1)?.patch.koMins).toBe(600);
  }
  expect(moves).toHaveLength(4);
});
test('picker pitch-only change retains an exact off-grid kick-off',async()=>{
  await render(false,[{...games[0],koMins:607,koTime:'10:07',endMins:667}]);
  await act(async()=>host.querySelector('[data-fixture-card]').click());
  await act(async()=>{const select=host.querySelector('select');select.value='AST-2';select.dispatchEvent(new Event('change',{bubbles:true}));});
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Validate move')).click());
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Apply move')).click());
  expect(moves[0]?.patch).toMatchObject({pitchId:'AST-2',koMins:607,endMins:667});
});
