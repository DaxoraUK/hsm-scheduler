// App.jsx
// The main application container. Holds all state and handlers,
// imports logic from lib/ and UI from components/.

import React, {
  Suspense,
  lazy,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useSaturdayScheduling } from "./hooks/useSaturdayScheduling.js";
import { useSundayScheduling } from "./hooks/useSundayScheduling.js";
import { useFixtureFetcher } from "./hooks/useFixtureFetcher.js";
import { useWeekPersistence } from "./hooks/useWeekPersistence.js";
import { useClubAccess } from "./hooks/useClubAccess.js";
import { useLeagueAccess } from "./hooks/useLeagueAccess.js";
import { useClubOnboarding } from "./hooks/useClubOnboarding.js";
import { useClubEntitlements } from "./hooks/useClubEntitlements.js";
import { useBillingReadiness } from "./hooks/useBillingReadiness.js";
import { useSessionLifecycle } from "./hooks/useSessionLifecycle.js";
import { usePlatformOperator } from "./hooks/usePlatformOperator.js";
import { useGlobalErrorNotifications } from "./hooks/useGlobalErrorNotifications.js";
import { useOperationsActions } from "./hooks/useOperationsActions.js";
import ProductShell from "./layout/ProductShell.jsx";
import { MatchdayScopeProvider } from "./lib/context/MatchdayScopeContext.jsx";
import {
  MATCHDAY_SCOPES,
  getDayTabFromScope,
  normaliseMatchdayScope,
} from "./lib/domain/matchdayScope.js";
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
  G,
  RE,
  WH,
  AM,
  BL,
  TE,
  PU,
  DEFAULT_CLUB,
  PITCHES,
  AVG_CARS,
  TEAM_CONFIG_DEFAULT,
  DEFAULT_BUFFER_YOUTH,
  DEFAULT_BUFFER_ADULT,
} from "./lib/constants.js";

import { cleanName, scheduleSat, scheduleSun } from "./lib/scheduler.js";
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

import LoginScreen from "./components/LoginScreen.jsx";
import BrandSplash from "./components/BrandSplash.jsx";
import DaxoraSectionErrorBoundary from "./components/system/DaxoraSectionErrorBoundary.jsx";
import { toast } from "./lib/notifications/daxoraNotifications.js";
import {
  clearTenantStorageContext,
  migrateLegacyTenantStorage,
  setTenantStorageContext,
  tenantGetItem,
  tenantGetJson,
  tenantRemoveItem,
  tenantSetItem,
  tenantSetJson,
} from "./lib/storage/tenantStorage.js";
import { createWorkspaceAccess } from "./lib/security/permissions.js";
import { canOpenClubCommand } from "./lib/navigation/workspacePageAccess.js";
import {
  applySubscriptionAccess,
  canOpenPage,
  ENTITLEMENTS,
  getRequiredEntitlementForPage,
  hasEntitlement,
} from "./lib/subscriptions/entitlements.js";
import {
  evaluatePlanCompliance,
  formatPlanOverage,
  getVenueCount,
} from "./lib/subscriptions/planCompliance.js";
import { createOnboardingDraft } from "./lib/onboarding/onboardingEngine.js";
import { reconcileSiteAssignments } from "./lib/siteAssignments.js";
import { buildHistoryRestoreState } from "./lib/history/historyRestore.js";
import {
  alignTeamContacts,
  extractLegacyTeamContacts,
  stripTeamContactsFromConfig,
} from "./lib/communications/contactModel.js";
import {
  DEFAULT_COMMUNICATION_PRIVACY,
  normaliseCommunicationPrivacy,
} from "./lib/communications/privacyModel.js";

const WorkspaceAccessGate = lazy(
  () => import("./components/WorkspaceAccessGate.jsx"),
);
const CustomerOnboardingWizard = lazy(
  () => import("./components/CustomerOnboardingWizard.jsx"),
);
const SubscriptionGate = lazy(
  () => import("./components/SubscriptionGate.jsx"),
);
const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));
const EliteCommandCentrePage = lazy(() => import("./pages/EliteCommandCentrePage.jsx"));
const OperationsPage = lazy(() => import("./pages/OperationsPage.jsx"));
const DayTabs = lazy(() => import("./components/Operations/DayTabs.jsx"));
const SaturdayPage = lazy(() => import("./pages/SaturdayPage.jsx"));
const SundayPage = lazy(() => import("./pages/SundayPage.jsx"));
const MidweekPage = lazy(() => import("./pages/MidweekPage.jsx"));
const OperationsCentrePage = lazy(
  () => import("./pages/OperationsCentrePage.jsx"),
);
const OperationsTimelinePage = lazy(
  () => import("./pages/OperationsTimelinePage.jsx"),
);
const AnnualPlannerPage = lazy(() => import("./pages/AnnualPlannerPage.jsx"));
const CoachHubPage = lazy(() => import("./pages/CoachHubPage.jsx"));
const CommunicationsPage = lazy(() => import("./pages/CommunicationsPage.jsx"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage.jsx"));
const ReportsPage = lazy(() => import("./pages/ReportsPage.jsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.jsx"));
const PlatformAdminPage = lazy(() => import("./pages/PlatformAdminPage.jsx"));
const LeagueManagerPage = lazy(() => import("./pages/LeagueManagerPage.jsx"));

function LazyPageFallback({ label = "workspace" }) {
  return (
    <div className="mx-auto flex min-h-[420px] w-full max-w-[1500px] items-center justify-center px-6 py-12">
      <div className="rounded-3xl border border-slate-200 bg-white px-8 py-7 text-center shadow-sm">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
        <div className="mt-4 text-sm font-black text-slate-800">
          Loading {label}…
        </div>
      </div>
    </div>
  );
}


function isMissingCommunicationSchema(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || error?.details || "").toLowerCase();
  return [400, 404].includes(status) || [
    "list_team_contacts",
    "get_communication_privacy_settings",
    "replace_team_contacts",
    "communication_privacy_settings",
    "team_contacts",
  ].some((token) => message.includes(token));
}

function readClubTiming(club = {}) {
  const timing = club.timingSettings || club.timing || {};
  return {
    startHour: Number(timing.startHour ?? club.startHour ?? 8),
    startMin: Number(timing.startMin ?? club.startMin ?? 30),
    endHour: Number(timing.endHour ?? 11),
    endMin: Number(timing.endMin ?? 30),
    bufferYouth: Number(
      timing.youthBuffer ?? club.bufferYouth ?? DEFAULT_BUFFER_YOUTH,
    ),
    bufferAdult: Number(
      timing.adultBuffer ?? club.bufferAdult ?? DEFAULT_BUFFER_ADULT,
    ),
  };
}

function createUnconfiguredClub(memberClub = {}, clubId = "") {
  const siteId = "main-ground";
  return {
    ...DEFAULT_CLUB,
    id: clubId,
    name: memberClub.name || "New club",
    venue: "",
    postcode: "",
    weatherPostcode: "",
    primarySiteId: siteId,
    sites: [
      {
        id: siteId,
        name: "Main Ground",
        venue: "",
        postcode: "",
        isPrimary: true,
        weatherEnabled: true,
        carParkSpaces: 0,
        notes: "",
      },
    ],
    carParkSpaces: 0,
    maxConcurrent: 3,
    sport: memberClub.sport || "Football",
    logo: "",
    features: {
      ...DEFAULT_CLUB.features,
      midweekEnabled: true,
      parkingEnabled: true,
    },
  };
}

function App() {
  useGlobalErrorNotifications();
  const [mode, setMode] = useState("test");
  const [productionMode, setProductionMode] = useState(false);
  const [dayTab, setDayTab] = useState("saturday");
  const [matchdayScope, setMatchdayScopeState] = useState(
    MATCHDAY_SCOPES.WEEKEND,
  );
  const setMatchdayScope = useCallback((scope) => {
    const nextScope = normaliseMatchdayScope(scope);
    setMatchdayScopeState(nextScope);
    tenantSetItem("matchdayScope", nextScope);
    if (
      [
        MATCHDAY_SCOPES.SATURDAY,
        MATCHDAY_SCOPES.SUNDAY,
        MATCHDAY_SCOPES.MIDWEEK,
      ].includes(nextScope)
    ) {
      setDayTab(getDayTabFromScope(nextScope));
    }
  }, []);
  const [mainPage, setMainPage] = useState("dashboard");
  const [coachCommunicationAudience, setCoachCommunicationAudience] = useState(null);
  const [settingsTab, setSettingsTab] = useState("overview");
  const [navigationTarget, setNavigationTarget] = useState(null);
  const clearNavigationTarget = useCallback(
    () => setNavigationTarget(null),
    [],
  );
  const [matchWeekend, setMatchWeekend] = useState(() =>
    getInitialMatchWeekend(),
  );
  const satDate = matchWeekend.saturday;
  const sunDate = matchWeekend.sunday;
  const [midweekDateState, setMidweekDateState] = useState(() =>
    getInitialMidweekDate(),
  );
  const [midweekWindow, setMidweekWindow] = useState(() =>
    getInitialMidweekWindow(),
  );
  const midweekDate = midweekDateState;
  const midweekStartTime = midweekWindow.start;
  const midweekEndTime = midweekWindow.end;
  const midweekStartMins = timeValueToMinutes(midweekStartTime, 18 * 60);
  const midweekEndMins = timeValueToMinutes(midweekEndTime, 21 * 60 + 30);
  const midweekStartHour = Math.floor(midweekStartMins / 60);
  const midweekStartMin = midweekStartMins % 60;
  const midweekEndHour = Math.floor(midweekEndMins / 60);
  const midweekEndMin = midweekEndMins % 60;

  // Saturday state
  const [satScheduled, setSatScheduled] = useState([]);
  const [satUnresolved, setSatUnresolved] = useState([]);
  const [satOverrides, setSatOverrides] = useState({});
  const [satManual, setSatManual] = useState([]);
  const [satFetchStatus, setSatFetchStatus] = useState([]);
  const [satHasRun, setSatHasRun] = useState(false);

  // Sunday state
  const [sunScheduled, setSunScheduled] = useState([]);
  const [sunUnresolved, setSunUnresolved] = useState([]);
  const [sunOverrides, setSunOverrides] = useState({});
  const [sunManual, setSunManual] = useState([]);
  const [sunHasRun, setSunHasRun] = useState(false);

  // Midweek state
  const [midweekScheduled, setMidweekScheduled] = useState([]);
  const [midweekUnresolved, setMidweekUnresolved] = useState([]);
  const [midweekOverrides, setMidweekOverrides] = useState({});
  const [midweekManual, setMidweekManual] = useState([]);
  const [midweekFetchStatus, setMidweekFetchStatus] = useState([]);
  const [midweekHasRun, setMidweekHasRun] = useState(false);

  // Settings state
  const [startHour, setStartHour] = useState(8);
  const [startMin, setStartMin] = useState(30);
  const [endHour, setEndHour] = useState(11);
  const [endMin, setEndMin] = useState(30);
  const [bufferYouth, setBufferYouth] = useState(DEFAULT_BUFFER_YOUTH);
  const [bufferAdult, setBufferAdult] = useState(DEFAULT_BUFFER_ADULT);
  const [useAstro, setUseAstro] = useState(false);
  const [pitchClosures, setPitchClosures] = useState([]);
  const [showManual, setShowManual] = useState(false);
  const [showSunManual, setShowSunManual] = useState(false);
  const [showMidweekManual, setShowMidweekManual] = useState(false);

  const clearWeekendScheduleForDateChange = useCallback(() => {
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
  }, []);

  const clearMidweekScheduleForDateChange = useCallback(() => {
    setMidweekScheduled([]);
    setMidweekUnresolved([]);
    setMidweekOverrides({});
    setMidweekManual([]);
    setMidweekFetchStatus([]);
    setMidweekHasRun(false);
    setShowMidweekManual(false);
  }, []);

  const setMidweekDate = useCallback(
    (value) => {
      if (!value || value === midweekDateState) return;
      setMidweekDateState(value);
      clearMidweekScheduleForDateChange();
    },
    [clearMidweekScheduleForDateChange, midweekDateState],
  );

  const clearMidweekBuiltSchedule = useCallback(() => {
    setMidweekScheduled([]);
    setMidweekUnresolved([]);
    setMidweekOverrides({});
    setMidweekHasRun(false);
  }, []);

  const setMidweekStartTime = useCallback(
    (value) => {
      setMidweekWindow((current) => ({ ...current, start: value }));
      clearMidweekBuiltSchedule();
    },
    [clearMidweekBuiltSchedule],
  );

  const setMidweekEndTime = useCallback(
    (value) => {
      setMidweekWindow((current) => ({ ...current, end: value }));
      clearMidweekBuiltSchedule();
    },
    [clearMidweekBuiltSchedule],
  );

  const useCurrentMidweekDate = useCallback(() => {
    setMidweekDate(getCurrentOrNextMidweekDate());
  }, [setMidweekDate]);

  const applyMatchWeekend = useCallback(
    (nextWeekend) => {
      if (!nextWeekend?.saturday || !nextWeekend?.sunday) return;
      if (nextWeekend.saturday === satDate && nextWeekend.sunday === sunDate)
        return;
      setMatchWeekend(nextWeekend);
      clearWeekendScheduleForDateChange();
    },
    [satDate, sunDate, clearWeekendScheduleForDateChange],
  );

  const setSatDate = useCallback(
    (value) => {
      applyMatchWeekend(getWeekendFromSaturday(value));
    },
    [applyMatchWeekend],
  );

  const setSunDate = useCallback(
    (value) => {
      applyMatchWeekend(getWeekendFromSunday(value));
    },
    [applyMatchWeekend],
  );

  const useCurrentMatchWeekend = useCallback(() => {
    applyMatchWeekend(getCurrentMatchWeekend());
  }, [applyMatchWeekend]);

  const [refs, setRefs] = useState([]);
  const [history, setHistory] = useState([]);
  const [teamCfg, setTeamCfg] = useState(() => stripTeamContactsFromConfig(TEAM_CONFIG_DEFAULT));
  const [teamContacts, setTeamContacts] = useState(() => alignTeamContacts(TEAM_CONFIG_DEFAULT, extractLegacyTeamContacts(TEAM_CONFIG_DEFAULT)));
  const [communicationPrivacy, setCommunicationPrivacy] = useState(DEFAULT_COMMUNICATION_PRIVACY);
  const [communicationSchemaReady, setCommunicationSchemaReady] = useState(false);

  const [dbStatus, setDbStatus] = useState(() =>
    isSupaConfigured() ? "connecting" : "disabled",
  );
  const [syncError, setSyncError] = useState("");
  const [syncRetryAvailable, setSyncRetryAvailable] = useState(false);
  const retrySyncRef = useRef(null);
  const [savedTab, setSavedTab] = useState("");
  const [authSession, setAuthSession] = useState(() => Auth.getSession());
  const [authLoading, setAuthLoading] = useState(true);
  const [minimumSplashComplete, setMinimumSplashComplete] = useState(false);
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);
  const [workspaceSecurityError, setWorkspaceSecurityError] = useState("");
  const closureSyncRef = useRef({ clubId: "", snapshot: "" });

  const reportSyncSuccess = useCallback(() => {
    retrySyncRef.current = null;
    setSyncRetryAvailable(false);
    setSyncError("");
    setDbStatus("connected");
    if (typeof window !== "undefined")
      window.dispatchEvent(new CustomEvent("ground-control-sync-restored"));
  }, []);

  const reportSyncFailure = useCallback((error, retry) => {
    retrySyncRef.current = typeof retry === "function" ? retry : null;
    setSyncRetryAvailable(typeof retry === "function");
    setSyncError(
      error?.message ||
        "Cloud sync failed. Changes remain on this device until sync is restored.",
    );
    setDbStatus("error");
  }, []);

  const retryLastSync = useCallback(async () => {
    const retry = retrySyncRef.current;
    if (typeof retry !== "function") {
      toast.info("Nothing is waiting to sync");
      return false;
    }
    setDbStatus("saving");
    try {
      await retry();
      reportSyncSuccess();
      toast.success("Cloud sync restored");
      return true;
    } catch (error) {
      reportSyncFailure(error, retry);
      toast.error("Cloud sync is still unavailable", {
        description: error?.message || "Check the connection and try again.",
      });
      return false;
    }
  }, [reportSyncFailure, reportSyncSuccess]);

  const handleSessionExpired = useCallback((message) => {
    clearTenantStorageContext();
    setWorkspaceHydrated(false);
    setWorkspaceSecurityError("");
    setMainPage("dashboard");
    setDayTab("saturday");
    setSettingsTab("overview");
    setNavigationTarget(null);
    toast.error("Secure session ended", {
      description: message || "Sign in again to continue.",
    });
  }, []);

  const { status: sessionStatus } = useSessionLifecycle({
    session: authSession,
    onSession: setAuthSession,
    onExpired: handleSessionExpired,
  });

  const {
    context: platformContext,
    status: platformStatus,
    error: platformError,
    refresh: refreshPlatformContext,
  } = usePlatformOperator(authSession);

  const {
    memberships,
    activeMembership,
    activeClubId,
    status: clubAccessStatus,
    error: clubAccessError,
    canBootstrap,
    refresh: refreshClubAccess,
    selectClub,
    bootstrapFirstWorkspace,
  } = useClubAccess(authSession);

  const {
    leagues: leagueMemberships,
    activeLeague,
    activeLeagueId,
    status: leagueAccessStatus,
    error: leagueAccessError,
    refresh: refreshLeagueAccess,
    selectLeague,
  } = useLeagueAccess(authSession);

  const roleWorkspaceAccess = useMemo(
    () => createWorkspaceAccess(activeMembership),
    [activeMembership],
  );

  const {
    subscription,
    status: subscriptionStatus,
    error: subscriptionError,
    refresh: refreshSubscription,
  } = useClubEntitlements(activeClubId, clubAccessStatus === "ready");

  const workspaceAccess = useMemo(
    () => applySubscriptionAccess(roleWorkspaceAccess, subscription),
    [roleWorkspaceAccess, subscription],
  );

  const {
    billing,
    status: billingStatus,
    error: billingError,
    refresh: refreshBilling,
  } = useBillingReadiness(
    activeClubId,
    clubAccessStatus === "ready" && roleWorkspaceAccess.role === "owner",
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const billingResult = url.searchParams.get("billing");
    if (!billingResult) return;
    url.searchParams.delete("billing");
    window.history.replaceState(
      {},
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    if (billingResult === "success") {
      Promise.all([refreshSubscription(), refreshBilling()]).finally(() => {
        toast.success("Billing setup completed", {
          description:
            "Ground Control is refreshing the subscription from Stripe.",
        });
      });
    } else if (billingResult === "cancelled") {
      toast.info("Checkout cancelled", {
        description: "No subscription change was applied.",
      });
    }
  }, [refreshBilling, refreshSubscription]);

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const {
    onboarding,
    status: onboardingStatus,
    error: onboardingError,
    refresh: refreshOnboarding,
    start: startOnboarding,
    saveProgress: saveOnboardingProgress,
    complete: completeOnboarding,
  } = useClubOnboarding(
    activeClubId,
    clubAccessStatus === "ready" && !roleWorkspaceAccess.isCoach,
  );

  useLayoutEffect(() => {
    setWorkspaceHydrated(false);
    setWorkspaceSecurityError("");
  }, [activeClubId]);

  const handleClubChange = useCallback(
    (clubId) => {
      if (!clubId || clubId === activeClubId) return false;
      setWorkspaceHydrated(false);
      setWorkspaceSecurityError("");
      clearTenantStorageContext();
      return selectClub(clubId);
    },
    [activeClubId, selectClub],
  );

  const handlePlatformOpenClub = useCallback(
    async (clubId) => {
      if (!clubId) return false;
      const nextMemberships = await refreshClubAccess();
      const accessible = nextMemberships.find(
        (membership) => membership.clubId === clubId,
      );
      if (!accessible) return false;
      setWorkspaceHydrated(false);
      setWorkspaceSecurityError("");
      clearTenantStorageContext();
      const selected = selectClub(clubId, nextMemberships);
      if (selected) {
        setMainPage("dashboard");
        setSettingsTab("overview");
        setNavigationTarget(null);
      }
      return selected;
    },
    [refreshClubAccess, selectClub],
  );

  useEffect(() => {
    const subscriptionOwnerRequired =
      subscription?.isReadOnly && !workspaceAccess.canManageSubscription;
    if (
      mainPage === "settings" &&
      (!workspaceAccess.canManageSettings || subscriptionOwnerRequired)
    ) {
      setMainPage("dashboard");
      setSettingsTab("overview");
      toast.error(
        subscriptionOwnerRequired
          ? "Club owner access required"
          : "Administrator access required",
        {
          description: subscriptionOwnerRequired
            ? "Only the club owner can review a restricted subscription."
            : "Your club role does not include workspace settings.",
        },
      );
    }
  }, [
    mainPage,
    subscription?.isReadOnly,
    workspaceAccess.canManageSettings,
    workspaceAccess.canManageSubscription,
  ]);

  const [club, setClub] = useState(DEFAULT_CLUB);
  const midweekEnabled = isMidweekEnabled(club);
  const advancedOperationsEnabled = hasEntitlement(
    subscription,
    ENTITLEMENTS.OPERATIONS_ADVANCED,
  );
  const advancedReportsEnabled = hasEntitlement(
    subscription,
    ENTITLEMENTS.REPORTS_ADVANCED,
  );
  const advancedAnalyticsEnabled = hasEntitlement(
    subscription,
    ENTITLEMENTS.ANALYTICS_ADVANCED,
  );

  useEffect(() => {
    if (midweekEnabled) return;
    if (dayTab === "midweek") setDayTab("saturday");
    if (
      [MATCHDAY_SCOPES.MATCHWEEK, MATCHDAY_SCOPES.MIDWEEK].includes(
        matchdayScope,
      )
    ) {
      setMatchdayScope(MATCHDAY_SCOPES.WEEKEND);
    }
  }, [dayTab, matchdayScope, midweekEnabled, setMatchdayScope]);

  useEffect(() => {
    if (advancedOperationsEnabled) return;
    if (["centre", "timeline"].includes(dayTab)) setDayTab("saturday");
  }, [advancedOperationsEnabled, dayTab]);

  const [pitchCfg, setPitchCfg] = useState(PITCHES);

  const planUsage = useMemo(
    () => ({
      teams: teamCfg.length,
      pitches: pitchCfg.length,
      venues: getVenueCount(club),
      users: memberships.filter((membership) => !membership.status || membership.status === "active").length,
    }),
    [club, memberships, pitchCfg.length, teamCfg.length],
  );
  const planCompliance = useMemo(
    () => evaluatePlanCompliance(subscription, planUsage),
    [planUsage, subscription],
  );
  const operationalWorkspaceAccess = useMemo(
    () => ({
      ...workspaceAccess,
      planCompliance,
      canOperate: Boolean(workspaceAccess.canOperate) && !planCompliance.operationalBlocked,
      canPublish: Boolean(workspaceAccess.canPublish) && !planCompliance.operationalBlocked,
    }),
    [planCompliance, workspaceAccess],
  );
  const requirePlanCompliance = useCallback(() => {
    if (!planCompliance.operationalBlocked) return true;
    toast.error("Workspace is over its plan limit", {
      description: `${formatPlanOverage(planCompliance)} Upgrade the plan or reduce active resources before rebuilding, publishing or sending messages.`,
    });
    setMainPage("settings");
    setSettingsTab("subscription");
    return false;
  }, [planCompliance]);

  const onboardingInitialDraft = useMemo(
    () =>
      createOnboardingDraft({
        club,
        teamCfg,
        pitchCfg,
        scheduling: {
          startHour,
          startMin,
          endHour,
          endMin,
          bufferYouth,
          bufferAdult,
        },
      }),
    [
      club,
      teamCfg,
      pitchCfg,
      startHour,
      startMin,
      endHour,
      endMin,
      bufferYouth,
      bufferAdult,
    ],
  );

  const handleOpenOnboarding = useCallback(async () => {
    if (!workspaceAccess.canManageSettings) {
      toast.error("Administrator access required", {
        description: "Only a club owner or administrator can run onboarding.",
      });
      return false;
    }
    try {
      if (onboarding.status === "complete")
        await startOnboarding({ forceRestart: true });
      else if (onboarding.status !== "in_progress") await startOnboarding();
      setOnboardingOpen(true);
      return true;
    } catch (error) {
      toast.error("Onboarding could not be opened", {
        description: error?.message,
      });
      return false;
    }
  }, [onboarding.status, startOnboarding, workspaceAccess.canManageSettings]);

  const handleCompleteOnboarding = useCallback(
    async ({ club: nextClub, teams, pitches, scheduling, draft }) => {
      await completeOnboarding({
        configuration: { ...nextClub, id: activeClubId || nextClub?.id },
        teams,
        pitches,
        draft,
      });

      const securedClub = { ...nextClub, id: activeClubId || nextClub?.id };
      setClub(securedClub);
      setTeamCfg(stripTeamContactsFromConfig(teams));
      setTeamContacts(alignTeamContacts(teams, extractLegacyTeamContacts(teams)));
      setPitchCfg(migratePitches(pitches));
      setStartHour(scheduling.startHour);
      setStartMin(scheduling.startMin);
      setEndHour(scheduling.endHour);
      setEndMin(scheduling.endMin);
      setBufferYouth(scheduling.bufferYouth);
      setBufferAdult(scheduling.bufferAdult);
      if (!isSupaConfigured() || !activeClubId) {
        tenantSetJson("club", securedClub);
        tenantSetJson("teamConfig", stripTeamContactsFromConfig(teams));
        tenantSetJson("pitches", pitches);
      }
      setDbStatus("connected");
      setOnboardingOpen(false);
      await refreshClubAccess();
      toast.success("Customer setup complete", {
        description:
          "The club operating baseline is now secured and ready to use.",
      });
    },
    [activeClubId, completeOnboarding, refreshClubAccess],
  );

  useEffect(() => {
    if (!workspaceHydrated || onboardingOpen || onboardingStatus !== "ready")
      return;
    if (
      onboarding.status === "complete" ||
      !onboarding.required ||
      !workspaceAccess.canManageSettings
    )
      return;
    if (onboarding.status === "in_progress") {
      setOnboardingOpen(true);
      return;
    }
    startOnboarding()
      .then(() => setOnboardingOpen(true))
      .catch((error) =>
        toast.error("Required setup could not start", {
          description: error?.message,
        }),
      );
  }, [
    onboarding.required,
    onboarding.status,
    onboardingOpen,
    onboardingStatus,
    startOnboarding,
    workspaceAccess.canManageSettings,
    workspaceHydrated,
  ]);

  const satClosedPitches = useMemo(
    () => getActiveClosedPitchIds(pitchClosures, satDate),
    [pitchClosures, satDate],
  );
  const sunClosedPitches = useMemo(
    () => getActiveClosedPitchIds(pitchClosures, sunDate),
    [pitchClosures, sunDate],
  );
  const midweekClosedPitches = useMemo(
    () => getActiveClosedPitchIds(pitchClosures, midweekDate),
    [pitchClosures, midweekDate],
  );
  const closedPitches = useMemo(
    () => [
      ...new Set([
        ...satClosedPitches,
        ...sunClosedPitches,
        ...(midweekEnabled ? midweekClosedPitches : []),
      ]),
    ],
    [midweekClosedPitches, midweekEnabled, satClosedPitches, sunClosedPitches],
  );

  const closureUser = useMemo(() => {
    const user = authSession?.user || {};
    return (
      user.user_metadata?.display_name || user.email || "Ground Control user"
    );
  }, [authSession]);

  const addPitchClosure = useCallback(
    (input = {}) => {
      setPitchClosures((current) =>
        addPitchClosureRecord(current, {
          ...input,
          createdBy: input.createdBy || closureUser,
        }),
      );
    },
    [closureUser],
  );

  const reopenPitchClosures = useCallback(
    (pitchIds, activeDate, metadata = {}) => {
      setPitchClosures((current) =>
        reopenPitchClosureRecords(current, pitchIds, activeDate, {
          ...metadata,
          reopenedBy: metadata.reopenedBy || closureUser,
        }),
      );
    },
    [closureUser],
  );

  const closeAllPitches = useCallback(
    (activeDate) => {
      setPitchClosures((current) =>
        (pitchCfg || []).reduce(
          (records, pitch) =>
            addPitchClosureRecord(records, {
              pitchId: pitch.id,
              mode: "matchday",
              effectiveFrom: activeDate,
              effectiveTo: activeDate,
              reason: "Whole ground closure",
              notes: "All pitches closed for the selected fixture day.",
              createdBy: closureUser,
            }),
          current,
        ),
      );
    },
    [closureUser, pitchCfg],
  );

  const reopenAllPitches = useCallback(
    (activeDate) => {
      reopenPitchClosures(
        (pitchCfg || []).map((pitch) => pitch.id),
        activeDate,
        {
          reopenedReason: "All pitches reopened for the selected fixture day",
        },
      );
    },
    [pitchCfg, reopenPitchClosures],
  );

  const toggleClosed = useCallback(
    (pitchId, linkedPitchIds = [], activeDate = satDate) => {
      const group = [
        pitchId,
        ...(Array.isArray(linkedPitchIds) ? linkedPitchIds : []),
      ];
      const activeIds = new Set(
        getActiveClosedPitchIds(pitchClosures, activeDate),
      );
      const sources = group.filter((id) => activeIds.has(String(id)));
      if (sources.length) {
        reopenPitchClosures(sources, activeDate);
        return;
      }
      addPitchClosure({
        pitchId,
        mode: "untilReopened",
        effectiveFrom: activeDate,
        reason: "Pitch unavailable",
      });
    },
    [addPitchClosure, pitchClosures, reopenPitchClosures, satDate],
  );

  const defaultTestFixtures = (dayKey) =>
    generateTestFixtures({
      dayKey,
      seed: `ground-control-${dayKey}`,
      scenario: "standard",
      club,
      teams: teamCfg,
    });
  const [testSat, setTestSat] = useState(() => defaultTestFixtures("saturday"));
  const [testSun, setTestSun] = useState(() => defaultTestFixtures("sunday"));
  const [testMidweek, setTestMidweek] = useState(() =>
    defaultTestFixtures("midweek"),
  );

  useEffect(() => {
    persistMatchWeekend(matchWeekend);
  }, [matchWeekend]);

  useEffect(() => {
    persistMidweekDate(midweekDate);
  }, [midweekDate]);

  useEffect(() => {
    persistMidweekWindow(midweekWindow);
  }, [midweekWindow]);

  const saveTab = async (tab, data = {}) => {
    if (!workspaceAccess.canManageSettings) {
      toast.error("Administrator access required", {
        description: "Your role cannot change club settings.",
      });
      return false;
    }

    const baseClub = {
      ...(data.club || club),
      id: activeClubId || data.club?.id || club?.id,
    };
    const nextClub =
      tab === "timing"
        ? {
            ...baseClub,
            timingSettings: {
              ...(baseClub.timingSettings || {}),
              startHour,
              startMin,
              endHour,
              endMin,
              earliestKickOff: `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`,
              latestYouthKickOff: `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`,
              youthBuffer: bufferYouth,
              adultBuffer: bufferAdult,
            },
          }
        : baseClub;
    const rawNextTeamCfg = stripTeamContactsFromConfig(data.teamCfg || teamCfg);
    const siteAssignments = reconcileSiteAssignments({
      club: nextClub,
      teams: rawNextTeamCfg,
      pitches: data.pitchCfg || pitchCfg,
    });
    const nextTeamCfg = siteAssignments.teams;
    const nextPitchCfg = siteAssignments.pitches;
    const nextTeamContacts = alignTeamContacts(nextTeamCfg, data.teamContacts || teamContacts);
    const nextRefs = data.refs || refs;
    const cloudAuthoritative = Boolean(isSupaConfigured() && activeClubId);

    const applyApprovedState = () => {
      if (data.club || ["club", "workspace", "venues", "timing"].includes(tab)) setClub(nextClub);
      if (data.teamCfg || tab === "teams") {
        setTeamCfg(nextTeamCfg);
        setTeamContacts(nextTeamContacts);
      }
      if (data.refs || tab === "refs") setRefs(nextRefs);
      if (data.pitchCfg || tab === "pitches") setPitchCfg(nextPitchCfg);
    };

    const performCloudSave = async () => {
      if (data.club || ["club", "workspace", "venues", "timing"].includes(tab)) {
        await DB.saveClub(activeClubId, nextClub);
      }
      if (data.teamCfg || tab === "teams") {
        // Save the limit-controlled collection first. If the plan rejects it,
        // protected coach contacts are not partially updated.
        await DB.saveTeamCfg(activeClubId, nextTeamCfg);
        await DB.saveTeamContacts(activeClubId, nextTeamContacts);
        await DB.syncCoachHubContacts(activeClubId);
      }
      if (data.refs || tab === "refs") await DB.saveRefs(activeClubId, nextRefs);
      if (data.pitchCfg || tab === "pitches") await DB.savePitches(activeClubId, nextPitchCfg);
    };

    const restoreServerApprovedState = async () => {
      if (!cloudAuthoritative) return;
      if (data.club || ["club", "workspace", "venues", "timing"].includes(tab)) {
        const approvedClub = await DB.loadClub(activeClubId);
        if (approvedClub) setClub({ ...DEFAULT_CLUB, ...approvedClub, id: activeClubId });
      }
      if (data.teamCfg || tab === "teams") {
        const [approvedTeams, approvedContacts] = await Promise.all([
          DB.loadTeamCfg(activeClubId),
          DB.loadTeamContacts(activeClubId).catch(() => []),
        ]);
        const safeTeams = stripTeamContactsFromConfig(Array.isArray(approvedTeams) ? approvedTeams : []);
        const approvedAssignments = reconcileSiteAssignments({ club: nextClub, teams: safeTeams });
        setTeamCfg(approvedAssignments.teams);
        setTeamContacts(alignTeamContacts(approvedAssignments.teams, approvedContacts));
      }
      if (data.refs || tab === "refs") setRefs(await DB.loadRefs(activeClubId));
      if (data.pitchCfg || tab === "pitches") {
        const approvedPitches = migratePitches(await DB.loadPitches(activeClubId));
        setPitchCfg(reconcileSiteAssignments({ club: nextClub, pitches: approvedPitches }).pitches);
      }
    };

    try {
      if (cloudAuthoritative) {
        setDbStatus("saving");
        await performCloudSave();
        applyApprovedState();
        reportSyncSuccess();
      } else {
        applyApprovedState();
        tenantSetJson("club", nextClub);
        tenantSetJson("teamConfig", nextTeamCfg);
        tenantSetJson("referees", nextRefs);
        if (data.pitchCfg || tab === "pitches") tenantSetJson("pitches", nextPitchCfg);
      }
      setSavedTab(tab);
      window.setTimeout(() => setSavedTab(""), 2500);
      return true;
    } catch (error) {
      try {
        await restoreServerApprovedState();
      } catch {
        // The original save error is the useful failure to show and retry.
      }
      reportSyncFailure(error, performCloudSave);
      toast.error("Changes were not saved", {
        description:
          error?.message ||
          "The secure workspace rejected the update. Ground Control restored the last server-approved data.",
      });
      return false;
    }
  };

  // Club-aware header style - used instead of S.ch() throughout
  const hdrStyle = (bg) => ({
    background: bg || club.primary,
    color: "#fff",
    padding: "10px 16px",
    fontWeight: 600,
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    gap: 8,
  });

  // Force live mode in production
  useEffect(() => {
    if (productionMode && mode !== "live") setMode("live");
  }, [productionMode, mode]);

  // Keep the launch sequence visible long enough to feel intentional, even when auth resolves instantly.
  useEffect(() => {
    const timer = window.setTimeout(() => setMinimumSplashComplete(true), 1400);
    return () => window.clearTimeout(timer);
  }, []);

  // Consume Supabase email-confirmation callbacks before validating any stored session.
  // This deliberately replaces an existing admin session when a coach confirms a
  // different account in the same browser, then leaves the invitation query intact
  // so useClubAccess can accept the Coach Hub invitation with the confirmed identity.
  useEffect(() => {
    let cancelled = false;

    const initialiseAuth = async () => {
      const callback = await Auth.consumeRedirectSession();
      if (cancelled) return;
      if (callback?.error) {
        Auth.clearSession();
        setAuthSession(null);
        setAuthLoading(false);
        toast.error("Email confirmation could not be completed", {
          description: callback.error,
        });
        return;
      }

      const session = callback?.session || Auth.getSession();
      if (!session?.access_token) {
        setAuthLoading(false);
        return;
      }

      const user = callback?.session?.user || await Auth.getUser(session.access_token);
      if (cancelled) return;
      if (user && !user.error) {
        const verifiedSession = { ...session, user };
        Auth.saveSession(verifiedSession);
        setAuthSession(verifiedSession);
        setAuthLoading(false);
        return;
      }

      if (session.refresh_token) {
        const refreshed = await Auth.refreshSession(session.refresh_token);
        if (cancelled) return;
        if (refreshed?.access_token) {
          Auth.saveSession(refreshed);
          setAuthSession(refreshed);
        } else {
          Auth.clearSession();
          setAuthSession(null);
        }
        setAuthLoading(false);
        return;
      }

      Auth.clearSession();
      setAuthSession(null);
      setAuthLoading(false);
    };

    initialiseAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeClubId || !authSession?.user?.id) {
      setWorkspaceHydrated(false);
      return undefined;
    }

    let cancelled = false;
    const hydrate = async () => {
      setWorkspaceHydrated(false);
      setWorkspaceSecurityError("");
      setDbStatus("loading");
      let allowLocalHydration = true;

      setTenantStorageContext({
        userId: authSession.user.id,
        clubId: activeClubId,
      });
      migrateLegacyTenantStorage();

      if (roleWorkspaceAccess.isCoach) {
        const coachClub = {
          ...DEFAULT_CLUB,
          id: activeClubId,
          name: activeMembership?.club?.name || DEFAULT_CLUB.name,
        };
        setClub(coachClub);
        setTeamCfg([]);
        setTeamContacts([]);
        setPitchCfg([]);
        setPitchClosures([]);
        setRefs([]);
        setHistory([]);
        setCommunicationPrivacy(DEFAULT_COMMUNICATION_PRIVACY);
        setCommunicationSchemaReady(true);
        setDbStatus("connected");
        reportSyncSuccess();
        setWorkspaceHydrated(true);
        return;
      }

      const cloudAuthoritative = Boolean(isSupaConfigured() && activeClubId);
      if (cloudAuthoritative) {
        ["club", "teamConfig", "referees", "history", "pitches", "pitchClosures"].forEach((key) => tenantRemoveItem(key));
      }

      const memberClub = activeMembership?.club || {};
      const localClub = cloudAuthoritative ? null : tenantGetJson("club", null);
      const localTeams = cloudAuthoritative ? TEAM_CONFIG_DEFAULT : tenantGetJson("teamConfig", TEAM_CONFIG_DEFAULT);
      const localRefs = cloudAuthoritative ? [] : tenantGetJson("referees", []);
      const localHistory = cloudAuthoritative ? [] : tenantGetJson("history", []);
      const localPitches = cloudAuthoritative ? PITCHES : tenantGetJson("pitches", PITCHES);
      const safeLocalPitches =
        Array.isArray(localPitches) && localPitches.length
          ? migratePitches(localPitches)
          : PITCHES;
      const localClosures = loadPitchClosures();
      const fallbackClub = {
        ...DEFAULT_CLUB,
        ...(localClub || {}),
        id: activeClubId,
        name: localClub?.name || memberClub.name || DEFAULT_CLUB.name,
        features: {
          ...(DEFAULT_CLUB.features || {}),
          ...(localClub?.features || {}),
        },
      };
      const fallbackTeamRows = Array.isArray(localTeams)
        ? localTeams
        : TEAM_CONFIG_DEFAULT;
      const fallbackContacts = alignTeamContacts(
        fallbackTeamRows,
        extractLegacyTeamContacts(fallbackTeamRows),
      );
      const fallbackTeams = stripTeamContactsFromConfig(fallbackTeamRows);

      setClub(fallbackClub);
      const fallbackTiming = readClubTiming(fallbackClub);
      setStartHour(fallbackTiming.startHour);
      setStartMin(fallbackTiming.startMin);
      setEndHour(fallbackTiming.endHour);
      setEndMin(fallbackTiming.endMin);
      setBufferYouth(fallbackTiming.bufferYouth);
      setBufferAdult(fallbackTiming.bufferAdult);
      const fallbackAssignments = reconcileSiteAssignments({
        club: fallbackClub,
        teams: fallbackTeams,
        pitches: safeLocalPitches,
      });
      setTeamCfg(fallbackAssignments.teams);
      setTeamContacts(fallbackContacts);
      setCommunicationPrivacy(DEFAULT_COMMUNICATION_PRIVACY);
      setCommunicationSchemaReady(false);
      setRefs(Array.isArray(localRefs) ? localRefs : []);
      setHistory(Array.isArray(localHistory) ? localHistory : []);
      setPitchCfg(fallbackAssignments.pitches);
      setPitchClosures(Array.isArray(localClosures) ? localClosures : []);
      const nextProductionMode = tenantGetItem("productionMode", "0") === "1";
      setProductionMode(nextProductionMode);
      setMode(nextProductionMode ? "live" : "test");
      setMatchdayScopeState(
        normaliseMatchdayScope(
          tenantGetItem("matchdayScope", MATCHDAY_SCOPES.WEEKEND),
        ),
      );
      setMatchWeekend(getInitialMatchWeekend());
      setMidweekDateState(getInitialMidweekDate());
      setMidweekWindow(getInitialMidweekWindow());
      clearWeekendScheduleForDateChange();
      clearMidweekScheduleForDateChange();

      const localTestSat = tenantGetJson("testSaturday", null);
      const localTestSun = tenantGetJson("testSunday", null);
      const localTestMidweek = tenantGetJson("testMidweek", null);
      setTestSat(
        Array.isArray(localTestSat)
          ? localTestSat
          : generateTestFixtures({
              dayKey: "saturday",
              seed: "ground-control-saturday",
              scenario: "standard",
              club: fallbackClub,
              teams: fallbackTeams,
            }),
      );
      setTestSun(
        Array.isArray(localTestSun)
          ? localTestSun
          : generateTestFixtures({
              dayKey: "sunday",
              seed: "ground-control-sunday",
              scenario: "standard",
              club: fallbackClub,
              teams: fallbackTeams,
            }),
      );
      setTestMidweek(
        Array.isArray(localTestMidweek)
          ? localTestMidweek
          : generateTestFixtures({
              dayKey: "midweek",
              seed: "ground-control-midweek",
              scenario: "standard",
              club: fallbackClub,
              teams: fallbackTeams,
            }),
      );

      try {
        const [
          histData,
          refData,
          cfgData,
          clubData,
          pitchData,
          closureData,
          remoteTestSat,
          remoteTestSun,
          remoteTestMidweek,
          communicationContext,
        ] = await Promise.all([
          DB.loadHistory(activeClubId),
          DB.loadRefs(activeClubId),
          DB.loadTeamCfg(activeClubId),
          DB.loadClub(activeClubId),
          DB.loadPitches(activeClubId),
          DB.loadPitchClosures(activeClubId),
          DB.loadTestFixtures(activeClubId, "testsat"),
          DB.loadTestFixtures(activeClubId, "testsun"),
          DB.loadTestFixtures(activeClubId, "testmidweek"),
          workspaceAccess.canOperate
            ? Promise.all([
                DB.loadTeamContacts(activeClubId),
                DB.getCommunicationPrivacy(activeClubId),
              ])
                .then(([contacts, privacy]) => ({ available: true, contacts, privacy }))
                .catch((error) => {
                  if (isMissingCommunicationSchema(error)) {
                    return { available: false, contacts: [], privacy: DEFAULT_COMMUNICATION_PRIVACY };
                  }
                  throw error;
                })
            : Promise.resolve({ available: true, contacts: [], privacy: DEFAULT_COMMUNICATION_PRIVACY }),
        ]);
        if (cancelled) return;

        const isUnconfiguredWorkspace =
          !clubData &&
          (!Array.isArray(cfgData) || cfgData.length === 0) &&
          (!Array.isArray(pitchData) || pitchData.length === 0);
        const nextClub = isUnconfiguredWorkspace
          ? createUnconfiguredClub(memberClub, activeClubId)
          : {
              ...DEFAULT_CLUB,
              ...fallbackClub,
              ...(clubData || {}),
              id: activeClubId,
              name: clubData?.name || fallbackClub.name,
              features: {
                ...(DEFAULT_CLUB.features || {}),
                ...(fallbackClub.features || {}),
                ...(clubData?.features || {}),
              },
            };
        const rawNextTeams = isUnconfiguredWorkspace
          ? []
          : Array.isArray(cfgData)
            ? cfgData
            : [];
        const nextTeams = stripTeamContactsFromConfig(rawNextTeams);
        const legacyRemoteContacts = extractLegacyTeamContacts(rawNextTeams);
        const nextTeamContacts = alignTeamContacts(
          nextTeams,
          communicationContext.available && communicationContext.contacts.length
            ? communicationContext.contacts
            : legacyRemoteContacts,
        );
        const nextPitches =
          Array.isArray(pitchData) && pitchData.length
            ? migratePitches(pitchData)
            : isUnconfiguredWorkspace
              ? []
              : PITCHES;
        const nextClosures = Array.isArray(closureData) ? closureData : [];
        const resolvedAssignments = reconcileSiteAssignments({
          club: nextClub,
          teams: nextTeams,
          pitches: nextPitches,
        });

        setClub(nextClub);
        const nextTiming = readClubTiming(nextClub);
        setStartHour(nextTiming.startHour);
        setStartMin(nextTiming.startMin);
        setEndHour(nextTiming.endHour);
        setEndMin(nextTiming.endMin);
        setBufferYouth(nextTiming.bufferYouth);
        setBufferAdult(nextTiming.bufferAdult);
        setHistory(Array.isArray(histData) ? histData : []);
        setRefs(Array.isArray(refData) ? refData : []);
        setTeamCfg(resolvedAssignments.teams);
        setTeamContacts(nextTeamContacts);
        setCommunicationPrivacy(normaliseCommunicationPrivacy(communicationContext.privacy));
        setCommunicationSchemaReady(Boolean(communicationContext.available));
        setPitchCfg(
          isUnconfiguredWorkspace
            ? []
            : nextPitches.length
              ? resolvedAssignments.pitches
              : reconcileSiteAssignments({ club: nextClub, pitches: PITCHES }).pitches,
        );
        setPitchClosures(nextClosures);
        setTestSat(
          remoteTestSat.length
            ? remoteTestSat
            : generateTestFixtures({
                dayKey: "saturday",
                seed: "ground-control-saturday",
                scenario: "standard",
                club: nextClub,
                teams: resolvedAssignments.teams,
              }),
        );
        setTestSun(
          remoteTestSun.length
            ? remoteTestSun
            : generateTestFixtures({
                dayKey: "sunday",
                seed: "ground-control-sunday",
                scenario: "standard",
                club: nextClub,
                teams: resolvedAssignments.teams,
              }),
        );
        setTestMidweek(
          remoteTestMidweek.length
            ? remoteTestMidweek
            : generateTestFixtures({
                dayKey: "midweek",
                seed: "ground-control-midweek",
                scenario: "standard",
                club: nextClub,
                teams: resolvedAssignments.teams,
              }),
        );
        closureSyncRef.current = {
          clubId: activeClubId,
          snapshot: JSON.stringify(nextClosures),
        };
        if (
          activeMembership?.accessMode === "support" &&
          activeMembership?.supportSessionId
        ) {
          await DB.recordSupportWorkspaceOpen(
            activeClubId,
            activeMembership.supportSessionId,
          );
        }
        reportSyncSuccess();
      } catch (error) {
        if (cancelled) return;
        const cloudAuthoritative = Boolean(isSupaConfigured() && activeClubId);
        if (cloudAuthoritative) {
          allowLocalHydration = false;
          setDbStatus("error");
          setWorkspaceSecurityError(
            error?.message ||
              "The secure club workspace could not be loaded. Ground Control will not use browser-cached operational data.",
          );
          return;
        }
        closureSyncRef.current = {
          clubId: activeClubId,
          snapshot: JSON.stringify(localClosures),
        };
        const retryWorkspaceLoad = async () => {
          await DB.ping(activeClubId);
          window.location.reload();
        };
        reportSyncFailure(error, retryWorkspaceLoad);
        toast.error("Local workspace unavailable", {
          description: error?.message || "The local demonstration workspace could not be loaded.",
        });
      } finally {
        if (!cancelled && allowLocalHydration) setWorkspaceHydrated(true);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [
    activeClubId,
    activeMembership?.club?.name,
    activeMembership?.accessMode,
    activeMembership?.supportSessionId,
    authSession?.user?.id,
    clearMidweekScheduleForDateChange,
    clearWeekendScheduleForDateChange,
    reportSyncFailure,
    reportSyncSuccess,
    roleWorkspaceAccess.isCoach,
    workspaceAccess.canOperate,
  ]);

  useEffect(() => {
    if (workspaceHydrated && (!isSupaConfigured() || !activeClubId)) tenantSetJson("referees", refs);
  }, [activeClubId, refs, workspaceHydrated]);
  useEffect(() => {
    if (workspaceHydrated && (!isSupaConfigured() || !activeClubId)) tenantSetJson("club", club);
  }, [activeClubId, club, workspaceHydrated]);
  useEffect(() => {
    if (workspaceHydrated && (!isSupaConfigured() || !activeClubId)) tenantSetJson("pitches", pitchCfg);
  }, [activeClubId, pitchCfg, workspaceHydrated]);
  useEffect(() => {
    if (workspaceHydrated && (!isSupaConfigured() || !activeClubId)) tenantSetJson("history", history);
  }, [activeClubId, history, workspaceHydrated]);
  useEffect(() => {
    if (workspaceHydrated && (!isSupaConfigured() || !activeClubId)) tenantSetJson("teamConfig", teamCfg);
  }, [activeClubId, teamCfg, workspaceHydrated]);
  useEffect(() => {
    if (workspaceHydrated) tenantSetJson("testSaturday", testSat);
  }, [testSat, workspaceHydrated]);
  useEffect(() => {
    if (workspaceHydrated) tenantSetJson("testSunday", testSun);
  }, [testSun, workspaceHydrated]);
  useEffect(() => {
    if (workspaceHydrated) tenantSetJson("testMidweek", testMidweek);
  }, [testMidweek, workspaceHydrated]);

  useEffect(() => {
    if (!workspaceHydrated || !activeClubId) return undefined;
    if (!isSupaConfigured() || !activeClubId) persistPitchClosures(pitchClosures);
    const snapshot = JSON.stringify(pitchClosures);
    if (
      closureSyncRef.current.clubId === activeClubId &&
      closureSyncRef.current.snapshot === snapshot
    )
      return undefined;
    if (!isSupaConfigured() || !workspaceAccess.canOperate) return undefined;

    const syncClosures = async () => {
      await DB.savePitchClosures(activeClubId, pitchClosures);
      closureSyncRef.current = { clubId: activeClubId, snapshot };
    };
    const timer = window.setTimeout(async () => {
      try {
        await syncClosures();
        reportSyncSuccess();
      } catch (error) {
        reportSyncFailure(error, syncClosures);
        try {
          const approvedClosures = await DB.loadPitchClosures(activeClubId);
          setPitchClosures(Array.isArray(approvedClosures) ? approvedClosures : []);
        } catch {
          // Preserve the original sync failure as the actionable error.
        }
        toast.error("Pitch closures were not saved", {
          description: error?.message || "The secure workspace rejected the update.",
        });
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [
    activeClubId,
    pitchClosures,
    reportSyncFailure,
    reportSyncSuccess,
    roleWorkspaceAccess.isCoach,
    workspaceAccess.canOperate,
    workspaceHydrated,
  ]);

  useEffect(() => {
    const handler = (event) => {
      setMainPage("operations");

      setDayTab(
        event?.detail?.day === "sunday"
          ? "sunday"
          : event?.detail?.day === "midweek"
            ? "midweek"
            : "saturday",
      );
    };

    window.addEventListener("ground-control-open-operations", handler);

    return () => {
      window.removeEventListener("ground-control-open-operations", handler);
    };
  }, []);

  const makePitchBuffer = (youth, adult) => {
    const map = {};
    ["3v3", "5v5", "7v7", "9v9", "11v11-youth", "11v11-small"].forEach((f) => {
      map[f] = youth;
    });
    map["11v11"] = adult;
    return map;
  };
  const getBufMap = () => makePitchBuffer(bufferYouth, bufferAdult);
  const getStartMins = () => startHour * 60 + startMin;
  const getEndMins = () => endHour * 60 + endMin;

  const runSat = useCallback(
    (baseFx) => {
      if (!requirePlanCompliance()) return false;
      setSatOverrides({});
      const all = [...baseFx, ...satManual];
      const { scheduled: s, unresolved: u } = scheduleSat(
        all,
        useAstro,
        satClosedPitches,
        teamCfg,
        getBufMap(),
        getStartMins(),
        getEndMins(),
        pitchCfg,
        club.maxConcurrent || 3,
      );
      setSatScheduled(s);
      setSatUnresolved(u);
      setSatHasRun(true);
      return true;
    },
    [
      satManual,
      useAstro,
      satClosedPitches,
      teamCfg,
      startHour,
      startMin,
      endHour,
      endMin,
      bufferYouth,
      bufferAdult,
      pitchCfg,
      requirePlanCompliance,
    ],
  );

  const runSatTest = () => {
    if (!requirePlanCompliance()) return false;
    setSatFetchStatus([
      {
        id: "TEST",
        name: "Demonstration Data",
        ok: true,
        count: testSat.length,
      },
    ]);
    runSat(testSat);
  };

  const runSatLive = async () => {
    if (!requirePlanCompliance()) return false;
    if (!satDate) {
      toast.warning("Select a Saturday date", { description: "Choose the Saturday match date before building the schedule." });
      return;
    }

    try {
      const { statuses, fixtures, skipped, partial } = await fetchSaturdayFixtures(satDate);
      if (skipped) {
        toast.warning("Full-Time source not configured", { description: "Add and enable at least one source in Settings, or use manual fixtures." });
        return false;
      }
      setSatFetchStatus(statuses);
      if (partial) toast.warning("Some Full-Time sources failed", { description: "Successful sources were imported. Review the source status before publishing." });
      setSatHasRun(false);
      setSatScheduled([]);
      setSatUnresolved([]);
      runSat(fixtures);
      if (!fixtures.length) toast.info("No Saturday home fixtures found", { description: "The sources responded successfully but contained no matching fixtures for this date." });
      return true;
    } catch (error) {
      if (error?.statuses) setSatFetchStatus(error.statuses);
      toast.error("Full-Time import failed", { description: error?.message || "The existing Saturday schedule was left unchanged." });
      return false;
    }
  };

  const runSun = useCallback(
    (baseFx) => {
      if (!requirePlanCompliance()) return false;
      setSunOverrides({});
      const all = [...baseFx, ...sunManual];
      const { scheduled: s, unresolved: u } = scheduleSun(
        all,
        useAstro,
        sunClosedPitches,
        teamCfg,
        getBufMap(),
        getStartMins(),
        getEndMins(),
        pitchCfg,
        club.maxConcurrent || 3,
      );
      setSunScheduled(s);
      setSunUnresolved(u);
      setSunHasRun(true);
      return true;
    },
    [
      sunManual,
      useAstro,
      sunClosedPitches,
      teamCfg,
      startHour,
      startMin,
      endHour,
      endMin,
      bufferYouth,
      bufferAdult,
      pitchCfg,
      club.maxConcurrent,
      requirePlanCompliance,
    ],
  );

  const runSunTest = () => {
    if (!requirePlanCompliance()) return false;
    return runSun(testSun);
  };

  const runSunLive = async () => {
    if (!requirePlanCompliance()) return false;
    if (!sunDate) {
      toast.warning("Select a Sunday date", { description: "Choose the Sunday match date before building the schedule." });
      return;
    }

    try {
      const { fixtures, skipped, partial } = await fetchSundayFixtures(sunDate);
      if (skipped) {
        toast.warning("Full-Time source not configured", { description: "Add and enable at least one source in Settings, or use manual fixtures." });
        return false;
      }
      if (partial) toast.warning("Some Full-Time sources failed", { description: "Successful Sunday fixtures were imported; review the configured sources." });
      runSun(fixtures);
      if (!fixtures.length) toast.info("No Sunday home fixtures found", { description: "The sources responded successfully but contained no matching Sunday fixtures for this date." });
      return true;
    } catch (error) {
      toast.error("Full-Time import failed", { description: error?.message || "The existing Sunday schedule was left unchanged." });
      return false;
    }
  };

  const runMidweek = useCallback(
    (baseFx) => {
      if (!requirePlanCompliance()) return false;
      setMidweekOverrides({});
      const all = [...baseFx, ...midweekManual];
      const { scheduled: s, unresolved: u } = scheduleSat(
        all,
        useAstro,
        midweekClosedPitches,
        teamCfg,
        getBufMap(),
        midweekStartMins,
        midweekEndMins,
        pitchCfg,
        club.maxConcurrent || 3,
        { fixedAdultKickOffMins: null },
      );
      setMidweekScheduled(s);
      setMidweekUnresolved(u);
      setMidweekHasRun(true);
      return true;
    },
    [
      midweekManual,
      useAstro,
      midweekClosedPitches,
      teamCfg,
      bufferYouth,
      bufferAdult,
      midweekStartMins,
      midweekEndMins,
      pitchCfg,
      club.maxConcurrent,
      requirePlanCompliance,
    ],
  );

  const runMidweekTest = () => {
    if (!requirePlanCompliance()) return false;
    setMidweekFetchStatus([
      {
        id: "TEST",
        name: "Midweek Demonstration Data",
        ok: true,
        count: testMidweek.length,
      },
    ]);
    runMidweek(testMidweek);
  };

  const runMidweekLive = async () => {
    if (!requirePlanCompliance()) return false;
    if (!midweekDate) {
      toast.warning("Select a midweek fixture date", { description: "Choose the midweek fixture date before building the schedule." });
      return;
    }

    if (midweekEndMins <= midweekStartMins) {
      toast.warning("Check the midweek time window", { description: "The end time must be later than the start time." });
      return;
    }

    try {
      const { statuses, fixtures, skipped, partial } = await fetchMidweekFixtures(midweekDate);
      if (skipped) {
        toast.warning("Full-Time source not configured", { description: "Add and enable at least one source in Settings, or use manual fixtures." });
        return false;
      }
      setMidweekFetchStatus(statuses);
      if (partial) toast.warning("Some Full-Time sources failed", { description: "Successful sources were imported. Review the source status before publishing." });
      setMidweekHasRun(false);
      setMidweekScheduled([]);
      setMidweekUnresolved([]);
      runMidweek(fixtures);
      if (!fixtures.length) toast.info("No midweek home fixtures found", { description: "The sources responded successfully but contained no matching fixtures for this date." });
      return true;
    } catch (error) {
      if (error?.statuses) setMidweekFetchStatus(error.statuses);
      toast.error("Full-Time import failed", { description: error?.message || "The existing midweek schedule was left unchanged." });
      return false;
    }
  };

  const satOv = (i, k, v) =>
    setSatOverrides((p) => ({ ...p, [i]: { ...(p[i] || {}), [k]: v } }));
  const sunOv = (i, k, v) =>
    setSunOverrides((p) => ({ ...p, [i]: { ...(p[i] || {}), [k]: v } }));
  const midweekOv = (i, k, v) =>
    setMidweekOverrides((p) => ({ ...p, [i]: { ...(p[i] || {}), [k]: v } }));
  const {
    satFinal,
    satActive,
    satPostponed,
    refWarnings,
    satConflicts,
    peakCars,
    carCap,
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

  const activeMidweekFinal = midweekEnabled ? midweekFinal : [];
  const activeMidweekHasRun = midweekEnabled && midweekHasRun;
  const activeMidweekActive = midweekEnabled ? midweekActive : [];
  const activeMidweekPostponed = midweekEnabled ? midweekPostponed : [];
  const activeMidweekConflicts = midweekEnabled ? midweekConflicts : [];
  const activeMidweekUnresolved = midweekEnabled ? midweekUnresolved : [];
  const activeMidweekReadiness = midweekEnabled ? midweekReadiness : null;

  const satDateLabel = formatMatchdayDate(satDate, "Saturday");
  const sunDateLabel = formatMatchdayDate(sunDate, "Sunday");
  const midweekDateLabel = formatMidweekDate(midweekDate, "Midweek");
  const midweekDateIsWeekend = isWeekendDate(midweekDate);

  const handleLoadHistory = useCallback(
    (week) => {
      const restored = buildHistoryRestoreState(week);
      const saturday = restored.saturday;
      const sunday = restored.sunday;
      const midweek = restored.midweek;

      if (saturday.date && sunday.date) {
        setMatchWeekend({ saturday: saturday.date, sunday: sunday.date });
      } else if (saturday.date) {
        setMatchWeekend(getWeekendFromSaturday(saturday.date));
      } else if (sunday.date) {
        setMatchWeekend(getWeekendFromSunday(sunday.date));
      }
      if (midweek.date) setMidweekDateState(midweek.date);

      setSatScheduled(saturday.fixtures);
      setSatUnresolved([]);
      setSatOverrides({});
      setSatManual([]);
      setSatFetchStatus([]);
      setSatHasRun(saturday.hasRun);

      setSunScheduled(sunday.fixtures);
      setSunUnresolved([]);
      setSunOverrides({});
      setSunManual([]);
      setSunHasRun(sunday.hasRun);

      setMidweekScheduled(midweek.fixtures);
      setMidweekUnresolved([]);
      setMidweekOverrides({});
      setMidweekManual([]);
      setMidweekFetchStatus([]);
      setMidweekHasRun(midweek.hasRun);

      const populatedDays = [saturday, sunday, midweek].filter(
        (day) => day.hasRun || day.fixtures.length > 0,
      );
      const targetDay = restored.firstPopulatedDay;
      const targetScope =
        populatedDays.length > 1
          ? MATCHDAY_SCOPES.MATCHWEEK
          : targetDay === "sunday"
            ? MATCHDAY_SCOPES.SUNDAY
            : targetDay === "midweek"
              ? MATCHDAY_SCOPES.MIDWEEK
              : MATCHDAY_SCOPES.SATURDAY;

      setMatchdayScope(targetScope);
      setDayTab(targetDay);
      setMainPage("operations");
      setSettingsTab("overview");
      setNavigationTarget(null);
      if (typeof window !== "undefined")
        window.scrollTo?.({ top: 0, behavior: "smooth" });
      toast.success("Saved matchweek loaded", {
        description: `${restored.label} restored across ${Math.max(populatedDays.length, 1)} operating day${populatedDays.length === 1 ? "" : "s"}.`,
      });
      return true;
    },
    [setMatchdayScope],
  );

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
    midweekHasRun: activeMidweekHasRun,
    midweekFinal: activeMidweekFinal,
    midweekActive: activeMidweekActive,
    midweekPostponed: activeMidweekPostponed,
    club,
    history,
    setHistory,
    setDbStatus,
    activeClubId,
    subscription,
    canPublish: operationalWorkspaceAccess.canPublish,
    onSyncFailure: reportSyncFailure,
    onSyncSuccess: reportSyncSuccess,
  });

  const { fetchSaturdayFixtures, fetchSundayFixtures, fetchMidweekFixtures } =
    useFixtureFetcher(club.integrations?.fullTimeFa || {});

  const { resetAll } = useOperationsActions({
    setSatScheduled,
    setSatUnresolved,
    setSatOverrides,
    setSatManual,
    setSatFetchStatus,
    setSatHasRun,
    setUseAstro,
  });

  const handleProfileUpdated = useCallback(
    (nextSession) => {
      if (!nextSession?.access_token || !nextSession?.user) return;
      Auth.saveSession(nextSession);
      setAuthSession(nextSession);
      refreshPlatformContext?.();
      refreshClubAccess?.();
      refreshLeagueAccess?.();
    },
    [refreshClubAccess, refreshLeagueAccess, refreshPlatformContext],
  );

  const handleSignOut = useCallback(async () => {
    const accessToken = authSession?.access_token;

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

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }

    // Also revoke the remote session when a token is available.
    if (accessToken) await Auth.signOut(accessToken);
  }, [authSession]);

  const handleEndSupportAccess = useCallback(async () => {
    const sessionId = activeMembership?.supportSessionId;
    if (!sessionId) return;
    try {
      await DB.endOwnSupportSession(sessionId);
      clearTenantStorageContext();
      setWorkspaceHydrated(false);
      await refreshClubAccess();
      toast.success("Support session ended");
    } catch (error) {
      toast.error("Support session could not be ended", {
        description: error?.message,
      });
    }
  }, [activeMembership?.supportSessionId, refreshClubAccess]);

  // Auth gate
  if (authLoading || !minimumSplashComplete)
    return (
      <BrandSplash
        message={
          authLoading
            ? "Verifying secure workspace"
            : "Preparing Ground Control"
        }
      />
    );

  if (!authSession)
    return (
      <LoginScreen
        supaConfigured={isSupaConfigured()}
        onLogin={(session) => {
          Auth.saveSession(session);
          setAuthSession(session);
        }}
      />
    );

  if (["idle", "loading"].includes(platformStatus))
    return <BrandSplash message="Verifying account access" />;

  const hasLeagueAccess = leagueAccessStatus === "ready" && leagueMemberships.length > 0;
  const canOpenStandaloneWorkspace = clubAccessStatus !== "ready"
    && (platformContext.isPlatformStaff || hasLeagueAccess);

  if (["idle", "loading"].includes(clubAccessStatus))
    return <BrandSplash message="Verifying workspace access" />;

  if (clubAccessStatus !== "ready"
      && !platformContext.isPlatformStaff
      && ["idle", "loading"].includes(leagueAccessStatus))
    return <BrandSplash message="Verifying League Manager access" />;

  if (canOpenStandaloneWorkspace) {
    const standalonePage = platformContext.isPlatformStaff
      ? (mainPage === "league" ? "league" : "platform")
      : "league";
    return (
      <ProductShell
        mainPage={standalonePage}
        setMainPage={setMainPage}
        setDayTab={setDayTab}
        setSettingsTab={setSettingsTab}
        setNavigationTarget={setNavigationTarget}
        club={{ name: platformContext.isPlatformStaff ? "Daxora Platform" : "League Manager" }}
        authSession={authSession}
        memberships={memberships}
        activeClubId={activeClubId}
        activeMembership={activeMembership}
        platformContext={platformContext}
        platformOnly={platformContext.isPlatformStaff}
        leagueOnly={!platformContext.isPlatformStaff}
        leagueMemberships={leagueMemberships}
        activeLeagueId={activeLeagueId}
        activeLeague={activeLeague}
        dbStatus={dbStatus}
        syncError={syncError}
        sessionStatus={sessionStatus}
        onRetrySync={syncRetryAvailable ? retryLastSync : null}
        onClubChange={handleClubChange}
        onProfileUpdated={handleProfileUpdated}
        onSignOut={handleSignOut}
      >
        {standalonePage === "league" ? (
          <Suspense fallback={<LazyPageFallback label="League Manager" />}>
            <LeagueManagerPage
              leagues={leagueMemberships}
              activeLeague={activeLeague}
              activeLeagueId={activeLeagueId}
              leagueStatus={leagueAccessStatus}
              leagueError={leagueAccessError}
              onRefreshLeagues={refreshLeagueAccess}
              onSelectLeague={selectLeague}
              platformContext={platformContext}
            />
          </Suspense>
        ) : (
          <Suspense fallback={<LazyPageFallback label="Daxora administration" />}>
            <PlatformAdminPage
              platformContext={platformContext}
              platformStatus={platformStatus}
              platformError={platformError}
              onRefreshPlatformContext={refreshPlatformContext}
              memberships={memberships}
              onOpenClub={handlePlatformOpenClub}
            />
          </Suspense>
        )}
      </ProductShell>
    );
  }

  if (clubAccessStatus !== "ready")
    return (
      <Suspense fallback={<BrandSplash message="Preparing workspace access" />}>
        <WorkspaceAccessGate
          status={clubAccessStatus}
          error={clubAccessError || (leagueAccessStatus === "error" ? leagueAccessError : "")}
          canBootstrap={canBootstrap}
          defaultClubName={DEFAULT_CLUB.name}
          onBootstrap={bootstrapFirstWorkspace}
          onRetry={() => Promise.all([refreshClubAccess(), refreshLeagueAccess()])}
          onSignOut={handleSignOut}
        />
      </Suspense>
    );

  if (["idle", "loading"].includes(subscriptionStatus))
    return <BrandSplash message="Verifying plan access" />;

  if (subscriptionStatus === "error" || !subscription)
    return (
      <Suspense
        fallback={<BrandSplash message="Preparing subscription access" />}
      >
        <WorkspaceAccessGate
          status="error"
          error={
            subscriptionError || "The club subscription could not be verified."
          }
          onRetry={refreshSubscription}
          onSignOut={handleSignOut}
        />
      </Suspense>
    );

  if (workspaceSecurityError)
    return (
      <Suspense fallback={<BrandSplash message="Preparing secure workspace" />}>
        <WorkspaceAccessGate
          status="error"
          error={workspaceSecurityError}
          onRetry={() => {
            setWorkspaceSecurityError("");
            refreshClubAccess();
          }}
          onSignOut={handleSignOut}
        />
      </Suspense>
    );

  if (!workspaceHydrated)
    return <BrandSplash message="Loading secure club workspace" />;

  if (roleWorkspaceAccess.isCoach) {
    return (
      <Suspense fallback={<BrandSplash message="Opening Coach Hub" />}>
        <DaxoraSectionErrorBoundary
          resetKey={`${activeClubId || "coach"}:${authSession?.user?.id || "session"}`}
          title="Coach Hub needs a refresh"
          description="Your club data remains safe. Retry this workspace without returning to the full application recovery screen."
        >
          <CoachHubPage
            clubId={activeClubId}
            activeMembership={activeMembership}
            memberships={memberships}
            authSession={authSession}
            subscription={subscription}
            onClubChange={handleClubChange}
            onSignOut={handleSignOut}
          />
        </DaxoraSectionErrorBoundary>
      </Suspense>
    );
  }

  const requiredPageEntitlement = getRequiredEntitlementForPage(mainPage);
  const independentWorkspacePage = mainPage === "league" || mainPage === "platform";
  const pageEntitled = independentWorkspacePage || canOpenPage(subscription, mainPage);
  const clubCommandAllowed = canOpenClubCommand(workspaceAccess);
  const openSubscriptionSettings = () => {
    setMainPage("settings");
    setSettingsTab("subscription");
  };

  const openCurrentReport = ({
    day = "matchweek",
    reportType = "fixtures",
    autoPrint = false,
  } = {}) => {
    const scope = String(day || "matchweek").toLowerCase();
    setNavigationTarget({
      target: "reports",
      page: "reports",
      source: "current",
      scope,
      reportType,
      autoPrint: Boolean(autoPrint),
      createdAt: Date.now(),
    });
    setMainPage("reports");
  };

  const openCoachMessages = () => {
    setNavigationTarget(null);
    setMainPage("communications");
  };

  return (
    <MatchdayScopeProvider scope={matchdayScope} setScope={setMatchdayScope}>
      {onboardingOpen && (
        <Suspense fallback={null}>
          <CustomerOnboardingWizard
            open
            onboarding={onboarding}
            status={onboardingStatus}
            initialDraft={onboardingInitialDraft}
            currentClub={club}
            canClose={!onboarding.required}
            onClose={() => setOnboardingOpen(false)}
            onSaveProgress={saveOnboardingProgress}
            onComplete={handleCompleteOnboarding}
          />
        </Suspense>
      )}
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
        subscription={subscription}
        platformContext={platformContext}
        leagueMemberships={leagueMemberships}
        activeLeagueId={activeLeagueId}
        activeLeague={activeLeague}
        dbStatus={dbStatus}
        syncError={syncError}
        sessionStatus={sessionStatus}
        onRetrySync={syncRetryAvailable ? retryLastSync : null}
        onClubChange={handleClubChange}
        onProfileUpdated={handleProfileUpdated}
        onEndSupportAccess={handleEndSupportAccess}
        onSignOut={handleSignOut}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
         @media print {
           .np { display: none !important; }
           body[data-print-target="reports"] * { visibility: hidden !important; }
           body[data-print-target="reports"] #ground-control-report-print,
           body[data-print-target="reports"] #ground-control-report-print * { visibility: visible !important; }
           body[data-print-target="reports"] #ground-control-report-print {
             position: absolute;
             inset: 0;
             width: 100%;
           }
           @page { size: A4 landscape; margin: 12mm; }
         }
       `,
          }}
        />

        <div style={S.body}>
          {mainPage !== "league" && planCompliance.operationalBlocked ? (
            <div className="np mx-auto mb-4 flex max-w-[1500px] flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-950 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-black">Workspace over plan limit</div>
                <div className="mt-1 text-sm font-semibold text-amber-800">
                  {formatPlanOverage(planCompliance)} Rebuilding, publishing and web messaging are paused until the workspace is within plan or upgraded.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMainPage("settings");
                  setSettingsTab("subscription");
                }}
                className="h-10 shrink-0 rounded-xl bg-slate-950 px-4 text-xs font-black text-white"
              >
                Review plan
              </button>
            </div>
          ) : null}
          {!pageEntitled && mainPage !== "settings" && !independentWorkspacePage && (
            <Suspense fallback={<LazyPageFallback label="plan access" />}>
              <SubscriptionGate
                entitlement={requiredPageEntitlement}
                subscription={subscription}
                onOpenSubscription={
                  workspaceAccess.canManageSubscription
                    ? openSubscriptionSettings
                    : undefined
                }
              />
            </Suspense>
          )}

          {mainPage === "executive" && pageEntitled && clubCommandAllowed && (
            <Suspense fallback={<LazyPageFallback label="Club Command" />}>
              <EliteCommandCentrePage
                club={club}
                teamCfg={teamCfg}
                pitchCfg={pitchCfg}
                memberships={memberships}
                satFinal={satFinal}
                sunFinal={sunFinal}
                midweekFinal={activeMidweekFinal}
                satUnresolved={satUnresolved}
                sunUnresolved={sunUnresolved}
                midweekUnresolved={activeMidweekUnresolved}
                closedPitches={closedPitches}
                midweekEnabled={midweekEnabled}
                satDate={satDate}
                sunDate={sunDate}
                midweekDate={midweekDate}
                satDateLabel={satDateLabel}
                sunDateLabel={sunDateLabel}
                midweekDateLabel={midweekDateLabel}
                satHasRun={satHasRun}
                sunHasRun={sunHasRun}
                midweekHasRun={midweekHasRun}
                setMainPage={setMainPage}
                setDayTab={setDayTab}
                setSettingsTab={setSettingsTab}
                activeClubId={activeClubId}
                workspaceAccess={workspaceAccess}
                activeUserId={authSession?.user?.id || ""}
              />
            </Suspense>
          )}

          {mainPage === "dashboard" && pageEntitled && (
            <Suspense fallback={<LazyPageFallback label="Mission Control" />}>
              <DashboardPage
                setMainPage={setMainPage}
                setDayTab={setDayTab}
                setNavigationTarget={setNavigationTarget}
                subscription={subscription}
                workspaceAccess={operationalWorkspaceAccess}
                advancedOperationsEnabled={advancedOperationsEnabled}
                clubCommandAvailable={clubCommandAllowed && canOpenPage(subscription, "executive")}
                matchdayScope={matchdayScope}
                setMatchdayScope={setMatchdayScope}
                saveWeek={saveWeek}
                mode={mode}
                runSatTest={runSatTest}
                runSatLive={runSatLive}
                runSunTest={runSunTest}
                runSunLive={runSunLive}
                runMidweekTest={runMidweekTest}
                runMidweekLive={runMidweekLive}
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
            </Suspense>
          )}

          {mainPage === "planner" && pageEntitled && (
            <Suspense fallback={<LazyPageFallback label="Annual Planner" />}>
              <AnnualPlannerPage
                club={club}
                pitchCfg={pitchCfg}
                teamCfg={teamCfg}
                workspaceAccess={operationalWorkspaceAccess}
                subscription={subscription}
                teamContacts={teamContacts}
                onOpenCoachAudience={(audience) => {
                  setCoachCommunicationAudience(audience);
                  setMainPage("communications");
                }}
                satFinal={satFinal}
                sunFinal={sunFinal}
                midweekFinal={activeMidweekFinal}
                satDate={satDate}
                sunDate={sunDate}
                midweekDate={midweekDate}
                midweekEnabled={midweekEnabled}
              />
            </Suspense>
          )}

          {mainPage === "operations" && pageEntitled && (
            <Suspense fallback={<LazyPageFallback label="operations" />}>
              <OperationsPage>
                {/* Main tabs */}
                <DayTabs
                  dayTab={dayTab}
                  setDayTab={(nextDay) => {
                    clearNavigationTarget();
                    setDayTab(nextDay);
                  }}
                  club={club}
                  WH={WH}
                  midweekEnabled={midweekEnabled}
                  advancedOperationsEnabled={advancedOperationsEnabled}
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
                    subscription={subscription}
                    workspaceAccess={operationalWorkspaceAccess}
                    advancedOperationsEnabled={advancedOperationsEnabled}
                    testSat={testSat}
                    useAstro={useAstro}
                    setUseAstro={setUseAstro}
                    satDate={satDate}
                    sunDateLabel={sunDateLabel}
                    setSatDate={setSatDate}
                    useCurrentMatchWeekend={useCurrentMatchWeekend}
                    runSatTest={runSatTest}
                    runSatLive={runSatLive}
                    onPrintReport={() =>
                      openCurrentReport({
                        day: "saturday",
                        reportType: "fixtures",
                        autoPrint: true,
                      })
                    }
                    onPublish={() => openCoachMessages("saturday")}
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
                    toggleClosed={(pitchId, linkedIds) =>
                      toggleClosed(pitchId, linkedIds, satDate)
                    }
                    addPitchClosure={addPitchClosure}
                    reopenPitchClosures={reopenPitchClosures}
                    closeAllPitches={() => closeAllPitches(satDate)}
                    reopenAllPitches={() => reopenAllPitches(satDate)}
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
                    subscription={subscription}
                    workspaceAccess={operationalWorkspaceAccess}
                    advancedOperationsEnabled={advancedOperationsEnabled}
                    sunDate={sunDate}
                    satDateLabel={satDateLabel}
                    setSunDate={setSunDate}
                    useCurrentMatchWeekend={useCurrentMatchWeekend}
                    runSunTest={runSunTest}
                    runSunLive={runSunLive}
                    onPrintReport={() =>
                      openCurrentReport({
                        day: "sunday",
                        reportType: "fixtures",
                        autoPrint: true,
                      })
                    }
                    onPublish={() => openCoachMessages("sunday")}
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
                    toggleClosed={(pitchId, linkedIds) =>
                      toggleClosed(pitchId, linkedIds, sunDate)
                    }
                    addPitchClosure={addPitchClosure}
                    reopenPitchClosures={reopenPitchClosures}
                    closeAllPitches={() => closeAllPitches(sunDate)}
                    reopenAllPitches={() => reopenAllPitches(sunDate)}
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
                    subscription={subscription}
                    workspaceAccess={operationalWorkspaceAccess}
                    advancedOperationsEnabled={advancedOperationsEnabled}
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
                    onPrintReport={() =>
                      openCurrentReport({
                        day: "midweek",
                        reportType: "fixtures",
                        autoPrint: true,
                      })
                    }
                    onPublish={() => openCoachMessages("midweek")}
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
                    toggleClosed={(pitchId, linkedIds) =>
                      toggleClosed(pitchId, linkedIds, midweekDate)
                    }
                    addPitchClosure={addPitchClosure}
                    reopenPitchClosures={reopenPitchClosures}
                    closeAllPitches={() => closeAllPitches(midweekDate)}
                    reopenAllPitches={() => reopenAllPitches(midweekDate)}
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

                {advancedOperationsEnabled && dayTab === "centre" && (
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
                    onOpenTimeline={() => {
                      clearNavigationTarget();
                      setDayTab("timeline");
                    }}
                    onOpenArea={(card, targetDay = "saturday") => {
                      const workspace = [
                        "actionBar",
                        "schedule",
                        "unresolved",
                      ].includes(card)
                        ? "fixtures"
                        : ["pitchClosures", "pitchAssignments"].includes(card)
                          ? "resources"
                          : card === "coachMessages"
                            ? "communications"
                            : "intelligence";

                      setDayTab(targetDay);
                      setNavigationTarget({
                        card,
                        workspace,
                        day: targetDay,
                        scrollToSection: true,
                        createdAt: Date.now(),
                      });
                    }}
                  />
                )}

                {advancedOperationsEnabled && dayTab === "timeline" && (
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
            </Suspense>
          )}
          {mainPage === "communications" && pageEntitled && (
            <Suspense fallback={<LazyPageFallback label="communications" />}>
              <CommunicationsPage
                club={club}
                activeClubId={activeClubId}
                workspaceAccess={operationalWorkspaceAccess}
                subscription={subscription}
                teamCfg={teamCfg}
                teamContacts={teamContacts}
                communicationPrivacy={communicationPrivacy}
                communicationSchemaReady={communicationSchemaReady}
                satFinal={satFinal}
                sunFinal={sunFinal}
                midweekFinal={activeMidweekFinal}
                satUnresolved={satUnresolved}
                sunUnresolved={sunUnresolved}
                midweekUnresolved={activeMidweekUnresolved}
                satHasRun={satHasRun}
                sunHasRun={sunHasRun}
                midweekHasRun={activeMidweekHasRun}
                satDateLabel={satDateLabel}
                sunDateLabel={sunDateLabel}
                midweekDateLabel={midweekDateLabel}
                midweekEnabled={midweekEnabled}
                audience={coachCommunicationAudience}
                onClearAudience={() => setCoachCommunicationAudience(null)}
              />
            </Suspense>
          )}

          {mainPage === "analytics" && pageEntitled && (
            <Suspense fallback={<LazyPageFallback label="analytics" />}>
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
                activeClubId={activeClubId}
                workspaceAccess={workspaceAccess}
                subscription={subscription}
                advancedAnalyticsEnabled={advancedAnalyticsEnabled}
                onOpenSubscription={
                  workspaceAccess.canManageSubscription
                    ? openSubscriptionSettings
                    : undefined
                }
              />
            </Suspense>
          )}

          {mainPage === "reports" && pageEntitled && (
            <Suspense fallback={<LazyPageFallback label="reports" />}>
              <ReportsPage
                club={club}
                activeClubId={activeClubId}
                subscription={subscription}
                advancedReportsEnabled={advancedReportsEnabled}
                onOpenSubscription={
                  workspaceAccess.canManageSubscription
                    ? openSubscriptionSettings
                    : undefined
                }
                history={history}
                pitchCfg={pitchCfg}
                teamCfg={teamCfg}
                refs={refs}
                satFinal={satFinal}
                sunFinal={sunFinal}
                midweekFinal={activeMidweekFinal}
                satUnresolved={satUnresolved}
                sunUnresolved={sunUnresolved}
                midweekUnresolved={activeMidweekUnresolved}
                satHasRun={satHasRun}
                sunHasRun={sunHasRun}
                midweekHasRun={activeMidweekHasRun}
                satDate={satDate}
                sunDate={sunDate}
                midweekDate={midweekDate}
                satDateLabel={satDateLabel}
                sunDateLabel={sunDateLabel}
                midweekDateLabel={midweekDateLabel}
                midweekEnabled={midweekEnabled}
                navigationTarget={navigationTarget}
                clearNavigationTarget={clearNavigationTarget}
              />
            </Suspense>
          )}
          {mainPage === "league" && (
            <Suspense fallback={<LazyPageFallback label="League Manager" />}>
              <LeagueManagerPage
                leagues={leagueMemberships}
                activeLeague={activeLeague}
                activeLeagueId={activeLeagueId}
                leagueStatus={leagueAccessStatus}
                leagueError={leagueAccessError}
                onRefreshLeagues={refreshLeagueAccess}
                onSelectLeague={selectLeague}
                platformContext={platformContext}
              />
            </Suspense>
          )}
          {mainPage === "platform" && platformContext.isPlatformStaff && (
            <Suspense
              fallback={<LazyPageFallback label="Daxora administration" />}
            >
              <PlatformAdminPage
                platformContext={platformContext}
                platformStatus={platformStatus}
                platformError={platformError}
                onRefreshPlatformContext={refreshPlatformContext}
                memberships={memberships}
                onOpenClub={handlePlatformOpenClub}
              />
            </Suspense>
          )}
          {/* ── SETTINGS ── */}
          {mainPage === "settings" && (
            <Suspense fallback={<LazyPageFallback label="settings" />}>
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
                platformContext={platformContext}
                subscription={subscription}
                subscriptionStatus={subscriptionStatus}
                subscriptionError={subscriptionError}
                onRefreshSubscription={refreshSubscription}
                planUsage={planUsage}
                planCompliance={planCompliance}
                billing={billing}
                billingStatus={billingStatus}
                billingError={billingError}
                onRefreshBilling={refreshBilling}
                onboarding={onboarding}
                onboardingStatus={onboardingStatus}
                onboardingError={onboardingError}
                onOpenOnboarding={handleOpenOnboarding}
                onRefreshOnboarding={refreshOnboarding}
                authSession={authSession}
                refreshClubAccess={refreshClubAccess}
                setHistory={setHistory}
                teamCfg={teamCfg}
                setTeamCfg={setTeamCfg}
                teamContacts={teamContacts}
                setTeamContacts={setTeamContacts}
                communicationPrivacy={communicationPrivacy}
                setCommunicationPrivacy={setCommunicationPrivacy}
                communicationSchemaReady={communicationSchemaReady}
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
                onLoadHistory={handleLoadHistory}
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
            </Suspense>
          )}

          <div
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "#bbb",
              marginTop: 12,
            }}
            className="np"
          >
            {club.name} - Ground Control v1.5
          </div>
        </div>
      </ProductShell>
    </MatchdayScopeProvider>
  );
}

export default App;
