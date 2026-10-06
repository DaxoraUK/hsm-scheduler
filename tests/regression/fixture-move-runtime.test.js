/** @vitest-environment jsdom */
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,expect,test,vi} from 'vitest';
import {FixtureMoveHarness,readMoveRows,changeDrawerPitch,moveAway} from '../helpers/fixtureMoveHarness.jsx';
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
