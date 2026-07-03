import { getParkingSummary } from "./engines/parkingEngine.js";

export function getActiveFixtures({
  fixtures = null,
  satFinal = [],
  sunFinal = [],
  midweekFinal = [],
  satHasRun,
  sunHasRun,
  midweekHasRun,
} = {}) {
  const source = Array.isArray(fixtures)
    ? fixtures
    : [
        ...(satHasRun ? satFinal : []),
        ...(sunHasRun ? sunFinal : []),
        ...(midweekHasRun ? midweekFinal : []),
      ];

  return source.filter((fixture) => fixture.status !== "postponed");
}

export function isRefConfirmed(fixture) {
  return String(fixture.refStatus || "").toLowerCase() === "confirmed";
}

export function getRefereeStats(options = {}) {
  const fixtures = getActiveFixtures(options);

  const confirmed = fixtures.filter(isRefConfirmed).length;
  const outstanding = fixtures.length - confirmed;

  return {
    total: fixtures.length,
    confirmed,
    outstanding,
    pct: fixtures.length ? Math.round((confirmed / fixtures.length) * 100) : 0,
  };
}

export function getParkingStats({
  fixtures = [],
  club = {},
  pitchCfg = [],
  startMins,
  slotMins,
  scope = "auto",
} = {}) {
  const parking = getParkingSummary({
    fixtures: Array.isArray(fixtures) ? fixtures : [],
    club,
    pitchCfg,
    startMins,
    slotMins,
    scope,
  });

  return {
    enabled: parking.enabled !== false,
    configured: parking.configured === true,
    peakCars: parking.peakCars,
    carCap: parking.capacity,
    capacity: parking.capacity,
    pct: parking.utilisation,
    utilisation: parking.utilisation,
    peakTime: parking.peakTime,
    status: parking.statusKey,
    statusLabel: parking.statusLabel,
    healthScore: parking.healthScore,
    overCapacity: parking.isOverCapacity,
    isHighPressure: parking.isHighPressure,
    isOverConcurrentLimit: parking.isOverConcurrentLimit,
    summary: parking.headline,
    detail: parking.detail,
  };
}
