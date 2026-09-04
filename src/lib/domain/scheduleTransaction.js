import { getFixtureFlowIdentity } from "./fixtureVenueFlow.js";
import { resolveEffectiveAllocation } from "./effectiveAllocation.js";
import { getFixtureOccupancy } from "./fixtureOccupancy.js";
import { createPitchRegistry } from "../registry/pitchRegistry.js";
import { isPitchSuitableForFixture } from "../intelligence/pitch/pitchService.js";

const allocationFields = ["pitchId", "pitchLabel", "koTime", "koMins", "endMins"];

function canonicalIdentity(fixture = {}) {
  return String(getFixtureFlowIdentity(fixture) || fixture.canonicalFixtureIdentity || "").trim();
}

function allocationPatch(patch = {}) {
  return allocationFields.reduce((result, field) => {
    if (Object.prototype.hasOwnProperty.call(patch, field)) result[field] = patch[field];
    return result;
  }, {});
}

function normaliseMutation(mutation = {}) {
  const fixtureIdentity = String(mutation.fixtureIdentity || "").trim();
  if (!fixtureIdentity) return null;
  return Object.freeze({
    fixtureIdentity,
    patch: Object.freeze(allocationPatch(mutation.patch)),
  });
}

function cloneFixtures(fixtures = []) {
  return (Array.isArray(fixtures) ? fixtures : []).map((fixture) => ({ ...fixture }));
}

function buildBaseRevision(fixtures = []) {
  return cloneFixtures(fixtures)
    .map((fixture) => [canonicalIdentity(fixture), fixture.pitchId || "", fixture.koMins ?? fixture.koTime ?? ""].join("|"))
    .sort()
    .join(";");
}

function isActiveFixture(fixture = {}) {
  const status = String(fixture.status || "active").toLowerCase();
  return !["postponed", "cancelled", "away", "unresolved"].includes(status)
    && fixture.isAwayFixture !== true
    && fixture.requiresScheduling !== false;
}

function fixtureWindow(fixture = {}, timing = {}) {
  const occupancy = getFixtureOccupancy({ fixture, timing });
  const start = occupancy.koMins;
  const end = fixture.endMins != null && !Number.isNaN(Number(fixture.endMins))
    ? Number(fixture.endMins)
    : occupancy.endMins;
  return { start, end };
}

function overlaps(first = {}, second = {}, timing = {}) {
  const firstWindow = fixtureWindow(first, timing);
  const secondWindow = fixtureWindow(second, timing);
  return firstWindow.start != null && firstWindow.end != null && secondWindow.start != null && secondWindow.end != null
    && firstWindow.start < secondWindow.end
    && secondWindow.start < firstWindow.end;
}

function diagnostic(type, fixture, detail = {}) {
  return {
    type,
    fixtureIdentity: canonicalIdentity(fixture),
    ...detail,
  };
}

export function createScheduleTransaction({ baseFixtures = [], timing = {}, baseRevision } = {}) {
  const fixtures = cloneFixtures(baseFixtures);
  return Object.freeze({
    baseFixtures: fixtures,
    baseRevision: String(baseRevision || buildBaseRevision(fixtures)),
    timing: { ...(timing || {}) },
    mutations: [],
    redoMutations: [],
  });
}

export function appendScheduleMutation(transaction = {}, mutation = {}) {
  const nextMutation = normaliseMutation(mutation);
  if (!nextMutation) return transaction;
  const knownIdentities = new Set((transaction.baseFixtures || []).map(canonicalIdentity));
  if (!knownIdentities.has(nextMutation.fixtureIdentity)) return transaction;
  return Object.freeze({
    ...transaction,
    mutations: [...(transaction.mutations || []), nextMutation],
    redoMutations: [],
  });
}

export function undoScheduleMutation(transaction = {}) {
  const mutations = transaction.mutations || [];
  const previous = mutations.at(-1);
  if (!previous) return transaction;
  return Object.freeze({
    ...transaction,
    mutations: mutations.slice(0, -1),
    redoMutations: [...(transaction.redoMutations || []), previous],
  });
}

export function redoScheduleMutation(transaction = {}) {
  const redoMutations = transaction.redoMutations || [];
  const mutation = redoMutations.at(-1);
  if (!mutation) return transaction;
  return Object.freeze({
    ...transaction,
    mutations: [...(transaction.mutations || []), mutation],
    redoMutations: redoMutations.slice(0, -1),
  });
}

export function discardScheduleTransaction(transaction = {}) {
  return createScheduleTransaction({
    baseFixtures: transaction.baseFixtures || [],
    timing: transaction.timing || {},
    baseRevision: transaction.baseRevision,
  });
}

export function getProposedSchedule(transaction = {}) {
  const timing = transaction.timing || {};
  return (transaction.mutations || []).reduce((fixtures, mutation) =>
    fixtures.map((fixture) => canonicalIdentity(fixture) === mutation.fixtureIdentity
      ? resolveEffectiveAllocation({
        fixture,
        derivedAllocation: fixture,
        pendingPatch: mutation.patch,
        timing,
      })
      : fixture),
  cloneFixtures(transaction.baseFixtures || []));
}

export function getScheduleTransactionPatches(transaction = {}) {
  const projected = getProposedSchedule(transaction);
  const mutatedIdentities = new Set((transaction.mutations || []).map((mutation) => mutation.fixtureIdentity));
  return projected.reduce((patches, fixture) => {
    const fixtureIdentity = canonicalIdentity(fixture);
    if (!mutatedIdentities.has(fixtureIdentity)) return patches;
    return {
      ...patches,
      [fixtureIdentity]: allocationFields.reduce((patch, field) => {
        if (fixture[field] != null && fixture[field] !== "") patch[field] = fixture[field];
        return patch;
      }, {}),
    };
  }, {});
}

export function validateProposedSchedule({
  fixtures = [],
  pitchCfg = [],
  timing = {},
  closedPitches = [],
  mutatedFixtureIdentities = [],
} = {}) {
  const blocking = [];
  const provisional = [];
  const activeFixtures = (Array.isArray(fixtures) ? fixtures : []).filter(isActiveFixture);
  const registry = createPitchRegistry(pitchCfg);
  const closed = new Set((closedPitches || []).map((pitchId) => String(pitchId || "").trim()));
  const mutated = new Set((mutatedFixtureIdentities || []).map((identity) => String(identity || "").trim()));
  const knownIdentities = new Set();

  activeFixtures.forEach((fixture) => {
    const fixtureIdentity = canonicalIdentity(fixture);
    if (!fixtureIdentity || knownIdentities.has(fixtureIdentity)) {
      blocking.push(diagnostic("duplicate_canonical_identity", fixture));
      return;
    }
    knownIdentities.add(fixtureIdentity);
    if (!fixture.pitchId || fixtureWindow(fixture, timing).start == null) return;
    const linkedPitchIds = registry.getLinkedPitchIds(fixture.pitchId);
    if (linkedPitchIds.some((pitchId) => closed.has(pitchId))) {
      blocking.push(diagnostic("pitch_closed", fixture, { pitchId: fixture.pitchId }));
    }
    const pitch = (pitchCfg || []).find((candidate) => candidate.id === fixture.pitchId);
    if (pitch && !isPitchSuitableForFixture(pitch, fixture)) {
      blocking.push(diagnostic("pitch_unsuitable", fixture, { pitchId: fixture.pitchId }));
    }
  });

  for (let firstIndex = 0; firstIndex < activeFixtures.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < activeFixtures.length; secondIndex += 1) {
      const first = activeFixtures[firstIndex];
      const second = activeFixtures[secondIndex];
      const linkedPitchIds = registry.getLinkedPitchIds(first.pitchId);
      if (!first.pitchId || !linkedPitchIds.includes(second.pitchId) || !overlaps(first, second, timing)) continue;
      const item = diagnostic("pitch_clash", first, {
        otherFixtureIdentity: canonicalIdentity(second),
        pitchId: first.pitchId,
      });
      if (mutated.has(canonicalIdentity(first)) || mutated.has(canonicalIdentity(second))) provisional.push(item);
      else blocking.push(item);
    }
  }

  return { blocking, provisional };
}

export function isScheduleTransactionDirty(transaction = {}) {
  return (transaction.mutations || []).length > 0;
}
