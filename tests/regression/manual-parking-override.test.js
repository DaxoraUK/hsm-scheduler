/** @vitest-environment jsdom */
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,expect,test,vi} from 'vitest';
import {FixtureMoveHarness,readMoveRows,changeDrawerPitch,moveHome} from '../helpers/fixtureMoveHarness.jsx';
vi.mock('../../src/lib/notifications/daxoraNotifications.js',()=>({toast:{success:vi.fn(),error:vi.fn(),info:vi.fn(),warning:vi.fn()}}));
let host,root;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
test('parking warning is advisory and does not require Apply Anyway',async()=>{
  await act(async()=>root.render(React.createElement(FixtureMoveHarness)));
  await act(async()=>changeDrawerPitch(host,'AST-2'));
  expect(readMoveRows(host)[1].pitchId).toBe('AST-2');
  expect(host.textContent.toLowerCase()).toContain('parking');
  expect(host.textContent).not.toContain('Apply anyway');
});
test('maximum concurrent games remains a hard limit even with parking off',async()=>{
  const other={...moveHome,sourceFixtureKey:'other',homeTeam:'U10 Else',awayTeam:'Others',cfg:{...moveHome.cfg,id:'other'},pitchId:'AST-3'};
  await act(async()=>root.render(React.createElement(FixtureMoveHarness,{rows:[other,moveHome],club:{maxConcurrent:1,features:{parkingEnabled:false}}})));
  await act(async()=>changeDrawerPitch(host,'AST-2'));
  expect(readMoveRows(host)[1].pitchId).toBe('AST-1');
  expect(host.textContent).toContain('simultaneous');
});
