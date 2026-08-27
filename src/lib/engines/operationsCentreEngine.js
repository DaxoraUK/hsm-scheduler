import { getParkingSnapshot } from "./parkingEngine.js";
import { calculateOfficialsReadiness, getOfficialDisplayName, isFixtureOfficialConfirmed } from "./officialsEngine.js";
import { getWeatherSnapshot } from "./weatherEngine.js";
import { buildCoreOperationalReadiness } from "./operationalReadinessEngine.js";

const STATUS_WEIGHT = Object.freeze({
  danger: 0,
  warning: 1,
  success: 2,
  neutral: 3,
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clean(value) {
  return String(value || "").trim();
}

function isPostponed(fixture = {}) {
  return clean(fixture.status).toLowerCase() === "postponed";
}

function getFixtureTimeMinutes(fixture = {}) {
  const direct = [fixture.koMins, fixture.kickoffMins, fixture.startMins].find((value) => Number.isFinite(Number(value)));
  if (direct !== undefined) return Number(direct);

  const raw = fixture.ko || fixture.koTime || fixture.kickOff || fixture.kickoff || fixture.time;
  const match = String(raw || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatTime(minutes) {
  if (!Number.isFinite(Number(minutes))) return "TBC";
  const safe = Math.max(0, Number(minutes));
  const hours = Math.floor(safe / 60) % 24;
  const mins = Math.floor(safe % 60);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function fixtureDay(fixture = {}) {
  const value = clean(fixture.__day || fixture.day || fixture.matchday || fixture.fixtureDay).toLowerCase();
  if (value.includes("mid") || value.includes("week")) return "midweek";
  if (value.includes("sun")) return "sunday";
  return "saturday";
}

function fixtureLabel(fixture = {}) {
  const home = fixture.homeTeam || fixture.team || fixture.home || "Fixture";
  const away = fixture.awayTeam || fixture.opponent || fixture.away || "";
  return away ? `${home} vs ${away}` : home;
}

function pitchLabel(fixture = {}, pitchCfg = []) {
  const pitchId = fixture.pitchId || fixture.pitch || fixture.pitchName;
  const pitch = asArray(pitchCfg).find((item) => item.id === pitchId || item.name === pitchId);
  return pitch?.name || fixture.pitchName || fixture.pitch || fixture.pitchId || "Pitch TBC";
}

function statusScore(status) {
  if (status === "success") return 100;
  if (status === "warning") return 68;
  if (status === "danger") return 32;
  return 55;
}

function normaliseStatus(status) {
  if (["success", "warning", "danger", "neutral"].includes(status)) return status;
  return "neutral";
}

function domain({ id, label, status = "neutral", score, headline, detail, metric, actionLabel, target, data = null }) {
  const normalised = normaliseStatus(status);
  return {
    id,
    label,
    status: normalised,
    score: Number.isFinite(Number(score)) ? Math.max(0, Math.min(100, Math.round(Number(score)))) : statusScore(normalised),
    headline,
    detail,
    metric,
    actionLabel,
    target,
    data,
  };
}

function getParkingStatus(parking = {}) {
  if (parking.enabled === false) return "neutral";
  if (!parking.capacity) return "warning";
  if (parking.isOverCapacity || parking.utilisation > 100) return "danger";
  if (parking.isHighPressure || parking.isOverConcurrentLimit || parking.utilisation >= 85) return "warning";
  return "success";
}

function getPitchDomain({ pitchCfg = [], closedPitches = [] } = {}) {
  const total = asArray(pitchCfg).length;
  const closed = asArray(closedPitches).length;
  const available = Math.max(0, total - closed);
  const status = !total || (total > 0 && available === 0) ? "danger" : closed > 0 ? "warning" : "success";
  const score = !total ? 25 : Math.max(0, Math.round((available / total) * 100));

  return domain({
    id: "pitches",
    label: "Pitches",
    status,
    score,
    headline: !total ? "Pitch estate not configured" : closed ? `${closed} pitch${closed === 1 ? " is" : "es are"} closed` : "All configured pitches available",
    detail: !total
      ? "Add the club's pitches before using live matchday control."
      : `${available} of ${total} configured pitch${total === 1 ? "" : "es"} currently available.`,
    metric: total ? `${available}/${total}` : "Setup",
    actionLabel: "Open pitch control",
    target: "pitchClosures",
    data: { total, closed, available },
  });
}

function getFixtureDomain({ scheduleBuilt, activeFixtures, unresolvedCount, conflictCount } = {}) {
  const activeCount = asArray(activeFixtures).length;
  const issueCount = toNumber(unresolvedCount) + toNumber(conflictCount);
  const status = !scheduleBuilt ? "warning" : issueCount > 0 ? "danger" : "success";
  const score = !scheduleBuilt ? 55 : Math.max(0, 100 - toNumber(unresolvedCount) * 18 - toNumber(conflictCount) * 20);

  return domain({
    id: "fixtures",
    label: "Fixtures",
    status,
    score,
    headline: !scheduleBuilt
      ? "Schedule has not been built"
      : issueCount
        ? `${issueCount} fixture issue${issueCount === 1 ? " needs" : "s need"} action`
        : `${activeCount} active fixture${activeCount === 1 ? "" : "s"} controlled`,
    detail: !scheduleBuilt
      ? "Build Saturday or Sunday before switching the site into live control."
      : `${toNumber(unresolvedCount)} unresolved and ${toNumber(conflictCount)} detected clash${toNumber(conflictCount) === 1 ? "" : "es"}.`,
    metric: scheduleBuilt ? activeCount : "Draft",
    actionLabel: scheduleBuilt ? "Open fixture control" : "Build schedule",
    target: scheduleBuilt ? "schedule" : "actionBar",
    data: { activeCount, unresolvedCount: toNumber(unresolvedCount), conflictCount: toNumber(conflictCount) },
  });
}

function getCommunicationsDomain({ scheduleBuilt, activeFixtures } = {}) {
  const count = asArray(activeFixtures).length;
  const status = scheduleBuilt && count > 0 ? "warning" : "neutral";

  return domain({
    id: "communications",
    label: "Communications",
    status,
    score: scheduleBuilt && count > 0 ? 78 : 45,
    headline: scheduleBuilt && count > 0 ? "Matchday messages ready to prepare" : "Waiting for a built schedule",
    detail: scheduleBuilt && count > 0
      ? "Review and distribute coach messages before arrivals begin. Delivery tracking will be added in a later communications sprint."
      : "Coach and team communications become available after fixtures are scheduled.",
    metric: scheduleBuilt && count > 0 ? "Ready" : "Blocked",
    actionLabel: "Open communications",
    target: "coachMessages",
  });
}

function getSiteReadinessDomain(siteChecks = []) {
  const checks = asArray(siteChecks);
  const completed = checks.filter((item) => item.complete).length;
  const total = checks.length;
  const outstanding = Math.max(0, total - completed);
  const criticalOutstanding = checks.filter((item) => !item.complete && item.critical).length;
  const status = criticalOutstanding ? "danger" : outstanding ? "warning" : total ? "success" : "neutral";
  const score = total ? Math.round((completed / total) * 100) : 0;

  return domain({
    id: "site",
    label: "Site readiness",
    status,
    score,
    headline: total
      ? outstanding
        ? `${outstanding} site check${outstanding === 1 ? " remains" : "s remain"}`
        : "Site readiness confirmed"
      : "No site checks configured",
    detail: total
      ? `${completed} of ${total} operational checks confirmed${criticalOutstanding ? `, including ${criticalOutstanding} critical item${criticalOutstanding === 1 ? "" : "s"} still open` : ""}.`
      : "Add operational checks for safeguarding, medical cover, access and volunteers.",
    metric: total ? `${completed}/${total}` : "Setup",
    actionLabel: "Review site checks",
    target: "siteChecks",
    data: { completed, total, outstanding, criticalOutstanding },
  });
}

function getIncidentDomain(incidents = []) {
  const open = asArray(incidents).filter((item) => !item.resolved);
  const critical = open.filter((item) => item.severity === "critical").length;
  const status = critical ? "danger" : open.length ? "warning" : "success";
  const score = critical ? Math.max(0, 45 - critical * 10) : open.length ? Math.max(45, 85 - open.length * 8) : 100;

  return domain({
    id: "incidents",
    label: "Incidents",
    status,
    score,
    headline: open.length ? `${open.length} open incident${open.length === 1 ? "" : "s"}` : "No open incidents",
    detail: critical
      ? `${critical} critical incident${critical === 1 ? " requires" : "s require"} immediate control-room attention.`
      : open.length
        ? "Keep ownership and resolution status visible to the matchday team."
        : "The incident log is clear.",
    metric: open.length,
    actionLabel: open.length ? "Open incident log" : "Report incident",
    target: "incidents",
    data: { open: open.length, critical },
  });
}

function buildFixtureWaves(fixtures = [], pitchCfg = []) {
  const grouped = new Map();

  asArray(fixtures)
    .filter((fixture) => !isPostponed(fixture))
    .forEach((fixture, index) => {
      const day = fixtureDay(fixture);
      const minutes = getFixtureTimeMinutes(fixture);
      const key = `${day}-${minutes == null ? `tbc-${index}` : minutes}`;
      const existing = grouped.get(key) || {
        id: key,
        day,
        timeMins: minutes,
        time: formatTime(minutes),
        fixtures: [],
        pitches: new Set(),
        officialsOutstanding: 0,
      };

      existing.fixtures.push({
        id: fixture.id || fixture.fixtureId || `${key}-${index}`,
        label: fixtureLabel(fixture),
        pitch: pitchLabel(fixture, pitchCfg),
        official: getOfficialDisplayName(fixture),
        fixture,
      });
      existing.pitches.add(pitchLabel(fixture, pitchCfg));

      if (!isFixtureOfficialConfirmed(fixture)) {
        existing.officialsOutstanding += 1;
      }

      grouped.set(key, existing);
    });

  return [...grouped.values()]
    .map((wave) => ({ ...wave, pitches: [...wave.pitches] }))
    .sort((a, b) => {
      const order = { midweek: 0, saturday: 1, sunday: 2 };
      if (a.day !== b.day) return (order[a.day] ?? 9) - (order[b.day] ?? 9);
      return (a.timeMins ?? Number.MAX_SAFE_INTEGER) - (b.timeMins ?? Number.MAX_SAFE_INTEGER);
    });
}

function priorityFromStatus(status) {
  if (status === "danger") return "critical";
  if (status === "warning") return "warning";
  return "normal";
}

function buildPriorityQueue(domains = []) {
  return asArray(domains)
    .filter((item) => item.status === "danger" || item.status === "warning")
    .sort((a, b) => {
      if (STATUS_WEIGHT[a.status] !== STATUS_WEIGHT[b.status]) return STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status];
      return a.score - b.score;
    })
    .map((item) => ({
      id: `priority-${item.id}`,
      domain: item.label,
      priority: priorityFromStatus(item.status),
      title: item.headline,
      detail: item.detail,
      target: item.target,
      actionLabel: item.actionLabel,
    }));
}

function overallStatus(domains = []) {
  const activeDomains = asArray(domains).filter((item) => item.status !== "neutral");
  const hasDanger = activeDomains.some((item) => item.status === "danger");
  const hasWarning = activeDomains.some((item) => item.status === "warning");
  const score = activeDomains.length
    ? Math.round(activeDomains.reduce((total, item) => total + item.score, 0) / activeDomains.length)
    : 0;

  if (hasDanger || score < 60) return { status: "danger", label: "Action required", score };
  if (hasWarning || score < 88) return { status: "warning", label: "Control room active", score };
  return { status: "success", label: "Matchday controlled", score };
}

export function buildOperationsCentreSnapshot({
  fixtures = [],
  club = {},
  pitchCfg = [],
  closedPitches = [],
  refs = [],
  scheduleBuilt = false,
  unresolvedCount = 0,
  conflictCount = 0,
  siteChecks = [],
  incidents = [],
  scope = "weekend",
  dateLabel = "",
  weatherSnapshot = null,
} = {}) {
  const activeFixtures = asArray(fixtures).filter((fixture) => !isPostponed(fixture));
  const postponedFixtures = asArray(fixtures).filter(isPostponed);
  const parking = getParkingSnapshot({ fixtures: activeFixtures, club, pitchCfg, scope });
  const officials = calculateOfficialsReadiness({ fixtures: activeFixtures, active: activeFixtures, refs });
  const weather = weatherSnapshot || getWeatherSnapshot({ club, fixtures: activeFixtures, dateLabel });

  const fixtureDomain = getFixtureDomain({ scheduleBuilt, activeFixtures, unresolvedCount, conflictCount });
  const pitchDomain = getPitchDomain({ pitchCfg, closedPitches });
  const parkingDomain = domain({
    id: "parking",
    label: "Parking",
    status: getParkingStatus(parking),
    score: parking.healthScore,
    headline: !parking.capacity
      ? "Parking capacity not configured"
      : parking.peakCars
        ? `${parking.peakCars}/${parking.capacity} spaces at ${parking.peakTime}`
        : "No parking demand calculated",
    detail: !parking.capacity
      ? "Set the car park capacity before relying on live arrival control."
      : `${parking.utilisation}% predicted peak use${parking.detailScopeLabel ? ` — ${parking.detailScopeLabel}` : ""}.`,
    metric: parking.capacity ? `${parking.utilisation}%` : "Setup",
    actionLabel: "Open parking intelligence",
    target: "parkingIntelligence",
    data: parking,
  });
  const officialsDomain = domain({
    id: "officials",
    label: "Officials",
    status: officials.status,
    score: officials.score,
    headline: officials.label,
    detail: officials.summary,
    metric: `${officials.metrics.confirmed}/${officials.metrics.fixtures}`,
    actionLabel: "Open officials intelligence",
    target: "officialsIntelligence",
    data: officials,
  });
  const weatherProvider = weather.provider || "Live weather";
  const weatherUpdated = weather.updatedAt
    ? new Date(weather.updatedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })
    : "Not refreshed";
  const weatherConnection = String(weather.connectionStatus || "idle").replaceAll("_", " ");
  const weatherDomain = domain({
    id: "weather",
    label: "Weather",
    status: weather.status,
    score: weather.score,
    headline: weather.decision?.headline || weather.label,
    detail: `${weather.decision?.detail || "Weather readiness calculated."} ${weather.forecastAvailable ? `${weatherProvider} · refreshed ${weatherUpdated}.` : `Connection: ${weatherConnection}${weather.connectionError ? ` · ${weather.connectionError}` : ""}.`}`,
    metric: weather.forecastAvailable ? weather.overallRisk?.label || weather.label : weather.label || "Feed needed",
    actionLabel: "Open weather intelligence",
    target: "weatherIntelligence",
    data: weather,
  });
  const communicationsDomain = getCommunicationsDomain({ scheduleBuilt, activeFixtures });
  const coreReadiness = buildCoreOperationalReadiness({
    scheduleBuilt,
    unresolvedCount,
    conflictCount,
    officialOutstanding: officials.metrics?.missing,
    officialConflictCount: officials.metrics?.conflicts,
    parkingEnabled: parking.enabled !== false,
    parkingConfigured: Boolean(parking.capacity),
    parkingOverCapacity: parking.isOverCapacity,
    parkingHighPressure: parking.isHighPressure || parking.isOverConcurrentLimit,
    closedPitchCount: closedPitches.length,
    communicationsReady: scheduleBuilt && activeFixtures.length > 0,
  });
  const siteDomain = getSiteReadinessDomain(siteChecks);
  const incidentDomain = getIncidentDomain(incidents);

  const domains = [
    fixtureDomain,
    pitchDomain,
    ...(parking.enabled === false ? [] : [parkingDomain]),
    officialsDomain,
    weatherDomain,
    communicationsDomain,
    siteDomain,
    incidentDomain,
  ];

  const overall = overallStatus(domains);
  const priorityQueue = buildPriorityQueue(domains);
  const waves = buildFixtureWaves(activeFixtures, pitchCfg);

  return {
    ...overall,
    scope,
    scheduleBuilt,
    activeFixtures,
    postponedFixtures,
    domains,
    priorityQueue,
    coreReadiness,
    waves,
    firstWave: waves[0] || null,
    parking,
    officials,
    weather,
    metrics: {
      fixtures: activeFixtures.length,
      postponed: postponedFixtures.length,
      unresolved: toNumber(unresolvedCount),
      conflicts: toNumber(conflictCount),
      openActions: priorityQueue.length,
      blockingItems: coreReadiness.blockerCount,
      warningItems: coreReadiness.warningCount,
      openIncidents: incidentDomain.data.open,
      criticalIncidents: incidentDomain.data.critical,
      siteChecksComplete: siteDomain.data.completed,
      siteChecksTotal: siteDomain.data.total,
      closedPitches: pitchDomain.data.closed,
      officialsConfirmed: officials.metrics.confirmed,
      officialsFixtures: officials.metrics.fixtures,
      parkingEnabled: parking.enabled !== false,
      parkingUtilisation: parking.enabled === false ? 0 : parking.utilisation,
    },
  };
}

export default buildOperationsCentreSnapshot;
