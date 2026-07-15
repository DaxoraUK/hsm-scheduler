import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BarChart3,
  CalendarDays,
  Car,
  ChevronRight,
  CloudSun,
  ClipboardList,
  Filter,
  Layers3,
  MapPinned,
  Megaphone,
  MessageSquareText,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  UsersRound,
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
import CompetitionRulesCard from "../components/Operations/shared/CompetitionRulesCard.jsx";
import DayOptimiserCard from "../components/Operations/shared/DayOptimiserCard.jsx";
import WeatherIntelligenceCard from "../components/Operations/shared/WeatherIntelligenceCard.jsx";
import MatchdayGuidanceCard from "../components/Operations/shared/MatchdayGuidanceCard.jsx";
import OfficialsIntelligenceCard from "../components/Operations/shared/OfficialsIntelligenceCard.jsx";
import CollapsibleCard from "../ui/CollapsibleCard.jsx";
import ConfirmDialog from "../ui/ConfirmDialog.jsx";
import { calculateCompetitionRules } from "../lib/engines/competitionRulesEngine.js";
import { calculateDayOptimisation } from "../lib/engines/dayOptimiserEngine.js";
import { calculateWeatherIntelligence } from "../lib/engines/weatherIntelligenceEngine.js";
import { buildRecommendationCentre } from "../lib/engines/recommendationCentreEngine.js";
import { calculateOperationsIntelligence } from "../lib/engines/operationsIntelligenceEngine.js";
import {
  calculateOfficialsReadiness,
  findOfficialConflicts,
} from "../lib/engines/officialsEngine.js";
import useLiveWeather from "../hooks/useLiveWeather.js";
import {
  readMatchdayLock,
  writeMatchdayLock,
} from "../lib/operations/matchdayLock.js";
import { getParkingStats } from "../lib/dashboardStats.js";
import { toast } from "../lib/notifications/daxoraNotifications.js";
import { getTimelineCandidateSummary } from "../lib/engines/timelineDragEngine.js";
import {
  buildPlannerChangeRecord,
  getPlannerFixtureIdentity,
} from "../lib/engines/matchdayPlannerEngine.js";
import { ENTITLEMENTS, hasEntitlement } from "../lib/subscriptions/entitlements.js";

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
    description:
      "Review parking, officials, weather and validated operational guidance.",
  },
  {
    id: "communications",
    label: "Communications",
    icon: Megaphone,
    description:
      "Prepare fixture messages for managers, coaches and team contacts.",
  },
];

const FILTERS = [
  { id: "all", label: "All" },
  { id: "issues", label: "Issues" },
  { id: "warnings", label: "Warnings" },
  { id: "ready", label: "Ready" },
];

const INTELLIGENCE_TARGETS = Object.freeze({
  actionBar: { workspace: "fixtures", section: "actionBar" },
  build: { workspace: "fixtures", section: "actionBar" },
  buildSchedule: { workspace: "fixtures", section: "actionBar" },
  controls: { workspace: "fixtures", section: "actionBar" },
  schedule: { workspace: "fixtures", section: "schedule" },
  fixtures: { workspace: "fixtures", section: "schedule" },
  unresolved: { workspace: "fixtures", section: "unresolved" },
  competitionRules: { workspace: "fixtures", section: "competitionRules" },
  pitchClosures: { workspace: "resources", section: "pitchClosures" },
  pitchAssignments: { workspace: "resources", section: "pitchAssignments" },
  resources: { workspace: "resources", section: "pitchAssignments" },
  parking: { workspace: "intelligence", section: "parkingIntelligence" },
  parkingIntelligence: {
    workspace: "intelligence",
    section: "parkingIntelligence",
  },
  officials: { workspace: "intelligence", section: "officialsIntelligence" },
  officialsIntelligence: {
    workspace: "intelligence",
    section: "officialsIntelligence",
  },
  weather: { workspace: "intelligence", section: "weatherIntelligence" },
  weatherIntelligence: {
    workspace: "intelligence",
    section: "weatherIntelligence",
  },
  optimiser: { workspace: "intelligence", section: "dayOptimiser" },
  dayOptimiser: { workspace: "intelligence", section: "dayOptimiser" },
  matchdayGuidance: { workspace: "intelligence", section: "matchdayGuidance" },
  operationsIntelligence: {
    workspace: "intelligence",
    section: "matchdayGuidance",
  },
  recommendationCentre: {
    workspace: "intelligence",
    section: "matchdayGuidance",
  },
  communications: { workspace: "communications", section: "coachMessages" },
  coachMessages: { workspace: "communications", section: "coachMessages" },
});

function getIntelligenceTarget(target, item = {}) {
  const itemText = `${item.id || ""} ${item.title || ""}`.toLowerCase();
  if (itemText.includes("build") && itemText.includes("schedule")) {
    return INTELLIGENCE_TARGETS.actionBar;
  }

  if (item.domain === "officials") {
    return INTELLIGENCE_TARGETS.officialsIntelligence;
  }

  if (target && typeof target === "object") {
    const section = target.section || target.card;
    if (section) {
      return {
        workspace:
          target.workspace ||
          INTELLIGENCE_TARGETS[section]?.workspace ||
          "intelligence",
        section: INTELLIGENCE_TARGETS[section]?.section || section,
      };
    }
  }

  return (
    INTELLIGENCE_TARGETS[target] || {
      workspace: "intelligence",
      section: "matchdayGuidance",
    }
  );
}

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

function getSectionStatus({
  danger = false,
  warning = false,
  ready = true,
} = {}) {
  if (danger)
    return { status: "danger", label: "Needs action", filter: "issues" };
  if (warning)
    return { status: "warning", label: "Review", filter: "warnings" };
  if (ready) return { status: "success", label: "Ready", filter: "ready" };
  return { status: "neutral", label: "Pending", filter: "all" };
}

function EmptyWorkspace({ query, filter }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <Search size={22} strokeWidth={2.5} />
      </div>
      <h3 className="mt-4 text-lg font-black text-slate-950">
        No sections match
      </h3>
      <p className="mt-2 text-sm font-bold text-slate-500">
        {query
          ? `Nothing matched “${query}”.`
          : `No sections match the ${filter} filter.`}
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
      className={`group flex min-h-[60px] items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition ${
        active
          ? "bg-slate-950 text-white shadow-md"
          : "bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-white hover:text-slate-950 hover:shadow-sm"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? "bg-white/10 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}
        >
          <Icon size={19} strokeWidth={2.5} />
        </div>
        <div className="min-w-0 truncate text-sm font-black">
          {workspace.label}
        </div>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${active ? "bg-white/15 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}
      >
        {count}
      </span>
    </button>
  );
}

export default function MatchdayPage({
  day,
  props,
  fixtureDay = null,
  hasRun,
  final = [],
  overrides = {},
  unresolved: suppliedUnresolved,
  scheduled: suppliedScheduled,
  setScheduled: suppliedSetScheduled,
  setUnresolved: suppliedSetUnresolved,
  manualFixtures: suppliedManualFixtures,
  setManualFixtures: suppliedSetManualFixtures,
  showManual: suppliedShowManual,
  setShowManual: suppliedSetShowManual,
  conflicts: suppliedConflicts,
  runTest,
  runLive,
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
  const matchdayDate =
    fixtureDay?.date ||
    (day === "Sunday"
      ? props.sunDate
      : day === "Midweek"
        ? props.midweekDate
        : props.satDate);

  const lockIdentity = useMemo(
    () => ({
      clubId: props.club?.id || props.club?.name || "club",
      day: day.toLowerCase(),
      date: matchdayDate || dateLabel || "undated",
    }),
    [dateLabel, day, matchdayDate, props.club?.id, props.club?.name],
  );
  const [isLocked, setIsLocked] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [timelineDirty, setTimelineDirty] = useState(false);
  const [timelineSaving, setTimelineSaving] = useState(false);
  const [timelineHistory, setTimelineHistory] = useState([]);
  const [timelineRedoHistory, setTimelineRedoHistory] = useState([]);

  useEffect(() => {
    setIsLocked(readMatchdayLock(lockIdentity));
  }, [lockIdentity]);

  useEffect(() => {
    setTimelineDirty(false);
    setTimelineHistory([]);
    setTimelineRedoHistory([]);
  }, [day, matchdayDate]);

  const clubWithTiming = useMemo(
    () => ({
      ...(props.club || {}),
      fixtureDayKey: fixtureDay?.key || day.toLowerCase(),
      fixtureDayRules: fixtureDay?.rules || {},
      startHour: props.startHour,
      startMin: props.startMin,
      endHour: props.endHour,
      endMin: props.endMin,
      startTime: `${String(props.startHour ?? 8).padStart(2, "0")}:${String(props.startMin ?? 30).padStart(2, "0")}`,
      endTime: `${String(props.endHour ?? 11).padStart(2, "0")}:${String(props.endMin ?? 30).padStart(2, "0")}`,
      bufferYouth: props.bufferYouth,
      bufferAdult: props.bufferAdult,
    }),
    [
      day,
      fixtureDay,
      props.club,
      props.startHour,
      props.startMin,
      props.endHour,
      props.endMin,
      props.bufferYouth,
      props.bufferAdult,
    ],
  );

  const active = useMemo(
    () => final.filter((fixture) => fixture.status !== "postponed"),
    [final],
  );

  const postponed = useMemo(
    () => final.filter((fixture) => fixture.status === "postponed"),
    [final],
  );

  const liveWeather = useLiveWeather({
    club: clubWithTiming,
    date: matchdayDate,
    fixtures: active,
  });

  const unresolved =
    suppliedUnresolved ??
    (isSunday ? props.sunUnresolved || [] : props.satUnresolved || []);
  const scheduled =
    suppliedScheduled ??
    (isSunday ? props.sunScheduled || [] : props.satScheduled || []);
  const setScheduled =
    suppliedSetScheduled ||
    (isSunday ? props.setSunScheduled : props.setSatScheduled);
  const setUnresolved =
    suppliedSetUnresolved ||
    (isSunday ? props.setSunUnresolved : props.setSatUnresolved);
  const manualFixtures =
    suppliedManualFixtures ??
    (isSunday ? props.sunManual || [] : props.satManual || []);
  const setManualFixtures =
    suppliedSetManualFixtures ||
    (isSunday ? props.setSunManual : props.setSatManual);
  const showManual =
    suppliedShowManual ?? (isSunday ? props.showSunManual : props.showManual);
  const setShowManual =
    suppliedSetShowManual ||
    (isSunday ? props.setShowSunManual : props.setShowManual);
  const conflicts =
    suppliedConflicts ??
    (isSunday ? props.sunConflicts || [] : props.satConflicts || []);

  const refWarnings = useMemo(
    () =>
      final.filter(
        (fixture) =>
          fixture.status !== "postponed" &&
          String(fixture.refStatus || "").toLowerCase() !== "confirmed",
      ).length,
    [final],
  );

  const officialConflicts = useMemo(
    () => findOfficialConflicts(final, props.refs || []),
    [final, props.refs],
  );

  const officialsIntelligence = useMemo(
    () =>
      calculateOfficialsReadiness({
        fixtures: final,
        active,
        officialConflicts,
        refWarnings,
        refs: props.refs || [],
      }),
    [active, final, officialConflicts, props.refs, refWarnings],
  );

  const fixtureSearchResults = useMemo(() => {
    const query = sectionQuery.trim().toLowerCase();
    if (!query) return final.length;
    return final.filter((fixture) => getFixtureLabel(fixture).includes(query))
      .length;
  }, [final, sectionQuery]);

  const openIntelligenceTarget = useCallback((target, item = {}) => {
    const destination = getIntelligenceTarget(target, item);

    setSectionQuery("");
    setSectionFilter("all");
    setActiveWorkspace(destination.workspace);
    setOpenSections((current) => ({ ...current, [destination.section]: true }));
    setHighlightedSection(destination.section);

    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        document
          .getElementById(`matchday-section-${destination.section}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);

      window.setTimeout(() => setHighlightedSection(null), 2200);
    }
  }, []);

  const competitionRules = useMemo(
    () =>
      calculateCompetitionRules({
        fixtures: final,
        active,
        pitchCfg: props.pitchCfg || [],
        teamCfg: props.teamCfg || [],
        closedPitches: props.closedPitches || [],
        club: clubWithTiming,
        allowArtificial: props.useAstro,
      }),
    [
      active,
      clubWithTiming,
      final,
      props.closedPitches,
      props.pitchCfg,
      props.teamCfg,
      props.useAstro,
    ],
  );

  const dayOptimisation = useMemo(
    () =>
      calculateDayOptimisation({
        fixtures: final,
        pitchCfg: props.pitchCfg || [],
        closedPitches: props.closedPitches || [],
        club: clubWithTiming,
        start: clubWithTiming.startTime,
        end: clubWithTiming.endTime,
      }),
    [clubWithTiming, final, props.closedPitches, props.pitchCfg],
  );

  const editableOverride = isLocked ? undefined : onOverride;

  const lockSchedule = useCallback(() => {
    writeMatchdayLock(lockIdentity, true);
    setIsLocked(true);
    setPendingConfirmation(null);
    toast.success(`${day} schedule locked`, {
      description:
        "The current fixture plan is now protected from schedule changes.",
    });
  }, [day, lockIdentity]);

  const toggleScheduleLock = useCallback(() => {
    if (isLocked) {
      writeMatchdayLock(lockIdentity, false);
      setIsLocked(false);
      toast.success(`${day} schedule unlocked`, {
        description:
          "Fixture changes and validated optimiser moves are available again.",
      });
      return;
    }

    if (!hasRun || final.length === 0) {
      toast.error("Build the schedule before locking it");
      return;
    }

    const issues = [];
    if (unresolved.length)
      issues.push(
        `${unresolved.length} unresolved fixture${unresolved.length === 1 ? "" : "s"}`,
      );
    if (conflicts.length)
      issues.push(
        `${conflicts.length} pitch conflict${conflicts.length === 1 ? "" : "s"}`,
      );
    if (officialConflicts.length)
      issues.push(
        `${officialConflicts.length} official clash${officialConflicts.length === 1 ? "" : "es"}`,
      );
    if (refWarnings)
      issues.push(
        `${refWarnings} official confirmation${refWarnings === 1 ? "" : "s"} outstanding`,
      );

    if (issues.length) {
      setPendingConfirmation({ type: "lock", issues });
      return;
    }

    lockSchedule();
  }, [
    conflicts.length,
    day,
    final.length,
    hasRun,
    isLocked,
    lockIdentity,
    lockSchedule,
    officialConflicts.length,
    refWarnings,
    unresolved.length,
  ]);

  const applyOptimisationMove = useCallback(
    (move) => {
      if (isLocked || typeof onOverride !== "function" || !move?.patch) return;
      Object.entries(move.patch).forEach(([field, value]) =>
        onOverride(move.fixtureIndex, field, value),
      );
      toast.success("Validated fixture move applied", {
        description:
          move.summary || move.fixtureTitle || "The schedule has been updated.",
      });
    },
    [isLocked, onOverride],
  );

  const applyAllValidatedMoves = useCallback(() => {
    const moves = dayOptimisation.moves || [];
    if (!moves.length || isLocked || typeof onOverride !== "function") return;

    moves.forEach((move) => {
      Object.entries(move.patch || {}).forEach(([field, value]) =>
        onOverride(move.fixtureIndex, field, value),
      );
    });

    setPendingConfirmation(null);
    toast.success("Schedule improvements applied", {
      description: `${moves.length} validated move${moves.length === 1 ? "" : "s"} applied.`,
    });
  }, [dayOptimisation.moves, isLocked, onOverride]);

  const applyAllOptimisationMoves = useCallback(() => {
    const moves = dayOptimisation.moves || [];
    if (!moves.length || isLocked || typeof onOverride !== "function") return;
    setPendingConfirmation({ type: "optimise", count: moves.length });
  }, [dayOptimisation.moves, isLocked, onOverride]);

  const reviewOptimisation = useCallback(() => {
    setSectionQuery("");
    setSectionFilter("all");
    setActiveWorkspace("intelligence");
    setOpenSections((current) => ({ ...current, dayOptimiser: true }));
    setHighlightedSection("dayOptimiser");
    window.setTimeout(() => {
      document
        .getElementById("matchday-section-dayOptimiser")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    window.setTimeout(() => setHighlightedSection(null), 2200);
  }, []);

  const getTimelineRecordIndex = useCallback(
    (record) => {
      const matchedIndex = final.findIndex(
        (fixture, fixtureIndex) =>
          getPlannerFixtureIdentity(fixture, fixtureIndex) === record?.fixtureId,
      );
      return matchedIndex >= 0 ? matchedIndex : record?.fixtureIndex;
    },
    [final],
  );

  const applyTimelineRecordPatch = useCallback(
    (record, patch) => {
      if (typeof onOverride !== "function" || !record || !patch) return;
      const fixtureIndex = getTimelineRecordIndex(record);
      if (!Number.isInteger(fixtureIndex) || fixtureIndex < 0) return;
      Object.entries(patch).forEach(([field, value]) =>
        onOverride(fixtureIndex, field, value),
      );
    },
    [getTimelineRecordIndex, onOverride],
  );

  const undoTimelineMove = useCallback(() => {
    const record = timelineHistory.at(-1);
    if (!record || isLocked) return;
    applyTimelineRecordPatch(record, record.previousPatch);
    setTimelineHistory((current) => current.slice(0, -1));
    setTimelineRedoHistory((current) => [...current, record]);
    setTimelineDirty(timelineHistory.length > 1);
    toast.info("Planner change undone", {
      description: record.summary || "The fixture returned to its previous pitch and kick-off time.",
    });
  }, [applyTimelineRecordPatch, isLocked, timelineHistory]);

  const redoTimelineMove = useCallback(() => {
    const record = timelineRedoHistory.at(-1);
    if (!record || isLocked) return;
    applyTimelineRecordPatch(record, record.patch);
    setTimelineRedoHistory((current) => current.slice(0, -1));
    setTimelineHistory((current) => [...current, record]);
    setTimelineDirty(true);
    toast.success("Planner change reapplied", {
      description: record.summary || "The fixture move has been reapplied.",
    });
  }, [applyTimelineRecordPatch, isLocked, timelineRedoHistory]);

  const discardTimelineChanges = useCallback(() => {
    if (!timelineHistory.length || isLocked) return;
    [...timelineHistory].reverse().forEach((record) =>
      applyTimelineRecordPatch(record, record.previousPatch),
    );
    setTimelineHistory([]);
    setTimelineRedoHistory([]);
    setTimelineDirty(false);
    toast.info("Planner changes discarded", {
      description: "The matchday schedule has returned to its last saved state.",
    });
  }, [applyTimelineRecordPatch, isLocked, timelineHistory]);

  const requestDiscardTimelineChanges = useCallback(() => {
    if (!timelineHistory.length || isLocked) return;
    setPendingConfirmation({ type: "timeline-discard", count: timelineHistory.length });
  }, [isLocked, timelineHistory.length]);

  const applyTimelineMove = useCallback(
    (candidate) => {
      if (isLocked || typeof onOverride !== "function" || !candidate?.patch) return;

      Object.entries(candidate.patch).forEach(([field, value]) =>
        onOverride(candidate.fixtureIndex, field, value),
      );
      const record = buildPlannerChangeRecord(candidate);
      if (record) setTimelineHistory((current) => [...current, record]);
      setTimelineRedoHistory([]);
      setTimelineDirty(true);
      setPendingConfirmation(null);

      toast.success("Fixture moved in Matchday Planner", {
        description: getTimelineCandidateSummary(candidate),
      });
    },
    [isLocked, onOverride],
  );

  const requestTimelineMove = useCallback(
    (candidate) => {
      if (!candidate) return;
      if (candidate.noChange) {
        toast.info(candidate.title || "Fixture already here", {
          description: candidate.message,
        });
        return;
      }
      if (candidate.blocked) {
        toast.error(candidate.title || "Timeline move blocked", {
          description: candidate.message || "Choose a suitable pitch or a different kick-off time.",
        });
        return;
      }
      if (candidate.advisory) {
        setPendingConfirmation({ type: "timeline-warning", candidate });
        return;
      }
      applyTimelineMove(candidate);
    },
    [applyTimelineMove],
  );

  const saveTimelineChanges = useCallback(async () => {
    if (typeof props.saveWeek !== "function" || timelineSaving) return;
    setTimelineSaving(true);
    try {
      const saved = await props.saveWeek();
      if (saved !== false) {
        setTimelineDirty(false);
        setTimelineHistory([]);
        setTimelineRedoHistory([]);
      }
    } finally {
      setTimelineSaving(false);
    }
  }, [props.saveWeek, timelineSaving]);

  const weatherIntelligence = useMemo(
    () =>
      calculateWeatherIntelligence({
        club: clubWithTiming,
        fixtures: final,
        dateLabel,
        forecastSource: liveWeather.data,
        connectionStatus: liveWeather.status,
        connectionError: liveWeather.error,
      }),
    [
      clubWithTiming,
      dateLabel,
      final,
      liveWeather.data,
      liveWeather.error,
      liveWeather.status,
    ],
  );

  const parkingStats = useMemo(
    () =>
      getParkingStats({
        fixtures: active,
        club: clubWithTiming,
        pitchCfg: props.pitchCfg || [],
        startMins: (props.startHour ?? 8) * 60 + (props.startMin ?? 30),
        scope: day.toLowerCase(),
      }),
    [
      active,
      clubWithTiming,
      day,
      props.pitchCfg,
      props.startHour,
      props.startMin,
    ],
  );

  const recommendationCentre = useMemo(
    () =>
      buildRecommendationCentre({
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
      }),
    [
      active,
      clubWithTiming,
      competitionRules,
      conflicts,
      dayOptimisation,
      final,
      hasRun,
      officialConflicts,
      props.closedPitches,
      props.pitchCfg,
      refWarnings,
      unresolved,
      weatherIntelligence,
    ],
  );

  const operationsIntelligence = useMemo(
    () =>
      calculateOperationsIntelligence({
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
      }),
    [
      active,
      clubWithTiming,
      competitionRules,
      conflicts,
      dayOptimisation,
      final,
      hasRun,
      officialConflicts,
      props.closedPitches,
      props.pitchCfg,
      refWarnings,
      unresolved,
      weatherIntelligence,
    ],
  );

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
    onOverride: editableOverride,
    readOnly: isLocked,
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
    const unresolvedState = getSectionStatus({
      danger: unresolved.length > 0,
      ready: unresolved.length === 0,
    });
    const scheduleState = getSectionStatus({
      danger: conflicts.length > 0,
      warning:
        conflicts.length === 0 &&
        (refWarnings > 0 || officialConflicts.length > 0),
      ready:
        conflicts.length === 0 &&
        refWarnings === 0 &&
        officialConflicts.length === 0,
    });
    const conflictState = getSectionStatus({
      danger: conflicts.length > 0,
      ready: conflicts.length === 0,
    });
    const closureState = getSectionStatus({
      warning: (props.closedPitches || []).length > 0,
      ready: !(props.closedPitches || []).length,
    });
    const runState = getSectionStatus({ warning: !hasRun, ready: hasRun });

    return [
      {
        id: "manual",
        workspace: "fixtures",
        title: "Manual Fixtures",
        subtitle: "Create, edit and manage fixtures that were not imported.",
        icon: ClipboardList,
        badge: manualFixtures.length
          ? `${manualFixtures.length} manual`
          : "Manual",
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
        subtitle:
          "Fixtures that need manual attention before the day can be locked.",
        icon: ShieldAlert,
        badge: unresolved.length ? `${unresolved.length} unresolved` : "Clear",
        ...unresolvedState,
        render: () => <UnresolvedCard {...matchdayProps} />,
      },
      {
        id: "schedule",
        workspace: "fixtures",
        title: "Schedule",
        subtitle:
          "Review the fixture list, kick-off times and pitch allocation.",
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
            closedPitches={props.closedPitches}
            club={clubWithTiming}
            readOnly={isLocked}
            dirty={timelineDirty}
            saving={timelineSaving}
            changeHistory={timelineHistory}
            canUndo={timelineHistory.length > 0}
            canRedo={timelineRedoHistory.length > 0}
            onUndo={undoTimelineMove}
            onRedo={redoTimelineMove}
            onDiscard={requestDiscardTimelineChanges}
            onSave={props.saveWeek ? saveTimelineChanges : undefined}
            onMoveRequest={editableOverride ? requestTimelineMove : undefined}
            onFixtureClick={openFixture}
            matchDate={matchdayDate}
            annualPlannerEnabled={hasEntitlement(props.subscription, ENTITLEMENTS.ANNUAL_PLANNER)}
          />
        ),
      },
      {
        id: "competitionRules",
        workspace: "fixtures",
        title: "Competition Rules",
        subtitle:
          "Validate timing windows, pitch formats and competition rule readiness.",
        icon: ShieldAlert,
        badge: competitionRules.metrics?.danger
          ? `${competitionRules.metrics.danger} rule issues`
          : competitionRules.metrics?.warnings
            ? `${competitionRules.metrics.warnings} warnings`
            : "Compliant",
        status: competitionRules.status,
        label: competitionRules.label,
        filter:
          competitionRules.status === "danger"
            ? "issues"
            : competitionRules.status === "warning"
              ? "warnings"
              : "ready",
        render: () => <CompetitionRulesCard rules={competitionRules} />,
      },
      {
        id: "pitchClosures",
        workspace: "resources",
        title: "Pitch Closures",
        subtitle:
          "Close pitches, reopen pitches and protect unavailable surfaces.",
        icon: MapPinned,
        badge: (props.closedPitches || []).length
          ? `${(props.closedPitches || []).length} closed`
          : "All open",
        ...closureState,
        render: () => (
          <PitchClosuresCard
            pitchCfg={props.pitchCfg}
            pitchClosures={props.pitchClosures}
            closedPitches={props.closedPitches}
            activeDate={matchdayDate}
            addPitchClosure={props.addPitchClosure}
            reopenPitchClosures={props.reopenPitchClosures}
            toggleClosed={props.toggleClosed}
            closeAllPitches={props.closeAllPitches}
            reopenAllPitches={props.reopenAllPitches}
            allowArtificial={props.useAstro}
          />
        ),
      },
      {
        id: "pitchAssignments",
        workspace: "resources",
        title: "Pitch Assignments",
        subtitle: "Check pitch allocations, formats and matchday pitch usage.",
        icon: Layers3,
        badge: props.pitchCfg?.length
          ? `${props.pitchCfg.length} pitches`
          : "Pitches",
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
      props.advancedOperationsEnabled
        ? {
            id: "matchdayGuidance",
            workspace: "intelligence",
            title: "Matchday Guidance",
            subtitle:
              "One clear operating status, one next best action and one prioritised queue.",
            icon: Sparkles,
            badge: operationsIntelligence.metrics?.total
              ? `${operationsIntelligence.metrics.total} guidance items`
              : "Guidance",
            status: operationsIntelligence.status,
            label: operationsIntelligence.label,
            filter:
              operationsIntelligence.status === "danger"
                ? "issues"
                : operationsIntelligence.status === "warning"
                  ? "warnings"
                  : "ready",
            render: () => (
              <MatchdayGuidanceCard
                intelligence={operationsIntelligence}
                recommendations={recommendationCentre}
                onNavigate={openIntelligenceTarget}
              />
            ),
          }
        : null,
      props.advancedOperationsEnabled
        ? {
            id: "dayOptimiser",
            workspace: "intelligence",
            title: "Schedule Improvements",
            subtitle:
              "Optional validated fixture moves that can improve the overall matchday flow.",
            icon: CalendarDays,
            badge: dayOptimisation.metrics?.validatedMoves
              ? `${dayOptimisation.metrics.validatedMoves} moves`
              : "Optimised",
            status: dayOptimisation.status,
            label: dayOptimisation.label,
            filter:
              dayOptimisation.status === "danger"
                ? "issues"
                : dayOptimisation.status === "warning"
                  ? "warnings"
                  : "ready",
            render: () => (
              <DayOptimiserCard
                optimisation={dayOptimisation}
                readOnly={isLocked}
                onApplyMove={applyOptimisationMove}
                onApplyAll={applyAllOptimisationMoves}
              />
            ),
          }
        : null,
      {
        id: "parkingIntelligence",
        workspace: "intelligence",
        title: "Parking Capacity & Arrivals",
        subtitle:
          "Available spaces, arrival waves, peak demand and practical mitigation actions.",
        icon: Car,
        badge: !hasRun
          ? "Awaiting schedule"
          : !parkingStats.configured
            ? "Configure parking"
            : `${parkingStats.pct}% peak`,
        ...getSectionStatus({
          danger: hasRun && parkingStats.overCapacity,
          warning:
            hasRun &&
            !parkingStats.overCapacity &&
            (!parkingStats.configured ||
              parkingStats.isHighPressure ||
              parkingStats.isOverConcurrentLimit),
          ready:
            hasRun &&
            parkingStats.configured &&
            !parkingStats.overCapacity &&
            !parkingStats.isHighPressure &&
            !parkingStats.isOverConcurrentLimit,
        }),
        render: () => (
          <MatchdayCarParkCard
            {...props}
            club={clubWithTiming}
            day={day}
            satHasRun={hasRun}
            satFinal={final}
            onOverride={editableOverride}
          />
        ),
      },
      {
        id: "officialsIntelligence",
        workspace: "intelligence",
        title: "Officials Coverage",
        subtitle:
          "Confirmation gaps, peak demand, clashes and official workload.",
        icon: UsersRound,
        badge: officialsIntelligence.metrics?.fixtures
          ? `${officialsIntelligence.metrics.confirmed}/${officialsIntelligence.metrics.fixtures} confirmed`
          : "Officials",
        status: officialsIntelligence.status,
        label: officialsIntelligence.label,
        filter:
          officialsIntelligence.status === "danger"
            ? "issues"
            : officialsIntelligence.status === "warning"
              ? "warnings"
              : "ready",
        render: () => (
          <OfficialsIntelligenceCard
            intelligence={officialsIntelligence}
            onFixtureClick={openFixture}
            matchDate={matchdayDate}
            annualPlannerEnabled={hasEntitlement(props.subscription, ENTITLEMENTS.ANNUAL_PLANNER)}
          />
        ),
      },
      {
        id: "weatherIntelligence",
        workspace: "intelligence",
        title: "Weather & Surface Risk",
        subtitle:
          "Forecast readiness, pitch exposure and postponement risk for the selected venue.",
        icon: CloudSun,
        badge: weatherIntelligence?.location || "Weather",
        status: weatherIntelligence.status,
        label: weatherIntelligence.label,
        filter:
          weatherIntelligence.status === "danger"
            ? "issues"
            : weatherIntelligence.status === "warning"
              ? "warnings"
              : "ready",
        render: () => (
          <WeatherIntelligenceCard
            weather={weatherIntelligence}
            onRefresh={liveWeather.refresh}
            refreshing={liveWeather.isLoading}
          />
        ),
      },
      {
        id: "coachMessages",
        workspace: "communications",
        title: "Coach Messages",
        subtitle:
          "Copy fixture messages for managers, coaches and team contacts.",
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
    ].filter(Boolean);
  }, [
    ManualFixtures,
    ScheduleCard,
    SummaryBar,
    UnresolvedCard,
    active,
    applyAllOptimisationMoves,
    applyOptimisationMove,
    clubWithTiming,
    competitionRules,
    conflicts,
    dateLabel,
    day,
    dayOptimisation,
    final,
    hasRun,
    isLocked,
    liveWeather.isLoading,
    liveWeather.refresh,
    manualFixtures.length,
    matchdayDate,
    matchdayProps,
    officialConflicts.length,
    officialsIntelligence,
    openIntelligenceTarget,
    overrides,
    postponed.length,
    props,
    operationsIntelligence,
    recommendationCentre,
    refWarnings,
    requestDiscardTimelineChanges,
    requestTimelineMove,
    saveTimelineChanges,
    timelineDirty,
    timelineHistory,
    timelineRedoHistory.length,
    timelineSaving,
    undoTimelineMove,
    redoTimelineMove,
    unresolved.length,
    weatherIntelligence,
  ]);

  const navigationSection = useMemo(() => {
    if (!navigationTarget) return null;
    const targetDay = String(navigationTarget.day || "").toLowerCase();
    if (targetDay && targetDay !== day.toLowerCase()) return null;

    const requestedCard = navigationTarget.card;
    const aliases = {
      parking: "parkingIntelligence",
      parkingCapacity: "parkingIntelligence",
      parkingIntelligence: "parkingIntelligence",
      weather: "weatherIntelligence",
      weatherIntelligence: "weatherIntelligence",
      intelligence: "matchdayGuidance",
      matchdayGuidance: "matchdayGuidance",
      operationsIntelligence: "matchdayGuidance",
      recommendations: "matchdayGuidance",
      recommendationCentre: "matchdayGuidance",
      actionQueue: "matchdayGuidance",
      dayOptimiser: "dayOptimiser",
      actionBar: "actionBar",
      build: "actionBar",
      buildSchedule: "actionBar",
      controls: "actionBar",
      officials: "officialsIntelligence",
      official: "officialsIntelligence",
      referees: "officialsIntelligence",
      referee: "officialsIntelligence",
      officialsIntelligence: "officialsIntelligence",
      operationsHealth: "matchdayGuidance",
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
      return {
        id: "actionBar",
        workspace: navigationTarget.workspace || "fixtures",
      };
    }

    const byCard = sectionId
      ? sections.find((section) => section.id === sectionId)
      : null;
    if (byCard) return byCard;

    if (navigationTarget.workspace) {
      return (
        sections.find(
          (section) => section.workspace === navigationTarget.workspace,
        ) || null
      );
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
    setOpenSections((current) => ({
      ...current,
      [navigationSection.id]: true,
    }));
    setHighlightedSection(navigationSection.id);

    window.setTimeout(() => {
      const element = document.getElementById(
        `matchday-section-${navigationSection.id}`,
      );
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
      acc[workspace.id] = sections.filter(
        (section) => section.workspace === workspace.id,
      ).length;
      return acc;
    }, {});
  }, [sections]);

  const visibleSections = useMemo(() => {
    const query = sectionQuery.trim().toLowerCase();

    return sections.filter((section) => {
      if (section.workspace !== activeWorkspace) return false;
      if (sectionFilter !== "all" && section.filter !== sectionFilter)
        return false;
      if (!query) return true;

      const haystack = [
        section.title,
        section.subtitle,
        section.badge,
        section.label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query) || fixtureSearchResults > 0;
    });
  }, [
    activeWorkspace,
    fixtureSearchResults,
    sectionFilter,
    sectionQuery,
    sections,
  ]);

  const activeWorkspaceMeta =
    WORKSPACES.find((workspace) => workspace.id === activeWorkspace) ||
    WORKSPACES[0];
  const workspaceSectionIds = sections
    .filter((section) => section.workspace === activeWorkspace)
    .map((section) => section.id);
  function shouldAutoExpandSection() {
    return false;
  }

  function isSectionOpen(section) {
    if (Object.prototype.hasOwnProperty.call(openSections, section.id)) {
      return Boolean(openSections[section.id]);
    }

    return shouldAutoExpandSection(section);
  }

  const allOpen =
    workspaceSectionIds.length > 0 &&
    sections
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
          runTest={runTest || (isSunday ? props.runSunTest : props.runSatTest)}
          runLive={runLive || (isSunday ? props.runSunLive : props.runSatLive)}
          saveWeek={props.saveWeek}
          allowArtificial={props.useAstro}
          setAllowArtificial={props.setUseAstro}
          isLocked={isLocked}
          onToggleLock={toggleScheduleLock}
          onPrint={props.onPrintReport}
          onPublish={props.onPublish}
          onOptimise={reviewOptimisation}
          optimisationCount={dayOptimisation.metrics?.validatedMoves || 0}
        />
      </div>

      {isLocked ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-950 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-black">Approved schedule locked</div>
            <div className="mt-1 text-xs font-bold text-emerald-800">
              Fixtures remain viewable and printable, but schedule edits and
              optimiser moves are disabled until you unlock the day.
            </div>
          </div>
          <button
            type="button"
            onClick={toggleScheduleLock}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-300 bg-white px-4 text-xs font-black text-emerald-800 transition hover:bg-emerald-100"
          >
            Unlock schedule
          </button>
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {WORKSPACES.map((workspace) => (
            <WorkspaceTab
              key={workspace.id}
              workspace={workspace}
              active={workspace.id === activeWorkspace}
              count={workspaceCounts[workspace.id] || 0}
              onClick={() => {
                if (typeof clearNavigationTarget === "function")
                  clearNavigationTarget();
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
            <p className="mt-1 text-sm font-bold text-slate-500">
              {activeWorkspaceMeta.description}
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
            <div className="relative min-w-0 lg:w-80">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
                strokeWidth={2.5}
              />
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
              <ChevronRight
                size={16}
                strokeWidth={2.5}
                className={`transition ${allOpen ? "rotate-90" : ""}`}
              />
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
        onOverride={editableOverride}
        readOnly={isLocked}
        onClose={() => setSelectedFixtureIndex(null)}
      />

      <ConfirmDialog
        open={pendingConfirmation?.type === "lock"}
        eyebrow="Schedule approval"
        title={`Lock ${day} schedule?`}
        description="The plan will become read only until it is unlocked. Existing warnings stay visible so they can still be monitored and followed up."
        confirmLabel="Lock schedule"
        cancelLabel="Keep editing"
        tone="warning"
        initialFocus="cancel"
        onCancel={() => setPendingConfirmation(null)}
        onConfirm={lockSchedule}
      >
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
            Outstanding checks
          </div>
          <ul className="mt-2 space-y-1.5 text-sm font-bold text-amber-950">
            {(pendingConfirmation?.issues || []).map((issue) => (
              <li key={issue} className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={pendingConfirmation?.type === "timeline-warning"}
        eyebrow="Operational warning"
        title="Apply this timeline move?"
        description={pendingConfirmation?.candidate?.message || "The move is possible, but it creates an operational warning that must be reviewed before publication."}
        confirmLabel="Apply move"
        cancelLabel="Choose another slot"
        tone="warning"
        initialFocus="cancel"
        onCancel={() => setPendingConfirmation(null)}
        onConfirm={() => applyTimelineMove(pendingConfirmation?.candidate)}
      >
        {pendingConfirmation?.candidate ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Proposed move</div>
            <div className="mt-2 text-sm font-black text-amber-950">
              {getTimelineCandidateSummary(pendingConfirmation.candidate)}
            </div>
            <div className="mt-2 text-xs font-bold leading-5 text-amber-800">
              The fixture can be moved, but Ground Control will keep the warning visible until the operating plan is resolved.
            </div>
          </div>
        ) : null}
      </ConfirmDialog>


      <ConfirmDialog
        open={pendingConfirmation?.type === "timeline-discard"}
        eyebrow="Discard draft changes"
        title={`Discard ${pendingConfirmation?.count || 0} planner change${pendingConfirmation?.count === 1 ? "" : "s"}?`}
        description="Ground Control will restore every affected fixture to the last saved pitch and kick-off time. This action cannot be redone after the draft is cleared."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        tone="danger"
        initialFocus="cancel"
        onCancel={() => setPendingConfirmation(null)}
        onConfirm={() => {
          discardTimelineChanges();
          setPendingConfirmation(null);
        }}
      />

      <ConfirmDialog
        open={pendingConfirmation?.type === "optimise"}
        eyebrow="Validated improvements"
        title={`Apply ${pendingConfirmation?.count || 0} schedule improvement${pendingConfirmation?.count === 1 ? "" : "s"}?`}
        description="Ground Control will update the affected fixtures now. The day remains unlocked, so you can review the final schedule and adjust it afterwards."
        confirmLabel={`Apply ${pendingConfirmation?.count || 0} move${pendingConfirmation?.count === 1 ? "" : "s"}`}
        cancelLabel="Review first"
        tone="success"
        onCancel={() => setPendingConfirmation(null)}
        onConfirm={applyAllValidatedMoves}
      />
    </div>
  );
}
