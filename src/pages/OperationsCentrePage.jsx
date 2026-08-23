import { tenantGetJson, tenantSetJson } from "../lib/storage/tenantStorage.js";
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Ambulance,
  ArrowRight,
  CalendarClock,
  Car,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  CloudSun,
  DoorOpen,
  FlagTriangleRight,
  HeartPulse,
  Megaphone,
  Plus,
  RadioTower,
  RotateCcw,
  ShieldCheck,
  Siren,
  Toilet,
  UsersRound,
  Utensils,
  X,
} from "lucide-react";
import { buildOperationsCentreSnapshot } from "../lib/engines/operationsCentreEngine.js";
import { decorateFixtureDay, MATCHDAY_SCOPES } from "../lib/domain/matchdayScope.js";
import { getCurrentMatchWeekend } from "../lib/date/weekendCalendar.js";
import useLiveWeather from "../hooks/useLiveWeather.js";
import { calculateWeatherIntelligence } from "../lib/engines/weatherIntelligenceEngine.js";

const DEFAULT_SITE_CHECKS = [
  { id: "access", label: "Ground access and gates open", icon: DoorOpen, critical: true },
  { id: "safeguarding", label: "Safeguarding lead confirmed", icon: ShieldCheck, critical: true },
  { id: "medical", label: "First-aid cover and equipment ready", icon: HeartPulse, critical: true },
  { id: "volunteers", label: "Matchday volunteers briefed", icon: UsersRound, critical: false },
  { id: "toilets", label: "Toilets checked and accessible", icon: Toilet, critical: false },
  { id: "cafe", label: "Cafe or refreshments readiness checked", icon: Utensils, critical: false },
];

const DOMAIN_ICONS = {
  fixtures: CalendarClock,
  pitches: FlagTriangleRight,
  parking: Car,
  officials: UsersRound,
  weather: CloudSun,
  communications: Megaphone,
  site: ClipboardCheck,
  incidents: Siren,
};

const STATUS_STYLES = {
  success: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    icon: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    border: "hover:border-emerald-200",
    label: "Ready",
  },
  warning: {
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
    icon: "bg-amber-50 text-amber-700 ring-amber-100",
    border: "hover:border-amber-200",
    label: "Review",
  },
  danger: {
    badge: "border-rose-200 bg-rose-50 text-rose-700",
    dot: "bg-rose-500",
    icon: "bg-rose-50 text-rose-700 ring-rose-100",
    border: "hover:border-rose-200",
    label: "Action",
  },
  neutral: {
    badge: "border-slate-200 bg-slate-50 text-slate-600",
    dot: "bg-slate-400",
    icon: "bg-slate-100 text-slate-600 ring-slate-200",
    border: "hover:border-slate-300",
    label: "Pending",
  },
};

const PRIORITY_STYLES = {
  critical: "border-rose-200 bg-rose-50 text-rose-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  normal: "border-slate-200 bg-slate-50 text-slate-700",
};

const HERO_STATUS_STYLES = {
  danger: "border-rose-300/30 bg-rose-300/10 text-rose-200",
  warning: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  success: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
};

const SCOPE_PRESENTATION = {
  [MATCHDAY_SCOPES.MATCHWEEK]: { title: "Matchweek Operations", noun: "matchweek" },
  [MATCHDAY_SCOPES.WEEKEND]: { title: "Weekend Operations", noun: "weekend" },
  [MATCHDAY_SCOPES.MIDWEEK]: { title: "Midweek Operations", noun: "midweek" },
  [MATCHDAY_SCOPES.SATURDAY]: { title: "Saturday Operations", noun: "Saturday plan" },
  [MATCHDAY_SCOPES.SUNDAY]: { title: "Sunday Operations", noun: "Sunday plan" },
};

function storageKey(club = {}) {
  const identity = club.id || club.slug || club.name || "default";
  return `operationsCentre:${String(identity).toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
}

function loadStoredState(key) {
  return tenantGetJson(key, null);
}

function formatClock(date) {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date) {
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function formatIncidentTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function scopeFixtures({ scope, satFinal, sunFinal, midweekFinal, satHasRun, sunHasRun, midweekHasRun }) {
  const saturday = satHasRun ? decorateFixtureDay(satFinal, MATCHDAY_SCOPES.SATURDAY) : [];
  const sunday = sunHasRun ? decorateFixtureDay(sunFinal, MATCHDAY_SCOPES.SUNDAY) : [];
  const midweek = midweekHasRun ? decorateFixtureDay(midweekFinal, MATCHDAY_SCOPES.MIDWEEK) : [];
  if (scope === MATCHDAY_SCOPES.SATURDAY) return saturday;
  if (scope === MATCHDAY_SCOPES.SUNDAY) return sunday;
  if (scope === MATCHDAY_SCOPES.MIDWEEK) return midweek;
  if (scope === MATCHDAY_SCOPES.MATCHWEEK) return [...midweek, ...saturday, ...sunday];
  return [...saturday, ...sunday];
}

function WeekendCalendarControl({
  satDate,
  satDateLabel,
  sunDateLabel,
  isCurrentWeekend,
  onWeekendChange,
  onUseCurrentWeekend,
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
      <label className="flex min-w-0 flex-1 flex-col gap-3 rounded-2xl bg-slate-50 p-3 sm:flex-row sm:items-center">
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200">
            <CalendarClock size={18} />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Match weekend
            </span>
            <span className="mt-0.5 block truncate text-sm font-black text-slate-800">
              {satDateLabel} — {sunDateLabel}
            </span>
          </span>
        </span>
        <input
          type="date"
          value={satDate}
          onChange={(event) => onWeekendChange?.(event.target.value)}
          aria-label="Select match weekend"
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-[150px]"
        />
      </label>

      {isCurrentWeekend ? (
        <span className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 px-4 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
          Current weekend
        </span>
      ) : (
        <button
          type="button"
          onClick={onUseCurrentWeekend}
          className="h-10 shrink-0 rounded-xl bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800"
        >
          Use current weekend
        </button>
      )}
    </div>
  );
}

function MidweekCalendarControl({
  midweekDate,
  midweekDateLabel,
  onMidweekChange,
  onUseCurrentMidweekDate,
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
      <label className="flex min-w-0 flex-1 flex-col gap-3 rounded-2xl bg-slate-50 p-3 sm:flex-row sm:items-center">
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-cyan-700 shadow-sm ring-1 ring-slate-200">
            <CalendarClock size={18} />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Midweek fixture date
            </span>
            <span className="mt-0.5 block truncate text-sm font-black text-slate-800">
              {midweekDateLabel}
            </span>
          </span>
        </span>
        <input
          type="date"
          value={midweekDate}
          onChange={(event) => onMidweekChange?.(event.target.value)}
          aria-label="Select midweek fixture date"
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 sm:w-[150px]"
        />
      </label>

      <button
        type="button"
        onClick={onUseCurrentMidweekDate}
        className="h-10 shrink-0 rounded-xl bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800"
      >
        Use current weekday
      </button>
    </div>
  );
}

export default function OperationsCentrePage({
  club = {},
  pitchCfg = [],
  closedPitches = [],
  refs = [],
  satFinal = [],
  sunFinal = [],
  midweekFinal = [],
  satHasRun = false,
  sunHasRun = false,
  midweekHasRun = false,
  midweekEnabled = true,
  satUnresolved = [],
  sunUnresolved = [],
  midweekUnresolved = [],
  satConflicts = [],
  midweekConflicts = [],
  satDate = "",
  sunDate = "",
  midweekDate = "",
  satDateLabel = "Saturday",
  sunDateLabel = "Sunday",
  midweekDateLabel = "Midweek",
  onWeekendChange,
  onUseCurrentWeekend,
  onMidweekChange,
  onUseCurrentMidweekDate,
  onOpenArea,
  onOpenTimeline,
}) {
  const key = storageKey(club);
  const stored = loadStoredState(key);
  const [scope, setScope] = useState(() =>
    midweekEnabled ? MATCHDAY_SCOPES.MATCHWEEK : MATCHDAY_SCOPES.WEEKEND
  );
  const [now, setNow] = useState(() => new Date());
  const [checks, setChecks] = useState(() => {
    const completed = stored?.checks || {};
    return DEFAULT_SITE_CHECKS.map((item) => ({ ...item, complete: Boolean(completed[item.id]) }));
  });
  const [incidents, setIncidents] = useState(() => (Array.isArray(stored?.incidents) ? stored.incidents : []));
  const [incidentText, setIncidentText] = useState("");
  const [incidentSeverity, setIncidentSeverity] = useState("warning");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!midweekEnabled && [MATCHDAY_SCOPES.MATCHWEEK, MATCHDAY_SCOPES.MIDWEEK].includes(scope)) {
      setScope(MATCHDAY_SCOPES.WEEKEND);
    }
  }, [midweekEnabled, scope]);

  useEffect(() => {
    const completed = checks.reduce((map, item) => ({ ...map, [item.id]: item.complete }), {});
    tenantSetJson(key, { checks: completed, incidents });
  }, [checks, incidents, key]);

  const fixtures = useMemo(
    () => scopeFixtures({ scope, satFinal, sunFinal, midweekFinal, satHasRun, sunHasRun, midweekHasRun }),
    [scope, satFinal, sunFinal, midweekFinal, satHasRun, sunHasRun, midweekHasRun]
  );

  const scheduleBuilt =
    scope === MATCHDAY_SCOPES.SATURDAY
      ? satHasRun
      : scope === MATCHDAY_SCOPES.SUNDAY
        ? sunHasRun
        : scope === MATCHDAY_SCOPES.MIDWEEK
          ? midweekHasRun
          : scope === MATCHDAY_SCOPES.MATCHWEEK
            ? satHasRun || sunHasRun || midweekHasRun
            : satHasRun || sunHasRun;

  const unresolvedCount =
    scope === MATCHDAY_SCOPES.SATURDAY
      ? satUnresolved.length
      : scope === MATCHDAY_SCOPES.SUNDAY
        ? sunUnresolved.length
        : scope === MATCHDAY_SCOPES.MIDWEEK
          ? midweekUnresolved.length
          : scope === MATCHDAY_SCOPES.MATCHWEEK
            ? satUnresolved.length + sunUnresolved.length + midweekUnresolved.length
            : satUnresolved.length + sunUnresolved.length;

  const conflictCount =
    scope === MATCHDAY_SCOPES.SUNDAY
      ? 0
      : scope === MATCHDAY_SCOPES.MIDWEEK
        ? midweekConflicts.length
        : scope === MATCHDAY_SCOPES.MATCHWEEK
          ? satConflicts.length + midweekConflicts.length
          : satConflicts.length;
  const dateLabel =
    scope === MATCHDAY_SCOPES.SATURDAY
      ? satDateLabel
      : scope === MATCHDAY_SCOPES.SUNDAY
        ? sunDateLabel
        : scope === MATCHDAY_SCOPES.MIDWEEK
          ? midweekDateLabel
          : scope === MATCHDAY_SCOPES.MATCHWEEK
            ? `${midweekDateLabel} / ${satDateLabel} / ${sunDateLabel}`
            : `${satDateLabel} / ${sunDateLabel}`;

  const currentWeekend = useMemo(() => getCurrentMatchWeekend(now), [now]);
  const isCurrentWeekend =
    satDate === currentWeekend.saturday && sunDate === currentWeekend.sunday;

  const weatherSelection = useMemo(() => {
    const candidates = [];
    const add = (label, date, rows, enabled) => {
      if (!enabled || !date) return;
      candidates.push({
        label,
        date,
        fixtures: (rows || []).filter((fixture) => fixture?.status !== "postponed"),
      });
    };

    if (scope === MATCHDAY_SCOPES.SATURDAY) add("Saturday", satDate, satFinal, satHasRun);
    else if (scope === MATCHDAY_SCOPES.SUNDAY) add("Sunday", sunDate, sunFinal, sunHasRun);
    else if (scope === MATCHDAY_SCOPES.MIDWEEK) add("Midweek", midweekDate, midweekFinal, midweekHasRun);
    else {
      if (scope === MATCHDAY_SCOPES.MATCHWEEK) add("Midweek", midweekDate, midweekFinal, midweekHasRun);
      add("Saturday", satDate, satFinal, satHasRun);
      add("Sunday", sunDate, sunFinal, sunHasRun);
    }

    candidates.sort((left, right) => String(left.date).localeCompare(String(right.date)));
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
    return candidates.find((candidate) => candidate.date >= today)
      || candidates.at(-1)
      || { label: "Matchday", date: satDate || sunDate || midweekDate, fixtures };
  }, [fixtures, midweekDate, midweekFinal, midweekHasRun, satDate, satFinal, satHasRun, scope, sunDate, sunFinal, sunHasRun]);

  const liveWeather = useLiveWeather({
    club,
    date: weatherSelection.date,
    fixtures: weatherSelection.fixtures,
  });

  const weatherIntelligence = useMemo(() => calculateWeatherIntelligence({
    club,
    fixtures: weatherSelection.fixtures,
    dateLabel: `${weatherSelection.label}${weatherSelection.date ? ` · ${weatherSelection.date}` : ""}`,
    forecastSource: liveWeather.data,
    connectionStatus: liveWeather.status,
    connectionError: liveWeather.error,
  }), [club, liveWeather.data, liveWeather.error, liveWeather.status, weatherSelection]);

  const snapshot = useMemo(
    () =>
      buildOperationsCentreSnapshot({
        fixtures,
        club,
        pitchCfg,
        closedPitches,
        refs,
        scheduleBuilt,
        unresolvedCount,
        conflictCount,
        siteChecks: checks,
        incidents,
        scope,
        dateLabel,
        weatherSnapshot: weatherIntelligence,
      }),
    [fixtures, club, pitchCfg, closedPitches, refs, scheduleBuilt, unresolvedCount, conflictCount, checks, incidents, scope, dateLabel, weatherIntelligence]
  );

  const toggleCheck = (id) => {
    setChecks((current) => current.map((item) => (item.id === id ? { ...item, complete: !item.complete } : item)));
  };

  const resetChecks = () => {
    setChecks((current) => current.map((item) => ({ ...item, complete: false })));
  };

  const addIncident = (event) => {
    event.preventDefault();
    const title = incidentText.trim();
    if (!title) return;

    setIncidents((current) => [
      {
        id: `incident-${Date.now()}`,
        title,
        severity: incidentSeverity,
        createdAt: new Date().toISOString(),
        resolved: false,
      },
      ...current,
    ]);
    setIncidentText("");
    setIncidentSeverity("warning");
  };

  const resolveIncident = (id) => {
    setIncidents((current) => current.map((item) => (item.id === id ? { ...item, resolved: true, resolvedAt: new Date().toISOString() } : item)));
  };

  const removeIncident = (id) => {
    setIncidents((current) => current.filter((item) => item.id !== id));
  };

  const openTarget = (target) => {
    if (target === "priorityQueue") {
      document.getElementById("operations-centre-priority-actions")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (target === "siteChecks") {
      document.getElementById("operations-centre-site-checks")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (target === "incidents") {
      document.getElementById("operations-centre-incidents")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const targetDay =
      scope === MATCHDAY_SCOPES.SUNDAY
        ? "sunday"
        : scope === MATCHDAY_SCOPES.MIDWEEK
          ? "midweek"
          : "saturday";
    onOpenArea?.(target, targetDay);
  };

  const scopePresentation = SCOPE_PRESENTATION[scope] || SCOPE_PRESENTATION[MATCHDAY_SCOPES.WEEKEND];
  const heroStatusClass = HERO_STATUS_STYLES[snapshot.status] || HERO_STATUS_STYLES.warning;
  const HeroStatusIcon = snapshot.status === "success" ? CheckCircle2 : AlertTriangle;
  const openActionCount = snapshot.metrics.openActions;
  const criticalIncidentCount = snapshot.metrics.criticalIncidents;
  const heroSummary = !scheduleBuilt
    ? `Build the ${scopePresentation.noun} schedule to activate live operational control.`
    : criticalIncidentCount > 0
      ? `${criticalIncidentCount} critical incident${criticalIncidentCount === 1 ? " requires" : "s require"} immediate attention.`
      : openActionCount > 0
        ? `${openActionCount} item${openActionCount === 1 ? " needs" : "s need"} attention in the selected ${scopePresentation.noun}.`
        : `No open operational actions in the selected ${scopePresentation.noun}.`;

  const primaryAction = !scheduleBuilt
    ? { label: `Build ${scopePresentation.noun} schedule`, target: "actionBar" }
    : criticalIncidentCount > 0
      ? {
          label: `Review ${criticalIncidentCount} critical incident${criticalIncidentCount === 1 ? "" : "s"}`,
          target: "incidents",
        }
      : openActionCount > 0
        ? { label: `Review ${openActionCount} action${openActionCount === 1 ? "" : "s"}`, target: "priorityQueue" }
        : { label: "Open command timeline", target: "timeline" };

  const runPrimaryAction = () => {
    if (primaryAction.target === "timeline") {
      onOpenTimeline?.();
      return;
    }
    openTarget(primaryAction.target);
  };

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[30px] border border-slate-800 bg-[#07101f] text-white shadow-xl shadow-slate-950/10">
        <div className="absolute -right-20 -top-28 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative p-6 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] ${heroStatusClass}`}>
                  <HeroStatusIcon size={14} />
                  {snapshot.label}
                </span>
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
                  Operations overview
                </span>
              </div>

              <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                {scopePresentation.title}
              </h2>
              <p className="mt-2 text-sm font-black text-slate-300 sm:text-base">{dateLabel}</p>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-400">
                {heroSummary}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-300/10 text-emerald-300">
                <RadioTower size={18} />
              </span>
              <span>
                <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Live control clock</span>
                <span className="mt-0.5 block text-lg font-black text-white">{formatClock(now)}</span>
                <span className="block text-[11px] font-bold text-slate-400">{formatDate(now)}</span>
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <HeroMetric label="Operational readiness" value={`${snapshot.score}%`} detail={snapshot.label} />
            <HeroMetric label="Fixtures" value={snapshot.metrics.fixtures} detail={`${snapshot.metrics.postponed} postponed`} />
            <HeroMetric
              label="Open actions"
              value={snapshot.metrics.openActions}
              detail={snapshot.metrics.openActions ? "Priority queue" : "Queue clear"}
            />
            <HeroMetric
              label="Critical incidents"
              value={snapshot.metrics.criticalIncidents}
              detail={snapshot.metrics.openIncidents ? `${snapshot.metrics.openIncidents} total open` : "No critical incidents"}
            />
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs font-bold leading-5 text-slate-400">
              {snapshot.metrics.openActions
                ? `${snapshot.metrics.openActions} prioritised action${snapshot.metrics.openActions === 1 ? "" : "s"} in the control queue.`
                : "The control queue is clear for this scope."}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={runPrimaryAction}
                className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-emerald-300 px-5 text-sm font-black text-slate-950 transition hover:bg-emerald-200"
              >
                {primaryAction.label}
                <ArrowRight size={16} />
              </button>
              {primaryAction.target !== "timeline" && (
                <button
                  type="button"
                  onClick={onOpenTimeline}
                  className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-black text-slate-200 transition hover:bg-white/[0.1] hover:text-white"
                >
                  Open timeline
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Operations scope and dates" className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1 rounded-2xl bg-slate-100 p-1">
            {[
              ...(midweekEnabled ? [[MATCHDAY_SCOPES.MATCHWEEK, "Matchweek"]] : []),
              [MATCHDAY_SCOPES.WEEKEND, "Weekend"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setScope(value)}
                className={`min-w-[92px] flex-1 rounded-xl px-4 py-2.5 text-xs font-black transition sm:flex-none ${
                  scope === value
                    ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-500 hover:bg-white/70 hover:text-slate-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className={`grid gap-3 border-t border-slate-100 pt-3 ${scope === MATCHDAY_SCOPES.MATCHWEEK ? "xl:grid-cols-2" : ""}`}>
            {scope === MATCHDAY_SCOPES.MATCHWEEK && midweekEnabled && (
              <MidweekCalendarControl
                midweekDate={midweekDate}
                midweekDateLabel={midweekDateLabel}
                onMidweekChange={onMidweekChange}
                onUseCurrentMidweekDate={onUseCurrentMidweekDate}
              />
            )}

            <WeekendCalendarControl
              satDate={satDate}
              satDateLabel={satDateLabel}
              sunDateLabel={sunDateLabel}
              isCurrentWeekend={isCurrentWeekend}
              onWeekendChange={onWeekendChange}
              onUseCurrentWeekend={onUseCurrentWeekend}
            />
          </div>
        </div>
      </section>

      {!scheduleBuilt && (
        <section className="flex flex-col gap-4 rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle size={21} className="mt-0.5 shrink-0 text-amber-700" />
            <div>
              <h3 className="text-sm font-black text-amber-900">The selected matchday is not scheduled yet</h3>
              <p className="mt-1 text-sm font-semibold leading-6 text-amber-800/80">
                Build a schedule to activate fixture waves, capacity pressure and live operational guidance.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openTarget("actionBar")}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-amber-900 px-4 py-2.5 text-sm font-black text-white transition hover:bg-amber-800"
          >
            Build schedule
            <ArrowRight size={16} />
          </button>
        </section>
      )}

      <section>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700">Operating picture</div>
            <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Live control matrix</h3>
          </div>
          <p className="max-w-xl text-sm font-semibold leading-6 text-slate-500">
            Each area reports its current readiness and opens the exact workspace needed to take action.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {snapshot.domains.map((item) => (
            <DomainCard key={item.id} domain={item} onOpen={() => openTarget(item.target)} />
          ))}
        </div>
      </section>

      <section id="operations-centre-priority-actions" className="grid scroll-mt-6 gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-rose-600">Control queue</div>
              <h3 className="mt-1 text-xl font-black text-slate-950">Priority actions</h3>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                The most important matchday interventions, ordered by operational risk.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">{snapshot.priorityQueue.length} action area{snapshot.priorityQueue.length === 1 ? "" : "s"}</span>
              {snapshot.metrics.blockingItems ? <span className="rounded-full bg-rose-100 px-3 py-1.5 text-xs font-black text-rose-700">{snapshot.metrics.blockingItems} blocking</span> : null}
              {snapshot.metrics.warningItems ? <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-700">{snapshot.metrics.warningItems} warning{snapshot.metrics.warningItems === 1 ? "" : "s"}</span> : null}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {snapshot.priorityQueue.length ? (
              snapshot.priorityQueue.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openTarget(item.target)}
                  className={`group flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${PRIORITY_STYLES[item.priority]}`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70 text-sm font-black shadow-sm">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">{item.domain}</div>
                    <div className="mt-1 text-sm font-black">{item.title}</div>
                    <div className="mt-1 text-xs font-semibold leading-5 opacity-75">{item.detail}</div>
                  </div>
                  <ChevronRight size={18} className="mt-2 shrink-0 opacity-50 transition group-hover:translate-x-1" />
                </button>
              ))
            ) : (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                <CheckCircle2 size={28} className="mx-auto text-emerald-600" />
                <h4 className="mt-3 text-base font-black text-emerald-900">No urgent actions</h4>
                <p className="mt-1 text-sm font-semibold text-emerald-700">The current operating picture has no warning or critical domains.</p>
              </div>
            )}
          </div>
        </div>

        <div id="operations-centre-site-checks" className="scroll-mt-28 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-700">People and site</div>
              <h3 className="mt-1 text-xl font-black text-slate-950">Readiness checks</h3>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">Manual confirmations for the live site team.</p>
            </div>
            <button
              type="button"
              onClick={resetChecks}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          </div>

          <div className="mt-5 space-y-2.5">
            {checks.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleCheck(item.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
                    item.complete
                      ? "border-emerald-200 bg-emerald-50"
                      : item.critical
                        ? "border-rose-100 bg-rose-50/60 hover:border-rose-200"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.complete ? "bg-emerald-600 text-white" : "bg-white text-slate-500 shadow-sm"}`}>
                    {item.complete ? <Check size={17} strokeWidth={3} /> : <Icon size={17} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-black ${item.complete ? "text-emerald-900" : "text-slate-800"}`}>{item.label}</span>
                    <span className={`mt-0.5 block text-[11px] font-bold ${item.complete ? "text-emerald-700" : item.critical ? "text-rose-600" : "text-slate-400"}`}>
                      {item.complete ? "Confirmed" : item.critical ? "Critical check" : "Operational check"}
                    </span>
                  </span>
                  <span className={`h-3 w-3 rounded-full ${item.complete ? "bg-emerald-500" : item.critical ? "bg-rose-400" : "bg-slate-300"}`} />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-violet-700">Matchday sequence</div>
              <h3 className="mt-1 text-xl font-black text-slate-950">Fixture waves</h3>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">Kick-off groups that drive arrivals, officials and pitch turnover.</p>
            </div>
            <button
              type="button"
              onClick={onOpenTimeline}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
            >
              Full timeline
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {snapshot.waves.length ? (
              snapshot.waves.slice(0, 6).map((wave) => (
                <div key={wave.id} className="grid grid-cols-[78px_1fr] gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <div className="text-xl font-black text-slate-950">{wave.time}</div>
                    <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{wave.day}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                        {wave.fixtures.length} fixture{wave.fixtures.length === 1 ? "" : "s"}
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-200">
                        {wave.pitches.length} pitch{wave.pitches.length === 1 ? "" : "es"}
                      </span>
                      {wave.officialsOutstanding > 0 && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800">
                          {wave.officialsOutstanding} official check{wave.officialsOutstanding === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {wave.fixtures.slice(0, 3).map((fixture) => (
                        <div key={fixture.id} className="flex items-center justify-between gap-3 text-xs font-bold text-slate-600">
                          <span className="truncate">{fixture.label}</span>
                          <span className="shrink-0 text-slate-400">{fixture.pitch}</span>
                        </div>
                      ))}
                      {wave.fixtures.length > 3 && <div className="text-xs font-black text-slate-400">+{wave.fixtures.length - 3} more fixtures</div>}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <CalendarClock size={28} className="mx-auto text-slate-400" />
                <h4 className="mt-3 text-base font-black text-slate-800">No fixture waves yet</h4>
                <p className="mt-1 text-sm font-semibold text-slate-500">Build the selected schedule to populate the live sequence.</p>
              </div>
            )}
          </div>
        </div>

        <div id="operations-centre-incidents" className="scroll-mt-28 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-rose-600">Live record</div>
            <h3 className="mt-1 text-xl font-black text-slate-950">Incident log</h3>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">Record operational issues and visibly close them when controlled.</p>
          </div>

          <form onSubmit={addIncident} className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <input
              value={incidentText}
              onChange={(event) => setIncidentText(event.target.value)}
              placeholder="Describe the incident…"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
            />
            <div className="mt-2 flex gap-2">
              <select
                value={incidentSeverity}
                onChange={(event) => setIncidentSeverity(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-700 outline-none focus:border-slate-400"
              >
                <option value="warning">Operational issue</option>
                <option value="critical">Critical incident</option>
                <option value="info">Information only</option>
              </select>
              <button
                type="submit"
                disabled={!incidentText.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus size={15} />
                Log
              </button>
            </div>
          </form>

          <div className="mt-4 max-h-[470px] space-y-2.5 overflow-y-auto pr-1">
            {incidents.length ? (
              incidents.map((incident) => (
                <div
                  key={incident.id}
                  className={`rounded-2xl border p-3.5 ${
                    incident.resolved
                      ? "border-slate-200 bg-slate-50 opacity-65"
                      : incident.severity === "critical"
                        ? "border-rose-200 bg-rose-50"
                        : incident.severity === "warning"
                          ? "border-amber-200 bg-amber-50"
                          : "border-sky-200 bg-sky-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${incident.resolved ? "bg-slate-400" : incident.severity === "critical" ? "bg-rose-500" : incident.severity === "warning" ? "bg-amber-500" : "bg-sky-500"}`} />
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-black ${incident.resolved ? "line-through text-slate-500" : "text-slate-900"}`}>{incident.title}</div>
                      <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        {formatIncidentTime(incident.createdAt)} · {incident.resolved ? "Resolved" : incident.severity}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {!incident.resolved && (
                        <button
                          type="button"
                          onClick={() => resolveIncident(incident.id)}
                          title="Resolve incident"
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-sm transition hover:bg-emerald-100"
                        >
                          <Check size={15} strokeWidth={3} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeIncident(incident.id)}
                        title="Remove incident"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm transition hover:bg-slate-200 hover:text-slate-700"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-7 text-center">
                <ShieldCheck size={28} className="mx-auto text-emerald-600" />
                <h4 className="mt-3 text-base font-black text-emerald-900">Incident log clear</h4>
                <p className="mt-1 text-sm font-semibold text-emerald-700">No matchday incidents have been recorded.</p>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-100 p-3 text-xs font-semibold leading-5 text-slate-500">
            <Ambulance size={16} className="mt-0.5 shrink-0" />
            This is an operational log, not a replacement for emergency services, safeguarding procedures or formal accident reporting.
          </div>
        </div>
      </section>
    </div>
  );
}

function HeroMetric({ label, value, detail }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3.5 backdrop-blur-sm">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1.5 text-2xl font-black text-white">{value}</div>
      <div className="mt-1 truncate text-[11px] font-bold text-slate-400">{detail}</div>
    </div>
  );
}

function DomainCard({ domain, onOpen }) {
  const style = STATUS_STYLES[domain.status] || STATUS_STYLES.neutral;
  const Icon = DOMAIN_ICONS[domain.id] || RadioTower;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group flex min-h-[230px] flex-col rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${style.border}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ${style.icon}`}>
          <Icon size={21} strokeWidth={2.4} />
        </span>
        <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${style.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
          {style.label}
        </span>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{domain.label}</div>
        <div className="text-xl font-black text-slate-950">{domain.metric}</div>
      </div>
      <h4 className="mt-2 text-base font-black leading-6 text-slate-950">{domain.headline}</h4>
      <p className="mt-1.5 line-clamp-3 text-xs font-semibold leading-5 text-slate-500">{domain.detail}</p>

      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-black text-slate-500">
        <span>{domain.actionLabel}</span>
        <ArrowRight size={15} className="transition group-hover:translate-x-1 group-hover:text-slate-950" />
      </div>
    </button>
  );
}
