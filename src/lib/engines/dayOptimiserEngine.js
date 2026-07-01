import { getValidatedFixRecommendations } from "./recommendationEngine.js";
import { validateFixtureUpdate } from "./validationEngine.js";

function getFixtureTitle(fixture = {}) {
  return [fixture.homeTeam || fixture.team || fixture.fixture, fixture.awayTeam]
    .filter(Boolean)
    .join(" vs ") || "Fixture";
}

function applyPatch(fixture = {}, patch = {}) {
  return {
    ...fixture,
    ...patch,
  };
}

function getMoveSummary(fixture = {}, patch = {}) {
  const parts = [];

  if (patch.koTime && patch.koTime !== fixture.koTime) {
    parts.push(`${fixture.koTime || "TBC"} → ${patch.koTime}`);
  }

  if (patch.pitchLabel && patch.pitchLabel !== fixture.pitchLabel) {
    parts.push(`${fixture.pitchLabel || fixture.pitchId || "Pitch TBC"} → ${patch.pitchLabel}`);
  }

  if (!parts.length && patch.pitchId && patch.pitchId !== fixture.pitchId) {
    parts.push(`${fixture.pitchId || "Pitch TBC"} → ${patch.pitchId}`);
  }

  return parts.join(" · ") || "Review fixture move";
}

function getUniqueKey(recommendation = {}) {
  return [
    recommendation.fixtureIndex,
    recommendation.patch?.koTime || "",
    recommendation.patch?.pitchId || "",
  ].join("|");
}

export function calculateDayOptimisation({
  fixtures = [],
  pitchCfg = [],
  closedPitches = [],
  club = {},
  start,
  end,
  interval = 15,
  maxMoves = 4,
} = {}) {
  const activeFixtures = fixtures.filter((fixture) => fixture?.status !== "postponed");

  if (!activeFixtures.length) {
    return {
      status: "neutral",
      label: "No fixtures",
      score: 100,
      summary: "No active fixtures to optimise yet.",
      moves: [],
      metrics: {
        activeFixtures: 0,
        estimatedCarReduction: 0,
        peakReduction: 0,
        validatedMoves: 0,
      },
    };
  }

  const candidateMap = new Map();

  fixtures.forEach((fixture, fixtureIndex) => {
    if (fixture?.status === "postponed") return;

    const recommendations = getValidatedFixRecommendations({
      fixtures,
      fixtureIndex,
      pitchCfg,
      closedPitches,
      club,
      start,
      end,
      interval,
      limit: 1,
      allowParkingImprovement: true,
      minimumCarReduction: 1,
    });

    recommendations.forEach((recommendation) => {
      const key = getUniqueKey(recommendation);
      if (!candidateMap.has(key)) {
        candidateMap.set(key, recommendation);
      }
    });
  });

  const candidates = Array.from(candidateMap.values()).sort((a, b) =>
    Number(b.reduction || 0) - Number(a.reduction || 0) ||
    Number(b.percentReduction || 0) - Number(a.percentReduction || 0) ||
    Number(b.score || 0) - Number(a.score || 0)
  );

  const workingFixtures = fixtures.map((fixture) => ({ ...fixture }));
  const accepted = [];
  const usedFixtures = new Set();

  candidates.forEach((candidate) => {
    if (accepted.length >= maxMoves) return;
    if (usedFixtures.has(candidate.fixtureIndex)) return;

    const validation = validateFixtureUpdate({
      fixtures: workingFixtures,
      fixtureIndex: candidate.fixtureIndex,
      pitchCfg,
      patch: candidate.patch,
      closedPitches,
      club,
    });

    if (!validation.ok) return;

    const fixture = workingFixtures[candidate.fixtureIndex] || {};
    workingFixtures[candidate.fixtureIndex] = applyPatch(fixture, candidate.patch);
    usedFixtures.add(candidate.fixtureIndex);

    accepted.push({
      ...candidate,
      fixtureTitle: candidate.fixtureTitle || getFixtureTitle(fixture),
      summary: getMoveSummary(fixture, candidate.patch),
    });
  });

  const estimatedCarReduction = accepted.reduce(
    (total, move) => total + Math.max(0, Number(move.reduction || 0)),
    0
  );

  const peakReduction = accepted.reduce(
    (total, move) => total + Math.max(0, Number(move.percentReduction || 0)),
    0
  );

  const score = Math.max(0, Math.min(100, 100 - Math.round(peakReduction)));
  const hasMoves = accepted.length > 0;

  return {
    status: hasMoves ? "warning" : "success",
    label: hasMoves ? "Optimisation available" : "Optimised",
    score,
    summary: hasMoves
      ? `${accepted.length} validated move${accepted.length === 1 ? "" : "s"} can improve matchday flow without creating new clashes.`
      : "No validated parking or scheduling improvements are currently needed.",
    moves: accepted,
    metrics: {
      activeFixtures: activeFixtures.length,
      estimatedCarReduction,
      peakReduction: Math.round(peakReduction),
      validatedMoves: accepted.length,
    },
  };
}
