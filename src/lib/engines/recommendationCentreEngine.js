import { createRecommendationAction, sortActionsByPriority } from "./actionFramework.js";
import { getParkingSnapshot } from "./parkingEngine.js";
import { getWorstPlatformStatus, normalisePlatformStatus } from "./statusSystem.js";

function activeFixtures(fixtures = []) {
  return fixtures.filter((fixture) => String(fixture.status || "").toLowerCase() !== "postponed");
}

function countMissingOfficials(fixtures = []) {
  return activeFixtures(fixtures).filter((fixture) => {
    const referee = fixture.referee || fixture.official || fixture.ref || "";
    const refStatus = String(fixture.refStatus || fixture.officialStatus || fixture.refereeStatus || "TBC").toLowerCase();
    return !referee || ["tbc", "awaiting", "unconfirmed", "missing"].includes(refStatus);
  }).length;
}

function getRuleIssueCount(competitionRules = {}) {
  return Number(
    competitionRules.metrics?.danger ||
    competitionRules.metrics?.issues ||
    competitionRules.issues?.length ||
    0
  );
}

function getRuleWarningCount(competitionRules = {}) {
  return Number(
    competitionRules.metrics?.warnings ||
    competitionRules.warnings?.length ||
    0
  );
}

export function buildRecommendationCentre({
  fixtures = [],
  active = [],
  unresolved = [],
  conflicts = [],
  officialConflicts = [],
  refWarnings = 0,
  hasRun = false,
  club = {},
  pitchCfg = [],
  closedPitches = [],
  competitionRules = {},
  weatherIntelligence = {},
  dayOptimisation = {},
} = {}) {
  const activeGames = active.length ? active : activeFixtures(fixtures);
  const parking = getParkingSnapshot({ fixtures: activeGames, club, pitchCfg });
  const missingOfficials = Number(refWarnings || countMissingOfficials(activeGames));
  const actions = [];

  if (!hasRun) {
    actions.push(createRecommendationAction({
      domain: "fixtures",
      severity: "attention",
      priority: 100,
      title: "Build the matchday schedule",
      description: "The schedule needs to be built before Ground Control can complete final readiness checks.",
      metadata: { hasRun },
    }));
  }

  if (unresolved.length > 0) {
    actions.push(createRecommendationAction({
      domain: "unresolved",
      severity: "critical",
      priority: 96,
      title: "Resolve unplaced fixtures",
      description: `${unresolved.length} fixture${unresolved.length === 1 ? "" : "s"} need manual review before publishing.`,
      metadata: { count: unresolved.length },
    }));
  }

  if (conflicts.length > 0) {
    actions.push(createRecommendationAction({
      domain: "fixtures",
      severity: "critical",
      priority: 94,
      title: "Fix fixture clashes",
      description: `${conflicts.length} clash${conflicts.length === 1 ? "" : "es"} detected in the selected schedule.`,
      metadata: { count: conflicts.length },
    }));
  }

  if (parking.isOverCapacity) {
    actions.push(createRecommendationAction({
      domain: "parking",
      severity: "critical",
      priority: 92,
      title: "Parking exceeds capacity",
      description: `Peak demand is ${parking.utilisation}% at ${parking.peakTime} (${parking.peakCars}/${parking.capacity} spaces).`,
      metadata: { parking },
    }));
  } else if (parking.isHighPressure) {
    actions.push(createRecommendationAction({
      domain: "parking",
      severity: "watch",
      priority: 70,
      title: "Watch parking pressure",
      description: `Peak demand is ${parking.utilisation}% at ${parking.peakTime} (${parking.peakCars}/${parking.capacity} spaces).`,
      metadata: { parking },
    }));
  }

  if (missingOfficials > 0 || officialConflicts.length > 0) {
    actions.push(createRecommendationAction({
      domain: "officials",
      severity: missingOfficials > 0 ? "attention" : "watch",
      priority: 82,
      title: "Confirm officials",
      description: missingOfficials > 0
        ? `${missingOfficials} fixture${missingOfficials === 1 ? "" : "s"} need official confirmation.`
        : `${officialConflicts.length} official clash${officialConflicts.length === 1 ? "" : "es"} need review.`,
      metadata: { missingOfficials, officialConflicts },
    }));
  }

  if (closedPitches.length > 0) {
    actions.push(createRecommendationAction({
      domain: "pitchClosures",
      severity: "watch",
      priority: 65,
      title: "Review pitch closures",
      description: `${closedPitches.length} pitch${closedPitches.length === 1 ? " is" : "es are"} currently closed.`,
      metadata: { closedPitches },
    }));
  }

  const ruleIssues = getRuleIssueCount(competitionRules);
  const ruleWarnings = getRuleWarningCount(competitionRules);

  if (ruleIssues > 0 || ruleWarnings > 0) {
    actions.push(createRecommendationAction({
      domain: "competitionRules",
      severity: ruleIssues > 0 ? "attention" : "watch",
      priority: ruleIssues > 0 ? 80 : 58,
      title: ruleIssues > 0 ? "Competition rules need attention" : "Competition rules need review",
      description: ruleIssues > 0
        ? `${ruleIssues} competition rule issue${ruleIssues === 1 ? "" : "s"} detected.`
        : `${ruleWarnings} competition rule warning${ruleWarnings === 1 ? "" : "s"} detected.`,
      metadata: { competitionRules },
    }));
  }

  if (weatherIntelligence?.status === "warning") {
    actions.push(createRecommendationAction({
      domain: "weather",
      severity: "watch",
      priority: 54,
      title: "Weather setup needs review",
      description: weatherIntelligence.summary || weatherIntelligence.message || "Check venue postcode and weather readiness.",
      metadata: { weatherIntelligence },
    }));
  }

  const optimiserMoves = Number(dayOptimisation.metrics?.validatedMoves || dayOptimisation.moves?.length || 0);
  if (optimiserMoves > 0) {
    actions.push(createRecommendationAction({
      domain: "optimiser",
      severity: "healthy",
      priority: 48,
      title: "Review day optimiser moves",
      description: `${optimiserMoves} validated fixture move${optimiserMoves === 1 ? "" : "s"} available for the selected matchday.`,
      metadata: { dayOptimisation },
    }));
  }

  if (hasRun && actions.length === 0) {
    actions.push(createRecommendationAction({
      domain: "communications",
      severity: "healthy",
      priority: 10,
      title: "Prepare matchday communications",
      description: "Core checks look healthy. Review coach messages and publish when ready.",
    }));
  }

  const sorted = sortActionsByPriority(actions);
  const critical = sorted.filter((action) => action.severity === "critical").length;
  const attention = sorted.filter((action) => action.severity === "attention").length;
  const watch = sorted.filter((action) => action.severity === "watch").length;
  const overallStatus = getWorstPlatformStatus(sorted.map((action) => action.severity));

  return {
    status: normalisePlatformStatus(overallStatus.key).legacyStatus,
    statusKey: overallStatus.key,
    label: overallStatus.label,
    summary: critical > 0
      ? `${critical} critical recommendation${critical === 1 ? "" : "s"}.`
      : attention > 0
        ? `${attention} item${attention === 1 ? "" : "s"} need attention.`
        : watch > 0
          ? `${watch} item${watch === 1 ? "" : "s"} to watch.`
          : "No urgent recommendations.",
    actions: sorted,
    items: sorted,
    nextAction: sorted[0] || null,
    metrics: {
      total: sorted.length,
      critical,
      attention,
      watch,
      healthy: sorted.filter((action) => action.severity === "healthy" || action.severity === "excellent").length,
    },
    parking,
  };
}

export default buildRecommendationCentre;
