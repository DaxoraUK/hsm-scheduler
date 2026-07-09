function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clean(value) {
  return String(value || "").trim().toLowerCase();
}

function normalise(value) {
  return clean(value).replace(/\./g, "").replace(/\s+/g, " ");
}

function titleCase(value = "") {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isPostponed(fixture = {}) {
  return clean(fixture.status) === "postponed";
}

function isUnavailableRef(ref = {}) {
  const status = clean(ref.status || ref.availabilityStatus || ref.availability);
  return ref.available === false || ref.active === false || ["unavailable", "inactive", "away", "declined", "no"].includes(status);
}

function getRefName(ref = {}) {
  return ref.name || ref.referee || ref.official || "";
}

export function getOfficialName(fixture = {}) {
  return fixture.referee || fixture.ref || fixture.official || fixture.matchOfficial || fixture.assignedOfficial || "";
}

function getOfficialStatus(fixture = {}) {
  return clean(fixture.refStatus || fixture.officialStatus || fixture.refereeStatus || fixture.matchOfficialStatus);
}

export function getOfficialAssignmentState(fixture = {}) {
  const status = getOfficialStatus(fixture);
  const official = normalise(getOfficialName(fixture));
  const hasOfficial = Boolean(official) && !["tbc", "none", "unassigned", "missing"].includes(official);

  if (["declined", "unavailable", "no", "rejected"].includes(status)) return "declined";
  if (!hasOfficial) return "unassigned";
  if (["confirmed", "accepted", "yes", "ok", "ready"].includes(status)) return "confirmed";
  if (["assigned"].includes(status)) return "assigned";
  return "awaiting";
}

export function getOfficialRoleFromName(name = "") {
  const official = normalise(name);

  if (!official || ["tbc", "none", "unassigned", "missing"].includes(official)) return "unassigned";
  if (official.includes("parent")) return "parent_referee";
  if (official.includes("volunteer")) return "volunteer";
  if (official.includes("manager")) return "manager_referee";
  if (official.includes("assistant")) return "assistant_referee";
  if (official.includes("mentor") || official.includes("observer")) return "observer";
  if (official.includes("league")) return "league_referee";
  if (official.includes("club")) return "club_referee";

  return "club_referee";
}

export function getOfficialRole(fixture = {}, refs = []) {
  const explicitRole = fixture.officialRole || fixture.refereeRole || fixture.refRole || fixture.role;
  if (explicitRole) return normalise(explicitRole).replace(/\s+/g, "_");

  const officialName = normalise(getOfficialName(fixture));
  const refRecord = asArray(refs).find((ref) => normalise(getRefName(ref)) === officialName);

  if (refRecord?.role) return normalise(refRecord.role).replace(/\s+/g, "_");
  if (refRecord?.type) return normalise(refRecord.type).replace(/\s+/g, "_");

  return getOfficialRoleFromName(officialName);
}

export function shouldEnforceOfficialClashes(fixture = {}, refs = []) {
  const officialName = normalise(getOfficialName(fixture));
  if (!officialName || ["tbc", "none", "unassigned", "missing"].includes(officialName)) return false;

  const refRecord = asArray(refs).find((ref) => normalise(getRefName(ref)) === officialName);
  if (typeof refRecord?.enforceClashes === "boolean") return refRecord.enforceClashes;
  if (typeof refRecord?.ignoreClashes === "boolean") return !refRecord.ignoreClashes;

  const role = getOfficialRole(fixture, refs);

  return ![
    "parent_referee",
    "parent_ref",
    "parent",
    "volunteer",
    "observer",
    "mentor",
  ].includes(role);
}

export function isFixtureOfficialConfirmed(fixture = {}) {
  const status = getOfficialStatus(fixture);
  const official = normalise(getOfficialName(fixture));

  if (["confirmed", "accepted", "assigned", "yes", "ok", "ready"].includes(status)) return true;
  if (["tbc", "unassigned", "missing", "none", "no", "pending", "declined"].includes(status)) return false;
  if (!official || ["tbc", "none", "unassigned", "missing"].includes(official)) return false;

  return Boolean(official);
}

function fixtureLabel(fixture = {}) {
  const home = fixture.homeTeam || fixture.team || fixture.home || "Fixture";
  const away = fixture.awayTeam || fixture.opponent || fixture.away || "";
  return away ? `${home} vs ${away}` : home;
}

function getKickOffMinutes(fixture = {}) {
  if (fixture.koMins != null) return toNumber(fixture.koMins, null);
  const value = fixture.koTime || fixture.ko || fixture.kickOff || fixture.time || "";
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function getEndMinutes(fixture = {}) {
  if (fixture.endMins != null) return toNumber(fixture.endMins, null);
  const koMins = getKickOffMinutes(fixture);
  if (koMins == null) return null;
  const duration = toNumber(fixture.durationMins || fixture.duration || fixture.matchDuration, 60);
  return koMins + Math.max(1, duration);
}

function formatMinutes(value) {
  if (value == null || !Number.isFinite(Number(value))) return "TBC";
  const safe = Math.max(0, Number(value));
  const hours = Math.floor(safe / 60) % 24;
  const minutes = Math.floor(safe % 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function timeKey(fixture = {}) {
  return fixture.ko || fixture.kickOff || fixture.time || fixture.koTime || fixture.koLabel || String(fixture.koMins || "unscheduled");
}

function getFixtureId(fixture = {}, index = 0) {
  return fixture.id || fixture.fixtureId || `${fixtureLabel(fixture)}-${timeKey(fixture)}-${index}`;
}

function fixtureSummary(fixture = {}, index = 0) {
  const start = getKickOffMinutes(fixture);
  const end = getEndMinutes(fixture);
  const state = getOfficialAssignmentState(fixture);

  return {
    id: getFixtureId(fixture, index),
    label: fixtureLabel(fixture),
    time: start == null ? timeKey(fixture) : formatMinutes(start),
    window: start == null ? "Time TBC" : `${formatMinutes(start)}–${formatMinutes(end)}`,
    official: getOfficialName(fixture) || "TBC",
    role: getOfficialRole(fixture),
    state,
    fixture,
  };
}

export function fixturesOverlap(fixtureA = {}, fixtureB = {}) {
  const aStart = getKickOffMinutes(fixtureA);
  const bStart = getKickOffMinutes(fixtureB);
  const aEnd = getEndMinutes(fixtureA);
  const bEnd = getEndMinutes(fixtureB);

  if (aStart == null || bStart == null || aEnd == null || bEnd == null) return false;

  return aStart < bEnd && bStart < aEnd;
}

export function findOfficialConflicts(fixtures = [], refs = []) {
  const activeFixtures = asArray(fixtures).filter(
    (fixture) =>
      !isPostponed(fixture) &&
      isFixtureOfficialConfirmed(fixture) &&
      shouldEnforceOfficialClashes(fixture, refs)
  );

  const conflicts = [];

  for (let a = 0; a < activeFixtures.length; a += 1) {
    for (let b = a + 1; b < activeFixtures.length; b += 1) {
      const first = activeFixtures[a];
      const second = activeFixtures[b];
      const firstOfficial = normalise(getOfficialName(first));
      const secondOfficial = normalise(getOfficialName(second));

      if (!firstOfficial || firstOfficial !== secondOfficial) continue;
      if (!shouldEnforceOfficialClashes(first, refs) || !shouldEnforceOfficialClashes(second, refs)) continue;
      if (!fixturesOverlap(first, second)) continue;

      conflicts.push({
        id: `official-conflict-${getFixtureId(first, a)}-${getFixtureId(second, b)}`,
        referee: getOfficialName(first),
        official: getOfficialName(first),
        role: getOfficialRole(first, refs),
        a: first,
        b: second,
        fixtures: [first, second],
        message: `${getOfficialName(first)} is assigned to overlapping fixtures: ${fixtureLabel(first)} and ${fixtureLabel(second)}.`,
      });
    }
  }

  return conflicts;
}

function calculatePeakDemand(fixtures = []) {
  const timed = asArray(fixtures)
    .map((fixture, index) => ({
      fixture,
      index,
      start: getKickOffMinutes(fixture),
      end: getEndMinutes(fixture),
    }))
    .filter((item) => item.start != null && item.end != null);

  if (!timed.length) {
    return {
      demand: 0,
      start: null,
      end: null,
      label: "No timed fixtures",
      fixtures: [],
    };
  }

  let best = null;

  timed.forEach((candidate) => {
    const concurrent = timed.filter((item) => item.start <= candidate.start && item.end > candidate.start);
    const end = concurrent.length ? Math.min(...concurrent.map((item) => item.end)) : candidate.end;
    const result = {
      demand: concurrent.length,
      start: candidate.start,
      end,
      fixtures: concurrent.map((item) => fixtureSummary(item.fixture, item.index)),
    };

    if (!best || result.demand > best.demand || (result.demand === best.demand && result.start < best.start)) {
      best = result;
    }
  });

  return {
    ...best,
    label: `${formatMinutes(best.start)}–${formatMinutes(best.end)}`,
  };
}

function buildOfficialWorkloads(fixtures = [], refs = [], turnaroundMinutes = 15) {
  const assignments = new Map();

  asArray(fixtures).forEach((fixture, index) => {
    if (isPostponed(fixture)) return;
    const official = normalise(getOfficialName(fixture));
    if (!official || ["tbc", "none", "unassigned", "missing"].includes(official)) return;

    const summary = fixtureSummary(fixture, index);
    const current = assignments.get(official) || {
      id: official,
      name: getOfficialName(fixture),
      role: getOfficialRole(fixture, refs),
      assignments: [],
    };

    current.assignments.push({
      ...summary,
      start: getKickOffMinutes(fixture),
      end: getEndMinutes(fixture),
    });
    assignments.set(official, current);
  });

  const tightTurnarounds = [];
  const workloads = [...assignments.values()].map((official) => {
    official.assignments.sort((a, b) => (a.start ?? Number.MAX_SAFE_INTEGER) - (b.start ?? Number.MAX_SAFE_INTEGER));

    let activeMinutes = 0;
    let overlaps = 0;
    let tight = 0;

    official.assignments.forEach((assignment, index) => {
      if (assignment.start != null && assignment.end != null) {
        activeMinutes += Math.max(0, assignment.end - assignment.start);
      }

      const next = official.assignments[index + 1];
      if (!next || assignment.end == null || next.start == null) return;

      const gap = next.start - assignment.end;
      if (gap < 0) {
        overlaps += 1;
      } else if (gap < turnaroundMinutes) {
        tight += 1;
        tightTurnarounds.push({
          id: `turnaround-${official.id}-${index}`,
          official: official.name,
          gap,
          from: assignment,
          to: next,
          message: `${official.name} has only ${gap} minute${gap === 1 ? "" : "s"} between ${assignment.label} and ${next.label}.`,
        });
      }
    });

    return {
      ...official,
      fixtureCount: official.assignments.length,
      activeMinutes,
      overlaps,
      tightTurnarounds: tight,
      firstTime: official.assignments[0]?.time || "TBC",
      lastTime: official.assignments[official.assignments.length - 1]?.time || "TBC",
    };
  });

  workloads.sort((a, b) => {
    if (b.overlaps !== a.overlaps) return b.overlaps - a.overlaps;
    if (b.tightTurnarounds !== a.tightTurnarounds) return b.tightTurnarounds - a.tightTurnarounds;
    return b.fixtureCount - a.fixtureCount;
  });

  return { workloads, tightTurnarounds };
}

function buildRecommendations({
  fixtureCount,
  unassignedFixtures,
  awaitingFixtures,
  declinedFixtures,
  conflicts,
  peak,
  availablePool,
  configuredPool,
  shortage,
  tightTurnarounds,
} = {}) {
  const recommendations = [];

  if (!fixtureCount) {
    return [{
      id: "officials-build-schedule",
      severity: "watch",
      title: "Build the schedule first",
      detail: "Officials demand can be forecast once timed fixtures are available.",
      guidance: "Build or import the matchday schedule, then return here for coverage and workload guidance.",
      metric: "Waiting",
    }];
  }

  if (conflicts.length) {
    recommendations.push({
      id: "officials-clear-overlaps",
      severity: "critical",
      title: `Clear ${conflicts.length} overlapping official assignment${conflicts.length === 1 ? "" : "s"}`,
      detail: conflicts[0]?.message || "One or more officials are assigned to fixtures that overlap.",
      guidance: "Reassign an official or move a kick-off before publishing the matchday plan.",
      metric: `${conflicts.length} clash${conflicts.length === 1 ? "" : "es"}`,
      fixtures: conflicts.flatMap((conflict) => conflict.fixtures || []).slice(0, 4),
    });
  }

  if (declinedFixtures.length) {
    recommendations.push({
      id: "officials-replace-declined",
      severity: "critical",
      title: `Replace ${declinedFixtures.length} declined official${declinedFixtures.length === 1 ? "" : "s"}`,
      detail: `${declinedFixtures[0].label} is the first fixture needing a replacement.`,
      guidance: "Assign replacements before chasing the remaining pending confirmations.",
      metric: `${declinedFixtures.length} declined`,
      fixtures: declinedFixtures.map((item) => item.fixture),
    });
  }

  if (unassignedFixtures.length) {
    const peakMissing = peak.fixtures.filter((item) => item.state === "unassigned" || item.state === "declined");
    recommendations.push({
      id: "officials-fill-gaps",
      severity: shortage > 0 ? "critical" : "attention",
      title: `Assign officials to ${unassignedFixtures.length} fixture${unassignedFixtures.length === 1 ? "" : "s"}`,
      detail: peakMissing.length
        ? `${peakMissing.length} unassigned fixture${peakMissing.length === 1 ? " sits" : "s sit"} inside the ${peak.label} peak window.`
        : `${unassignedFixtures[0].label} is the first unassigned fixture.`,
      guidance: "Cover the peak window first, then work outwards through the day.",
      metric: `${unassignedFixtures.length} unassigned`,
      fixtures: unassignedFixtures.map((item) => item.fixture),
    });
  }

  if (awaitingFixtures.length) {
    recommendations.push({
      id: "officials-chase-confirmations",
      severity: "attention",
      title: `Chase ${awaitingFixtures.length} official confirmation${awaitingFixtures.length === 1 ? "" : "s"}`,
      detail: `${awaitingFixtures[0].official} is listed for ${awaitingFixtures[0].label} but is not confirmed.`,
      guidance: "Send confirmations in peak-time order so the highest-risk windows are secured first.",
      metric: `${awaitingFixtures.length} awaiting`,
      fixtures: awaitingFixtures.map((item) => item.fixture),
    });
  }

  if (!configuredPool) {
    recommendations.push({
      id: "officials-configure-pool",
      severity: "watch",
      title: "Build the officials pool",
      detail: "No reusable officials are configured, so Ground Control cannot compare peak demand with available supply.",
      guidance: "Add club, league, parent and volunteer officials in Settings to unlock capacity forecasting.",
      metric: "Pool missing",
    });
  } else if (shortage > 0) {
    recommendations.push({
      id: "officials-pool-shortage",
      severity: "critical",
      title: `Peak demand exceeds the available pool by ${shortage}`,
      detail: `${peak.demand} simultaneous fixtures are expected at ${peak.label}, with ${availablePool} available official${availablePool === 1 ? "" : "s"}.`,
      guidance: "Recruit temporary cover, move kick-offs or use approved flexible helpers for this window.",
      metric: `${shortage} short`,
      fixtures: peak.fixtures.map((item) => item.fixture),
    });
  }

  if (tightTurnarounds.length) {
    recommendations.push({
      id: "officials-protect-turnaround",
      severity: "watch",
      title: `Protect ${tightTurnarounds.length} tight official turnaround${tightTurnarounds.length === 1 ? "" : "s"}`,
      detail: tightTurnarounds[0].message,
      guidance: "Allow travel, team handover and incident-reporting time between appointments.",
      metric: `<15 min`,
      fixtures: tightTurnarounds.flatMap((item) => [item.from.fixture, item.to.fixture]).slice(0, 4),
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      id: "officials-ready",
      severity: "healthy",
      title: "Officials plan is ready",
      detail: `All ${fixtureCount} active fixtures are covered with no detected clashes or tight turnarounds.`,
      guidance: "Keep confirmations monitored and publish the final appointments with the matchday communications.",
      metric: "Ready",
    });
  }

  return recommendations;
}

function statusFromCounts({ missingCount = 0, conflictCount = 0, declinedCount = 0, shortage = 0, awaitingCount = 0, tightCount = 0, configuredPool = 0 }) {
  if (conflictCount > 0 || declinedCount > 0 || shortage > 0) return "danger";
  if (missingCount > 0 || awaitingCount > 0 || tightCount > 0 || configuredPool === 0) return "warning";
  return "success";
}

export function calculateOfficialsReadiness({ fixtures = [], active = [], officialConflicts = [], refWarnings = null, refs = [], turnaroundMinutes = 15 } = {}) {
  const activeFixtures = asArray(active).length ? asArray(active) : asArray(fixtures).filter((fixture) => !isPostponed(fixture));
  const fixtureCount = activeFixtures.length;
  const fixtureSummaries = activeFixtures.map((fixture, index) => fixtureSummary(fixture, index));

  const unassignedFixtures = fixtureSummaries.filter((item) => item.state === "unassigned");
  const awaitingFixtures = fixtureSummaries.filter((item) => item.state === "awaiting" || item.state === "assigned");
  const declinedFixtures = fixtureSummaries.filter((item) => item.state === "declined");
  const confirmedFixtures = fixtureSummaries.filter((item) => item.state === "confirmed");
  const namedFixtures = fixtureSummaries.filter((item) => item.state !== "unassigned" && item.state !== "declined");

  const inferredConflicts = findOfficialConflicts(activeFixtures, refs);
  const suppliedConflicts = asArray(officialConflicts).filter((conflict) => {
    const sample = conflict?.a || conflict?.fixtures?.[0] || null;
    return sample ? shouldEnforceOfficialClashes(sample, refs) : true;
  });
  const conflicts = suppliedConflicts.length ? suppliedConflicts : inferredConflicts;

  const configuredRefs = asArray(refs).filter((ref) => normalise(getRefName(ref)));
  const availableRefs = configuredRefs.filter((ref) => !isUnavailableRef(ref));
  const configuredPool = configuredRefs.length;
  const availablePool = availableRefs.length;
  const namedOfficials = new Set(namedFixtures.map((item) => normalise(item.official)).filter(Boolean));

  if (fixtureCount === 0) {
    const recommendation = {
      id: "officials-build-schedule",
      severity: "neutral",
      title: "Build the schedule first",
      detail: "Officials coverage cannot be assessed until timed fixtures exist.",
      guidance: "Build the matchday schedule, then return for coverage and workload guidance.",
      metric: "Not assessed",
    };

    return {
      status: "neutral",
      score: null,
      label: "Not assessed",
      summary: "Build the schedule before officials coverage, peak demand and workload are calculated.",
      issues: [],
      actions: [recommendation.guidance],
      recommendations: [recommendation],
      nextAction: recommendation,
      missingFixtures: [],
      awaitingFixtures: [],
      declinedFixtures: [],
      confirmedFixtures: [],
      conflicts: [],
      peak: { demand: 0, start: null, label: "No timed fixtures", fixtures: [] },
      workloads: [],
      tightTurnarounds: [],
      pool: {
        configured: configuredPool,
        available: availablePool,
        unavailable: Math.max(0, configuredPool - availablePool),
        namedOfficials: 0,
        shortage: 0,
        refs: configuredRefs.map((ref, index) => ({
          id: ref.id || `official-${index}`,
          name: getRefName(ref),
          role: titleCase(ref.role || ref.type || "club_referee"),
          available: !isUnavailableRef(ref),
        })),
      },
      metrics: {
        fixtures: 0,
        assigned: 0,
        confirmed: 0,
        awaiting: 0,
        missing: 0,
        unassigned: 0,
        declined: 0,
        conflicts: 0,
        refereePool: configuredPool,
        availablePool,
        unavailablePool: Math.max(0, configuredPool - availablePool),
        officialsUsed: 0,
        peakDemand: 0,
        peakTime: "—",
        peakWindow: "No timed fixtures",
        shortage: 0,
        coverage: null,
        confirmationRate: null,
        tightTurnarounds: 0,
        maxWorkload: 0,
      },
    };
  }

  const peak = calculatePeakDemand(activeFixtures);
  const shortage = configuredPool ? Math.max(0, peak.demand - availablePool) : 0;
  const { workloads, tightTurnarounds } = buildOfficialWorkloads(activeFixtures, refs, turnaroundMinutes);

  const calculatedNeedsAttention = unassignedFixtures.length + awaitingFixtures.length + declinedFixtures.length;
  const missingCount = refWarnings === null || refWarnings === undefined
    ? calculatedNeedsAttention
    : Math.max(toNumber(refWarnings, calculatedNeedsAttention), unassignedFixtures.length + declinedFixtures.length);
  const conflictCount = conflicts.length;
  const status = statusFromCounts({
    missingCount,
    conflictCount,
    declinedCount: declinedFixtures.length,
    shortage,
    awaitingCount: awaitingFixtures.length,
    tightCount: tightTurnarounds.length,
    configuredPool,
  });

  const score = Math.max(0, Math.min(100,
    100
      - unassignedFixtures.length * 10
      - awaitingFixtures.length * 5
      - declinedFixtures.length * 15
      - conflictCount * 22
      - shortage * 15
      - tightTurnarounds.length * 4
      - (fixtureCount && configuredPool === 0 ? 8 : 0)
  ));

  const issues = [];
  const actions = [];

  if (unassignedFixtures.length > 0) {
    issues.push(`${unassignedFixtures.length} fixture${unassignedFixtures.length === 1 ? "" : "s"} without an assigned official.`);
    actions.push("Assign officials to uncovered fixtures, starting with the peak-demand window.");
  }

  if (awaitingFixtures.length > 0) {
    issues.push(`${awaitingFixtures.length} official confirmation${awaitingFixtures.length === 1 ? "" : "s"} still awaiting.`);
    actions.push("Chase outstanding confirmations in peak-time order.");
  }

  if (declinedFixtures.length > 0) {
    issues.push(`${declinedFixtures.length} fixture${declinedFixtures.length === 1 ? " has" : "s have"} a declined official.`);
    actions.push("Replace declined officials before publishing.");
  }

  if (conflictCount > 0) {
    issues.push(`${conflictCount} referee overlap${conflictCount === 1 ? "" : "s"} detected.`);
    actions.push("Move kick-offs or reassign officials to clear referee overlaps.");
  }

  if (shortage > 0) {
    issues.push(`Peak demand is ${shortage} official${shortage === 1 ? "" : "s"} above the available pool at ${peak.label}.`);
    actions.push("Add cover or stagger peak kick-offs to close the officials capacity gap.");
  }

  if (tightTurnarounds.length > 0) {
    issues.push(`${tightTurnarounds.length} tight official turnaround${tightTurnarounds.length === 1 ? "" : "s"} detected.`);
    actions.push("Protect at least 15 minutes between back-to-back appointments where possible.");
  }

  if (fixtureCount > 0 && configuredPool === 0) {
    issues.push("No reusable officials pool is configured.");
    actions.push("Add officials in Settings to compare demand with available supply.");
  }

  const recommendations = buildRecommendations({
    fixtureCount,
    unassignedFixtures,
    awaitingFixtures,
    declinedFixtures,
    conflicts,
    peak,
    availablePool,
    configuredPool,
    shortage,
    tightTurnarounds,
  });

  const coverage = fixtureCount ? Math.round((namedFixtures.length / fixtureCount) * 100) : 100;
  const confirmationRate = fixtureCount ? Math.round((confirmedFixtures.length / fixtureCount) * 100) : 100;
  const maxWorkload = workloads.reduce((maximum, official) => Math.max(maximum, official.fixtureCount), 0);

  return {
    status,
    score,
    label: status === "success" ? "Officials ready" : status === "warning" ? "Officials need chasing" : "Officials at risk",
    summary: status === "success"
      ? `All ${fixtureCount} active fixture${fixtureCount === 1 ? " is" : "s are"} covered without detected clashes.`
      : recommendations[0]?.detail || issues[0] || "Officials need review.",
    issues,
    actions,
    recommendations,
    nextAction: recommendations[0] || null,
    missingFixtures: [...unassignedFixtures, ...declinedFixtures],
    awaitingFixtures,
    declinedFixtures,
    confirmedFixtures,
    conflicts,
    peak,
    workloads,
    tightTurnarounds,
    pool: {
      configured: configuredPool,
      available: availablePool,
      unavailable: Math.max(0, configuredPool - availablePool),
      namedOfficials: namedOfficials.size,
      shortage,
      refs: configuredRefs.map((ref, index) => ({
        id: ref.id || `official-${index}`,
        name: getRefName(ref),
        role: titleCase(ref.role || ref.type || "club_referee"),
        available: !isUnavailableRef(ref),
      })),
    },
    metrics: {
      fixtures: fixtureCount,
      assigned: namedFixtures.length,
      confirmed: confirmedFixtures.length,
      awaiting: awaitingFixtures.length,
      missing: missingCount,
      unassigned: unassignedFixtures.length,
      declined: declinedFixtures.length,
      conflicts: conflictCount,
      refereePool: configuredPool,
      availablePool,
      unavailablePool: Math.max(0, configuredPool - availablePool),
      officialsUsed: namedOfficials.size,
      peakDemand: peak.demand,
      peakTime: peak.start == null ? "—" : formatMinutes(peak.start),
      peakWindow: peak.label,
      shortage,
      coverage,
      confirmationRate,
      tightTurnarounds: tightTurnarounds.length,
      maxWorkload,
    },
  };
}

export default calculateOfficialsReadiness;
