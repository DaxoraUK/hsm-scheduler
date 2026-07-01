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
  const parkingLoad = getParkingLoad({
    fixtures,
    fixtureIndex,
    next,
    club,
    pitchCfg,
  });

  if (parkingLoad.concurrentGames <= settings.maxConcurrent) {
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
