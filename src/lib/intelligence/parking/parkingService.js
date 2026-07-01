import { AVG_CARS } from "../../constants.js";
import {
  getFixtureDuration,
  isFixtureActive,
  timeToMinutes,
} from "../../engines/validationEngine.js";
import { getSuggestionWindowForFixture, isKickOffAllowedForFixture } from "../scheduling/kickOffRules.js";

export function getParkingSettings(club = {}) {
  return {
    carParkSpaces: Number(club.carParkSpaces || 57),
    maxConcurrent: Number(club.maxConcurrent || 3),
    parkingPressureThresholdPct: Number(club.parkingPressureThresholdPct || 85),
    avgCars: club.avgCars || AVG_CARS,
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
  if (typeof fixture.affectsParking === "boolean") {
    return fixture.affectsParking;
  }

  const settings = getParkingSettings(club);
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

  return (
    fixture.carEstimate ||
    settings.avgCars?.[format] ||
    settings.avgCars?.[String(format).toLowerCase()] ||
    AVG_CARS?.[format] ||
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
    overCapacity: estimatedCars > settings.carParkSpaces,
    overConcurrentLimit:
      affectsParking && overlappingFixtures.length + 1 > settings.maxConcurrent,
  };
}

function getScheduleBounds(fixtures = [], fallbackStartMins = 8 * 60) {
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
    start: Math.floor(Math.min(earliest, fallbackStartMins) / 30) * 30,
    end: Math.ceil(Math.max(latest, 15 * 60) / 30) * 30,
  };
}

export function analyseParkingPressure({
  fixtures = [],
  club = {},
  pitchCfg = [],
  startMins = 8 * 60,
  slotMins = 30,
} = {}) {
  const settings = getParkingSettings(club);
  const bounds = getScheduleBounds(fixtures, startMins);
  const activeFixtures = fixtures.filter(isFixtureActive);
  const parkingFixtures = activeFixtures.filter((fixture) =>
    pitchAffectsParking(fixture, pitchCfg, club)
  );
  const exemptFixtures = activeFixtures.filter(
    (fixture) => !pitchAffectsParking(fixture, pitchCfg, club)
  );

  const slots = [];

  for (let mins = bounds.start; mins <= bounds.end; mins += slotMins) {
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
      overCapacity: estimatedCars > settings.carParkSpaces,
      overConcurrentLimit: parkingAtSlot.length > settings.maxConcurrent,
      highPressure: occupancyPct >= settings.parkingPressureThresholdPct,
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

  const safeBySpaces = maxEstimatedCarsPerCurrentLimit
    ? Math.max(1, Math.floor(settings.carParkSpaces / maxEstimatedCarsPerCurrentLimit))
    : settings.maxConcurrent;

  const suggestedMaxConcurrent = Math.max(
    1,
    Math.min(settings.maxConcurrent, safeBySpaces)
  );

  return {
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
      peakSlot &&
      peakSlot.estimatedCars < settings.carParkSpaces &&
      busiestByGames &&
      busiestByGames.fixtureCount >= settings.maxConcurrent,
  };
}

function buildCandidateWithTime(fixture = {}, koMins) {
  const duration = getFixtureDuration({
    ...fixture,
    koMins,
    endMins: null,
  });

  return {
    ...fixture,
    koTime: minutesToTime(koMins),
    koMins,
    endMins: koMins + duration,
  };
}

function getPeakParkingFixtures(analysis = {}) {
  return analysis.peakSlot?.parkingFixtures || [];
}

export function getParkingRecommendations({
  fixtures = [],
  club = {},
  pitchCfg = [],
  start = "08:30",
  end = "17:00",
  interval = 15,
  limit = 4,
} = {}) {
  const analysis = analyseParkingPressure({ fixtures, club, pitchCfg });
  const peak = analysis.peakSlot;

  if (!peak || (!analysis.isOverCapacity && !analysis.isHighPressure && !analysis.isOverConcurrentLimit)) {
    return [];
  }

  const startMins = timeToMinutes(start);
  const endMins = timeToMinutes(end);

  if (startMins == null || endMins == null) return [];

  const recommendations = [];
  const peakCars = peak.estimatedCars || 0;
  const peakPct = peak.occupancyPct || 0;
  const peakFixtures = getPeakParkingFixtures(analysis);

  peakFixtures.forEach((fixture) => {
    const fixtureIndex = fixtures.indexOf(fixture);
    if (fixtureIndex < 0) return;

    let bestTime = null;
    const window = getSuggestionWindowForFixture({ fixture, club });
    const fixtureStartMins = timeToMinutes(window.start) ?? startMins;
    const fixtureEndMins = timeToMinutes(window.end) ?? endMins;

    for (let mins = fixtureStartMins; mins <= fixtureEndMins; mins += interval) {
      if (mins === fixture.koMins) continue;

      const candidateKoTime = minutesToTime(mins);
      if (!isKickOffAllowedForFixture({ fixture, koTime: candidateKoTime, club })) continue;

      const candidateFixtures = fixtures.map((item, index) =>
        index === fixtureIndex ? buildCandidateWithTime(item, mins) : item
      );

      const candidateAnalysis = analyseParkingPressure({
        fixtures: candidateFixtures,
        club,
        pitchCfg,
      });

      const newPeak = candidateAnalysis.peakSlot?.estimatedCars || 0;
      const newPct = candidateAnalysis.peakSlot?.occupancyPct || 0;
      const reduction = peakCars - newPeak;

      if (reduction <= 0) continue;

      const candidate = {
        type: "time",
        fixtureIndex,
        fixture,
        title: `Move ${fixture.homeTeam || "fixture"} to ${candidateKoTime}`,
        detail: `Reduces peak parking from ${peakPct}% to ${newPct}%.`,
        koTime: candidateKoTime,
        koMins: mins,
        endMins: buildCandidateWithTime(fixture, mins).endMins,
        reduction,
        score: reduction * 10 - Math.abs((fixture.koMins || 0) - mins) / 15,
      };

      if (!bestTime || candidate.score > bestTime.score) {
        bestTime = candidate;
      }
    }

    if (bestTime) recommendations.push(bestTime);

    const fixtureFormat = getFixtureFormat(fixture);
    const exemptPitch = pitchCfg.find(
      (pitch) =>
        pitch.id !== fixture.pitchId &&
        pitch.affectsParking === false &&
        (!fixtureFormat || pitch.format === fixtureFormat)
    );

    if (exemptPitch) {
      const candidateFixtures = fixtures.map((item, index) =>
        index === fixtureIndex
          ? {
              ...item,
              pitchId: exemptPitch.id,
              pitchLabel: exemptPitch.label || exemptPitch.id,
            }
          : item
      );
      const candidateAnalysis = analyseParkingPressure({
        fixtures: candidateFixtures,
        club,
        pitchCfg,
      });
      const newPeak = candidateAnalysis.peakSlot?.estimatedCars || 0;
      const newPct = candidateAnalysis.peakSlot?.occupancyPct || 0;
      const reduction = peakCars - newPeak;

      if (reduction > 0) {
        recommendations.push({
          type: "pitch",
          fixtureIndex,
          fixture,
          title: `Move ${fixture.homeTeam || "fixture"} to ${exemptPitch.label || exemptPitch.id}`,
          detail: `This pitch is configured as parking-exempt. Peak parking drops from ${peakPct}% to ${newPct}%.`,
          pitchId: exemptPitch.id,
          pitchLabel: exemptPitch.label || exemptPitch.id,
          reduction,
          score: reduction * 12,
        });
      }
    }
  });

  return recommendations
    .sort((a, b) => b.score - a.score || b.reduction - a.reduction)
    .slice(0, limit);
}
