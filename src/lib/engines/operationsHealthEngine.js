import { getParkingSnapshot } from "./parkingEngine.js";
import { calculateOfficialsReadiness } from "./officialsEngine.js";
import { calculatePlatformHealth } from "./platformHealthEngine.js";
import { normalisePlatformStatus } from "./statusSystem.js";

const STATUS_RANK = {
  danger: 0,
  warning: 1,
  success: 2,
  info: 3,
  neutral: 4,
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isPostponed(fixture = {}) {
  return String(fixture.status || "").toLowerCase() === "postponed";
}


function getFormat(fixture = {}) {
  return fixture.format || fixture.gameFormat || fixture.pitchFormat || fixture.pitchType || "11v11";
}

function estimateFixtureCars(fixture = {}, club = {}) {
  const avgCars = club.avgCars || {};
  const format = getFormat(fixture);
  return toNumber(avgCars[format], toNumber(club.defaultCarsPerFixture, 20));
}

function scoreDomain({ id, label, score, status, summary, issues = [], actions = [] }) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    id,
    label,
    score: safeScore,
    status,
    platformStatus: normalisePlatformStatus(status),
    summary,
    issues,
    actions,
  };
}

function getOverallStatus(score, hasDanger, hasWarning) {
  if (hasDanger || score < 60) return { status: "danger", label: "Needs action" };
  if (hasWarning || score < 85) return { status: "warning", label: "Review" };
  return { status: "success", label: "Healthy" };
}

function mapParkingStatus(parking = {}) {
  if (!parking.capacity) return "warning";
  if (parking.isOverCapacity || parking.utilisation > 100) return "danger";
  if (parking.isHighPressure || parking.isOverConcurrentLimit || parking.utilisation >= 85) return "warning";
  return "success";
}

export function calculateOperationsHealth({
  clubTwin = null,
  fixtures = [],
  active = [],
  postponed = [],
  unresolved = [],
  conflicts = [],
  officialConflicts = [],
  refWarnings = 0,
  closedPitches = [],
  pitchCfg = [],
  club = {},
  hasRun = false,
} = {}) {
  if (clubTwin?.operationsHealth) return clubTwin.operationsHealth;

  const activeFixtures = active.length ? active : fixtures.filter((fixture) => !isPostponed(fixture));
  const postponedFixtures = postponed.length ? postponed : fixtures.filter(isPostponed);
  const unresolvedCount = unresolved.length;
  const clashCount = conflicts.length;
  const officials = calculateOfficialsReadiness({
    fixtures,
    active: activeFixtures,
    officialConflicts,
    refWarnings,
  });
  const officialConflictCount = officials.metrics.conflicts;
  const refWarningCount = officials.metrics.missing;
  const closedPitchCount = closedPitches.length;
  const pitchCount = pitchCfg.length;

  const parking = getParkingSnapshot({
    fixtures: activeFixtures,
    club,
    pitchCfg,
  });

  const capacity = parking.capacity;
  const peakParkingLoad = parking.peakCars;
  const parkingUtilisation = parking.utilisation;
  const parkingStatus = mapParkingStatus(parking);
  const totalEstimatedCars = activeFixtures.reduce((total, fixture) => total + estimateFixtureCars(fixture, club), 0);

  const fixtureIssues = [];
  const fixtureActions = [];
  if (!hasRun) {
    fixtureIssues.push("Schedule has not been built yet.");
    fixtureActions.push("Build the schedule before reviewing final readiness.");
  }
  if (unresolvedCount > 0) {
    fixtureIssues.push(`${unresolvedCount} fixture${unresolvedCount === 1 ? "" : "s"} unresolved.`);
    fixtureActions.push("Open Unresolved Fixtures and fix or manually place each item.");
  }
  if (clashCount > 0) {
    fixtureIssues.push(`${clashCount} fixture clash${clashCount === 1 ? "" : "es"} detected.`);
    fixtureActions.push("Use the Schedule card to move clashing fixtures.");
  }

  const fixturesScore = 100
    - (hasRun ? 0 : 15)
    - unresolvedCount * 18
    - clashCount * 15
    - postponedFixtures.length * 2;

  const pitchIssues = [];
  const pitchActions = [];
  if (!pitchCount) {
    pitchIssues.push("No pitches configured.");
    pitchActions.push("Add pitches in Settings before relying on pitch allocation.");
  }
  if (closedPitchCount > 0) {
    pitchIssues.push(`${closedPitchCount} pitch${closedPitchCount === 1 ? "" : "es"} currently closed.`);
    pitchActions.push("Check Pitch Closures before publishing the matchday plan.");
  }

  const pitchScore = pitchCount ? 100 - closedPitchCount * 10 : 40;

  const officialIssues = officials.issues;
  const officialActions = officials.actions;
  const officialsScore = officials.score;

  const parkingIssues = [];
  const parkingActions = [];
  if (!capacity) {
    parkingIssues.push("Parking capacity has not been set.");
    parkingActions.push("Set car park capacity in venue or club settings.");
  } else if (parking.isOverCapacity || parkingUtilisation > 100) {
    parkingIssues.push(
      `Parking peaks at ${parkingUtilisation}% of capacity (${peakParkingLoad}/${capacity} spaces at ${parking.peakTime}).`
    );
    parkingActions.push("Open Parking Intelligence and apply the best fixture move.");
  } else if (parking.isHighPressure || parking.isOverConcurrentLimit || parkingUtilisation >= 85) {
    parkingIssues.push(
      `Parking peaks at ${parkingUtilisation}% of capacity (${peakParkingLoad}/${capacity} spaces at ${parking.peakTime}).`
    );
    parkingActions.push("Review Parking Intelligence before publishing.");
  }

  const parkingScore = !capacity ? 65 : toNumber(parking.healthScore, 100);

  const communicationIssues = [];
  const communicationActions = [];
  if (!hasRun) {
    communicationIssues.push("Coach messages are not ready until the schedule is built.");
    communicationActions.push("Build the schedule, then review coach messages.");
  }

  const communicationsScore = hasRun ? 95 : 70;

  const domains = [
    scoreDomain({
      id: "fixtures",
      label: "Fixtures",
      score: fixturesScore,
      status: unresolvedCount || clashCount ? "danger" : hasRun ? "success" : "warning",
      summary: unresolvedCount || clashCount ? "Fixture plan needs attention." : hasRun ? "Fixture plan is built." : "Fixture plan is still in draft.",
      issues: fixtureIssues,
      actions: fixtureActions,
    }),
    scoreDomain({
      id: "pitches",
      label: "Pitches",
      score: pitchScore,
      status: !pitchCount ? "danger" : closedPitchCount ? "warning" : "success",
      summary: closedPitchCount ? "Some pitches are closed." : pitchCount ? "Pitch estate is available." : "Pitch estate needs setup.",
      issues: pitchIssues,
      actions: pitchActions,
    }),
    scoreDomain({
      id: "officials",
      label: "Officials",
      score: officialsScore,
      status: officials.status,
      summary: officials.summary,
      issues: officialIssues,
      actions: officialActions,
    }),
    scoreDomain({
      id: "parking",
      label: "Parking",
      score: parkingScore,
      status: parkingStatus,
      summary: capacity ? `${parkingUtilisation}% peak use.` : "Capacity not set.",
      issues: parkingIssues,
      actions: parkingActions,
    }),
    scoreDomain({
      id: "communications",
      label: "Communications",
      score: communicationsScore,
      status: hasRun ? "success" : "warning",
      summary: hasRun ? "Coach messages can be prepared." : "Waiting for built schedule.",
      issues: communicationIssues,
      actions: communicationActions,
    }),
  ];

  const platformHealth = calculatePlatformHealth({ domains });
  const overallScore = platformHealth.score;
  const hasDanger = domains.some((domain) => domain.status === "danger");
  const hasWarning = domains.some((domain) => domain.status === "warning");
  const overall = getOverallStatus(overallScore, hasDanger, hasWarning);

  const issues = domains.flatMap((domain) => domain.issues.map((issue) => ({ domain: domain.label, issue })));
  const actions = domains.flatMap((domain) => domain.actions.map((action) => ({ domain: domain.label, action })));
  const worstDomain = [...domains].sort((a, b) => {
    if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    return a.score - b.score;
  })[0];

  return {
    score: overallScore,
    status: overall.status,
    platformStatus: platformHealth.platformStatus,
    label: overall.label,
    platformLabel: platformHealth.label,
    summary: worstDomain?.summary || "Matchday health calculated.",
    domains,
    platformHealth,
    issues,
    actions,
    metrics: {
      fixtures: fixtures.length,
      active: activeFixtures.length,
      postponed: postponedFixtures.length,
      unresolved: unresolvedCount,
      clashes: clashCount,
      refereeWarnings: refWarningCount,
      officialConflicts: officialConflictCount,
      closedPitches: closedPitchCount,
      pitchCount,
      parkingCapacity: capacity,
      totalEstimatedCars,
      peakParkingLoad,
      parkingUtilisation,
      parkingPeakTime: parking.peakTime,
    },
    parking,
    officials,
    debug: {
      parkingSource: "parkingEngine.getParkingSnapshot",
      parkingCalculation: "peak concurrent window, not all-day total",
    },
  };
}

export default calculateOperationsHealth;
