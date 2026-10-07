/** @vitest-environment jsdom */
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,test,expect,vi} from 'vitest';
import AppCore from '../../src/AppCore.jsx';
import {normaliseSubscriptionPayload} from '../../src/lib/subscriptions/entitlements.js';
import {setTenantStorageContext,tenantSetJson} from '../../src/lib/storage/tenantStorage.js';
import {writeMatchdayScheduleDraft,readMatchdayScheduleDraft} from '../../src/lib/storage/matchdayScheduleDraft.js';
import {getCurrentMatchWeekend} from '../../src/lib/date/weekendCalendar.js';
import {modelFixture,modelTeam} from '../helpers/capacitySchedulingFixtures.js';
import {reverseAwayFixture} from '../../src/lib/domain/fixtureVenueFlow.js';
const boundary=vi.hoisted(()=>({context:{userId:'boundary-user',clubId:'boundary-club'},session:{user:{id:'boundary-user',email:'test@example.invalid',user_metadata:{}}},membership:{role:'owner',club:{id:'boundary-club',name:'Test Club'}},subscription:null,home:null,shell:null,saturday:null,midweek:null,history:null}));
vi.mock('../../src/lib/supabase.js',async()=>{const real=await vi.importActual('../../src/lib/supabase.js');return {...real,isSupaConfigured:()=>false,Auth:{...real.Auth,getSession:()=>boundary.session},DB:{...real.DB,syncMatchdayCalendar:async()=>true}};});
vi.mock('../../src/hooks/useClubAccess.js',()=>({useClubAccess:()=>({memberships:[boundary.membership],activeMembership:boundary.membership,activeClubId:boundary.context.clubId,status:'ready'})}));
vi.mock('../../src/hooks/useLeagueAccess.js',()=>({useLeagueAccess:()=>({leagues:[],status:'ready'})}));
vi.mock('../../src/hooks/useClubEntitlements.js',()=>({useClubEntitlements:()=>({subscription:boundary.subscription,status:'ready'})}));
vi.mock('../../src/hooks/usePlatformOperator.js',()=>({usePlatformOperator:()=>({context:{isPlatformStaff:false},status:'ready'})}));
vi.mock('../../src/hooks/useClubOnboarding.js',()=>({useClubOnboarding:()=>({onboarding:{status:'complete',required:false},status:'ready'})}));
vi.mock('../../src/hooks/useBillingReadiness.js',()=>({useBillingReadiness:()=>({billing:{},status:'ready'})}));
vi.mock('../../src/hooks/useSessionLifecycle.js',()=>({useSessionLifecycle:()=>({status:'ready'})}));
vi.mock('../../src/hooks/useGlobalErrorNotifications.js',()=>({useGlobalErrorNotifications:()=>{}}));
vi.mock('../../src/lib/notifications/daxoraNotifications.js',()=>({toast:{success:vi.fn(),error:vi.fn(),warning:vi.fn(),info:vi.fn()}}));
// Presentational boundaries expose the real AppCore state/commands; allocator,
// scoped storage, override derivation and hydration are not mocked.
vi.mock('../../src/pages/DaxoraHomePage.jsx',()=>({default:props=>{boundary.home=props;return null;}}));
vi.mock('../../src/layout/ProductShell.jsx',()=>({default:props=>{boundary.shell=props;return props.children;}}));
vi.mock('../../src/pages/DashboardPage.jsx',()=>({default:()=>null}));
vi.mock('../../src/components/Operations/DayTabs.jsx',()=>({default:()=>null}));
vi.mock('../../src/pages/SaturdayPage.jsx',()=>({default:props=>{boundary.saturday=props;return null;}}));
vi.mock('../../src/pages/MidweekPage.jsx',()=>({default:props=>{boundary.midweek=props;return null;}}));
vi.mock('../../src/pages/HistoryPage.jsx',()=>({default:props=>{boundary.history=props;return null;}}));
vi.mock('../../src/pages/SettingsPage.jsx',()=>({default:props=>{boundary.history=props;return null;}}));
let host,root,date;
const fixture=modelFixture({pitchId:'P1',cfg:modelTeam({format:'5v5',defaultPitch:'P1'}),referee:'Original'});
async function settle(){await act(async()=>vi.dynamicImportSettled());}
async function mount(){await act(async()=>root.render(React.createElement(AppCore)));await act(async()=>vi.advanceTimersByTimeAsync(1400));await settle();expect(boundary.home,host.textContent).toBeTruthy();await act(async()=>boundary.home.onOpenProduct({canOpen:true,target:'operations'}));await settle();expect(boundary.saturday,host.textContent).toBeTruthy();}
async function reload(){await act(async()=>root.unmount());root=createRoot(host);boundary.home=null;boundary.saturday=null;await mount();}
beforeEach(()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();window.scrollTo=()=>{};vi.stubGlobal('fetch',()=>{throw new Error('No live network in synthetic boundary tests');});
  vi.useFakeTimers();
  boundary.home=null;boundary.shell=null;boundary.saturday=null;boundary.midweek=null;boundary.history=null;
  boundary.subscription=normaliseSubscriptionPayload({plan_code:'core',status:'active',access_state:'full',limit_overrides:{teams:50,pitches:50,venues:10,users:50}});
  setTenantStorageContext(boundary.context);date=getCurrentMatchWeekend().saturday;
  tenantSetJson('club',{id:boundary.context.clubId,name:'Test Club',maxConcurrent:3,features:{midweekEnabled:true},timingSettings:{startHour:9,startMin:0,endHour:12,endMin:0}});
  tenantSetJson('pitches',[{id:'P1',label:'Pitch 1',format:'5v5'}]);tenantSetJson('teamConfig',[fixture.cfg]);tenantSetJson('testSaturday',[{...fixture,date}]);
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.useRealTimers();vi.unstubAllGlobals();});
test('changing only Midweek date preserves newer Saturday metadata and its draft',async()=>{
  writeMatchdayScheduleDraft({context:boundary.context,dayKey:'saturday',matchDate:date,scheduled:[{...fixture,date}],unresolved:[],overrides:{}});
  await mount();await act(async()=>boundary.saturday.satOv(0,'referee','Updated','source:one'));
  await act(async()=>boundary.shell.setDayTab('midweek'));
  await settle();
  await act(async()=>boundary.midweek.setMidweekDate('2026-10-14'));
  await act(async()=>boundary.shell.setDayTab('saturday'));
  expect(boundary.saturday.satFinal[0].referee).toBe('Updated');
  await reload();expect(boundary.saturday.satFinal[0].referee).toBe('Updated');
});
test('manual canonical inputs survive local reload followed by the real rebuild',async()=>{
  await mount();
  const manual={...fixture,id:'manual:test',sourceFixtureKey:'manual:test',homeTeam:'Test Club U10 Test',awayTeam:'Friendly Visitors',manual:true,league:'Manual',date:'Manual'};
  await act(async()=>boundary.saturday.setSatManual([manual]));
  await act(async()=>boundary.saturday.runSatTest());
  expect(boundary.saturday.satFinal.some(f=>f.sourceFixtureKey==='manual:test')).toBe(true);
  await reload();
  expect(boundary.saturday.satManual.map(f=>f.sourceFixtureKey)).toEqual(['manual:test']);
  await act(async()=>boundary.saturday.runSatTest());
  expect(boundary.saturday.satFinal.filter(f=>f.sourceFixtureKey==='manual:test')).toHaveLength(1);
  expect(readMatchdayScheduleDraft({context:boundary.context,dayKey:'saturday',matchDate:date}).manualFixtures).toHaveLength(1);
});
test('explicit history restore wins over an older draft for the restored date',async()=>{
  const restoredDate='2026-10-17';
  writeMatchdayScheduleDraft({context:boundary.context,dayKey:'saturday',matchDate:restoredDate,scheduled:[{...fixture,referee:'Stale draft'}],unresolved:[],overrides:{}});
  writeMatchdayScheduleDraft({context:boundary.context,dayKey:'sunday',matchDate:'2026-10-18',scheduled:[{...fixture,referee:'Unrelated Sunday draft'}],unresolved:[],overrides:{}});
  await mount();await act(async()=>boundary.shell.setMainPage('settings'));await settle();
  expect(boundary.history?.onLoadHistory).toBeTypeOf('function');
  await act(async()=>boundary.history.onLoadHistory({date:restoredDate,scheduled:[{...fixture,date:restoredDate,referee:'Saved history'}]}));
  await settle();expect(boundary.saturday.satFinal[0].referee).toBe('Saved history');
  expect(readMatchdayScheduleDraft({context:boundary.context,dayKey:'saturday',matchDate:restoredDate}).scheduled[0].referee).toBe('Saved history');
  expect(readMatchdayScheduleDraft({context:boundary.context,dayKey:'sunday',matchDate:'2026-10-18'}).scheduled).toEqual([]);
  await reload();await act(async()=>boundary.saturday.setSatDate(restoredDate));
  expect(boundary.saturday.satFinal[0].referee).toBe('Saved history');
});
test('actual AppCore unresolved assignment atomically transfers and persists exactly one identity',async()=>{
  await mount();await act(async()=>boundary.saturday.runSatTest());
  const unresolved={...fixture,id:'unresolved',sourceFixtureKey:'unresolved',homeTeam:'Other',awayTeam:'Other Visitors',cfg:{...fixture.cfg,id:'other',name:'Other'},pitchId:undefined,koMins:undefined,endMins:undefined};
  await act(async()=>boundary.saturday.setSatUnresolved([unresolved]));
  let result;await act(async()=>{result=await boundary.saturday.onAllocationChange({fixtureIdentity:'unresolved',patch:{pitchId:'P1',koTime:'10:15'},resolveUnresolved:true});});
  expect(result.ok,result.reason).toBe(true);expect(boundary.saturday.satUnresolved).toHaveLength(0);
  expect(boundary.saturday.satFinal.filter(f=>f.sourceFixtureKey==='unresolved')).toHaveLength(1);
  const draft=readMatchdayScheduleDraft({context:boundary.context,dayKey:'saturday',matchDate:date});
  expect(draft.unresolved).toHaveLength(0);expect(draft.scheduled.filter(f=>f.sourceFixtureKey==='unresolved')).toHaveLength(1);
});
test('history restores persisted reversal intent before a canonical-source rebuild',async()=>{
  await mount();await act(async()=>boundary.shell.setMainPage('settings'));await settle();
  const away={...fixture,date,homeTeam:'Visitors',awayTeam:'U10 Test',status:'away',venueRole:'away',isAwayFixture:true,requiresScheduling:false};
  await act(async()=>boundary.history.setTestSat([away]));
  await act(async()=>boundary.history.onLoadHistory({date,scheduled:[reverseAwayFixture(away)]}));
  await settle();await act(async()=>boundary.saturday.runSatTest());
  expect(boundary.saturday.satFinal.filter(f=>f.sourceFixtureKey==='source:one')).toHaveLength(1);
  expect(boundary.saturday.satFinal[0]).toMatchObject({venueRole:'home',isAwayFixture:false,requiresScheduling:true,homeTeam:'U10 Test'});
});
