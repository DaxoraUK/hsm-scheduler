import React, { useEffect, useMemo, useRef, useState } from "react";
import PageContainer from "@/ui/PageContainer.jsx";
import DashboardMissionHero from "../components/dashboard/DashboardMissionHero.jsx";
import DashboardStatusStrip from "../components/dashboard/DashboardStatusStrip.jsx";
import RecentActivityCard from "../components/dashboard/RecentActivityCard.jsx";
import { getRefereeStats, getParkingStats } from "../lib/dashboardStats.js";
import {
  buildMissionControlWorkflow,
  getMissionState,
  WORKFLOW_ACTIONS,
} from "../lib/engines/workflowEngine.js";
import { createNavigationController } from "../lib/navigation/index.js";
import { useMatchdayScope } from "../lib/context/MatchdayScopeContext.jsx";
import {
  getDayTabFromScope,
  getMatchdayScopeLabel,
  getScopedMatchdayData,
  MATCHDAY_SCOPES,
  normaliseMatchdayScope,
} from "../lib/domain/matchdayScope.js";
import useLiveWeather from "../hooks/useLiveWeather.js";
import { calculateWeatherIntelligence } from "../lib/engines/weatherIntelligenceEngine.js";
import { findOfficialConflicts } from "../lib/engines/officialsEngine.js";
import { readMatchdayLock } from "../lib/operations/matchdayLock.js";
import { toast } from "sonner";
import {
  ENTITLEMENTS,
  hasEntitlement,
} from "../lib/subscriptions/entitlements.js";

import {
  CalendarDays,
  ChevronDown,
  Save,
  FileText,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";

export default function DashboardPage({
  setMainPage,
  setDayTab,
  setNavigationTarget,
  subscription,
  workspaceAccess,
  advancedOperationsEnabled = false,
  matchdayScope: matchdayScopeProp,
  setMatchdayScope: setMatchdayScopeProp,
  saveWeek,
  mode = "test",
  runSatTest,
  runSatLive,
  runSunTest,
  runSunLive,
  runMidweekTest,
  runMidweekLive,
  club,
  history = [],
  pitchCfg = [],
  satFinal = [],
  sunFinal = [],
  midweekFinal = [],
  satHasRun,
  sunHasRun,
  midweekHasRun,
  satDate,
  sunDate,
  midweekDate,
  peakCars = 0,
  carCap = 57,
  satConflicts = [],
  satUnresolved = [],
  sunUnresolved = [],
  midweekUnresolved = [],
  midweekConflicts = [],
  closedPitches = [],
  midweekEnabled = true,
}) {
  const matchdayScopeContext = useMatchdayScope();
  const matchdayScope = normaliseMatchdayScope(
    matchdayScopeProp || matchdayScopeContext.scope,
  );
  const setMatchdayScope =
    setMatchdayScopeProp || matchdayScopeContext.setScope;
  const navigationDay = getDayTabFromScope(matchdayScope);
  const nav = createNavigationController({
    setMainPage,
    setDayTab,
    setNavigationTarget,
  });
  const canSchedule = hasEntitlement(
    subscription,
    ENTITLEMENTS.MATCHDAY_SCHEDULING,
  );
  const canExport = hasEntitlement(subscription, ENTITLEMENTS.DATA_EXPORT);
  const canWrite =
    Boolean(workspaceAccess?.canOperate) && !subscription?.isReadOnly;
  const operationsLandingDay = advancedOperationsEnabled
    ? "centre"
    : navigationDay;
  const [actionsOpen, setActionsOpen] = useState(false);
  const [buildOpen, setBuildOpen] = useState(false);
  const [buildSelection, setBuildSelection] = useState({
    saturday: true,
    sunday: true,
    midweek: true,
  });
  const [buildingMatchweek, setBuildingMatchweek] = useState(false);
  const actionsRef = useRef(null);

  useEffect(() => {
    if (!actionsOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!actionsRef.current?.contains(event.target)) {
        setActionsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setActionsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [actionsOpen]);

  const satActive = useMemo(
    () => satFinal.filter((game) => game.status !== "postponed"),
    [satFinal],
  );
  const sunActive = useMemo(
    () => sunFinal.filter((game) => game.status !== "postponed"),
    [sunFinal],
  );
  const midweekActive = useMemo(
    () => midweekFinal.filter((game) => game.status !== "postponed"),
    [midweekFinal],
  );

  const scopedMatchday = getScopedMatchdayData({
    scope: matchdayScope,
    satFinal,
    sunFinal,
    midweekFinal,
    satHasRun,
    sunHasRun,
    midweekHasRun,
  });

  const totalFixtures = scopedMatchday.activeFixtures.length;
  const scheduleBuilt = scopedMatchday.scheduleBuilt;

  const refereeStats = getRefereeStats({
    fixtures: scopedMatchday.activeFixtures,
  });
  const officialConflicts = findOfficialConflicts(
    scopedMatchday.activeFixtures,
  );

  const parkingStats = getParkingStats({
    fixtures: scopedMatchday.activeFixtures,
    club,
    pitchCfg,
    peakCars,
    carCap,
    scope: matchdayScope,
  });

  const fixtureIssues =
    (scopedMatchday.includeSaturday
      ? satConflicts.length + satUnresolved.length
      : 0) +
    (scopedMatchday.includeSunday ? sunUnresolved.length : 0) +
    (scopedMatchday.includeMidweek
      ? midweekConflicts.length + midweekUnresolved.length
      : 0);

  const communicationsReady = scheduleBuilt && totalFixtures > 0;

  const buildDays = useMemo(
    () =>
      [
        {
          id: "saturday",
          label: "Saturday",
          date: satDate,
          enabled: mode === "test" || Boolean(satDate),
          hasRun: Boolean(satHasRun),
          currentCount: satActive.length,
          run: mode === "test" ? runSatTest : runSatLive,
        },
        {
          id: "sunday",
          label: "Sunday",
          date: sunDate,
          enabled: mode === "test" || Boolean(sunDate),
          hasRun: Boolean(sunHasRun),
          currentCount: sunActive.length,
          run: mode === "test" ? runSunTest : runSunLive,
        },
        ...(midweekEnabled
          ? [
              {
                id: "midweek",
                label: "Midweek",
                date: midweekDate,
                enabled: mode === "test" || Boolean(midweekDate),
                hasRun: Boolean(midweekHasRun),
                currentCount: midweekActive.length,
                run: mode === "test" ? runMidweekTest : runMidweekLive,
              },
            ]
          : []),
      ].map((item) => ({
        ...item,
        locked: readMatchdayLock({
          clubId: club?.id || club?.name,
          day: item.id,
          date: item.date,
        }),
      })),
    [
      club?.id,
      midweekActive.length,
      midweekDate,
      midweekEnabled,
      midweekHasRun,
      mode,
      runMidweekLive,
      runMidweekTest,
      runSatLive,
      runSatTest,
      runSunLive,
      runSunTest,
      satActive.length,
      satDate,
      satHasRun,
      sunActive.length,
      sunDate,
      sunHasRun,
    ],
  );

  const needsMatchweekBuild =
    canSchedule &&
    canWrite &&
    buildDays.some((item) => item.enabled && !item.hasRun);

  const openBuildMatchweek = () => {
    if (!canSchedule || !canWrite) return;
    setBuildSelection(
      Object.fromEntries(buildDays.map((item) => [item.id, item.enabled])),
    );
    setBuildOpen(true);
  };

  const buildSelectedMatchweek = async () => {
    const selected = buildDays.filter(
      (item) => item.enabled && buildSelection[item.id],
    );
    if (!selected.length) {
      toast.error("Select at least one matchday");
      return;
    }

    const locked = selected.filter((item) => item.locked);
    if (locked.length) {
      toast.error("Unlock the schedule first", {
        description: `${locked.map((item) => item.label).join(", ")} ${locked.length === 1 ? "is" : "are"} locked in Operations.`,
      });
      return;
    }

    setBuildingMatchweek(true);
    try {
      for (const item of selected) {
        if (typeof item.run !== "function") continue;
        await Promise.resolve(item.run());
      }
      toast.success("Matchweek build complete", {
        description: `${selected.map((item) => item.label).join(", ")} sent to Operations for review.`,
      });
      setBuildOpen(false);
      setMatchdayScope(
        midweekEnabled ? MATCHDAY_SCOPES.MATCHWEEK : MATCHDAY_SCOPES.WEEKEND,
      );
      setMainPage("operations");
      setDayTab(
        advancedOperationsEnabled ? "centre" : selected[0]?.id || "saturday",
      );
      setNavigationTarget?.(null);
    } catch (error) {
      toast.error("Matchweek build failed", {
        description:
          error?.message || "Review the fixture sources and try again.",
      });
    } finally {
      setBuildingMatchweek(false);
    }
  };
  const weatherSelection = useMemo(() => {
    const candidates = [];
    const add = (label, date, fixtures) => {
      if (date) candidates.push({ label, date, fixtures });
    };

    if (matchdayScope === MATCHDAY_SCOPES.SATURDAY)
      add("Saturday", satDate, satActive);
    else if (matchdayScope === MATCHDAY_SCOPES.SUNDAY)
      add("Sunday", sunDate, sunActive);
    else if (matchdayScope === MATCHDAY_SCOPES.MIDWEEK)
      add("Midweek", midweekDate, midweekActive);
    else {
      if (matchdayScope === MATCHDAY_SCOPES.MATCHWEEK)
        add("Midweek", midweekDate, midweekActive);
      add("Saturday", satDate, satActive);
      add("Sunday", sunDate, sunActive);
    }

    const sorted = candidates.sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );
    const today = getUkTodayIso();
    return (
      sorted.find((candidate) => candidate.date >= today) ||
      sorted.at(-1) || {
        label: "Matchday",
        date: satDate || sunDate || midweekDate,
        fixtures: [],
      }
    );
  }, [
    matchdayScope,
    midweekActive,
    midweekDate,
    satActive,
    satDate,
    sunActive,
    sunDate,
  ]);
  const weatherDate = weatherSelection.date;
  const weatherFixtures = weatherSelection.fixtures;
  const weatherScopeLabel = weatherSelection.label;
  const liveWeather = useLiveWeather({
    club,
    date: weatherDate,
    fixtures: weatherFixtures,
  });
  const weatherIntelligence = useMemo(
    () =>
      calculateWeatherIntelligence({
        club,
        fixtures: weatherFixtures,
        dateLabel: `${weatherScopeLabel}${weatherDate ? ` · ${weatherDate}` : ""}`,
        forecastSource: liveWeather.data,
        connectionStatus: liveWeather.status,
        connectionError: liveWeather.error,
      }),
    [
      club,
      liveWeather.data,
      liveWeather.error,
      liveWeather.status,
      weatherDate,
      weatherFixtures,
      weatherScopeLabel,
    ],
  );

  const reviewItems = [
    !scheduleBuilt
      ? {
          key: "schedule",
          title: "Build schedule",
          detail:
            "Build the selected matchday schedule before final readiness checks.",
          area: "Fixtures",
          severity: "warning",
          onClick: () =>
            nav.goToFixtures({
              day: navigationDay,
              card: "actionBar",
              workspace: "fixtures",
              scrollToSection: true,
            }),
        }
      : null,
    fixtureIssues > 0
      ? {
          key: "fixtures",
          title: "Resolve fixture issues",
          detail: `${fixtureIssues} fixture ${fixtureIssues === 1 ? "issue needs" : "issues need"} attention.`,
          area: "Fixtures",
          severity: "danger",
          onClick: () => nav.goToFixtures({ day: navigationDay }),
        }
      : null,
    officialConflicts.length > 0
      ? {
          key: "official-clashes",
          title: "Resolve official clashes",
          detail: `${officialConflicts.length} overlapping official ${officialConflicts.length === 1 ? "assignment needs" : "assignments need"} attention.`,
          area: "Officials",
          severity: "danger",
          onClick: () => nav.goToOfficials({ day: navigationDay }),
        }
      : null,
    refereeStats.outstanding > 0
      ? {
          key: "officials",
          title: "Confirm officials",
          detail: `${refereeStats.outstanding} referee ${refereeStats.outstanding === 1 ? "confirmation is" : "confirmations are"} outstanding.`,
          area: "Officials",
          severity: "warning",
          onClick: () => nav.goToOfficials({ day: navigationDay }),
        }
      : null,
    parkingStats.overCapacity
      ? {
          key: "parking",
          title: "Review parking pressure",
          detail: `Parking peak is projected at ${parkingStats.pct}% of capacity.`,
          area: "Parking",
          severity: "danger",
          onClick: () => nav.goToParking({ day: navigationDay }),
        }
      : null,
    !communicationsReady
      ? {
          key: "communications",
          title: "Prepare coach messages",
          detail:
            "Coach communications can be generated after the schedule is built.",
          area: "Messages",
          severity: "muted",
          onClick: () => nav.goToCommunications({ day: navigationDay }),
        }
      : null,
  ].filter(Boolean);

  const blockerCount = reviewItems.filter(
    (item) => item.severity !== "muted",
  ).length;
  const missionState = getMissionState({
    scheduleBuilt,
    fixtureIssues,
    refereeOutstanding: refereeStats.outstanding,
    officialConflicts: officialConflicts.length,
    parkingOverCapacity: parkingStats.overCapacity,
    communicationsReady,
  });

  const workflowModel = buildMissionControlWorkflow({
    scope: matchdayScope,
    scheduleBuilt,
    totalFixtures,
    pitchCount: pitchCfg.length,
    closedPitchCount: closedPitches.length,
    refereeOutstanding: refereeStats.outstanding,
    officialConflicts: officialConflicts.length,
    parkingPercent: parkingStats.pct,
    parkingCapacity: parkingStats.carCap,
    parkingOverCapacity: parkingStats.overCapacity,
    communicationsReady,
    blockerCount,
  });

  const workflowActionMap = {
    [WORKFLOW_ACTIONS.FIXTURES]: () =>
      nav.goToFixtures({
        day: navigationDay,
        card: scheduleBuilt ? "schedule" : "actionBar",
        workspace: "fixtures",
        scrollToSection: true,
      }),
    [WORKFLOW_ACTIONS.GROUND]: () =>
      nav.goToResources({ day: navigationDay, card: "pitchClosures" }),
    [WORKFLOW_ACTIONS.OFFICIALS]: () =>
      nav.goToOfficials({ day: navigationDay }),
    [WORKFLOW_ACTIONS.PARKING]: () => nav.goToParking({ day: navigationDay }),
    [WORKFLOW_ACTIONS.COMMUNICATIONS]: () =>
      nav.goToCommunications({ day: navigationDay }),
    [WORKFLOW_ACTIONS.OPERATIONS]: () =>
      nav.goToOperations({ day: operationsLandingDay }),
    [WORKFLOW_ACTIONS.PUBLISH]: saveWeek,
  };

  const workflowSteps = workflowModel.steps.map((step) => ({
    ...step,
    onClick: workflowActionMap[step.action],
  }));
  const nextAction = {
    ...workflowModel.nextAction,
    onClick: workflowActionMap[workflowModel.nextAction?.action],
  };
  const completedSteps = workflowModel.completedSteps;

  const heroIssues = [
    !scheduleBuilt
      ? {
          key: "schedule",
          label: "Schedule build required",
          detail:
            "Build the selected matchdays before readiness checks can complete.",
          count: 1,
          severity: "warning",
        }
      : null,
    fixtureIssues > 0
      ? {
          key: "fixtures",
          label: `${fixtureIssues} fixture ${fixtureIssues === 1 ? "issue" : "issues"}`,
          detail:
            "Resolve pitch clashes or fixtures that still need assignment.",
          count: fixtureIssues,
          severity: "danger",
        }
      : null,
    officialConflicts.length > 0
      ? {
          key: "official-clashes",
          label: `${officialConflicts.length} official ${officialConflicts.length === 1 ? "clash" : "clashes"}`,
          detail: "One or more officials are assigned to overlapping fixtures.",
          count: officialConflicts.length,
          severity: "danger",
        }
      : null,
    refereeStats.outstanding > 0
      ? {
          key: "official-confirmations",
          label: `${refereeStats.outstanding} confirmation${refereeStats.outstanding === 1 ? "" : "s"} outstanding`,
          detail: "Official assignments still need confirmation.",
          count: refereeStats.outstanding,
          severity: "warning",
        }
      : null,
    parkingStats.overCapacity
      ? {
          key: "parking",
          label: `Parking forecast at ${parkingStats.pct}%`,
          detail: "Peak vehicle demand is above the configured venue capacity.",
          count: 1,
          severity: "danger",
        }
      : null,
  ].filter(Boolean);

  const heroIssueCount = heroIssues.reduce(
    (sum, item) => sum + Math.max(1, Number(item.count) || 1),
    0,
  );

  const heroNextAction = !canSchedule
    ? { title: "Review workspace plan" }
    : !canWrite
      ? { title: "Workspace is read only" }
      : needsMatchweekBuild
        ? { title: "Build Matchweek" }
        : nextAction?.action === WORKFLOW_ACTIONS.OFFICIALS &&
            officialConflicts.length
          ? {
              ...nextAction,
              title: `Review ${officialConflicts.length} official ${officialConflicts.length === 1 ? "clash" : "clashes"}`,
            }
          : nextAction?.action === WORKFLOW_ACTIONS.OFFICIALS &&
              refereeStats.outstanding
            ? {
                ...nextAction,
                title: `Review ${refereeStats.outstanding} official ${refereeStats.outstanding === 1 ? "issue" : "issues"}`,
              }
            : nextAction;

  const heroWeather = {
    available: weatherIntelligence.forecastAvailable,
    status: weatherIntelligence.status,
    label: weatherIntelligence.label,
    scopeLabel: weatherScopeLabel,
    date: weatherDate,
    headline: weatherIntelligence.decision?.headline,
    conditions: weatherIntelligence.forecast?.conditions,
    temperature: weatherIntelligence.forecast?.temperature,
    rain: weatherIntelligence.forecast?.rain,
    wind: weatherIntelligence.forecast?.wind,
    detail: weatherIntelligence.decision?.detail,
  };

  const commandMenu = (
    <div className="relative" ref={actionsRef}>
      <button
        type="button"
        onClick={() => setActionsOpen((open) => !open)}
        className="inline-flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-slate-900 active:scale-[0.98]"
        aria-expanded={actionsOpen}
        aria-haspopup="menu"
      >
        <Sparkles size={18} className="text-emerald-300" strokeWidth={2.5} />
        Command Menu
        <ChevronDown
          size={17}
          className={`text-slate-300 transition ${actionsOpen ? "rotate-180" : ""}`}
        />
      </button>

      {actionsOpen ? (
        <div
          className="absolute right-0 top-full z-40 mt-3 w-[330px] overflow-hidden rounded-[24px] border border-slate-200 bg-white text-slate-950 shadow-2xl ring-1 ring-slate-100"
          role="menu"
        >
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700">
              Command Menu
            </div>
            <div className="mt-1 text-sm font-bold text-slate-500">
              Quick access to common club operations.
            </div>
          </div>

          <div className="p-2">
            {canSchedule && canWrite ? (
              <CommandMenuItem
                icon={Sparkles}
                title={scheduleBuilt ? "Rebuild Matchweek" : "Build Matchweek"}
                subtitle="Generate the selected matchday schedules"
                onClick={() => {
                  setActionsOpen(false);
                  openBuildMatchweek();
                }}
              />
            ) : null}
            {scheduleBuilt && canWrite ? (
              <CommandMenuItem
                icon={Save}
                title="Save Matchweek"
                subtitle="Store the current plan in matchweek history"
                onClick={() => {
                  setActionsOpen(false);
                  saveWeek?.();
                }}
              />
            ) : null}
            <CommandMenuItem
              icon={CalendarDays}
              title="Open Operations"
              subtitle="Review fixtures, resources and matchday actions"
              onClick={() => {
                setActionsOpen(false);
                nav.goToOperations({ day: operationsLandingDay });
              }}
            />
            <CommandMenuItem
              icon={FileText}
              title={canExport ? "Open Reports & Exports" : "Open Reports"}
              subtitle="Print the operational plan and available reports"
              onClick={() => {
                setActionsOpen(false);
                nav.goToReports();
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <PageContainer>
      <DashboardMissionHero
        club={club}
        missionState={missionState}
        totalFixtures={totalFixtures}
        satCount={satHasRun ? satActive.length : 0}
        sunCount={sunHasRun ? sunActive.length : 0}
        midweekCount={midweekHasRun ? midweekActive.length : 0}
        midweekEnabled={midweekEnabled}
        completedSteps={completedSteps}
        totalSteps={workflowSteps.length}
        nextAction={heroNextAction}
        issueItems={heroIssues}
        issueCount={heroIssueCount}
        weather={heroWeather}
        scopeLabel={getMatchdayScopeLabel(matchdayScope)}
        onContinue={
          !canSchedule
            ? () => nav.goToSettings({ settingsTab: "subscription" })
            : !canWrite
              ? () => nav.goToOperations({ day: operationsLandingDay })
              : needsMatchweekBuild
                ? openBuildMatchweek
                : nextAction?.onClick ||
                  (() => nav.goToOperations({ day: operationsLandingDay }))
        }
        secondaryAction={{
          label: "Open Operations",
          onClick: () => {
            setMainPage("operations");
            setDayTab(operationsLandingDay);
            setNavigationTarget?.(null);
          },
        }}
      />

      <DashboardStatusStrip
        actionsMenu={commandMenu}
        scope={matchdayScope}
        onScopeChange={setMatchdayScope}
        midweekEnabled={midweekEnabled}
        items={[
          {
            label: "Ground",
            status: closedPitches.length ? "warning" : "success",
            detail: closedPitches.length
              ? `${closedPitches.length} closed`
              : "Open",
            onClick: () =>
              nav.goToResources({ day: navigationDay, card: "pitchClosures" }),
          },
          {
            label: "Fixtures",
            status:
              scheduleBuilt && fixtureIssues === 0 ? "success" : "warning",
            detail: scheduleBuilt
              ? `${totalFixtures} scheduled`
              : "Build needed",
            onClick: () =>
              nav.goToFixtures({
                day: navigationDay,
                card: scheduleBuilt ? "schedule" : "actionBar",
                workspace: "fixtures",
                scrollToSection: true,
              }),
          },
          {
            label: "Officials",
            status: officialConflicts.length
              ? "danger"
              : refereeStats.outstanding
                ? "warning"
                : "success",
            detail: officialConflicts.length
              ? `${officialConflicts.length} clash${officialConflicts.length === 1 ? "" : "es"}`
              : refereeStats.outstanding
                ? `${refereeStats.outstanding} required`
                : "Clear",
            onClick: () => nav.goToOfficials({ day: navigationDay }),
          },
          {
            label: "Parking",
            status: parkingStats.overCapacity ? "danger" : "success",
            detail: scheduleBuilt ? `${parkingStats.pct}% peak` : "Pending",
            onClick: () => nav.goToParking({ day: navigationDay }),
          },
        ]}
      />

      <div className="grid items-stretch gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <MatchweekSummaryCard
          scopeLabel={getMatchdayScopeLabel(matchdayScope)}
          satCount={satHasRun ? satActive.length : 0}
          sunCount={sunHasRun ? sunActive.length : 0}
          midweekCount={midweekHasRun ? midweekActive.length : 0}
          midweekEnabled={midweekEnabled}
          issueCount={heroIssueCount}
          scheduleBuilt={scheduleBuilt}
          historyCount={history.length}
          onOpenOperations={() =>
            nav.goToOperations({ day: operationsLandingDay })
          }
        />
        <RecentActivityCard history={history} />
      </div>

      <BuildMatchweekDialog
        open={buildOpen}
        mode={mode}
        days={buildDays}
        selection={buildSelection}
        building={buildingMatchweek}
        onSelectionChange={(id, checked) =>
          setBuildSelection((current) => ({ ...current, [id]: checked }))
        }
        onClose={() => !buildingMatchweek && setBuildOpen(false)}
        onBuild={buildSelectedMatchweek}
      />
    </PageContainer>
  );
}

function MatchweekSummaryCard({
  scopeLabel,
  satCount = 0,
  sunCount = 0,
  midweekCount = 0,
  midweekEnabled = true,
  issueCount = 0,
  scheduleBuilt = false,
  historyCount = 0,
  onOpenOperations,
}) {
  const days = [
    { label: "Saturday", count: satCount },
    { label: "Sunday", count: sunCount },
    ...(midweekEnabled ? [{ label: "Midweek", count: midweekCount }] : []),
  ];

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700">
            Matchweek snapshot
          </div>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {scopeLabel}
          </h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            A compact view of the current operational plan.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenOperations}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800"
        >
          Open Operations <ArrowRight size={17} />
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {days.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"
          >
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              {item.label}
            </div>
            <div className="mt-2 text-3xl font-black text-slate-950">
              {item.count}
            </div>
            <div className="mt-1 text-xs font-bold text-slate-500">
              active fixtures
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <SummaryMetric
          label="Schedule"
          value={scheduleBuilt ? "Built" : "Not built"}
          tone={scheduleBuilt ? "success" : "warning"}
        />
        <SummaryMetric
          label="Actions"
          value={issueCount ? `${issueCount} open` : "Clear"}
          tone={issueCount ? "warning" : "success"}
        />
        <SummaryMetric label="Saved matchweeks" value={String(historyCount)} />
      </div>
    </section>
  );
}

function SummaryMetric({ label, value, tone = "neutral" }) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : tone === "warning"
        ? "bg-amber-50 text-amber-900 ring-amber-200"
        : "bg-slate-50 text-slate-800 ring-slate-200";

  return (
    <div className={`rounded-2xl p-4 ring-1 ${toneClass}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">
        {label}
      </div>
      <div className="mt-2 text-lg font-black">{value}</div>
    </div>
  );
}

function BuildMatchweekDialog({
  open,
  mode,
  days = [],
  selection = {},
  building = false,
  onSelectionChange,
  onClose,
  onBuild,
}) {
  if (!open) return null;

  const selectedDays = days.filter(
    (item) => item.enabled && selection[item.id],
  );
  const replacesExisting = selectedDays.some((item) => item.hasRun);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close matchweek builder"
        onClick={onClose}
      />
      <section className="relative z-10 w-full max-w-2xl overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 bg-slate-950 px-6 py-6 text-white">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">
              Mission Control
            </div>
            <h2 className="mt-2 text-2xl font-black">Build the matchweek</h2>
            <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-300">
              Select every day that should be generated. Ground Control will
              build them in sequence and open Operations for review.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={building}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <X size={19} />
          </button>
        </div>

        <div className="space-y-3 p-6">
          {days.map((item) => (
            <label
              key={item.id}
              className={`flex items-start gap-4 rounded-2xl border p-4 transition ${item.enabled ? "cursor-pointer border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40" : "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"}`}
            >
              <input
                type="checkbox"
                checked={Boolean(selection[item.id] && item.enabled)}
                disabled={!item.enabled || building}
                onChange={(event) =>
                  onSelectionChange?.(item.id, event.target.checked)
                }
                className="mt-1 h-5 w-5 shrink-0 accent-emerald-600"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-black text-slate-950">
                    {item.label}
                  </span>
                  {item.locked ? (
                    <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-rose-700">
                      Locked
                    </span>
                  ) : null}
                  {item.hasRun ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-800">
                      Existing schedule
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-sm font-semibold text-slate-500">
                  {mode === "test"
                    ? "Uses the configured demonstration fixture set."
                    : item.date
                      ? `Fixture date ${item.date}.`
                      : "Set a fixture date in Operations before building."}
                  {item.hasRun
                    ? ` ${item.currentCount} active fixture${item.currentCount === 1 ? "" : "s"} currently recorded.`
                    : ""}
                </span>
              </span>
              {item.enabled && !item.locked ? (
                <CheckCircle2
                  size={20}
                  className="mt-0.5 shrink-0 text-emerald-600"
                />
              ) : (
                <AlertTriangle
                  size={20}
                  className="mt-0.5 shrink-0 text-amber-600"
                />
              )}
            </label>
          ))}

          {replacesExisting ? (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <AlertTriangle size={19} className="mt-0.5 shrink-0" />
              <p className="text-sm font-bold leading-6">
                Selected days with an existing unlocked schedule will be
                rebuilt. Locked days cannot be replaced.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={building}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onBuild}
            disabled={building || selectedDays.length === 0}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white shadow-lg shadow-emerald-950/10 transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {building ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Sparkles size={18} />
            )}
            {building
              ? "Building matchweek…"
              : replacesExisting
                ? "Rebuild selected days"
                : "Build selected days"}
          </button>
        </div>
      </section>
    </div>
  );
}

function CommandMenuItem({ icon: Icon, title, subtitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-emerald-50"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 transition group-hover:bg-white">
          <Icon size={19} strokeWidth={2.4} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-black text-slate-950">
            {title}
          </span>
          <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">
            {subtitle}
          </span>
        </span>
      </span>
      <ArrowRight
        className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-700"
        size={17}
      />
    </button>
  );
}

function getUkTodayIso() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}
