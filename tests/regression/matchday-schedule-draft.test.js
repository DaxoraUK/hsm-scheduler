/** @vitest-environment jsdom */
import {it,expect,beforeEach,vi} from 'vitest';
import {setTenantStorageContext,tenantSetJson,tenantGetJson} from '../../src/lib/storage/tenantStorage.js';
import {getFixtureFlowIdentity} from '../../src/lib/domain/fixtureVenueFlow.js';
import {writeMatchdayScheduleDraft,readMatchdayScheduleDraft} from '../../src/lib/storage/matchdayScheduleDraft.js';
const context={userId:'user',clubId:'club'};
const args={context,dayKey:'saturday',matchDate:'2026-10-10',scheduled:[{id:'source:one'}],unresolved:[],overrides:{'fixture:source:one':{venueRole:'home'}}};
beforeEach(()=>{localStorage.clear();setTenantStorageContext(context);vi.restoreAllMocks();});
it('local_draft_roundtrip_is_unpublished_and_scope_owned',()=>{
  expect(writeMatchdayScheduleDraft(args)).toBe(true);
  expect(readMatchdayScheduleDraft(args)).toMatchObject({version:1,scheduled:[{id:'source:one'}]});
  expect(readMatchdayScheduleDraft({...args,dayKey:'sunday'})).toBe(null);
  expect(readMatchdayScheduleDraft({...args,matchDate:'2026-10-17'})).toBe(null);
});
it('changed_tenant_and_failed_write_never_replace_schedule',()=>{
  setTenantStorageContext({userId:'other',clubId:'other'});
  expect(writeMatchdayScheduleDraft(args)).toBe(false);
  expect(readMatchdayScheduleDraft(args)).toBe(null);
  setTenantStorageContext(context);
  vi.spyOn(window.localStorage,'setItem').mockImplementation(()=>{throw new Error('quota');});
  expect(writeMatchdayScheduleDraft(args)).toBe(false);
});
it('legacy manual input receives one persisted identity shared with its allocation and override',()=>{
  const manual={manual:true,league:'Manual',date:'Manual',homeTeam:'U10 Test',awayTeam:'Visitors',koTime:'09:00'};
  const identity=getFixtureFlowIdentity(manual);
  tenantSetJson('schedule-draft:saturday:2026-10-10',{...args,version:1,scheduled:[manual],unresolved:[],overrides:{['fixture:'+identity]:{fixtureIdentity:identity,referee:'Pat'}}});
  const read=readMatchdayScheduleDraft(args);
  expect(read.manualFixtures[0].sourceFixtureKey).toMatch(/^manual:/);
  expect(read.scheduled[0].sourceFixtureKey).toBe(read.manualFixtures[0].sourceFixtureKey);
  expect(Object.values(read.overrides)[0].fixtureIdentity).toBe(read.scheduled[0].sourceFixtureKey);
  expect(readMatchdayScheduleDraft(args)).toEqual(read);
});
it('ambiguous legacy manual identities are reported rather than collapsing two fixtures',()=>{
  const manual={manual:true,league:'Manual',date:'Manual',homeTeam:'U10 Test',awayTeam:'Visitors',koTime:'09:00'};
  const key='schedule-draft:saturday:2026-10-10';
  const draft={...args,version:1,scheduled:[manual,{...manual}],unresolved:[],overrides:{}};
  tenantSetJson(key,draft);
  expect(()=>readMatchdayScheduleDraft(args)).toThrow(/ambiguous/i);
  expect(tenantGetJson(key)).toEqual(draft);
});
