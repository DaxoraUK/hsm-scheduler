/** @vitest-environment jsdom */
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import MatchdayPage from '../../src/pages/MatchdayPage.jsx';
import {prepareScopedScheduleDraft} from '../../src/lib/scheduling/prepareScopedScheduleDraft.js';
vi.mock('../../src/lib/notifications/daxoraNotifications.js',()=>({toast:{success:vi.fn(),error:vi.fn(),warning:vi.fn(),info:vi.fn()}}));
it.each(['Saturday','Sunday','Midweek'])('%s real control invokes scoped rebuild once while pending',async(day)=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const host=document.createElement('div');document.body.append(host);
  const root=createRoot(host);
  let resolve;const rebuild=vi.fn(()=>new Promise(done=>{resolve=done;}));
  try {
    await act(async()=>root.render(React.createElement(MatchdayPage,{day,final:[],props:{club:{},pitchCfg:[],teamCfg:[],mode:'test'},runTest:rebuild,runLive:vi.fn(),hasRun:true})));
    const button=[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Rebuild Schedule'));
    expect(button).toBeDefined();
    await act(async()=>{button.click();button.click();});
    expect(rebuild).toHaveBeenCalledTimes(1);
    expect([...host.querySelectorAll('button')].find(b=>b.textContent.includes('Rebuilding')).disabled).toBe(true);
    await act(async()=>resolve(true));
  } finally {await act(async()=>root.unmount());host.remove();}
});
it('failed_booking_or_draft_save_keeps_prior_schedule_and_uses_current_limit',async()=>{
  const previous=[{id:'prior'}];let displayed=previous;
  const schedule=vi.fn(()=>({scheduled:[{id:'next'}],unresolved:[]}));
  const base={context:{userId:'u',clubId:'c'},dayKey:'saturday',matchDate:'2026-10-10',all:[],away:[],overrides:{},schedule,
    loadResources:async()=>({status:'disabled'}),writeDraft:()=>false,isCurrent:()=>true};
  const failed=await prepareScopedScheduleDraft(base);
  if(failed.ok) displayed=failed.scheduled;
  expect(displayed).toBe(previous);
  const failedLoad=await prepareScopedScheduleDraft({...base,loadResources:async()=>{throw new Error('offline');}});
  expect(failedLoad.ok).toBe(false);
  expect(schedule).toHaveBeenCalledTimes(1);
  const success=await prepareScopedScheduleDraft({...base,writeDraft:()=>true,club:{maxConcurrent:2}});
  expect(success.ok).toBe(true);
});
