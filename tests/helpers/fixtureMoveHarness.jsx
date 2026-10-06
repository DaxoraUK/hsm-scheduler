import React,{useRef,useState} from 'react';
import FixtureDrawer from '../../src/components/Operations/shared/FixtureDrawer.jsx';
import {applyFixtureMoveTransaction} from '../../src/lib/scheduling/fixtureMove.js';
import {getFixtureFlowIdentity} from '../../src/lib/domain/fixtureVenueFlow.js';
import {modelFixture,modelPitches} from './capacitySchedulingFixtures.js';
export const moveHome=modelFixture({pitchId:'AST-1',endMins:585,cars:10});
export const moveAway=modelFixture({sourceFixtureKey:'away',status:'away',venueRole:'away'});
export function FixtureMoveHarness({rows=[moveAway,moveHome],club={maxConcurrent:3,carParkSpaces:1},save=true,resourceContext={status:'disabled'}}) {
  const [fixtures,setFixtures]=useState(rows);const current=useRef(fixtures);current.current=fixtures;
  const selected=fixtures.find(f=>f.sourceFixtureKey==='source:one');
  return <><output data-fixtures>{JSON.stringify(fixtures)}</output><FixtureDrawer fixture={{...selected,__index:1}} fixtures={fixtures} pitchCfg={modelPitches()} club={club}
    matchDate="2026-10-10" resourceContext={resourceContext}
    onOverride={(i,k,v)=>setFixtures(p=>p.map(f=>getFixtureFlowIdentity(f)==='source:one'?{...f,[k]:v}:f))}
    onAllocationChange={request=>applyFixtureMoveTransaction({request,getCurrent:()=>({fixtures:current.current,pitchCfg:modelPitches(),club,matchDate:'2026-10-10'}),loadResources:async()=>resourceContext,writeDraft:()=>save,commitState:r=>{current.current=r.fixtures;setFixtures(r.fixtures);}})}/></>;
}
export function readMoveRows(host){return JSON.parse(host.querySelector('[data-fixtures]').textContent);}
export function changeDrawerPitch(host,pitchId){
  const select=[...host.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='AST-2'));
  select.value=pitchId;select.dispatchEvent(new Event('change',{bubbles:true}));
}
