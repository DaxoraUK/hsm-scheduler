import { analyseParkingPressure, getParkingSettings } from "../intelligence/parking/parkingService.js";

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normaliseScope(scope = "auto") {
  const value = String(scope || "auto").toLowerCase();
  if (["saturday", "sat"].includes(value)) return "saturday";
  if (["sunday", "sun"].includes(value)) return "sunday";
  if (["weekend", "all"].includes(value)) return "weekend";
  return "auto";
}

function getFixtureDayKey(fixture = {}) {
  const raw =
    fixture.__day ||
    fixture.day ||
    fixture.matchday ||
    fixture.matchDay ||
    fixture.fixtureDay ||
    fixture.dateLabel ||
    fixture.date ||
    fixture.kickoffDate ||
    fixture.kickOffDate ||
    "matchday";

  const value = String(raw || "matchday").toLowerCase();

  if (value.includes("sat")) return "saturday";
  if (value.includes("sun")) return "sunday";

  return value || "matchday";
}

function filterByScope(fixtures = [], scope = "auto") {
  const normalised = normaliseScope(scope);

  if (normalised === "saturday" || normalised === "sunday") {
    return fixtures.filter((fixture) => getFixtureDayKey(fixture) === normalised);
  }

  return fixtures;
}

function groupFixturesByDay(fixtures = []) {
  return fixtures.reduce((groups, fixture) => {
    const key = getFixtureDayKey(fixture);
    if (!groups[key]) groups[key] = [];
    groups[key].push(fixture);
    return groups;
  }, {});
}

function hasMultipleDayGroups(fixtures = []) {
  return Object.keys(groupFixturesByDay(fixtures)).length > 1;
}

function getStatus({ utilisation = 0, overCapacity = false, overConcurrent = false } = {}) {
  if (overCapacity || utilisation > 100) {
    return {
      key: "critical",
      label: "Over capacity",
      variant: "danger",
      score: 35,
    };
  }

  if (overConcurrent || utilisation >= 85) {
    return {
      key: "watch",
      label: "Watch",
      variant: "warning",
      score: 70,
    };
  }

  return {
    key: "healthy",
    label: "Healthy",
    variant: "success",
    score: 100,
  };
}

function analyseSingleScope({ fixtures = [], club = {}, pitchCfg = [], startMins, slotMins, scopeLabel = "matchday" } = {}) {
  const settings = getParkingSettings(club);
  const analysis = analyseParkingPressure({
    fixtures,
    club,
    pitchCfg,
    startMins,
    slotMins,
  });

  const capacity = Math.max(0, toNumber(settings.carParkSpaces, 0));
  const peakSlot = analysis.peakSlot || null;
  const peakCars = peakSlot ? toNumber(peakSlot.estimatedCars, 0) : 0;
  const utilisation = capacity > 0 ? Math.round((peakCars / capacity) * 100) : 0;
  const peakTime = peakSlot?.label || "TBC";
  const peakFixtures = peakSlot?.parkingFixtures || [];
  const activeFixtures = analysis.parkingFixtures || [];
  const status = getStatus({
    utilisation,
    overCapacity: analysis.isOverCapacity,
    overConcurrent: analysis.isOverConcurrentLimit,
  });

  return {
    scope: scopeLabel,
    capacity,
    peakCars,
    utilisation,
    percentage: utilisation,
    peakTime,
    peakSlot,
    peakFixtures,
    activeFixtures,
    fixtureCount: activeFixtures.length,
    status,
    statusKey: status.key,
    statusLabel: status.label,
    variant: status.variant,
    healthScore: status.score,
    isOverCapacity: analysis.isOverCapacity || utilisation > 100,
    isOverConcurrentLimit: analysis.isOverConcurrentLimit,
    isHighPressure: analysis.isHighPressure || utilisation >= 85,
    overCapacitySlots: analysis.overCapacitySlots || [],
    overConcurrentSlots: analysis.overConcurrentSlots || [],
    highPressureSlots: analysis.highPressureSlots || [],
    suggestedMaxConcurrent: analysis.suggestedMaxConcurrent,
    canIncreaseConcurrentLimit: analysis.canIncreaseConcurrentLimit,
    timeline: analysis.slots || [],
    analysis,
  };
}

function mergeWeekendSnapshot(daySnapshots = []) {
  const valid = daySnapshots.filter(Boolean);

  if (!valid.length) {
    return analyseSingleScope({ fixtures: [], scopeLabel: "weekend" });
  }

  const highestPeak = [...valid].sort((a, b) => {
    if (b.utilisation !== a.utilisation) return b.utilisation - a.utilisation;
    return b.peakCars - a.peakCars;
  })[0];

  const status = getStatus({
    utilisation: highestPeak.utilisation,
    overCapacity: highestPeak.isOverCapacity,
    overConcurrent: highestPeak.isOverConcurrentLimit,
  });

  return {
    ...highestPeak,
    scope: "weekend",
    sourceScope: highestPeak.scope,
    daySnapshots: valid,
    status,
    statusKey: status.key,
    statusLabel: status.label,
    variant: status.variant,
    healthScore: status.score,
    detailScopeLabel:
      highestPeak.scope === "saturday"
        ? "Saturday peak"
        : highestPeak.scope === "sunday"
          ? "Sunday peak"
          : "Busiest daily peak",
  };
}

export function getParkingSnapshot({
  fixtures = [],
  club = {},
  pitchCfg = [],
  startMins,
  slotMins,
  scope = "auto",
} = {}) {
  const normalisedScope = normaliseScope(scope);
  const scopedFixtures = filterByScope(fixtures, normalisedScope);

  if (
    normalisedScope === "weekend" ||
    (normalisedScope === "auto" && hasMultipleDayGroups(scopedFixtures))
  ) {
    const groups = groupFixturesByDay(scopedFixtures);
    const daySnapshots = Object.entries(groups).map(([day, dayFixtures]) =>
      analyseSingleScope({
        fixtures: dayFixtures,
        club,
        pitchCfg,
        startMins,
        slotMins,
        scopeLabel: day,
      })
    );

    return mergeWeekendSnapshot(daySnapshots);
  }

  const label = normalisedScope === "auto" ? getFixtureDayKey(scopedFixtures[0]) : normalisedScope;

  return analyseSingleScope({
    fixtures: scopedFixtures,
    club,
    pitchCfg,
    startMins,
    slotMins,
    scopeLabel: label,
  });
}

export function getParkingSummary(args = {}) {
  const snapshot = getParkingSnapshot(args);
  const scopeLabel = snapshot.detailScopeLabel || snapshot.scope || "matchday";

  return {
    ...snapshot,
    headline:
      snapshot.capacity <= 0
        ? "Parking capacity not configured"
        : snapshot.peakCars <= 0
          ? "No parking demand yet"
          : `${snapshot.peakCars}/${snapshot.capacity} spaces at ${snapshot.peakTime}`,
    detail:
      snapshot.capacity <= 0
        ? "Add parking capacity in Settings before reviewing parking readiness."
        : `${snapshot.utilisation}% peak use based on the ${scopeLabel}.`,
  };
}

function applyFixturePatch(fixtures = [], fixtureIndex, patch = {}, replacementFixture = null) {
  if (!Array.isArray(fixtures)) return [];

  const index = Number(fixtureIndex);

  if (Number.isInteger(index) && index >= 0 && index < fixtures.length) {
    return fixtures.map((fixture, itemIndex) =>
      itemIndex === index ? { ...fixture, ...(replacementFixture || {}), ...patch } : fixture
    );
  }

  if (replacementFixture) {
    const candidateId = replacementFixture.id || replacementFixture.fixtureId || replacementFixture.key;

    if (candidateId) {
      return fixtures.map((fixture) => {
        const fixtureId = fixture.id || fixture.fixtureId || fixture.key;
        return fixtureId === candidateId ? { ...fixture, ...replacementFixture, ...patch } : fixture;
      });
    }
  }

  return fixtures;
}

function normaliseImpactSnapshot(snapshot = {}) {
  return {
    ...snapshot,
    estimatedCars: Number(snapshot.peakCars || 0),
    percentage: Number(snapshot.percentage ?? snapshot.utilisation ?? 0),
    games: Number(snapshot.fixtureCount || 0),
    label: snapshot.peakTime || snapshot.scope || "matchday",
  };
}

function buildParkingImpact(beforeSnapshot, afterSnapshot) {
  const before = normaliseImpactSnapshot(beforeSnapshot);
  const after = normaliseImpactSnapshot(afterSnapshot);

  const beforeCars = Number(before.estimatedCars || 0);
  const afterCars = Number(after.estimatedCars || 0);
  const beforePct = Number(before.percentage || 0);
  const afterPct = Number(after.percentage || 0);
  const beforeGames = Number(before.games || 0);
  const afterGames = Number(after.games || 0);

  return {
    before,
    after,
    carDelta: Math.max(0, beforeCars - afterCars),
    percentDelta: Math.max(0, beforePct - afterPct),
    gameDelta: Math.max(0, beforeGames - afterGames),
    deltaCars: afterCars - beforeCars,
    deltaUtilisation: afterPct - beforePct,
  };
}

export function getMatchdayParkingImpact({
  fixtures = [],
  fixtureIndex,
  patch = {},
  club = {},
  pitchCfg = [],
  scope = "auto",
  startMins,
  slotMins,
} = {}) {
  const before = getParkingSnapshot({ fixtures, club, pitchCfg, scope, startMins, slotMins });
  const afterFixtures = applyFixturePatch(fixtures, fixtureIndex, patch);
  const after = getParkingSnapshot({ fixtures: afterFixtures, club, pitchCfg, scope, startMins, slotMins });

  return buildParkingImpact(before, after);
}

export function getFixtureParkingImpact({
  fixture,
  fixtures = [],
  fixtureIndex,
  current = null,
  patch = {},
  club = {},
  pitchCfg = [],
  scope = "auto",
  startMins,
  slotMins,
} = {}) {
  const replacementFixture = fixture || current || null;
  const before = getParkingSnapshot({ fixtures, club, pitchCfg, scope, startMins, slotMins });
  const afterFixtures = applyFixturePatch(fixtures, fixtureIndex, patch, replacementFixture);
  const after = getParkingSnapshot({ fixtures: afterFixtures, club, pitchCfg, scope, startMins, slotMins });

  return buildParkingImpact(before, after);
}

export function getDayScopedParkingSummary({ fixtures = [], club = {}, pitchCfg = [], startMins, slotMins } = {}) {
  const groups = groupFixturesByDay(fixtures);

  return Object.fromEntries(
    Object.entries(groups).map(([day, dayFixtures]) => [
      day,
      getParkingSummary({
        fixtures: dayFixtures,
        club,
        pitchCfg,
        startMins,
        slotMins,
        scope: day,
      }),
    ])
  );
}

export default getParkingSnapshot;
