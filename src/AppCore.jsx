// App.jsx
// The main application container. Holds all state and handlers,
// imports logic from lib/ and UI from components/.

import React, { useState, useEffect, useCallback } from "react";
import AppLayout from "./layout/AppLayout.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import OperationsPage from "./pages/OperationsPage.jsx";
import DayTabs from "./components/Operations/DayTabs.jsx";
import SundayPage from "./pages/SundayPage.jsx";
import SaturdayPage from "./pages/SaturdayPage.jsx";
import OperationsTimelinePage from "./pages/OperationsTimelinePage.jsx";
import { useSaturdayScheduling } from "./hooks/useSaturdayScheduling.js";
import { useSundayScheduling } from "./hooks/useSundayScheduling.js";
import { useFixtureFetcher } from "./hooks/useFixtureFetcher.js";
import { useWeekPersistence } from "./hooks/useWeekPersistence.js";
import { useOperationsActions } from "./hooks/useOperationsActions.js";
import ProductShell from "./layout/ProductShell.jsx";
import CommunicationsPage from "./pages/CommunicationsPage.jsx";
import AnalyticsPage from "./pages/AnalyticsPage.jsx";
import { MatchdayScopeProvider } from "./lib/context/MatchdayScopeContext.jsx";
import { MATCHDAY_SCOPES, getDayTabFromScope, normaliseMatchdayScope } from "./lib/domain/matchdayScope.js";

import {
  G, RE, AU, WH, AM, BL, TE, PU,
  DEFAULT_CLUB, PITCHES, AVG_CARS,
  TEAM_CONFIG_DEFAULT, TEST_SAT, TEST_SUN,
  DEFAULT_BUFFER_YOUTH, DEFAULT_BUFFER_ADULT
} from "./lib/constants.js";

import { cleanName, isMini, findCfg, scheduleSat, scheduleSun } from "./lib/scheduler.js";
import { supaFetch, isSupaConfigured, Auth, DB, getSupaKey, setSupaKey } from "./lib/supabase.js";
import { migratePitches } from "./lib/pitches.js";
import { S, thC } from "./lib/styles.js";

import SatPrintSheet from "./components/SatPrintSheet.jsx";
import SunPrintSheet from "./components/SunPrintSheet.jsx";
import CombinedPrintSheet from "./components/CombinedPrintSheet.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import BrandSplash from "./components/BrandSplash.jsx";

function App(){
  const [mode,setMode]=useState("test");
  const [productionMode,setProductionMode]=useState(()=>{try{return localStorage.getItem("hsm_production")==="1";}catch(e){return false;}});
  const [dayTab,setDayTab]=useState("saturday");
  const [matchdayScope,setMatchdayScopeState]=useState(()=>{
    try{return normaliseMatchdayScope(localStorage.getItem("gc_matchday_scope") || MATCHDAY_SCOPES.WEEKEND);}catch(e){return MATCHDAY_SCOPES.WEEKEND;}
  });
  const setMatchdayScope=useCallback((scope)=>{
    const nextScope=normaliseMatchdayScope(scope);
    setMatchdayScopeState(nextScope);
    try{localStorage.setItem("gc_matchday_scope",nextScope);}catch(e){}
    if(nextScope===MATCHDAY_SCOPES.SATURDAY||nextScope===MATCHDAY_SCOPES.SUNDAY){
      setDayTab(getDayTabFromScope(nextScope));
    }
  },[]);
  const [mainPage, setMainPage] = useState("dashboard");
  const [settingsTab,setSettingsTab]=useState("overview");
  const [navigationTarget,setNavigationTarget]=useState(null);
  const clearNavigationTarget=useCallback(()=>setNavigationTarget(null),[]);

  // Saturday state
  const [satScheduled,setSatScheduled]=useState([]);
  const [satUnresolved,setSatUnresolved]=useState([]);
  const [satOverrides,setSatOverrides]=useState({});
  const [satManual,setSatManual]=useState([]);
  const [satFetchStatus,setSatFetchStatus]=useState([]);
  const [satHasRun,setSatHasRun]=useState(false);
  const [satDate,setSatDate]=useState("2026-09-13");

  // Sunday state
  const [sunScheduled,setSunScheduled]=useState([]);
  const [sunUnresolved,setSunUnresolved]=useState([]);
  const [sunOverrides,setSunOverrides]=useState({});
  const [sunManual,setSunManual]=useState([]);
  const [sunHasRun,setSunHasRun]=useState(false);
  const [sunDate,setSunDate]=useState("2026-09-14");

  // Settings state
  const [startHour,setStartHour]=useState(8);
  const [startMin,setStartMin]=useState(30);
  const [endHour,setEndHour]=useState(11);
  const [endMin,setEndMin]=useState(30);
  const [bufferYouth,setBufferYouth]=useState(DEFAULT_BUFFER_YOUTH);
  const [bufferAdult,setBufferAdult]=useState(DEFAULT_BUFFER_ADULT);
  const [useAstro,setUseAstro]=useState(false);
  const [closedPitches,setClosedPitches]=useState([]);
  const closeAllPitches = () => {
    setClosedPitches((pitchCfg || []).map((pitch) => pitch.id));
  };

  const reopenAllPitches = () => {
    setClosedPitches([]);
  };
  const [showManual,setShowManual]=useState(false);
  const [showSunManual,setShowSunManual]=useState(false);
  const [refs,setRefs]=useState([]);
  const [history,setHistory]=useState([]);
  const [teamCfg,setTeamCfg]=useState(()=>{
    try{const s=localStorage.getItem("hsm_teamcfg");if(s)return JSON.parse(s);}catch(e){}
    return TEAM_CONFIG_DEFAULT;
  });

  const [supaKey,setSupaKeyState]=useState(()=>getSupaKey());
  const [dbStatus,setDbStatus]=useState(()=>isSupaConfigured()?"connecting":"disabled");
  const [savedTab,setSavedTab]=useState("");
  const [authSession,setAuthSession]=useState(()=>Auth.getSession());
  const [authLoading,setAuthLoading]=useState(true);
  const [minimumSplashComplete,setMinimumSplashComplete]=useState(false);


  const [club,setClub]=useState(()=>{
    try{const s=localStorage.getItem("hsm_club");if(s)return JSON.parse(s);}catch(e){}
    return DEFAULT_CLUB;
  });
  const [pitchCfg,setPitchCfg]=useState(()=>{
    try{const s=localStorage.getItem("hsm_pitches");if(s){const parsed=JSON.parse(s);if(parsed&&parsed.length>0)return migratePitches(parsed);}}catch(e){}
    return PITCHES;
  });

  const [testSat,setTestSat]=useState(()=>{
    try{const s=localStorage.getItem("hsm_testsat");if(s){const p=JSON.parse(s);if(p&&p.length>0)return p;}}catch(e){}
    return TEST_SAT;
  });
  const [testSun,setTestSun]=useState(()=>{
    try{const s=localStorage.getItem("hsm_testsun");if(s){const p=JSON.parse(s);if(p&&p.length>0)return p;}}catch(e){}
    return TEST_SUN;
  });

  const updateSupaKey=(k)=>{
    const trimmed=k.trim();
    setSupaKey(trimmed);
    setSupaKeyState(trimmed);
    setDbStatus(trimmed.length>20?"connecting":"disabled");
  };

  const saveTab=async(tab,data={})=>{
    if(data.club) setClub(data.club);
    if(data.teamCfg) setTeamCfg(data.teamCfg);
    if(data.refs) setRefs(data.refs);
    if(isSupaConfigured()){
      setDbStatus("saving");
      await Promise.all([
        data.club||tab==="club" ? DB.saveClub(data.club||club) : Promise.resolve(),
        data.teamCfg||tab==="teams" ? DB.saveTeamCfg(data.teamCfg||teamCfg) : Promise.resolve(),
        data.refs||tab==="refs" ? DB.saveRefs(data.refs||refs) : Promise.resolve(),
        tab==="pitches" ? DB.savePitches(pitchCfg) : Promise.resolve(),
      ].filter(Boolean));
      setDbStatus("connected");
    }
    try{localStorage.setItem("hsm_club",JSON.stringify(data.club||club));}catch(e){}
    try{localStorage.setItem("hsm_teamcfg",JSON.stringify(data.teamCfg||teamCfg));}catch(e){}
    try{localStorage.setItem("hsm_refs",JSON.stringify(data.refs||refs));}catch(e){}
    // Audit log
    if(isSupaConfigured()&&authSession){
      const user=authSession.user||{};
      supaFetch("POST","audit_log",[{
        id:String(Date.now()),
        data:{
          action:"save_"+tab,
          user_email:user.email||"unknown",
          user_name:(user.user_metadata&&user.user_metadata.display_name)||user.email||"unknown",
          timestamp:new Date().toISOString(),
          detail:{tab}
        }
      }]);
    }
    setSavedTab(tab);
    setTimeout(()=>setSavedTab(""),2500);
  };

  // Club-aware header style - used instead of S.ch() throughout
  const hdrStyle=(bg)=>({background:bg||club.primary,color:"#fff",padding:"10px 16px",fontWeight:600,fontSize:12,display:"flex",alignItems:"center",gap:8});

  // Load from localStorage immediately, Supabase loads via supaKey effect
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
    // Load localStorage immediately for instant display
    try{const s=localStorage.getItem("hsm_refs");if(s)setRefs(JSON.parse(s));}catch(e){}
    try{const s=localStorage.getItem("hsm_history");if(s)setHistory(JSON.parse(s));}catch(e){}
    // Supabase connection is handled by the supaKey useEffect below
  },[]);

  // Always persist to localStorage as backup
  useEffect(()=>{try{localStorage.setItem("hsm_refs",JSON.stringify(refs));}catch(e){}},[refs]);
  useEffect(()=>{try{localStorage.setItem("hsm_club",JSON.stringify(club));}catch(e){}},[club]);
  useEffect(()=>{try{localStorage.setItem("hsm_pitches",JSON.stringify(pitchCfg));}catch(e){}},[pitchCfg]);
  useEffect(()=>{try{localStorage.setItem("hsm_history",JSON.stringify(history));}catch(e){}},[history]);
  useEffect(()=>{try{localStorage.setItem("hsm_teamcfg",JSON.stringify(teamCfg));}catch(e){}},[teamCfg]);

  // Connect to Supabase on mount and whenever key changes
  useEffect(()=>{
    const key = getSupaKey();
    if(!key||key.length<20){ setDbStatus("disabled"); return; }
    const connect=async()=>{
      setDbStatus("loading");
      try{
        const [histData,refData,cfgData]=await Promise.all([
          DB.loadHistory(),
          DB.loadRefs(),
          DB.loadTeamCfg(),
        ]);
        if(histData&&histData.length) setHistory(histData);
        if(refData&&refData.length) setRefs(refData);
        if(cfgData&&cfgData.length) setTeamCfg(cfgData);
        const clubData=await DB.loadClub();
        if(clubData) setClub(clubData);
        const pitchData=await DB.loadPitches();
        if(pitchData&&pitchData.length) setPitchCfg(migratePitches(pitchData));
        try{
          const tsRow=await supaFetch("GET","club_config?id=eq.testsat&select=data");
          if(tsRow&&tsRow.length&&tsRow[0].data&&tsRow[0].data.fixtures&&tsRow[0].data.fixtures.length)setTestSat(tsRow[0].data.fixtures);
          const tnRow=await supaFetch("GET","club_config?id=eq.testsun&select=data");
          if(tnRow&&tnRow.length&&tnRow[0].data&&tnRow[0].data.fixtures&&tnRow[0].data.fixtures.length)setTestSun(tnRow[0].data.fixtures);
        }catch(e){}
        setDbStatus("connected");
      }catch(e){ console.error("Supabase connect failed:",e); setDbStatus("error"); }
    };
    connect();
  },[supaKey]);

    useEffect(() => {
      const handler = (event) => {
        setMainPage("operations");

        setDayTab(
          event?.detail?.day === "sunday"
            ? "sunday"
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

  // Auto-save to localStorage only - Supabase saves happen via Save buttons
  const mountedRef = typeof window !== "undefined" ? ((window)._hsmMounted = (window)._hsmMounted || {refs:false,cfg:false}) : {refs:false,cfg:false};

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
    const {scheduled:s,unresolved:u}=scheduleSat(all,useAstro,closedPitches,teamCfg,getBufMap(),getStartMins(),getEndMins(),pitchCfg,club.maxConcurrent||3);
    setSatScheduled(s);setSatUnresolved(u);setSatHasRun(true);
  },[satManual,useAstro,closedPitches,teamCfg,startHour,startMin,endHour,endMin,bufferYouth,bufferAdult,pitchCfg]);

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
      closedPitches,
      teamCfg,
      getBufMap(),
      getStartMins(),
      getEndMins(),
      pitchCfg,
      club.maxConcurrent || 3
    );
    setSunScheduled(s);setSunUnresolved(u);setSunHasRun(true);
  },[sunManual,teamCfg,pitchCfg]);

  const runSunTest=()=>runSun(testSun);

const runSunLive = async () => {
  if (!sunDate) {
    alert("Select a Sunday date.");
    return;
  }

  const fixtures = await fetchSundayFixtures(sunDate);

  runSun(fixtures);
};

  const satOv=(i,k,v)=>setSatOverrides(p=>({...p,[i]:{...(p[i]||{}),[k]:v}}));
  const sunOv=(i,k,v)=>setSunOverrides(p=>({...p,[i]:{...(p[i]||{}),[k]:v}}));
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

const satDateLabel=satDate?new Date(satDate).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"}):"Test Saturday";
const sunDateLabel=sunDate?new Date(sunDate).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"}):"Test Sunday";

const { saveWeek } = useWeekPersistence({
  mode,
  satDateLabel,
  satHasRun,
  satFinal,
  satActive,
  satPostponed,
  sunHasRun,
  sunFinal,
  club,
  history,
  setHistory,
  setDbStatus,
  authSession,
});

const {
  fetchSaturdayFixtures,
  fetchSundayFixtures,
} = useFixtureFetcher();

const { toggleClosed, resetAll } = useOperationsActions({
  setClosedPitches,
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

  // Auth gate
  if(authLoading||!minimumSplashComplete) return(
    <BrandSplash message={authLoading?"Verifying secure workspace":"Preparing Ground Control"}/>
  );

  if(!authSession) return(
    <LoginScreen
      supaConfigured={isSupaConfigured()}
      onLogin={session=>{setAuthSession(session);Auth.saveSession(session);}}
    />
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
    satHasRun={satHasRun}
    sunHasRun={sunHasRun}
    readiness={readiness}
    authSession={authSession}
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
    satHasRun={satHasRun}
    sunHasRun={sunHasRun}
    readiness={readiness}
    refWarnings={refWarnings}
    peakCars={peakCars}
    carCap={carCap}
    satConflicts={satConflicts}
    satUnresolved={satUnresolved}
    sunUnresolved={sunUnresolved}
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
    closedPitches={closedPitches}
    toggleClosed={toggleClosed}
    closeAllPitches={closeAllPitches}
    reopenAllPitches={reopenAllPitches}
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
            closedPitches={closedPitches}
            toggleClosed={toggleClosed}
            closeAllPitches={closeAllPitches}
            reopenAllPitches={reopenAllPitches}
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

        {dayTab === "timeline" && (
          <OperationsTimelinePage
            club={club}
            satFinal={satFinal}
            sunFinal={sunFinal}
            satHasRun={satHasRun}
            sunHasRun={sunHasRun}
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
    <AnalyticsPage />
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
            closedPitches={closedPitches}
            toggleClosed={toggleClosed}
            setClosedPitches={setClosedPitches}
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
            supaKey={supaKey}
            setSupaKeyState={setSupaKeyState}
            updateSupaKey={updateSupaKey}
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