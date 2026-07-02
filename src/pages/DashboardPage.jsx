import React, { useEffect, useRef, useState } from "react";
import PageContainer from "../components/ui/PageContainer.jsx";
import DashboardMissionHero from "../components/dashboard/DashboardMissionHero.jsx";
import DashboardStatusStrip from "../components/dashboard/DashboardStatusStrip.jsx";
import DashboardInsightGrid from "../components/dashboard/DashboardInsightGrid.jsx";
import DashboardWorkflowCard from "../components/dashboard/DashboardWorkflowCard.jsx";
import DashboardWeatherCard from "../components/dashboard/DashboardWeatherCard.jsx";
import GroundStatusCard from "../components/dashboard/GroundStatusCard.jsx";
import WeekendTimelineCard from "../components/dashboard/WeekendTimelineCard.jsx";
import RecentActivityCard from "../components/dashboard/RecentActivityCard.jsx";
import FixtureDrawer from "../components/Operations/shared/FixtureDrawer.jsx";
import { getRefereeStats, getParkingStats } from "../lib/dashboardStats.js";
import { buildMissionControlWorkflow, getMissionState, WORKFLOW_ACTIONS } from "../lib/engines/workflowEngine.js";
import { createNavigationController } from "../lib/navigation/index.js";
import { useMatchdayScope } from "../lib/context/MatchdayScopeContext.jsx";
import { getDayTabFromScope, getMatchdayScopeLabel, getScopedMatchdayData, MATCHDAY_SCOPES, normaliseMatchdayScope } from "../lib/domain/matchdayScope.js";

import {
  CalendarDays,
  ChevronDown,
  MessageSquareText,
  ChartNoAxesCombined,
  FileText,
  Settings,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export default function DashboardPage({
  setMainPage,
  setDayTab,
  setNavigationTarget,
  matchdayScope: matchdayScopeProp,
  setMatchdayScope: setMatchdayScopeProp,
  saveWeek,
  club,
  history = [],
  pitchCfg = [],
  satFinal = [],
  sunFinal = [],
  satHasRun,
  sunHasRun,
  readiness,
  refWarnings = 0,
  peakCars = 0,
  carCap = 57,
  satConflicts = [],
  satUnresolved = [],
  sunUnresolved = [],
  closedPitches = [],
}) {
  const matchdayScopeContext = useMatchdayScope();
  const matchdayScope = normaliseMatchdayScope(matchdayScopeProp || matchdayScopeContext.scope);
  const setMatchdayScope = setMatchdayScopeProp || matchdayScopeContext.setScope;
  const navigationDay = getDayTabFromScope(matchdayScope);
  const [selectedFixture, setSelectedFixture] = useState(null);
  const nav = createNavigationController({ setMainPage, setDayTab, setNavigationTarget });
  const [actionsOpen, setActionsOpen] = useState(false);
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

  const satActive = satFinal.filter((game) => game.status !== "postponed");
  const sunActive = sunFinal.filter((game) => game.status !== "postponed");

  const scopedMatchday = getScopedMatchdayData({
    scope: matchdayScope,
    satFinal,
    sunFinal,
    satHasRun,
    sunHasRun,
  });

  const totalFixtures = scopedMatchday.activeFixtures.length;
  const scheduleBuilt = scopedMatchday.scheduleBuilt;

  const refereeStats = getRefereeStats({
    satFinal: scopedMatchday.satFinal,
    sunFinal: scopedMatchday.sunFinal,
    satHasRun: scopedMatchday.satHasRun,
    sunHasRun: scopedMatchday.sunHasRun,
  });

  const parkingStats = getParkingStats({
    fixtures: scopedMatchday.activeFixtures,
    club,
    pitchCfg,
    peakCars,
    carCap,
    scope: matchdayScope,
  });

  const fixtureIssues =
    (scopedMatchday.includeSaturday ? satConflicts.length + satUnresolved.length : 0) +
    (scopedMatchday.includeSunday ? sunUnresolved.length : 0);

  const communicationsReady = scheduleBuilt && totalFixtures > 0;
  const weatherLocation = getWeatherLocation(club);

  const reviewItems = [
    !scheduleBuilt
      ? {
          key: "schedule",
          title: "Build schedule",
          detail: "Build the selected matchday schedule before final readiness checks.",
          area: "Fixtures",
          severity: "warning",
          onClick: () => nav.goToFixtures({ day: navigationDay, card: "actionBar", workspace: "fixtures" }),
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
          detail: "Coach communications can be generated after the schedule is built.",
          area: "Messages",
          severity: "muted",
          onClick: () => nav.goToCommunications(),
        }
      : null,
  ].filter(Boolean);

  const blockerCount = reviewItems.filter((item) => item.severity !== "muted").length;
  const missionState = getMissionState({
    scheduleBuilt,
    fixtureIssues,
    refereeOutstanding: refereeStats.outstanding,
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
    parkingPercent: parkingStats.pct,
    parkingCapacity: parkingStats.carCap,
    parkingOverCapacity: parkingStats.overCapacity,
    communicationsReady,
    blockerCount,
  });

  const workflowActionMap = {
    [WORKFLOW_ACTIONS.FIXTURES]: () => nav.goToFixtures({ day: navigationDay, card: "actionBar", workspace: "fixtures" }),
    [WORKFLOW_ACTIONS.GROUND]: () => nav.goToResources({ day: navigationDay, card: "pitchClosures" }),
    [WORKFLOW_ACTIONS.OFFICIALS]: () => nav.goToOfficials({ day: navigationDay }),
    [WORKFLOW_ACTIONS.PARKING]: () => nav.goToParking({ day: navigationDay }),
    [WORKFLOW_ACTIONS.COMMUNICATIONS]: () => nav.goToCommunications(),
    [WORKFLOW_ACTIONS.OPERATIONS]: () => nav.goToOperations({ day: navigationDay }),
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
            <CommandMenuItem
              icon={CalendarDays}
              title="Open Operations"
              subtitle="Fixtures, resources and matchday control"
              onClick={() => {
                setActionsOpen(false);
                nav.goToOperations({ day: navigationDay });
              }}
            />
            <CommandMenuItem
              icon={MessageSquareText}
              title="Communications"
              subtitle="Coach messages and publishing"
              onClick={() => {
                setActionsOpen(false);
                nav.goToCommunications();
              }}
            />
            <CommandMenuItem
              icon={ChartNoAxesCombined}
              title="Analytics"
              subtitle="Usage, trends and pressure points"
              onClick={() => {
                setActionsOpen(false);
                nav.goToAnalytics();
              }}
            />
            <CommandMenuItem
              icon={FileText}
              title="Reports"
              subtitle="Prints, exports and saved packs"
              onClick={() => {
                setActionsOpen(false);
                nav.goToReports();
              }}
            />
            <CommandMenuItem
              icon={Settings}
              title="Settings Centre"
              subtitle="Club, venue and integration setup"
              onClick={() => {
                setActionsOpen(false);
                nav.goToSettings();
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
        completedSteps={completedSteps}
        totalSteps={workflowSteps.length}
        nextAction={nextAction}
        weatherLocation={weatherLocation}
        scopeLabel={getMatchdayScopeLabel(matchdayScope)}
        onContinue={nextAction?.onClick || (() => nav.goToOperations({ day: navigationDay }))}
/>

      <DashboardStatusStrip
        actionsMenu={commandMenu}
        scope={matchdayScope}
        onScopeChange={setMatchdayScope}
        items={[
          {
            label: "Ground",
            status: closedPitches.length ? "warning" : "success",
            detail: closedPitches.length ? `${closedPitches.length} closed` : "Open",
            onClick: () => nav.goToResources({ day: navigationDay, card: "pitchClosures" }),
          },
          {
            label: "Fixtures",
            status: scheduleBuilt && fixtureIssues === 0 ? "success" : "warning",
            detail: scheduleBuilt ? `${totalFixtures} scheduled` : "Build needed",
            onClick: () => nav.goToFixtures({ day: navigationDay }),
          },
          {
            label: "Officials",
            status: refereeStats.outstanding ? "warning" : "success",
            detail: refereeStats.outstanding ? `${refereeStats.outstanding} required` : "Clear",
            onClick: () => nav.goToOfficials({ day: navigationDay }),
          },
          {
            label: "Parking",
            status: parkingStats.overCapacity ? "danger" : "success",
            detail: scheduleBuilt ? `${parkingStats.pct}% peak` : "Pending",
            onClick: () => nav.goToParking({ day: navigationDay }),
          },
          {
            label: "Weather",
            status: weatherLocation ? "success" : "warning",
            detail: weatherLocation || "Set postcode",
            onClick: () => nav.goToWeather({ day: navigationDay }),
          },
          {
            label: "Messages",
            status: communicationsReady ? "success" : "muted",
            detail: communicationsReady ? "Ready" : "Waiting",
            onClick: () => nav.goToCommunications(),
          },
        ]}
      />

      <DashboardInsightGrid
        totalFixtures={totalFixtures}
        pitchCount={pitchCfg.length}
        closedPitchCount={closedPitches.length}
        scheduleBuilt={scheduleBuilt}
        fixtureIssues={fixtureIssues}
        refereeOutstanding={refereeStats.outstanding}
        parkingStats={parkingStats}
        communicationsReady={communicationsReady}
      />

      <div className="grid items-stretch gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="flex min-w-0 flex-col gap-6">
          <DashboardWorkflowCard
            steps={workflowSteps}
            nextAction={nextAction}
            completedSteps={completedSteps}
            totalSteps={workflowSteps.length}
          />

          <RecentActivityCard history={history} />
        </div>

        <div className="grid h-full min-h-0 gap-6 xl:grid-rows-2">
          <GroundStatusCard
            pitchCfg={pitchCfg}
            closedPitches={closedPitches}
            parkingStats={parkingStats}
            setMainPage={setMainPage}
            setDayTab={setDayTab}
          />

          <DashboardWeatherCard
            club={club}
            weatherLocation={weatherLocation}
            setMainPage={setMainPage}
          />
        </div>
      </div>


      <WeekendTimelineCard
        satFinal={satFinal}
        sunFinal={sunFinal}
        satHasRun={satHasRun}
        sunHasRun={sunHasRun}
        pitchCfg={pitchCfg}
        club={club}
        onFixtureClick={(fixture) => {
          const isSunday = sunFinal.includes(fixture);
          const fixtureDay = isSunday ? MATCHDAY_SCOPES.SUNDAY : MATCHDAY_SCOPES.SATURDAY;
          setMatchdayScope(fixtureDay);

          setSelectedFixture({
            ...fixture,
            __day: fixtureDay,
          });
        }}
      />

      <FixtureDrawer
        fixture={selectedFixture}
        club={club}
        onClose={() => setSelectedFixture(null)}
      />
    </PageContainer>
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
          <span className="block truncate text-sm font-black text-slate-950">{title}</span>
          <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">{subtitle}</span>
        </span>
      </span>
      <ArrowRight className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-700" size={17} />
    </button>
  );
}


function getWeatherLocation(club) {
  return (
    club?.weatherPostcode ||
    club?.groundPostcode ||
    club?.postcode ||
    club?.venuePostcode ||
    club?.sites?.find((site) => site?.isPrimary)?.postcode ||
    club?.sites?.[0]?.postcode ||
    ""
  );
}
