import { getParkingLoad, getParkingSettings } from "./parkingService.js";

export function parkingConcurrencyRule({
  fixtures = [],
  fixtureIndex,
  next = {},
  club = {},
  pitchCfg = [],
} = {}) {
  if (!next.koTime) {
    return null;
  }

  const settings = getParkingSettings(club);
  if (!settings.enabled) {
    return null;
  }

  const parkingLoad = getParkingLoad({
    fixtures,
    fixtureIndex,
    next,
    club,
    pitchCfg,
  });

  if (
    settings.maxConcurrent <= 0 ||
    parkingLoad.concurrentGames <= settings.maxConcurrent
  ) {
    return null;
  }

  return {
    ok: false,
    type: "parking_concurrency",
    rule: "parkingConcurrencyRule",
    severity: "blocked",
    reason: `This move would create ${parkingLoad.concurrentGames} parking-impact games. The current parking control limit is ${settings.maxConcurrent}.`,
    clash: {
      homeTeam: next.homeTeam,
      awayTeam: next.awayTeam,
      pitchId: next.pitchId,
      pitchLabel: next.pitchLabel,
      koTime: next.koTime,
      status: next.status || "active",
      concurrentGames: parkingLoad.concurrentGames,
      maxConcurrent: settings.maxConcurrent,
      estimatedCars: parkingLoad.estimatedCars,
      overlappingFixtures: parkingLoad.overlappingFixtures,
    },
  };
}


export function parkingCapacityRule({
  fixtures = [],
  fixtureIndex,
  next = {},
  club = {},
  pitchCfg = [],
} = {}) {
  if (!next.koTime) {
    return null;
  }

  const settings = getParkingSettings(club);
  if (!settings.enabled || !settings.configured) {
    return null;
  }

  const parkingLoad = getParkingLoad({
    fixtures,
    fixtureIndex,
    next,
    club,
    pitchCfg,
  });

  if (!parkingLoad.overCapacity) {
    return null;
  }

  return {
    ok: false,
    type: "parking_capacity",
    rule: "parkingCapacityRule",
    severity: "blocked",
    reason: `This move would create an estimated parking demand of ${parkingLoad.estimatedCars} cars against ${settings.carParkSpaces} configured spaces.`,
    clash: {
      homeTeam: next.homeTeam,
      awayTeam: next.awayTeam,
      pitchId: next.pitchId,
      pitchLabel: next.pitchLabel,
      koTime: next.koTime,
      status: next.status || "active",
      concurrentGames: parkingLoad.concurrentGames,
      estimatedCars: parkingLoad.estimatedCars,
      carParkSpaces: settings.carParkSpaces,
      percentage: parkingLoad.percentage,
      overlappingFixtures: parkingLoad.overlappingFixtures,
    },
  };
}
