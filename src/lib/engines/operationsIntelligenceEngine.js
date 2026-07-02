import { getParkingSnapshot } from "./parkingEngine.js";

function activeFixtures(fixtures = []) {
  return fixtures.filter((fixture) => String(fixture?.status || "").toLowerCase() !== "postponed");
}

function getKickoff(fixture = {}) {
  const value = fixture.ko || fixture.kickOff || fixture.kickoff || fixture.time || fixture.start || "";
  const match = String(value).match(/(\d{1,2})[:.](\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`, minutes: hour * 60 + minute };
}

function formatTime(minutes) {
  const safe = Math.max(0, Number(minutes) || 0);
  const hour = Math.floor(safe / 60);
  const minute = safe % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getPitchName(fixture = {}) {
  return fixture.pitch || fixture.pitchName || fixture.pitchId || fixture.venue || "Unassigned";
}

function getOfficialName(fixture = {}) {
  return fixture.referee || fixture.official || fixture.ref || "";
}

function getOfficialStatus(fixture = {}) {
  return String(fixture.refStatus || fixture.officialStatus || fixture.refereeStatus || "TBC").toLowerCase();
}

function countMissingOfficials(fixtures = []) {
  return activeFixtures(fixtures).filter((fixture) => {
    const official = getOfficialName(fixture);
    const status = getOfficialStatus(fixture);
    return !official || ["tbc", "awaiting", "unconfirmed", "missing"].includes(status);
  }).length;
}

function getKickoffClusters(fixtures = []) {
  const byTime = new Map();
  activeFixtures(fixtures).forEach((fixture) => {
    const ko = getKickoff(fixture);
    if (!ko) return;
    const current = byTime.get(ko.label) || [];
    current.push(fixture);
    byTime.set(ko.label, current);
  });

  return Array.from(byTime.entries())
    .map(([time, games]) => ({ time, count: games.length, games }))
    .sort((a, b) => b.count - a.count || a.time.localeCompare(b.time));
}

function getPitchPressure(fixtures = []) {
  const byPitch = new Map();
  activeFixtures(fixtures).forEach((fixture) => {
    const pitch = getPitchName(fixture);
    const current = byPitch.get(pitch) || [];
    current.push(fixture);
    byPitch.set(pitch, current);
  });

  return Array.from(byPitch.entries())
    .map(([pitch, games]) => ({ pitch, count: games.length, games }))
    .sort((a, b) => b.count - a.count || a.pitch.localeCompare(b.pitch));
}

function buildInsight({ id, severity = "watch", domain = "operations", title, detail, guidance, metric, target }) {
  return {
    id,
    severity,
    domain,
    title,
    detail,
    guidance,
    metric,
    target,
  };
}

function getSeverityCounts(insights = []) {
  return insights.reduce(
    (acc, insight) => {
      acc.total += 1;
      acc[insight.severity] = (acc[insight.severity] || 0) + 1;
      return acc;
    },
    { total: 0, critical: 0, attention: 0, watch: 0, healthy: 0 }
  );
}

export function calculateOperationsIntelligence({
  fixtures = [],
  active = [],
  unresolved = [],
  conflicts = [],
  officialConflicts = [],
  refWarnings = 0,
  club = {},
  pitchCfg = [],
  closedPitches = [],
  hasRun = false,
  competitionRules = {},
  weatherIntelligence = {},
  dayOptimisation = {},
} = {}) {
  const games = active.length ? activeFixtures(active) : activeFixtures(fixtures);
  const parking = getParkingSnapshot({ fixtures: games, club, pitchCfg });
  const missingOfficials = Number(refWarnings || countMissingOfficials(games));
  const clusters = getKickoffClusters(games);
  const pitchPressure = getPitchPressure(games);
  const insights = [];

  if (!hasRun) {
    insights.push(buildInsight({
      id: "build-before-intelligence",
      severity: "attention",
      domain: "fixtures",
      title: "Build the schedule to unlock live intelligence",
      detail: "Ground Control needs a built matchday before it can predict pressure windows, resource pinch points and communications readiness.",
      guidance: "Build Saturday or Sunday first, then return here for operational recommendations.",
      metric: "Pending",
      target: "schedule",
    }));
  }

  if (unresolved.length > 0) {
    insights.push(buildInsight({
      id: "unresolved-blockers",
      severity: "critical",
      domain: "fixtures",
      title: "Unresolved fixtures are blocking publish readiness",
      detail: `${unresolved.length} fixture${unresolved.length === 1 ? "" : "s"} need manual placement before the day can be trusted operationally.`,
      guidance: "Clear unresolved fixtures before reviewing parking, officials or communications.",
      metric: `${unresolved.length} unresolved`,
      target: "unresolved",
    }));
  }

  if (conflicts.length > 0) {
    insights.push(buildInsight({
      id: "fixture-clashes",
      severity: "critical",
      domain: "fixtures",
      title: "Fixture clashes need fixing before approval",
      detail: `${conflicts.length} clash${conflicts.length === 1 ? "" : "es"} detected in the current schedule.`,
      guidance: "Resolve clashes before confirming officials or copying coach messages.",
      metric: `${conflicts.length} clash${conflicts.length === 1 ? "" : "es"}`,
      target: "schedule",
    }));
  }

  if (parking.isOverCapacity) {
    insights.push(buildInsight({
      id: "parking-over-capacity",
      severity: "critical",
      domain: "parking",
      title: "Parking is predicted to exceed capacity",
      detail: `${parking.utilisation}% peak use at ${parking.peakTime} with ${parking.peakCars}/${parking.capacity} spaces expected.`,
      guidance: "Stagger kick-offs around the peak, move a flexible fixture, or add overflow parking before publishing.",
      metric: `${parking.utilisation}% peak`,
      target: "parkingIntelligence",
    }));
  } else if (parking.isHighPressure || parking.isOverConcurrentLimit) {
    insights.push(buildInsight({
      id: "parking-pressure",
      severity: "attention",
      domain: "parking",
      title: "Parking pressure window needs a steward plan",
      detail: `${parking.utilisation}% peak use expected at ${parking.peakTime}.`,
      guidance: "Prepare arrival messaging and make sure the busiest arrival window is covered.",
      metric: `${parking.utilisation}% peak`,
      target: "parkingIntelligence",
    }));
  }

  const biggestCluster = clusters[0];
  if (biggestCluster?.count >= 3) {
    const windowStart = getKickoff(biggestCluster.games[0])?.minutes ?? null;
    const windowLabel = windowStart === null ? biggestCluster.time : `${biggestCluster.time}-${formatTime(windowStart + 20)}`;
    insights.push(buildInsight({
      id: "kickoff-arrival-wave",
      severity: biggestCluster.count >= 4 ? "attention" : "watch",
      domain: "flow",
      title: "Large arrival wave around one kick-off time",
      detail: `${biggestCluster.count} fixtures kick off at ${biggestCluster.time}, creating pressure around ${windowLabel}.`,
      guidance: "Use coach messages to stagger arrivals and check whether one fixture can move by 10-15 minutes.",
      metric: `${biggestCluster.count} simultaneous`,
      target: "schedule",
    }));
  }

  const busiestPitch = pitchPressure[0];
  if (busiestPitch?.count >= 4) {
    insights.push(buildInsight({
      id: "pitch-turnover-pressure",
      severity: "watch",
      domain: "pitches",
      title: "One pitch is carrying most of the day",
      detail: `${busiestPitch.pitch} has ${busiestPitch.count} fixtures allocated.`,
      guidance: "Check turnover time, surface wear and whether any compatible fixtures can be moved to a quieter pitch.",
      metric: `${busiestPitch.count} games`,
      target: "pitchAssignments",
    }));
  }

  if (missingOfficials > 0 || officialConflicts.length > 0) {
    insights.push(buildInsight({
      id: "officials-pressure",
      severity: missingOfficials > 2 || officialConflicts.length > 0 ? "attention" : "watch",
      domain: "officials",
      title: "Officials need confirming before communications",
      detail: missingOfficials > 0
        ? `${missingOfficials} fixture${missingOfficials === 1 ? "" : "s"} still need official confirmation.`
        : `${officialConflicts.length} official clash${officialConflicts.length === 1 ? "" : "es"} need review.`,
      guidance: "Confirm referees before copying coach messages so managers receive one clean update.",
      metric: missingOfficials > 0 ? `${missingOfficials} missing` : `${officialConflicts.length} clashes`,
      target: "operationsHealth",
    }));
  }

  if (closedPitches.length > 0) {
    insights.push(buildInsight({
      id: "closed-pitches",
      severity: "watch",
      domain: "pitches",
      title: "Closed pitches are reducing operational flexibility",
      detail: `${closedPitches.length} pitch${closedPitches.length === 1 ? " is" : "es are"} currently closed.`,
      guidance: "Keep closures visible until the final schedule is approved, then rerun the schedule if availability changes.",
      metric: `${closedPitches.length} closed`,
      target: "pitchClosures",
    }));
  }

  const ruleIssues = Number(competitionRules?.metrics?.danger || competitionRules?.metrics?.issues || 0);
  const ruleWarnings = Number(competitionRules?.metrics?.warnings || 0);
  if (ruleIssues > 0 || ruleWarnings > 0) {
    insights.push(buildInsight({
      id: "rules-readiness",
      severity: ruleIssues > 0 ? "attention" : "watch",
      domain: "rules",
      title: ruleIssues > 0 ? "Competition rules need attention" : "Competition rules should be reviewed",
      detail: ruleIssues > 0
        ? `${ruleIssues} competition rule issue${ruleIssues === 1 ? "" : "s"} detected.`
        : `${ruleWarnings} competition rule warning${ruleWarnings === 1 ? "" : "s"} detected.`,
      guidance: "Check this before publishing, especially for pitch format and timing rules.",
      metric: ruleIssues > 0 ? `${ruleIssues} issues` : `${ruleWarnings} warnings`,
      target: "competitionRules",
    }));
  }

  if (weatherIntelligence?.status === "warning") {
    insights.push(buildInsight({
      id: "weather-readiness",
      severity: "watch",
      domain: "weather",
      title: "Weather intelligence is not fully ready",
      detail: weatherIntelligence.summary || weatherIntelligence.message || "Venue weather setup needs review.",
      guidance: "Confirm postcode and weather setup so postponement guidance can become reliable.",
      metric: weatherIntelligence.label || "Review",
      target: "weatherIntelligence",
    }));
  }

  const optimiserMoves = Number(dayOptimisation?.metrics?.validatedMoves || dayOptimisation?.moves?.length || 0);
  if (optimiserMoves > 0) {
    insights.push(buildInsight({
      id: "validated-optimiser-moves",
      severity: "healthy",
      domain: "optimiser",
      title: "Validated improvement moves are available",
      detail: `${optimiserMoves} fixture move${optimiserMoves === 1 ? "" : "s"} could improve the matchday flow.`,
      guidance: "Review optimiser moves after critical issues have been cleared.",
      metric: `${optimiserMoves} moves`,
      target: "dayOptimiser",
    }));
  }

  if (hasRun && insights.length === 0) {
    insights.push(buildInsight({
      id: "ready-to-publish",
      severity: "healthy",
      domain: "communications",
      title: "Matchday is ready for final communications",
      detail: "No major operational risks were detected from fixtures, parking, officials, rules or weather setup.",
      guidance: "Review coach messages and publish the weekend schedule.",
      metric: "Ready",
      target: "coachMessages",
    }));
  }

  const order = { critical: 0, attention: 1, watch: 2, healthy: 3 };
  const sorted = insights.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  const metrics = getSeverityCounts(sorted);
  const status = metrics.critical > 0 ? "danger" : metrics.attention > 0 || metrics.watch > 0 ? "warning" : "success";
  const label = metrics.critical > 0 ? "Action required" : metrics.attention > 0 ? "Needs attention" : metrics.watch > 0 ? "Watch" : "Healthy";

  return {
    status,
    label,
    summary: metrics.critical > 0
      ? `${metrics.critical} operational blocker${metrics.critical === 1 ? "" : "s"} found.`
      : metrics.attention > 0
        ? `${metrics.attention} item${metrics.attention === 1 ? "" : "s"} need attention before publish.`
        : metrics.watch > 0
          ? `${metrics.watch} operational watch item${metrics.watch === 1 ? "" : "s"}.`
          : "Ground Control has not found major operational risk.",
    nextAction: sorted[0] || null,
    insights: sorted,
    items: sorted,
    metrics: {
      ...metrics,
      activeFixtures: games.length,
      parkingPeak: parking.utilisation || 0,
      missingOfficials,
      busiestKickoff: biggestCluster?.time || "—",
      busiestPitch: busiestPitch?.pitch || "—",
    },
    parking,
    clusters,
    pitchPressure,
  };
}

export default calculateOperationsIntelligence;
