import React, { useState } from "react";
import PageContainer from "../components/ui/PageContainer.jsx";
import Card from "../components/ui/Card.jsx";
import StatCard from "../components/ui/StatCard.jsx";
import StatusChip from "../components/ui/StatusChip.jsx";
import QuickActionCard from "../components/ui/QuickActionCard.jsx";
import GroundReadinessCard from "../components/dashboard/GroundReadinessCard.jsx";
import WeekendTimelineCard from "../components/dashboard/WeekendTimelineCard.jsx";
import DashboardHero from "../components/dashboard/DashboardHero.jsx";
import RecentActivityCard from "../components/dashboard/RecentActivityCard.jsx";
import FixtureDrawer from "../components/Operations/shared/FixtureDrawer.jsx";
import { getRefereeStats, getParkingStats } from "../lib/dashboardStats.js";
import { calculateWeatherIntelligence } from "../lib/engines/weatherIntelligenceEngine.js";

import {
  CalendarDays,
  CircleCheckBig,
  Car,
  UserCheck,
  MessageSquareText,
  ChartNoAxesCombined,
  FileText,
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

  const satActive = satFinal.filter((game) => game.status !== "postponed");
  const sunActive = sunFinal.filter((game) => game.status !== "postponed");

  const totalFixtures =
    (satHasRun ? satActive.length : 0) + (sunHasRun ? sunActive.length : 0);

  const refereeStats = getRefereeStats({
  satFinal,
  sunFinal,
  satHasRun,
  sunHasRun,
});

  const parkingStats = getParkingStats({ peakCars, carCap });

  const weather = calculateWeatherIntelligence({
    club,
    fixtures: [...satActive, ...sunActive],
    dateLabel: "This weekend",
  });

  const alerts = [
    ...satConflicts.map(() => ({
      title: "Saturday pitch clash detected",
      status: "High priority",
      variant: "danger",
    })),
    ...satUnresolved.map(() => ({
      title: "Saturday fixture needs assignment",
      status: "Needs review",
      variant: "warning",
    })),
    ...sunUnresolved.map(() => ({
      title: "Sunday fixture needs assignment",
      status: "Needs review",
      variant: "warning",
    })),
    ...(refereeStats.outstanding > 0
  ? [
      {
        title: `${refereeStats.outstanding} referee confirmation${
          refereeStats.outstanding > 1 ? "s" : ""
             } outstanding`,
            status: "Officials",
            variant: "warning",
          },
        ]
      : []),
  ];

  return (
    <PageContainer>
      <DashboardHero
        readiness={readiness}
        totalFixtures={totalFixtures}
        peakCars={peakCars}
        carCap={carCap}
        refWarnings={refereeStats.outstanding}
        saveWeek={saveWeek}
        weather={weather}
      />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Fixtures"
          value={totalFixtures}
          subtitle="This weekend"
          icon={CalendarDays}
          onClick={() => {
            setMainPage("operations");
            setDayTab("saturday");
          }}
        />

        <StatCard
          title="Alerts"
          value={alerts.length}
          subtitle={alerts.length === 0 ? "No urgent issues" : "Need attention"}
          icon={CircleCheckBig}
          accent={alerts.length === 0 ? "emerald" : "amber"}
          onClick={() => {
            setMainPage("operations");
            setDayTab("saturday");
          }}
        />

        <StatCard
          title="Parking Peak"
          value={`${parkingStats.pct}%`}
          subtitle={`${parkingStats.peakCars}/${parkingStats.carCap} spaces`}
          icon={Car}
          accent={parkingStats.overCapacity ? "red" : parkingStats.pct >= 85 ? "amber" : "blue"}
          onClick={() => setMainPage("analytics")}
        />

        <StatCard
          title="Referees"
          value={`${refereeStats.confirmed}/${refereeStats.total}`}
          subtitle={
            refereeStats.outstanding === 0
              ? "All confirmed"
              : `${refereeStats.outstanding} need confirmation`
          }
          icon={UserCheck}
          accent={refereeStats.outstanding === 0 ? "emerald" : "amber"}
          onClick={() => {
            setMainPage("operations");
            setDayTab("saturday");
          }}
        />
      </div>

      <div className="grid items-stretch gap-6 xl:grid-cols-2">
        <GroundReadinessCard
          readiness={readiness}
          alerts={alerts}
          totalFixtures={totalFixtures}
          peakCars={peakCars}
          carCap={carCap}
          refWarnings={refereeStats.outstanding}
        />

        <Card
          eyebrow="Actions"
          title="Today’s Priorities"
          subtitle="Items that need attention before publishing."
        >
          <div className="space-y-4">
            {alerts.length === 0 ? (
              <ActionItem
                title="No urgent issues detected"
                status="Ready"
                variant="success"
              />
            ) : (
              alerts.slice(0, 5).map((alert, index) => (
                <ActionItem
                  key={`${alert.title}-${index}`}
                  title={alert.title}
                  status={alert.status}
                  variant={alert.variant}
                />
              ))
            )}
          </div>

          <div className="mt-6 grid gap-3">
            <QuickActionCard
              icon={CalendarDays}
              title="Open Operations"
              subtitle="Manage Saturday and Sunday schedules"
              onClick={() => {
                setMainPage("operations");
                setDayTab("saturday");
              }}
            />

            <QuickActionCard
              icon={MessageSquareText}
              title="Communications"
              subtitle="Coach messages and publish workflow"
              onClick={() => setMainPage("communications")}
            />

            <QuickActionCard
              icon={ChartNoAxesCombined}
              title="View Analytics"
              subtitle="Pitch usage, parking and trends"
              onClick={() => setMainPage("analytics")}
            />

            <QuickActionCard
              icon={FileText}
              title="Reports"
              subtitle="Matchday packs and exports"
              onClick={() => setMainPage("reports")}
            />
          </div>
        </Card>
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

      <RecentActivityCard history={history} />

      <FixtureDrawer
        fixture={selectedFixture}
        club={club}
        onClose={() => setSelectedFixture(null)}
      />
    </PageContainer>
  );
}

function ActionItem({ title, status, variant }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-black text-slate-800">
          {title}
        </div>
      </div>

      <StatusChip variant={variant}>{status}</StatusChip>
    </div>
  );
}