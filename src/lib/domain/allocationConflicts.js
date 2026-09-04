import { getFixtureFlowIdentity } from "./fixtureVenueFlow.js";

function numericTime(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function linkedPitchIds(pitchId, pitchCfg = []) {
  const id = String(pitchId || "").trim();
  if (!id) return new Set();
  const byId = new Map(pitchCfg.map((pitch) => [String(pitch?.id || ""), pitch]));
  const root = byId.get(id)?.innerOf || id;
  const linked = new Set([id, root]);
  pitchCfg.forEach((pitch) => {
    if (String(pitch?.innerOf || "") === root) linked.add(String(pitch.id));
  });
  return linked;
}

function allocationsOverlap(left, right) {
  return left.koMins < right.endMins && right.koMins < left.endMins;
}

/**
 * The one final-state conflict detector. Its input is the materialised
 * operational allocation, never a provider fixture or an optimiser attempt.
 */
export function findEffectiveAllocationConflicts({ fixtures = [], pitchCfg = [] } = {}) {
  const allocated = fixtures
    .filter((fixture) => fixture?.pitchId && numericTime(fixture.koMins) != null && numericTime(fixture.endMins) != null)
    .map((fixture) => ({
      fixture,
      identity: getFixtureFlowIdentity(fixture),
      pitchId: String(fixture.pitchId),
      koMins: numericTime(fixture.koMins),
      endMins: numericTime(fixture.endMins),
    }))
    .filter((fixture) => fixture.identity && fixture.endMins >= fixture.koMins);
  const conflicts = [];

  for (let index = 0; index < allocated.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < allocated.length; compareIndex += 1) {
      const left = allocated[index];
      const right = allocated[compareIndex];
      const leftLinked = linkedPitchIds(left.pitchId, pitchCfg);
      if (!leftLinked.has(right.pitchId) || !allocationsOverlap(left, right)) continue;
      conflicts.push({
        a: left.fixture,
        b: right.fixture,
        canonicalFixtureIdentities: [left.identity, right.identity].sort(),
        pitchIds: [left.pitchId, right.pitchId],
        koMins: Math.max(left.koMins, right.koMins),
        endMins: Math.min(left.endMins, right.endMins),
      });
    }
  }
  return conflicts;
}
