// App.jsx
// The main application container. Holds all state and handlers,
// imports logic from lib/ and UI from components/.

import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from "react";
import AppLayout from "./layout/AppLayout.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import OperationsPage from "./pages/OperationsPage.jsx";
import DayTabs from "./components/Operations/DayTabs.jsx";
import SundayPage from "./pages/SundayPage.jsx";
import SaturdayPage from "./pages/SaturdayPage.jsx";
import MidweekPage from "./pages/MidweekPage.jsx";
import OperationsTimelinePage from "./pages/OperationsTimelinePage.jsx";
import OperationsCentrePage from "./pages/OperationsCentrePage.jsx";
import { useSaturdayScheduling } from "./hooks/useSaturdayScheduling.js";
import { useSundayScheduling } from "./hooks/useSundayScheduling.js";
import { useFixtureFetcher } from "./hooks/useFixtureFetcher.js";
import { useWeekPersistence } from "./hooks/useWeekPersistence.js";
import { useClubAccess } from "./hooks/useClubAccess.js";
import { useOperationsActions } from "./hooks/useOperationsActions.js";
import ProductShell from "./layout/ProductShell.jsx";
import CommunicationsPage from "./pages/CommunicationsPage.jsx";
import AnalyticsPage from "./pages/AnalyticsPage.jsx";
import { MatchdayScopeProvider } from "./lib/context/MatchdayScopeContext.jsx";
import { MATCHDAY_SCOPES, getDayTabFromScope, normaliseMatchdayScope } from "./lib/domain/matchdayScope.js";
import {
  formatMatchdayDate,
  getCurrentMatchWeekend,
  getInitialMatchWeekend,
  getWeekendFromSaturday,
  getWeekendFromSunday,
  persistMatchWeekend,
} from "./lib/date/weekendCalendar.js";
import {
  formatMidweekDate,
  getCurrentOrNextMidweekDate,
  getInitialMidweekDate,
  getInitialMidweekWindow,
  isWeekendDate,
  persistMidweekDate,
  persistMidweekWindow,
  timeValueToMinutes,
} from "./lib/date/matchweekCalendar.js";

import {
  G, RE, AU, WH, AM, BL, TE, PU,
  DEFAULT_CLUB, PITCHES, AVG_CARS,
  TEAM_CONFIG_DEFAULT,
  DEFAULT_BUFFER_YOUTH, DEFAULT_BUFFER_ADULT
} from "./lib/constants.js";

import { cleanName, isMini, findCfg, scheduleSat, scheduleSun } from "./lib/scheduler.js";
import { isSupaConfigured, Auth, DB } from "./lib/supabase.js";
import { migratePitches } from "./lib/pitches.js";
import { S, thC } from "./lib/styles.js";
import { isMidweekEnabled } from "./lib/settings/workspaceSettings.js";
import { generateTestFixtures } from "./lib/testData/testFixtureGenerator.js";
import {
  addPitchClosure as addPitchClosureRecord,
  getActiveClosedPitchIds,
  loadPitchClosures,
  persistPitchClosures,
  reopenPitchClosures as reopenPitchClosureRecords,
} from "./lib/domain/pitchClosures.js";

import SatPrintSheet from "./components/SatPrintSheet.jsx";
import SunPrintSheet from "./components/SunPrintSheet.jsx";
import CombinedPrintSheet from "./components/CombinedPrintSheet.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import BrandSplash from "./components/BrandSplash.jsx";
import WorkspaceAccessGate from "./components/WorkspaceAccessGate.jsx";
import { toast } from "sonner";
import {
  clearTenantStorageContext,
  migrateLegacyTenantStorage,
  setTenantStorageContext,
  tenantGetItem,
  tenantGetJson,
  tenantSetItem,
  tenantSetJson,
} from "./lib/storage/tenantStorage.js";
import { createWorkspaceAccess } from "./lib/security/permissions.js";

function App(){
  const [mode,setMode]=useState("test");
  const [productionMode,setProductionMode]=useState(false);
  const [dayTab,setDayTab]=useState("saturday");
  const [matchdayScope,setMatchdayScopeState]=useState(MATCHDAY_SCOPES.WEEKEND);
  const setMatchdayScope=useCallback((scope)=>{
    const nextScope=normaliseMatchdayScope(scope);
    setMatchdayScopeState(nextScope);
    tenantSetItem("matchdayScope",nextScope);
    if([MATCHDAY_SCOPES.SATURDAY,MATCHDAY_SCOPES.SUNDAY,MATCHDAY_SCOPES.MIDWEEK].includes(nextScope)){
      setDayTab(getDayTabFromScope(nextScope));
    }
  },[]);
  const [mainPage, setMainPage] = useState("dashboard");
  const [settingsTab,setSettingsTab]=useState("overview");
  const [navigationTarget,setNavigationTarget]=useState(null);
  const clearNavigationTarget=useCallback(()=>setNavigationTarget(null),[]);
  const [matchWeekend,setMatchWeekend]=useState(()=>getInitialMatchWeekend());
  const satDate=matchWeekend.saturday;
  const sunDate=matchWeekend.sunday;
  const [midweekDateState,setMidweekDateState]=useState(()=>getInitialMidweekDate());
  const [midweekWindow,setMidweekWindow]=useState(()=>getInitialMidweekWindow());
  const midweekDate=midweekDateState;
  const midweekStartTime=midweekWindow.start;
  const midweekEndTime=midweekWindow.end;
  const midweekStartMins=timeValueToMinutes(midweekStartTime,18*60);
  const midweekEndMins=timeValueToMinutes(midweekEndTime,21*60+30);
  const midweekStartHour=Math.floor(midweekStartMins/60);
  const midweekStartMin=midweekStartMins%60;
  const midweekEndHour=Math.floor(midweekEndMins/60);
  const midweekEndMin=midweekEndMins%60;

  // Saturday state
  const [satScheduled,setSatScheduled]=useState([]);
  const [satUnresolved,setSatUnresolved]=useState([]);
  const [satOverrides,setSatOverrides]=useState({});
  const [satManual,setSatManual]=useState([]);
  const [satFetchStatus,setSatFetchStatus]=useState([]);
  const [satHasRun,setSatHasRun]=useState(false);

  // Sunday state
  const [sunScheduled,setSunScheduled]=useState([]);
  const [sunUnresolved,setSunUnresolved]=useState([]);
  const [sunOverrides,setSunOverrides]=useState({});
  const [sunManual,setSunManual]=useState([]);
  const [sunHasRun,setSunHasRun]=useState(false);

  // Midweek state
  const [midweekScheduled,setMidweekScheduled]=useState([]);
  const [midweekUnresolved,setMidweekUnresolved]=useState([]);
  const [midweekOverrides,setMidweekOverrides]=useState({});
  const [midweekManual,setMidweekManual]=useState([]);
  const [midweekFetchStatus,setMidweekFetchStatus]=useState([]);
  const [midweekHasRun,setMidweekHasRun]=useState(false);

  // Settings state
  const [startHour,setStartHour]=useState(8);
  const [startMin,setStartMin]=useState(30);
  const [endHour,setEndHour]=useState(11);
  const [endMin,setEndMin]=useState(30);
  const [bufferYouth,setBufferYouth]=useState(DEFAULT_BUFFER_YOUTH);
  const [bufferAdult,setBufferAdult]=useState(DEFAULT_BUFFER_ADULT);
  const [useAstro,setUseAstro]=useState(false);
  const [pitchClosures,setPitchClosures]=useState([]);
  const [showManual,setShowManual]=useState(false);
  const [showSunManual,setShowSunManual]=useState(false);
  const [showMidweekManual,setShowMidweekManual]=useState(false);

  const clearWeekendScheduleForDateChange=useCallback(()=>{
    setSatScheduled([]);
    setSatUnresolved([]);
    setSatOverrides({});
    setSatManual([]);
    setSatFetchStatus([]);
    setSatHasRun(false);
    setSunScheduled([]);
    setSunUnresolved([]);
    setSunOverrides({});
    setSunManual([]);
    setSunHasRun(false);
    setShowManual(false);
    setShowSunManual(false);
  },[]);

  const clearMidweekScheduleForDateChange=useCallback(()=>{
    setMidweekScheduled([]);
    setMidweekUnresolved([]);
    setMidweekOverrides({});
    setMidweekManual([]);
    setMidweekFetchStatus([]);
    setMidweekHasRun(false);
    setShowMidweekManual(false);
  },[]);

  const setMidweekDate=useCallback((value)=>{
    if(!value||value===midweekDateState) return;
    setMidweekDateState(value);
    clearMidweekScheduleForDateChange();
  },[clearMidweekScheduleForDateChange,midweekDateState]);

  const clearMidweekBuiltSchedule=useCallback(()=>{
    setMidweekScheduled([]);
    setMidweekUnresolved([]);
    setMidweekOverrides({});
    setMidweekHasRun(false);
  },[]);

  const setMidweekStartTime=useCallback((value)=>{
    setMidweekWindow((current)=>({...current,start:value}));
    clearMidweekBuiltSchedule();
  },[clearMidweekBuiltSchedule]);

  const setMidweekEndTime=useCallback((value)=>{
    setMidweekWindow((current)=>({...current,end:value}));
    clearMidweekBuiltSchedule();
  },[clearMidweekBuiltSchedule]);

  const useCurrentMidweekDate=useCallback(()=>{
    setMidweekDate(getCurrentOrNextMidweekDate());
  },[setMidweekDate]);

  const applyMatchWeekend=useCallback((nextWeekend)=>{
    if(!nextWeekend?.saturday||!nextWeekend?.sunday) return;
    if(nextWeekend.saturday===satDate&&nextWeekend.sunday===sunDate) return;
    setMatchWeekend(nextWeekend);
    clearWeekendScheduleForDateChange();
  },[satDate,sunDate,clearWeekendScheduleForDateChange]);

  const setSatDate=useCallback((value)=>{
    applyMatchWeekend(getWeekendFromSaturday(value));
  },[applyMatchWeekend]);

  const setSunDate=useCallback((value)=>{
    applyMatchWeekend(getWeekendFromSunday(value));
  },[applyMatchWeekend]);

  const useCurrentMatchWeekend=useCallback(()=>{
    applyMatchWeekend(getCurrentMatchWeekend());
  },[applyMatchWeekend]);

  const [refs,setRefs]=useState([]);
  const [history,setHistory]=useState([]);
  const [teamCfg,setTeamCfg]=useState(TEAM_CONFIG_DEFAULT);

  const [dbStatus,setDbStatus]=useState(()=>isSupaConfigured()?"connecting":"disabled");
  const [savedTab,setSavedTab]=useState("");
  const [authSession,setAuthSession]=useState(()=>Auth.getSession());
  const [authLoading,setAuthLoading]=useState(true);
  const [minimumSplashComplete,setMinimumSplashComplete]=useState(false);
  const [workspaceHydrated,setWorkspaceHydrated]=useState(false);
  const [workspaceSecurityError,setWorkspaceSecurityError]=useState("");
  const closureSyncRef=useRef({clubId:"",snapshot:""});

  const {
    memberships,
    activeMembership,
    activeClubId,
    status:clubAccessStatus,
    error:clubAccessError,
    canBootstrap,
    refresh:refreshClubAccess,
    selectClub,
    bootstrapFirstWorkspace,
  }=useClubAccess(authSession);

  const workspaceAccess=useMemo(
    ()=>createWorkspaceAccess(activeMembership),
    [activeMembership]
  );

  useLayoutEffect(()=>{
    setWorkspaceHydrated(false);
    setWorkspaceSecurityError("");
  },[activeClubId]);

  const handleClubChange=useCallback((clubId)=>{
    if(!clubId||clubId===activeClubId) return false;
    setWorkspaceHydrated(false);
    setWorkspaceSecurityError("");
    clearTenantStorageContext();
    return selectClub(clubId);
  },[activeClubId,selectClub]);

  useEffect(()=>{
    if(mainPage==="settings"&&!workspaceAccess.canManageSettings){
      setMainPage("dashboard");
      setSettingsTab("overview");
      toast.error("Administrator access required",{
        description:"Your club role does not include workspace settings.",
      });
    }
  },[mainPage,workspaceAccess.canManageSettings]);

  const [club,setClub]=useState(DEFAULT_CLUB);
  const midweekEnabled=isMidweekEnabled(club);

  useEffect(()=>{
    if(midweekEnabled) return;
    if(dayTab==="midweek") setDayTab("saturday");
    if([MATCHDAY_SCOPES.MATCHWEEK,MATCHDAY_SCOPES.MIDWEEK].includes(matchdayScope)){
      setMatchdayScope(MATCHDAY_SCOPES.WEEKEND);
    }
  },[dayTab,matchdayScope,midweekEnabled,setMatchdayScope]);

  const [pitchCfg,setPitchCfg]=useState(PITCHES);

  const satClosedPitches=useMemo(
    ()=>getActiveClosedPitchIds(pitchClosures,satDate),
    [pitchClosures,satDate]
  );
  const sunClosedPitches=useMemo(
    ()=>getActiveClosedPitchIds(pitchClosures,sunDate),
    [pitchClosures,sunDate]
  );
  const midweekClosedPitches=useMemo(
    ()=>getActiveClosedPitchIds(pitchClosures,midweekDate),
    [pitchClosures,midweekDate]
  );
  const closedPitches=useMemo(
    ()=>[...new Set([
      ...satClosedPitches,
      ...sunClosedPitches,
      ...(midweekEnabled?midweekClosedPitches:[]),
    ])],
    [midweekClosedPitches,midweekEnabled,satClosedPitches,sunClosedPitches]
  );

  const closureUser=useMemo(()=>{
    const user=authSession?.user||{};
    return user.user_metadata?.display_name||user.email||"Ground Control user";
  },[authSession]);

  const addPitchClosure=useCallback((input={})=>{
    setPitchClosures((current)=>addPitchClosureRecord(current,{
      ...input,
      createdBy:input.createdBy||closureUser,
    }));
  },[closureUser]);

  const reopenPitchClosures=useCallback((pitchIds,activeDate,metadata={})=>{
    setPitchClosures((current)=>reopenPitchClosureRecords(
      current,
      pitchIds,
      activeDate,
      {
        ...metadata,
        reopenedBy:metadata.reopenedBy||closureUser,
      }
    ));
  },[closureUser]);

  const closeAllPitches=useCallback((activeDate)=>{
    setPitchClosures((current)=>(pitchCfg||[]).reduce(
      (records,pitch)=>addPitchClosureRecord(records,{
        pitchId:pitch.id,
        mode:"matchday",
        effectiveFrom:activeDate,
        effectiveTo:activeDate,
        reason:"Whole ground closure",
        notes:"All pitches closed for the selected fixture day.",
        createdBy:closureUser,
      }),
      current
    ));
  },[closureUser,pitchCfg]);

  const reopenAllPitches=useCallback((activeDate)=>{
    reopenPitchClosures((pitchCfg||[]).map((pitch)=>pitch.id),activeDate,{
      reopenedReason:"All pitches reopened for the selected fixture day",
    });
  },[pitchCfg,reopenPitchClosures]);

  const toggleClosed=useCallback((pitchId,linkedPitchIds=[],activeDate=satDate)=>{
    const group=[pitchId,...(Array.isArray(linkedPitchIds)?linkedPitchIds:[])];
    const activeIds=new Set(getActiveClosedPitchIds(pitchClosures,activeDate));
    const sources=group.filter((id)=>activeIds.has(String(id)));
    if(sources.length){
      reopenPitchClosures(sources,activeDate);
      return;
    }
    addPitchClosure({
      pitchId,
      mode:"untilReopened",
      effectiveFrom:activeDate,
      reason:"Pitch unavailable",
    });
  },[addPitchClosure,pitchClosures,reopenPitchClosures,satDate]);

  const defaultTestFixtures=(dayKey)=>generateTestFixtures({
    dayKey,
    seed:`ground-control-${dayKey}`,
    scenario:"standard",
    club,
    teams:teamCfg,
  });
  const [testSat,setTestSat]=useState(()=>defaultTestFixtures("saturday"));
  const [testSun,setTestSun]=useState(()=>defaultTestFixtures("sunday"));
  const [testMidweek,setTestMidweek]=useState(()=>defaultTestFixtures("midweek"));

  useEffect(()=>{
    persistMatchWeekend(matchWeekend);
  },[matchWeekend]);

  useEffect(()=>{
    persistMidweekDate(midweekDate);
  },[midweekDate]);

  useEffect(()=>{
    persistMidweekWindow(midweekWindow);
  },[midweekWindow]);

  const saveTab=async(tab,data={})=>{
    if(!workspaceAccess.canManageSettings){
      toast.error("Administrator access required",{
        description:"Your role cannot change club settings.",
      });
      return false;
    }

    const nextClub={...(data.club||club),id:activeClubId||data.club?.id||club?.id};
    const nextTeamCfg=data.teamCfg||teamCfg;
    const nextRefs=data.refs||refs;

    if(data.club) setClub(nextClub);
    if(data.teamCfg) setTeamCfg(data.teamCfg);
    if(data.refs) setRefs(data.refs);

    tenantSetJson("club",nextClub);
    tenantSetJson("teamConfig",nextTeamCfg);
    tenantSetJson("referees",nextRefs);

    try{
      if(isSupaConfigured()&&activeClubId){
        setDbStatus("saving");
        const saves=[];
        if(data.club||["club","workspace","venues","timing"].includes(tab)) saves.push(DB.saveClub(activeClubId,nextClub));
        if(data.teamCfg||tab==="teams") saves.push(DB.saveTeamCfg(activeClubId,nextTeamCfg));
        if(data.refs||tab==="refs") saves.push(DB.saveRefs(activeClubId,nextRefs));
        if(tab==="pitches") saves.push(DB.savePitches(activeClubId,pitchCfg));
        await Promise.all(saves);
        setDbStatus("connected");
      }
      setSavedTab(tab);
      setTimeout(()=>setSavedTab(""),2500);
    }catch(error){
      setDbStatus("error");
      toast.error("Saved on this device only",{
        description:error?.message||"Cloud sync failed. Review the workspace connection before continuing.",
      });
    }
  };

  // Club-aware header style - used instead of S.ch() throughout
  const hdrStyle=(bg)=>({background:bg||club.primary,color:"#fff",padding:"10px 16px",fontWeight:600,fontSize:12,display:"flex",alignItems:"center",gap:8});

  // Force live mode in production
  useEffect(()=>{if(productionMode&&mode!=="live")setMode("live");},[productionMode,mode]);

  // Keep the launch sequence visible long enough to feel intentional, even when auth resolves instantly.
  useEffect(()=>{
    const timer=window.setTimeout(()=>setMinimumSplashComplete(true),1400);
    return()=>window.clearTimeout(timer);
  },[]);

  // Validate auth session on mount
  useEffect(()=>{
    const session = Auth.getSession();
    if (!session || !session.access_token) {
      setAuthLoading(false);
      return;
    }
    // Verify token is still valid
    Auth.getUser(session.access_token).then(user => {
      if (user && !user.error) {
        setAuthSession(session);
      } else {
        // Try refresh
        if (session.refresh_token) {
          Auth.refreshSession(session.refresh_token).then(res => {
            if (res && res.access_token) {
              Auth.saveSession(res);
              setAuthSession(res);
            } else {
              Auth.clearSession();
              setAuthSession(null);
            }
            setAuthLoading(false);
          });
          return;
        }
        Auth.clearSession();
        setAuthSession(null);
      }
      setAuthLoading(false);
    });
  },[]);

  useEffect(()=>{
    if(!activeClubId||!authSession?.user?.id){
      setWorkspaceHydrated(false);
      return undefined;
    }

    let cancelled=false;
    const hydrate=async()=>{
      setWorkspaceHydrated(false);
      setWorkspaceSecurityError("");
      setDbStatus("loading");
      let allowLocalHydration=true;

      setTenantStorageContext({userId:authSession.user.id,clubId:activeClubId});
      migrateLegacyTenantStorage();

      const memberClub=activeMembership?.club||{};
      const localClub=tenantGetJson("club",null);
      const localTeams=tenantGetJson("teamConfig",TEAM_CONFIG_DEFAULT);
      const localRefs=tenantGetJson("referees",[]);
      const localHistory=tenantGetJson("history",[]);
      const localPitches=tenantGetJson("pitches",PITCHES);
      const safeLocalPitches=Array.isArray(localPitches)&&localPitches.length
        ? migratePitches(localPitches)
        : PITCHES;
      const localClosures=loadPitchClosures();
      const fallbackClub={
        ...DEFAULT_CLUB,
        ...(localClub||{}),
        id:activeClubId,
        name:localClub?.name||memberClub.name||DEFAULT_CLUB.name,
        features:{...(DEFAULT_CLUB.features||{}),...(localClub?.features||{})},
      };
      const fallbackTeams=Array.isArray(localTeams)?localTeams:TEAM_CONFIG_DEFAULT;

      setClub(fallbackClub);
      setTeamCfg(fallbackTeams);
      setRefs(Array.isArray(localRefs)?localRefs:[]);
      setHistory(Array.isArray(localHistory)?localHistory:[]);
      setPitchCfg(safeLocalPitches);
      setPitchClosures(Array.isArray(localClosures)?localClosures:[]);
      const nextProductionMode=tenantGetItem("productionMode","0")==="1";
      setProductionMode(nextProductionMode);
      setMode(nextProductionMode?"live":"test");
      setMatchdayScopeState(normaliseMatchdayScope(tenantGetItem("matchdayScope",MATCHDAY_SCOPES.WEEKEND)));
      setMatchWeekend(getInitialMatchWeekend());
      setMidweekDateState(getInitialMidweekDate());
      setMidweekWindow(getInitialMidweekWindow());
      clearWeekendScheduleForDateChange();
      clearMidweekScheduleForDateChange();

      const localTestSat=tenantGetJson("testSaturday",null);
      const localTestSun=tenantGetJson("testSunday",null);
      const localTestMidweek=tenantGetJson("testMidweek",null);
      setTestSat(Array.isArray(localTestSat)?localTestSat:generateTestFixtures({dayKey:"saturday",seed:"ground-control-saturday",scenario:"standard",club:fallbackClub,teams:fallbackTeams}));
      setTestSun(Array.isArray(localTestSun)?localTestSun:generateTestFixtures({dayKey:"sunday",seed:"ground-control-sunday",scenario:"standard",club:fallbackClub,teams:fallbackTeams}));
      setTestMidweek(Array.isArray(localTestMidweek)?localTestMidweek:generateTestFixtures({dayKey:"midweek",seed:"ground-control-midweek",scenario:"standard",club:fallbackClub,teams:fallbackTeams}));

      try{
        const [histData,refData,cfgData,clubData,pitchData,closureData,remoteTestSat,remoteTestSun,remoteTestMidweek]=await Promise.all([
          DB.loadHistory(activeClubId),
          DB.loadRefs(activeClubId),
          DB.loadTeamCfg(activeClubId),
          DB.loadClub(activeClubId),
          DB.loadPitches(activeClubId),
          DB.loadPitchClosures(activeClubId),
          DB.loadTestFixtures(activeClubId,"testsat"),
          DB.loadTestFixtures(activeClubId,"testsun"),
          DB.loadTestFixtures(activeClubId,"testmidweek"),
        ]);
        if(cancelled) return;

        const nextClub={
          ...DEFAULT_CLUB,
          ...fallbackClub,
          ...(clubData||{}),
          id:activeClubId,
          name:clubData?.name||fallbackClub.name,
          features:{...(DEFAULT_CLUB.features||{}),...(fallbackClub.features||{}),...(clubData?.features||{})},
        };
        const nextTeams=Array.isArray(cfgData)?cfgData:[];
        const nextPitches=Array.isArray(pitchData)&&pitchData.length?migratePitches(pitchData):PITCHES;
        const nextClosures=Array.isArray(closureData)?closureData:[];

        setClub(nextClub);
        setHistory(Array.isArray(histData)?histData:[]);
        setRefs(Array.isArray(refData)?refData:[]);
        setTeamCfg(nextTeams);
        setPitchCfg(nextPitches.length?nextPitches:PITCHES);
        setPitchClosures(nextClosures);
        setTestSat(remoteTestSat.length?remoteTestSat:generateTestFixtures({dayKey:"saturday",seed:"ground-control-saturday",scenario:"standard",club:nextClub,teams:nextTeams}));
        setTestSun(remoteTestSun.length?remoteTestSun:generateTestFixtures({dayKey:"sunday",seed:"ground-control-sunday",scenario:"standard",club:nextClub,teams:nextTeams}));
        setTestMidweek(remoteTestMidweek.length?remoteTestMidweek:generateTestFixtures({dayKey:"midweek",seed:"ground-control-midweek",scenario:"standard",club:nextClub,teams:nextTeams}));
        closureSyncRef.current={clubId:activeClubId,snapshot:JSON.stringify(nextClosures)};
        if(activeMembership?.accessMode==="support"&&activeMembership?.supportSessionId){
          await DB.recordSupportWorkspaceOpen(activeClubId,activeMembership.supportSessionId);
        }
        setDbStatus("connected");
      }catch(error){
        if(cancelled) return;
        const status=Number(error?.status||0);
        const failClosed=status>=400&&status<500&&![408,429].includes(status);
        if(failClosed){
          allowLocalHydration=false;
          clearTenantStorageContext();
          setDbStatus("error");
          setWorkspaceSecurityError(
            error?.message||"The selected club membership or database security policy could not be verified."
          );
          return;
        }
        closureSyncRef.current={clubId:activeClubId,snapshot:JSON.stringify(localClosures)};
        setDbStatus("error");
        toast.error("Cloud workspace unavailable", {
          description: error?.message || "Ground Control is using this club's local cache until the connection is restored.",
        });
      }finally{
        if(!cancelled&&allowLocalHydration) setWorkspaceHydrated(true);
      }
    };

    hydrate();
    return()=>{cancelled=true;};
  },[
    activeClubId,
    activeMembership?.club?.name,
    activeMembership?.accessMode,
    activeMembership?.supportSessionId,
    authSession?.user?.id,
    clearMidweekScheduleForDateChange,
    clearWeekendScheduleForDateChange,
  ]);

  useEffect(()=>{if(workspaceHydrated)tenantSetJson("referees",refs);},[refs,workspaceHydrated]);
  useEffect(()=>{if(workspaceHydrated)tenantSetJson("club",club);},[club,workspaceHydrated]);
  useEffect(()=>{if(workspaceHydrated)tenantSetJson("pitches",pitchCfg);},[pitchCfg,workspaceHydrated]);
  useEffect(()=>{if(workspaceHydrated)tenantSetJson("history",history);},[history,workspaceHydrated]);
  useEffect(()=>{if(workspaceHydrated)tenantSetJson("teamConfig",teamCfg);},[teamCfg,workspaceHydrated]);
  useEffect(()=>{if(workspaceHydrated)tenantSetJson("testSaturday",testSat);},[testSat,workspaceHydrated]);
  useEffect(()=>{if(workspaceHydrated)tenantSetJson("testSunday",testSun);},[testSun,workspaceHydrated]);
  useEffect(()=>{if(workspaceHydrated)tenantSetJson("testMidweek",testMidweek);},[testMidweek,workspaceHydrated]);

  useEffect(()=>{
    if(!workspaceHydrated||!activeClubId) return undefined;
    persistPitchClosures(pitchClosures);
    const snapshot=JSON.stringify(pitchClosures);
    if(closureSyncRef.current.clubId===activeClubId&&closureSyncRef.current.snapshot===snapshot) return undefined;
    if(!isSupaConfigured()||!workspaceAccess.canOperate) return undefined;

    const timer=window.setTimeout(async()=>{
      try{
        await DB.savePitchClosures(activeClubId,pitchClosures);
        closureSyncRef.current={clubId:activeClubId,snapshot};
        setDbStatus("connected");
      }catch(error){
        setDbStatus("error");
        toast.error("Pitch closures saved locally only",{description:error?.message||"Cloud sync failed."});
      }
    },350);
    return()=>window.clearTimeout(timer);
  },[activeClubId,pitchClosures,workspaceAccess.canOperate,workspaceHydrated]);

    useEffect(() => {
      const handler = (event) => {
        setMainPage("operations");

        setDayTab(
          event?.detail?.day === "sunday"
            ? "sunday"
            : event?.detail?.day === "midweek"
              ? "midweek"
              : "saturday"
        );
      };

      window.addEventListener(
        "ground-control-open-operations",
        handler
      );

      return () => {
        window.removeEventListener(
          "ground-control-open-operations",
          handler
        );
      };
    }, []);

  const makePitchBuffer=(youth,adult)=>{
    const map={};
    ["3v3","5v5","7v7","9v9","11v11-youth","11v11-small"].forEach(f=>{map[f]=youth;});
    map["11v11"]=adult;
    return map;
  };
  const getBufMap=()=>makePitchBuffer(bufferYouth,bufferAdult);
  const getStartMins=()=>startHour*60+startMin;
  const getEndMins=()=>endHour*60+endMin;

  const runSat=useCallback((baseFx)=>{
    setSatOverrides({});
    const all=[...baseFx,...satManual];
    const {scheduled:s,unresolved:u}=scheduleSat(all,useAstro,satClosedPitches,teamCfg,getBufMap(),getStartMins(),getEndMins(),pitchCfg,club.maxConcurrent||3);
    setSatScheduled(s);setSatUnresolved(u);setSatHasRun(true);
  },[satManual,useAstro,satClosedPitches,teamCfg,startHour,startMin,endHour,endMin,bufferYouth,bufferAdult,pitchCfg]);

  const runSatTest=()=>{setSatFetchStatus([{id:"TEST",name:"Test Data",ok:true,count:testSat.length}]);runSat(testSat);};

  const runSatLive = async () => {
  if (!satDate) {
    alert("Select a Saturday date.");
    return;
  }

  setSatHasRun(false);
  setSatFetchStatus([]);
  setSatScheduled([]);
  setSatUnresolved([]);

  const { statuses, fixtures } =
    await fetchSaturdayFixtures(satDate);

  setSatFetchStatus(statuses);
  runSat(fixtures);
};

  const runSun=useCallback((baseFx)=>{
    setSunOverrides({});
    const all=[...baseFx,...sunManual];
    const { scheduled: s, unresolved: u } = scheduleSun(
      all,
      useAstro,
      sunClosedPitches,
      teamCfg,
      getBufMap(),
      getStartMins(),
      getEndMins(),
      pitchCfg,
      club.maxConcurrent || 3
    );
    setSunScheduled(s);setSunUnresolved(u);setSunHasRun(true);
  },[sunManual,useAstro,sunClosedPitches,teamCfg,startHour,startMin,endHour,endMin,bufferYouth,bufferAdult,pitchCfg,club.maxConcurrent]);

  const runSunTest=()=>runSun(testSun);

const runSunLive = async () => {
  if (!sunDate) {
    alert("Select a Sunday date.");
    return;
  }

  const fixtures = await fetchSundayFixtures(sunDate);

  runSun(fixtures);
};

  const runMidweek=useCallback((baseFx)=>{
    setMidweekOverrides({});
    const all=[...baseFx,...midweekManual];
    const {scheduled:s,unresolved:u}=scheduleSat(
      all,
      useAstro,
      midweekClosedPitches,
      teamCfg,
      getBufMap(),
      midweekStartMins,
      midweekEndMins,
      pitchCfg,
      club.maxConcurrent||3,
      { fixedAdultKickOffMins: null }
    );
    setMidweekScheduled(s);
    setMidweekUnresolved(u);
    setMidweekHasRun(true);
  },[midweekManual,useAstro,midweekClosedPitches,teamCfg,bufferYouth,bufferAdult,midweekStartMins,midweekEndMins,pitchCfg,club.maxConcurrent]);

  const runMidweekTest=()=>{
    setMidweekFetchStatus([{id:"TEST",name:"Midweek Test Data",ok:true,count:testMidweek.length}]);
    runMidweek(testMidweek);
  };

  const runMidweekLive=async()=>{
    if(!midweekDate){
      alert("Select a midweek fixture date.");
      return;
    }

    if(midweekEndMins<=midweekStartMins){
      alert("The midweek end time must be later than the start time.");
      return;
    }

    setMidweekHasRun(false);
    setMidweekFetchStatus([]);
    setMidweekScheduled([]);
    setMidweekUnresolved([]);

    const {statuses,fixtures}=await fetchMidweekFixtures(midweekDate);
    setMidweekFetchStatus(statuses);
    runMidweek(fixtures);
  };

  const satOv=(i,k,v)=>setSatOverrides(p=>({...p,[i]:{...(p[i]||{}),[k]:v}}));
  const sunOv=(i,k,v)=>setSunOverrides(p=>({...p,[i]:{...(p[i]||{}),[k]:v}}));
  const midweekOv=(i,k,v)=>setMidweekOverrides(p=>({...p,[i]:{...(p[i]||{}),[k]:v}}));
const {
  satFinal,
  satActive,
  satPostponed,
  refWarnings,
  satConflicts,
  peakCars,
  carCap,
  parkingOver,
  readiness,
} = useSaturdayScheduling({
  satScheduled,
  satOverrides,
  satUnresolved,
  pitchCfg,
  club,
});

const { sunFinal } = useSundayScheduling({
  sunScheduled,
  sunOverrides,
});

const {
  satFinal: midweekFinal,
  satActive: midweekActive,
  satPostponed: midweekPostponed,
  refWarnings: midweekRefWarnings,
  satConflicts: midweekConflicts,
  peakCars: midweekPeakCars,
  parkingOver: midweekParkingOver,
  readiness: midweekReadiness,
} = useSaturdayScheduling({
  satScheduled: midweekScheduled,
  satOverrides: midweekOverrides,
  satUnresolved: midweekUnresolved,
  pitchCfg,
  club,
});

const activeMidweekFinal=midweekEnabled?midweekFinal:[];
const activeMidweekHasRun=midweekEnabled&&midweekHasRun;
const activeMidweekActive=midweekEnabled?midweekActive:[];
const activeMidweekPostponed=midweekEnabled?midweekPostponed:[];
const activeMidweekConflicts=midweekEnabled?midweekConflicts:[];
const activeMidweekUnresolved=midweekEnabled?midweekUnresolved:[];
const activeMidweekReadiness=midweekEnabled?midweekReadiness:null;

const satDateLabel=formatMatchdayDate(satDate,"Saturday");
const sunDateLabel=formatMatchdayDate(sunDate,"Sunday");
const midweekDateLabel=formatMidweekDate(midweekDate,"Midweek");
const midweekDateIsWeekend=isWeekendDate(midweekDate);

const { saveWeek } = useWeekPersistence({
  mode,
  satDate,
  sunDate,
  satDateLabel,
  sunDateLabel,
  satHasRun,
  satFinal,
  satActive,
  satPostponed,
  sunHasRun,
  sunFinal,
  midweekDate,
  midweekDateLabel,
  midweekHasRun:activeMidweekHasRun,
  midweekFinal:activeMidweekFinal,
  midweekActive:activeMidweekActive,
  midweekPostponed:activeMidweekPostponed,
  club,
  history,
  setHistory,
  setDbStatus,
  activeClubId,
  canPublish:workspaceAccess.canPublish,
});

const {
  fetchSaturdayFixtures,
  fetchSundayFixtures,
  fetchMidweekFixtures,
} = useFixtureFetcher();

const { resetAll } = useOperationsActions({
  setSatScheduled,
  setSatUnresolved,
  setSatOverrides,
  setSatManual,
  setSatFetchStatus,
  setSatHasRun,
  setUseAstro,
});

  const sh=String(startHour).padStart(2,"0")+":"+String(startMin).padStart(2,"0");
  const eh=String(endHour).padStart(2,"0")+":"+String(endMin).padStart(2,"0");

  const handleSignOut=useCallback(async()=>{
    const accessToken=authSession?.access_token;

    // Remove the local session first so the secure workspace closes immediately.
    Auth.clearSession();
    clearTenantStorageContext();
    setWorkspaceHydrated(false);
    setWorkspaceSecurityError("");
    setAuthSession(null);
    setMainPage("dashboard");
    setDayTab("saturday");
    setSettingsTab("overview");
    setNavigationTarget(null);

    if(typeof window!=="undefined"){
      window.scrollTo({top:0,left:0,behavior:"auto"});
    }

    // Also revoke the remote session when a token is available.
    if(accessToken) await Auth.signOut(accessToken);
  },[authSession]);

  const handleEndSupportAccess=useCallback(async()=>{
    const sessionId=activeMembership?.supportSessionId;
    if(!sessionId) return;
    try{
      await DB.endOwnSupportSession(sessionId);
      clearTenantStorageContext();
      setWorkspaceHydrated(false);
      await refreshClubAccess();
      toast.success("Support session ended");
    }catch(error){
      toast.error("Support session could not be ended",{description:error?.message});
    }
  },[activeMembership?.supportSessionId,refreshClubAccess]);

  // Auth gate
  if(authLoading||!minimumSplashComplete) return(
    <BrandSplash message={authLoading?"Verifying secure workspace":"Preparing Ground Control"}/>
  );

  if(!authSession) return(
    <LoginScreen
      supaConfigured={isSupaConfigured()}
      onLogin={session=>{Auth.saveSession(session);setAuthSession(session);}}
    />
  );

  if(["idle","loading"].includes(clubAccessStatus)) return(
    <BrandSplash message="Verifying club access"/>
  );

  if(clubAccessStatus!=="ready") return(
    <WorkspaceAccessGate
      status={clubAccessStatus}
      error={clubAccessError}
      canBootstrap={canBootstrap}
      defaultClubName={DEFAULT_CLUB.name}
      onBootstrap={bootstrapFirstWorkspace}
      onRetry={refreshClubAccess}
      onSignOut={handleSignOut}
    />
  );

  if(workspaceSecurityError) return(
    <WorkspaceAccessGate
      status="error"
      error={workspaceSecurityError}
      onRetry={()=>{
        setWorkspaceSecurityError("");
        refreshClubAccess();
      }}
      onSignOut={handleSignOut}
    />
  );

  if(!workspaceHydrated) return(
    <BrandSplash message="Loading secure club workspace"/>
  );

return(
  <MatchdayScopeProvider scope={matchdayScope} setScope={setMatchdayScope}>
  <ProductShell
    mainPage={mainPage}
    setMainPage={setMainPage}
    setDayTab={setDayTab}
    setSettingsTab={setSettingsTab}
    setNavigationTarget={setNavigationTarget}
    matchdayScope={matchdayScope}
    club={club}
    satFinal={satFinal}
    sunFinal={sunFinal}
    midweekFinal={activeMidweekFinal}
    satHasRun={satHasRun}
    sunHasRun={sunHasRun}
    midweekHasRun={activeMidweekHasRun}
    readiness={readiness}
    midweekReadiness={activeMidweekReadiness}
    midweekEnabled={midweekEnabled}
    authSession={authSession}
    memberships={memberships}
    activeClubId={activeClubId}
    activeMembership={activeMembership}
    workspaceAccess={workspaceAccess}
    onClubChange={handleClubChange}
    onEndSupportAccess={handleEndSupportAccess}
    onSignOut={handleSignOut}
  >
       <style dangerouslySetInnerHTML={{__html:"@media print{.np{display:none!important}#combined-print,#combined-print *{visibility:visible!important}body{visibility:hidden!important}#combined-print{position:fixed;top:0;left:0;width:100%}}"}}/>

      <div style={S.body}>
   
{mainPage === "dashboard" && (
  <DashboardPage
    setMainPage={setMainPage}
    setDayTab={setDayTab}
    setNavigationTarget={setNavigationTarget}
    matchdayScope={matchdayScope}
    setMatchdayScope={setMatchdayScope}
    saveWeek={saveWeek}
    club={club}
    history={history}
    pitchCfg={pitchCfg}
    satFinal={satFinal}
    sunFinal={sunFinal}
    midweekFinal={activeMidweekFinal}
    satHasRun={satHasRun}
    sunHasRun={sunHasRun}
    midweekHasRun={activeMidweekHasRun}
    satDate={satDate}
    sunDate={sunDate}
    midweekDate={midweekDate}
    readiness={readiness}
    midweekReadiness={activeMidweekReadiness}
    midweekEnabled={midweekEnabled}
    refWarnings={refWarnings}
    peakCars={peakCars}
    carCap={carCap}
    satConflicts={satConflicts}
    satUnresolved={satUnresolved}
    sunUnresolved={sunUnresolved}
    midweekUnresolved={activeMidweekUnresolved}
    midweekConflicts={activeMidweekConflicts}
    closedPitches={closedPitches}
  />
)}

{mainPage==="operations"&& (
  <OperationsPage>
        {/* Main tabs */}
<DayTabs
  dayTab={dayTab}
  setDayTab={(nextDay)=>{
    clearNavigationTarget();
    setDayTab(nextDay);
  }}
  club={club}
  WH={WH}
  midweekEnabled={midweekEnabled}
/>
{/* ── SATURDAY ── */}
{dayTab === "saturday" && (
  <SaturdayPage
    navigationTarget={navigationTarget}
    clearNavigationTarget={clearNavigationTarget}
    S={S}
    G={G}
    RE={RE}
    AM={AM}
    BL={BL}
    TE={TE}
    PU={PU}
    WH={WH}
    club={club}
    mode={mode}
    testSat={testSat}
    useAstro={useAstro}
    setUseAstro={setUseAstro}
    satDate={satDate}
    setSatDate={setSatDate}
    runSatTest={runSatTest}
    runSatLive={runSatLive}
    showManual={showManual}
    setShowManual={setShowManual}
    satManual={satManual}
    setSatManual={setSatManual}
    teamCfg={teamCfg}
    cleanName={cleanName}
    satFetchStatus={satFetchStatus}
    satFinal={satFinal}
    satActive={satActive}
    satPostponed={satPostponed}
    satUnresolved={satUnresolved}
    refWarnings={refWarnings}
    satHasRun={satHasRun}
    saveWeek={saveWeek}
    resetAll={resetAll}
    TEAM_CONFIG_DEFAULT={TEAM_CONFIG_DEFAULT}
    PITCHES={PITCHES}
    setTeamCfg={setTeamCfg}
    setPitchCfg={setPitchCfg}
    pitchCfg={pitchCfg}
    satOverrides={satOverrides}
    satOv={satOv}
    satScheduled={satScheduled}
    setSatScheduled={setSatScheduled}
    setSatUnresolved={setSatUnresolved}
    satDateLabel={satDateLabel}
    satConflicts={satConflicts}
    refs={refs}
    thC={thC}
    hdrStyle={hdrStyle}
    pitchClosures={pitchClosures}
    closedPitches={satClosedPitches}
    toggleClosed={(pitchId,linkedIds)=>toggleClosed(pitchId,linkedIds,satDate)}
    addPitchClosure={addPitchClosure}
    reopenPitchClosures={reopenPitchClosures}
    closeAllPitches={()=>closeAllPitches(satDate)}
    reopenAllPitches={()=>reopenAllPitches(satDate)}
    startHour={startHour}
    startMin={startMin}
    endHour={endHour}
    endMin={endMin}
    bufferYouth={bufferYouth}
    bufferAdult={bufferAdult}
  />
)}

        {/* ── SUNDAY ── */}
        {dayTab === "sunday" && (
          <SundayPage
            navigationTarget={navigationTarget}
            clearNavigationTarget={clearNavigationTarget}
            S={S}
            G={G}
            RE={RE}
            AM={AM}
            PU={PU}
            club={club}
            hdrStyle={hdrStyle}
            mode={mode}
            sunDate={sunDate}
            setSunDate={setSunDate}
            runSunTest={runSunTest}
            runSunLive={runSunLive}
            showSunManual={showSunManual}
            setShowSunManual={setShowSunManual}
            sunManual={sunManual}
            setSunManual={setSunManual}
            teamCfg={teamCfg}
            sunUnresolved={sunUnresolved}
            sunDateLabel={sunDateLabel}
            sunHasRun={sunHasRun}
            sunFinal={sunFinal}
            pitchCfg={pitchCfg}
            refs={refs}
            sunOv={sunOv}
            thC={thC}
            pitchClosures={pitchClosures}
            closedPitches={sunClosedPitches}
            toggleClosed={(pitchId,linkedIds)=>toggleClosed(pitchId,linkedIds,sunDate)}
            addPitchClosure={addPitchClosure}
            reopenPitchClosures={reopenPitchClosures}
            closeAllPitches={()=>closeAllPitches(sunDate)}
            reopenAllPitches={()=>reopenAllPitches(sunDate)}
            sunOverrides={sunOverrides}
            startHour={startHour}
            startMin={startMin}
            endHour={endHour}
            endMin={endMin}
            bufferYouth={bufferYouth}
            bufferAdult={bufferAdult}
            sunScheduled={sunScheduled}
            setSunScheduled={setSunScheduled}
            setSunUnresolved={setSunUnresolved}
            useAstro={useAstro}
            setUseAstro={setUseAstro}
            testSun={testSun}
          />
        )}

        {midweekEnabled && dayTab === "midweek" && (
          <MidweekPage
            navigationTarget={navigationTarget}
            clearNavigationTarget={clearNavigationTarget}
            S={S}
            G={G}
            RE={RE}
            AM={AM}
            PU={PU}
            WH={WH}
            club={club}
            hdrStyle={hdrStyle}
            mode={mode}
            midweekDate={midweekDate}
            setMidweekDate={setMidweekDate}
            midweekDateLabel={midweekDateLabel}
            midweekDateIsWeekend={midweekDateIsWeekend}
            midweekStartTime={midweekStartTime}
            setMidweekStartTime={setMidweekStartTime}
            midweekEndTime={midweekEndTime}
            setMidweekEndTime={setMidweekEndTime}
            useCurrentMidweekDate={useCurrentMidweekDate}
            runMidweekTest={runMidweekTest}
            runMidweekLive={runMidweekLive}
            showMidweekManual={showMidweekManual}
            setShowMidweekManual={setShowMidweekManual}
            midweekManual={midweekManual}
            setMidweekManual={setMidweekManual}
            midweekFetchStatus={midweekFetchStatus}
            teamCfg={teamCfg}
            midweekUnresolved={midweekUnresolved}
            midweekHasRun={midweekHasRun}
            midweekFinal={midweekFinal}
            pitchCfg={pitchCfg}
            refs={refs}
            midweekOv={midweekOv}
            thC={thC}
            pitchClosures={pitchClosures}
            closedPitches={midweekClosedPitches}
            toggleClosed={(pitchId,linkedIds)=>toggleClosed(pitchId,linkedIds,midweekDate)}
            addPitchClosure={addPitchClosure}
            reopenPitchClosures={reopenPitchClosures}
            closeAllPitches={()=>closeAllPitches(midweekDate)}
            reopenAllPitches={()=>reopenAllPitches(midweekDate)}
            midweekOverrides={midweekOverrides}
            midweekScheduled={midweekScheduled}
            setMidweekScheduled={setMidweekScheduled}
            setMidweekUnresolved={setMidweekUnresolved}
            midweekConflicts={midweekConflicts}
            midweekRefWarnings={midweekRefWarnings}
            midweekPeakCars={midweekPeakCars}
            midweekParkingOver={midweekParkingOver}
            midweekStartHour={midweekStartHour}
            midweekStartMin={midweekStartMin}
            midweekEndHour={midweekEndHour}
            midweekEndMin={midweekEndMin}
            bufferYouth={bufferYouth}
            bufferAdult={bufferAdult}
            useAstro={useAstro}
            setUseAstro={setUseAstro}
            testSat={testSat}
            saveWeek={saveWeek}
            cleanName={cleanName}
          />
        )}

        {dayTab === "centre" && (
          <OperationsCentrePage
            club={club}
            pitchCfg={pitchCfg}
            closedPitches={closedPitches}
            refs={refs}
            satFinal={satFinal}
            sunFinal={sunFinal}
            midweekFinal={activeMidweekFinal}
            satHasRun={satHasRun}
            sunHasRun={sunHasRun}
            midweekHasRun={activeMidweekHasRun}
            midweekEnabled={midweekEnabled}
            satUnresolved={satUnresolved}
            sunUnresolved={sunUnresolved}
            midweekUnresolved={activeMidweekUnresolved}
            satConflicts={satConflicts}
            midweekConflicts={activeMidweekConflicts}
            satDate={satDate}
            sunDate={sunDate}
            midweekDate={midweekDate}
            satDateLabel={satDateLabel}
            sunDateLabel={sunDateLabel}
            midweekDateLabel={midweekDateLabel}
            onWeekendChange={setSatDate}
            onUseCurrentWeekend={useCurrentMatchWeekend}
            onMidweekChange={setMidweekDate}
            onUseCurrentMidweekDate={useCurrentMidweekDate}
            onOpenTimeline={()=>{
              clearNavigationTarget();
              setDayTab("timeline");
            }}
            onOpenArea={(card,targetDay="saturday")=>{
              const workspace =
                ["actionBar","schedule","unresolved"].includes(card)
                  ? "fixtures"
                  : ["pitchClosures","pitchAssignments"].includes(card)
                    ? "resources"
                    : card === "coachMessages"
                      ? "communications"
                      : "intelligence";

              setDayTab(targetDay);
              setNavigationTarget({
                card,
                workspace,
                day:targetDay,
                scrollToSection:true,
                createdAt:Date.now(),
              });
            }}
          />
        )}

        {dayTab === "timeline" && (
          <OperationsTimelinePage
            club={club}
            satFinal={satFinal}
            sunFinal={sunFinal}
            midweekFinal={activeMidweekFinal}
            satHasRun={satHasRun}
            sunHasRun={sunHasRun}
            midweekHasRun={activeMidweekHasRun}
            midweekEnabled={midweekEnabled}
            satDate={satDate}
            sunDate={sunDate}
            midweekDate={midweekDate}
            midweekDateLabel={midweekDateLabel}
            carCap={carCap}
            refs={refs}
            refWarnings={refWarnings}
            closedPitches={closedPitches}
          />
        )}

    </OperationsPage>
)}
    {mainPage === "communications" && (
      <CommunicationsPage />
    )}

    {mainPage === "analytics" && (
      <AnalyticsPage
        club={club}
        history={history}
        pitchCfg={pitchCfg}
        teamCfg={teamCfg}
        refs={refs}
        closedPitches={closedPitches}
        satFinal={satFinal}
        sunFinal={sunFinal}
        midweekFinal={activeMidweekFinal}
        satHasRun={satHasRun}
        sunHasRun={sunHasRun}
        midweekHasRun={activeMidweekHasRun}
        midweekEnabled={midweekEnabled}
        refWarnings={refWarnings}
      />
    )}

    {mainPage === "reports" && (
    <ReportsPage S={S} hdrStyle={hdrStyle} club={club} />
)}
        {/* ── SETTINGS ── */}
        {mainPage === "settings" && (
          <SettingsPage
            S={S}
            G={G}
            RE={RE}
            AM={AM}
            WH={WH}
            club={club}
            setClub={setClub}
            DEFAULT_CLUB={DEFAULT_CLUB}
            AVG_CARS={AVG_CARS}
            settingsTab={settingsTab}
            setSettingsTab={setSettingsTab}
            productionMode={productionMode}
            setProductionMode={setProductionMode}
            setMode={setMode}
            saveTab={saveTab}
            savedTab={savedTab}
            dbStatus={dbStatus}
            setDbStatus={setDbStatus}
            activeClubId={activeClubId}
            activeMembership={activeMembership}
            workspaceAccess={workspaceAccess}
            authSession={authSession}
            refreshClubAccess={refreshClubAccess}
            setHistory={setHistory}
            teamCfg={teamCfg}
            setTeamCfg={setTeamCfg}
            TEAM_CONFIG_DEFAULT={TEAM_CONFIG_DEFAULT}
            pitchCfg={pitchCfg}
            setPitchCfg={setPitchCfg}
            PITCHES={PITCHES}
            refs={refs}
            setRefs={setRefs}
            testSat={testSat}
            setTestSat={setTestSat}
            testSun={testSun}
            setTestSun={setTestSun}
            testMidweek={testMidweek}
            setTestMidweek={setTestMidweek}
            pitchClosures={pitchClosures}
            setPitchClosures={setPitchClosures}
            closedPitches={closedPitches}
            toggleClosed={toggleClosed}
            history={history}
            setSatScheduled={setSatScheduled}
            setSatHasRun={setSatHasRun}
            setDayTab={setDayTab}
            startHour={startHour}
            setStartHour={setStartHour}
            startMin={startMin}
            setStartMin={setStartMin}
            endHour={endHour}
            setEndHour={setEndHour}
            endMin={endMin}
            setEndMin={setEndMin}
            bufferYouth={bufferYouth}
            setBufferYouth={setBufferYouth}
            bufferAdult={bufferAdult}
            setBufferAdult={setBufferAdult}
            DEFAULT_BUFFER_YOUTH={DEFAULT_BUFFER_YOUTH}
            DEFAULT_BUFFER_ADULT={DEFAULT_BUFFER_ADULT}
            hdrStyle={hdrStyle}
            thC={thC}
          />
        )}

        <div style={{textAlign:"center",fontSize:11,color:"#bbb",marginTop:12}} className="np">
          {club.name} - Ground Control v1.5
        </div>
      </div>

      <div className="hidden print:block">
      {satHasRun && satFinal.length > 0 && (
        <CombinedPrintSheet
          satGames={satFinal}
          sunGames={sunHasRun ? sunFinal : []}
          sunScheduled={sunHasRun}
          satDateLabel={mode === "test" ? "Test Matchday" : satDateLabel}
          sunDateLabel={mode === "test" ? "Test Sunday" : sunDateLabel}
          useAstro={useAstro}
          refWarnings={refWarnings}
          startHour={startHour}
          startMin={startMin}
          endHour={endHour}
          endMin={endMin}
          club={club}
        />
      )}
    </div>
  </ProductShell>
  </MatchdayScopeProvider>
  );
}


export default App;