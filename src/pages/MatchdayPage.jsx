import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Car,
  ChevronRight,
  CloudSun,
  ClipboardList,
  Filter,
  Layers3,
  Mail,
  MapPinned,
  Megaphone,
  MessageSquareText,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
} from "lucide-react";
import FixtureDrawer from "../components/Operations/shared/FixtureDrawer.jsx";
import MatchdayTimelineCard from "../components/Operations/shared/MatchdayTimelineCard.jsx";
import PitchClosuresCard from "../components/Operations/shared/PitchClosuresCard.jsx";
import MatchdayPitchAssignmentsCard from "../components/Operations/shared/MatchdayPitchAssignmentsCard.jsx";
import MatchdayCarParkCard from "../components/Operations/shared/MatchdayCarParkCard.jsx";
import MatchdayCoachMessagesCard from "../components/Operations/shared/MatchdayCoachMessagesCard.jsx";
import MatchdayActionBar from "../components/Operations/shared/MatchdayActionBar.jsx";
import MatchdayManualFixtures from "../components/Operations/shared/MatchdayManualFixtures.jsx";
import MatchdaySummaryBar from "../components/Operations/shared/MatchdaySummaryBar.jsx";
import MatchdayUnresolvedCard from "../components/Operations/shared/MatchdayUnresolvedCard.jsx";
import MatchdayScheduleCard from "../components/Operations/shared/MatchdayScheduleCard.jsx";
import OperationsHealthCard from "../components/Operations/shared/OperationsHealthCard.jsx";
import CompetitionRulesCard from "../components/Operations/shared/CompetitionRulesCard.jsx";
import DayOptimiserCard from "../components/Operations/shared/DayOptimiserCard.jsx";
import WeatherIntelligenceCard from "../components/Operations/shared/WeatherIntelligenceCard.jsx";
import RecommendationCentreCard from "../components/Operations/shared/RecommendationCentreCard.jsx";
import CollapsibleCard from "../components/ui/CollapsibleCard.jsx";
import StatusChip from "../components/ui/StatusChip.jsx";
import { calculateOperationsHealth } from "../lib/engines/operationsHealthEngine.js";
import { calculateCompetitionRules } from "../lib/engines/competitionRulesEngine.js";
import { calculateDayOptimisation } from "../lib/engines/dayOptimiserEngine.js";
import { calculateWeatherIntelligence } from "../lib/engines/weatherIntelligenceEngine.js";
import { buildRecommendationCentre } from "../lib/engines/recommendationCentreEngine.js";
import { findOfficialConflicts } from "../lib/engines/officialsEngine.js";
import { analyseParkingPressure } from "../lib/intelligence/parking/parkingService.js";

const WORKSPACES = [
  {
    id: "fixtures",
    label: "Fixtures",
    icon: CalendarDays,
    description: "Build, review and manage matchday fixtures.",
  },
  {
    id: "resources",
    label: "Resources",
    icon: MapPinned,
    description: "Control pitches, closures and physical capacity.",
  },
  {
    id: "intelligence",
    label: "Intelligence",
    icon: Sparkles,
    description: "Review risks, parking pressure and operational insight.",
  },
  {
    id: "communications",
    label: "Communications",
    icon: Megaphone,
    description: "Prepare coach messages and publish matchday updates.",
  },
];

const FILTERS = [
  { id: "all", label: "All" },
  { id: "issues", label: "Issues" },
  { id: "warnings", label: "Warnings" },
  { id: "ready", label: "Ready" },
];

function getFixtureLabel(fixture = {}) {
  return [
    fixture.homeTeam,
    fixture.awayTeam,
    fixture.team,
    fixture.league,
    fixture.pitch,
    fixture.pitchId,
    fixture.referee,
    fixture.ko,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getSectionStatus({ danger = false, warning = false, ready = true } = {}) {
  if (danger) return { status: "danger", label: "Needs action", filter: "issues" };
  if (warning) return { status: "warning", label: "Review", filter: "warnings" };
  if (ready) return { status: "success", label: "Ready", filter: "ready" };
  return { status: "neutral", label: "Pending", filter: "all" };
}

function normaliseCapacity(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getParkingCapacityValue(club = {}) {
  return normaliseCapacity(club.carParkSpaces || club.parkingSpaces || club.capacity);
}

function getParkingCapacitySummary(games = [], club = {}, pitchCfg = []) {
  const capacity = getParkingCapacityValue(club);
  const analysis = analyseParkingPressure({
    fixtures: games,
    club: { ...club, carParkSpaces: capacity || club.carParkSpaces },
    pitchCfg,
  });

  const peak = analysis?.peakSlot || null;
  const estimatedLoad = peak?.estimatedCars || 0;
  const utilisation = capacity ? Math.round((estimatedLoad / capacity) * 100) : 0;

  return {
    capacity,
    analysis,
    peak,
    estimatedLoad,
    utilisation,
  };
}

function estimateParkingLoad(games = [], club = {}, pitchCfg = []) {
  return getParkingCapacitySummary(games, club, pitchCfg).estimatedLoad;
}

function ParkingCapacityCard({ active = [], club = {}, pitchCfg = [] }) {
  const { capacity, peak, estimatedLoad, utilisation } = getParkingCapacitySummary(active, club, pitchCfg);
  const concurrentLimit = Number(club.maxConcurrent || 0);
  const variant = utilisation >= 100 ? "danger" : utilisation >= 85 ? "warning" : "success";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
            Parking Capacity
          </div>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {capacity || "Not set"} spaces
          </h3>
          <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-slate-500">
            Resource view only. Detailed pressure, peaks and fixture-move recommendations are kept in Intelligence.
          </p>
        </div>
        <StatusChip variant={variant}>{capacity ? `${utilisation}% peak` : "Set capacity"}</StatusChip>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Peak cars</div>
          <div className="mt-2 text-3xl font-black text-slate-950">{estimatedLoad}</div>
          <div className="mt-1 text-xs font-bold text-slate-500">{peak?.label ? `at ${peak.label}` : "After schedule build"}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Active fixtures</div>
          <div className="mt-2 text-3xl font-black text-slate-950">{active.length}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Concurrent limit</div>
          <div className="mt-2 text-3xl font-black text-slate-950">{concurrentLimit || "—"}</div>
        </div>
      </div>
    </div>
  );
}

function EmptyWorkspace({ query, filter }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <Search size={22} strokeWidth={2.5} />
      </div>
      <h3 className="mt-4 text-lg font-black text-slate-950">No sections match</h3>
      <p className="mt-2 text-sm font-bold text-slate-500">
        {query ? `Nothing matched “${query}”.` : `No sections match the ${filter} filter.`}
      </p>
    </div>
  );
}

function WorkspaceTab({ workspace, active, count, onClick }) {
  const Icon = workspace.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-h-[74px] items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left transition ${
        active
          ? "bg-slate-950 text-white shadow-md"
          : "bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-white hover:text-slate-950 hover:shadow-sm"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${active ? "bg-white/10 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>
          <Icon size={20} strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <div className={`text-[11px] font-black uppercase tracking-[0.2em] ${active ? "text-emerald-300" : "text-slate-400"}`}>
            Workspace
          </div>
          <div className="mt-1 truncate text-base font-black">{workspace.label}</div>
        </div>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${active ? "bg-white/15 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>
        {count}
      </span>
    </button>
  );
}

export default function MatchdayPage({
  day,
  props,
  hasRun,
  final = [],
  overrides = {},
  dateLabel,
  onOverride,
  ManualFixtures = MatchdayManualFixtures,
  SummaryBar = MatchdaySummaryBar,
  UnresolvedCard = MatchdayUnresolvedCard,
  ScheduleCard = MatchdayScheduleCard,
  navigationTarget = null,
  clearNavigationTarget,
}) {
  const [selectedFixtureIndex, setSelectedFixtureIndex] = useState(null);
  const [activeWorkspace, setActiveWorkspace] = useState("fixtures");
  const [sectionQuery, setSectionQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [openSections, setOpenSections] = useState({});
  const [highlightedSection, setHighlightedSection] = useState(null);
  const targetAppliedRef = useRef(null);

  const isSunday = day === "Sunday";

  const clubWithTiming = useMemo(() => ({
    ...(props.club || {}),
    startHour: props.startHour,
    startMin: props.startMin,
    endHour: props.endHour,
    endMin: props.endMin,
    startTime: `${String(props.startHour ?? 8).padStart(2, "0")}:${String(props.startMin ?? 30).padStart(2, "0")}`,
    endTime: `${String(props.endHour ?? 11).padStart(2, "0")}:${String(props.endMin ?? 30).padStart(2, "0")}`,
    bufferYouth: props.bufferYouth,
    bufferAdult: props.bufferAdult,
  }), [props.club, props.startHour, props.startMin, props.endHour, props.endMin, props.bufferYouth, props.bufferAdult]);

  const active = useMemo(
    () => final.filter((fixture) => fixture.status !== "postponed"),
    [final]
  );

  const postponed = useMemo(
    () => final.filter((fixture) => fixture.status === "postponed"),
    [final]
  );

  const unresolved = isSunday ? props.sunUnresolved || [] : props.satUnresolved || [];
  const scheduled = isSunday ? props.sunScheduled || [] : props.satScheduled || [];
  const setScheduled = isSunday ? props.setSunScheduled : props.setSatScheduled;
  const setUnresolved = isSunday ? props.setSunUnresolved : props.setSatUnresolved;
  const manualFixtures = isSunday ? props.sunManual || [] : props.satManual || [];
  const setManualFixtures = isSunday ? props.setSunManual : props.setSatManual;
  const showManual = isSunday ? props.showSunManual : props.showManual;
  const setShowManual = isSunday ? props.setShowSunManual : props.setShowManual;
  const conflicts = isSunday ? props.sunConflicts || [] : props.satConflicts || [];

  const refWarnings = useMemo(
    () =>
      final.filter(
        (fixture) =>
          fixture.status !== "postponed" &&
          String(fixture.refStatus || "").toLowerCase() !== "confirmed"
      ).length,
    [final]
  );

  const officialConflicts = useMemo(() => findOfficialConflicts(final, props.refs || []), [final, props.refs]);

  const fixtureSearchResults = useMemo(() => {
    const query = sectionQuery.trim().toLowerCase();
    if (!query) return final.length;
    return final.filter((fixture) => getFixtureLabel(fixture).includes(query)).length;
  }, [final, sectionQuery]);


  const operationsHealth = useMemo(() => calculateOperationsHealth({
    fixtures: final,
    active,
    postponed,
    unresolved,
    conflicts,
    officialConflicts,
    refWarnings,
    closedPitches: props.closedPitches || [],
    pitchCfg: props.pitchCfg || [],
    club: clubWithTiming,
    hasRun,
  }), [active, clubWithTiming, conflicts, final, hasRun, officialConflicts, postponed, props.closedPitches, props.pitchCfg, refWarnings, unresolved]);

  const competitionRules = useMemo(() => calculateCompetitionRules({
    fixtures: final,
    active,
    pitchCfg: props.pitchCfg || [],
    teamCfg: props.teamCfg || [],
    closedPitches: props.closedPitches || [],
    club: clubWithTiming,
    allowArtificial: props.useAstro,
  }), [active, clubWithTiming, final, props.closedPitches, props.pitchCfg, props.teamCfg, props.useAstro]);

  const dayOptimisation = useMemo(() => calculateDayOptimisation({
    fixtures: final,
    pitchCfg: props.pitchCfg || [],
    closedPitches: props.closedPitches || [],
    club: clubWithTiming,
    start: clubWithTiming.startTime,
    end: clubWithTiming.endTime,
  }), [clubWithTiming, final, props.closedPitches, props.pitchCfg]);

  const weatherIntelligence = useMemo(() => calculateWeatherIntelligence({
    club: clubWithTiming,
    fixtures: final,
    dateLabel,
  }), [clubWithTiming, dateLabel, final]);

  const recommendationCentre = useMemo(() => buildRecommendationCentre({
    fixtures: final,
    active,
    unresolved,
    conflicts,
    officialConflicts,
    refWarnings,
    hasRun,
    club: clubWithTiming,
    pitchCfg: props.pitchCfg || [],
    closedPitches: props.closedPitches || [],
    competitionRules,
    weatherIntelligence,
    dayOptimisation,
  }), [active, clubWithTiming, competitionRules, conflicts, dayOptimisation, final, hasRun, officialConflicts, props.closedPitches, props.pitchCfg, refWarnings, unresolved, weatherIntelligence]);

  const matchdayProps = {
    ...props,
    day,
    club: clubWithTiming,
    hasRun,
    final,
    active,
    postponed,
    unresolved,
    scheduled,
    setScheduled,
    setUnresolved,
    manualFixtures,
    setManualFixtures,
    showManual,
    setShowManual,
    overrides,
    onOverride,
    dateLabel,
    games: final,
    conflicts,
    officialConflicts,
    refWarnings,
    onFixtureClick: openFixture,
  };

  const selectedFixture =
    typeof selectedFixtureIndex === "number" && final[selectedFixtureIndex]
      ? {
          ...final[selectedFixtureIndex],
          __index: selectedFixtureIndex,
          __day: day,
        }
      : null;

  function openFixture(fixture, index) {
    if (typeof index === "number") {
      setSelectedFixtureIndex(index);
      return;
    }

    const fixtureIndex = final.findIndex((item) => item === fixture);

    if (fixtureIndex >= 0) {
      setSelectedFixtureIndex(fixtureIndex);
    }
  }

  const sections = useMemo(() => {
    const unresolvedState = getSectionStatus({ danger: unresolved.length > 0, ready: unresolved.length === 0 });
    const scheduleState = getSectionStatus({
      danger: conflicts.length > 0,
      warning: conflicts.length === 0 && (refWarnings > 0 || officialConflicts.length > 0),
      ready: conflicts.length === 0 && refWarnings === 0 && officialConflicts.length === 0,
    });
    const conflictState = getSectionStatus({ danger: conflicts.length > 0, ready: conflicts.length === 0 });
    const closureState = getSectionStatus({ warning: (props.closedPitches || []).length > 0, ready: !(props.closedPitches || []).length });
    const runState = getSectionStatus({ warning: !hasRun, ready: hasRun });

    return [
      {
        id: "manual",
        workspace: "fixtures",
        title: "Manual Fixtures",
        subtitle: "Create, edit and manage fixtures that were not imported.",
        icon: ClipboardList,
        badge: manualFixtures.length ? `${manualFixtures.length} manual` : "Manual",
        ...runState,
        render: () => <ManualFixtures {...matchdayProps} />,
      },
      {
        id: "summary",
        workspace: "fixtures",
        title: "Fixture Summary",
        subtitle: "Matchday totals, scheduled games and operational readiness.",
        icon: Target,
        badge: `${final.length} fixtures`,
        ...runState,
        render: () => <SummaryBar {...matchdayProps} />,
      },
      {
        id: "unresolved",
        workspace: "fixtures",
        title: "Unresolved Fixtures",
        subtitle: "Fixtures that need manual attention before the day can be locked.",
        icon: ShieldAlert,
        badge: unresolved.length ? `${unresolved.length} unresolved` : "Clear",
        ...unresolvedState,
        render: () => <UnresolvedCard {...matchdayProps} />,
      },
      {
        id: "schedule",
        workspace: "fixtures",
        title: "Schedule",
        subtitle: "Review the fixture list, kick-off times and pitch allocation.",
        icon: CalendarDays,
        badge: refWarnings
          ? `${refWarnings} refs to chase`
          : active.length
            ? `${active.length} active`
            : "No active fixtures",
        ...scheduleState,
        render: () => <ScheduleCard {...matchdayProps} />,
      },
      {
        id: "timeline",
        workspace: "fixtures",
        title: `${day} Timeline`,
        subtitle: "Pitch usage and kick-off flow across the matchday.",
        icon: BarChart3,
        badge: hasRun ? "Timeline" : "Build first",
        ...runState,
        render: () => (
          <MatchdayTimelineCard
            title={`${day} Timeline`}
            subtitle={`Pitch usage and kick-off flow for ${day.toLowerCase()} fixtures.`}
            games={final}
            pitchCfg={props.pitchCfg}
            club={clubWithTiming}
            onFixtureClick={openFixture}
          />
        ),
      },
      {
        id: "competitionRules",
        workspace: "fixtures",
        title: "Competition Rules",
        subtitle: "Validate timing windows, pitch formats and competition rule readiness.",
        icon: ShieldAlert,
        badge: competitionRules.metrics?.danger
          ? `${competitionRules.metrics.danger} rule issues`
          : competitionRules.metrics?.warnings
            ? `${competitionRules.metrics.warnings} warnings`
            : "Compliant",
        status: competitionRules.status,
        label: competitionRules.label,
        filter: competitionRules.status === "danger" ? "issues" : competitionRules.status === "warning" ? "warnings" : "ready",
        render: () => <CompetitionRulesCard rules={competitionRules} />,
      },
      {
        id: "pitchClosures",
        workspace: "resources",
        title: "Pitch Closures",
        subtitle: "Close pitches, reopen pitches and protect unavailable surfaces.",
        icon: MapPinned,
        badge: (props.closedPitches || []).length ? `${(props.closedPitches || []).length} closed` : "All open",
        ...closureState,
        render: () => (
          <PitchClosuresCard
            pitchCfg={props.pitchCfg}
            closedPitches={props.closedPitches}
            toggleClosed={props.toggleClosed}
            closeAllPitches={props.closeAllPitches}
            reopenAllPitches={props.reopenAllPitches}
          />
        ),
      },
      {
        id: "pitchAssignments",
        workspace: "resources",
        title: "Pitch Assignments",
        subtitle: "Check pitch allocations, formats and matchday pitch usage.",
        icon: Layers3,
        badge: props.pitchCfg?.length ? `${props.pitchCfg.length} pitches` : "Pitches",
        ...conflictState,
        render: () => (
          <MatchdayPitchAssignmentsCard
            {...props}
            day={day}
            satHasRun={hasRun}
            satActive={active}
            satFinal={final}
            satOverrides={overrides}
          />
        ),
      },
      {
        id: "parkingCapacity",
        workspace: "resources",
        title: "Parking Capacity",
        subtitle: "Resource view of available spaces, expected demand and capacity settings.",
        icon: Car,
        badge: `${normaliseCapacity(clubWithTiming.carParkSpaces || clubWithTiming.parkingSpaces || clubWithTiming.capacity) || "—"} spaces`,
        ...getSectionStatus({ warning: estimateParkingLoad(active, clubWithTiming, props.pitchCfg) > normaliseCapacity(clubWithTiming.carParkSpaces || clubWithTiming.parkingSpaces || clubWithTiming.capacity), ready: true }),
        render: () => <ParkingCapacityCard active={active} club={clubWithTiming} pitchCfg={props.pitchCfg} />,
      },
      {
        id: "recommendationCentre",
        workspace: "intelligence",
        title: "Recommendation Centre",
        subtitle: "One shared action queue for parking, officials, weather, rules and resources.",
        icon: Sparkles,
        badge: recommendationCentre.metrics?.total
          ? `${recommendationCentre.metrics.total} actions`
          : "Action queue",
        status: recommendationCentre.status,
        label: recommendationCentre.label,
        filter: recommendationCentre.status === "danger" ? "issues" : recommendationCentre.status === "warning" ? "warnings" : "ready",
        render: () => <RecommendationCentreCard centre={recommendationCentre} />,
      },
      {
        id: "dayOptimiser",
        workspace: "intelligence",
        title: "Day Optimiser",
        subtitle: "Best overall validated fixture moves for the whole matchday.",
        icon: Sparkles,
        badge: dayOptimisation.metrics?.validatedMoves
          ? `${dayOptimisation.metrics.validatedMoves} moves`
          : "Optimised",
        status: dayOptimisation.status,
        label: dayOptimisation.label,
        filter: dayOptimisation.status === "danger" ? "issues" : dayOptimisation.status === "warning" ? "warnings" : "ready",
        render: () => <DayOptimiserCard optimisation={dayOptimisation} />,
      },
      {
        id: "parkingIntelligence",
        workspace: "intelligence",
        title: "Parking Intelligence",
        subtitle: "Peak pressure, parking risks and validated fixture-move recommendations.",
        icon: Sparkles,
        badge: "Engine",
        ...getSectionStatus({ warning: active.length > 0, ready: active.length === 0 }),
        render: () => (
          <MatchdayCarParkCard
            {...props}
            club={clubWithTiming}
            day={day}
            satHasRun={hasRun}
            satFinal={final}
            onOverride={onOverride}
          />
        ),
      },
      {
        id: "operationsHealth",
        workspace: "intelligence",
        title: "Operations Health",
        subtitle: "Single health score covering fixtures, pitches, officials, parking and communications.",
        icon: ShieldAlert,
        badge: `${operationsHealth.score}%`,
        status: operationsHealth.status,
        label: operationsHealth.label,
        filter: operationsHealth.status === "danger" ? "issues" : operationsHealth.status === "warning" ? "warnings" : "ready",
        render: () => <OperationsHealthCard health={operationsHealth} />,
      },
      {
        id: "weatherIntelligence",
        workspace: "intelligence",
        title: "Weather Intelligence",
        subtitle: "Venue postcode readiness for live forecast, pitch-risk and postponement intelligence.",
        icon: CloudSun,
        badge: weatherIntelligence?.location || "Weather",
        status: weatherIntelligence.status,
        label: weatherIntelligence.label,
        filter: weatherIntelligence.status === "warning" ? "warnings" : "ready",
        render: () => <WeatherIntelligenceCard weather={weatherIntelligence} />,
      },
      {
        id: "coachMessages",
        workspace: "communications",
        title: "Coach Messages",
        subtitle: "Copy fixture messages for managers, coaches and team contacts.",
        icon: MessageSquareText,
        badge: hasRun ? `${active.length} messages` : "Build first",
        ...runState,
        render: () => (
          <MatchdayCoachMessagesCard
            {...props}
            day={day}
            satHasRun={hasRun}
            satFinal={final}
            satDateLabel={dateLabel}
          />
        ),
      },
      {
        id: "publishing",
        workspace: "communications",
        title: "Publishing Queue",
        subtitle: "Placeholder for future WhatsApp, email, TeamFeePay, Pitchero and Spond publishing.",
        icon: Mail,
        badge: "Coming soon",
        status: "info",
        label: "Planned",
        filter: "ready",
        render: () => (
          <div className="rounded-3xl border border-sky-200 bg-sky-50 p-6 text-sky-900">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-sky-700 ring-1 ring-sky-200">
                <Mail size={22} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-xl font-black">Integration publishing is next</h3>
                <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-sky-800">
                  This area is reserved for future outbound communications through TeamFeePay, Pitchero, Spond, FA integrations, email and calendar sync. Coach Messages remain live above.
                </p>
              </div>
            </div>
          </div>
        ),
      },
    ];
  }, [ManualFixtures, ScheduleCard, SummaryBar, UnresolvedCard, active, clubWithTiming, competitionRules, conflicts, dateLabel, day, dayOptimisation, final, hasRun, manualFixtures.length, matchdayProps, officialConflicts.length, onOverride, operationsHealth, overrides, postponed.length, props, recommendationCentre, refWarnings, unresolved.length, weatherIntelligence]);


  const navigationSection = useMemo(() => {
    if (!navigationTarget) return null;
    const targetDay = String(navigationTarget.day || "").toLowerCase();
    if (targetDay && targetDay !== day.toLowerCase()) return null;

    const requestedCard = navigationTarget.card;
    const aliases = {
      parking: "parkingIntelligence",
      parkingCapacity: "parkingCapacity",
      parkingIntelligence: "parkingIntelligence",
      weather: "weatherIntelligence",
      weatherIntelligence: "weatherIntelligence",
      recommendations: "recommendationCentre",
      recommendationCentre: "recommendationCentre",
      actionQueue: "recommendationCentre",
      dayOptimiser: "dayOptimiser",
      actionBar: "actionBar",
      build: "actionBar",
      buildSchedule: "actionBar",
      controls: "actionBar",
      officials: "operationsHealth",
      operationsHealth: "operationsHealth",
      fixtures: "schedule",
      schedule: "schedule",
      resources: "pitchClosures",
      ground: "pitchClosures",
      pitchClosures: "pitchClosures",
      coachMessages: "coachMessages",
      communications: "coachMessages",
    };

    const sectionId = aliases[requestedCard] || requestedCard;
    if (sectionId === "actionBar") {
      return { id: "actionBar", workspace: navigationTarget.workspace || "fixtures" };
    }

    const byCard = sectionId ? sections.find((section) => section.id === sectionId) : null;
    if (byCard) return byCard;

    if (navigationTarget.workspace) {
      return sections.find((section) => section.workspace === navigationTarget.workspace) || null;
    }

    return null;
  }, [day, navigationTarget, sections]);

  useEffect(() => {
    if (!navigationTarget || !navigationSection) return;

    const targetKey = `${navigationTarget.target || "target"}-${navigationTarget.createdAt || ""}-${day}`;
    if (targetAppliedRef.current === targetKey) return;
    targetAppliedRef.current = targetKey;

    setSectionQuery("");
    setSectionFilter("all");
    setActiveWorkspace(navigationSection.workspace);
    setOpenSections((current) => ({ ...current, [navigationSection.id]: true }));
    setHighlightedSection(navigationSection.id);

    window.setTimeout(() => {
      const element = document.getElementById(`matchday-section-${navigationSection.id}`);
      if (element && navigationTarget.scroll !== false) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 120);

    window.setTimeout(() => setHighlightedSection(null), 2200);
    window.setTimeout(() => {
      if (typeof clearNavigationTarget === "function") {
        clearNavigationTarget();
      }
    }, 300);
  }, [clearNavigationTarget, day, navigationSection, navigationTarget]);

  const workspaceCounts = useMemo(() => {
    return WORKSPACES.reduce((acc, workspace) => {
      acc[workspace.id] = sections.filter((section) => section.workspace === workspace.id).length;
      return acc;
    }, {});
  }, [sections]);

  const visibleSections = useMemo(() => {
    const query = sectionQuery.trim().toLowerCase();

    return sections.filter((section) => {
      if (section.workspace !== activeWorkspace) return false;
      if (sectionFilter !== "all" && section.filter !== sectionFilter) return false;
      if (!query) return true;

      const haystack = [section.title, section.subtitle, section.badge, section.label]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query) || fixtureSearchResults > 0;
    });
  }, [activeWorkspace, fixtureSearchResults, sectionFilter, sectionQuery, sections]);

  const activeWorkspaceMeta = WORKSPACES.find((workspace) => workspace.id === activeWorkspace) || WORKSPACES[0];
  const workspaceSectionIds = sections
    .filter((section) => section.workspace === activeWorkspace)
    .map((section) => section.id);
  function shouldAutoExpandSection(section) {
    return section?.status === "danger" || section?.status === "warning";
  }

  function isSectionOpen(section) {
    if (Object.prototype.hasOwnProperty.call(openSections, section.id)) {
      return Boolean(openSections[section.id]);
    }

    return shouldAutoExpandSection(section);
  }

  const allOpen = workspaceSectionIds.length > 0 && sections
    .filter((section) => section.workspace === activeWorkspace)
    .every((section) => isSectionOpen(section));

  function toggleSection(id) {
    setOpenSections((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  function setWorkspaceOpenState(nextOpen) {
    setOpenSections((current) => {
      const next = { ...current };
      workspaceSectionIds.forEach((id) => {
        next[id] = nextOpen;
      });
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div id="matchday-section-actionBar">
        <MatchdayActionBar
          day={day}
          mode={props.mode}
          hasRun={hasRun}
          fixtureCount={final.length}
          pitchCfg={props.pitchCfg}
          closedPitches={props.closedPitches}
          unresolvedCount={unresolved.length}
          refWarnings={refWarnings}
          runTest={isSunday ? props.runSunTest : props.runSatTest}
          runLive={isSunday ? props.runSunLive : props.runSatLive}
          saveWeek={props.saveWeek}
          allowArtificial={props.useAstro}
          setAllowArtificial={props.setUseAstro}
        />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 lg:grid-cols-4">
          {WORKSPACES.map((workspace) => (
            <WorkspaceTab
              key={workspace.id}
              workspace={workspace}
              active={workspace.id === activeWorkspace}
              count={workspaceCounts[workspace.id] || 0}
              onClick={() => {
                if (typeof clearNavigationTarget === "function") clearNavigationTarget();
                setActiveWorkspace(workspace.id);
              }}
            />
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-4 border-t border-slate-200 pt-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-[0.26em] text-emerald-700">
              {activeWorkspaceMeta.label} Workspace
            </div>
            <p className="mt-1 text-sm font-bold text-slate-500">{activeWorkspaceMeta.description}</p>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
            <div className="relative min-w-0 lg:w-80">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} strokeWidth={2.5} />
              <input
                value={sectionQuery}
                onChange={(event) => setSectionQuery(event.target.value)}
                placeholder="Search sections or fixtures..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <button
              type="button"
              onClick={() => setWorkspaceOpenState(!allOpen)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              {allOpen ? "Collapse all" : "Expand all"}
              <ChevronRight size={16} strokeWidth={2.5} className={`transition ${allOpen ? "rotate-90" : ""}`} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            <Filter size={14} strokeWidth={2.5} /> Filter
          </span>
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setSectionFilter(filter.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
                sectionFilter === filter.id
                  ? "bg-slate-950 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        {visibleSections.length ? (
          visibleSections.map((section) => (
            <CollapsibleCard
              key={section.id}
              id={section.id}
              title={section.title}
              subtitle={section.subtitle}
              icon={section.icon}
              badge={section.badge}
              status={section.status}
              statusLabel={section.label}
              open={isSectionOpen(section)}
              highlighted={highlightedSection === section.id}
              onToggle={() => toggleSection(section.id)}
            >
              {section.render()}
            </CollapsibleCard>
          ))
        ) : (
          <EmptyWorkspace query={sectionQuery} filter={sectionFilter} />
        )}
      </section>

      <FixtureDrawer
        fixture={selectedFixture}
        fixtures={final}
        club={clubWithTiming}
        refs={props.refs}
        pitchCfg={props.pitchCfg}
        closedPitches={props.closedPitches}
        onOverride={onOverride}
        onClose={() => setSelectedFixtureIndex(null)}
      />
    </div>
  );
}
