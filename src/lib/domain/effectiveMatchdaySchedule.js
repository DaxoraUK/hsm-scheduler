import { resolveEffectiveAllocation } from "./effectiveAllocation.js";
import { getFixtureFlowIdentity, validateSchedulingFixtureInput } from "./fixtureVenueFlow.js";
import { materialiseEffectiveFixtures } from "./schedulingState.js";

function cleanIdentity(value) {
  return String(value || "").trim();
}

function diagnostic(code, canonicalFixtureIdentity, detail = {}) {
  return { code, canonicalFixtureIdentity: cleanIdentity(canonicalFixtureIdentity), ...detail };
}

function indexSchedulerResults(effective, result = {}) {
  const homeByIdentity = new Map(effective.home.map((fixture) => [getFixtureFlowIdentity(fixture), fixture]));
  const scheduled = Array.isArray(result?.scheduled) ? result.scheduled : [];
  const unresolved = Array.isArray(result?.unresolved) ? result.unresolved : [];
  const diagnostics = [];
  const scheduledByIdentity = new Map();
  const unresolvedByIdentity = new Map();

  for (const allocation of scheduled) {
    const identity = getFixtureFlowIdentity(allocation);
    if (!homeByIdentity.has(identity)) {
      diagnostics.push(diagnostic("SCHEDULER_RESULT_OUTSIDE_EFFECTIVE_HOME", identity));
    } else if (scheduledByIdentity.has(identity)) {
      diagnostics.push(diagnostic("DUPLICATE_SCHEDULER_RESULT", identity));
    } else {
      scheduledByIdentity.set(identity, allocation);
    }
  }

  for (const unresolvedFixture of unresolved) {
    const identity = getFixtureFlowIdentity(unresolvedFixture);
    if (!homeByIdentity.has(identity)) {
      diagnostics.push(diagnostic("SCHEDULER_RESULT_OUTSIDE_EFFECTIVE_HOME", identity));
    } else if (unresolvedByIdentity.has(identity)) {
      diagnostics.push(diagnostic("DUPLICATE_SCHEDULER_RESULT", identity));
    } else {
      unresolvedByIdentity.set(identity, unresolvedFixture);
    }
  }

  for (const identity of scheduledByIdentity.keys()) {
    if (unresolvedByIdentity.has(identity)) {
      diagnostics.push(diagnostic("SCHEDULED_AND_UNRESOLVED", identity));
    }
  }

  for (const [identity, fixture] of homeByIdentity) {
    if (!scheduledByIdentity.has(identity) && !unresolvedByIdentity.has(identity)) {
      unresolvedByIdentity.set(identity, { ...fixture, reason: "Scheduler returned no allocation result" });
    }
  }

  return { diagnostics, scheduledByIdentity, unresolvedByIdentity };
}

function blockedSchedule({ effective, diagnostics, revision }) {
  const byIdentity = new Map((effective?.fixtures || []).map((fixture) => [
    getFixtureFlowIdentity(fixture),
    { fixture, state: fixture.excludedFromGroundControl ? "excluded" : fixture.isAwayFixture ? "away" : "blocked", allocation: null },
  ]));
  return {
    safe: false,
    revision: Number(revision) || 0,
    fixtures: effective?.fixtures || [],
    included: effective?.included || [],
    excluded: effective?.excluded || [],
    home: effective?.home || [],
    away: effective?.away || [],
    scheduled: [],
    unresolved: [],
    conflicts: [],
    diagnostics,
    byIdentity,
    resultsByIdentity: byIdentity,
  };
}

/**
 * The sole scheduling materialisation boundary. It owns the canonical fixture
 * set, intent application and final scheduled/unresolved partition so no
 * consumer can reconstruct an allocation from stale fixture fields.
 */
export function buildEffectiveMatchdaySchedule({
  providerFixtures = [],
  manualFixtures = [],
  intents = {},
  scheduler,
  timing = {},
  revision = 0,
} = {}) {
  const effective = materialiseEffectiveFixtures({ providerFixtures, manualFixtures, intents });
  if (!effective.safe) return blockedSchedule({ effective, diagnostics: effective.diagnostics, revision });

  const result = typeof scheduler === "function"
    ? scheduler(effective.home)
    : { scheduled: [], unresolved: effective.home.map((fixture) => ({ ...fixture, reason: "No scheduler configured" })) };
  const indexed = indexSchedulerResults(effective, result);
  if (indexed.diagnostics.length) {
    return blockedSchedule({ effective, diagnostics: indexed.diagnostics, revision });
  }

  const byIdentity = new Map();
  const scheduled = [];
  const unresolved = [];

  effective.excluded.forEach((fixture) => {
    byIdentity.set(getFixtureFlowIdentity(fixture), { fixture, state: "excluded", allocation: null });
  });
  effective.away.forEach((fixture) => {
    byIdentity.set(getFixtureFlowIdentity(fixture), { fixture, state: "away", allocation: null });
  });

  for (const [identity, sourceFixture] of effective.home.map((fixture) => [getFixtureFlowIdentity(fixture), fixture])) {
    const derivedFixture = indexed.scheduledByIdentity.get(identity);
    if (derivedFixture) {
      const allocation = resolveEffectiveAllocation({
        fixture: sourceFixture,
        derivedAllocation: derivedFixture,
        intent: intents?.[identity],
        timing,
      });
      scheduled.push(allocation);
      byIdentity.set(identity, { fixture: allocation, state: "scheduled", allocation });
      continue;
    }

    const unresolvedFixture = { ...sourceFixture, ...(indexed.unresolvedByIdentity.get(identity) || {}) };
    unresolved.push(unresolvedFixture);
    byIdentity.set(identity, { fixture: unresolvedFixture, state: "unresolved", allocation: null });
  }

  const outputValidation = validateSchedulingFixtureInput(scheduled);
  if (!outputValidation.safe) {
    return blockedSchedule({ effective, diagnostics: outputValidation.diagnostics, revision });
  }

  return {
    safe: true,
    revision: Number(revision) || 0,
    fixtures: effective.fixtures,
    included: effective.included,
    excluded: effective.excluded,
    home: effective.home,
    away: effective.away,
    scheduled,
    unresolved,
    conflicts: Array.isArray(result?.conflicts) ? result.conflicts : [],
    diagnostics: [],
    byIdentity,
    resultsByIdentity: byIdentity,
  };
}

export function resolveEffectiveFixtureAllocation(schedule = {}, fixtureIdentity, pendingPatch = {}) {
  const record = schedule?.byIdentity?.get?.(cleanIdentity(fixtureIdentity));
  if (!record || record.state !== "scheduled") return null;
  return resolveEffectiveAllocation({
    fixture: record.fixture,
    derivedAllocation: record.allocation || record.fixture,
    pendingPatch,
  });
}
