import React, { useEffect, useMemo, useRef, useState } from "react";
import PageContainer from "../components/ui/PageContainer.jsx";
import DashboardMissionHero from "../components/dashboard/DashboardMissionHero.jsx";
import DashboardStatusStrip from "../components/dashboard/DashboardStatusStrip.jsx";
import DashboardWorkflowCard from "../components/dashboard/DashboardWorkflowCard.jsx";
import DashboardWeatherCard from "../components/dashboard/DashboardWeatherCard.jsx";
import GroundStatusCard from "../components/dashboard/GroundStatusCard.jsx";
import WeekendTimelineCard from "../components/dashboard/WeekendTimelineCard.jsx";
import RecentActivityCard from "../components/dashboard/RecentActivityCard.jsx";
import ClubDigitalTwinCard from "../components/dashboard/ClubDigitalTwinCard.jsx";
import FixtureDrawer from "../components/Operations/shared/FixtureDrawer.jsx";
import { getRefereeStats, getParkingStats } from "../lib/dashboardStats.js";
import { buildClubDigitalTwin } from "../lib/engines/clubDigitalTwinEngine.js";

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
  const [selectedFixture, setSelectedFixture] = useState(null);
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

  const totalFixtures =
    (satHasRun ? satActive.length : 0) + (sunHasRun ? sunActive.length : 0);

  const scheduleBuilt = Boolean(satHasRun || sunHasRun);

  const refereeStats = getRefereeStats({
    satFinal,
    sunFinal,
    satHasRun,
    sunHasRun,
  });

  const parkingDayGroups = useMemo(
    () => [
      { key: "saturday", label: "Saturday", fixtures: satHasRun ? satActive : [] },
      { key: "sunday", label: "Sunday", fixtures: sunHasRun ? sunActive : [] },
    ],
    [satHasRun, sunHasRun, satActive, sunActive]
  );

  const parkingFixtures = parkingDayGroups.flatMap((group) => group.fixtures);

  const parkingStats = getParkingStats({
    fixturesByDay: parkingDayGroups,
    club,
    pitchCfg,
    peakCars,
    carCap,
  });

  const clubTwin = useMemo(
    () =>
      buildClubDigitalTwin({
        club,
        pitchCfg,
        closedPitches,
        satFinal,
        sunFinal,
        satHasRun,
        sunHasRun,
        fixturesByDay: parkingDayGroups,
        refWarnings,
      }),
    [club, pitchCfg, closedPitches, satFinal, sunFinal, satHasRun, sunHasRun, parkingDayGroups, refWarnings]
  );

  const fixtureIssues =
    satConflicts.length + satUnresolved.length + sunUnresolved.length;

  const communicationsReady = scheduleBuilt && totalFixtures > 0;
  const weatherLocation = getWeatherLocation(club);

  const reviewItems = [
    !scheduleBuilt
      ? {
          key: "schedule",
          title: "Build schedule",
          detail: "Create Saturday or Sunday schedules before final readiness checks.",
          area: "Fixtures",
          severity: "warning",
          onClick: () => openOperations(setMainPage, setDayTab),
        }
      : null,
    fixtureIssues > 0
      ? {
          key: "fixtures",
          title: "Resolve fixture issues",
          detail: `${fixtureIssues} fixture ${fixtureIssues === 1 ? "issue needs" : "issues need"} attention.`,
          area: "Fixtures",
          severity: "danger",
          onClick: () => openOperations(setMainPage, setDayTab),
        }
      : null,
    refereeStats.outstanding > 0
      ? {
          key: "officials",
          title: "Confirm officials",
          detail: `${refereeStats.outstanding} referee ${refereeStats.outstanding === 1 ? "confirmation is" : "confirmations are"} outstanding.`,
          area: "Officials",
          severity: "warning",
          onClick: () => openOperations(setMainPage, setDayTab),
        }
      : null,
    parkingStats.overCapacity
      ? {
          key: "parking",
          title: "Review parking pressure",
          detail: `${parkingStats.peakDayLabel || "Weekend"} parking peak is projected at ${parkingStats.pct}% of capacity.`,
          area: "Parking",
          severity: "danger",
          onClick: () => setMainPage("analytics"),
        }
      : null,
    !communicationsReady
      ? {
          key: "communications",
          title: "Prepare coach messages",
          detail: "Coach communications can be generated after the schedule is built.",
          area: "Messages",
          severity: "muted",
          onClick: () => setMainPage("communications"),
        }
      : null,
  ].filter(Boolean);

  const blockerCount = reviewItems.filter((item) => item.severity !== "muted").length;
  const missionState = getMissionState({
    scheduleBuilt,
    fixtureIssues,
    refereeStats,
    parkingStats,
    communicationsReady,
  });

  const workflowSteps = [
    {
      key: "fixtures",
      title: "Build schedule",
      detail: scheduleBuilt
        ? `${totalFixtures} fixture${totalFixtures === 1 ? "" : "s"} scheduled this weekend.`
        : "Build Saturday or Sunday before final readiness checks.",
      status: scheduleBuilt ? "complete" : "current",
      required: true,
      onClick: () => openOperations(setMainPage, setDayTab),
    },
    {
      key: "ground",
      title: "Review ground status",
      detail: closedPitches.length
        ? `${closedPitches.length} pitch ${closedPitches.length === 1 ? "closure is" : "closures are"} active.`
        : `${pitchCfg.length} pitches available and no closures active.`,
      status: closedPitches.length ? "warning" : "complete",
      required: true,
      onClick: () => openOperations(setMainPage, setDayTab),
    },
    {
      key: "officials",
      title: "Confirm officials",
      detail: refereeStats.outstanding
        ? `${refereeStats.outstanding} official ${refereeStats.outstanding === 1 ? "needs" : "need"} confirmation.`
        : "Officials look healthy for scheduled fixtures.",
      status: refereeStats.outstanding ? "warning" : "complete",
      required: true,
      onClick: () => openOperations(setMainPage, setDayTab),
    },
    {
      key: "parking",
      title: "Review parking pressure",
      detail: scheduleBuilt
        ? parkingStats.peakDayLabel
          ? `${parkingStats.pct}% weekend peak on ${parkingStats.peakDayLabel} against ${parkingStats.carCap} spaces.`
          : `${parkingStats.pct}% projected peak against ${parkingStats.carCap} spaces.`
        : "Parking forecast will update after schedule build.",
      status: !scheduleBuilt ? "pending" : parkingStats.overCapacity ? "warning" : "complete",
      onClick: () => setMainPage("analytics"),
    },
    {
      key: "messages",
      title: "Prepare coach messages",
      detail: communicationsReady
        ? "Coach messages are ready for review and copy-out."
        : "Coach messages are waiting for the built schedule.",
      status: communicationsReady ? "complete" : "pending",
      required: true,
      onClick: () => setMainPage("communications"),
    },
    {
      key: "publish",
      title: "Publish weekend",
      detail: blockerCount
        ? "Resolve review items before publishing."
        : "Weekend is ready to publish.",
      status: blockerCount ? "pending" : "complete",
      required: true,
      onClick: blockerCount ? () => openOperations(setMainPage, setDayTab) : saveWeek,
    },
  ];

  const nextAction = workflowSteps.find((step) => step.status !== "complete") || workflowSteps[workflowSteps.length - 1];
  const completedSteps = workflowSteps.filter((step) => step.status === "complete").length;

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
                openOperations(setMainPage, setDayTab);
              }}
            />
            <CommandMenuItem
              icon={MessageSquareText}
              title="Communications"
              subtitle="Coach messages and publishing"
              onClick={() => {
                setActionsOpen(false);
                setMainPage("communications");
              }}
            />
            <CommandMenuItem
              icon={ChartNoAxesCombined}
              title="Analytics"
              subtitle="Usage, trends and pressure points"
              onClick={() => {
                setActionsOpen(false);
                setMainPage("analytics");
              }}
            />
            <CommandMenuItem
              icon={FileText}
              title="Reports"
              subtitle="Prints, exports and saved packs"
              onClick={() => {
                setActionsOpen(false);
                setMainPage("reports");
              }}
            />
            <CommandMenuItem
              icon={Settings}
              title="Settings Centre"
              subtitle="Club, venue and integration setup"
              onClick={() => {
                setActionsOpen(false);
                setMainPage("settings");
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
        onContinue={nextAction?.onClick || (() => openOperations(setMainPage, setDayTab))}
/>

      <DashboardStatusStrip
        actionsMenu={commandMenu}
        items={[
          {
            label: "Ground",
            status: closedPitches.length ? "warning" : "success",
            detail: closedPitches.length ? `${closedPitches.length} closed` : "Open",
            onClick: () => openOperations(setMainPage, setDayTab),
          },
          {
            label: "Fixtures",
            status: scheduleBuilt && fixtureIssues === 0 ? "success" : "warning",
            detail: scheduleBuilt ? `${totalFixtures} scheduled` : "Build needed",
            onClick: () => openOperations(setMainPage, setDayTab),
          },
          {
            label: "Officials",
            status: refereeStats.outstanding ? "warning" : "success",
            detail: refereeStats.outstanding ? `${refereeStats.outstanding} required` : "Clear",
            onClick: () => openOperations(setMainPage, setDayTab),
          },
          {
            label: "Parking",
            status: parkingStats.overCapacity ? "danger" : parkingStats.isHighPressure ? "warning" : "success",
            detail: scheduleBuilt
              ? parkingStats.peakDayLabel
                ? `${parkingStats.peakDayLabel} ${parkingStats.pct}%`
                : `${parkingStats.pct}% peak`
              : "Pending",
            onClick: () => setMainPage("analytics"),
          },
          {
            label: "Weather",
            status: weatherLocation ? "success" : "warning",
            detail: weatherLocation || "Set postcode",
            onClick: () => setMainPage("settings"),
          },
          {
            label: "Messages",
            status: communicationsReady ? "success" : "muted",
            detail: communicationsReady ? "Ready" : "Waiting",
            onClick: () => setMainPage("communications"),
          },
        ]}
      />

      <ClubDigitalTwinCard
        twin={clubTwin}
        onOpenOperations={() => openOperations(setMainPage, setDayTab)}
        onOpenSettings={() => setMainPage("settings")}
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

          setSelectedFixture({
            ...fixture,
            __day: isSunday ? "sunday" : "saturday",
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

function openOperations(setMainPage, setDayTab) {
  setMainPage("operations");
  setDayTab("saturday");
}

function getMissionState({
  scheduleBuilt,
  fixtureIssues,
  refereeStats,
  parkingStats,
  communicationsReady,
}) {
  if (!scheduleBuilt) {
    return {
      tone: "warning",
      label: "Review Required",
      title: "Build schedule",
      detail: "Your weekend is close, but the schedule needs building before final readiness checks.",
    };
  }

  if (fixtureIssues > 0 || parkingStats.overCapacity || refereeStats.outstanding > 0) {
    return {
      tone: "warning",
      label: "Action Required",
      title: "Review weekend",
      detail: "Ground Control has found items to check before publishing.",
    };
  }

  if (!communicationsReady) {
    return {
      tone: "warning",
      label: "Almost Ready",
      title: "Prepare messages",
      detail: "Your operations are ready. Prepare communications before publishing.",
    };
  }

  return {
    tone: "success",
    label: "Weekend Ready",
    title: "Ready to publish",
    detail: "Fixtures, ground status, officials, parking and communications are ready.",
  };
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
