/** @vitest-environment jsdom */
import {it,expect,beforeEach,vi} from 'vitest';
import {setTenantStorageContext} from '../../src/lib/storage/tenantStorage.js';
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
