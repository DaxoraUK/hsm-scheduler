import { AVG_CARS } from "../../constants.js";
import { getParkingCapacity } from "../../domain/clubDomain.js";
import { isParkingEnabled } from "../../settings/workspaceSettings.js";
import {
  getFixtureDuration,
  isFixtureActive,
  timeToMinutes,
} from "../../engines/validationEngine.js";
import { SCHEDULING_TIME_INCREMENT_MINS } from "../../domain/fixtureOccupancy.js";
function numberOrFallback(value, fallback) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nonNegativeNumber(value, fallback = 0) {
  return Math.max(0, numberOrFallback(value, fallback));
}

export function getParkingSettings(club = {}) {
  const enabled = isParkingEnabled(club);
  const carParkSpaces = getParkingCapacity(club, 0);
  const maxConcurrent = nonNegativeNumber(club.maxConcurrent, 3);
  const parkingPressureThresholdPct = Math.min(
    100,
    nonNegativeNumber(club.parkingPressureThresholdPct, 85)
  );

  return {
    enabled,
    configured: enabled && carParkSpaces > 0,
    carParkSpaces,
    maxConcurrent,
    parkingPressureThresholdPct,
    avgCars: {
      ...AVG_CARS,
      ...(club.avgCars || {}),
    },
    pitchParkingImpact: club.pitchParkingImpact || club.pitchParkingOverrides || {},
  };
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getPitchForFixture(fixture = {}, pitchCfg = []) {
  if (!fixture.pitchId) return null;
  return pitchCfg.find((pitch) => pitch.id === fixture.pitchId) || null;
}

export function pitchAffectsParking(fixture = {}, pitchCfg = [], club = {}) {
  const settings = getParkingSettings(club);

  if (!settings.enabled) {
    return false;
  }

  if (typeof fixture.affectsParking === "boolean") {
    return fixture.affectsParking;
  }

  const pitchId = fixture.pitchId;

  if (
    pitchId &&
    Object.prototype.hasOwnProperty.call(settings.pitchParkingImpact, pitchId)
  ) {
    return settings.pitchParkingImpact[pitchId] !== false;
  }

  const pitch = getPitchForFixture(fixture, pitchCfg);

  if (typeof pitch?.affectsParking === "boolean") {
    return pitch.affectsParking;
  }

  return true;
}

// Backwards-compatible alias for legacy parking chart components.
export const fixtureAffectsParking = pitchAffectsParking;

export function getFixtureWindow(fixture = {}) {
  const koMins =
    fixture.koMins != null ? fixture.koMins : timeToMinutes(fixture.koTime);

  if (koMins == null) {
    return null;
  }

  const endMins =
    fixture.endMins != null
      ? fixture.endMins
      : koMins + getFixtureDuration(fixture);

  return {
    start: koMins,
    end: endMins,
  };
}

export function fixturesOverlapByWindow(fixtureA = {}, fixtureB = {}) {
  const aWindow = getFixtureWindow(fixtureA);
  const bWindow = getFixtureWindow(fixtureB);

  if (!aWindow || !bWindow) {
    return false;
  }

  return aWindow.start < bWindow.end && bWindow.start < aWindow.end;
}

export function getFixtureFormat(fixture = {}) {
  return fixture.cfg?.format || fixture.manualFormat || fixture.format || "";
}

export function getEstimatedCarsForFixture(fixture = {}, club = {}, pitchCfg = []) {
  if (!pitchAffectsParking(fixture, pitchCfg, club)) {
    return 0;
  }

  const settings = getParkingSettings(club);
  const format = getFixtureFormat(fixture);

  const explicitEstimate = numberOrFallback(fixture.carEstimate, null);
  if (explicitEstimate != null) {
    return Math.max(0, explicitEstimate);
  }

  return nonNegativeNumber(
    settings.avgCars?.[format] ??
      settings.avgCars?.[String(format).toLowerCase()] ??
      AVG_CARS?.[format],
    8
  );
}

export function getOverlappingActiveFixtures({
  fixtures = [],
  fixtureIndex,
  next = {},
  pitchCfg = [],
  club = {},
  parkingOnly = false,
} = {}) {
  if (!isFixtureActive(next)) {
    return [];
  }

  if (parkingOnly && !pitchAffectsParking(next, pitchCfg, club)) {
    return [];
  }

  return fixtures.filter((fixture, index) => {
    if (index === fixtureIndex) return false;
    if (!isFixtureActive(fixture)) return false;
    if (parkingOnly && !pitchAffectsParking(fixture, pitchCfg, club)) return false;

    return fixturesOverlapByWindow(next, fixture);
  });
}

export function getParkingLoad({
  fixtures = [],
  fixtureIndex,
  next = {},
  club = {},
  pitchCfg = [],
} = {}) {
  const affectsParking = pitchAffectsParking(next, pitchCfg, club);
  const overlappingFixtures = getOverlappingActiveFixtures({
    fixtures,
    fixtureIndex,
    next,
    pitchCfg,
    club,
    parkingOnly: true,
  });

  const proposedCars = getEstimatedCarsForFixture(next, club, pitchCfg);

  const overlappingCars = overlappingFixtures.reduce(
    (total, fixture) => total + getEstimatedCarsForFixture(fixture, club, pitchCfg),
    0
  );

  const estimatedCars = overlappingCars + proposedCars;
  const settings = getParkingSettings(club);
  const percentage = settings.carParkSpaces
    ? Math.round((estimatedCars / settings.carParkSpaces) * 100)
    : 0;

  return {
    affectsParking,
    overlappingFixtures,
    concurrentGames: affectsParking ? overlappingFixtures.length + 1 : 0,
    estimatedCars,
    proposedCars,
    percentage,
    overCapacity:
      settings.enabled && settings.configured && estimatedCars > settings.carParkSpaces,
    overConcurrentLimit:
      settings.enabled &&
      affectsParking &&
      settings.maxConcurrent > 0 &&
      overlappingFixtures.length + 1 > settings.maxConcurrent,
  };
}

function getScheduleBounds(
  fixtures = [],
  fallbackStartMins = 8 * 60,
  slotMins = SCHEDULING_TIME_INCREMENT_MINS
) {
  const activeWindows = fixtures
    .filter(isFixtureActive)
    .map(getFixtureWindow)
    .filter(Boolean);

  if (!activeWindows.length) {
    return {
      start: fallbackStartMins,
      end: 15 * 60,
    };
  }

  const earliest = Math.min(...activeWindows.map((window) => window.start));
  const latest = Math.max(...activeWindows.map((window) => window.end));

  return {
    start:
      Math.floor(Math.min(earliest, fallbackStartMins) / slotMins) * slotMins,
    end: Math.ceil(Math.max(latest, 15 * 60) / slotMins) * slotMins,
  };
}

export function analyseParkingPressure({
  fixtures = [],
  club = {},
  pitchCfg = [],
  startMins = 8 * 60,
  slotMins = SCHEDULING_TIME_INCREMENT_MINS,
} = {}) {
  const safeSlotMins = Math.max(SCHEDULING_TIME_INCREMENT_MINS, nonNegativeNumber(slotMins, SCHEDULING_TIME_INCREMENT_MINS));
  const settings = getParkingSettings(club);
  const bounds = getScheduleBounds(fixtures, startMins, safeSlotMins);
  const activeFixtures = fixtures.filter(isFixtureActive);
  const parkingFixtures = activeFixtures.filter((fixture) =>
    pitchAffectsParking(fixture, pitchCfg, club)
  );
  const exemptFixtures = activeFixtures.filter(
    (fixture) => !pitchAffectsParking(fixture, pitchCfg, club)
  );

  const slots = [];

  for (let mins = bounds.start; mins <= bounds.end; mins += safeSlotMins) {
    const activeAtSlot = activeFixtures.filter((fixture) => {
      const window = getFixtureWindow(fixture);
      return window && window.start <= mins && window.end > mins;
    });

    const parkingAtSlot = activeAtSlot.filter((fixture) =>
      pitchAffectsParking(fixture, pitchCfg, club)
    );

    const exemptAtSlot = activeAtSlot.filter(
      (fixture) => !pitchAffectsParking(fixture, pitchCfg, club)
    );

    const estimatedCars = parkingAtSlot.reduce(
      (total, fixture) => total + getEstimatedCarsForFixture(fixture, club, pitchCfg),
      0
    );

    const occupancyPct = settings.carParkSpaces
      ? Math.round((estimatedCars / settings.carParkSpaces) * 100)
      : 0;

    slots.push({
      mins,
      label: minutesToTime(mins),
      fixtures: activeAtSlot,
      parkingFixtures: parkingAtSlot,
      exemptFixtures: exemptAtSlot,
      fixtureCount: parkingAtSlot.length,
      totalFixtureCount: activeAtSlot.length,
      exemptFixtureCount: exemptAtSlot.length,
      estimatedCars,
      occupancyPct,
      overCapacity:
        settings.enabled && settings.configured && estimatedCars > settings.carParkSpaces,
      overConcurrentLimit:
        settings.enabled && settings.maxConcurrent > 0 && parkingAtSlot.length > settings.maxConcurrent,
      highPressure:
        settings.enabled && settings.configured &&
        occupancyPct >= settings.parkingPressureThresholdPct,
    });
  }

  const peakSlot = slots.reduce(
    (peak, slot) =>
      !peak || slot.estimatedCars > peak.estimatedCars ? slot : peak,
    null
  );

  const busiestByGames = slots.reduce(
    (peak, slot) =>
      !peak || slot.fixtureCount > peak.fixtureCount ? slot : peak,
    null
  );

  const overCapacitySlots = slots.filter((slot) => slot.overCapacity);
  const overConcurrentSlots = slots.filter((slot) => slot.overConcurrentLimit);
  const highPressureSlots = slots.filter((slot) => slot.highPressure && !slot.overCapacity);

  const maxEstimatedCarsPerCurrentLimit = parkingFixtures.reduce((max, fixture) => {
    const cars = getEstimatedCarsForFixture(fixture, club, pitchCfg);
    return cars > max ? cars : max;
  }, 0);

  const safeBySpaces =
    settings.carParkSpaces > 0 && maxEstimatedCarsPerCurrentLimit > 0
      ? Math.max(1, Math.floor(settings.carParkSpaces / maxEstimatedCarsPerCurrentLimit))
      : settings.maxConcurrent;

  const suggestedMaxConcurrent = Math.max(
    1,
    safeBySpaces || settings.maxConcurrent || 1
  );

  return {
    enabled: settings.enabled,
    configured: settings.configured,
    settings,
    slots,
    peakSlot,
    busiestByGames,
    overCapacitySlots,
    overConcurrentSlots,
    highPressureSlots,
    parkingFixtures,
    exemptFixtures,
    isOverCapacity: overCapacitySlots.length > 0,
    isOverConcurrentLimit: overConcurrentSlots.length > 0,
    isHighPressure: highPressureSlots.length > 0,
    suggestedMaxConcurrent,
    canIncreaseConcurrentLimit:
      settings.enabled &&
      settings.configured &&
      settings.maxConcurrent > 0 &&
      suggestedMaxConcurrent > settings.maxConcurrent &&
      peakSlot &&
      peakSlot.estimatedCars < settings.carParkSpaces &&
      !overCapacitySlots.length &&
      !highPressureSlots.length,
  };
}
